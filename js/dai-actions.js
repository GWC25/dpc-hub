// DPC Hub · js/dai-actions.js · v1.1 · 13/11/26 · Resource Library entries tagged for DA&I (element and format), with detection from the title
// v1.0 · 09/11/26 · progress on recommended DA&I support actions, linked to Resource Library entries
//
// Each recommended action (Teach Meet, drop-in, area session, a video or
// guide to make, coaching) has a stable key, so its status survives the
// recommendations being recalculated:
//   campus|<campus>|<theme>   Teach Meet or drop-in (kind can change with numbers)
//   area|<area>|<theme>       area session
//   res|<format>|<theme>      How-To video or guide sheet
//   coach|<staffId>           coaching one person
//   coachgroup|<theme>        coaching on a theme (By resource type)
//
// Status, date, note and linked Resource Library entries are stored in
// data-dai.json as dai.actionStatus[key]. When a linked entry has been
// shared with staff (Resource Library "share"), the row shows how many of
// the people who needed it it has reached.
//
// Public: daiActionStatusCell(key, label, themeIds, people), daiActionFilter(),
//         daiActionFilterHTML(id), daiActionSummary(), daiActionOpen(i, trigger), DAI_ACTION_STATES

const DAI_ACTION_STATES = Object.freeze(['To do', 'Planned', 'In progress', 'Done']);
let _dacFilter = 'todo';      // 'todo' | 'done' | 'all'
let _dacRows = [];            // rebuilt each render; buttons carry an index

function _dacStore() { const d = _daiStore(); if (!d.actionStatus) d.actionStatus = {}; return d.actionStatus; }
function _dacGet(key) { return _dacStore()[key] || {}; }
function daiActionIsDone(key) { return _dacGet(key).status === 'Done'; }
function daiActionResetRows() { _dacRows = []; }
function daiActionFilter() { return _dacFilter; }
function daiActionPasses(key) {
  const done = daiActionIsDone(key);
  return _dacFilter === 'all' || (_dacFilter === 'done' ? done : !done);
}

function _dacLibEntries() {
  const manual = (window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.entries) || [];
  return manual.filter(e => !e.archived);
}
// ── DA&I tags on Resource Library entries ─────────────────────
// entry.dai = { elements: [themeId], format: 'video' | 'guide' | 'other' } once confirmed,
// or { off: true } when Graeme says it is not DA&I support. Untagged entries
// are read from their title, description and tags.
const DAI_LIB_FORMATS = Object.freeze({ video: 'How-To video', guide: 'How-To guide sheet', other: 'Other resource' });
function daiLibGuess(e) {
  const text = [e.title, e.description, ...(e.tags || [])].filter(Boolean).join(' ').replace(/[-_]+/g, ' ');
  const elements = typeof _dsuThemesIn === 'function' ? _dsuThemesIn(text) : [];
  const t = text.toLowerCase();
  const format = /\bvideo\b|\bvid\b|\.mp4|recording|screencast|\bclip\b/.test(t) ? 'video'
    : /\bguide\b|\bsheet\b|\bdocx\b|\bpdf\b|handout|checklist|step by step|instructions/.test(t) ? 'guide' : 'other';
  return { elements, format };
}
function daiLibTags(e) {
  if (e.dai && e.dai.off) return null;
  if (e.dai && (e.dai.elements || []).length) return { elements: e.dai.elements, format: e.dai.format || 'other', source: 'tagged' };
  const g = daiLibGuess(e);
  return g.elements.length ? { ...g, source: 'found' } : null;
}
// Library entries that are a given format on a given element.
function daiLibFor(fmt, theme) {
  return _dacLibEntries().map(e => ({ e, t: daiLibTags(e) })).filter(x => x.t && x.t.elements.includes(theme) && x.t.format === fmt);
}

function _dacShares(resourceId) {
  return ((window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.shares) || []).filter(s => s.resourceId === resourceId);
}
function _dacText(e) { return [e.title, e.description, ...(e.tags || [])].filter(Boolean).join(' '); }
// Library entries whose title, description or tags mention the action's theme.
function _dacMatches(themeIds) {
  return _dacLibEntries().filter(e => _dsuThemesIn(_dacText(e)).some(id => themeIds.includes(id)));
}
function _dacReach(resourceIds, people) {
  const shared = new Set(resourceIds.flatMap(id => _dacShares(id).flatMap(s => s.staffIds || [])));
  return people.filter(p => shared.has(p.staffId)).length;
}

