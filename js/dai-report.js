// DPC Hub · js/dai-report.js · v1.0 · 09/11/26 · DA&I impact report: Word export from the DA&I progress page
//
// A Word document for line management and the task force: confidence
// before and after the training, element gaps, area picture, Area Action
// Plan status and milestones, personal targets, support needs and the
// evidence logged. Counts and area-level detail only: no staff names,
// emails or initials appear anywhere in the document.
//
// Uses the Word helpers in reports.js (_repDocTable and friends), which
// mark table header rows for screen readers. Arial 12pt body text.
//
// Public: daiReportPanelHTML(), daiReportWire(root)

function daiReportPanelHTML() {
  return `<details style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);background:var(--color-white);">
    <summary style="cursor:pointer;font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);min-height:24px;">Impact report (Word)</summary>
    <p style="font-size:var(--text-sm);color:var(--color-muted);margin:var(--space-sm) 0;max-width:70ch;">A Word report of everything on this page, for line management and the task force. It contains counts and area-level detail only, with no staff names.</p>
    <div class="form-group"><label class="form-label form-label--optional" for="drp-headline">Headline to open the report</label>
      <textarea id="drp-headline" class="form-textarea" rows="2" placeholder="For example: confidence has risen across most areas; captions remain the biggest gap."></textarea></div>
    <div class="form-group" style="max-width:260px;"><label class="form-label" for="drp-since">Count evidence and activity from</label>
      <input id="drp-since" type="date" class="form-input" value="2026-10-23"></div>
    <button type="button" id="drp-go" class="btn btn--primary">Download impact report</button>
    <p id="drp-status" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-slate);margin-top:var(--space-sm);"></p>
  </details>`;
}

function daiReportWire(root) {
  const btn = root.querySelector('#drp-go');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const status = root.querySelector('#drp-status');
    if (typeof window.docx === 'undefined') { status.textContent = 'The Word library did not load. Refresh the Hub and try again.'; return; }
    status.textContent = 'Building the report…';
    try {
      const n = _drpBuild(window.docx, { headline: root.querySelector('#drp-headline').value.trim(), since: root.querySelector('#drp-since').value || '' });
      status.textContent = `Report downloaded (${n} sections).`;
    } catch (e) {
      status.textContent = 'The report could not be built: ' + (e.message || e);
    }
  });
}

function _drpFmt(n) { return n == null ? 'not available' : _daiFmt(n); }
function _drpPct(a, b) { return b ? `${Math.round(a / b * 100)}%` : '0%'; }

