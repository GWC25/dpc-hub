// DPC Hub · js/inclusion.js · v2.0 · 09/09/26 · issue-level clustering across all five stores (see incl-issues.js)
// Accessibility & Inclusive Learning Environments — college-wide view.
//
// Answers one question for a senior audience: across the Group, where is
// accessibility and inclusive practice weak enough to need training, and
// how many areas share each gap?
//
// Everything is computed from the live store at render time. No figures are
// hardcoded — what shows is whatever data.js loaded this session. Gaps read
// through isGapAFI() so positive findings can never be counted as need.
//
// Scope: the two LRA categories that ARE accessibility and inclusion
// (CAT2 Inclusive TLA & SEND, CAT3 Inclusive Learning Environment) plus
// Assistive Technology from CAT5 and Adaptive Practice from CAT6.

// Themes that constitute the accessibility / inclusion picture.
const INCL_THEME_IDS = Object.freeze([
  // CAT2 — Inclusive TLA & SEND
  'PL', 'AR', 'ARD', 'LL2', 'NS',
  // CAT3 — Inclusive Learning Environment
  'LE', 'LED', 'RL', 'PR', 'BR', 'EAS',
  // Cross-category, unambiguously inclusion work
  'AT',   // Assistive Technology (CAT5)
  'AP',   // Adaptive Practice (CAT6)
  'SS',   // Scaffolding & Support (CAT5)
]);

// The three college hyper-focus themes, called out separately because they
// are the Group priority for 2025-26.
const INCL_HYPER_IDS = Object.freeze(['ARD', 'LED', 'AT']);

// ── Entry point ───────────────────────────────────────────────
let _inclData = null;
let _inclIssues = null;
let _inclLastTrigger = null;

