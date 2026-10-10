/* ================================================================
   meetingnotes.js — DPC Hub
   Meeting notes page (October 2026).

   The digital twin of the printed two-page meeting notes template
   (print/meeting-notes-template.html). Two ways in, one way through:

     Write notes   The template as a form: meeting details, note lines
                   with a margin marker (A action, D date, E evidence,
                   ? check), then Actions, Dates, Impact and evidence,
                   and Check.
     From paper    The printed template photographed into Copilot (in
                   the college tenant) with a prompt the Hub builds
                   from live focuses, loops and areas. The reply is
                   pasted back here.

   Both routes produce the notes import text (notes-import.js), so the
   same checks run on both. The review screen shows every item, where
   it will land and any warnings, with tick boxes. Apply writes to
   Meetings, Tasks, Calendar, Notes, area activity logs, cross-college
   activity and loop evidence chains.

   Safe to repeat: every item carries an importId, so applying the same
   notes again updates the earlier items rather than duplicating them.
   Before writing, the import text is saved to "Notes import backups"
   in the OneDrive folder (or downloaded). Undo lasts for the session.

   From Claude   Notes talked through with Claude and saved to the
                 private inbox (claude-inbox.js). Same review, same
                 checks.

   Saving needs the OneDrive folder. If it is not connected, the page
   offers a one-click reconnect (then reloads and comes back here) or
   saving in this browser only.

   Privacy: initials only, no learner data. notes-import.js flags
   anything that looks otherwise and leaves it unticked.
   ================================================================ */

const MN_DRAFT_KEY = 'dpc-meeting-notes-draft-v1';
const MN_MARKS = [
  { value: 'note', label: 'Note' },
  { value: 'A', label: 'A · Action' },
  { value: 'D', label: 'D · Date' },
  { value: 'E', label: 'E · Evidence' },
  { value: '?', label: '? · Check' },
];
const MN_DEST_ORDER = ['Meetings', 'Tasks', 'Task changes', 'Calendar', 'Notes'];
const MN_TABS = ['write', 'paper', 'claude'];

let _mn = { tab: 'write', draft: null, review: null, lastImport: null, saveTimer: null };

// ── Entry point ───────────────────────────────────────────────
function initMeetingNotes() {
  const el = document.getElementById('main-content');
  if (!el) return;
  if (!_mn.draft) _mn.draft = _mnLoadDraft() || _mnBlankDraft();

  el.innerHTML = `
    <style>
      .mn-wrap { max-width: 980px; }
      .mn-tabs { display:flex; gap:4px; border-bottom:2px solid var(--color-border); margin-bottom:var(--space-lg); flex-wrap:wrap; }
      .mn-tab { font:inherit; font-weight:var(--font-bold); background:none; border:none; border-bottom:3px solid transparent; margin-bottom:-2px;
        padding:10px 16px; min-height:44px; cursor:pointer; color:var(--color-slate); }
      .mn-tab[aria-selected="true"] { color:var(--color-navy); border-bottom-color:var(--color-teal); }
      .mn-tab:focus-visible, .mn-wrap button:focus-visible, .mn-wrap input:focus-visible, .mn-wrap select:focus-visible, .mn-wrap textarea:focus-visible, .mn-wrap a:focus-visible
        { outline:3px solid var(--color-navy); outline-offset:2px; }
      .mn-section { background:var(--color-white); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-md); margin-bottom:var(--space-md); }
      .mn-section > h3 { margin:0 0 4px; font-size:var(--text-lg); color:var(--color-navy); display:flex; align-items:center; gap:8px; }
      .mn-hint { margin:0 0 var(--space-sm); font-size:var(--text-sm); color:var(--color-slate); }
      .mn-mark { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border:2px solid var(--color-navy); border-radius:4px; font-size:14px; font-weight:700; color:var(--color-navy); flex:none; }
      .mn-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-sm) var(--space-md); }
      .mn-field { display:flex; flex-direction:column; gap:4px; }
      .mn-field label { font-size:var(--text-sm); font-weight:var(--font-bold); color:var(--color-navy); }
      .mn-row { display:grid; gap:6px; align-items:center; margin-bottom:6px; }
      .mn-row--line { grid-template-columns: 150px minmax(0,1fr) 44px; }
      .mn-row--action { grid-template-columns: minmax(0,1fr) 90px 150px 140px 44px; }
      .mn-row--date { grid-template-columns: 150px 130px minmax(0,1fr) 140px 44px; }
      .mn-row--evidence { grid-template-columns: minmax(0,1fr) 140px 44px; }
      .mn-row--check { grid-template-columns: minmax(0,1fr) 44px; }
      .mn-colheads { font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--color-slate); margin-bottom:4px; }
      .mn-remove { min-width:44px; min-height:44px; border:1px solid var(--color-border); background:var(--color-white); border-radius:var(--radius-sm); cursor:pointer; font-size:20px; color:var(--color-slate); }
      .mn-remove:hover { border-color:var(--color-red); color:var(--color-red); }
      .mn-add { margin-top:4px; }
      .mn-actions-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:var(--space-md); }
      .mn-status { font-size:var(--text-sm); color:var(--color-slate); }
      .mn-group { border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md); margin:0 0 var(--space-md); background:var(--color-white); }
      .mn-group legend { font-weight:700; color:var(--color-navy); padding:0 6px; font-size:var(--text-lg); }
      .mn-item { display:grid; grid-template-columns:28px minmax(0,1fr); gap:8px; padding:8px 0; border-top:1px solid var(--color-light); }
      .mn-item:first-of-type { border-top:none; }
      .mn-item input[type=checkbox] { width:22px; height:22px; margin-top:2px; }
      .mn-item label { font-weight:600; color:var(--color-navy); cursor:pointer; }
      .mn-meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; font-size:var(--text-xs); }
      .mn-chip { background:var(--color-light); color:var(--color-navy); padding:2px 8px; border-radius:999px; }
      .mn-chip--update { background:var(--color-amber-lt); color:#7A4B00; }
      .mn-warn { margin:4px 0 0; padding-left:18px; font-size:var(--text-sm); color:#7A4B00; }
      .mn-err { background:var(--color-red-lt); border:1px solid var(--color-red); border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md); margin-bottom:var(--space-md); }
      .mn-err h3, .mn-callout h3 { margin:0 0 6px; font-size:var(--text-base); color:var(--color-navy); }
      .mn-callout { background:var(--color-amber-lt); border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md); margin-bottom:var(--space-md); }
      .mn-callout ul, .mn-err ul { margin:0; padding-left:20px; font-size:var(--text-sm); }
      .mn-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      @media (max-width: 760px) {
        .mn-row--action, .mn-row--date { grid-template-columns: minmax(0,1fr) 44px; }
        .mn-row--action > :not(:first-child):not(.mn-remove), .mn-row--date > :not(:nth-child(3)):not(.mn-remove) { grid-column:1; }
        .mn-row--line { grid-template-columns: 120px minmax(0,1fr) 44px; }
        .mn-colheads { display:none; }
      }
    </style>
    <div class="mn-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:var(--space-sm);">
        <h2 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin:0;">Meeting notes</h2>
        <a class="btn btn--ghost btn--sm" href="print/meeting-notes-template.html" target="_blank" rel="noopener">Print the paper template<span class="mn-sr"> (opens in a new tab)</span></a>
      </div>
      <p class="mn-hint" style="margin-bottom:var(--space-md);">Notes go straight into Meetings, Tasks, Calendar, Notes, area logs and loops. You check everything before it is saved.</p>

      <div class="mn-tabs" role="tablist" aria-label="How are you taking notes?">
        <button type="button" class="mn-tab" role="tab" id="mn-tab-write" aria-controls="mn-panel" data-tab="write">Write notes</button>
        <button type="button" class="mn-tab" role="tab" id="mn-tab-paper" aria-controls="mn-panel" data-tab="paper">From paper (Copilot)</button>
        <button type="button" class="mn-tab" role="tab" id="mn-tab-claude" aria-controls="mn-panel" data-tab="claude">From Claude</button>
      </div>
      <div id="mn-panel" role="tabpanel" tabindex="-1"></div>
      <p id="mn-live" class="mn-sr" role="status" aria-live="polite"></p>
    </div>`;

  el.querySelector('.mn-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.mn-tab');
    if (!t) return;
    if (t.dataset.tab === 'claude' && typeof _ci !== 'undefined') _ci.editing = null;
    _mnShowTab(t.dataset.tab, true);
  });
  el.querySelector('.mn-tabs').addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault();
    const i = MN_TABS.indexOf(_mn.tab), n = MN_TABS.length;
    const next = e.key === 'Home' ? MN_TABS[0] : e.key === 'End' ? MN_TABS[n - 1]
      : MN_TABS[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
    _mnShowTab(next, false);
    document.getElementById('mn-tab-' + next).focus();
  });
  _mnShowTab(_mn.review ? _mn.tab : _mn.tab, false);
}

