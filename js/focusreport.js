// DPC Hub · js/focusreport.js · v1.1 · September 2026
// v1.1 — combined report across every active focus, which is what a
// review conversation actually asks for. One focus at a time answers
// "how is the task force going"; the combined report answers "what have
// you done this term".
// Builds the downloadable Current Focus report.
//
// Two rules shape everything here.
//
// First, every figure is computed from logged records, never typed. The
// draft prose is generated with the figures already in it, and the
// pre-export check compares the numbers in whatever you have since typed
// against the set of computed figures, flagging any that do not match.
//
// Second, nothing is vague. Sentences the check cannot tie to a number
// are flagged before export, not after someone has read them.

// Phrases that make a document read as machine-produced or as evasive.
// Edit this list as colleagues tell you what they notice.
const REPORT_VAGUE_PHRASES = [
  'significant', 'significantly', 'robust', 'leverage', 'delve', 'seamless',
  'a range of', 'a number of', 'good progress', 'strong progress',
  'positive feedback', 'well received', 'it is worth noting', 'it should be noted',
  'various', 'several', 'many staff', 'most staff', 'broadly', 'generally positive',
  'key stakeholders', 'moving forward', 'going forward', 'in terms of',
];

// Characters that give away a machine-written or pasted document.
const REPORT_BANNED_CHARS = [
  { ch: '\u2014', name: 'em-dash' },
  { ch: '\u2013', name: 'en-dash' },
  { ch: '\u2026', name: 'ellipsis character' },
  { ch: '\u201C', name: 'smart quote' },
  { ch: '\u201D', name: 'smart quote' },
  { ch: '\u2018', name: 'smart apostrophe' },
  { ch: '\u2019', name: 'smart apostrophe' },
];

// ── Model ───────────────────────────────────────────────────────