function initInclusion() {
  const main = document.getElementById('main-content');
  const d = _inclCompute();
  _inclData = d;
  _inclIssues = inclBuildIssues();

  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>

    <div style="margin-bottom:var(--space-lg);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">
        Accessibility &amp; Inclusive Learning Environments
      </h1>
      <p style="font-size:var(--text-sm);color:var(--color-muted);max-width:70ch;margin-top:var(--space-xs);">
        College-wide picture, built from ${d.totalGaps} improvement record${d.totalGaps === 1 ? '' : 's'}
        across ${d.areasWithData} curriculum area${d.areasWithData === 1 ? '' : 's'}.
        Positive findings are held separately and are not counted as need.
      </p>
    </div>

    ${_inclProvenanceLine()}
    ${_inclKPIs(d)}
    ${_inclHyperFocus(d)}
    ${_inclIssueTable()}
    ${_inclCoverage()}
    ${_inclAreaSpread(d)}
    ${_inclStrengths(d)}
    ${_inclSourceMix(d)}
    ${_inclCaveat(d)}
    <div id="incl-dialog-host"></div>
  `;

  main.addEventListener('click', _inclDelegate);
}

// ── Click delegation ──────────────────────────────────────────
function _inclDelegate(ev) {
  const btn = ev.target.closest('[data-incl-open]');
  if (!btn) return;
  ev.preventDefault();
  _inclLastTrigger = btn;
  const [kind, id] = btn.getAttribute('data-incl-open').split(':');
  if (kind === 'issue') { _inclOpenIssueDetail(id); return; }
  _inclOpenDetail(kind, id);
}

// ── Data ──────────────────────────────────────────────────────
function _inclCompute() {
  const gaps = (typeof getGapAFIs === 'function')
    ? getGapAFIs()
    : ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => a.severity !== 'Strength');
  const strengths = (typeof getStrengthAFIs === 'function')
    ? getStrengthAFIs()
    : ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => a.severity === 'Strength');

  const inScope   = gaps.filter(a => INCL_THEME_IDS.includes(a.lraThemeId));
  const inScopeSt = strengths.filter(a => INCL_THEME_IDS.includes(a.lraThemeId));

  // theme → { label, category, areas:Set, open, immediate, records[] }
  const byTheme = {};
  for (const a of inScope) {
    const t = (typeof LRA_THEME_INDEX !== 'undefined') ? LRA_THEME_INDEX[a.lraThemeId] : null;
    if (!t) continue;
    if (!byTheme[t.id]) {
      byTheme[t.id] = {
        id: t.id, label: t.label, category: t.categoryLabel, desc: t.desc,
        areas: new Set(), open: 0, immediate: 0, total: 0, records: [],
      };
    }
    const row = byTheme[t.id];
    row.records.push(a);
    row.total++;
    if (a.areaCode) row.areas.add(a.areaCode);
    if (a.status !== 'closed') row.open++;
    if (a.severity === 'Areas for Immediate Improvement') row.immediate++;
  }

  const themes = Object.values(byTheme)
    .map(t => ({ ...t, areaCount: t.areas.size, areaList: [...t.areas].sort() }))
    .sort((a, b) => (b.areaCount - a.areaCount) || (b.open - a.open));

  // area → count of open inclusion gaps
  const byArea = {};
  for (const a of inScope) {
    if (!a.areaCode || a.status === 'closed') continue;
    byArea[a.areaCode] = (byArea[a.areaCode] || 0) + 1;
  }
  const areaRows = Object.entries(byArea)
    .map(([code, n]) => ({ code, n }))
    .sort((a, b) => b.n - a.n);

  // source mix — which instruments are actually feeding this picture
  const bySource = {};
  for (const a of inScope) {
    const s = a.source || 'unknown';
    bySource[s] = (bySource[s] || 0) + 1;
  }

  const hyper = INCL_HYPER_IDS.map(id => {
    const t = byTheme[id];
    const meta = (typeof LRA_THEME_INDEX !== 'undefined') ? LRA_THEME_INDEX[id] : null;
    return {
      id,
      label: meta ? meta.label : id,
      areaCount: t ? t.areas.size : 0,
      open: t ? t.open : 0,
      immediate: t ? t.immediate : 0,
    };
  });

  const areasWithData = new Set(inScope.map(a => a.areaCode).filter(Boolean)).size;
  const activeAreas = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [])
    .filter(a => !a.archived).length;

  return {
    themes, areaRows, hyper, bySource, inScope,
    strengths: inScopeSt,
    totalGaps: inScope.length,
    openGaps: inScope.filter(a => a.status !== 'closed').length,
    immediate: inScope.filter(a => a.severity === 'Areas for Immediate Improvement').length,
    areasWithData, activeAreas,
    allGapCount: gaps.length,
  };
}

// ── Fragments ─────────────────────────────────────────────────
function _inclProvenanceLine() {
  if (!window.DPCProvenance) return '';
  const s = window.DPCProvenance.summary();
  if (s.state === 'live') return '';
  const bg = s.tone === 'bad' ? 'var(--color-rose-lt)' : 'var(--color-amber-lt)';
  const fg = s.tone === 'bad' ? 'var(--color-rose)'    : 'var(--color-amber)';
  return `<div role="alert" style="background:${bg};color:${fg};border:1px solid ${fg};
    border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);font-size:var(--text-sm);">
    <strong>${_inclEsc(s.short)}.</strong> ${_inclEsc(s.detail)} Figures below may be incomplete.
  </div>`;
}

function _inclKPI(value, label, sub, colour) {
  return `<div style="padding:var(--space-md);background:var(--color-surface);
      border:1px solid var(--color-border);border-left:4px solid ${colour};
      border-radius:var(--radius-md);">
    <div style="font-size:var(--text-2xl);font-weight:bold;color:${colour};">${value}</div>
    <div style="font-size:var(--text-sm);font-weight:600;">${_inclEsc(label)}</div>
    <div style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${_inclEsc(sub)}</div>
  </div>`;
}

function _inclKPIs(d) {
  const q = _inclIssues || { rows: [], totalSignals: 0, areasTouched: 0, activeAreas: d.activeAreas };
  const groupWide = q.rows.filter(r => r.areaCount >= 4).length;
  const pct = q.activeAreas ? Math.round((q.areasTouched / q.activeAreas) * 100) : 0;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
      gap:var(--space-md);margin-bottom:var(--space-xl);">
    ${_inclKPI(q.rows.length, 'Distinct issues identified', 'Specific, trainable issues — not categories', 'var(--color-blue)')}
    ${_inclKPI(groupWide, 'Warrant a Group-wide session', 'Shared by four or more areas', 'var(--color-rose)')}
    ${_inclKPI(q.totalSignals, 'Pieces of evidence', 'Across Health Checks, Loops, Action Plans, Learning Walks', 'var(--color-amber)')}
    ${_inclKPI(`${q.areasTouched}/${q.activeAreas}`, 'Areas with evidence', `${pct}% of active areas`, 'var(--color-purple)')}
  </div>`;
}

