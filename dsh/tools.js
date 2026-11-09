import { fetchOverview, readState } from './sync.js';

const text = (value) => [{ type: 'text', text: value }];

function summarizeState(state) {
  const t = state?.totals ?? {};
  const last = state?.lastRunAt ?? 'never';
  return `上次同步: ${last}；导入 ${t.imported ?? 0}，跳过 ${t.skipped ?? 0}，失败 ${t.failed ?? 0}`;
}

export function buildTools(ctx, getConfig, guardedSync) {
  return [
    {
      name: 'skill_sync_status',
      description:
        'Read skill auto-sync state and scan overview (Codex/Cursor sources vs installed DSH skills).',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: { summary: { type: 'string' } },
        },
        render: (_args, v) => text(v.summary ?? JSON.stringify(v, null, 2)),
      },
      async execute() {
        const overview = await fetchOverview(ctx);
        const state = await readState();
        return { summary: summarizeState(state), state, overview };
      },
    },
    {
      name: 'skill_sync_now',
      description:
        'Import new skills from Codex and Cursor into the default DSH skill root (existing names skipped).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sources: {
            type: 'array',
            description: 'Optional source ids: codex, cursor.',
            items: { type: 'string' },
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: { summary: { type: 'string' } },
        },
        render: (_args, v) => text(v.summary ?? JSON.stringify(v, null, 2)),
      },
      async execute(args) {
        const config = { ...getConfig() };
        if (Array.isArray(args?.sources) && args.sources.length > 0) {
          config.enabledSourceIds = args.sources.filter((s) => typeof s === 'string');
        }
        const result = await guardedSync(config, 'tool');
        if (result.busy) return { summary: '同步正在进行中，请稍后再试。', ...result };
        return { summary: summarizeState(result.state), ...result };
      },
    },
  ];
}