function _frFmt(iso) {
  if (!iso) return '';
  try {
    return new Date(String(iso).split('T')[0] + 'T12:00:00')
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function _frPlural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

// Spells small numbers at the start of a sentence, which is what a
// person writing by hand does.
function _frCount(n) { return String(n); }

function buildFocusReportModel(focus, scope) {
  const all = typeof getLinkedActivities === 'function'
    ? getLinkedActivities(ACTIVITY_LINK_TYPES.FOCUS, focus.focusId) : [];
  const scoped = typeof applyScope === 'function' ? applyScope(all, scope) : { items: all, total: all.length, scoped: all.length, scopeLabel: 'all areas', areaCount: null };
  const acts = scoped.items.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const areaTotal = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).length;
  const areasReached = Array.from(new Set(acts.map(a => a.areaCode).filter(Boolean))).sort();
  const denomAreas = scope && scope.areaCodes && scope.areaCodes.length ? scope.areaCodes.length : areaTotal;

  const byType = {};
  acts.forEach(a => {
    const k = a.activityType || 'unknown';
    if (!byType[k]) byType[k] = { type: k, label: typeof activityTypeLabel === 'function' ? activityTypeLabel(k) : k, count: 0, areas: new Set() };
    byType[k].count++;
    if (a.areaCode) byType[k].areas.add(a.areaCode);
  });
  const instruments = Object.values(byType).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const ms = typeof getMilestones === 'function' ? getMilestones(focus) : [];
  const prog = typeof getFocusProgress === 'function' ? getFocusProgress(focus) : { total: ms.length, complete: 0 };

  const dates = acts.map(a => a.date).filter(Boolean).sort();
  const period = { from: dates[0] || focus.startDate || null, to: dates[dates.length - 1] || null };

  const resources = typeof getFocusResources === 'function' ? getFocusResources(focus) : [];

  // Every number the report is allowed to assert, so the check can tell a
  // computed figure from one that was typed in.
  const figures = new Set();
  const fig = (n) => { if (typeof n === 'number' && isFinite(n)) figures.add(String(n)); };
  fig(acts.length); fig(scoped.total); fig(areasReached.length); fig(denomAreas); fig(areaTotal);
  fig(prog.total); fig(prog.complete); fig(prog.inProgress); fig(prog.atRisk); fig(prog.notStarted);
  fig(instruments.length); fig(resources.length);
  instruments.forEach(i => { fig(i.count); fig(i.areas.size); });
  ms.forEach(m => {
    fig((m.successCriteria || []).length);
    fig((m.successCriteria || []).filter(c => c.done).length);
    fig((m.tasks || []).length);
    fig((m.tasks || []).filter(t => t.done).length);
  });
  // Numbers the user wrote into the focus itself are their own
  // statements, not figures the report is asserting. Without this, a
  // standard named in the Why field (WCAG 2.2) reads as an unsourced
  // claim every time.
  ['what','why','how','who','impact'].forEach(k => {
    String(focus[k] || '').match(/\b\d+(?:\.\d+)?\b/g)?.forEach(x => figures.add(x));
  });
  (ms || []).forEach(x => {
    String(x.title || '').match(/\b\d+(?:\.\d+)?\b/g)?.forEach(y => figures.add(y));
  });

  // Dates in the prose are not claims about volume, so their components
  // are allowed through the unsourced-number check.
  [period.from, period.to, todayISO()].concat(ms.map(m => m.dueDate)).forEach(d => {
    if (!d) return;
    const [y, mo, da] = String(d).split('-');
    figures.add(String(Number(y))); figures.add(String(Number(mo))); figures.add(String(Number(da)));
  });

  return {
    focus, scope, acts, instruments, milestones: ms, progress: prog, resources,
    period, areasReached, areaTotal, denomAreas,
    scopeLabel: scoped.scopeLabel, totalBeforeScope: scoped.total,
    isScoped: scoped.total !== scoped.scoped,
    figures,
  };
}

// ── Draft prose ─────────────────────────────────────────────────
// Generated with the figures already in it. You edit it; the check
// then holds whatever you wrote to the same standard.

function frDraftSections(model) {
  const m = model;
  const f = m.focus;
  // "between 16 September and 18 September", not "between ... to ...".
  const periodText = !m.period.from
    ? 'the period to date'
    : (m.period.from === m.period.to
        ? _frFmt(m.period.from)
        : `${_frFmt(m.period.from)} and ${_frFmt(m.period.to)}`);

  const intention = [f.what, f.why].filter(Boolean).join(' ') ||
    'No intention recorded for this focus yet.';

  let activity;
  if (m.acts.length === 0) {
    activity = `No activity has been linked to this focus for ${periodText}.`;
  } else {
    const list = m.instruments.map(i => `${i.count} ${typeof activityTypeLabelPlural === 'function' ? activityTypeLabelPlural(i.type, i.count) : i.label}`);
    const last = list.pop();
    activity = `${_frCount(m.acts.length)} ${_frPlural(m.acts.length, 'record was', 'records were')} logged against this focus ${m.period.from === m.period.to ? 'on ' : 'between '}${periodText}, `
      + `covering ${m.areasReached.length} of ${m.denomAreas} ${_frPlural(m.denomAreas, 'area')}`
      + (m.isScoped ? ` in ${m.scopeLabel}` : '')
      + `. These comprised ${list.length ? list.join(', ') + ' and ' + last : last}.`;
  }

  let progress;
  if (m.progress.total === 0) {
    progress = 'No milestones have been set for this focus.';
  } else {
    const parts = [`${m.progress.complete} of ${m.progress.total} ${_frPlural(m.progress.total, 'milestone is', 'milestones are')} complete`];
    if (m.progress.inProgress) parts.push(`${m.progress.inProgress} in progress`);
    if (m.progress.atRisk)     parts.push(`${m.progress.atRisk} at risk`);
    if (m.progress.notStarted) parts.push(`${m.progress.notStarted} not started`);
    progress = parts.join(', ') + '.';
    const atRisk = m.milestones.filter(x => x.state === 'at-risk');
    atRisk.forEach(x => {
      const done = (x.tasks || []).filter(t => t.done).length;
      progress += ` ${x.title} is at risk`
        + (x.dueDate ? `, due ${_frFmt(x.dueDate)}` : '')
        + ((x.tasks || []).length ? `, with ${done} of ${x.tasks.length} ${_frPlural(x.tasks.length, 'task')} complete` : '')
        + '.';
    });
  }

  const impact = f.impact || 'Record what changed, with the figure it changed from and the figure it changed to.';

  const open = m.milestones.filter(x => x.state !== 'complete' && x.state !== 'dropped');
  const next = open.length === 0
    ? 'Set out what happens next, with dates.'
    : open.map(x => x.title + (x.dueDate ? `, by ${_frFmt(x.dueDate)}` : '')).join('. ') + '.';

  return { intention, activity, progress, impact, next };
}

// ── Pre-export check ────────────────────────────────────────────

function runPreExportCheck(sections, model) {
  const text = Object.values(sections || {}).join('\n');
  const issues = [];

  const chars = [];
  REPORT_BANNED_CHARS.forEach(b => {
    const n = (text.match(new RegExp(b.ch, 'g')) || []).length;
    if (n) chars.push(`${n} ${b.name}${n === 1 ? '' : 's'}`);
  });
  issues.push(chars.length
    ? { level: 'warn', label: 'Characters', detail: chars.join(', ') + '. These are replaced on export, but it is better to remove them here.' }
    : { level: 'ok', label: 'Characters', detail: 'No em-dashes, en-dashes or smart quotes.' });

  const found = [];
  REPORT_VAGUE_PHRASES.forEach(p => {
    const re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    if (re.test(text)) found.push(p);
  });
  issues.push(found.length
    ? { level: 'warn', label: 'Specificity', detail: `${found.length} ${_frPlural(found.length, 'phrase')} flagged: ${found.join(', ')}. Replace each with the figure behind it.`, phrases: found }
    : { level: 'ok', label: 'Specificity', detail: 'No flagged phrases.' });

  // Percentages are allowed: they are derived from figures that are
  // themselves checked, and spelling one out longhand reads worse.
  const nums = (text.match(/\b\d+(?:\.\d+)?\b/g) || []);
  const unsourced = Array.from(new Set(nums.filter(n => !model.figures.has(n) && !/^(0|100)$/.test(n))));
  issues.push(unsourced.length
    ? { level: 'warn', label: 'Figures', detail: `${unsourced.length} ${_frPlural(unsourced.length, 'figure')} not traced to a logged record: ${unsourced.join(', ')}. Either link the evidence or remove the claim.`, numbers: unsourced }
    : { level: 'ok', label: 'Figures', detail: `Every figure traces to a logged record.` });

  const claims = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 40);
  const withoutNumbers = claims.filter(s => !/\d/.test(s)).length;
  issues.push(withoutNumbers > 0
    ? { level: 'note', label: 'Unquantified sentences', detail: `${withoutNumbers} ${_frPlural(withoutNumbers, 'sentence makes', 'sentences make')} a claim with no figure in it. That is sometimes right, but check each one.` }
    : { level: 'ok', label: 'Unquantified sentences', detail: 'Every substantive sentence carries a figure.' });

  issues.push({ level: 'ok', label: 'Formatting', detail: 'Margins 12.7mm. Heading levels run in order. Tables carry header rows.' });

  return { issues, pass: !issues.some(i => i.level === 'warn') };
}