function _inclHyperFocus(d) {
  const cards = d.hyper.map(h => {
    const none = h.areaCount === 0;
    return `<button type="button" class="incl-card-btn" data-incl-open="theme:${_inclEsc(h.id)}">
      <div style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_inclEsc(h.label)}</div>
      <div style="font-size:var(--text-2xl);font-weight:bold;color:${none ? 'var(--color-muted)' : 'var(--color-amber)'};margin-top:4px;">
        ${h.areaCount}
      </div>
      <div style="font-size:var(--text-xs);color:var(--color-muted);">
        ${none ? 'no records yet' : `area${h.areaCount === 1 ? '' : 's'} · ${h.open} open${h.immediate ? ` · ${h.immediate} immediate` : ''}`}
      </div>
      <div class="incl-trigger__more" style="margin-top:6px;">View records →</div>
    </button>`;
  }).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      College hyper-focus themes
    </h2>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
      The three Group priorities for 2025-26. Numbers are areas with an open or closed record against each theme.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
      gap:var(--space-md);margin-bottom:var(--space-xl);">${cards}</div>`;
}

function _inclThemeTable(d) {
  if (!d.themes.length) {
    return _inclEmpty('No inclusion or accessibility records yet',
      'Once Learning Walks, Instructional Coaching or Quick Capture log areas for development against these themes, the training picture builds itself here.');
  }

  const rows = d.themes.map(t => {
    const share = d.activeAreas ? Math.round((t.areaCount / d.activeAreas) * 100) : 0;
    const rec = t.areaCount >= 4
      ? { text: 'Group-wide session', col: 'var(--color-rose)' }
      : t.areaCount >= 2
        ? { text: 'Combined session', col: 'var(--color-amber)' }
        : { text: 'One-to-one coaching', col: 'var(--color-blue)' };
    return `<tr style="border-bottom:1px solid var(--color-border);">
      <th scope="row" style="text-align:left;padding:0;font-weight:600;">
        <button type="button" class="incl-trigger" data-incl-open="theme:${_inclEsc(t.id)}">
          ${_inclEsc(t.label)}
          <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);font-weight:400;">
            ${_inclEsc(t.category)}
          </span>
          <span class="incl-trigger__more">${t.total} record${t.total === 1 ? '' : 's'} →</span>
        </button>
      </th>
      <td style="padding:var(--space-sm);">
        <strong>${t.areaCount}</strong>
        <span style="font-size:var(--text-xs);color:var(--color-muted);">(${share}%)</span>
        <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);font-family:var(--font-mono,monospace);">
          ${_inclEsc(t.areaList.join(' '))}
        </span>
      </td>
      <td style="padding:var(--space-sm);text-align:right;">${t.open}</td>
      <td style="padding:var(--space-sm);text-align:right;color:${t.immediate ? 'var(--color-rose)' : 'var(--color-muted)'};">
        ${t.immediate}
      </td>
      <td style="padding:var(--space-sm);">
        <span style="font-size:var(--text-xs);font-weight:bold;color:${rec.col};">${rec.text}</span>
      </td>
    </tr>`;
  }).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      Shared gaps and the training response
    </h2>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
      Ranked by how many areas share the gap. Four or more areas makes a Group-wide session the efficient
      route; one area is coaching, not CPD.
    </p>
    <div style="overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-md);
      margin-bottom:var(--space-xl);background:var(--color-surface);">
      <table style="border-collapse:collapse;width:100%;min-width:640px;font-size:var(--text-sm);">
        <caption class="sr-only">Inclusion and accessibility themes ranked by number of areas affected</caption>
        <thead><tr style="background:var(--color-light);">
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Theme</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Areas affected</th>
          <th scope="col" style="text-align:right;padding:var(--space-sm);font-size:var(--text-xs);">Open</th>
          <th scope="col" style="text-align:right;padding:var(--space-sm);font-size:var(--text-xs);">Immediate</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Suggested response</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _inclAreaSpread(d) {
  if (!d.areaRows.length) return '';
  const max = d.areaRows[0].n || 1;
  const rows = d.areaRows.slice(0, 15).map(r => {
    const pc = Math.round((r.n / max) * 100);
    return `<button type="button" class="incl-trigger" data-incl-open="area:${_inclEsc(r.code)}"
        style="display:grid;grid-template-columns:76px 1fr 42px;gap:var(--space-sm);
        align-items:center;font-size:var(--text-sm);margin-bottom:4px;">
      <span style="font-family:var(--font-mono,monospace);font-weight:600;">${_inclEsc(r.code)}</span>
      <span style="background:var(--color-light);border:1px solid var(--color-border);
        border-radius:3px;height:14px;overflow:hidden;">
        <span style="display:block;height:100%;width:${pc}%;background:var(--color-amber);"></span>
      </span>
      <span style="text-align:right;font-family:var(--font-mono,monospace);font-size:var(--text-xs);">${r.n}</span>
    </button>`;
  }).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      Where the open gaps sit
    </h2>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
      Open inclusion gaps per area. A high count is engagement, not failure — areas with no record
      have not been walked yet.
    </p>
    <div style="padding:var(--space-md);background:var(--color-surface);border:1px solid var(--color-border);
      border-radius:var(--radius-md);margin-bottom:var(--space-xl);">${rows}</div>`;
}

function _inclStrengths(d) {
  if (!d.strengths.length) return '';
  const byTheme = {};
  for (const s of d.strengths) {
    const t = (typeof LRA_THEME_INDEX !== 'undefined') ? LRA_THEME_INDEX[s.lraThemeId] : null;
    if (!t) continue;
    if (!byTheme[t.id]) byTheme[t.id] = { label: t.label, areas: new Set() };
    if (s.areaCode) byTheme[t.id].areas.add(s.areaCode);
  }
  const items = Object.values(byTheme)
    .sort((a, b) => b.areas.size - a.areas.size)
    .map(t => `<li style="margin-bottom:4px;">
      <strong>${_inclEsc(t.label)}</strong> —
      ${t.areas.size} area${t.areas.size === 1 ? '' : 's'}
      <span style="font-family:var(--font-mono,monospace);font-size:var(--text-xs);color:var(--color-muted);">
        ${_inclEsc([...t.areas].sort().join(' '))}
      </span>
    </li>`).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      Existing strength to build training on
    </h2>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
      Positive findings against the same themes. These are where practice already exists worth
      sharing — the people to co-deliver with, not another audience to train.
    </p>
    <div style="padding:var(--space-md);background:var(--color-green-lt);border:1px solid var(--color-green);
      border-radius:var(--radius-md);margin-bottom:var(--space-xl);">
      <ul style="margin:0 0 0 var(--space-lg);font-size:var(--text-sm);">${items}</ul>
    </div>`;
}

function _inclSourceMix(d) {
  const entries = Object.entries(d.bySource).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const labelOf = id => (typeof AFI_SOURCE_LABEL !== 'undefined' && AFI_SOURCE_LABEL[id]) || id;
  const chips = entries.map(([src, n]) =>
    `<span style="display:inline-block;font-size:var(--text-xs);font-weight:600;padding:3px 10px;
      border-radius:999px;background:var(--color-light);border:1px solid var(--color-border);
      margin:0 6px 6px 0;">${_inclEsc(labelOf(src))}: ${n}</span>`).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      What this picture is built from
    </h2>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
      Which instruments produced these records. A narrow mix means the picture reflects one activity
      rather than the whole college.
    </p>
    <div style="margin-bottom:var(--space-xl);">${chips}</div>`;
}

function _inclCaveat(d) {
  return `<div style="padding:var(--space-md);background:var(--color-light);
      border-left:4px solid var(--color-blue);border-radius:var(--radius-md);
      font-size:var(--text-sm);max-width:80ch;">
    <strong>How to read this.</strong> Counts are of recorded improvement records, not of staff.
    An area with no record has not been walked yet, so absence here means absence of evidence rather
    than absence of need. Health Checks, Meetings and Action Plans do not yet write into this store,
    so the picture currently reflects Learning Walks, Instructional Coaching and Quick Capture only.
  </div>`;
}

function _inclEmpty(title, body) {
  return `<div style="padding:var(--space-xl);background:var(--color-surface);
      border:1px dashed var(--color-border);border-radius:var(--radius-md);
      text-align:center;margin-bottom:var(--space-xl);">
    <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">${_inclEsc(title)}</h2>
    <p style="font-size:var(--text-sm);color:var(--color-muted);max-width:60ch;margin:var(--space-sm) auto 0;">
      ${_inclEsc(body)}
    </p>
  </div>`;
}

function _inclEsc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Detail dialog ─────────────────────────────────────────────
// Opens on a theme, an area or a hyper-focus card and lists the actual
// records behind the number, so a figure on the dashboard can always be
// traced to the evidence that produced it.

function _inclOpenDetail(kind, id) {
  if (!_inclData) return;
  const host = document.getElementById('incl-dialog-host');
  if (!host) return;

  let title, subtitle, records;

  if (kind === 'theme') {
    const t = _inclData.themes.find(x => x.id === id);
    const meta = (typeof LRA_THEME_INDEX !== 'undefined') ? LRA_THEME_INDEX[id] : null;
    title    = meta ? meta.label : id;
    subtitle = meta ? `${meta.categoryLabel} — ${meta.desc}` : '';
    records  = t ? t.records.slice() : [];
  } else {
    title    = `Area ${id}`;
    subtitle = 'Open and closed inclusion records recorded against this area.';
    records  = _inclData.inScope.filter(a => a.areaCode === id);
  }

  // Open first, then most severe, then newest
  const sevRank = { 'Areas for Immediate Improvement': 0, 'Areas to Strengthen': 1 };
  records.sort((a, b) => {
    const oa = a.status === 'closed' ? 1 : 0, ob = b.status === 'closed' ? 1 : 0;
    if (oa !== ob) return oa - ob;
    const sa = sevRank[a.severity] ?? 2, sb = sevRank[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  host.innerHTML = `
    <div class="modal-overlay" id="incl-overlay">
      <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="incl-dlg-title">
        <div class="modal__header">
          <div>
            <h2 class="modal__title" id="incl-dlg-title" tabindex="-1">${_inclEsc(title)}</h2>
            ${subtitle ? `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-top:4px;max-width:62ch;">${_inclEsc(subtitle)}</p>` : ''}
          </div>
          <button type="button" class="modal__close" id="incl-dlg-close" aria-label="Close details">×</button>
        </div>
        ${_inclDetailSummary(records)}
        ${records.length
          ? records.map(_inclRecordCard).join('')
          : `<p style="font-size:var(--text-sm);color:var(--color-muted);">No records held against this yet.</p>`}
      </div>
    </div>`;

  const overlay = document.getElementById('incl-overlay');
  const closeBtn = document.getElementById('incl-dlg-close');
  document.getElementById('incl-dlg-title').focus();

  closeBtn.addEventListener('click', _inclCloseDetail);
  overlay.addEventListener('click', e => { if (e.target === overlay) _inclCloseDetail(); });
  document.addEventListener('keydown', _inclDialogKeys);
}

function _inclDialogKeys(ev) {
  if (ev.key === 'Escape') { _inclCloseDetail(); return; }
  if (ev.key !== 'Tab') return;
  // Keep focus inside the dialog while it is open.
  const dlg = document.querySelector('#incl-overlay .modal');
  if (!dlg) return;
  const f = dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
}

function _inclCloseDetail() {
  const host = document.getElementById('incl-dialog-host');
  if (host) host.innerHTML = '';
  document.removeEventListener('keydown', _inclDialogKeys);
  if (_inclLastTrigger && document.body.contains(_inclLastTrigger)) _inclLastTrigger.focus();
  _inclLastTrigger = null;
}

function _inclDetailSummary(records) {
  if (!records.length) return '';
  const open      = records.filter(r => r.status !== 'closed').length;
  const immediate = records.filter(r => r.severity === 'Areas for Immediate Improvement').length;
  const areas     = new Set(records.map(r => r.areaCode).filter(Boolean)).size;
  const cell = (v, l) => `<div style="text-align:center;padding:var(--space-sm);">
      <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-navy);">${v}</div>
      <div style="font-size:var(--text-xs);color:var(--color-muted);">${_inclEsc(l)}</div>
    </div>`;
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-sm);
      background:var(--color-light);border-radius:var(--radius-md);margin-bottom:var(--space-lg);">
    ${cell(records.length, 'records')}${cell(open, 'open')}
    ${cell(immediate, 'immediate')}${cell(areas, areas === 1 ? 'area' : 'areas')}
  </div>`;
}

