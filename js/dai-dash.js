// DPC Hub · js/dai-dash.js · v1.0 · 12/11/26 · DA&I dashboard framework (filter bar, clickable tiles with detail panels) and the By person tab
//
// Framework, reused by every DA&I tab:
//   - one filter (area, campus, element, confidence, name) shared across
//     tabs, so filtering to an area carries through every view;
//   - tiles are buttons; selecting one opens its detail panel under the
//     tiles, filtered the same way; selecting it again closes it;
//   - the coaching threshold is a setting stored in data-dai.json.
//
// Public: daiDashFilterHTML(), daiDashFiltered(people), daiDashTilesHTML(tab, tiles),
//         daiDashWire(root), daiPersonTabHTML(d), daiCoachThreshold()

const DAI_DASH_CONF = Object.freeze([['', 'Any confidence'], ['2', 'Below 2'], ['2.5', 'Below 2.5'], ['3', 'Below 3'], ['3.5', 'Below 3.5'], ['4', 'Below 4']]);
const DAI_NEEDS_PAGE = 50;
let _ddFilter = { area: '', campus: '', element: '', conf: '', q: '' };
let _ddOpen = {};          // tab -> open tile id
let _ddShowAll = false;    // needs table: show every row

function daiCoachThreshold() {
  const s = _daiStore().settings || {};
  const v = parseFloat(s.coachThreshold);
  return v >= 1 && v <= 5 ? v : 2;
}
function _ddSetThreshold(v) {
  const d = _daiStore();
  d.settings = { ...(d.settings || {}), coachThreshold: v };
  if (typeof saveDAIData === 'function') saveDAIData();
}

// ── Filter ────────────────────────────────────────────────────
function _ddCampus(p) { return typeof _dsuCampus === 'function' ? _dsuCampus(p.staffId, p.areaCode) : ''; }
function _ddScore(p) {
  if (_ddFilter.element) return p.elements ? p.elements[_ddFilter.element] : null;
  return p.after;
}
function daiDashFiltered(people) {
  const f = _ddFilter, q = f.q.trim().toLowerCase(), max = parseFloat(f.conf);
  return people.filter(p => {
    if (f.area && (p.areaCode || '') !== f.area) return false;
    if (f.campus && _ddCampus(p) !== f.campus) return false;
    if (f.element && (!p.elements || p.elements[f.element] == null)) return false;
    if (max) { const s = _ddScore(p); if (s == null || s >= max) return false; }
    if (q && !String(p.name || '').toLowerCase().includes(q)) return false;
    return true;
  });
}
function _ddActive() { const f = _ddFilter; return !!(f.area || f.campus || f.element || f.conf || f.q.trim()); }

function daiDashFilterHTML(people) {
  const f = _ddFilter;
  const areas = [...new Set(people.map(p => p.areaCode).filter(Boolean))].sort();
  const campuses = [...new Set(people.map(_ddCampus).filter(Boolean))].sort();
  const sel = (id, label, key, opts) => `<div class="form-group" style="margin:0;"><label class="form-label" for="${id}">${label}</label>
    <select id="${id}" class="form-select" data-dd-filter="${key}" style="min-height:40px;">${opts.map(([v, t]) => `<option value="${_daiEsc(v)}"${v === f[key] ? ' selected' : ''}>${_daiEsc(t)}</option>`).join('')}</select></div>`;
  return `<div role="search" aria-label="Filter the DA&amp;I views" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--space-md);align-items:end;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);background:var(--color-light);">
    ${sel('dd-f-area', 'Area', 'area', [['', 'All areas'], ...areas.map(a => [a, `${a}, ${_daiAreaName(a)}`])])}
    ${sel('dd-f-campus', 'Campus', 'campus', [['', 'All campuses'], ...campuses.map(c => [c, c])])}
    ${sel('dd-f-element', 'Element', 'element', [['', 'All elements'], ...DAI_ELEMENTS.map(e => [e.id, e.label])])}
    ${sel('dd-f-conf', f.element ? 'Confidence on that element' : 'Element confidence', 'conf', DAI_DASH_CONF)}
    <div class="form-group" style="margin:0;"><label class="form-label" for="dd-f-q">Name</label>
      <input id="dd-f-q" type="search" class="form-input" data-dd-filter="q" value="${_daiEsc(f.q)}" placeholder="Search a name" style="min-height:40px;"></div>
    ${_ddActive() ? `<button type="button" class="btn btn--secondary" data-dd-clear style="min-height:40px;">Clear filters</button>` : ''}
  </div>`;
}

