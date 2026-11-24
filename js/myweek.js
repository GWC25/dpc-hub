/* ================================================================
   myweek.js — DPC Hub
   My week report (October 2026). Period picker for this week, last
   week or the last fortnight added 13/10/26.

   What I did in a period, who it reached and what it links to, by
   numbers where the data allows. Built for a weekly record of the
   role's impact on the quality of provision.

   Reads only what is already in the Hub:
     - activities (area logs and cross-college), including attendees
       on sessions delivered (notes import "Attended:" field)
     - meetings and tasks in the calendar
     - Current Focus titles, for what each piece of work links to
   Optional reflection and next steps go into the Word file only.
   November 2026: each row has an Edit button. Edits write to the
   activity itself (updateActivity in data.js), so a correction made
   here shows everywhere the evidence is used.

   Word output follows the house rules for documents that leave the
   Hub: plain UK English, no dashes as punctuation, real table header
   rows, bullets from numbering, not typed characters.
   ================================================================ */

const MW_GROUPS = [
  { id: 'sessions', label: 'Training and sessions delivered', types: ['cpd-delivered', 'teach-meet'] },
  { id: 'coaching', label: 'Coaching and practice support', types: ['coaching', 'devobs', 'learning-walk', 'health-check-visit', 'work-review', 'referral'] },
  { id: 'meetings', label: 'Meetings', types: ['digital-lead-meeting', 'hoa-meeting', 'meeting', 'tlam-meeting'] },
  { id: 'quality', label: 'Quality processes', types: ['ppr', 'cqrp', 'qra', 'peer-review', 'self-review', 'qip-review', 'sar-contribution', 'securing-improvement'] },
  { id: 'resources', label: 'Resources created', types: ['resource-created'] },
];
const MW_TYPE_LABELS = {
  'cpd-delivered': 'Training delivered', 'teach-meet': 'TeachMeet', 'coaching': 'Coaching', 'devobs': 'Instructional coaching',
  'learning-walk': 'Learning walk', 'health-check-visit': 'Health Check visit', 'work-review': 'Work review', 'referral': 'Referral',
  'digital-lead-meeting': 'Digital Lead meeting', 'hoa-meeting': 'Head of Area meeting', 'meeting': 'Meeting', 'tlam-meeting': 'TLAM meeting',
  'ppr': 'PPR', 'cqrp': 'CQRP', 'qra': 'QRA', 'peer-review': 'Peer review', 'self-review': 'Self review', 'qip-review': 'QIP',
  'sar-contribution': 'SAR contribution', 'securing-improvement': 'Securing improvement', 'resource-created': 'Resource created',
};