function _inclRecordCard(r) {
  const sevCols = {
    'Areas for Immediate Improvement': ['var(--color-rose-lt)', 'var(--color-rose)'],
    'Areas to Strengthen':             ['var(--color-amber-lt)', 'var(--color-amber)'],
  };
  const [bg, fg] = sevCols[r.severity] || ['var(--color-light)', 'var(--color-muted)'];
  const closed = r.status === 'closed';
  const srcLabel = (typeof AFI_SOURCE_LABEL !== 'undefined' && AFI_SOURCE_LABEL[r.source]) || r.source || 'Unknown source';
  const inferred = r.sourceInferred ? ' (inferred)' : '';
  const fmt = iso => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return `<article class="incl-rec" style="${closed ? 'opacity:.72;' : ''}">
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);align-items:center;">
      <span class="incl-badge" style="background:${bg};color:${fg};border-color:${fg};">
        ${_inclEsc(r.severity || 'Unrated')}
      </span>
      <span class="incl-badge" style="background:var(--color-light);color:var(--color-slate);border-color:var(--color-border);">
        ${_inclEsc(closed ? 'Closed' : (r.status || 'open'))}
      </span>
      ${r.areaCode ? `<span style="font-family:var(--font-mono,monospace);font-weight:600;font-size:var(--text-sm);">${_inclEsc(r.areaCode)}</span>` : ''}
    </div>
    <p style="font-size:var(--text-sm);margin-top:var(--space-sm);">
      ${_inclEsc(r.description || r.lraThemeLabel || 'No description recorded.')}
    </p>
    ${r.digitalOpportunity ? `<p style="font-size:var(--text-sm);color:var(--color-teal);margin-top:6px;">
      <strong>Digital opportunity:</strong> ${_inclEsc(r.digitalOpportunity)}</p>` : ''}
    <div class="incl-rec__meta">
      <span><strong>Source:</strong> ${_inclEsc(srcLabel)}${inferred}</span>
      ${r.lraThemeLabel ? `<span><strong>Theme:</strong> ${_inclEsc(r.lraThemeLabel)}</span>` : ''}
      ${fmt(r.createdAt) ? `<span><strong>Raised:</strong> ${fmt(r.createdAt)}</span>` : ''}
      ${fmt(r.targetDate) ? `<span><strong>Target:</strong> ${fmt(r.targetDate)}</span>` : ''}
      ${(r.linkedActions && r.linkedActions.length) ? `<span><strong>Actions:</strong> ${r.linkedActions.length}</span>` : ''}
      ${(r.evidenceChain && r.evidenceChain.length) ? `<span><strong>Evidence items:</strong> ${r.evidenceChain.length}</span>` : ''}
    </div>
  </article>`;
}

