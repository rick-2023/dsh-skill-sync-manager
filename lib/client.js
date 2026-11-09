window.__ModuleLoader__.load({
  id: 'skill-sync-manager',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    const TAB_STORAGE_KEY = 'skill-sync-manager:tab';

    const css = `
      .ssm-wrap { height:100%; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); padding:24px 24px 16px; box-sizing:border-box; font:14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .ssm-wrap * { box-sizing:border-box; }
      .ssm-fixed { flex:none; display:flex; flex-direction:column; gap:16px; }
      .ssm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .ssm-head h1 { margin:0; font-size:24px; line-height:32px; font-weight:650; letter-spacing:-.02em; color:var(--dsw-alias-label-primary); }
      .ssm-lead { margin:8px 0 0; max-width:42em; font-size:14px; line-height:24px; font-weight:400; color:var(--dsw-alias-label-secondary); }
      .ssm-icons { display:flex; gap:8px; flex:none; }
      .ssm-icon-btn { width:32px; height:32px; display:grid; place-items:center; border-radius:8px; border:0; background:none; color:var(--dsw-alias-label-primary); cursor:pointer; padding:0; }
      .ssm-icon-btn:disabled { opacity:.5; cursor:wait; }
      .ssm-icon-btn:hover:not(:disabled), .ssm-icon-btn:focus-visible:not(:disabled) { background:var(--dsw-alias-bg-layer-2); }
      .ssm-search { width:100%; margin:0; padding:8px 16px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; line-height:24px; }
      .ssm-search::placeholder { color:var(--dsw-alias-label-secondary); }
      .ssm-search:focus-visible { outline:1px solid var(--dsw-alias-border-l2); }
      .ssm-tabs { display:flex; align-items:flex-end; justify-content:flex-start; gap:4px 12px; flex-wrap:wrap; border-bottom:1px solid var(--dsw-alias-border-l1); }
      .ssm-tab { position:relative; flex:none; min-height:44px; padding:0 8px; border:0; border-radius:6px 6px 0 0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:13px; font-weight:600; line-height:20px; cursor:pointer; white-space:nowrap; transition:background .16s ease,color .16s ease; }
      .ssm-tab::after { content:''; position:absolute; right:8px; bottom:-1px; left:8px; height:2px; border-radius:2px 2px 0 0; background:transparent; }
      .ssm-tab:hover:not([aria-selected="true"]) { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
      .ssm-tab[aria-selected="true"] { color:var(--dsw-alias-label-primary); }
      .ssm-tab[aria-selected="true"]::after { background:var(--dsw-alias-brand-primary); }
      .ssm-tab:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:-2px; }
      .ssm-tab-count { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; margin-left:6px; padding:0 5px; border-radius:6px; font-size:11px; font-weight:650; line-height:20px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); transition:background .16s ease,color .16s ease; }
      .ssm-tab[aria-selected="true"] .ssm-tab-count { color:var(--dsw-alias-brand-primary); background:color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
      .ssm-list-panel { flex:1; min-height:0; margin-top:8px; display:flex; flex-direction:column; animation:ssm-panel-in .2s ease; }
      @keyframes ssm-panel-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .ssm-tab, .ssm-tab-count { transition:none; } .ssm-list-panel { animation:none; } .ssm-tab:active:not(:disabled) { transform:none; } }
      .ssm-section { display:flex; align-items:center; gap:8px; margin:0; min-height:24px; font-size:14px; line-height:24px; font-weight:650; color:var(--dsw-alias-label-primary); }
      .ssm-badge { min-width:24px; height:24px; padding:0 8px; border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font-size:12px; line-height:24px; font-weight:600; text-align:center; }
      .ssm-list { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:8px; scroll-behavior:smooth; }
      .ssm-row { display:flex; align-items:center; gap:16px; min-height:48px; padding:8px 16px; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-layer-1); cursor:pointer; }
      .ssm-row:hover { border-color:var(--dsw-alias-border-l2); }
      .ssm-row:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:-2px; }
      .ssm-hex { flex:none; width:32px; height:32px; display:grid; place-items:center; border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-brand-primary); }
      .ssm-main { min-width:0; flex:1; display:flex; flex-direction:column; justify-content:center; }
      .ssm-name { font-weight:650; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; line-height:16px; color:var(--dsw-alias-label-primary); }
      .ssm-desc { font-size:12px; line-height:16px; font-weight:400; color:var(--dsw-alias-label-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .ssm-side { display:flex; align-items:center; gap:8px; flex:none; }
      .ssm-update { opacity:0; pointer-events:none; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; padding:2px 8px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
      .ssm-row:hover .ssm-update, .ssm-row:focus-within .ssm-update, .ssm-update:focus-visible { opacity:1; pointer-events:auto; }
      @media (hover: none) { .ssm-update { opacity:1; pointer-events:auto; } }
      .ssm-tag { display:inline-flex; align-items:center; height:24px; padding:0 8px; border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font-size:12px; line-height:16px; }
      .ssm-switch { position:relative; display:grid; place-items:center; width:32px; height:16px; padding:0; border:0; border-radius:999px; background:transparent; cursor:pointer; flex:none; -webkit-tap-highlight-color:transparent; }
      .ssm-switch::before { content:''; width:32px; height:16px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; background:var(--dsw-alias-state-idle-primary); transition:background .18s ease,border-color .18s ease,box-shadow .18s ease; }
      .ssm-switch[aria-checked="true"]::before { background:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); }
      .ssm-switch:hover:not(:disabled)::before { box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
      .ssm-switch:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .ssm-switch:disabled { cursor:wait; opacity:.55; }
      .ssm-switch i { position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:var(--dsw-alias-bg-base); box-shadow:0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 28%, transparent); transition:transform .18s ease; }
      .ssm-switch[aria-checked="true"] i { transform:translateX(16px); }
      @media (prefers-reduced-motion: reduce) { .ssm-switch::before, .ssm-switch i { transition:none; } }
      .ssm-result { flex:none; max-height:40%; overflow:auto; margin:8px 0; padding:12px 16px; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-layer-1); overflow-wrap:anywhere; }
      .ssm-result-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .ssm-result-head strong { font-size:14px; }
      .ssm-result p { margin:4px 0; }
      .ssm-result details { margin-top:8px; }
      .ssm-result summary { cursor:pointer; font-weight:600; }
      .ssm-result ul { margin:8px 0; padding-left:20px; }
      .ssm-result li { margin:6px 0; }
      .ssm-result-note { color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
      .ssm-result-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
      @media (max-width:480px) { .ssm-wrap { padding:16px 12px; } .ssm-result { max-height:45%; } }
      .ssm-error { margin:0; min-height:24px; padding:8px 16px; font-size:12px; line-height:16px; color:var(--dsw-alias-state-error-primary); }
      .ssm-empty { margin:0; min-height:48px; display:flex; align-items:center; padding:8px 16px; color:var(--dsw-alias-label-secondary); font-size:14px; line-height:24px; }
      .ssm-mask { position:fixed; inset:0; display:grid; place-items:center; z-index:20; padding:24px; background:color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent); }
      .ssm-dialog { width:min(416px, 100%); padding:24px; border-radius:8px; background:var(--dsw-alias-bg-overlay); color:var(--dsw-alias-label-primary); border:1px solid var(--dsw-alias-border-l2); }
      .ssm-dialog h2 { margin:0 0 16px; font-size:16px; line-height:24px; font-weight:650; }
      .ssm-dialog label { display:grid; grid-template-columns:32px minmax(0, 1fr); align-items:center; column-gap:8px; margin:0 0 8px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:16px; }
      .ssm-dialog input, .ssm-dialog select { width:100%; height:32px; padding:0 8px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; }
      .ssm-dialog-actions { display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:16px; padding-left:40px; }
      .ssm-text-btn { min-height:32px; padding:0 16px; border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); cursor:pointer; font:inherit; }
      .ssm-text-btn.primary { background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); border-color:var(--dsw-alias-brand-primary); }
      .ssm-text-btn:disabled { opacity:.5; cursor:wait; }
      .ssm-detail { width:min(760px, 100%); max-height:min(80vh, 900px); display:flex; flex-direction:column; gap:16px; background:color-mix(in srgb, var(--dsw-alias-bg-base) 75%, var(--dsw-alias-bg-overlay)); }
      .ssm-detail-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
      .ssm-detail-head h2 { margin:0; overflow-wrap:anywhere; }
      .ssm-detail-source { margin:4px 0 0; color:var(--dsw-alias-label-secondary); font-size:12px; }
      .ssm-detail-body { min-height:0; overflow:auto; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; background:var(--dsw-alias-bg-base); padding:16px; }
      .ssm-detail-body pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; }
      .ssm-detail-body:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:-2px; }
    `;

    async function getJson(path) {
      const r = await fetch(path, { headers: { Accept: 'application/json' } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      return body;
    }

    async function postJson(path, body) {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    }

    function scopeOf(rootId) {
      return String(rootId || '').startsWith('project-') ? 'workspace' : 'personal';
    }

    const TABS = [
      { id: 'personal', label: '个人' },
      { id: 'codex', label: 'Codex' },
      { id: 'cursor', label: 'Cursor' },
    ];

    function originFlags(origin) {
      if (origin === '来源未知') return { personal: true, codex: false, cursor: false };
      const parts = String(origin)
        .split(' / ')
        .map((part) => part.trim())
        .filter(Boolean);
      return {
        personal: false,
        codex: parts.some((part) => part === 'Codex'),
        cursor: parts.some((part) => part === 'Cursor'),
      };
    }

    function rowMatchesTab(row, tabId) {
      const flags = originFlags(row.origin);
      if (tabId === 'personal') return flags.personal;
      if (tabId === 'codex') return flags.codex;
      if (tabId === 'cursor') return flags.cursor;
      return true;
    }

    function filterRows(rows, q, tab) {
      const needle = q.trim().toLowerCase();
      return rows.filter((row) => {
        if (!needle) return rowMatchesTab(row, tab);
        return row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle);
      });
    }

    function readStoredTab() {
      try {
        const stored = sessionStorage.getItem(TAB_STORAGE_KEY);
        if (TABS.some((item) => item.id === stored)) return stored;
      } catch {}
      return 'personal';
    }

    function rowsFromOverview(overview) {
      const origins = new Map();
      for (const report of overview?.scan?.reports ?? []) {
        const label = report?.source?.label || report?.source?.id;
        if (!label) continue;
        for (const candidate of report.candidates ?? []) {
          if (!candidate.name) continue;
          const labels = origins.get(candidate.name) ?? new Set();
          labels.add(label);
          origins.set(candidate.name, labels);
        }
      }
      const rows = [];
      for (const group of overview?.skills?.groups ?? []) {
        const scope = scopeOf(group.rootId);
        for (const skill of group.skills ?? []) {
          rows.push({
            name: skill.name,
            description: skill.meta?.description || skill.description || '',
            rootId: group.rootId,
            scope,
            origin: origins.has(skill.name) ? [...origins.get(skill.name)].join(' / ') : '来源未知',
            modelInvocable: skill.meta?.modelInvocable !== false,
          });
        }
      }
      rows.sort((a, b) => a.name.localeCompare(b.name) || a.rootId.localeCompare(b.rootId));
      return rows;
    }

    function IconButton(props) {
      return h(
        'button',
        {
          type: 'button',
          className: 'ssm-icon-btn',
          title: props.title,
          'aria-label': props.title,
          disabled: props.disabled,
          onClick: props.onClick,
          ref: props.buttonRef,
        },
        props.children,
      );
    }

    function Hex() {
      return h(
        'span',
        { className: 'ssm-hex' },
        h(
          'svg',
          { width: 16, height: 16, viewBox: '0 0 28 28', 'aria-hidden': true },
          h('path', {
            d: 'M14 2.2 24.2 8.1v11.8L14 25.8 3.8 19.9V8.1Z',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinejoin: 'round',
          }),
          h('path', {
            d: 'M14 8.2 18.6 14 14 19.8 9.4 14Z',
            fill: 'currentColor',
          }),
        ),
      );
    }

    function issueAdvice(reason, code, message) {
      if (reason === 'already_exists') return '目标中已有同名技能；如需更新，请使用“检查更新”。';
      if (reason === 'origin_record_failed') return '技能已导入，但更新来源未记录。请检查目标目录权限，随后处理来源记录。';
      if (/invalid skill name/i.test(message || '')) return '请检查技能名称格式，修正来源中的名称后重新扫描同步。';
      if (code === 'EACCES' || code === 'EPERM') return '请检查该路径的读取权限，然后重新扫描同步。';
      if (code === 'ENOTDIR') return '请检查来源路径是否为目录，然后重新扫描同步。';
      if (reason === 'import_failed') return '请检查来源文件与目标目录权限，然后重新扫描同步。';
      return '请检查错误信息和来源路径，然后重新扫描同步。';
    }

    function ImportResult(props) {
      const result = props.result;
      const state = result.state || {};
      const totals = state.totals || {};
      const details = Array.isArray(state.details) ? state.details : [];
      const issues = Array.isArray(state.scanIssues) ? state.scanIssues : [];
      const warnings = Array.isArray(state.warnings) ? state.warnings : [];
      const labels = { imported: '新增', skipped: '已存在', failed: '失败' };
      return h('section', { className: 'ssm-result', 'aria-label': '同步反馈', 'aria-busy': result.kind === 'running' ? 'true' : 'false' },
        h('div', { className: 'ssm-result-head' },
          h('strong', { role: 'status', 'aria-live': 'polite' }, result.kind === 'running' ? '正在扫描并同步…' : result.kind === 'busy' ? '已有同步任务正在进行' : result.kind === 'error' ? '同步未完成' : '同步结果'),
          h('button', { type: 'button', className: 'ssm-icon-btn', 'aria-label': '关闭同步反馈', onClick: props.onClose }, '×'),
        ),
        result.kind === 'complete' ? h(React.Fragment, null,
          h('p', null, `新增 ${totals.imported ?? 0} · 已存在 ${totals.skipped ?? 0} · 失败 ${totals.failed ?? 0}`),
          details.length || state.detailsTruncated ? h('details', null,
            h('summary', null, `同步明细（${state.detailTotal ?? details.length}）`),
            state.detailsTruncated ? h('p', { className: 'ssm-result-note' }, `仅显示 ${details.length} 条，共 ${state.detailTotal ?? details.length} 条。`) : null,
            h('ul', null, details.map((item, index) => h('li', { key: index },
              h('span', null, `${labels[item.status] || item.status || '未知'} · ${item.name || '未知技能'}${item.sourceId ? ` · ${item.sourceId}` : ''}`),
              item.message ? h('div', { className: 'ssm-result-note' }, item.message) : null,
              item.status !== 'imported' ? h('div', { className: 'ssm-result-note' }, issueAdvice(item.reason, '', item.message)) : null,
            ))),
          ) : null,
          issues.length ? h('details', null, h('summary', null, `扫描问题（${issues.length}）`), h('ul', null, issues.map((item, index) => h('li', { key: index },
            h('span', null, [item.sourceId, item.path, item.code, item.message].filter(Boolean).join(' · ')),
            h('div', { className: 'ssm-result-note' }, issueAdvice('', item.code)),
          )))) : null,
          warnings.length ? h('details', null, h('summary', null, `导入警告（${warnings.length}）`), h('ul', null, warnings.map((item, index) => h('li', { key: index },
            h('span', null, [item.name, item.sourceId, item.message].filter(Boolean).join(' · ')),
            h('div', { className: 'ssm-result-note' }, issueAdvice(item.reason)),
          )))) : null,
        ) : result.kind === 'error' ? h('p', { role: 'alert' }, result.message) : result.kind === 'busy' ? h('p', null, '请稍后重新扫描同步以获取最新结果。') : null,
        result.kind !== 'running' ? h('div', { className: 'ssm-result-actions' }, h('button', { type: 'button', className: 'ssm-text-btn', disabled: props.disabled, onClick: props.onRetry }, '重新扫描同步')) : null,
      );
    }

    function Panel() {
      const [rows, setRows] = useState([]);
      const [loading, setLoading] = useState(true);
      const [busy, setBusy] = useState('');
      const [error, setError] = useState('');
      const [q, setQ] = useState('');
      const [tab, setTab] = useState(readStoredTab);
      const listRef = useRef(null);
      const tabRefs = useRef({});
      const [detail, setDetail] = useState(null);
      const detailDialogRef = useRef(null);
      const detailCloseRef = useRef(null);
      const detailTriggerRef = useRef(null);
      const detailRequestRef = useRef(0);

      function openDetail(row, trigger) {
        detailTriggerRef.current = trigger;
        const request = ++detailRequestRef.current;
        setDetail({ row, loading: true, content: '', error: '' });
        postJson('/api/skill-sync?action=detail', { rootId: row.rootId, name: row.name })
          .then((result) => {
            if (detailRequestRef.current === request) setDetail({ row, loading: false, content: result.content, error: '' });
          })
          .catch((e) => {
            if (detailRequestRef.current === request) setDetail({ row, loading: false, content: '', error: e.message || String(e) });
          });
      }

      function closeDetail() {
        detailRequestRef.current += 1;
        setDetail(null);
        const trigger = detailTriggerRef.current;
        detailTriggerRef.current = null;
        if (trigger?.isConnected) trigger.focus();
      }

      useEffect(() => {
        if (!detail) return;
        detailCloseRef.current?.focus();
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeDetail();
          } else if (event.key === 'Tab') {
            const items = detailDialogRef.current?.querySelectorAll('button:not(:disabled), [tabindex="0"]');
            if (!items?.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || !detailDialogRef.current.contains(document.activeElement))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !detailDialogRef.current.contains(document.activeElement))) {
              event.preventDefault();
              first.focus();
            }
          }
        }
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [Boolean(detail)]);

      const selectTab = useCallback((nextId) => {
        if (!TABS.some((item) => item.id === nextId)) return;
        if (nextId === tab) {
          listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setTab(nextId);
        try {
          sessionStorage.setItem(TAB_STORAGE_KEY, nextId);
        } catch {}
      }, [tab]);

      useEffect(() => {
        const node = listRef.current;
        if (!node) return;
        try {
          node.scrollTo({ top: 0, behavior: 'auto' });
        } catch {
          node.scrollTop = 0;
        }
      }, [tab]);

      const onTabKeyDown = useCallback(
        (event, itemId) => {
          const idx = TABS.findIndex((item) => item.id === itemId);
          if (idx < 0) return;
          let target = -1;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (idx + 1) % TABS.length;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (idx - 1 + TABS.length) % TABS.length;
          else if (event.key === 'Home') target = 0;
          else if (event.key === 'End') target = TABS.length - 1;
          if (target < 0) return;
          event.preventDefault();
          const next = TABS[target].id;
          selectTab(next);
          tabRefs.current[next]?.focus();
        },
        [selectTab],
      );
      const [updateResult, setUpdateResult] = useState(null);
      const [importResult, setImportResult] = useState(null);
      const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
          const overview = await getJson('/api/skill-sync?action=overview');
          setRows(rowsFromOverview(overview));
        } catch (e) {
          setError(e.message || String(e));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        refresh();
      }, [refresh]);

      const tabCounts = useMemo(() => {
        const counts = { personal: 0, codex: 0, cursor: 0 };
        for (const row of rows) {
          const flags = originFlags(row.origin);
          if (flags.personal) counts.personal += 1;
          if (flags.codex) counts.codex += 1;
          if (flags.cursor) counts.cursor += 1;
        }
        return counts;
      }, [rows]);

      const filtered = useMemo(() => filterRows(rows, q, tab), [rows, q, tab]);

      const sectionTitle =
        q.trim() ? '全部来源的搜索结果' : ({ personal: '个人技能', codex: 'Codex 技能', cursor: 'Cursor 技能' }[tab] || '技能');

      const emptyHint =
        {
          personal: '来源未知的技能会显示在此。',
          codex: '从 ~/.codex/skills 同步且能匹配到来源的技能。',
          cursor: '从 ~/.cursor/skills 同步且能匹配到来源的技能。',
        }[tab] || '';

      async function importSkills() {
        setBusy('import');
        setError('');
        setImportResult({ kind: 'running' });
        try {
          const response = await postJson('/api/skill-sync?action=run');
          if (response.busy) {
            setImportResult({ kind: 'busy' });
            return;
          }
          if (!response.state || !response.state.totals) {
            setImportResult({ kind: 'error', message: '未收到完整的同步结果，请重新扫描同步。' });
            return;
          }
          setImportResult({ kind: 'complete', state: response.state });
          await refresh();
        } catch (e) {
          setImportResult({ kind: 'error', message: e.message || String(e) });
        } finally {
          setBusy('');
        }
      }

      async function checkUpdate(row) {
        setBusy(`update:${row.rootId}:${row.name}`);
        setError('');
        try {
          const result = await postJson('/api/skill-sync?action=check-update', { rootId: row.rootId, name: row.name });
          setUpdateResult({ row, result });
        } catch (e) {
          setError(e.message || String(e));
        } finally {
          setBusy('');
        }
      }

      async function applyUpdate() {
        if (!updateResult) return;
        const { row, result } = updateResult;
        setBusy(`update:${row.rootId}:${row.name}`);
        try {
          const updated = await postJson('/api/skill-sync?action=apply-update', { rootId: row.rootId, name: row.name, token: result.token });
          setUpdateResult({ row, result: updated });
          if (updated.status === 'updated') await refresh();
        } catch (e) {
          setUpdateResult({ row, result: { status: 'blocked', message: e.message || String(e) } });
        } finally {
          setBusy('');
        }
      }

      async function toggleRow(row) {
        setBusy(row.name);
        setError('');
        try {
          await postJson('/api/skill-sync?action=toggle-batch', {
            items: [{ rootId: row.rootId, name: row.name }],
            modelInvocable: !row.modelInvocable,
          });
          setRows((prev) =>
            prev.map((item) =>
              item.name === row.name && item.rootId === row.rootId
                ? { ...item, modelInvocable: !item.modelInvocable }
                : item,
            ),
          );
        } catch (e) {
          setError(e.message || String(e));
        } finally {
          setBusy('');
        }
      }

      let listBody;
      if (filtered.length) {
        listBody = filtered.map((row) =>
          h(
            'div',
            { className: 'ssm-row', key: `${row.rootId}:${row.name}`, role: 'button', tabIndex: 0, 'aria-label': `查看 ${row.name} 详情`, onClick: (event) => openDetail(row, event.currentTarget), onKeyDown: (event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openDetail(row, event.currentTarget); } } },
            h(Hex),
            h(
              'div',
              { className: 'ssm-main' },
              h('div', { className: 'ssm-name' }, row.name),
              h('div', { className: 'ssm-desc' }, row.description || '—'),
            ),
            h(
              'div',
              { className: 'ssm-side', onClick: (event) => event.stopPropagation() },
              h('button', { type: 'button', className: 'ssm-update', disabled: Boolean(busy), onClick: () => checkUpdate(row), 'aria-label': `检查 ${row.name} 的更新` }, busy === `update:${row.rootId}:${row.name}` ? '检查中…' : '检查更新'),
              h('span', { className: 'ssm-tag', title: '根据当前扫描到的同名技能推测来源' }, row.origin),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ssm-switch',
                  role: 'switch',
                  'aria-checked': row.modelInvocable ? 'true' : 'false',
                  'aria-label': `${row.name} 启用`,
                  disabled: busy === row.name,
                  onClick: () => toggleRow(row),
                },
                h('i'),
              ),
            ),
          ),
        );
      } else if (loading) {
        listBody = h('div', { className: 'ssm-empty' }, '正在加载…');
      } else if (error) {
        listBody = h('div', { className: 'ssm-error', role: 'alert' }, error);
      } else {
        listBody = h(
          'div',
          { className: 'ssm-empty', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } },
          h('span', null, q.trim() ? '没有匹配的技能' : '此分类下没有技能'),
          !q.trim() && emptyHint ? h('span', { style: { fontSize: '12px', lineHeight: '16px', opacity: 0.85 } }, emptyHint) : null,
        );
      }

      return h(
        'div',
        { className: 'ssm-wrap' },
        h('style', null, css),
        h(
          'div',
          { className: 'ssm-fixed' },
          h(
            'div',
            { className: 'ssm-head' },
            h(
              'div',
              null,
              h('h1', null, '技能'),
              h(
                'p',
                { className: 'ssm-lead' },
                '管理工作区与个人技能；启用后可在对话用 $skill-name 调用。',
              ),
            ),
            h(
              'div',
              { className: 'ssm-icons' },
              h(
                IconButton,
                {
                  title: '导入',
                  disabled: Boolean(busy) || loading,
                  onClick: importSkills,
                },
                h(ImportIcon),
              ),
              h(
                IconButton,
                {
                  title: '刷新',
                  disabled: Boolean(busy) || loading,
                  onClick: refresh,
                },
                h(RefreshIcon),
              ),
            ),
          ),
          h('input', {
            className: 'ssm-search',
            placeholder: '搜索技能…',
            value: q,
            onChange: (event) => setQ(event.target.value),
          }),
          h(
            'div',
            { className: 'ssm-tabs', role: 'tablist', 'aria-label': '按来源筛选' },
            TABS.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'ssm-tab',
                  role: 'tab',
                  id: `ssm-tab-${item.id}`,
                  'aria-selected': tab === item.id ? 'true' : 'false',
                  'aria-controls': 'ssm-tabpanel',
                  tabIndex: tab === item.id ? 0 : -1,
                  ref: (node) => {
                    if (node) tabRefs.current[item.id] = node;
                  },
                  onClick: () => selectTab(item.id),
                  onKeyDown: (event) => onTabKeyDown(event, item.id),
                },
                item.label,
                h('span', { className: 'ssm-tab-count', 'aria-label': `共 ${tabCounts[item.id] ?? 0} 个` }, String(tabCounts[item.id] ?? 0)),
              ),
            ),
          ),
          h(
            'div',
            { className: 'ssm-section' },
            h('span', null, sectionTitle),
            h('span', { className: 'ssm-badge' }, String(filtered.length)),
          ),
        ),
        importResult ? h(ImportResult, { result: importResult, disabled: Boolean(busy) || loading, onClose: () => setImportResult(null), onRetry: importSkills }) : null,
        h(
          'div',
          {
            key: tab,
            className: 'ssm-list-panel',
            role: 'tabpanel',
            id: 'ssm-tabpanel',
            'aria-labelledby': `ssm-tab-${tab}`,
          },
          h(
            'div',
            { className: 'ssm-list', ref: listRef },
            filtered.length && error ? h('div', { className: 'ssm-error', role: 'alert' }, error) : null,
            listBody,
          ),
        ),
        detail ? h('div', { className: 'ssm-mask', onClick: closeDetail },
          h('div', { className: 'ssm-dialog ssm-detail', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ssm-detail-title', onClick: (event) => event.stopPropagation(), ref: detailDialogRef },
            h('div', { className: 'ssm-detail-head' },
              h('div', null,
                h('h2', { id: 'ssm-detail-title' }, detail.row.name),
                h('p', { className: 'ssm-detail-source' }, `来源：${detail.row.origin}`),
              ),
              h('button', { type: 'button', className: 'ssm-icon-btn', 'aria-label': '关闭详情', onClick: closeDetail, ref: detailCloseRef }, '×'),
            ),
            h('div', { className: 'ssm-detail-body', tabIndex: 0, 'aria-label': 'SKILL.md 内容', 'aria-busy': detail.loading ? 'true' : 'false' },
              detail.loading ? h('div', { role: 'status' }, '正在加载技能内容…') : detail.error ? h('div', { className: 'ssm-error', role: 'alert' }, detail.error) : h('pre', null, detail.content),
            ),
          ),
        ) : null,
        updateResult ? h('div', { className: 'ssm-mask', onClick: () => !busy && setUpdateResult(null) },
          h('div', { className: 'ssm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': '检查技能更新', onClick: (event) => event.stopPropagation() },
            h('h2', null, `检查更新 · ${updateResult.row.name}`),
            h('p', { className: updateResult.result.warning ? 'ssm-error' : undefined, role: updateResult.result.warning ? 'alert' : undefined }, updateResult.result.message || ({ update_available: '发现更新，可以更新此技能。', up_to_date: '当前已是最新版本。', updated: '技能已更新。', blocked: '无法安全更新此技能。' }[updateResult.result.status] || '无法确定更新状态。')),
            h('div', { className: 'ssm-dialog-actions' },
              h('button', { type: 'button', className: 'ssm-text-btn', disabled: Boolean(busy), onClick: () => setUpdateResult(null) }, '关闭'),
              updateResult.result.status === 'update_available' ? h('button', { type: 'button', className: 'ssm-text-btn primary', disabled: Boolean(busy), onClick: applyUpdate }, busy ? '更新中…' : '更新技能') : null,
            ),
          ),
        ) : null,
      );
    }

    function ImportIcon() {
      return svg('M12 4v10M8 10l4 4 4-4M5 19h14');
    }
    function RefreshIcon() {
      return svg('M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5');
    }
    function svg(d) {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d }),
      );
    }

    const PANEL = 'skill-sync';

    function SyncIcon(props) {
      const s = (props && props.size) || 18;
      return h(
        'svg',
        {
          width: s,
          height: s,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          'aria-hidden': true,
        },
        h('path', { d: 'M14 3.2 23.2 8.5v10.6L14 24.4 4.8 19.1V8.5Z' }),
      );
    }

    function SidebarMain() {
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
        h(Panel),
      );
    }

    function apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL, order: 12, label: () => '技能' },
          SyncIcon,
        ),
      );
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, SidebarMain));
    }

    exports.isPlugin = true;
    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