function _drpBuild(docx, opts) {
  const { Document } = docx;
  const d = _daiCompute();
  const store = _daiStore();
  const areas = _daiAreaList();
  const plans = areas.map(a => ({ a, p: typeof daiPlanLatest === 'function' ? daiPlanLatest(a.areaCode) : null }));
  const got = plans.filter(x => x.p);
  const evidence = (store.evidence || []).filter(e => !opts.since || (e.date || '') >= opts.since);
  const tg = typeof daiTargetsSummary === 'function' ? daiTargetsSummary() : { total: 0, achieved: 0, inProgress: 0, withEvidence: 0 };
  const needs = typeof daiSupportNeeds === 'function' ? daiSupportNeeds() : [];
  const shift = d.both.length ? _daiAvg(d.both.map(p => p.after - p.before)) : null;
  const fixedTotal = got.reduce((n, x) => n + x.p.fixed.length, 0);
  const H = t => _repDocSectionHeading(docx, t);
  const P = (t, o) => _repDocPara(docx, t, o);
  const B = items => _repDocBullets(docx, items);
  const children = [];
  let sections = 0;

  children.push(_repDocTitle(docx, 'Digital Accessibility and Inclusion: impact report'));
  children.push(P(`Prepared ${_daiFmtDate(todayISO())}. Evidence and activity counted from ${opts.since ? _daiFmtDate(opts.since) : 'the start of the records'}.`, { italics: true, spacing: { after: 200 } }));
  if (opts.headline) { children.push(H('Headline')); children.push(P(opts.headline)); sections++; }

  // Summary
  children.push(H('Summary')); sections++;
  children.push(...B([
    `${d.regsCount} staff registered for the training; ${d.reflCount} completed the "How's it going" reflection.`,
    `Average confidence before the training: ${_drpFmt(d.before)} of 5. After: ${_drpFmt(d.after)} of 5${shift != null ? `, a change of ${shift >= 0 ? '+' : ''}${_daiFmt(shift)} for the ${d.both.length} staff who answered both` : ''}.`,
    `Area Action Plans submitted: ${got.length} of ${areas.length} areas.`,
    `Resources teams report fixing: ${fixedTotal}.`,
    `Personal targets set: ${tg.total}; achieved ${tg.achieved}, in progress ${tg.inProgress}, with evidence ${tg.withEvidence}.`,
    `Evidence entries logged: ${evidence.length}.`,
  ]));

  // Elements
  if (d.elements.some(e => e.n)) {
    children.push(H('Confidence by accessibility element')); sections++;
    children.push(P('Average confidence after the training, out of 5, lowest first. The lowest elements are the priorities for training and resources.', { spacing: { after: 120 } }));
    children.push(_repDocTable(docx, ['Element', 'Average of 5', 'Staff at 1 or 2', 'Answers'],
      d.elements.filter(e => e.n).map(e => [e.label, _daiFmt(e.avg), String(e.low), String(e.n)]), [3800, 1700, 1800, 1700]));
  }

  // Areas
  const evByArea = code => evidence.filter(e => e.areaCode === code).length;
  const areaRows = areas.slice().sort((a, b) => a.areaCode.localeCompare(b.areaCode)).map(a => {
    const c = d.areas.find(x => x.code === a.areaCode);
    const p = plans.find(x => x.a.areaCode === a.areaCode).p;
    if (!c && !p && !evByArea(a.areaCode)) return null;
    return [`${a.areaCode} ${a.areaName}`, c ? String(c.registered) : '0', c ? String(c.reflections) : '0', c ? _drpFmt(c.before) : '', c ? _drpFmt(c.after) : '', c ? (c.weakest || '') : '', p ? 'Yes' : 'No', String(evByArea(a.areaCode))];
  }).filter(Boolean);
  if (areaRows.length) {
    children.push(H('By curriculum area')); sections++;
    children.push(_repDocTable(docx, ['Area', 'Registered', 'Reflections', 'Before', 'After', 'Weakest element', 'Plan', 'Evidence'], areaRows, [2600, 950, 1000, 750, 750, 1500, 650, 800]));
  }

  // Plans
  children.push(H('Area Action Plans')); sections++;
  const qip = got.filter(x => /^\s*yes/i.test(x.p.qip || '')).length;
  const next = {};
  got.forEach(x => { const k = x.p.takingNext || 'Not stated'; next[k] = (next[k] || 0) + 1; });
  const ms = { 'Met': 0, 'On track': 0, 'At risk': 0, 'Missed': 0, 'Not due yet': 0, 'Past date, not recorded': 0 };
  const attention = [];
  got.forEach(({ a, p }) => p.milestones.filter(m => m.date || m.willBeTrue).forEach(m => {
    const st = _dplMilestoneState(a.areaCode, m);
    ms[st] = (ms[st] || 0) + 1;
    if (st === 'At risk' || st === 'Missed' || st === 'Past date, not recorded') attention.push(`${a.areaCode}, milestone ${m.n}${m.date ? ` (${_daiFmtDate(m.date)})` : ''}: ${st.toLowerCase()}. ${m.willBeTrue}`);
  }));
  const actions = {};
  got.forEach(({ a }) => DAI_PLAN_ACTIONS.forEach(x => {
    const st = (store.planStatus || {})[`${a.areaCode}|action:${x.id}`];
    const s = (st && st.status) || 'Not started';
    actions[s] = (actions[s] || 0) + 1;
  }));
  children.push(...B([
    `${got.length} of ${areas.length} areas have submitted a plan (${_drpPct(got.length, areas.length)}); ${qip} say it is in their QIP and shared with their TLAM and staff.`,
    `What areas are taking next: ${Object.entries(next).map(([k, v]) => `${k} (${v})`).join(', ') || 'none yet'}.`,
    `Milestones: ${Object.entries(ms).filter(([, v]) => v).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ') || 'none set yet'}.`,
    `Plan actions: ${Object.entries(actions).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ') || 'none recorded yet'}.`,
  ]));
  const missing = plans.filter(x => !x.p).map(x => x.a.areaCode);
  if (missing.length) children.push(P(`Not yet submitted: ${missing.join(', ')}.`, { spacing: { before: 120 } }));
  if (attention.length) { children.push(P('Milestones needing attention:', { spacing: { before: 120 } })); children.push(...B(attention)); }

  // Support
  if (needs.length) {
    children.push(H('Support needs')); sections++;
    children.push(P('From staff ratings, targets and support requests. Format is recommended from the complexity of the theme, confidence and urgency.', { spacing: { after: 120 } }));
    const byTheme = new Map();
    needs.forEach(n => { if (!byTheme.has(n.themeLabel)) byTheme.set(n.themeLabel, []); byTheme.get(n.themeLabel).push(n); });
    children.push(_repDocTable(docx, ['Theme', 'Staff', 'High urgency', 'Coaching', 'Video', 'Guide'],
      [...byTheme.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, l]) => [t, String(l.length), String(l.filter(n => n.band === 'High').length),
        String(l.filter(n => n.format === 'coaching').length), String(l.filter(n => n.format === 'video').length), String(l.filter(n => n.format === 'guide').length)]),
      [3000, 1100, 1300, 1200, 1200, 1200]));
    const acts = _dsuActions(needs).filter(a => a.kind !== 'Coaching').slice(0, 10);
    const coached = new Set(needs.filter(n => n.format === 'coaching').map(n => n.staffId)).size;
    children.push(P('Planned group support:', { spacing: { before: 160 } }));
    children.push(...B([...acts.map(a => `${a.text} (${a.people.length} staff).`), `Individual coaching recommended for ${coached} staff.`]));
  }

  // Evidence
  children.push(H('Evidence of work logged')); sections++;
  if (evidence.length) {
    const byType = {};
    evidence.forEach(e => { const l = _devType(e.type).label; byType[l] = (byType[l] || 0) + 1; });
    const staffReached = new Set(evidence.flatMap(e => e.staffIds || [])).size;
    const areasReached = new Set(evidence.map(e => e.areaCode).filter(Boolean)).size;
    children.push(P(`${evidence.length} entries across ${areasReached} area${areasReached === 1 ? '' : 's'}, involving ${staffReached} member${staffReached === 1 ? '' : 's'} of staff.`, { spacing: { after: 120 } }));
    children.push(_repDocTable(docx, ['Type', 'Entries'], Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]), [6000, 3000]));
  } else {
    children.push(P('No evidence entries logged in this period.'));
  }

  // Notes
  children.push(H('About this data')); sections++;
  children.push(...B([
    'Confidence before the training is one overall rating given at registration; confidence after is the average of eleven element ratings, so the change is an indication rather than a like-for-like measure.',
    'Each person\'s latest response of each kind is counted.',
    'Area Action Plans are completed by Heads of Area; milestone and action statuses are recorded by the Digital Pedagogy Coach.',
    'This report contains no staff names. Area-level and person-level detail is held in the DPC Hub.',
  ]));

  const doc = new Document({
    title: 'Digital Accessibility and Inclusion impact report',
    creator: 'DPC Hub',
    styles: { default: { document: { run: { font: 'Arial', size: 24 }, paragraph: { spacing: { line: 300 } } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `dai-impact-report-${todayISO()}.docx`);
  return sections;
}