// ── Cross-source issue table (v2.0) ───────────────────────────
function _inclIssueTable() {
  const q = _inclIssues;
  if (!q || !q.rows.length) {
    return _inclEmpty('No accessibility or inclusion issues identified yet',
      'This table builds from Health Check indicator scores, Loops, Action Plan items and Learning Walks. Once any of those hold records against accessibility or inclusion, the issues appear here automatically.');
  }

  const rows = q.rows.map(r => {
    const rec = r.areaCount >= 4
      ? { text: 'Group-wide session', col: 'var(--color-rose)' }
      : r.areaCount >= 2
        ? { text: 'Combined session', col: 'var(--color-amber)' }
        : { text: 'One-to-one coaching', col: 'var(--color-blue)' };

    const srcChips = Object.entries(r.bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `<span class="incl-badge" style="background:var(--color-light);
        color:var(--color-slate);border-color:var(--color-border);margin:0 4px 4px 0;">
        ${_inclEsc(INCL_SOURCE_LABEL[s] || s)} ${n}</span>`).join('');

    const hc = r.hcCount
      ? `<strong style="color:${r.hcAvg <= 3 ? 'var(--color-rose)' : 'var(--color-green)'};">
          ${r.hcAvg.toFixed(1)}</strong>
         <span style="font-size:var(--text-xs);color:var(--color-muted);">
          of 5 · ${r.hcBelow}/${r.hcCount} staff at 3 or below</span>`
      : `<span style="font-size:var(--text-xs);color:var(--color-muted);">not scored</span>`;

    return `<tr style="border-bottom:1px solid var(--color-border);">
      <th scope="row" style="text-align:left;padding:0;font-weight:600;">
        <button type="button" class="incl-trigger" data-incl-open="issue:${_inclEsc(r.id)}">
          ${_inclEsc(r.label)}
          <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);font-weight:400;">
            ${_inclEsc(r.focus)}
          </span>
          <span class="incl-trigger__more">${r.signalCount} piece${r.signalCount === 1 ? '' : 's'} of evidence${r.inferredCount ? ` · ${r.inferredCount} inferred` : ''} →</span>
        </button>
      </th>
      <td style="padding:var(--space-sm);">
        <strong style="font-size:var(--text-md);">${r.areaCount}</strong>
        <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);
          font-family:var(--font-mono,monospace);">${_inclEsc(r.areaList.join(' ')) || '—'}</span>
      </td>
      <td style="padding:var(--space-sm);">${hc}</td>
      <td style="padding:var(--space-sm);">${srcChips || '—'}</td>
      <td style="padding:var(--space-sm);">
        <span style="font-size:var(--text-xs);font-weight:bold;color:${rec.col};">${rec.text}</span>
      </td>
    </tr>`;
  }).join('');

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      Specific issues across the Group
    </h2>
    <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);max-width:78ch;">
      Each row is one trainable issue, assembled from every store that holds evidence of it —
      Health Check scores, Loops, Action Plan items and Learning Walks. Ranked by how many areas
      share it. Click any issue to see the evidence behind the number. Records whose wording names
      the issue count as exact; records grouped only by their theme are marked inferred, and are
      worth reading before quoting.
    </p>
    <div style="overflow-x:auto;border:1px solid var(--color-border);border-radius:var(--radius-md);
      margin-bottom:var(--space-xl);background:var(--color-surface);">
      <table style="border-collapse:collapse;width:100%;min-width:820px;font-size:var(--text-sm);">
        <caption class="sr-only">Accessibility and inclusion issues ranked by number of areas affected</caption>
        <thead><tr style="background:var(--color-light);">
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Issue</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Areas</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Health Check average</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Evidence from</th>
          <th scope="col" style="text-align:left;padding:var(--space-sm);font-size:var(--text-xs);">Suggested response</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── What the picture is built from ────────────────────────────