const _dacBadge = (status) => {
  const done = status === 'Done';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:var(--text-xs);font-weight:bold;border:2px solid ${done ? 'var(--color-teal)' : 'var(--color-border)'};background:${done ? 'var(--color-teal)' : 'var(--color-white)'};color:${done ? 'var(--color-white)' : 'var(--color-slate)'};">${done ? '✓ ' : ''}${_daiEsc(status)}</span>`;
};

function daiActionStatusCell(key, label, themeIds, people) {
  _dacRows.push({ key, label, themeIds, people });
  const i = _dacRows.length - 1;
  const st = _dacGet(key);
  const status = st.status || 'To do';
  const entries = (st.resourceIds || []).map(id => _dacLibEntries().find(e => e.resourceId === id)).filter(Boolean);
  const btnStyle = 'min-height:32px;padding:2px 10px;border:2px solid var(--color-teal);border-radius:999px;background:var(--color-white);color:var(--color-teal);font:bold var(--text-xs) Arial,sans-serif;cursor:pointer;white-space:nowrap;';
  let html = _dacBadge(status);
  if (st.date && status !== 'To do') html += ` <span style="font-size:var(--text-xs);color:var(--color-muted);">${_daiFmtDate(st.date)}</span>`;
  if (entries.length) {
    const reach = _dacReach(entries.map(e => e.resourceId), people);
    html += `<br><span style="font-size:var(--text-xs);">${entries.map(e => _daiEsc(e.title)).join(', ')}</span>`;
    html += `<br><span style="font-size:var(--text-xs);color:var(--color-slate);">Shared with ${reach} of the ${people.length} ${people.length === 1 ? 'person' : 'people'} who needed it</span>`;
  }
  if (st.note) html += `<br><span style="font-size:var(--text-xs);color:var(--color-muted);">${_daiEsc(st.note)}</span>`;
  if (status !== 'Done') {
    const found = _dacMatches(themeIds).filter(e => !(st.resourceIds || []).includes(e.resourceId));
    if (found.length) html += `<br><span style="font-size:var(--text-xs);color:var(--color-slate);">In your library: ${found.slice(0, 2).map(e => _daiEsc(e.title)).join(', ')}${found.length > 2 ? ` and ${found.length - 2} more` : ''}</span>`;
  }
  html += `<br><button type="button" data-dac-open="${i}" aria-label="${status === 'Done' ? 'Update' : 'Mark done or update'}: ${_daiEsc(label)}" style="${btnStyle}margin-top:4px;">${status === 'Done' ? 'Update' : 'Mark done'}</button>`;
  return html;
}

function daiActionFilterHTML(id) {
  return `<div class="form-group" style="max-width:260px;margin-bottom:var(--space-sm);"><label class="form-label" for="${id}">Show</label>
    <select id="${id}" class="form-select" data-dac-filter>
      <option value="todo"${_dacFilter === 'todo' ? ' selected' : ''}>Still to do</option>
      <option value="done"${_dacFilter === 'done' ? ' selected' : ''}>Done</option>
      <option value="all"${_dacFilter === 'all' ? ' selected' : ''}>All</option>
    </select></div>`;
}
function daiActionWireFilters(root) {
  root.querySelectorAll('[data-dac-filter]').forEach(sel => sel.addEventListener('change', () => {
    _dacFilter = sel.value;
    const id = sel.id;
    if (typeof _daiRenderBody === 'function') _daiRenderBody();
    document.getElementById(id)?.focus();
  }));
}

