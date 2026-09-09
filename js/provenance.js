// DPC Hub · js/provenance.js · v1.0 · 09/09/26 · Job A1 — single source of truth
// Records where every data domain was actually loaded from, and makes that
// visible. Solves the failure this was built for: when the OneDrive folder
// handle does not reconnect, data.js proceeds with empty defaults and every
// module renders zeros with nothing on screen to say so. A report generated
// in that state is silently wrong.
//
// No UI logic beyond the badge and the Settings panel. No data mutation.
// Loads BEFORE data.js. Depends only on DPC_CONFIG.

(function () {
  'use strict';

  // ── Domain registry ─────────────────────────────────────────
  // Filename → { key, label, required }
  // `required` domains make the whole store untrustworthy if they fall back.
  const DOMAINS = Object.freeze({
    'data-areas.json':            { key: 'areas',           label: 'Curriculum areas',   required: true  },
    'data-calendar.json':         { key: 'calendar',        label: 'Calendar',           required: true  },
    'data-health-checks.json':    { key: 'healthChecks',    label: 'Health Checks',      required: false },
    'data-afi.json':              { key: 'afi',             label: 'AFIs',               required: false },
    'data-action-plans.json':     { key: 'actionPlans',     label: 'Action Plans',       required: false },
    'data-staff.json':            { key: 'staff',           label: 'Staff',              required: false },
    'data-digital-leads.json':    { key: 'digitalLeads',    label: 'Digital Leads',      required: false },
    'data-reflections.json':      { key: 'reflections',     label: 'Reflections',        required: false },
    'data-templates.json':        { key: 'templates',       label: 'Templates',          required: false },
    'data-cpd.json':              { key: 'cpd',             label: 'CPD',                required: false },
    'data-current-focus.json':    { key: 'currentFocus',    label: 'Current focus',      required: false },
    'data-notes.json':            { key: 'notes',           label: 'Notes',              required: false },
    'data-resource-library.json': { key: 'resourceLibrary', label: 'Resource library',   required: false },
    'data-departments.json':      { key: 'departments',     label: 'Departments',        required: false },
    'data-ai-runs.json':          { key: 'aiRuns',          label: 'AI runs',            required: false },
  });

  // ── Source vocabulary ───────────────────────────────────────
  // Controlled list. Never write a source string that is not in here.
  const SOURCE = Object.freeze({
    ONEDRIVE: 'onedrive',   // read from the connected OneDrive folder — trustworthy
    SEED:     'seed',       // built from data/areas-seed.json in the repo — NOT your records
    EMPTY:    'empty',      // module default, nothing loaded
    SNAPSHOT: 'snapshot',   // restored from the localStorage session snapshot
    UNKNOWN:  'unknown',
  });

  const SOURCE_LABEL = Object.freeze({
    onedrive: 'OneDrive',
    seed:     'Repo seed file',
    empty:    'Empty default',
    snapshot: 'Session snapshot',
    unknown:  'Unknown',
  });

  // ── Module state ────────────────────────────────────────────
  let _records   = {};     // key → { key, label, required, source, filename, fileModified, count, at }
  let _connected = false;
  let _folder    = null;
  let _loadedAt  = null;

  function nowISO() { return new Date().toISOString(); }

  // Count records without assuming a shape. Domain files are either
  // { <name>: [...] } or a bare array.
  function countRecords(data) {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data !== 'object') return 0;
    let best = 0;
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length > best) best = v.length;
    }
    return best;
  }

  // ── Public API ──────────────────────────────────────────────
  const P = {
    SOURCE,
    DOMAINS,

    reset() {
      _records = {};
      _connected = false;
      _folder = null;
      _loadedAt = null;
    },

    setConnection(isConnected, folderName) {
      _connected = !!isConnected;
      _folder    = folderName || null;
    },

    // Called by data.js at each load decision point.
    record(filename, source, data, fileModified) {
      const meta = DOMAINS[filename];
      if (!meta) return;
      _records[meta.key] = {
        key:          meta.key,
        label:        meta.label,
        required:     meta.required,
        filename:     filename,
        source:       source || SOURCE.UNKNOWN,
        fileModified: fileModified || null,
        count:        countRecords(data),
        at:           nowISO(),
      };
      _loadedAt = nowISO();
    },

    // Everything not otherwise recorded is an empty default. Called once
    // after the load sequence so no domain is left unaccounted for.
    fillGaps() {
      for (const [filename, meta] of Object.entries(DOMAINS)) {
        if (!_records[meta.key]) {
          P.record(filename, SOURCE.EMPTY, null, null);
        }
      }
      _loadedAt = _loadedAt || nowISO();
    },

    get(key) { return _records[key] || null; },
    all()    { return Object.values(_records); },

    // ── Overall trust state ───────────────────────────────────
    // 'live'    — connected, every required domain read from OneDrive
    // 'partial' — connected, but something fell back
    // 'seed'    — areas came from the repo seed file, not your records
    // 'offline' — no folder connection at all
    state() {
      if (!_connected) return 'offline';
      const rows = P.all();
      if (rows.some(r => r.source === SOURCE.SEED)) return 'seed';
      const req = rows.filter(r => r.required);
      if (req.some(r => r.source !== SOURCE.ONEDRIVE)) return 'partial';
      if (rows.some(r => r.source === SOURCE.SNAPSHOT)) return 'partial';
      return 'live';
    },

    isLive() { return P.state() === 'live'; },

    // ── Human-readable summary, reused by the badge, Settings and reports
    summary() {
      const st = P.state();
      switch (st) {
        case 'live':
          return {
            state: st,
            short: 'Live data',
            detail: `Read from ${_folder || 'the connected OneDrive folder'}.`,
            tone: 'ok',
          };
        case 'partial':
          return {
            state: st,
            short: 'Partial data',
            detail: 'Connected, but at least one file did not load and is showing an empty default. Figures on screen may be understated.',
            tone: 'warn',
          };
        case 'seed':
          return {
            state: st,
            short: 'Seed data — not your records',
            detail: 'Areas were built from the repository seed file. Health Checks, AFIs and activity counts will read low or zero. Do not report from this.',
            tone: 'bad',
          };
        default:
          return {
            state: 'offline',
            short: 'Not connected to OneDrive',
            detail: 'The Hub is showing empty defaults. Nothing on screen is your data. Reconnect the folder before reading any figure.',
            tone: 'bad',
          };
      }
    },

    // ── Report guard ──────────────────────────────────────────
    // reports.js calls this before generating. Returns null when safe,
    // otherwise an object the Report Builder renders as a blocking notice.
    reportGuard() {
      if (P.isLive()) return null;
      const s = P.summary();
      const missing = P.all()
        .filter(r => r.source !== SOURCE.ONEDRIVE)
        .map(r => r.label);
      return {
        block:   s.state === 'offline' || s.state === 'seed',
        title:   s.short,
        message: s.detail,
        missing: missing,
      };
    },

    // ── Badge in the header ───────────────────────────────────
    renderBadge() {
      const el = document.getElementById('provenance-badge');
      if (!el) return;
      const s = P.summary();
      const when = _loadedAt
        ? new Date(_loadedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
      // Icon is decorative — the state is always carried in the text too.
      const icon = s.tone === 'ok' ? '●' : s.tone === 'warn' ? '▲' : '■';
      el.className = 'prov-badge prov-badge--' + s.tone;
      el.innerHTML =
        '<span class="prov-badge__icon" aria-hidden="true">' + icon + '</span>' +
        '<span class="prov-badge__text">' + s.short + (when ? ' · ' + when : '') + '</span>';
      el.setAttribute('title', s.detail);
      el.hidden = false;
    },

    // ── Settings panel ────────────────────────────────────────
    renderPanel() {
      const s = P.summary();
      const rows = P.all().sort((a, b) => (b.required - a.required) || a.label.localeCompare(b.label));
      const body = rows.map(r => {
        const cls = r.source === SOURCE.ONEDRIVE ? 'ok' : (r.source === SOURCE.EMPTY ? 'warn' : 'bad');
        const mod = r.fileModified
          ? new Date(r.fileModified).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
          : '—';
        return '<tr>' +
          '<th scope="row">' + r.label + (r.required ? ' <span class="prov-req">required</span>' : '') + '</th>' +
          '<td><span class="prov-tag prov-tag--' + cls + '">' + SOURCE_LABEL[r.source] + '</span></td>' +
          '<td class="prov-num">' + r.count + '</td>' +
          '<td>' + mod + '</td>' +
          '</tr>';
      }).join('');

      return '' +
        '<div class="prov-panel prov-panel--' + s.tone + '">' +
          '<h3 class="prov-panel__h">Where this data came from</h3>' +
          '<p class="prov-panel__state"><strong>' + s.short + '</strong> ' + s.detail + '</p>' +
          (_folder ? '<p class="prov-panel__folder">Connected folder: <code>' + _folder + '</code></p>' : '') +
        '</div>' +
        '<div class="prov-table-wrap">' +
        '<table class="prov-table">' +
          '<caption>Every data file the Hub loaded this session, and where each came from.</caption>' +
          '<thead><tr>' +
            '<th scope="col">Data</th><th scope="col">Source</th>' +
            '<th scope="col">Records</th><th scope="col">File last modified</th>' +
          '</tr></thead>' +
          '<tbody>' + body + '</tbody>' +
        '</table></div>';
    },

    // Called by app.js once the load sequence has finished.
    init(isConnected, folderName) {
      P.setConnection(isConnected, folderName);
      P.fillGaps();
      P.renderBadge();
    },
  };

  window.DPCProvenance = P;
})();