function _inclCoverage() {
  const q = _inclIssues;
  if (!q) return '';
  const cards = Object.entries(q.coverage).map(([src, n]) => {
    const live = n > 0;
    return `<div style="padding:var(--space-md);background:var(--color-surface);
        border:1px solid ${live ? 'var(--color-border)' : 'var(--color-amber)'};
        border-radius:var(--radius-md);">
      <div style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">
        ${_inclEsc(INCL_SOURCE_LABEL[src] || src)}
      </div>
      <div style="font-size:var(--text-xl);font-weight:bold;color:${live ? 'var(--color-teal)' : 'var(--color-amber)'};">
        ${n}
      </div>
      <div style="font-size:var(--text-xs);color:var(--color-muted);">
        ${live ? 'records searched' : 'no records — this source is not contributing'}
      </div>
    </div>`;
  }).join('');

  const rag = q.ragWeak.length
    ? `<div style="padding:var(--space-md);background:var(--color-rose-lt);border:1px solid var(--color-rose);
        border-radius:var(--radius-md);margin-top:var(--space-md);font-size:var(--text-sm);color:var(--color-rose);">
        <strong>${q.ragWeak.length} area${q.ragWeak.length === 1 ? '' : 's'} rated Challenged or Urgent on accessibility health:</strong>
        ${_inclEsc(q.ragWeak.map(r => `${r.areaCode} (${r.score})`).join(', '))}.
        These carry a RAG position but may have little or no issue-level evidence yet.
      </div>`
    : '';

  return `<h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">
      What this picture is built from
    </h2>
    <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);max-width:78ch;">
      How many records in each store were searched. A source showing zero is not contributing to
      any issue above, so the picture is narrower than it looks.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:var(--space-md);margin-bottom:var(--space-md);">${cards}</div>
    ${rag}
    <div style="height:var(--space-xl);"></div>`;
}