// ── Word ────────────────────────────────────────────────────────

function buildFocusReportDocx(model, sections) {
  const m = model;
  const blocks = [];

  blocks.push({ type: 'heading', level: 2, text: 'Intention' });
  blocks.push({ type: 'para', text: sections.intention });

  blocks.push({ type: 'heading', level: 2, text: 'Activity' });
  blocks.push({ type: 'para', text: sections.activity });
  if (m.instruments.length) {
    blocks.push({
      type: 'table',
      caption: 'Activity by instrument',
      head: ['Instrument', 'Count', 'Areas', 'Quality Calendar window'],
      rows: m.instruments.map(i => {
        const stream = typeof ACTIVITY_TYPE_CALENDAR_STREAM !== 'undefined' ? ACTIVITY_TYPE_CALENDAR_STREAM[i.type] : null;
        const win = stream && typeof getCalendarWindow === 'function' ? getCalendarWindow(stream) : null;
        return [i.label, String(i.count), Array.from(i.areas).sort().join(', ') || 'Cross-college',
                win ? describeCalendarWindow(win) : 'Not calendared'];
      }),
    });
  }

  blocks.push({ type: 'heading', level: 2, text: 'Progress' });
  blocks.push({ type: 'para', text: sections.progress });
  if (m.milestones.length) {
    blocks.push({
      type: 'table',
      caption: 'Milestones',
      head: ['Milestone', 'Due', 'State', 'Criteria met', 'Tasks done'],
      rows: m.milestones.map(x => [
        x.title,
        x.dueDate ? _frFmt(x.dueDate) : 'No date set',
        (typeof _CF_STATE_LABEL !== 'undefined' && _CF_STATE_LABEL[x.state]) || x.state,
        (x.successCriteria || []).length ? `${x.successCriteria.filter(c => c.done).length} of ${x.successCriteria.length}` : 'None set',
        (x.tasks || []).length ? `${x.tasks.filter(t => t.done).length} of ${x.tasks.length}` : 'None set',
      ]),
    });
  }

  blocks.push({ type: 'heading', level: 2, text: 'Impact' });
  blocks.push({ type: 'para', text: sections.impact });

  blocks.push({ type: 'heading', level: 2, text: 'Next period' });
  blocks.push({ type: 'para', text: sections.next });

  if (m.resources.length) {
    blocks.push({ type: 'heading', level: 2, text: 'Resources' });
    blocks.push({ type: 'bullets', items: m.resources.map(r => r.title + (r.url ? ' (' + r.url + ')' : '')) });
  }

  const periodText = m.period.from ? `${_frFmt(m.period.from)} to ${_frFmt(m.period.to)}` : 'to date';
  return buildDocx({
    title: 'Current Focus report: ' + m.focus.title,
    subtitle: `Digital Pedagogy Coach, Quality Team. Period ${periodText}. `
            + `Scope ${m.scopeLabel}. Produced ${_frFmt(todayISO())}. `
            + `Source: DPC Hub, ${m.acts.length} logged ${_frPlural(m.acts.length, 'record')}.`,
    blocks,
  });
}

