/* ================================================================
   myweek.js — DPC Hub
   My week report (October 2026).

   What I did in a period, who it reached and what it links to, by
   numbers where the data allows. Built for a weekly record of the
   role's impact on the quality of provision.

   Reads only what is already in the Hub:
     - activities (area logs and cross-college), including attendees
       on sessions delivered (notes import "Attended:" field)
     - meetings and tasks in the calendar
     - Current Focus titles, for what each piece of work links to
   Nothing is stored by this report. Optional reflection and next
   steps go into the Word file only.

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
      date: a.date, type: a.activityType, typeLabel: MW_TYPE_LABELS[a.activityType] || a.activityType || 'Activity',
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
    </style>
    <div class="report-preview">
      <h3>My week: ${_mwEsc(_mwDate(d.from))} to ${_mwEsc(_mwDate(d.to))}</h3>
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
          <thead><tr><th scope="col">Date</th><th scope="col">Where</th><th scope="col">What</th>${g.id === 'sessions' ? '<th scope="col">People</th>' : ''}</tr></thead>
          <tbody>${g.rows.map(r => `<tr><td>${_mwEsc(_mwDate(r.date))}</td><td>${_mwEsc(r.area || r.focus[0] || 'College-wide')}</td><td>${_mwEsc(r.summary)}</td>${g.id === 'sessions' ? `<td>${r.attendees == null ? 'Not recorded' : r.attendees}</td>` : ''}</tr>`).join('')}</tbody>
        </table>`).join('') : '<p class="ms-muted">Nothing logged in this period yet.</p>'}
      ${d.tasksDone.length ? `<h4 class="mw-h">Tasks completed (${d.tasksDone.length})</h4><ul>${d.tasksDone.map(t => `<li>${_mwEsc(t.title)}</li>`).join('')}</ul>` : ''}
      ${d.comingUp.length ? `<h4 class="mw-h">Coming up in the next seven days</h4><ul>${d.comingUp.map(e => `<li>${_mwEsc(_mwDate(e.date))}${e.startTime ? ' ' + _mwEsc(e.startTime) : ''}: ${_mwEsc(e.title)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function mwBuildWord(docx, opts) {
  const { Document, Paragraph, TextRun } = docx;
  const d = mwData(opts), n = d.numbers;
  const W = [1500, 1700, 5000, 1100];
  const kids = [
    _repDocTitle(docx, 'My week: Digital Pedagogy Coach'),
    _repDocPara(docx, `${_mwLongDate(d.from)} to ${_mwLongDate(d.to)}. Prepared ${_mwLongDate(todayISO())}.`, { italics: true, spacing: { after: 200 } }),
    _repDocSectionHeading(docx, 'This week in numbers'),
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
  _repDownloadDoc(docx, doc, `my-week-${d.from}.docx`);
}