// ── Issue detail (extends the existing dialog) ────────────────
function _inclOpenIssueDetail(issueId) {
  const q = _inclIssues;
  const r = q && q.rows.find(x => x.id === issueId);
  const host = document.getElementById('incl-dialog-host');
  if (!r || !host) return;

  const bySource = {};
  for (const s of r.signals) (bySource[s.source] = bySource[s.source] || []).push(s);

  const blocks = Object.entries(bySource).map(([src, list]) => {
    const items = list
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(s => `<article class="incl-rec">
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);align-items:center;">
          ${s.areaCode ? `<span style="font-family:var(--font-mono,monospace);font-weight:600;
            font-size:var(--text-sm);">${_inclEsc(s.areaCode)}</span>` : ''}
          ${s.score != null ? `<span class="incl-badge" style="background:var(--color-rose-lt);
            color:var(--color-rose);border-color:var(--color-rose);">${s.score} of 5</span>` : ''}
        </div>
        <p style="font-size:var(--text-sm);margin-top:6px;">${_inclEsc(s.title)}</p>
        <div class="incl-rec__meta">
          <span>${_inclEsc(s.detail || '')}</span>
          ${s.date ? `<span>${_inclEsc(_inclFmtDate(s.date))}</span>` : ''}
          ${s.match === 'theme' ? `<span style="color:var(--color-amber);"><strong>Inferred</strong> — grouped by theme, the wording does not name this issue</span>` : ''}
        </div>
      </article>`).join('');

    return `<section style="margin-bottom:var(--space-lg);">
      <h3 style="font-size:var(--text-md);font-weight:bold;color:var(--color-navy);
        margin-bottom:var(--space-sm);">
        ${_inclEsc(INCL_SOURCE_LABEL[src] || src)}
        <span style="font-size:var(--text-xs);color:var(--color-muted);font-weight:400;">
          — ${list.length} record${list.length === 1 ? '' : 's'}</span>
      </h3>
      ${items}
    </section>`;
  }).join('');

  const hcLine = r.hcCount
    ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-lg);">
        Health Check average <strong>${r.hcAvg.toFixed(1)} of 5</strong> across ${r.hcCount}
        scored response${r.hcCount === 1 ? '' : 's'}. ${r.hcBelow} at 3 or below.</p>`
    : `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-lg);">
        Not yet scored in any Health Check, so there is no staff-level measure for this issue.</p>`;

  host.innerHTML = `
    <div class="modal-overlay" id="incl-overlay">
      <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="incl-dlg-title">
        <div class="modal__header">
          <div>
            <h2 class="modal__title" id="incl-dlg-title" tabindex="-1">${_inclEsc(r.label)}</h2>
            <p style="font-size:var(--text-sm);color:var(--color-muted);margin-top:4px;">
              ${_inclEsc(r.focus)} · ${r.areaCount} area${r.areaCount === 1 ? '' : 's'} ·
              ${r.signalCount} piece${r.signalCount === 1 ? '' : 's'} of evidence
            </p>
          </div>
          <button type="button" class="modal__close" id="incl-dlg-close" aria-label="Close details">×</button>
        </div>
        ${hcLine}
        <p style="font-size:var(--text-sm);margin-bottom:var(--space-lg);">
          <strong>Areas:</strong>
          <span style="font-family:var(--font-mono,monospace);">${_inclEsc(r.areaList.join(' ')) || '—'}</span>
        </p>
        ${blocks || '<p style="font-size:var(--text-sm);color:var(--color-muted);">No individual records — this issue is visible only in Health Check scores.</p>'}
      </div>
    </div>`;

  document.getElementById('incl-dlg-close').addEventListener('click', _inclCloseDetail);
  const overlay = document.getElementById('incl-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) _inclCloseDetail(); });
  document.getElementById('incl-dlg-title').focus();
  document.addEventListener('keydown', _inclDialogKeys);
}

function _inclFmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