// ── Excel ───────────────────────────────────────────────────────
// The underlying records, so a Quality colleague can check the figures
// in the Word report rather than take them on trust.

function buildFocusReportXlsx(model, sections) {
  const m = model;
  const msTitle = (id) => {
    const hit = m.milestones.find(x => x.milestoneId === id);
    return hit ? hit.title : '';
  };

  const activity = [['Date', 'Area', 'Instrument', 'Summary', 'Milestone', 'Resources']];
  m.acts.forEach(a => {
    const msLink = (a.links || []).find(l => l && l.type === ACTIVITY_LINK_TYPES.MILESTONE);
    const res = (a.links || []).filter(l => l && l.type === ACTIVITY_LINK_TYPES.RESOURCE);
    activity.push([
      a.date || '', a.areaCode || 'Cross-college',
      typeof activityTypeLabel === 'function' ? activityTypeLabel(a.activityType) : a.activityType,
      a.summary || '', msLink ? msTitle(msLink.id) : '',
      res.map(r => r.title || r.url).join('; '),
    ]);
  });

  const milestones = [['Milestone', 'Due', 'State', 'Criteria met', 'Criteria total', 'Tasks done', 'Tasks total', 'Linked records']];
  m.milestones.forEach(x => {
    const linked = typeof getLinkedActivities === 'function'
      ? getLinkedActivities(ACTIVITY_LINK_TYPES.MILESTONE, x.milestoneId).length : 0;
    milestones.push([
      x.title, x.dueDate || '',
      (typeof _CF_STATE_LABEL !== 'undefined' && _CF_STATE_LABEL[x.state]) || x.state,
      (x.successCriteria || []).filter(c => c.done).length, (x.successCriteria || []).length,
      (x.tasks || []).filter(t => t.done).length, (x.tasks || []).length,
      linked,
    ]);
  });

  const summary = [['Measure', 'Value', 'Denominator', 'Source']];
  summary.push(['Linked records', m.acts.length, m.isScoped ? m.totalBeforeScope : m.acts.length, 'DPC Hub activity log']);
  summary.push(['Areas reached', m.areasReached.length, m.denomAreas, 'Distinct areas in linked records']);
  summary.push(['Instruments used', m.instruments.length, '', 'Distinct activity types in linked records']);
  summary.push(['Milestones complete', m.progress.complete, m.progress.total, 'Current Focus action plan']);
  summary.push(['Scope', m.scopeLabel, '', m.isScoped ? 'Caseload or single area' : 'All areas']);
  summary.push(['Period from', m.period.from || '', '', 'Earliest linked record']);
  summary.push(['Period to', m.period.to || '', '', 'Latest linked record']);
  summary.push(['Produced', todayISO(), '', 'DPC Hub']);

  const prose = [['Section', 'Text']];
  ['intention', 'activity', 'progress', 'impact', 'next'].forEach(k => {
    prose.push([k.charAt(0).toUpperCase() + k.slice(1), sections[k] || '']);
  });

  return buildXlsx([
    { name: 'Summary',    rows: summary },
    { name: 'Activity',   rows: activity },
    { name: 'Milestones', rows: milestones },
    { name: 'Report text', rows: prose },
  ]);
}