function _mnShowTab(tab, focusPanel) {
  _mn.tab = tab;
  _mn.review = null;
  MN_TABS.forEach(t => {
    const b = document.getElementById('mn-tab-' + t);
    if (!b) return;
    b.setAttribute('aria-selected', String(t === tab));
    b.tabIndex = t === tab ? 0 : -1;
  });
  const panel = document.getElementById('mn-panel');
  panel.setAttribute('aria-labelledby', 'mn-tab-' + tab);
  if (tab === 'write') _mnRenderWrite();
  else if (tab === 'claude' && typeof ciRender === 'function') ciRender(panel);
  else _mnRenderPaper();
  if (focusPanel) panel.focus();
}

// ── Helpers ───────────────────────────────────────────────────
function _mnEsc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _mnSay(msg) { const el = document.getElementById('mn-live'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 50); } }
function _mnToast(type, msg) { if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(type, msg); }
function _mnOneLine(s) { return String(s || '').replace(/[\r\n]+/g, ' ').replace(/^#+\s*/, '').trim(); }

function _mnBlankDraft() {
  return {
    ref: 'mn-' + (typeof generateId === 'function' ? generateId().slice(0, 8) : Date.now().toString(36)),
    title: '', date: todayISO(), time: '', withInit: '', meetingType: 'other-staff', area: '', focusId: '',
    lines: [{ type: 'note', text: '' }, { type: 'note', text: '' }, { type: 'note', text: '' }],
    actions: [{ text: '', who: 'GW', by: '', area: '' }],
    dates: [{ date: '', time: '', what: '', area: '' }],
    evidence: [{ text: '', area: '' }],
    checks: [{ text: '' }],
  };
}
function _mnLoadDraft() {
  try { const raw = localStorage.getItem(MN_DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function _mnSaveDraftSoon() {
  clearTimeout(_mn.saveTimer);
  _mn.saveTimer = setTimeout(() => {
    try { localStorage.setItem(MN_DRAFT_KEY, JSON.stringify(_mn.draft)); _mnSetStatus('Draft kept on this device.'); }
    catch (e) { _mnSetStatus('Draft could not be kept on this device. Send it to the Hub before leaving.'); }
  }, 600);
}
function _mnClearDraft() { clearTimeout(_mn.saveTimer); try { localStorage.removeItem(MN_DRAFT_KEY); } catch (e) { /* storage unavailable */ } }
function _mnSetStatus(msg) { const el = document.getElementById('mn-draft-status'); if (el) el.textContent = msg; }

// Live lists, with stable short codes for Copilot (F1, L1 ...).
function _mnContext() {
  const areas = (typeof _getAreas === 'function') ? _getAreas() : ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []);
  const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  const focusList = ((window.DPC_DATA.currentFocus && window.DPC_DATA.currentFocus.focuses) || [])
    .filter(f => f.status !== 'complete').slice().sort(byCreated);
  const loopList = (typeof getOpenGapAFIs === 'function' ? getOpenGapAFIs() : ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []))
    .slice().sort(byCreated);
  const ctx = { areas: areas.map(a => a.areaCode), areaNames: areas.map(a => a.areaName || ''), areaList: areas,
    focuses: {}, loops: {}, focusCodeById: {}, loopCodeById: {}, focusList, loopList, taskIds: {} };
  _mnCalendar().forEach(e => { if (e.entryType === 'task') ctx.taskIds[e.entryId] = true; });
  focusList.forEach((f, i) => { const c = 'F' + (i + 1); ctx.focuses[c] = { id: f.focusId, title: f.title || 'Untitled focus' }; ctx.focusCodeById[f.focusId] = c; });
  loopList.forEach((l, i) => {
    const c = 'L' + (i + 1);
    ctx.loops[c] = { id: l.afiId, title: (l.areaCode ? l.areaCode + ': ' : '') + String(l.description || l.lraThemeLabel || 'Loop').slice(0, 70) };
    ctx.loopCodeById[l.afiId] = c;
  });
  return ctx;
}
function _mnAreaOptions(ctx, selected, noneLabel) {
  return `<option value="">${_mnEsc(noneLabel || 'No area')}</option>` +
    ctx.areaList.map(a => `<option value="${_mnEsc(a.areaCode)}"${a.areaCode === selected ? ' selected' : ''}>${_mnEsc(a.areaCode)} · ${_mnEsc(a.areaName)}</option>`).join('');
}

// ── Write notes ───────────────────────────────────────────────
function _mnRenderWrite() {
  const d = _mn.draft, ctx = _mnContext();
  const typeLabels = (typeof MEETING_TYPE_LABELS !== 'undefined') ? MEETING_TYPE_LABELS : { 'other-staff': 'Other' };
  const panel = document.getElementById('mn-panel');
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="mn-h-details">
      <h3 id="mn-h-details">Meeting details</h3>
      <div class="mn-grid">
        <div class="mn-field" style="grid-column:1/-1;"><label for="mn-title">Title</label>
          <input id="mn-title" class="form-input" data-k="title" value="${_mnEsc(d.title)}" placeholder="For example: 1:1 with ND"></div>
        <div class="mn-field"><label for="mn-date">Date</label><input id="mn-date" type="date" class="form-input" data-k="date" value="${_mnEsc(d.date)}" required></div>
        <div class="mn-field"><label for="mn-time">Time (optional)</label><input id="mn-time" type="time" class="form-input" data-k="time" value="${_mnEsc(d.time)}"></div>
        <div class="mn-field"><label for="mn-with">With (initials)</label><input id="mn-with" class="form-input" data-k="withInit" value="${_mnEsc(d.withInit)}" placeholder="ND, LF" aria-describedby="mn-with-hint"><span id="mn-with-hint" class="mn-hint" style="margin:0;">Initials only, separated by commas.</span></div>
        <div class="mn-field"><label for="mn-type">Meeting type</label><select id="mn-type" class="form-select" data-k="meetingType">
          ${Object.keys(typeLabels).map(k => `<option value="${k}"${k === d.meetingType ? ' selected' : ''}>${_mnEsc(typeLabels[k])}</option>`).join('')}</select></div>
        <div class="mn-field"><label for="mn-area">Area</label><select id="mn-area" class="form-select" data-k="area">${_mnAreaOptions(ctx, d.area, 'No area (college-wide)')}</select></div>
        <div class="mn-field"><label for="mn-focus">Focus</label><select id="mn-focus" class="form-select" data-k="focusId">
          <option value="">No focus</option>${ctx.focusList.map(f => `<option value="${_mnEsc(f.focusId)}"${f.focusId === d.focusId ? ' selected' : ''}>${_mnEsc(f.title || 'Untitled focus')}</option>`).join('')}</select></div>
      </div>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-notes">
      <h3 id="mn-h-notes">Notes</h3>
      <p class="mn-hint" id="mn-notes-hint">One line, one thing. Choose a marker for anything that is not just a note. Press Enter to start a new line. For a date line, start with the date, for example 23/10.</p>
      <div id="mn-lines"></div>
      <button type="button" class="btn btn--secondary btn--sm mn-add" data-add="lines">+ Add line</button>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-actions">
      <h3 id="mn-h-actions"><span class="mn-mark" aria-hidden="true">A</span>Actions</h3>
      <p class="mn-hint">Start with a verb.</p>
      <div class="mn-row mn-row--action mn-colheads" aria-hidden="true"><span>Action</span><span>Who</span><span>By</span><span>Area</span><span></span></div>
      <div id="mn-actions"></div>
      <button type="button" class="btn btn--secondary btn--sm mn-add" data-add="actions">+ Add action</button>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-dates">
      <h3 id="mn-h-dates"><span class="mn-mark" aria-hidden="true">D</span>Dates</h3>
      <p class="mn-hint">Events, sessions and deadlines.</p>
      <div class="mn-row mn-row--date mn-colheads" aria-hidden="true"><span>Date</span><span>Time</span><span>What</span><span>Area</span><span></span></div>
      <div id="mn-dates"></div>
      <button type="button" class="btn btn--secondary btn--sm mn-add" data-add="dates">+ Add date</button>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-evidence">
      <h3 id="mn-h-evidence"><span class="mn-mark" aria-hidden="true">E</span>Impact and evidence</h3>
      <p class="mn-hint">Only what has already happened or changed.</p>
      <div id="mn-evidence"></div>
      <button type="button" class="btn btn--secondary btn--sm mn-add" data-add="evidence">+ Add evidence</button>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-checks">
      <h3 id="mn-h-checks"><span class="mn-mark" aria-hidden="true">?</span>Check</h3>
      <p class="mn-hint">Anything to chase or confirm. Each one becomes a task.</p>
      <div id="mn-checks"></div>
      <button type="button" class="btn btn--secondary btn--sm mn-add" data-add="checks">+ Add check</button>
    </section>

    <div class="mn-actions-bar">
      <button type="button" id="mn-review-btn" class="btn btn--primary">Review and send to Hub</button>
      <button type="button" id="mn-clear-btn" class="btn btn--ghost btn--sm">Start new notes</button>
      <span id="mn-draft-status" class="mn-status" aria-live="polite"></span>
    </div>`;

  ['lines', 'actions', 'dates', 'evidence', 'checks'].forEach(k => _mnRenderRows(k, ctx));

  panel.querySelectorAll('[data-k]').forEach(inp => {
    inp.addEventListener('input', () => { _mn.draft[inp.dataset.k] = inp.value; _mnSaveDraftSoon(); });
    inp.addEventListener('change', () => { _mn.draft[inp.dataset.k] = inp.value; _mnSaveDraftSoon(); });
  });
  panel.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => _mnAddRow(b.dataset.add)));
  ['mn-lines', 'mn-actions', 'mn-dates', 'mn-evidence', 'mn-checks'].forEach(id => {
    const box = document.getElementById(id);
    box.addEventListener('input', _mnRowInput);
    box.addEventListener('change', _mnRowInput);
    box.addEventListener('click', _mnRowRemove);
  });
  document.getElementById('mn-lines').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[data-f="text"]')) {
      e.preventDefault();
      const i = +e.target.closest('[data-i]').dataset.i;
      _mn.draft.lines.splice(i + 1, 0, { type: 'note', text: '' });
      _mnRenderRows('lines', _mnContext());
      _mnFocusRow('lines', i + 1);
      _mnSaveDraftSoon();
    }
  });
  document.getElementById('mn-review-btn').addEventListener('click', () => {
    if (!_mn.draft.date) { document.getElementById('mn-date').focus(); _mnToast('error', 'Add the meeting date first.'); return; }
    _mnReview(_mnDraftToText(_mn.draft, _mnContext()), 'form');
  });
  document.getElementById('mn-clear-btn').addEventListener('click', () => {
    if (!confirm('Start new notes? What is on this page now will be cleared.')) return;
    _mn.draft = _mnBlankDraft(); _mnClearDraft(); _mnRenderWrite(); _mnSay('New notes started.');
    document.getElementById('mn-title').focus();
  });
}

function _mnRenderRows(kind, ctx) {
  const box = document.getElementById('mn-' + kind);
  if (!box) return;
  const rows = _mn.draft[kind];
  const n = (i) => i + 1;
  box.innerHTML = rows.map((r, i) => {
    if (kind === 'lines') return `<div class="mn-row mn-row--line" data-i="${i}">
        <select class="form-select" data-f="type" aria-label="Marker for line ${n(i)}">${MN_MARKS.map(m => `<option value="${m.value}"${m.value === r.type ? ' selected' : ''}>${m.label}</option>`).join('')}</select>
        <input class="form-input" data-f="text" value="${_mnEsc(r.text)}" aria-label="Line ${n(i)}" aria-describedby="mn-notes-hint">
        <button type="button" class="mn-remove" data-remove="lines" aria-label="Remove line ${n(i)}">×</button></div>`;
    if (kind === 'actions') return `<div class="mn-row mn-row--action" data-i="${i}">
        <input class="form-input" data-f="text" value="${_mnEsc(r.text)}" aria-label="Action ${n(i)}">
        <input class="form-input" data-f="who" value="${_mnEsc(r.who)}" aria-label="Who, action ${n(i)}">
        <input class="form-input" type="date" data-f="by" value="${_mnEsc(r.by)}" aria-label="By when, action ${n(i)}">
        <select class="form-select" data-f="area" aria-label="Area, action ${n(i)}">${_mnAreaOptions(ctx, r.area, 'Meeting area')}</select>
        <button type="button" class="mn-remove" data-remove="actions" aria-label="Remove action ${n(i)}">×</button></div>`;
    if (kind === 'dates') return `<div class="mn-row mn-row--date" data-i="${i}">
        <input class="form-input" type="date" data-f="date" value="${_mnEsc(r.date)}" aria-label="Date ${n(i)}">
        <input class="form-input" type="time" data-f="time" value="${_mnEsc(r.time)}" aria-label="Time, date ${n(i)}">
        <input class="form-input" data-f="what" value="${_mnEsc(r.what)}" aria-label="What is happening, date ${n(i)}">
        <select class="form-select" data-f="area" aria-label="Area, date ${n(i)}">${_mnAreaOptions(ctx, r.area, 'Meeting area')}</select>
        <button type="button" class="mn-remove" data-remove="dates" aria-label="Remove date ${n(i)}">×</button></div>`;
    if (kind === 'evidence') return `<div class="mn-row mn-row--evidence" data-i="${i}">
        <input class="form-input" data-f="text" value="${_mnEsc(r.text)}" aria-label="What happened or changed, evidence ${n(i)}">
        <select class="form-select" data-f="area" aria-label="Area, evidence ${n(i)}">${_mnAreaOptions(ctx, r.area, 'Meeting area')}</select>
        <button type="button" class="mn-remove" data-remove="evidence" aria-label="Remove evidence ${n(i)}">×</button></div>`;
    return `<div class="mn-row mn-row--check" data-i="${i}">
        <input class="form-input" data-f="text" value="${_mnEsc(r.text)}" aria-label="Check ${n(i)}">
        <button type="button" class="mn-remove" data-remove="checks" aria-label="Remove check ${n(i)}">×</button></div>`;
  }).join('');
}

function _mnRowInput(e) {
  const t = e.target, row = t.closest('[data-i]');
  if (!row || !t.dataset.f) return;
  const kind = row.parentElement.id.replace('mn-', '');
  _mn.draft[kind][+row.dataset.i][t.dataset.f] = t.value;
  _mnSaveDraftSoon();
}
function _mnRowRemove(e) {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  const kind = b.dataset.remove, i = +b.closest('[data-i]').dataset.i;
  _mn.draft[kind].splice(i, 1);
  _mnRenderRows(kind, _mnContext());
  _mnSaveDraftSoon();
  const left = _mn.draft[kind].length;
  _mnSay('Removed.');
  if (left) _mnFocusRow(kind, Math.min(i, left - 1));
  else document.querySelector(`[data-add="${kind}"]`).focus();
}
function _mnAddRow(kind) {
  const blank = { lines: { type: 'note', text: '' }, actions: { text: '', who: 'GW', by: '', area: '' },
    dates: { date: '', time: '', what: '', area: '' }, evidence: { text: '', area: '' }, checks: { text: '' } }[kind];
  _mn.draft[kind].push(blank);
  _mnRenderRows(kind, _mnContext());
  _mnFocusRow(kind, _mn.draft[kind].length - 1);
  _mnSaveDraftSoon();
}
function _mnFocusRow(kind, i) {
  const row = document.querySelector(`#mn-${kind} [data-i="${i}"]`);
  const target = row && (row.querySelector('[data-f="text"]') || row.querySelector('[data-f="date"]') || row.querySelector('input'));
  if (target) target.focus();
}

// "23/10 DA+I day" -> { date: '2026-10-23', rest: 'DA+I day' }. The year
// is the one that puts the date nearest after the meeting (academic year).
function _mnLeadingDate(text, meetingDate) {
  const m = String(text).trim().match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\s*[-:–,]?\s*(.*)$/);
  if (!m) return null;
  const base = meetingDate ? new Date(meetingDate + 'T12:00:00') : new Date();
  let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : base.getFullYear();
  const pad = (v) => String(v).padStart(2, '0');
  let iso = `${y}-${pad(m[2])}-${pad(m[1])}`;
  if (!m[3] && new Date(iso + 'T12:00:00') < new Date(base.getTime() - 60 * 864e5)) iso = `${y + 1}-${pad(m[2])}-${pad(m[1])}`;
  return (typeof niParseDate === 'function' && niParseDate(iso)) ? { date: iso, rest: m[4] || '' } : null;
}

// The form becomes the same import text Copilot would produce.
function _mnDraftToText(d, ctx) {
  const L = [], fcode = d.focusId ? (ctx.focusCodeById[d.focusId] || 'none') : 'none';
  const area = d.area || 'none';
  const title = _mnOneLine(d.title) || ('Meeting ' + d.date);
  let a = 0, dd = 0, ev = 0;
  L.push(NI_HEADER, 'Source: Hub meeting notes form', 'Captured: ' + d.date, 'Ref: ' + d.ref, '');
  L.push('## Meeting: ' + title, 'Key: M1', 'Date: ' + d.date);
  if (d.time) L.push('Time: ' + d.time);
  L.push('Type: ' + (d.meetingType || 'other-staff'), 'With: ' + (_mnOneLine(d.withInit) || 'none'), 'Area: ' + area, 'Focus: ' + fcode, 'Notes:');
  d.lines.filter(l => l.type === 'note' && _mnOneLine(l.text)).forEach(l => L.push('- ' + _mnOneLine(l.text)));
  L.push('');

  const action = (text, who, by, rowArea, check) => {
    a++;
    L.push('## Action: ' + text, 'Key: A' + a, 'Due: ' + (by || 'none'), 'Owner: ' + (_mnOneLine(who) || 'GW'),
      'Area: ' + (rowArea || area), 'Focus: ' + fcode, 'Meeting: M1');
    if (check) L.push('Check: yes - ' + check);
    L.push('');
  };
  const dateBlock = (date, time, what, rowArea) => {
    dd++;
    L.push('## Date: ' + what, 'Key: D' + dd, 'Date: ' + (date || 'none'));
    if (time) L.push('Time: ' + time);
    L.push('Kind: ' + (time ? 'meeting' : 'deadline'), 'Area: ' + (rowArea || area), 'Focus: ' + fcode, '');
  };
  const evidence = (text, rowArea) => {
    ev++;
    L.push('## Evidence: ' + text.slice(0, 80), 'Key: E' + ev, 'Date: ' + d.date, 'Type: meeting',
      'Area: ' + (rowArea || area), 'Focus: ' + fcode, 'Summary:', text, '');
  };

  d.lines.forEach(l => {
    const t = _mnOneLine(l.text);
    if (!t) return;
    if (l.type === 'A') action(t, 'GW', '', '');
    else if (l.type === 'E') evidence(t, '');
    else if (l.type === '?') action('Check: ' + t, 'GW', '', '');
    else if (l.type === 'D') {
      const ld = _mnLeadingDate(t, d.date);
      dateBlock(ld ? ld.date : '', '', ld ? (ld.rest || t) : t, '');
    }
  });
  d.actions.forEach(r => { const t = _mnOneLine(r.text); if (t) action(t, r.who, r.by, r.area); });
  d.dates.forEach(r => { const t = _mnOneLine(r.what); if (t || r.date) dateBlock(r.date, r.time, t || 'Untitled date', r.area); });
  d.evidence.forEach(r => { const t = _mnOneLine(r.text); if (t) evidence(t, r.area); });
  d.checks.forEach(r => { const t = _mnOneLine(r.text); if (t) action('Check: ' + t, 'GW', '', ''); });
  return L.join('\n');
}

// ── From paper ────────────────────────────────────────────────
function _mnRenderPaper() {
  const ctx = _mnContext();
  const prompt = _mnCopilotPrompt(ctx);
  const panel = document.getElementById('mn-panel');
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="mn-h-p1">
      <h3 id="mn-h-p1">1. Write on the template</h3>
      <p class="mn-hint">Use the printed two-page template, or lined paper with A, D, E or ? in the margin. Initials only, dates as numbers.</p>
      <a class="btn btn--secondary btn--sm" href="print/meeting-notes-template.html" target="_blank" rel="noopener">Open the template to print<span class="mn-sr"> (opens in a new tab)</span></a>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-p2">
      <h3 id="mn-h-p2">2. Give Copilot the photos and this prompt</h3>
      <p class="mn-hint">Use Copilot Chat signed in with your college account. Attach the photos of both pages, then paste the prompt. It already holds your live focus, loop and area codes.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" id="mn-copy-prompt" class="btn btn--primary btn--sm">Copy the Copilot prompt</button>
        <span id="mn-copy-status" class="mn-status" aria-live="polite"></span>
      </div>
      <details style="margin-top:var(--space-sm);">
        <summary style="cursor:pointer;font-size:var(--text-sm);color:var(--color-navy);min-height:44px;display:flex;align-items:center;">Show the prompt</summary>
        <label for="mn-prompt" class="mn-sr">Copilot prompt</label>
        <textarea id="mn-prompt" class="form-textarea" rows="12" readonly style="width:100%;font-family:monospace;font-size:13px;">${_mnEsc(prompt)}</textarea>
      </details>
    </section>

    <section class="mn-section" aria-labelledby="mn-h-p3">
      <h3 id="mn-h-p3">3. Paste Copilot's reply</h3>
      <label for="mn-paste" class="mn-hint" style="display:block;">Paste the whole reply. Anything before or after the import text is ignored.</label>
      <textarea id="mn-paste" class="form-textarea" rows="10" style="width:100%;font-family:monospace;font-size:13px;"></textarea>
      <div class="mn-actions-bar"><button type="button" id="mn-paste-review" class="btn btn--primary">Review</button></div>
    </section>`;

  document.getElementById('mn-copy-prompt').addEventListener('click', async () => {
    const status = document.getElementById('mn-copy-status');
    try { await navigator.clipboard.writeText(prompt); status.textContent = 'Copied. Paste it into Copilot with your photos.'; }
    catch (e) {
      const ta = document.getElementById('mn-prompt');
      ta.closest('details').open = true; ta.focus(); ta.select();
      status.textContent = 'Copy did not work here. The prompt is selected below: press Ctrl+C.';
    }
  });
  document.getElementById('mn-paste-review').addEventListener('click', () => {
    const text = document.getElementById('mn-paste').value;
    if (!text.trim()) { document.getElementById('mn-paste').focus(); _mnToast('error', 'Paste the reply from Copilot first.'); return; }
    _mnReview(text, 'paper');
  });
}

function _mnCopilotPrompt(ctx) {
  const focus = ctx.focusList.length ? ctx.focusList.map(f => ctx.focusCodeById[f.focusId] + ': ' + (f.title || 'Untitled focus')).join('\n') : '(none)';
  const loops = ctx.loopList.length ? Object.keys(ctx.loops).map(c => c + ': ' + ctx.loops[c].title).join('\n') : '(none)';
  const areas = ctx.areaList.map(a => a.areaCode + ': ' + (a.areaName || '')).join('\n');
  return `You are reading photos of my meeting notes and turning them into an import file for my DPC Hub. The notes are on my two-page meeting notes template, or on lined paper using the same margin letters. Copy what I wrote into the format below. Do not interpret, summarise or add anything.

TODAY: ${todayISO()}

HOW MY NOTES WORK
- Page 1 top: Date, With (initials), Area code(s), Meeting type (1:1, Team, HoA, Digital Lead, Other), Focus or project.
- Page 1 Notes box: one thing per line. A letter in the left margin marks the line: A = action, D = date, E = evidence of impact, ? = something to check. A line with no letter is a note.
- Page 2 boxes: Actions (Action, Who, By dd/mm, Area), Dates (Date, Time, What, Area), Impact and evidence (What happened, Area), Check.
- On plain paper I only use the margin letters.

RULES
1. Keep my wording. Fix obvious spelling only.
2. People are written as initials. Keep them exactly as written. If you see a full name, change it to initials. Never include learner names or learner details.
3. Dates are written dd/mm. Use the year that puts the date in the academic year (September to August) that contains TODAY. Write dates as YYYY-MM-DD.
4. If you cannot read a word, write your best reading and add "Check: yes - <the word>" to that block. Never guess silently.
5. Only use codes from the lists below. If an area or focus I wrote does not clearly match one, write none and add a Check question.
6. Meeting type: Team = quality-team, HoA = hoa, Digital Lead = digital-lead, 1:1 or Other = other-staff.
7. Only add a Loop line if I wrote a loop code such as L3 on that line.

WHAT EACH LINE BECOMES
- Note lines with no letter: lines in the Meeting block's Notes, each starting "- ".
- A lines and Actions rows: one Action block each. Owner is GW unless Who says otherwise.
- D lines and Dates rows: one Date block each. Kind is meeting if it has a time, otherwise deadline.
- E lines and evidence rows: one Evidence block each, Type meeting.
- ? lines and Check rows: one Action block each, titled "Check: <what I wrote>".
- Every Action, Date and Evidence block takes the Area and Focus from the top of page 1, unless its own row gives an area.

FOCUS CODES
${focus}

LOOP CODES
${loops}

AREA CODES
${areas}

OUTPUT
Return one code block and nothing else. Leave out any line you have nothing for.

${NI_HEADER}
Source: Paper template
Captured: <meeting date, YYYY-MM-DD>

## Meeting: <what I wrote at the top, or the focus and date>
Key: M1
Date: <YYYY-MM-DD>
Type: <type>
With: <initials>
Area: <area code or none>
Focus: <focus code or none>
Notes:
- <note line>

## Action: <action>
Key: A1
Due: <YYYY-MM-DD or none>
Owner: <initials>
Area: <area code or none>
Focus: <focus code or none>
Loop: <loop code, only if I wrote one>
Meeting: M1

## Date: <what>
Key: D1
Date: <YYYY-MM-DD>
Time: <HH:MM-HH:MM>
Kind: <meeting or deadline>
Area: <area code or none>
Focus: <focus code or none>

## Evidence: <short title>
Key: E1
Date: <meeting date>
Type: meeting
Area: <area code or none>
Focus: <focus code or none>
Loop: <loop code, only if I wrote one>
Summary:
<what I wrote>

## Check
- [<keys this is about, for example A2>] <question about anything you were unsure of>

Number keys from 1 within each kind: A1, A2, D1, D2, E1.`;
}

// ── Review ────────────────────────────────────────────────────
function _mnReview(text, source) {
  const ctx = _mnContext();
  const parsed = niParse(text, ctx);
  const panel = document.getElementById('mn-panel');
  _mn.review = { text, source, parsed, ctx, ops: [] };

  if (parsed.errors.length) {
    panel.innerHTML = `
      <div class="mn-err" role="alert" tabindex="-1" id="mn-err">
        <h3>${parsed.errors.length} thing${parsed.errors.length === 1 ? '' : 's'} to fix before this can go into the Hub</h3>
        <ul>${parsed.errors.map(e => `<li>${_mnEsc(e.msg)}</li>`).join('')}</ul>
      </div>
      <div class="mn-actions-bar"><button type="button" id="mn-back" class="btn btn--secondary">Back to ${source === 'form' ? 'my notes' : source === 'claude' ? 'the text' : 'the pasted reply'}</button></div>`;
    document.getElementById('mn-back').addEventListener('click', () => _mnBack(text, source));
    document.getElementById('mn-err').focus();
    return;
  }

  const ops = niBuild(parsed, ctx);
  ops.forEach(o => { o.existing = !!_mnFindExisting(o); o.include = !o.untick; o.warnings = parsed.warnings.filter(w => w.key && w.key.toUpperCase() === o.key).map(w => w.msg); });
  _mn.review.ops = ops;
  const general = parsed.warnings.filter(w => !w.key).map(w => w.msg);
  const groups = {};
  ops.forEach((o, i) => { const g = o.dest.indexOf('Area log') === 0 || o.dest === 'Cross-college activity' ? 'Evidence' : o.dest; (groups[g] = groups[g] || []).push(i); });
  const order = MN_DEST_ORDER.concat(['Evidence']).filter(g => groups[g]);
  const updating = ops.filter(o => o.existing).length;

  panel.innerHTML = `
    <h3 id="mn-review-h" tabindex="-1" style="font-size:var(--text-xl);color:var(--color-navy);margin:0 0 4px;">Check before it goes in</h3>
    <p class="mn-hint">${ops.length} item${ops.length === 1 ? '' : 's'} found. Ticked items will be saved where shown. Items with a warning start unticked.${updating ? ` ${updating} already came in from these notes before and will be updated, not duplicated.` : ''}</p>
    ${(parsed.checks.length || general.length) ? `<div class="mn-callout"><h3>Questions to settle</h3><ul>${parsed.checks.map(c => `<li>${_mnEsc(c)}</li>`).join('')}${general.map(c => `<li>${_mnEsc(c)}</li>`).join('')}</ul></div>` : ''}
    ${order.map(g => `
      <fieldset class="mn-group">
        <legend>${_mnEsc(g)} (${groups[g].length})</legend>
        <div style="display:flex;gap:8px;margin-bottom:4px;">
          <button type="button" class="btn btn--ghost btn--sm" data-tick="${_mnEsc(g)}" data-val="1">Tick all</button>
          <button type="button" class="btn btn--ghost btn--sm" data-tick="${_mnEsc(g)}" data-val="0">Untick all</button>
        </div>
        ${groups[g].map(i => _mnItemHtml(ops[i], i)).join('')}
      </fieldset>`).join('')}
    <div id="mn-connect"></div>
    <div class="mn-actions-bar">
      <button type="button" id="mn-apply" class="btn btn--primary">Save ticked items to the Hub</button>
      <button type="button" id="mn-back" class="btn btn--secondary">Back</button>
      <span id="mn-count" class="mn-status" aria-live="polite"></span>
    </div>`;

  const count = () => { document.getElementById('mn-count').textContent = ops.filter(o => o.include).length + ' of ' + ops.length + ' ticked'; };
  panel.querySelectorAll('input[data-op]').forEach(cb => cb.addEventListener('change', () => { ops[+cb.dataset.op].include = cb.checked; count(); }));
  panel.querySelectorAll('[data-tick]').forEach(b => b.addEventListener('click', () => {
    groups[b.dataset.tick].forEach(i => { ops[i].include = b.dataset.val === '1'; const cb = panel.querySelector(`input[data-op="${i}"]`); if (cb) cb.checked = ops[i].include; });
    count();
  }));
  document.getElementById('mn-back').addEventListener('click', () => _mnBack(text, source));
  document.getElementById('mn-apply').addEventListener('click', () => _mnApply());
  count();
  document.getElementById('mn-review-h').focus();
}

function _mnItemHtml(o, i) {
  const when = (o.entity.date && o.kind !== 'update') ? new Date(o.entity.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const time = o.entity.startTime ? ' ' + o.entity.startTime + (o.entity.endTime ? '–' + o.entity.endTime : '') : '';
  const who = (o.entity.personRefs || []).join(', ');
  const descId = `mn-op-d-${i}`;
  return `<div class="mn-item">
      <input type="checkbox" id="mn-op-${i}" data-op="${i}"${o.include ? ' checked' : ''} aria-describedby="${descId}">
      <div>
        <label for="mn-op-${i}">${_mnEsc(o.title)}</label>
        <div class="mn-meta" id="${descId}">
          <span class="mn-chip">${_mnEsc(o.dest)}</span>
          ${when ? `<span class="mn-chip">${_mnEsc(when + time)}</span>` : ''}
          ${who ? `<span class="mn-chip">${_mnEsc(who)}</span>` : ''}
          ${o.links.filter(l => l.type !== 'meeting').map(l => `<span class="mn-chip">${_mnEsc((l.type === 'area' ? 'Area ' : l.type === 'focus' ? 'Focus: ' : 'Loop: ') + l.label)}</span>`).join('')}
          ${o.entity.attendees != null ? `<span class="mn-chip">${_mnEsc(o.entity.attendees)} attended</span>` : ''}
          ${_mnTaskChips(o)}
          ${o.existing ? '<span class="mn-chip mn-chip--update">Updates earlier import</span>' : ''}
          ${o.note ? `<span>${_mnEsc(o.note)}</span>` : ''}
          ${o.warnings.length ? `<ul class="mn-warn">${o.warnings.map(w => `<li>${_mnEsc(w)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </div>`;
}

// Do-on day, steps and changes, for tasks and task updates.
function _mnTaskChips(o) {
  const day = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const out = [];
  if (o.kind === 'action') {
    if (o.entity.doDate) out.push('Do on ' + day(o.entity.doDate));
    if ((o.entity.microTasks || []).length) out.push(o.entity.microTasks.length + ' step' + (o.entity.microTasks.length === 1 ? '' : 's'));
  }
  if (o.kind === 'update') {
    const c = o.entity.changes, task = _mnCalendar().find(e => e.entryId === o.entity.entryId);
    if (task) out.push('Task: ' + task.title.slice(0, 60));
    if (c.doDate) out.push('Do on ' + day(c.doDate));
    if (c.date) out.push('Due ' + day(c.date));
    if (c.status) out.push(c.status === 'complete' ? 'Mark done' : 'Status: ' + c.status);
    if (c.notes) out.push('New notes');
    if (o.entity.addSteps.length) out.push('Add ' + o.entity.addSteps.length + ' step' + (o.entity.addSteps.length === 1 ? '' : 's'));
  }
  return out.map(t => `<span class="mn-chip">${_mnEsc(t)}</span>`).join('');
}

function _mnBack(text, source) {
  _mn.review = null;
  if (source === 'claude') {
    // Came from an edited copy: go back to that text, keeping the edits.
    if (typeof _ci !== 'undefined' && _ci.editing) _ci.editing.text = text;
    _mnShowTab('claude', false);
    return;
  }
  if (source === 'form') { _mnShowTab('write', false); document.getElementById('mn-review-btn')?.focus(); }
  else { _mnShowTab('paper', false); const p = document.getElementById('mn-paste'); if (p) { p.value = text; p.focus(); } }
}

// ── Apply ─────────────────────────────────────────────────────
function _mnCalendar() { return (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []; }
function _mnNotes() { return (window.DPC_DATA.notes && window.DPC_DATA.notes.notes) || []; }
function _mnActivities() { return typeof getAllActivities === 'function' ? getAllActivities() : []; }

function _mnFindExisting(o) {
  if (o.kind === 'update') return null;
  const id = o.entity.importId;
  if (o.kind === 'note') return _mnNotes().find(n => n.importId === id) || null;
  if (o.kind === 'evidence') return _mnActivities().find(a => a.importId === id) || null;
  return _mnCalendar().find(e => e.importId === id) || null;
}

// Removes an activity from wherever it lives; returns the removed record.
function _mnRemoveActivity(activityId) {
  let removed = null;
  ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).forEach(area => {
    const log = area.activityLog || [];
    const i = log.findIndex(a => a.activityId === activityId);
    if (i >= 0) { removed = log.splice(i, 1)[0]; _dirty.add('data-areas.json'); }
  });
  const cross = (window.DPC_DATA.activities && window.DPC_DATA.activities.activities) || [];
  const j = cross.findIndex(a => a.activityId === activityId);
  if (j >= 0) { removed = cross.splice(j, 1)[0]; _dirty.add('data-activities.json'); }
  if (removed) _writeLocalSnapshot();
  return removed;
}

async function _mnBackup(text, ref) {
  const name = 'notes-' + ref + '.txt';
  try {
    if (typeof saveBytesToFolder !== 'function') throw new Error('no folder');
    await saveBytesToFolder(name, new TextEncoder().encode(text), 'Notes import backups');
    return 'Backup saved to Notes import backups.';
  } catch (e) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return 'No folder connected, so the backup was downloaded.';
    } catch (e2) { return 'Backup could not be saved.'; }
  }
}

async function _mnApply(e, offlineOk) {
  const r = _mn.review;
  if (!r) return;
  const chosen = r.ops.filter(o => o.include);
  if (!chosen.length) { _mnToast('error', 'Nothing is ticked.'); return; }
  // October 2026: saving while the OneDrive folder is not connected only
  // keeps the items in this browser. Say so before it happens.
  if (!offlineOk && typeof hasFolderAccess === 'function' && !hasFolderAccess()) { _mnShowConnectPrompt(); return; }
  const btn = document.getElementById('mn-apply'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const backupMsg = await _mnBackup(r.text, r.parsed.header.ref);
  const undo = [];
  const meetingOp = chosen.find(o => o.kind === 'meeting');
  const meetingDate = (r.ops.find(o => o.kind === 'meeting') || {}).entity?.date || r.parsed.header.capturedDate || todayISO();

  // Reuse IDs of anything imported before, so links stay intact.
  const idMap = {};
  chosen.forEach(o => {
    const ex = _mnFindExisting(o);
    o._existing = ex ? JSON.parse(JSON.stringify(ex)) : null;
    if (ex && o.entity.entryId) idMap[o.entity.entryId] = ex.entryId;
    if (ex && o.entity.noteId) o.entity.noteId = ex.noteId;
    if (ex && o.entity.activityId) o.entity.activityId = ex.activityId;
  });
  const mapId = (id) => idMap[id] || id;
  const chosenTaskIds = chosen.filter(o => o.kind === 'action').map(o => o.entity.entryId);

  chosen.forEach(o => {
    const ent = o.entity;
    if (o.kind === 'meeting') {
      ent.actions = ent.actions.filter(act => chosenTaskIds.indexOf(act.linkedTaskId) >= 0)
        .map(act => ({ ...act, linkedTaskId: mapId(act.linkedTaskId) }));
      ent.entryId = mapId(ent.entryId);
      const merged = o._existing ? { ...o._existing, ...ent } : ent;
      saveCalendarEntry(merged);
      undo.push({ store: 'calendar', id: merged.entryId, prev: o._existing });
    } else if (o.kind === 'action' || o.kind === 'date') {
      if (o.kind === 'action') {
        if (!ent.date) ent.date = meetingDate;
        if (ent.sourceRef && ent.sourceRef.entryId) {
          if (meetingOp) ent.sourceRef = { ...ent.sourceRef, entryId: mapId(ent.sourceRef.entryId) };
          else { ent.source = 'notes-import'; ent.sourceRef = {}; }
        }
      }
      if (o.kind === 'date' && !ent.date) ent.date = meetingDate;
      ent.entryId = mapId(ent.entryId);
      // Keep progress made since the earlier import.
      const merged = o._existing ? { ...o._existing, ...ent, status: o._existing.status || ent.status, microTasks: o._existing.microTasks || ent.microTasks } : ent;
      saveCalendarEntry(merged);
      undo.push({ store: 'calendar', id: merged.entryId, prev: o._existing });
    } else if (o.kind === 'update') {
      const task = _mnCalendar().find(e => e.entryId === ent.entryId);
      if (!task) return;
      const prev = JSON.parse(JSON.stringify(task));
      const have = (task.microTasks || []).map(m => String(m.title).toLowerCase());
      const merged = { ...task, ...ent.changes,
        microTasks: (task.microTasks || []).concat(ent.addSteps.filter(m => have.indexOf(m.title.toLowerCase()) < 0)),
        updateImportIds: (task.updateImportIds || []).filter(x => x !== ent.importId).concat([ent.importId]) };
      saveCalendarEntry(merged);
      undo.push({ store: 'calendar', id: merged.entryId, prev });
    } else if (o.kind === 'note') {
      if (ent.linkedMeetingId) ent.linkedMeetingId = meetingOp ? mapId(ent.linkedMeetingId) : null;
      const merged = o._existing ? { ...o._existing, ...ent, createdAt: o._existing.createdAt } : { ...ent, createdAt: ent.createdAt || nowISO() };
      saveNote(merged);
      undo.push({ store: 'note', id: merged.noteId, prev: o._existing });
    } else if (o.kind === 'evidence') {
      if (o._existing) _mnRemoveActivity(o._existing.activityId);
      const act = { ...ent, createdAt: (o._existing && o._existing.createdAt) || nowISO() };
      saveActivity(act);
      undo.push({ store: 'activity', id: act.activityId, prev: o._existing });
      if (o.loopEvidence) {
        const afis = (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [];
        const loop = afis.find(x => x.afiId === o.loopEvidence.afiId);
        if (loop) {
          const before = JSON.parse(JSON.stringify(loop));
          loop.evidenceChain = (loop.evidenceChain || []).filter(ev => ev.importId !== ent.importId);
          loop.evidenceChain.push({ evidenceId: generateId(), evidenceType: (typeof EVIDENCE_TYPE !== 'undefined' ? EVIDENCE_TYPE.COACHING_NOTE : 'coaching-note'),
            date: act.date, summary: act.summary, sourceId: act.activityId, loopMovement: o.loopEvidence.loopMovement, importId: ent.importId });
          if (o.loopEvidence.loopMovement === 'closes' && typeof AFI_STATUS !== 'undefined') { loop.status = AFI_STATUS.CLOSED; loop.closedAt = nowISO(); }
          if (o.loopEvidence.loopMovement === 're-opens' && typeof AFI_STATUS !== 'undefined') loop.status = AFI_STATUS.REOPENED;
          saveAFI(loop);
          undo.push({ store: 'afi', id: loop.afiId, prev: before });
        }
      }
    }
  });

  if (typeof forceSaveNow === 'function' && typeof UI !== 'undefined') { try { await forceSaveNow(UI); } catch (e) { /* autosave will retry */ } }
  _mn.lastImport = { undo, ref: r.parsed.header.ref };
  if (r.source === 'form') { _mn.draft = _mnBlankDraft(); _mnClearDraft(); }
  _mnRenderDone(chosen, backupMsg, meetingOp ? mapId(meetingOp.entity.entryId) : null, r.source);
}

function _mnShowConnectPrompt() {
  const box = document.getElementById('mn-connect');
  if (!box) return;
  const keep = _mn.tab === 'paper' ? ' The pasted reply will need pasting again after the page reloads.' : '';
  box.innerHTML = `
    <div class="mn-callout" role="alert" tabindex="-1" id="mn-connect-box">
      <h3>Your OneDrive folder is not connected</h3>
      <p class="mn-hint" style="margin:0 0 8px;">Saving now keeps these items in this browser only. Reconnect first so they reach your folder. The Hub reloads to fetch your latest data, then brings you back here.${keep}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" id="mn-reconnect" class="btn btn--primary btn--sm">Reconnect the folder</button>
        <button type="button" id="mn-save-offline" class="btn btn--ghost btn--sm">Save in this browser only</button>
      </div>
    </div>`;
  document.getElementById('mn-reconnect').addEventListener('click', async () => {
    if (typeof requestStoredFolderPermission !== 'function' || !(await requestStoredFolderPermission())) {
      _mnToast('error', 'The folder could not be reconnected here. Use Settings to choose it again.');
      return;
    }
    try { sessionStorage.setItem('dpc-meeting-notes-return', _mn.tab); } catch (err) { /* lands on home instead */ }
    location.reload();
  });
  document.getElementById('mn-save-offline').addEventListener('click', () => _mnApply(null, true));
  document.getElementById('mn-connect-box').focus();
}

// Called once after the Hub loads: reopen the right tab after a reconnect.
function mnResumeAfterReconnect() {
  let tab = null;
  try { tab = sessionStorage.getItem('dpc-meeting-notes-return'); sessionStorage.removeItem('dpc-meeting-notes-return'); } catch (e) { return; }
  if (!tab || MN_TABS.indexOf(tab) < 0) return;
  _mn.tab = tab;
  if (typeof navigateTo === 'function') navigateTo('meetingnotes');
}

function _mnRenderDone(chosen, backupMsg, meetingId, source) {
  const counts = {};
  chosen.forEach(o => { const g = o.dest.indexOf('Area log') === 0 || o.dest === 'Cross-college activity' ? 'Evidence' : o.dest; counts[g] = (counts[g] || 0) + 1; });
  _mn.review = null;
  const panel = document.getElementById('mn-panel');
  panel.innerHTML = `
    <div class="mn-section">
      <h3 id="mn-done-h" tabindex="-1">Saved to the Hub</h3>
      <ul style="margin:0 0 var(--space-sm);padding-left:20px;">${Object.keys(counts).map(k => `<li>${_mnEsc(k)}: ${counts[k]}</li>`).join('')}</ul>
      <p class="mn-hint">${_mnEsc(backupMsg)}</p>
      <div class="mn-actions-bar">
        ${meetingId ? '<button type="button" id="mn-open-meeting" class="btn btn--primary btn--sm">Open the meeting</button>' : ''}
        ${source === 'claude' ? '<button type="button" id="mn-to-inbox" class="btn btn--secondary btn--sm">Back to the Claude inbox</button>' : ''}
        <button type="button" id="mn-new" class="btn btn--secondary btn--sm">Take new notes</button>
        <button type="button" id="mn-undo" class="btn btn--ghost btn--sm">Undo this import</button>
      </div>
    </div>`;
  document.getElementById('mn-open-meeting')?.addEventListener('click', () => { if (typeof openMeeting === 'function') openMeeting(meetingId); });
  document.getElementById('mn-new').addEventListener('click', () => _mnShowTab('write', false));
  document.getElementById('mn-to-inbox')?.addEventListener('click', () => { if (typeof _ci !== 'undefined') _ci.editing = null; _mnShowTab('claude', false); document.getElementById('mn-tab-claude')?.focus(); });
  document.getElementById('mn-undo').addEventListener('click', _mnUndo);
  document.getElementById('mn-done-h').focus();
  _mnToast('success', 'Notes saved to the Hub.');
}

async function _mnUndo() {
  const imp = _mn.lastImport;
  if (!imp) return;
  if (!confirm('Undo this import? Everything it added or changed goes back to how it was.')) return;
  imp.undo.slice().reverse().forEach(u => {
    if (u.store === 'calendar') { if (u.prev) saveCalendarEntry(u.prev); else deleteCalendarEntry(u.id); }
    else if (u.store === 'note') { if (u.prev) saveNote(u.prev); else deleteNote(u.id); }
    else if (u.store === 'activity') { _mnRemoveActivity(u.id); if (u.prev) { const p = { ...u.prev }; delete p.areaName; saveActivity(p); } }
    else if (u.store === 'afi') { const afis = window.DPC_DATA.afi.afis; const i = afis.findIndex(a => a.afiId === u.id); if (i >= 0) afis[i] = u.prev; saveAFI(u.prev); }
  });
  if (typeof forceSaveNow === 'function' && typeof UI !== 'undefined') { try { await forceSaveNow(UI); } catch (e) { /* autosave will retry */ } }
  _mn.lastImport = null;
  _mnToast('success', 'Import undone.');
  _mnShowTab('write', true);
}