function _mwEsc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _mwIn(iso, from, to) { const d = String(iso || '').slice(0, 10); return !!d && (!from || d >= from) && (!to || d <= to); }
function _mwDate(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function _mwLongDate(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function _mwAddDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
// Swap dashes used as punctuation for plain words or commas.
function _mwPlain(s) { return String(s || '').replace(/\s+[–—-]\s+/g, ', ').replace(/[–—]/g, ' to '); }

// Monday of this week. On a weekend, still this week's Monday.
function mwDefaultFrom() {
  const d = new Date(todayISO() + 'T12:00:00');
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
}

// Period presets for the My week report. "This week" runs Monday to
// today, "Last week" is the full Monday to Sunday before it, and
// "Last fortnight" is last Monday through to today, so last week can
// be seen alongside this one.
function mwPeriodRange(period) {
  const mon = mwDefaultFrom(), today = todayISO();
  if (period === 'last-week') return { from: _mwAddDays(mon, -7), to: _mwAddDays(mon, -1) };
  if (period === 'fortnight') return { from: _mwAddDays(mon, -7), to: today };
  return { from: mon, to: today };
}

function mwPeriodPicker() {
  const opt = (v, label, checked) => `<label style="display:inline-flex;align-items:center;gap:6px;margin:0 16px 6px 0;font-size:var(--text-sm);min-height:24px;">
      <input type="radio" name="rep-mw-period" value="${v}"${checked ? ' checked' : ''}> ${label}</label>`;
  return `<fieldset style="border:0;padding:0;margin:0 0 var(--space-sm);">
      <legend class="form-label">Period</legend>
      ${opt('this-week', 'This week', true)}${opt('last-week', 'Last week', false)}${opt('fortnight', 'Last fortnight', false)}${opt('custom', 'Custom dates', false)}
    </fieldset>`;
}

// Bind before the live preview listeners so the dates are set first.
function mwWirePeriod() {
  const from = document.getElementById('rep-from'), to = document.getElementById('rep-to');
  if (!from || !to) return;
  document.querySelectorAll('input[name="rep-mw-period"]').forEach(r => r.addEventListener('input', () => {
    if (!r.checked || r.value === 'custom') return;
    const range = mwPeriodRange(r.value);
    from.value = range.from; to.value = range.to;
  }));
  const toCustom = () => { const c = document.querySelector('input[name="rep-mw-period"][value="custom"]'); if (c) c.checked = true; };
  from.addEventListener('input', toCustom); to.addEventListener('input', toCustom);
}

// Name for the period: a week, a fortnight, or a span of dates.
function _mwSpanLabel(from, to) {
  const days = Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;
  return days <= 7 ? 'week' : days <= 14 ? 'fortnight' : 'period';
}

function mwData(opts) {
  const from = opts.dateFrom, to = opts.dateTo;
  const focuses = (window.DPC_DATA.currentFocus && window.DPC_DATA.currentFocus.focuses) || [];
  const focusTitle = (id) => { const f = focuses.find(x => x.focusId === id); return f ? (f.title || 'Untitled focus') : null; };
  const cal = (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [];
  const acts = (typeof getAllActivities === 'function' ? getAllActivities() : [])
    .filter(a => _mwIn(a.date, from, to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const rows = acts.map(a => {
    const fids = (a.links || []).filter(l => l && l.type === 'focus').map(l => l.id);
    const meeting = a.importId ? cal.find(e => e.importId && e.entryType === 'meeting' && e.importId.split(':')[0] === a.importId.split(':')[0]) : null;
    if (meeting && meeting.linkedFocusId && fids.indexOf(meeting.linkedFocusId) < 0) fids.push(meeting.linkedFocusId);
    return {
      id: a.activityId || '', date: a.date, type: a.activityType, typeLabel: MW_TYPE_LABELS[a.activityType] || a.activityType || 'Activity',
      area: a.areaCode || '', focus: fids.map(focusTitle).filter(Boolean),
      summary: a.summary || '', attendees: Number.isFinite(a.attendees) ? a.attendees : null,
    };
  });

  const groups = MW_GROUPS.map(g => ({ ...g, rows: rows.filter(r => g.types.indexOf(r.type) >= 0) }));
  const known = [].concat(...MW_GROUPS.map(g => g.types));
  const other = rows.filter(r => known.indexOf(r.type) < 0);
  if (other.length) groups.push({ id: 'other', label: 'Other activity', rows: other });

  const sessions = groups.find(g => g.id === 'sessions').rows;
  const counted = sessions.filter(r => r.attendees != null);
  const areas = [...new Set(rows.map(r => r.area).filter(Boolean))].sort();
  const focusCounts = {};
  rows.forEach(r => r.focus.forEach(t => { focusCounts[t] = (focusCounts[t] || 0) + 1; }));

  const tasksDone = cal.filter(e => e.entryType === 'task' && e.status === 'complete' && _mwIn(e.date, from, to));
  const nextFrom = _mwAddDays(to, 1), nextTo = _mwAddDays(to, 7);
  const comingUp = cal.filter(e => e.entryType !== 'task' || e.status !== 'complete')
    .filter(e => _mwIn(e.date, nextFrom, nextTo))
    .sort((a, b) => (String(a.date) + (a.startTime || '')).localeCompare(String(b.date) + (b.startTime || '')));

  return {
    from, to, rows, groups: groups.filter(g => g.rows.length), areas, focusCounts, tasksDone, comingUp,
    numbers: {
      sessions: sessions.length,
      trained: counted.reduce((n, r) => n + r.attendees, 0),
      sessionsWithoutCount: sessions.length - counted.length,
      meetings: groups.find(g => g.id === 'meetings').rows.length,
      coaching: groups.find(g => g.id === 'coaching').rows.length,
      areas: areas.length,
      activities: rows.length,
    },
  };
}

function _mwShort(s) { s = String(s || ''); return s.length > 60 ? s.slice(0, 60) + '...' : s; }

function _mwStat(value, label) {
  return `<div class="mw-stat"><span class="mw-stat__n">${_mwEsc(value)}</span><span class="mw-stat__l">${_mwEsc(label)}</span></div>`;
}

function mwRenderReport(opts) {
  const d = mwData(opts), n = d.numbers;
  const focusList = Object.keys(d.focusCounts);
  return `
    <style>
      .mw-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin:0 0 var(--space-md); }
      .mw-stat { border:1px solid var(--color-border); border-radius:var(--radius-md); padding:10px 12px; background:var(--color-white); }
      .mw-stat__n { display:block; font-size:var(--text-2xl); font-weight:700; color:var(--color-navy); line-height:1.1; }
      .mw-stat__l { display:block; font-size:var(--text-sm); color:var(--color-slate); }
      .mw-table { width:100%; border-collapse:collapse; margin:4px 0 var(--space-md); font-size:var(--text-sm); }
      .mw-table th, .mw-table td { text-align:left; vertical-align:top; padding:6px 8px; border-bottom:1px solid var(--color-border); }
      .mw-table th { color:var(--color-navy); }
      .mw-h { font-size:var(--text-base); color:var(--color-navy); margin:var(--space-md) 0 4px; }
      .mw-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      .mw-form { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px 12px; padding:12px; border:2px solid var(--color-navy); border-radius:var(--radius-md); background:var(--color-white); }
      .mw-form__wide { grid-column:1 / -1; }
      .mw-form textarea { min-height:7em; width:100%; }
      .mw-form__btns { grid-column:1 / -1; display:flex; gap:8px; flex-wrap:wrap; }
      .mw-form__err { grid-column:1 / -1; color:#8a1c1c; font-weight:700; margin:0; }
      .mw-form__note { grid-column:1 / -1; font-size:var(--text-sm); color:var(--color-slate); margin:0; }
    </style>
    <div class="report-preview">
      <p id="mw-edit-status" class="mw-sr" role="status" aria-live="polite"></p>
      <p class="ms-muted">Spotted something missing or wrong? Use Edit on any row. Changes save to the evidence itself, so the Hub and this report both update.</p>
      <h3>My ${_mwSpanLabel(d.from, d.to)}: ${_mwEsc(_mwDate(d.from))} to ${_mwEsc(_mwDate(d.to))}</h3>
      <div class="mw-stats" role="list" aria-label="This period in numbers">
        <div role="listitem">${_mwStat(n.sessions, n.sessions === 1 ? 'session delivered' : 'sessions delivered')}</div>
        <div role="listitem">${_mwStat(n.trained, n.trained === 1 ? 'person trained' : 'people trained')}</div>
        <div role="listitem">${_mwStat(n.meetings, n.meetings === 1 ? 'meeting' : 'meetings')}</div>
        <div role="listitem">${_mwStat(n.coaching, 'coaching and support')}</div>
        <div role="listitem">${_mwStat(n.areas, n.areas === 1 ? 'area reached' : 'areas reached')}</div>
      </div>
      ${n.sessionsWithoutCount ? `<p class="ms-muted">${n.sessionsWithoutCount} session${n.sessionsWithoutCount === 1 ? ' has' : 's have'} no attendance number, so ${n.sessionsWithoutCount === 1 ? 'it is' : 'they are'} not in the people trained figure.</p>` : ''}
      ${d.areas.length ? `<p><strong>Areas:</strong> ${d.areas.map(_mwEsc).join(', ')}</p>` : ''}
      ${focusList.length ? `<p><strong>Linked to:</strong> ${focusList.map(t => _mwEsc(t) + ' (' + d.focusCounts[t] + ')').join('; ')}</p>` : ''}
      ${d.groups.length ? d.groups.map(g => `
        <h4 class="mw-h">${_mwEsc(g.label)} (${g.rows.length})</h4>
        <table class="mw-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Where</th><th scope="col">What</th>${g.id === 'sessions' ? '<th scope="col">People</th>' : ''}<th scope="col"><span class="mw-sr">Edit</span></th></tr></thead>
          <tbody>${g.rows.map(r => `<tr data-mw-row="${_mwEsc(r.id)}"><td>${_mwEsc(_mwDate(r.date))}</td><td>${_mwEsc(r.area || r.focus[0] || 'College-wide')}</td><td>${_mwEsc(r.summary)}</td>${g.id === 'sessions' ? `<td>${r.attendees == null ? 'Not recorded' : r.attendees}</td>` : ''}<td>${r.id ? `<button type="button" class="btn btn--ghost btn--sm mw-edit" data-mw-edit="${_mwEsc(r.id)}" data-mw-cols="${g.id === 'sessions' ? 5 : 4}" aria-label="Edit ${_mwEsc(_mwDate(r.date))}: ${_mwEsc(_mwShort(r.summary))}">Edit</button>` : ''}</td></tr>`).join('')}</tbody>
        </table>`).join('') : '<p class="ms-muted">Nothing logged in this period yet.</p>'}
      ${d.tasksDone.length ? `<h4 class="mw-h">Tasks completed (${d.tasksDone.length})</h4><ul>${d.tasksDone.map(t => `<li>${_mwEsc(t.title)}</li>`).join('')}</ul>` : ''}
      ${d.comingUp.length ? `<h4 class="mw-h">Coming up in the next seven days</h4><ul>${d.comingUp.map(e => `<li>${_mwEsc(_mwDate(e.date))}${e.startTime ? ' ' + _mwEsc(e.startTime) : ''}: ${_mwEsc(e.title)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function mwBuildWord(docx, opts) {
  const { Document, Paragraph, TextRun } = docx;
  const d = mwData(opts), n = d.numbers;
  const W = [1500, 1700, 5000, 1100];
  const span = _mwSpanLabel(d.from, d.to);
  const kids = [
    _repDocTitle(docx, `My ${span}: Digital Pedagogy Coach`),
    _repDocPara(docx, `${_mwLongDate(d.from)} to ${_mwLongDate(d.to)}. Prepared ${_mwLongDate(todayISO())}.`, { italics: true, spacing: { after: 200 } }),
    _repDocSectionHeading(docx, `This ${span} in numbers`),
    _repDocTable(docx, ['Measure', 'Number'], [
      ['Training sessions delivered', String(n.sessions)],
      ['People trained', String(n.trained) + (n.sessionsWithoutCount ? ` (${n.sessionsWithoutCount} session${n.sessionsWithoutCount === 1 ? '' : 's'} without a count)` : '')],
      ['Meetings', String(n.meetings)],
      ['Coaching and practice support', String(n.coaching)],
      ['Curriculum areas reached', String(n.areas) + (d.areas.length ? ` (${d.areas.join(', ')})` : '')],
    ], [6000, 3300]),
  ];
  const focusList = Object.keys(d.focusCounts);
  if (focusList.length) {
    kids.push(_repDocSectionHeading(docx, 'What the work links to'));
    kids.push(..._repDocBullets(docx, focusList.map(t => `${_mwPlain(t)}: ${d.focusCounts[t]} piece${d.focusCounts[t] === 1 ? '' : 's'} of work`)));
  }
  if (opts.impact) { kids.push(_repDocSectionHeading(docx, 'Impact and what is changing')); opts.impact.split(/\n+/).filter(Boolean).forEach(p => kids.push(_repDocPara(docx, _mwPlain(p)))); }
  d.groups.forEach(g => {
    kids.push(_repDocSectionHeading(docx, `${g.label} (${g.rows.length})`));
    const sessions = g.id === 'sessions';
    kids.push(_repDocTable(docx, sessions ? ['Date', 'Where', 'What', 'People'] : ['Date', 'Where', 'What'],
      g.rows.map(r => {
        const row = [_mwDate(r.date), _mwPlain(r.area || r.focus[0] || 'College-wide'), _mwPlain(r.summary)];
        if (sessions) row.push(r.attendees == null ? 'Not recorded' : String(r.attendees));
        return row;
      }), sessions ? W : [1500, 1700, 6100]));
  });
  if (!d.groups.length) kids.push(_repDocPara(docx, 'Nothing was logged in the Hub for this period.'));
  if (d.tasksDone.length) { kids.push(_repDocSectionHeading(docx, `Tasks completed (${d.tasksDone.length})`)); kids.push(..._repDocBullets(docx, d.tasksDone.map(t => _mwPlain(t.title)))); }
  if (d.comingUp.length || opts.next) {
    kids.push(_repDocSectionHeading(docx, 'Coming up'));
    if (d.comingUp.length) kids.push(..._repDocBullets(docx, d.comingUp.map(e => `${_mwDate(e.date)}${e.startTime ? ' at ' + e.startTime : ''}: ${_mwPlain(e.title)}`)));
    if (opts.next) opts.next.split(/\n+/).filter(Boolean).forEach(p => kids.push(_repDocPara(docx, _mwPlain(p))));
  }
  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: kids }],
    numbering: _repDocNumberingConfig(docx),
    styles: { default: { document: { run: { font: 'Arial', size: 24 }, paragraph: { spacing: { line: 360 } } } } },
  });
  _repDownloadDoc(docx, doc, `my-${span}-${d.from}.docx`);
}

// ── Editing from the preview (November 2026) ───────────────────
// Each row's Edit button opens a form under it. Saving writes to the
// activity itself through updateActivity() in data.js, then redraws the
// preview so the figures, areas and Word file all follow.
function mwWireEdit(body) {
  if (!body || body._mwWired) return;
  body._mwWired = true;
  body.addEventListener('click', (ev) => {
    const edit = ev.target.closest('[data-mw-edit]');
    if (edit) { _mwOpenEdit(edit); return; }
    const btn = ev.target.closest('[data-mw-act]');
    if (!btn) return;
    const form = btn.closest('form.mw-form');
    if (btn.dataset.mwAct === 'cancel') _mwCloseEdit(form, true);
  });
  body.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form.mw-form');
    if (!form) return;
    ev.preventDefault();
    _mwSaveEdit(form);
  });
  body.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const form = ev.target.closest && ev.target.closest('form.mw-form');
    if (form) { ev.preventDefault(); _mwCloseEdit(form, true); }
  });
}

function _mwOpenEdit(btn) {
  const id = btn.dataset.mwEdit;
  const row = btn.closest('tr');
  const body = btn.closest('.report-preview') || document;
  body.querySelectorAll('tr.mw-edit-row').forEach(r => { const f = r.querySelector('form'); if (f) _mwCloseEdit(f, false); });
  const a = (typeof getAllActivities === 'function' ? getAllActivities() : []).find(x => x.activityId === id);
  if (!a || !row) return;
  const areas = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).slice()
    .sort((x, y) => String(x.areaCode).localeCompare(String(y.areaCode)));
  const labels = (typeof ACTIVITY_TYPE_LABELS !== 'undefined') ? ACTIVITY_TYPE_LABELS : MW_TYPE_LABELS;
  const types = Object.keys(labels);
  if (a.activityType && types.indexOf(a.activityType) < 0) types.push(a.activityType);
  const f = 'mw-f-' + id.replace(/[^A-Za-z0-9_-]/g, '');
  const opt = (v, t, sel) => `<option value="${_mwEsc(v)}"${sel ? ' selected' : ''}>${_mwEsc(t)}</option>`;
  const tr = document.createElement('tr');
  tr.className = 'mw-edit-row';
  tr.innerHTML = `<td colspan="${Number(btn.dataset.mwCols) || 5}">
    <form class="mw-form" data-mw-id="${_mwEsc(id)}" aria-labelledby="${f}-h" novalidate>
      <h5 id="${f}-h" class="mw-form__wide" style="margin:0;color:var(--color-navy);">Edit this evidence</h5>
      <div><label class="form-label" for="${f}-date">Date</label>
        <input class="form-input" type="date" id="${f}-date" name="date" required value="${_mwEsc(String(a.date || '').slice(0, 10))}"></div>
      <div><label class="form-label" for="${f}-area">Area</label>
        <select class="form-input" id="${f}-area" name="area">
          ${opt('', 'College-wide (no area)', !a.areaCode)}
          ${areas.map(x => opt(x.areaCode, x.areaCode + ' ' + (x.areaName || ''), x.areaCode === a.areaCode)).join('')}
        </select></div>
      <div><label class="form-label" for="${f}-type">Type</label>
        <select class="form-input" id="${f}-type" name="type">
          ${types.map(t => opt(t, labels[t] || t, t === a.activityType)).join('')}
        </select></div>
      <div><label class="form-label" for="${f}-people">People attended</label>
        <input class="form-input" type="number" inputmode="numeric" min="0" max="9999" step="1" id="${f}-people" name="people" aria-describedby="${f}-people-hint" value="${Number.isFinite(a.attendees) ? a.attendees : ''}">
        <span id="${f}-people-hint" class="ms-muted" style="font-size:var(--text-sm);">Leave blank if not recorded. Counts towards people trained on sessions delivered.</span></div>
      <div class="mw-form__wide"><label class="form-label" for="${f}-what">What</label>
        <textarea class="form-input" id="${f}-what" name="what" required>${_mwEsc(a.summary || '')}</textarea></div>
      <p class="mw-form__err" id="${f}-err" role="alert" hidden></p>
      ${a.importId ? '<p class="mw-form__note">This came from imported notes. If you save the same notes again from the inbox, they will replace this edit.</p>' : ''}
      <div class="mw-form__btns">
        <button type="submit" class="btn btn--primary btn--sm">Save changes</button>
        <button type="button" class="btn btn--ghost btn--sm" data-mw-act="cancel">Cancel</button>
      </div>
    </form></td>`;
  row.after(tr);
  btn.setAttribute('aria-expanded', 'true');
  tr.querySelector('input,select,textarea').focus();
}

function _mwCloseEdit(form, refocus) {
  if (!form) return;
  const id = form.dataset.mwId;
  const tr = form.closest('tr.mw-edit-row');
  const scope = (tr && tr.closest('.report-preview')) || document;
  if (tr) tr.remove();
  const btn = [...scope.querySelectorAll('[data-mw-edit]')].find(b => b.dataset.mwEdit === id);
  if (btn) { btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
}

async function _mwSaveEdit(form) {
  const id = form.dataset.mwId;
  const v = (n) => (form.elements[n] ? form.elements[n].value : '');
  const err = form.querySelector('.mw-form__err');
  const fail = (msg, field) => {
    err.textContent = msg; err.hidden = false;
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    if (field && form.elements[field]) { form.elements[field].setAttribute('aria-invalid', 'true'); form.elements[field].focus(); }
  };
  const date = v('date').trim(), what = v('what').trim(), people = v('people').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Enter a date.', 'date');
  if (!what) return fail('Enter what happened.', 'what');
  const pf = form.elements.people;
  if (pf && pf.validity && pf.validity.badInput) return fail('People attended must be a whole number, or blank.', 'people');
  if (people && !/^\d{1,4}$/.test(people)) return fail('People attended must be a whole number, or blank.', 'people');
  if (typeof updateActivity !== 'function') return fail('Saving is not available. Reload the Hub and try again.');
  const rec = updateActivity(id, { date, areaCode: v('area'), activityType: v('type'), summary: what, attendees: people === '' ? null : Number(people) });
  if (!rec) return fail('This evidence could not be found. It may have been deleted. Reload the report.');
  if (typeof forceSaveNow === 'function' && typeof UI !== 'undefined') { try { await forceSaveNow(UI); } catch (e) { /* autosave will retry */ } }
  if (typeof _repRenderPreview === 'function') _repRenderPreview();
  const scope = document.getElementById('rep-preview-body') || document;
  const status = scope.querySelector('#mw-edit-status');
  if (status) setTimeout(() => { status.textContent = 'Saved. The report has been updated.'; }, 150);
  const btn = [...scope.querySelectorAll('[data-mw-edit]')].find(b => b.dataset.mwEdit === id);
  if (btn) btn.focus();
  else { const h = scope.querySelector('.report-preview h3'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
}