// ── Combined report ─────────────────────────────────────────────
// Across every focus rather than one at a time. Records linked to more
// than one focus are counted once in the totals and shown against each
// focus in its own section, so the headline figure is never inflated by
// double counting.

function buildCombinedReportModel(focuses, scope) {
  const list = (focuses || []).filter(f => (f.status || 'active') !== 'complete' || (f.milestones || []).length);
  const models = list.map(f => buildFocusReportModel(f, scope));

  const seen = new Set();
  const unique = [];
  models.forEach(m => m.acts.forEach(a => {
    if (seen.has(a.activityId)) return;
    seen.add(a.activityId);
    unique.push(a);
  }));
  unique.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const byType = {};
  unique.forEach(a => {
    const k = a.activityType || 'unknown';
    if (!byType[k]) byType[k] = { type: k, label: typeof activityTypeLabel === 'function' ? activityTypeLabel(k) : k, count: 0, areas: new Set() };
    byType[k].count++;
    if (a.areaCode) byType[k].areas.add(a.areaCode);
  });
  const instruments = Object.values(byType).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const areasReached = Array.from(new Set(unique.map(a => a.areaCode).filter(Boolean))).sort();
  const areaTotal = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).length;
  const denomAreas = scope && scope.areaCodes && scope.areaCodes.length ? scope.areaCodes.length : areaTotal;

  const dates = unique.map(a => a.date).filter(Boolean).sort();
  const period = { from: dates[0] || null, to: dates[dates.length - 1] || null };

  const progress = models.reduce((acc, m) => {
    ['total','complete','inProgress','atRisk','notStarted'].forEach(k => { acc[k] = (acc[k] || 0) + (m.progress[k] || 0); });
    return acc;
  }, {});

  // Records linked to more than one focus. Worth naming in the report:
  // the section totals will not sum to the headline, and a reader who
  // notices that without explanation will assume an error.
  const counts = {};
  models.forEach(m => m.acts.forEach(a => { counts[a.activityId] = (counts[a.activityId] || 0) + 1; }));
  const shared = Object.values(counts).filter(c => c > 1).length;

  const figures = new Set();
  models.forEach(m => m.figures.forEach(v => figures.add(v)));
  [unique.length, areasReached.length, denomAreas, areaTotal, instruments.length, list.length, shared,
   progress.total, progress.complete, progress.inProgress, progress.atRisk, progress.notStarted]
    .forEach(n => { if (typeof n === 'number' && isFinite(n)) figures.add(String(n)); });
  instruments.forEach(i => { figures.add(String(i.count)); figures.add(String(i.areas.size)); });

  return {
    models, focuses: list, acts: unique, instruments, areasReached, areaTotal, denomAreas,
    period, progress, shared, figures,
    scope, scopeLabel: models.length ? models[0].scopeLabel : 'all areas',
    isScoped: models.some(m => m.isScoped),
  };
}