// ── Dialog ────────────────────────────────────────────────────
let _dacReturn = null;
function daiActionOpen(i, trigger) {
  const row = _dacRows[i];
  if (!row) return;
  _dacReturn = trigger || document.activeElement;
  const st = _dacGet(row.key);
  const matches = new Set(_dacMatches(row.themeIds).map(e => e.resourceId));
  const entries = _dacLibEntries().slice().sort((a, b) => (matches.has(b.resourceId) - matches.has(a.resourceId)) || String(a.title).localeCompare(String(b.title)));
  const chosen = new Set(st.resourceIds || (st.status ? [] : [...matches]));
  const initialStatus = st.status && st.status !== 'To do' ? st.status : 'Done';

  document.getElementById('dac-dialog')?.remove();
  const host = document.createElement('div');
  host.id = 'dac-dialog';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', 'dac-title');
  host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:700;display:flex;align-items:center;justify-content:center;padding:var(--space-lg);';
  host.innerHTML = `
    <form novalidate style="background:var(--color-white);color:var(--color-slate);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-md);">
        <h2 id="dac-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Support action progress</h2>
        <button type="button" data-dac-close aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;">×</button>
      </div>
      <p style="font-size:var(--text-sm);margin-bottom:var(--space-md);"><strong>${_daiEsc(row.label)}</strong> (${row.people.length} ${row.people.length === 1 ? 'person' : 'people'})</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);">
        <div class="form-group"><label class="form-label" for="dac-status">Status</label>
          <select id="dac-status" class="form-select">${DAI_ACTION_STATES.map(s => `<option${s === initialStatus ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="dac-date">Date</label>
          <input id="dac-date" type="date" class="form-input" value="${_daiEsc(st.date || todayISO())}"></div>
      </div>
      <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 4px;">Resources from the Resource Library</legend>
        ${entries.length ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-xs);">Entries that mention this theme are listed first and ticked for you.</p>
          <label class="sr-only" for="dac-filter-text">Filter resources</label>
          <input id="dac-filter-text" type="search" class="form-input" placeholder="Filter by title" style="margin-bottom:var(--space-sm);">
          <div style="max-height:240px;overflow-y:auto;">${entries.map(e => {
            const n = _dacShares(e.resourceId).reduce((x, s) => x + (s.staffIds || []).length, 0);
            return `<div data-dac-row="${_daiEsc(String(e.title || '').toLowerCase())}" style="display:flex;gap:var(--space-sm);align-items:flex-start;padding:4px 0;">
              <input type="checkbox" id="dac-r-${_daiEsc(e.resourceId)}" value="${_daiEsc(e.resourceId)}" data-dac-res ${chosen.has(e.resourceId) ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;flex-shrink:0;">
              <label for="dac-r-${_daiEsc(e.resourceId)}" style="font-size:var(--text-sm);">${_daiEsc(e.title)}${matches.has(e.resourceId) ? ' <strong>(matches this theme)</strong>' : ''} <span style="color:var(--color-muted);">${n ? `shared with ${n} staff` : 'not shared yet'}</span></label></div>`;
          }).join('')}</div>`
          : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No entries in the Resource Library yet.</p>'}
      </fieldset>
      <div class="form-group"><label class="form-label form-label--optional" for="dac-note">Note</label>
        <input id="dac-note" type="text" class="form-input" value="${_daiEsc(st.note || '')}" placeholder="For example: Teach Meet held, 9 attended"></div>
      <div class="btn-row" style="margin-top:var(--space-lg);">
        <button type="submit" class="btn btn--primary">Save</button>
        <button type="button" class="btn btn--secondary" data-dac-close>Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(host);
  const close = () => { host.remove(); if (_dacReturn && document.body.contains(_dacReturn)) _dacReturn.focus(); };
  host.querySelectorAll('[data-dac-close]').forEach(b => b.addEventListener('click', close));
  host.addEventListener('click', e => { if (e.target === host) close(); });
  host.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...host.querySelectorAll('button, input, select')].filter(el => !el.disabled && !el.closest('[data-dac-row][style*="none"]'));
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  host.querySelector('#dac-filter-text')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-dac-row]').forEach(r => { r.style.display = !q || r.dataset.dacRow.includes(q) ? 'flex' : 'none'; });
  });
  host.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    _dacStore()[row.key] = {
      status: host.querySelector('#dac-status').value,
      date: host.querySelector('#dac-date').value || todayISO(),
      resourceIds: [...host.querySelectorAll('[data-dac-res]:checked')].map(c => c.value),
      note: host.querySelector('#dac-note').value.trim(),
      label: row.label,
      updated: nowISO(),
    };
    if (typeof saveDAIData === 'function') saveDAIData();
    host.remove();
    if (typeof _daiRenderBody === 'function') _daiRenderBody();
    const m = document.getElementById('dai-status');
    if (m) m.textContent = `Saved: ${row.label} marked ${_dacStore()[row.key].status.toLowerCase()}.`;
    document.getElementById('dai-panel')?.focus();
  });
  host.querySelector('#dac-status').focus();
}

// For the impact report and overview.
function daiActionSummary() {
  const all = Object.values(_dacStore());
  return { done: all.filter(s => s.status === 'Done').length, inProgress: all.filter(s => s.status === 'In progress' || s.status === 'Planned').length, doneLabels: all.filter(s => s.status === 'Done').map(s => s.label).filter(Boolean) };
}