// ── Tiles ─────────────────────────────────────────────────────
// tiles: [{ id, value, label, sub, detail: () => html }]
function daiDashTilesHTML(tab, tiles) {
  const open = _ddOpen[tab];
  const shown = tiles.find(t => t.id === open);
  const btns = tiles.map(t => {
    const on = t.id === open;
    return `<button type="button" data-dd-tile="${t.id}" data-dd-tab="${tab}" aria-expanded="${on}" aria-controls="dd-detail-${tab}"
      style="text-align:left;border:${on ? '2px solid var(--color-teal)' : '1px solid var(--color-border)'};border-radius:var(--radius-md);padding:var(--space-md);background:var(--color-white);cursor:pointer;font:inherit;color:inherit;min-height:44px;">
      <span style="display:block;font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">${t.value}</span>
      <span style="display:block;font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-slate);">${t.label}</span>
      ${t.sub ? `<span style="display:block;font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${t.sub}</span>` : ''}
      <span style="display:block;font-size:var(--text-xs);color:var(--color-teal);font-weight:bold;margin-top:var(--space-xs);">${on ? 'Hide details ▾' : 'Show details ▸'}</span>
    </button>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-md);">${btns}</div>
    <div id="dd-detail-${tab}" ${shown ? '' : 'hidden'} style="border:2px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-xl);background:var(--color-white);">
      ${shown ? `<h2 id="dd-detail-h-${tab}" tabindex="-1" style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">${shown.label}</h2>${shown.detail()}` : ''}
    </div>`;
}

// ── Events ────────────────────────────────────────────────────
let _ddTimer = null;
function _ddRerender(focusId) {
  _daiRenderBody();
  const el = focusId && document.getElementById(focusId);
  if (el) { el.focus(); if (el.type === 'search') { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} } }
}
function daiDashWire(root) {
  root.querySelectorAll('[data-dd-tile]').forEach(b => b.addEventListener('click', () => {
    const tab = b.dataset.ddTab, id = b.dataset.ddTile;
    _ddOpen[tab] = _ddOpen[tab] === id ? '' : id;
    _daiRenderBody();
    const h = document.getElementById('dd-detail-h-' + tab);
    (h || document.querySelector(`[data-dd-tile="${id}"]`))?.focus();
  }));
  root.querySelectorAll('select[data-dd-filter]').forEach(s => s.addEventListener('change', () => { _ddFilter[s.dataset.ddFilter] = s.value; _ddShowAll = false; _ddRerender(s.id); }));
  root.querySelectorAll('input[data-dd-filter]').forEach(i => i.addEventListener('input', () => {
    clearTimeout(_ddTimer);
    _ddTimer = setTimeout(() => { _ddFilter.q = i.value; _ddShowAll = false; _ddRerender(i.id); }, 350);
  }));
  root.querySelector('[data-dd-clear]')?.addEventListener('click', () => { _ddFilter = { area: '', campus: '', element: '', conf: '', q: '' }; _ddRerender('dd-f-area'); });
  root.querySelector('#dd-threshold')?.addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v >= 1 && v <= 5) { _ddSetThreshold(v); _ddRerender('dd-threshold'); }
  });
  root.querySelector('[data-dd-showall]')?.addEventListener('click', () => { _ddShowAll = true; _ddRerender('dd-needs-h'); });
}

// ── By person ─────────────────────────────────────────────────
const _ddEl = id => (DAI_ELEMENTS.find(e => e.id === id) || {}).label || id;
const _ddLow = p => Object.entries(p.elements || {}).filter(([, v]) => v <= 2).sort((a, b) => a[1] - b[1]);

function daiPersonTabHTML(d) {
  const all = d.all.map(p => ({ ...p, campus: _ddCampus(p) }));
  const P = daiDashFiltered(all);
  const withBefore = P.filter(p => p.before != null), withAfter = P.filter(p => p.after != null);
  const urgent = P.filter(p => _ddLow(p).length);
  const th = daiCoachThreshold();
  const coach = withAfter.filter(p => p.after < th).sort((a, b) => a.after - b.after);
  const elStats = DAI_ELEMENTS.map(e => {
    const v = P.map(p => p.elements[e.id]).filter(x => x != null);
    return { ...e, avg: _daiAvg(v), n: v.length, low: P.filter(p => p.elements[e.id] != null && p.elements[e.id] <= 2) };
  }).filter(e => e.n).sort((a, b) => a.avg - b.avg);
  const top3 = elStats.slice(0, 3);
  const needsBy = typeof daiSupportNeeds === 'function' ? daiSupportNeeds() : [];
  const ids = new Set(P.map(p => p.staffId));
  const tgts = []; P.forEach(p => { if (p.refl) _daiTargets(p.refl).forEach(t => tgts.push({ p, t, st: typeof _dtgGet === 'function' ? (_dtgGet(p.staffId, daiTargetKey(t.text)).status || 'Not started') : 'Not started' })); });

  const ppl = (list, cols) => list.length ? _daiTable('People', ['Name', 'Area', ...cols.map(c => c[0])],
    list.map(p => `<tr>${_daiTd(_daiPersonBtn(p))}${_daiTd(_daiEsc(p.areaCode || ''))}${cols.map(c => _daiTd(c[1](p))).join('')}</tr>`), 640) : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No one matches.</p>';
  const lowList = p => _ddLow(p).map(([id, v]) => `${_daiEsc(_ddEl(id))} (${v})`).join(', ');

  const tiles = [
    { id: 'overall', value: withBefore.length ? `${_daiFmt(_daiAvg(withBefore.map(p => p.before)))} of 5` : '–', label: 'Starting confidence, overall',
      sub: `From registration, ${withBefore.length} people`,
      detail: () => ppl(withBefore.slice().sort((a, b) => a.before - b.before), [['Overall rating', p => `${p.before} of 5`], ['Element average', p => _daiFmt(p.after)]]) },
    { id: 'element', value: withAfter.length ? `${_daiFmt(_daiAvg(withAfter.map(p => p.after)))} of 5` : '–', label: 'Starting confidence, elements combined',
      sub: `"How's it going", ${withAfter.length} people`,
      detail: () => ppl(withAfter.slice().sort((a, b) => a.after - b.after), [['Element average', p => _daiFmt(p.after)], ['Rated 1 or 2', lowList]]) },
    { id: 'urgent', value: urgent.length, label: 'Urgent support', sub: 'Rated any element 1 or 2',
      detail: () => ppl(urgent.slice().sort((a, b) => _ddLow(b).length - _ddLow(a).length), [['Elements at 1 or 2', lowList], ['Element average', p => _daiFmt(p.after)]]) },
    { id: 'top3', value: top3.length ? top3.map(e => _daiEsc(e.label)).join('<br>') : '–', label: 'Top 3 elements of need', sub: 'Lowest average score',
      detail: () => top3.map(e => `<h3 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">${_daiEsc(e.label)}: ${_daiFmt(e.avg)} of 5 from ${e.n} ${e.n === 1 ? 'person' : 'people'}</h3>
        <p style="font-size:var(--text-sm);">${e.low.length ? `Rated 1 or 2 (${e.low.length}): ${e.low.map(_daiPersonBtn).join(', ')}` : 'No one rated it 1 or 2.'}</p>`).join('')
        + `<h3 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">All elements</h3>`
        + _daiTable('Elements, lowest first', ['Element', 'Average of 5', 'Answers', 'At 1 or 2'], elStats.map(e => `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(_daiFmt(e.avg))}${_daiTd(e.n)}${_daiTd(e.low.length)}</tr>`), 520) },
    { id: 'coach', value: coach.length, label: 'Coaching', sub: `Elements combined below ${th}`,
      detail: () => `<div class="form-group" style="max-width:260px;"><label class="form-label" for="dd-threshold">Coach when the combined average is below</label>
          <input id="dd-threshold" type="number" min="1" max="5" step="0.25" class="form-input" value="${th}"></div>`
        + ppl(coach, [['Element average', p => _daiFmt(p.after)], ['Rated 1 or 2', lowList], ['Plan it', p => {
          const n = needsBy.filter(x => x.staffId === p.staffId);
          return n.length && typeof _dsuPromptBtn === 'function' ? _dsuPromptBtn({ kind: 'coaching', themes: n.map(x => x.theme), needs: n, staffId: p.staffId }, `coaching for ${p.name}`) : '';
        }]]) },
    { id: 'targets', value: tgts.length ? `${tgts.filter(x => x.st === 'Achieved').length} of ${tgts.length}` : '–', label: 'Personal targets achieved',
      sub: `${tgts.filter(x => x.st === 'In progress').length} in progress`,
      detail: () => tgts.length ? _daiTable('Personal targets', ['Name', 'Area', 'Target', 'Their confidence', 'Progress'], tgts.sort((a, b) => a.st.localeCompare(b.st))
        .map(x => `<tr>${_daiTd(_daiPersonBtn(x.p))}${_daiTd(_daiEsc(x.p.areaCode || ''))}${_daiTd(_daiEsc(x.t.text))}${_daiTd(x.t.confidence == null ? '–' : x.t.confidence)}${_daiTd(_daiEsc(x.st))}</tr>`), 760) : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No targets.</p>' },
  ];

  // Every need, filtered, first page.
  const needs = needsBy.filter(n => ids.has(n.staffId) && (!_ddFilter.element || n.theme === _ddFilter.element));
  const page = _ddShowAll ? needs : needs.slice(0, DAI_NEEDS_PAGE);
  const rows = page.map(n => `<tr>${_daiTd(_daiPersonBtn(n))}${_daiTd(_daiEsc(n.areaCode))}${_daiTd(_daiEsc(n.campus))}${_daiTd(_daiEsc(n.themeLabel))}${_daiTd(n.confidence == null ? '–' : n.confidence)}${_daiTd(`<strong>${_daiEsc(DSU_FORMATS[n.format])}</strong><br><span style="color:var(--color-muted);">${_daiEsc(n.why)}</span>`)}${_daiTd(typeof _dsuPromptBtn === 'function' ? _dsuPromptBtn(n.format === 'coaching' ? { kind: 'coaching', themes: [n.theme], needs: [n], staffId: n.staffId } : { kind: n.format, themes: [n.theme], needs: [n] }, `${DSU_FORMATS[n.format]} on ${n.themeLabel} for ${n.name}`) : '')}</tr>`);
  const needsHTML = `<h2 id="dd-needs-h" tabindex="-1" style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-xs);">Every need, by person (${needs.length}${_ddActive() ? ', filtered' : ''})</h2>
    ${needs.length ? _daiTable('Support needs for the people shown, most urgent first', ['Name', 'Area', 'Campus', 'Element', 'Confidence', 'Recommended', 'Plan it'], rows, 960) : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No needs for the people shown.</p>'}
    ${needs.length > page.length ? `<p style="margin-top:var(--space-sm);font-size:var(--text-sm);">Showing ${page.length} of ${needs.length}. Use the filters to narrow it, or <button type="button" data-dd-showall class="btn btn--secondary btn--sm">show all ${needs.length}</button></p>` : ''}`;

  return daiDashFilterHTML(all)
    + `<p role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-sm);">${_ddActive() ? `Showing ${P.length} of ${all.length} people.` : `${all.length} people.`}</p>`
    + daiDashTilesHTML('people', tiles) + needsHTML;
}