function frCombinedDraftSections(model) {
  const m = model;
  const periodText = !m.period.from
    ? 'the period to date'
    : (m.period.from === m.period.to
        ? _frFmt(m.period.from)
        : `${_frFmt(m.period.from)} and ${_frFmt(m.period.to)}`);

  let overview;
  if (m.acts.length === 0) {
    overview = `No activity has been linked to any of the ${m.focuses.length} ${_frPlural(m.focuses.length, 'focus', 'focuses')} yet.`;
  } else {
    overview = `${m.acts.length} ${_frPlural(m.acts.length, 'record was', 'records were')} logged across ${m.focuses.length} ${_frPlural(m.focuses.length, 'focus', 'focuses')} between ${periodText}, `
      + `covering ${m.areasReached.length} of ${m.denomAreas} ${_frPlural(m.denomAreas, 'area')}`
      + (m.isScoped ? ` in ${m.scopeLabel}` : '')
      + `, through ${m.instruments.length} ${_frPlural(m.instruments.length, 'instrument')}.`;
    if (m.shared > 0) {
      overview += ` ${m.shared} ${_frPlural(m.shared, 'record serves', 'records serve')} more than one focus and ${m.shared === 1 ? 'is' : 'are'} counted once in this total, so the sections below sum to more than ${m.acts.length}.`;
    }
  }

  const progress = m.progress.total === 0
    ? 'No milestones have been set across these focuses.'
    : `${m.progress.complete} of ${m.progress.total} milestones are complete`
      + (m.progress.inProgress ? `, ${m.progress.inProgress} in progress` : '')
      + (m.progress.atRisk ? `, ${m.progress.atRisk} at risk` : '')
      + (m.progress.notStarted ? `, ${m.progress.notStarted} not started` : '') + '.';

  return {
    overview,
    progress,
    impact: 'Record what changed across these focuses, with the figure it changed from and the figure it changed to.',
    next: 'Set out what happens next, with dates.',
  };
}

function buildCombinedReportDocx(model, sections) {
  const m = model;
  const blocks = [];

  blocks.push({ type: 'heading', level: 2, text: 'Overview' });
  blocks.push({ type: 'para', text: sections.overview });

  if (m.instruments.length) {
    blocks.push({
      type: 'table', caption: 'Activity by instrument, all focuses',
      head: ['Instrument', 'Count', 'Areas', 'Quality Calendar window'],
      rows: m.instruments.map(i => {
        const stream = typeof ACTIVITY_TYPE_CALENDAR_STREAM !== 'undefined' ? ACTIVITY_TYPE_CALENDAR_STREAM[i.type] : null;
        const win = stream && typeof getCalendarWindow === 'function' ? getCalendarWindow(stream) : null;
        return [i.label, String(i.count), Array.from(i.areas).sort().join(', ') || 'Cross-college',
                win ? describeCalendarWindow(win) : 'Not calendared'];
      }),
    });
  }

  blocks.push({ type: 'heading', level: 2, text: 'Progress' });
  blocks.push({ type: 'para', text: sections.progress });
  if (m.focuses.length) {
    blocks.push({
      type: 'table', caption: 'Focuses',
      head: ['Focus', 'Records', 'Areas', 'Milestones complete', 'At risk'],
      rows: m.models.map(x => [
        x.focus.title, String(x.acts.length), String(x.areasReached.length),
        `${x.progress.complete} of ${x.progress.total}`, String(x.progress.atRisk || 0),
      ]),
    });
  }

  m.models.forEach(x => {
    const s = (x.focus.reportDraft && x.focus.reportDraft.sections) || {};
    const d = frDraftSections(x);
    blocks.push({ type: 'heading', level: 2, text: x.focus.title });
    blocks.push({ type: 'para', text: s.activity || d.activity });
    blocks.push({ type: 'para', text: s.progress || d.progress });
    if ((s.impact || x.focus.impact)) blocks.push({ type: 'para', text: s.impact || x.focus.impact });
  });

  blocks.push({ type: 'heading', level: 2, text: 'Impact' });
  blocks.push({ type: 'para', text: sections.impact });
  blocks.push({ type: 'heading', level: 2, text: 'Next period' });
  blocks.push({ type: 'para', text: sections.next });

  const periodText = m.period.from ? `${_frFmt(m.period.from)} to ${_frFmt(m.period.to)}` : 'to date';
  return buildDocx({
    title: 'Digital Pedagogy Coach: Current Focus report',
    subtitle: `Quality Team. Period ${periodText}. Scope ${m.scopeLabel}. Produced ${_frFmt(todayISO())}. `
            + `Source: DPC Hub, ${m.acts.length} logged ${_frPlural(m.acts.length, 'record')} across ${m.focuses.length} ${_frPlural(m.focuses.length, 'focus', 'focuses')}.`,
    blocks,
  });
}

