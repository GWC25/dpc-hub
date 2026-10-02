// DPC Hub · js/milestones.js · v1.0 · 02/10/26 · Session RAG-2 — Milestone Impact Report (on screen, Word, Excel) with frozen milestone snapshots
// Reports the position "as at" each milestone (March 2026 start, end of
// July, today, 23 October, end of Terms 2, 4 and 6) plus what was done in
// a chosen period (default: the last fortnight).
//
// Every figure is rebuilt from dated records, so any past date can be
// reported: Health Checks by review date, loops by raised and closed
// dates, recorded RAG from ragSnapshots, Digital Lead 1:1s, activity,
// CPD and action plans by their dates. A milestone can be FROZEN: its
// figures are saved to data-milestones.json so later edits or late
// imports never quietly change a number already reported. Frozen columns
// say so and show when they were frozen.
//
// Sources added for this report (v1.0, same session): staff confidence
// from the Accessibility Confidence Check Form (confidence-import.js,
// data-confidence.json), the Teach Meet register and satisfaction on CPD
// delivered (cpd.js), and the "shared with Digital Lead" date on action
// plans (data.js). Rows show "Not yet collected" until there is data.
//
// Exports: MS_MILESTONES, msComputeMetrics(asOf), msColumns(),
//          msRenderReport(opts), msBuildWord(docx, opts),
//          msExportWorkbook(opts), msFreeze(columnId), msSaveCheckpoint()

const MS_MILESTONES = Object.freeze([
  { id: 'start-mar-2026', label: 'March 2026 (start)', date: '2026-03-31' },
  { id: 'end-jul-2026',   label: 'End of July 2026',   date: '2026-07-31' },
  { id: 'dai-day-2026',   label: '23 Oct 2026 (DA&I Day)', date: '2026-10-23' },
  // Term ends from the 2026/27 college calendar (data/quality-calendar-2627.json):
  { id: 'end-term-2',     label: 'End of Term 2',      date: '2026-12-18' },
  { id: 'end-term-4',     label: 'End of Term 4',      date: '2027-03-26' },
  { id: 'end-term-6',     label: 'End of Term 6',      date: '2027-07-09' },
]);

// Learning walk themes that count as an accessibility and inclusion
// concern when listed as an area for development (LRA taxonomy ids):
// Accessible Resources, Accessible Resources (Digital), Digital Learning
// Environment.
const MS_AI_LW_THEMES = Object.freeze(['AR', 'ARD', 'LED']);

