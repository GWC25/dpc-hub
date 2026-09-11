// DPC Hub · js/inclusion.js · v1.0 · 09/09/26
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
function initInclusion() {
  const main = document.getElementById('main-content');
  const d = _inclCompute();

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
    ${_inclThemeTable(d)}
    ${_inclAreaSpread(d)}
    ${_inclStrengths(d)}
    ${_inclSourceMix(d)}
    ${_inclCaveat(d)}
  `;
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
        areas: new Set(), open: 0, immediate: 0, total: 0,
      };
    }
    const row = byTheme[t.id];
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
    themes, areaRows, hyper, bySource,
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
  const pct = d.activeAreas ? Math.round((d.areasWithData / d.activeAreas) * 100) : 0;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
      gap:var(--space-md);margin-bottom:var(--space-xl);">
    ${_inclKPI(d.openGaps, 'Open inclusion gaps', 'Accessibility and inclusive environment themes', 'var(--color-amber)')}
    ${_inclKPI(d.immediate, 'For immediate improvement', 'Highest severity, shortest close window', 'var(--color-rose)')}
    ${_inclKPI(d.themes.length, 'Distinct themes in play', 'Each one is a candidate training session', 'var(--color-blue)')}
    ${_inclKPI(`${d.areasWithData}/${d.activeAreas}`, 'Areas with a record', `${pct}% of active areas`, 'var(--color-purple)')}
  </div>`;
}

function _inclHyperFocus(d) {
  const cards = d.hyper.map(h => {
    const none = h.areaCount === 0;
    return `<div style="padding:var(--space-md);background:var(--color-surface);
        border:1px solid var(--color-border);border-radius:var(--radius-md);">
      <div style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_inclEsc(h.label)}</div>
      <div style="font-size:var(--text-2xl);font-weight:bold;color:${none ? 'var(--color-muted)' : 'var(--color-amber)'};margin-top:4px;">
        ${h.areaCount}
      </div>
      <div style="font-size:var(--text-xs);color:var(--color-muted);">
        ${none ? 'no records yet' : `area${h.areaCount === 1 ? '' : 's'} · ${h.open} open${h.immediate ? ` · ${h.immediate} immediate` : ''}`}
      </div>
    </div>`;
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
      <th scope="row" style="text-align:left;padding:var(--space-sm);font-weight:600;">
        ${_inclEsc(t.label)}
        <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);font-weight:400;">
          ${_inclEsc(t.category)}
        </span>
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
    return `<div style="display:grid;grid-template-columns:76px 1fr 42px;gap:var(--space-sm);
        align-items:center;font-size:var(--text-sm);margin-bottom:6px;">
      <span style="font-family:var(--font-mono,monospace);font-weight:600;">${_inclEsc(r.code)}</span>
      <span style="background:var(--color-light);border:1px solid var(--color-border);
        border-radius:3px;height:14px;overflow:hidden;">
        <span style="display:block;height:100%;width:${pc}%;background:var(--color-amber);"></span>
      </span>
      <span style="text-align:right;font-family:var(--font-mono,monospace);font-size:var(--text-xs);">${r.n}</span>
    </div>`;
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