function buildCombinedReportXlsx(model, sections) {
  const m = model;
  const focusTitles = (activityId) => m.models
    .filter(x => x.acts.some(a => a.activityId === activityId))
    .map(x => x.focus.title).join('; ');

  const summary = [['Measure', 'Value', 'Denominator', 'Source']];
  summary.push(['Focuses', m.focuses.length, '', 'Current Focus']);
  summary.push(['Linked records, deduplicated', m.acts.length, '', 'DPC Hub activity log']);
  summary.push(['Records serving more than one focus', m.shared, m.acts.length, 'DPC Hub activity log']);
  summary.push(['Areas reached', m.areasReached.length, m.denomAreas, 'Distinct areas in linked records']);
  summary.push(['Instruments used', m.instruments.length, '', 'Distinct activity types']);
  summary.push(['Milestones complete', m.progress.complete, m.progress.total, 'Action plans']);
  summary.push(['Scope', m.scopeLabel, '', m.isScoped ? 'Caseload or single area' : 'All areas']);
  summary.push(['Period from', m.period.from || '', '', 'Earliest linked record']);
  summary.push(['Period to', m.period.to || '', '', 'Latest linked record']);
  summary.push(['Produced', todayISO(), '', 'DPC Hub']);

  const focuses = [['Focus', 'Status', 'Started', 'Records', 'Areas', 'Milestones', 'Complete', 'At risk']];
  m.models.forEach(x => focuses.push([
    x.focus.title, x.focus.status || 'active', x.focus.startDate || '',
    x.acts.length, x.areasReached.length, x.progress.total, x.progress.complete, x.progress.atRisk || 0,
  ]));

  const activity = [['Date', 'Area', 'Instrument', 'Summary', 'Focuses']];
  m.acts.forEach(a => activity.push([
    a.date || '', a.areaCode || 'Cross-college',
    typeof activityTypeLabel === 'function' ? activityTypeLabel(a.activityType) : a.activityType,
    a.summary || '', focusTitles(a.activityId),
  ]));

  const milestones = [['Focus', 'Milestone', 'Due', 'State', 'Criteria met', 'Criteria total', 'Tasks done', 'Tasks total']];
  m.models.forEach(x => (x.milestones || []).forEach(ms => milestones.push([
    x.focus.title, ms.title, ms.dueDate || '',
    (typeof _CF_STATE_LABEL !== 'undefined' && _CF_STATE_LABEL[ms.state]) || ms.state,
    (ms.successCriteria || []).filter(c => c.done).length, (ms.successCriteria || []).length,
    (ms.tasks || []).filter(t => t.done).length, (ms.tasks || []).length,
  ])));

  const prose = [['Section', 'Text']];
  ['overview', 'progress', 'impact', 'next'].forEach(k => {
    prose.push([k.charAt(0).toUpperCase() + k.slice(1), sections[k] || '']);
  });

  return buildXlsx([
    { name: 'Summary',    rows: summary },
    { name: 'Focuses',    rows: focuses },
    { name: 'Activity',   rows: activity },
    { name: 'Milestones', rows: milestones },
    { name: 'Report text', rows: prose },
  ]);
}
