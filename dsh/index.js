import Schema from '@deepseek-ai/schemastery';
import { batchToggle, fetchOverview, readState, runSync } from './sync.js';
import { buildTools } from './tools.js';
import { checkUpdate, applyUpdate } from './update.js';
import { DetailError, readDetail } from './detail.js';

export const name = 'skill-sync';
export const inject = ['connection'];

export const Config = Schema.object({
  autoSyncOnBoot: Schema.boolean().default(true),
  bootDelayMs: Schema.number().step(1).min(0).default(8000),
  intervalMs: Schema.number().step(1).min(0).default(3_600_000),
  targetRootId: Schema.string().default('user-dsh'),
  enabledSourceIds: Schema.array(Schema.string()).default([]),
});

let syncRunning = false;

function json(status, body) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function normalizedConfig(raw = {}) {
  const enabled = Array.isArray(raw.enabledSourceIds) ? raw.enabledSourceIds : [];
  return {
    autoSyncOnBoot: raw.autoSyncOnBoot !== false,
    bootDelayMs: raw.bootDelayMs ?? 8000,
    intervalMs: raw.intervalMs ?? 3_600_000,
    targetRootId: raw.targetRootId || 'user-dsh',
    enabledSourceIds: enabled.length > 0 ? enabled : null,
  };
}

async function guardedSync(ctx, config, trigger) {
  if (syncRunning) return { busy: true, state: await readState() };
  syncRunning = true;
  try {
    const state = await runSync(ctx, config, trigger);
    return { busy: false, state };
  } finally {
    syncRunning = false;
  }
}

export function apply(ctx, rawConfig = {}) {
  const config = normalizedConfig(rawConfig);
  const getConfig = () => config;
  const runGuarded = (trigger) => guardedSync(ctx, config, trigger);

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/skill-sync',
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        async fetch(request) {
          const url = new URL(request.url, 'http://localhost');
          const action = url.searchParams.get('action') ?? 'status';
          try {
            if (request.method === 'GET' && action === 'overview') {
              return json(200, await fetchOverview(ctx));
            }
            if (request.method === 'GET') {
              return json(200, { state: await readState(), config });
            }
            if (request.method === 'POST' && action === 'detail') {
              let body;
              try { body = await request.json(); } catch { return json(400, { error: 'invalid JSON body' }); }
              return json(200, await readDetail(ctx, body));
            }
            if (request.method === 'POST' && action === 'run') {
              return json(200, await runGuarded('manual'));
            }
            if (request.method === 'POST' && (action === 'check-update' || action === 'apply-update')) {
              let body;
              try { body = await request.json(); } catch { return json(400, { error: 'invalid JSON body' }); }
              return json(200, await (action === 'check-update' ? checkUpdate(ctx, body) : applyUpdate(ctx, body)));
            }
            if (request.method === 'POST' && action === 'toggle-batch') {
              let body = {};
              try {
                body = await request.json();
              } catch {
                return json(400, { error: 'invalid JSON body' });
              }
              const items = Array.isArray(body.items) ? body.items : [];
              const outcomes = await batchToggle(
                ctx,
                items,
                body.modelInvocable !== false,
              );
              return json(200, { outcomes });
            }
            return json(405, { error: 'unsupported action' });
          } catch (error) {
            return json(error instanceof DetailError ? error.status : 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    'skill-sync:api',
  );

  // tools/timer are optional: a missing service or a tool rejected by the
  // registry must not take down the sidebar API.
  ctx.inject(['tools'], (scoped) => {
    for (const tool of buildTools(scoped, getConfig, (cfg, trigger) =>
      guardedSync(scoped, cfg, trigger),
    )) {
      scoped.tools.register(tool);
    }
  });

  ctx.inject(['timer'], (scoped) => {
    if (config.autoSyncOnBoot) {
      scoped.timer.timeout(() => {
        runGuarded('boot').catch(() => {});
      }, config.bootDelayMs);
    }
    if (config.intervalMs > 0) {
      scoped.timer.interval(() => {
        runGuarded('scheduled').catch(() => {});
      }, config.intervalMs);
    }
  });
}