// ── Helpers ───────────────────────────────────────────────────
function _msEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _msDay(iso) { return iso ? String(iso).slice(0, 10) : ''; }
function _msBy(iso, asOf) { const d = _msDay(iso); return !!d && d <= asOf; }
function _msIn(iso, from, to) { const d = _msDay(iso); return !!d && d >= from && d <= to; }
function _msFmt(iso) {
  if (!iso) return '';
  try { return new Date(_msDay(iso) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return String(iso); }
}
function _msShort(iso) {
  try { return new Date(_msDay(iso) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return String(iso); }
}
function _msAvg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function _ms2(x) { return x == null ? '' : (Math.round(x * 100) / 100).toFixed(2); }
function _msPct(x) { return x == null ? '' : Math.round(x * 100) + '%'; }

function _msAreas()   { return (typeof _getAreas === 'function' ? _getAreas() : ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [])) || []; }
function _msReviews() { return (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || []; }
function _msAFIs()    { return ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => typeof isGapAFI !== 'function' || isGapAFI(a)); }
function _msDLs()     { return (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads) || []; }
function _msPlans()   { return (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || []; }
function _msCal()     { return (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []; }
function _msCPD() {
  const c = window.DPC_DATA.cpd || {};
  return c.deliveredCPD || (c.cpd && c.cpd.deliveredCPD) || [];
}
function _msActivities() { return typeof getAllActivities === 'function' ? getAllActivities() : []; }
function _msConfidence() { return (window.DPC_DATA.confidence && window.DPC_DATA.confidence.responses) || []; }
function _msSnapshots() { return (window.DPC_DATA.milestones && window.DPC_DATA.milestones.snapshots) || []; }

function _msIsTeachMeet(c) { return c.type === 'teach-meet' || /teach\s*-?\s*meet/i.test(c.title || ''); }
function _msLWThemes(lw) {
  const list = (lw.lra && lw.lra.areasForDevelopment) || lw.lraThemeIds || [];
  return list.map(x => (typeof x === 'string' ? x : (x && (x.themeId || x.id)) || '')).filter(Boolean);
}

// Latest review per staff member by asOf, with that person's average.
function _msLatestPerStaff(asOf, areaCode) {
  const by = {};
  _msReviews().forEach(r => {
    if (!_msBy(r.date, asOf)) return;
    if (areaCode && r.areaCode !== areaCode) return;
    const k = r.staffId || r.reviewId;
    if (!by[k] || String(r.date) > String(by[k].date)) by[k] = r;
  });
  return Object.values(by);
}
function _msReviewAvg(r) {
  return _msAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null));
}

// ── Measures as at a date ─────────────────────────────────────
function msComputeMetrics(asOf) {
  const areas = _msAreas();
  const reviews = _msReviews().filter(r => _msBy(r.date, asOf));
  const latest = _msLatestPerStaff(asOf);
  const staffAvgs = latest.map(_msReviewAvg).filter(v => v != null);
  let scored = 0, low = 0;
  latest.forEach(r => Object.values(r.domains || {}).forEach(d => Object.values(d.indicatorScores || {}).forEach(v => {
    if (typeof v === 'number') { scored++; if (v <= 2) low++; }
  })));
  const areasWithHC = new Set(reviews.map(r => r.areaCode)).size;

  // Staff reviewed more than once, and the change first to latest.
  const perStaff = {};
  reviews.forEach(r => { const k = r.staffId || r.reviewId; (perStaff[k] = perStaff[k] || []).push(r); });
  const repeats = Object.values(perStaff).filter(l => l.length > 1).map(l => {
    l.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const a = _msReviewAvg(l[0]), b = _msReviewAvg(l[l.length - 1]);
    return a != null && b != null ? b - a : null;
  }).filter(v => v != null);

  // RAG
  const sugg = typeof getAllAreaEvidenceRAG === 'function' ? getAllAreaEvidenceRAG(asOf) : [];
  const bands = { red: 0, amber: 0, green: 0 };
  sugg.forEach(r => { bands[r.band]++; });
  const recAI = areas.map(a => {
    const dims = typeof _evDimsAsOf === 'function' ? _evDimsAsOf(a, asOf) : (a.ragDimensions || {});
    return dims.accessibilityInclusion && dims.accessibilityInclusion.score;
  }).filter(v => typeof v === 'number');

  // CPD and Teach Meets
  const cpd = _msCPD().filter(c => _msBy(c.date, asOf));
  const tms = cpd.filter(_msIsTeachMeet);
  const tmActs = _msActivities().filter(a => a.activityType === 'teach-meet' && _msBy(a.date, asOf));
  const tmAttendees = tms.reduce((s, c) => s + (Array.isArray(c.register) ? c.register.length : (c.attendees || 0)), 0);
  const tmSat = tms.map(c => c.satisfactionAvg).filter(v => typeof v === 'number');
  const tmFeedback = tms.reduce((s, c) => s + (c.feedbackCount || 0), 0);
  const tmAreas = new Set(tms.flatMap(c => (c.register || []).map(p => p.areaCode).filter(Boolean)));

  // Staff confidence (Phase 3 import): latest response per person by asOf.
  const confBy = {};
  _msConfidence().forEach(c => { if (_msBy(c.date, asOf)) { const k = (c.email || c.name || c.responseId || '').toLowerCase(); if (!confBy[k] || c.date > confBy[k].date) confBy[k] = c; } });
  const confLatest = Object.values(confBy);
  const confAvg = _msAvg(confLatest.map(c => c.overall).filter(v => typeof v === 'number'));
  const confWcag = _msAvg(confLatest.map(c => c.wcag).filter(v => typeof v === 'number'));
  const confChecker = _msAvg(confLatest.map(c => c.checker).filter(v => typeof v === 'number'));

  // Learning walks
  const lws = _msActivities().filter(a => a.activityType === 'learning-walk' && a.status !== 'draft' && _msBy(a.date, asOf));
  const lwAI = lws.filter(lw => _msLWThemes(lw).some(t => MS_AI_LW_THEMES.includes(t)));

  // Loops
  const afis = _msAFIs();
  const raised = afis.filter(a => _msBy(a.createdAt, asOf));
  const closed = raised.filter(a => a.status === 'closed' && a.closedAt && _msBy(a.closedAt, asOf));
  const open = raised.length - closed.length;
  const closeDays = closed.map(a => (new Date(_msDay(a.closedAt)) - new Date(_msDay(a.createdAt))) / 86400000).filter(v => v >= 0);

  // Digital Leads
  const dls = _msDLs();
  const dlMeetings = dls.reduce((s, d) => s + (d.meetingHistory || []).filter(m => _msBy(m.date || m.createdAt, asOf)).length, 0)
    + _msActivities().filter(a => a.activityType === 'digital-lead-meeting' && _msBy(a.date, asOf)).length;

  // Action plans
  const plans = _msPlans().filter(p => _msBy(p.createdAt, asOf));
  const planDone = p => p.status === 'complete' && p.closureReport && _msBy(p.closureReport.closedAt, asOf);
  const plansOpen = plans.filter(p => !planDone(p));
  const plansShared = plans.filter(p => p.sharedWithDLAt && _msBy(p.sharedWithDLAt, asOf));

  // Support priority (Copilot method, support-priority.js) as at asOf.
  const sp = typeof hcSupportAnalysis === 'function' ? hcSupportAnalysis(asOf) : null;
  const spStaffAvg = sp && sp.staff.length ? _msAvg(sp.staff.map(s => s.priority)) : null;
  const spUrgent = sp ? sp.staff.filter(s => s.priority >= 5).length : 0;
  const spUrgentAreas = sp ? sp.areas.filter(a => a.priority >= 5).length : 0;
  const v = (value, display, note) => ({ value, display: display == null ? String(value) : display, note: note || '' });
  return {
    hcReviews:   v(reviews.length),
    hcStaff:     v(latest.length),
    hcAvg:       v(_msAvg(staffAvgs), staffAvgs.length ? _ms2(_msAvg(staffAvgs)) : 'None'),
    hcAreas:     v(areasWithHC, `${areasWithHC} of ${areas.length}`),
    hcLow:       v(scored ? low / scored : null, scored ? _msPct(low / scored) : 'None'),
    spAvg:       v(spStaffAvg, spStaffAvg != null ? `${_ms2(spStaffAvg)} of 7` : 'None'),
    spUrgent:    v(spUrgent, sp && sp.staff.length ? `${spUrgent} staff, ${spUrgentAreas} areas` : 'None'),
    hcRepeat:    v(repeats.length, repeats.length ? `${repeats.length} (avg change ${repeats.length ? (_msAvg(repeats) >= 0 ? '+' : '') + _ms2(_msAvg(repeats)) : ''})` : '0'),
    ragBands:    v(bands, `${bands.red} Red, ${bands.amber} Amber, ${bands.green} Green`),
    ragAILow:    v(recAI.filter(s => s <= 2).length, `${recAI.filter(s => s <= 2).length} of ${recAI.length} scored`),
    ragAIAvg:    v(_msAvg(recAI), recAI.length ? _ms2(_msAvg(recAI)) : 'None'),
    teachMeets:  v(tms.length + tmActs.length, `${tms.length + tmActs.length}${tmAttendees ? ` (${tmAttendees} attending)` : ''}`),
    tmSat:       v(_msAvg(tmSat), tmSat.length ? `${_ms2(_msAvg(tmSat))} of 5${tmFeedback ? ` (${tmFeedback} responses)` : ''}` : 'Not yet collected'),
    tmAreas:     v(tmAreas.size, tms.some(c => (c.register || []).length) ? `${tmAreas.size} of ${areas.length}` : 'Not yet recorded'),
    cpd:         v(cpd.length),
    confN:       v(confLatest.length, confLatest.length ? String(confLatest.length) : 'Not yet collected'),
    confAvg:     v(confAvg, confAvg != null ? `${_ms2(confAvg)} of 5` : 'Not yet collected'),
    confWcag:    v(confWcag, confWcag != null ? `${_ms2(confWcag)} of 5` : 'Not yet collected'),
    confChecker: v(confChecker, confChecker != null ? `${_ms2(confChecker)} of 5` : 'Not yet collected'),
    lwTotal:     v(lws.length),
    lwAI:        v(lwAI.length),
    loopsRaised: v(raised.length),
    loopsOpen:   v(open),
    loopsClosed: v(closed.length, closed.length ? `${closed.length}${closeDays.length ? ` (avg ${Math.round(_msAvg(closeDays))} days)` : ''}` : '0'),
    dlCount:     v(dls.length),
    dlMeetings:  v(dlMeetings),
    apOpen:      v(plansOpen.length),
    apDone:      v(plans.length - plansOpen.length),
    apShared:    v(plansShared.length, plans.some(p => 'sharedWithDLAt' in p) || plansShared.length ? String(plansShared.length) : 'Not yet recorded'),
  };
}

const MS_ROWS = Object.freeze([
  { group: 'Accessibility and Inclusion reviews (Health Checks)' },
  { key: 'hcReviews', label: 'Health Checks completed' },
  { key: 'hcStaff',   label: 'Staff reviewed' },
  { key: 'hcAvg',     label: 'College average practice rating (1 to 5)' },
  { key: 'hcAreas',   label: 'Areas with at least one Health Check' },
  { key: 'hcLow',     label: 'Indicator scores at 1 or 2' },
  { key: 'hcRepeat',  label: 'Staff reviewed more than once' },
  { key: 'spAvg',     label: 'Support priority, college average (higher = more need)' },
  { key: 'spUrgent',  label: 'In the Urgent support band (5 or more)' },
  { group: 'RAG' },
  { key: 'ragBands',  label: 'Areas by suggested RAG' },
  { key: 'ragAILow',  label: 'Areas recorded 1 or 2 on Accessibility & Inclusion' },
  { key: 'ragAIAvg',  label: 'Recorded Accessibility & Inclusion, college average' },
  { group: 'Teach Meets and CPD' },
  { key: 'teachMeets', label: 'Teach Meets delivered' },
  { key: 'tmSat',      label: 'Teach Meet satisfaction' },
  { key: 'tmAreas',    label: 'Areas with staff at a Teach Meet' },
  { key: 'cpd',        label: 'All CPD sessions delivered' },
  { group: 'Staff confidence (WCAG 2.2 AA and Accessibility Checker)' },
  { key: 'confN',   label: 'Staff who have rated their confidence' },
  { key: 'confAvg', label: 'Average confidence, all statements (1 to 5)' },
  { key: 'confWcag', label: 'Making resources that meet WCAG 2.2 AA' },
  { key: 'confChecker', label: 'Using and fixing issues from the Accessibility Checker' },
  { group: 'Learning walks' },
  { key: 'lwTotal', label: 'Learning walks completed' },
  { key: 'lwAI',    label: 'Learning walks flagging accessibility and inclusion' },
  { group: 'Loops' },
  { key: 'loopsRaised', label: 'Loops raised' },
  { key: 'loopsOpen',   label: 'Loops open' },
  { key: 'loopsClosed', label: 'Loops closed' },
  { group: 'Digital Leads' },
  { key: 'dlCount',    label: 'Digital Leads on the Hub (today)' },
  { key: 'dlMeetings', label: 'Digital Lead 1:1s' },
  { group: 'Action plans' },
  { key: 'apOpen',   label: 'Action plans open' },
  { key: 'apDone',   label: 'Action plans completed' },
  { key: 'apShared', label: 'Action plans shared with the Digital Lead' },
]);

// Key concerns: the indicators most often scored 1 or 2, as at a date.
function msKeyConcerns(asOf) {
  const latest = _msLatestPerStaff(asOf);
  const stats = {};
  latest.forEach(r => Object.entries(r.domains || {}).forEach(([did, d]) => Object.entries(d.indicatorScores || {}).forEach(([iid, s]) => {
    if (typeof s !== 'number') return;
    const st = stats[iid] = stats[iid] || { id: iid, domain: did, n: 0, low: 0 };
    st.n++; if (s <= 2) st.low++;
  })));
  const label = id => {
    for (const fa of (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : [])) {
      const ind = fa.indicators.find(i => i.id === id); if (ind) return ind.label;
    }
    return id;
  };
  return Object.values(stats).map(s => ({ ...s, label: label(s.id), share: s.n ? s.low / s.n : 0 }));
}

// Confidence by statement, as at a date (each person's latest response).
function msConfidenceItems(asOf) {
  const by = {};
  _msConfidence().forEach(c => { if (_msBy(c.date, asOf)) { const k = (c.email || c.name || c.responseId || '').toLowerCase(); if (!by[k] || c.date > by[k].date) by[k] = c; } });
  const latest = Object.values(by);
  return (typeof CONF_ITEMS !== 'undefined' ? CONF_ITEMS : []).map(it => {
    const vals = latest.map(c => c.items && c.items[it.id]).filter(v => typeof v === 'number');
    return { id: it.id, label: it.text, group: it.group, sc: it.sc, n: vals.length, avg: _msAvg(vals) };
  });
}

// ── Columns: milestones, saved checkpoints and today ──────────
function msColumns() {
  const today = todayISO();
  const snaps = _msSnapshots();
  const cols = MS_MILESTONES.map(m => ({ ...m, kind: 'milestone' }));
  snaps.filter(s => s.kind === 'checkpoint').forEach(s => cols.push({ id: s.columnId, label: `Checkpoint ${_msShort(s.date)}`, date: s.date, kind: 'checkpoint' }));
  if (!cols.some(c => c.date === today)) cols.push({ id: 'today', label: `Today (${_msShort(today)})`, date: today, kind: 'today' });
  cols.sort((a, b) => a.date.localeCompare(b.date));
  return cols.map(c => {
    const frozen = snaps.find(s => s.columnId === c.id);
    const reached = c.date <= today;
    let metrics = null, concerns = null;
    let conf = null;
    if (frozen) { metrics = frozen.metrics; concerns = frozen.keyConcerns; conf = frozen.confidenceItems || null; }
    else if (reached) { metrics = msComputeMetrics(c.date); concerns = msKeyConcerns(c.date); conf = msConfidenceItems(c.date); }
    return { ...c, reached, frozen: frozen || null, metrics, concerns, conf };
  });
}

function msFreeze(columnId) {
  const col = msColumns().find(c => c.id === columnId);
  if (!col || !col.reached) return false;
  const snap = {
    snapshotId: generateId(), columnId: col.id, kind: col.kind === 'checkpoint' ? 'checkpoint' : 'milestone',
    label: col.label, date: col.date, savedAt: nowISO(),
    metrics: msComputeMetrics(col.date), keyConcerns: msKeyConcerns(col.date), confidenceItems: msConfidenceItems(col.date),
    ragByArea: (typeof getAllAreaEvidenceRAG === 'function' ? getAllAreaEvidenceRAG(col.date) : []).map(r => ({ areaCode: r.areaCode, label: r.label, basis: r.hc.basis, staff: r.hc.staffCount })),
  };
  saveMilestoneSnapshot(snap);
  return true;
}

// A dated checkpoint, e.g. "at time of import": freezes today's figures
// as their own column.
function msSaveCheckpoint() {
  const today = todayISO();
  const id = 'checkpoint-' + today;
  if (_msSnapshots().some(s => s.columnId === id)) return false;
  const snap = {
    snapshotId: generateId(), columnId: id, kind: 'checkpoint', label: `Checkpoint ${_msShort(today)}`,
    date: today, savedAt: nowISO(), metrics: msComputeMetrics(today), keyConcerns: msKeyConcerns(today), confidenceItems: msConfidenceItems(today),
    ragByArea: (typeof getAllAreaEvidenceRAG === 'function' ? getAllAreaEvidenceRAG(today) : []).map(r => ({ areaCode: r.areaCode, label: r.label, basis: r.hc.basis, staff: r.hc.staffCount })),
  };
  saveMilestoneSnapshot(snap);
  return true;
}

// ── Period ("what I did") ─────────────────────────────────────
function msPeriod(from, to) {
  const items = [];
  const push = (date, kind, text) => items.push({ date: _msDay(date), kind, text });
  const reviews = _msReviews().filter(r => _msIn(r.date, from, to));
  const areaName = c => (_msAreas().find(a => a.areaCode === c) || {}).areaName || c || '';
  const byArea = {};
  reviews.forEach(r => { byArea[r.areaCode] = (byArea[r.areaCode] || 0) + 1; });
  Object.entries(byArea).forEach(([c, n]) => push(reviews.filter(r => r.areaCode === c).map(r => r.date).sort().slice(-1)[0], 'Health Checks', `${n} in ${c} ${areaName(c)}`));

  const cal = _msCal();
  const meetings = cal.filter(e => e.entryType === 'meeting' && _msIn(e.date, from, to));
  meetings.forEach(e => push(e.date, 'Meeting', e.title || 'Meeting'));
  const tasksDone = cal.filter(e => e.entryType === 'task' && e.status === 'complete' && _msIn(e.lastUpdated || e.date, from, to));
  tasksDone.forEach(e => push(e.lastUpdated || e.date, 'Task completed', e.title || 'Task'));

  const acts = _msActivities().filter(a => _msIn(a.date, from, to) && a.activityType !== 'meeting');
  const actLabel = t => ({ 'learning-walk': 'Learning walk', 'coaching': 'Coaching', 'teach-meet': 'Teach Meet', 'health-check-visit': 'Health Check visit',
    'cpd-delivered': 'CPD delivered', 'digital-lead-meeting': 'Digital Lead 1:1', 'hoa-meeting': 'HoA meeting', 'devobs': 'Developmental observation',
    'resource-created': 'Resource created', 'referral': 'Referral', 'work-review': 'Work review', 'tlam-meeting': 'TLAM meeting' }[t] || 'Activity');
  acts.forEach(a => push(a.date, actLabel(a.activityType), `${a.areaCode ? a.areaCode + ': ' : ''}${String(a.title || a.summary || a.notes || '').split('\n')[0].slice(0, 90)}`));

  const cpd = _msCPD().filter(c => _msIn(c.date, from, to));
  cpd.forEach(c => push(c.date, _msIsTeachMeet(c) ? 'Teach Meet' : 'CPD delivered', `${c.title}${c.attendees ? ` (${c.attendees} attending)` : ''}`));

  const dlMeet = [];
  _msDLs().forEach(d => (d.meetingHistory || []).forEach(m => { if (_msIn(m.date || m.createdAt, from, to)) dlMeet.push({ d, m }); }));
  dlMeet.forEach(({ d, m }) => push(m.date || m.createdAt, 'Digital Lead 1:1', `${d.name || ''}${d.areaCode ? ' (' + d.areaCode + ')' : ''}`));

  const afis = _msAFIs();
  const raised = afis.filter(a => _msIn(a.createdAt, from, to));
  const closed = afis.filter(a => a.status === 'closed' && _msIn(a.closedAt, from, to));
  const notes = ((window.DPC_DATA.notes && window.DPC_DATA.notes.notes) || []).filter(n => _msIn(n.createdAt || n.date || n.lastUpdated, from, to));
  const plansNew = _msPlans().filter(p => _msIn(p.createdAt, from, to));
  const plansShared = _msPlans().filter(p => _msIn(p.sharedWithDLAt, from, to));

  items.sort((a, b) => a.date.localeCompare(b.date));
  return {
    from, to, items,
    counts: [
      ['Health Checks', reviews.length],
      ['Staff reviewed', new Set(reviews.map(r => r.staffId)).size],
      ['Meetings', meetings.length + acts.filter(a => /meeting/.test(a.activityType || '')).length],
      ['Digital Lead 1:1s', dlMeet.length + acts.filter(a => a.activityType === 'digital-lead-meeting').length],
      ['Learning walks', acts.filter(a => a.activityType === 'learning-walk').length],
      ['Teach Meets and CPD sessions', cpd.length + acts.filter(a => a.activityType === 'teach-meet' || a.activityType === 'cpd-delivered').length],
      ['Coaching sessions', acts.filter(a => a.activityType === 'coaching').length],
      ['Tasks completed', tasksDone.length],
      ['Notes written', notes.length],
      ['Loops raised', raised.length],
      ['Loops closed', closed.length],
      ['Action plans started', plansNew.length],
      ['Action plans shared with a Digital Lead', plansShared.length],
    ],
  };
}

// ── Per-area position (today) ─────────────────────────────────
function msAreaRows() {
  const today = todayISO();
  return _msAreas().map(a => {
    const latest = _msLatestPerStaff(today, a.areaCode);
    const dates = _msReviews().filter(r => r.areaCode === a.areaCode).map(r => r.date).filter(Boolean).sort();
    const r = typeof getAreaEvidenceRAG === 'function' ? getAreaEvidenceRAG(a.areaCode) : null;
    const plans = _msPlans().filter(p => p.areaCode === a.areaCode);
    const dl = r && r.dl && r.dl.present ? r.dl : null;
    const tmPeople = _msCPD().filter(_msIsTeachMeet).reduce((s, c) => s + (c.register || []).filter(p => p.areaCode === a.areaCode).length, 0);
    const confBy = {};
    _msConfidence().filter(c => c.areaCode === a.areaCode).forEach(c => { const k = (c.email || c.name || c.responseId).toLowerCase(); if (!confBy[k] || c.date > confBy[k].date) confBy[k] = c; });
    const conf = _msAvg(Object.values(confBy).map(c => c.overall).filter(v => typeof v === 'number'));
    return {
      areaCode: a.areaCode, areaName: a.areaName,
      dl: dl ? (dl.name || 'Yes') : 'None',
      staff: latest.length,
      firstCheck: dates[0] || '', lastCheck: dates[dates.length - 1] || '',
      avg: _msAvg(latest.map(_msReviewAvg).filter(v => v != null)),
      rag: r ? r.label : '',
      dlMeetings: dl ? (dl.meetings || 0) : 0,
      loopsOpen: r ? r.afi.open : 0,
      plansOpen: plans.filter(p => p.status !== 'complete').length,
      plansShared: plans.filter(p => p.sharedWithDLAt).length,
      teachMeetAttendees: tmPeople,
      confidence: conf, confidenceN: Object.keys(confBy).length,
    };
  });
}

// ── Current Focus progress ────────────────────────────────────
function msFocusRows(from, to) {
  const focuses = (window.DPC_DATA.currentFocus && window.DPC_DATA.currentFocus.focuses) || [];
  return focuses.filter(f => f.status !== 'complete' && f.status !== 'dropped').map(f => {
    const ms = f.milestones || [];
    const acts = typeof getLinkedActivities === 'function' ? getLinkedActivities('focus', f.focusId) : [];
    const last = acts[0];
    return {
      title: f.title || 'Untitled focus', status: f.status || 'active',
      milestonesDone: ms.filter(m => m.state === 'complete').length,
      milestonesTotal: ms.filter(m => m.state !== 'dropped').length,
      atRisk: ms.filter(m => m.state === 'at-risk').length,
      evidenceTotal: acts.length,
      evidencePeriod: acts.filter(a => _msIn(a.date, from, to)).length,
      areas: (f.linkedAreaCodes || []).length,
      latest: last ? `${_msFmt(last.date)}: ${String(last.title || last.summary || last.notes || '').split('\n')[0].slice(0, 140)}` : '',
      impact: f.impact || '',
    };
  });
}

// ── Shared table model (screen, Word and Excel use the same rows) ──
function _msModel(opts) {
  const cols = msColumns();
  const today = todayISO();
  const from = opts.dateFrom || new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const to = opts.dateTo || today;
  const shown = cols.filter(c => c.reached);
  const pending = cols.filter(c => !c.reached);

  const measureRows = MS_ROWS.map(r => r.group ? { group: r.group } : {
    label: r.label,
    cells: cols.map(c => (c.metrics && c.metrics[r.key]) ? c.metrics[r.key].display : (c.reached ? '' : 'Not reached')),
  });

  // Key concerns: top indicators by today's share at 1 or 2.
  const nowC = msKeyConcerns(today).filter(c => c.n >= 3).sort((a, b) => b.share - a.share || b.low - a.low).slice(0, 8);
  const concernRows = nowC.map(k => ({
    label: k.label,
    cells: cols.map(c => {
      if (!c.concerns) return c.reached ? '' : 'Not reached';
      const x = c.concerns.find(y => y.id === k.id);
      return x && x.n ? `${_msPct(x.share)} (${x.low} of ${x.n})` : 'None';
    }),
  }));

  const confRows = _msConfidence().length ? (typeof CONF_ITEMS !== 'undefined' ? CONF_ITEMS : []).map(it => ({
    label: `${it.text}${it.sc ? ` (WCAG ${it.sc})` : ''}`,
    cells: cols.map(c => {
      if (!c.conf) return c.reached ? '' : 'Not reached';
      const x = c.conf.find(y => y.id === it.id);
      return x && x.n ? `${_ms2(x.avg)} (${x.n})` : 'None';
    }),
  })) : [];

  return { cols, shown, pending, from, to, measureRows, concernRows, confRows, period: msPeriod(from, to), areaRows: msAreaRows(), focusRows: msFocusRows(from, to) };
}

// ── On-screen report ──────────────────────────────────────────
function msRenderReport(opts) {
  const m = _msModel(opts || {});
  const head = `<tr><th scope="col">Measure</th>${m.cols.map(c => `<th scope="col">${_msEsc(c.label)}<span class="ms-col-sub">${_msEsc(_msFmt(c.date))}${c.frozen ? `<br>Frozen ${_msEsc(_msShort(c.frozen.savedAt))}` : (c.reached ? '<br>Live' : '')}</span></th>`).join('')}</tr>`;
  const body = m.measureRows.map(r => r.group
    ? `<tr class="ms-group"><th scope="rowgroup" colspan="${m.cols.length + 1}">${_msEsc(r.group)}</th></tr>`
    : `<tr><th scope="row">${_msEsc(r.label)}</th>${r.cells.map(v => `<td${v === 'Not reached' ? ' class="ms-muted"' : ''}>${_msEsc(v)}</td>`).join('')}</tr>`).join('');
  const freezeBtns = m.cols.filter(c => c.reached && c.kind === 'milestone').map(c =>
    `<button type="button" class="btn btn--ghost btn--sm ms-freeze" data-col="${_msEsc(c.id)}">${c.frozen ? 'Re-freeze' : 'Freeze'} ${_msEsc(c.label)}</button>`).join('');

  return `
    <div class="ms-report">
      <div class="ms-actions">
        <button type="button" class="btn btn--primary btn--sm" id="ms-word">Download Word</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ms-xlsx">Download spreadsheet</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ms-checkpoint">Save today as a dated checkpoint</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ms-conf-import">Import confidence responses</button>
      </div>
      <p id="ms-status" role="status" class="ms-muted"></p>

      <h4 class="ms-h">Position at each milestone</h4>
      <p class="ms-muted">Live columns are worked out from dated records. Frozen columns keep the figures saved on the day shown, so later imports or edits do not change them.</p>
      <div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Measures at each milestone</caption><thead>${head}</thead><tbody>${body}</tbody></table></div>
      ${freezeBtns ? `<div class="ms-actions" style="margin-top:var(--space-sm);">${freezeBtns}</div>` : ''}

      <h4 class="ms-h">Key concerns: indicators most often scored 1 or 2</h4>
      ${m.concernRows.length ? `<div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Key concerns at each milestone</caption><thead>${head.replace('Measure', 'Indicator')}</thead><tbody>${m.concernRows.map(r => `<tr><th scope="row">${_msEsc(r.label)}</th>${r.cells.map(v => `<td>${_msEsc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="ms-muted">No Health Check scores yet.</p>'}

      <h4 class="ms-h">Staff confidence by statement (average, number of staff)</h4>
      ${m.confRows.length ? `<div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Staff confidence by statement at each milestone</caption><thead>${head.replace('Measure', 'Statement')}</thead><tbody>${m.confRows.map(r => `<tr><th scope="row">${_msEsc(r.label)}</th>${r.cells.map(v => `<td>${_msEsc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="ms-muted">No confidence responses imported yet. Save the Accessibility Confidence Check export in the Data folder, then use Import confidence responses.</p>'}

      <h4 class="ms-h">This period: ${_msEsc(_msFmt(m.from))} to ${_msEsc(_msFmt(m.to))}</h4>
      <ul class="ms-counts">${m.period.counts.map(([k, n]) => `<li><strong>${n}</strong> ${_msEsc(k)}</li>`).join('')}</ul>
      ${m.period.items.length ? `<details class="ev-rag-details"><summary>What happened (${m.period.items.length})</summary><ul class="ev-rag-list">${m.period.items.map(i => `<li>${_msEsc(_msShort(i.date))}, ${_msEsc(i.kind)}: ${_msEsc(i.text)}</li>`).join('')}</ul></details>` : '<p class="ms-muted">Nothing logged in this period.</p>'}

      <h4 class="ms-h">Current Focus</h4>
      ${m.focusRows.length ? `<div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Current Focus progress</caption><thead><tr><th scope="col">Focus</th><th scope="col">Milestones complete</th><th scope="col">At risk</th><th scope="col">Evidence (period / total)</th><th scope="col">Areas</th><th scope="col">Latest evidence</th></tr></thead><tbody>${m.focusRows.map(f => `<tr><th scope="row">${_msEsc(f.title)}</th><td>${f.milestonesDone} of ${f.milestonesTotal}</td><td>${f.atRisk}</td><td>${f.evidencePeriod} / ${f.evidenceTotal}</td><td>${f.areas}</td><td>${_msEsc(f.latest)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ms-muted">No active Current Focus.</p>'}

      <h4 class="ms-h">Areas today</h4>
      <div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Position of each area today</caption><thead><tr><th scope="col">Area</th><th scope="col">Digital Lead</th><th scope="col">Staff reviewed</th><th scope="col">Checks from / to</th><th scope="col">Practice average</th><th scope="col">Suggested RAG</th><th scope="col">DL 1:1s</th><th scope="col">Loops open</th><th scope="col">Plans open</th><th scope="col">Plans shared with DL</th><th scope="col">Teach Meet attendees</th><th scope="col">Confidence (staff)</th></tr></thead>
      <tbody>${m.areaRows.map(a => `<tr><th scope="row">${_msEsc(a.areaCode)} <span class="ms-muted">${_msEsc(a.areaName)}</span></th><td>${_msEsc(a.dl)}</td><td>${a.staff}</td><td>${a.firstCheck ? _msEsc(_msShort(a.firstCheck) + ' to ' + _msShort(a.lastCheck)) : 'None'}</td><td>${a.avg != null ? _ms2(a.avg) : 'None'}</td><td>${_msEsc(a.rag)}</td><td>${a.dlMeetings}</td><td>${a.loopsOpen}</td><td>${a.plansOpen}</td><td>${a.plansShared}</td><td>${a.teachMeetAttendees}</td><td>${a.confidence != null ? _ms2(a.confidence) + ' (' + a.confidenceN + ')' : 'None'}</td></tr>`).join('')}</tbody></table></div>

      <details class="ev-rag-details" style="margin-top:var(--space-lg);"><summary>How these figures are worked out</summary>
        <ul class="ev-rag-list">
          <li>Health Checks count by review date, not import date. The practice rating uses each person's latest check by that date.</li>
          <li>Suggested RAG uses the Areas at Risk rules, with only the evidence that existed by that date. Digital Leads have no start date in the Hub, so one listed now counts as present at earlier dates.</li>
          <li>Recorded RAG is the RAG Matrix score in force on that date, from its saved history.</li>
          <li>Teach Meets are CPD sessions with "Teach Meet" in the title, plus Teach Meet activities. Learning walks flag accessibility and inclusion when Accessible Resources, Accessible Resources (Digital) or Digital Learning Environment is an area for development.</li>
          <li>Loops exclude strengths. Open means raised by that date and not closed by it.</li>
          <li>Tasks completed in a period use the date the task was last updated.</li>
        </ul>
      </details>
    </div>`;
}

function msWireReport(opts) {
  // Reflection and next steps are read when the button is pressed, so
  // text typed after the preview was drawn is included.
  const fresh = () => ({ ...opts,
    reflection: document.getElementById('rep-ms-reflection')?.value.trim() || '',
    nextSteps: document.getElementById('rep-ms-next')?.value.trim() || '' });
  const status = t => { const el = document.getElementById('ms-status'); if (el) el.textContent = t; };
  document.getElementById('ms-word')?.addEventListener('click', () => {
    if (typeof window.docx === 'undefined') { status('The Word library did not load. Refresh and try again.'); return; }
    try { msBuildWord(window.docx, fresh()); status('Word document downloaded.'); } catch (e) { console.error(e); status('Could not build the Word document: ' + e.message); }
  });
  document.getElementById('ms-xlsx')?.addEventListener('click', () => {
    try { msExportWorkbook(opts); status('Spreadsheet downloaded.'); } catch (e) { console.error(e); status('Could not build the spreadsheet: ' + e.message); }
  });
  document.getElementById('ms-checkpoint')?.addEventListener('click', () => {
    if (msSaveCheckpoint()) { status("Today's figures saved as a checkpoint."); if (typeof _repRenderPreview === 'function') _repRenderPreview(); }
    else status('There is already a checkpoint for today.');
  });
  document.getElementById('ms-conf-import')?.addEventListener('click', async () => {
    if (typeof confImportFromFolder !== 'function') { status('Confidence import is not loaded. Refresh the Hub.'); return; }
    status('Reading the confidence export…');
    try { const res = await confImportFromFolder(); if (typeof _repRenderPreview === 'function') _repRenderPreview(); const el = document.getElementById('ms-status'); if (el) el.textContent = res.message; }
    catch (e) { console.error(e); status('Could not import: ' + e.message); }
  });
  document.querySelectorAll('.ms-freeze').forEach(b => b.addEventListener('click', () => {
    const col = msColumns().find(c => c.id === b.dataset.col);
    if (col && col.frozen && !confirm(`Replace the figures frozen on ${_msFmt(col.frozen.savedAt)} for ${col.label} with today's working?`)) return;
    if (msFreeze(b.dataset.col)) { if (typeof _repRenderPreview === 'function') _repRenderPreview(); }
  }));
}

// ── Word ──────────────────────────────────────────────────────
function msBuildWord(docx, opts) {
  const m = _msModel(opts || {});
  const { Document, PageOrientation } = docx;
  const n = m.cols.length;
  const labelW = 3600, cellW = Math.max(1100, Math.floor((13900 - labelW) / Math.max(n, 1)));
  const colW = [labelW, ...m.cols.map(() => cellW)];
  const colHead = ['Measure', ...m.cols.map(c => `${c.label}${c.frozen ? ' (frozen)' : ''}`)];
  const measureRows = m.measureRows.map(r => r.group ? [r.group.toUpperCase(), ...m.cols.map(() => '')] : [r.label, ...r.cells]);

  const children = [
    _repDocTitle(docx, 'Digital Accessibility and Inclusion: Milestone Impact Report'),
    _repDocPara(docx, `Prepared ${_msFmt(todayISO())}. Period reported: ${_msFmt(m.from)} to ${_msFmt(m.to)}.`, { italics: true, spacing: { after: 200 } }),
  ];
  if (opts.reflection) { children.push(_repDocSectionHeading(docx, 'Reflection')); children.push(_repDocPara(docx, opts.reflection)); }

  children.push(_repDocSectionHeading(docx, 'This period in numbers'));
  children.push(..._repDocBullets(docx, m.period.counts.filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`)));
  if (m.period.items.length) {
    children.push(_repDocSectionHeading(docx, 'What I did'));
    children.push(..._repDocBullets(docx, m.period.items.slice(0, 25).map(i => `${_msShort(i.date)}, ${i.kind}: ${i.text}`)));
    if (m.period.items.length > 25) children.push(_repDocPara(docx, `Plus ${m.period.items.length - 25} more, listed in the spreadsheet.`, { italics: true }));
  }
  if (opts.nextSteps) { children.push(_repDocSectionHeading(docx, 'Next steps')); children.push(_repDocPara(docx, opts.nextSteps)); }

  children.push(_repDocSectionHeading(docx, 'Position at each milestone'));
  children.push(_repDocTable(docx, colHead, measureRows, colW));
  if (m.concernRows.length) {
    children.push(_repDocSectionHeading(docx, 'Key concerns: indicators most often scored 1 or 2'));
    children.push(_repDocTable(docx, ['Indicator', ...colHead.slice(1)], m.concernRows.map(r => [r.label, ...r.cells]), colW));
  }
  if (m.confRows.length) {
    children.push(_repDocSectionHeading(docx, 'Staff confidence by statement (average, number of staff)'));
    children.push(_repDocTable(docx, ['Statement', ...colHead.slice(1)], m.confRows.map(r => [r.label, ...r.cells]), colW));
  }
  if (m.focusRows.length) {
    children.push(_repDocSectionHeading(docx, 'Current Focus'));
    children.push(_repDocTable(docx, ['Focus', 'Milestones complete', 'At risk', 'Evidence (period / total)', 'Latest evidence'],
      m.focusRows.map(f => [f.title, `${f.milestonesDone} of ${f.milestonesTotal}`, String(f.atRisk), `${f.evidencePeriod} / ${f.evidenceTotal}`, f.latest]), [3200, 1700, 1100, 1900, 6000]));
  }
  children.push(_repDocSectionHeading(docx, 'Areas today'));
  children.push(_repDocTable(docx, ['Area', 'Digital Lead', 'Staff reviewed', 'Last check', 'Practice average', 'Suggested RAG', 'Loops open', 'Plans open'],
    m.areaRows.map(a => [`${a.areaCode} ${a.areaName}`, a.dl, String(a.staff), a.lastCheck ? _msShort(a.lastCheck) : 'None', a.avg != null ? _ms2(a.avg) : 'None', a.rag, String(a.loopsOpen), String(a.plansOpen)]),
    [3600, 1800, 1200, 1300, 1300, 2300, 1100, 1100]));
  children.push(_repDocPara(docx, 'Health Checks count by review date. Practice rating uses each person\'s latest check by that date. Frozen columns keep the figures saved on the day they were frozen. Scale: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident.', { italics: true, spacing: { before: 200 } }));

  const doc = new Document({
    sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `milestone-impact-report-${todayISO()}.docx`);
}

// ── Excel ─────────────────────────────────────────────────────
function msExportWorkbook(opts) {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet library did not load. Refresh and try again.');
  const m = _msModel(opts || {});
  const wb = XLSX.utils.book_new();
  const head = ['Measure', ...m.cols.map(c => `${c.label} (${_msFmt(c.date)})${c.frozen ? ' frozen ' + _msShort(c.frozen.savedAt) : ''}`)];
  const add = (rows, name, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
    if (rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add([head, ...m.measureRows.map(r => r.group ? [r.group] : [r.label, ...r.cells])], 'Milestones', [48, ...m.cols.map(() => 22)]);
  add([['Indicator', ...head.slice(1)], ...m.concernRows.map(r => [r.label, ...r.cells])], 'Key concerns', [44, ...m.cols.map(() => 22)]);
  if (m.confRows.length) add([['Statement', ...head.slice(1)], ...m.confRows.map(r => [r.label, ...r.cells])], 'Confidence', [70, ...m.cols.map(() => 18)]);
  add([['Measure', 'Count'], ...m.period.counts, [], ['Date', 'Type', 'Detail'], ...m.period.items.map(i => [i.date, i.kind, i.text])], 'This period', [16, 28, 80]);
  add([['Focus', 'Status', 'Milestones complete', 'Milestones total', 'At risk', 'Evidence this period', 'Evidence total', 'Areas linked', 'Latest evidence', 'How impact is measured'],
    ...m.focusRows.map(f => [f.title, f.status, f.milestonesDone, f.milestonesTotal, f.atRisk, f.evidencePeriod, f.evidenceTotal, f.areas, f.latest, f.impact])], 'Current Focus', [36, 12, 10, 10, 8, 10, 10, 10, 60, 50]);
  add([['Area code', 'Area', 'Digital Lead', 'Staff reviewed', 'First check', 'Last check', 'Practice average', 'Suggested RAG', 'DL 1:1s', 'Loops open', 'Plans open', 'Plans shared with DL', 'Teach Meet attendees', 'Confidence average', 'Confidence responses'],
    ...m.areaRows.map(a => [a.areaCode, a.areaName, a.dl, a.staff, a.firstCheck, a.lastCheck, a.avg != null ? Math.round(a.avg * 100) / 100 : '', a.rag, a.dlMeetings, a.loopsOpen, a.plansOpen, a.plansShared, a.teachMeetAttendees, a.confidence != null ? Math.round(a.confidence * 100) / 100 : '', a.confidenceN])], 'Areas', [10, 34, 18, 10, 12, 12, 10, 20, 8, 10, 10, 12, 12, 12, 12]);
  add([['How the figures are worked out'],
    ['Health Checks count by review date, not import date. Practice rating: each person\'s latest check by that date, averaged across their scored focus areas, then across staff.'],
    ['Suggested RAG: Areas at Risk rules (rules v' + (typeof EV_RAG !== 'undefined' ? EV_RAG.RULES_VERSION : '1') + ') using only evidence that existed by that date. Digital Leads listed now count as present at earlier dates.'],
    ['Recorded RAG: the RAG Matrix score in force on that date, from its saved history.'],
    ['Teach Meets: CPD with "Teach Meet" in the title, plus Teach Meet activities. Learning walks flag accessibility and inclusion when AR, ARD or LED is an area for development.'],
    ['Loops exclude strengths. Open = raised by that date and not closed by it.'],
    ['Staff confidence: each person\'s latest Accessibility Confidence Check response by that date, scored 1 to 5 on 10 WCAG 2.2 AA statements and 5 Accessibility Checker statements.'],
    ['Frozen columns keep the figures saved on the day shown. Live columns are worked out when the report is opened.'],
    ['Scale: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident. Generated ' + _msFmt(todayISO()) + '.'],
  ], 'Method', [140]);
  XLSX.writeFile(wb, `milestone-impact-report-${todayISO()}.xlsx`);
}
