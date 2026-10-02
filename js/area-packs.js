// DPC Hub · js/area-packs.js · v1.0 · 02/10/26 · Session RAG-4 — DA&I Day area packs: one styled Excel workbook per area for Heads of Area and Digital Leads
// Each workbook has an Overview tab (staff reviewed, who is booked for
// 23 October and when, the area's current Health Check position, key
// concerns, strengths and a "where we are now" starter for the Area Action
// Plan) and one tab per member of staff (their Health Check scores, what
// was seen, agreed actions, and the three things to focus on first).
//
// Sources, all read at the moment of generating, so the pack is as current
// as the Data folder:
//   - Health Checks: the Hub's imported reviews (latest check per person).
//   - Attendance: any .xlsx in the Data folder with "attendance" in its
//     name (Area-attendance-template). One tab per area; columns are found
//     by their headings, and any column not recognised is still carried
//     into the person's tab word for word, so new columns (a timetable,
//     groups) appear without a code change.
//   - Support priority and suggested RAG: support-priority.js and
//     ragevidence.js.
//
// The Overview never ranks named individuals (Area Action Plan principle:
// areas, never individuals). Individual detail sits only on each person's
// own tab.
//
// ExcelJS (lib/exceljs.min.js, MIT) is loaded only when a pack is built.
//
// Exports: apFindAttendance(), apBuildAreaWorkbook(areaCode, attendance),
//          apRenderPanel(body), AP_FIRST_ACTIONS

const AP_FIRST_ACTIONS = Object.freeze({
  usesAccessibilityChecker: 'Run the Accessibility Checker (Review tab, Check Accessibility) before sharing anything, and fix every error it lists.',
  altTextOnImages: 'Add alt text that says what each image shows and why it matters. Mark purely decorative images as decorative.',
  colourContrastChecked: 'Check text and background colours have enough contrast (4.5:1 for normal text). The Accessibility Checker flags hard-to-read text.',
  captionsTranscripts: 'Turn on captions for every video you share, check they are accurate, and give a transcript for audio.',
  accessibleAssignmentBriefs: 'Rebuild assignment briefs with built-in Heading styles, a readable font and short, chunked instructions.',
  offersImmersiveReader: 'Show learners how to open Immersive Reader in Teams and Word, and offer it to the whole group.',
  mentionsATTools: 'Name one assistive tool in each lesson (Read&Write, Dictate or Live Captions) and show how to start it.',
  accessibilityUniversal: 'Present accessibility tools as useful for everyone, not only for learners with SEND.',
  learnersPersonalise: 'Give learners time to set up their own view: text size, Immersive Reader settings, captions.',
  atEmbeddedRoutine: 'Plan assistive technology into the lesson from the start, not only when someone struggles.',
  awareOfSENDNeeds: "Check the group's SEND information and make one digital adjustment that follows from it.",
  appliesUDL: 'Offer content in more than one format (text, audio or video) and more than one way to respond.',
  digitalAlternatives: 'Give learners a real choice of how to complete or submit at least one task.',
  equitableResources: 'Use plain language, a clear layout and accessible design in every resource.',
  inclusionVsSkills: 'When a learner struggles, first decide whether it is an access barrier or a skills gap, then respond to that.',
  folderStructureLogical: 'Tidy Teams and SharePoint folders into a clear, labelled structure learners can find their way around.',
  gdprCompliantSharing: 'Remove personal learner data from open files and links. Share with named people only.',
  versionControl: 'Stop saving "final_v3" copies. Keep one file and use OneDrive version history.',
  namingConventions: 'Agree one naming pattern for files and folders, and use it.',
  resourcesReviewedRegularly: 'Review resources before each delivery and remove out-of-date material.',
  teamsSpaceOrganised: 'Set up clear channels, pin key resources and keep the Team active.',
  postsClearProfessional: 'Keep Teams posts short, timely and easy to understand.',
  appropriateFeatures: 'Use Assignments, tabs and announcements on purpose, rather than everything in one chat.',
  resourcesProactivelyShared: 'Share resources before or alongside the lesson, not afterwards.',
  communicationAccessible: 'Use plain language, alt text and accessible formatting in posts.',
});

const AP_SCORE_LABEL = { 1: 'Urgent', 2: 'Challenged', 3: 'Developing', 4: 'On Track', 5: 'Confident' };
const AP_FIRST_GATE = Object.freeze([
  { id: 'usesAccessibilityChecker', text: 'Accessibility Checker run and cleared before anything is shared' },
  { id: 'offersImmersiveReader', text: 'Immersive Reader shown to every learner' },
]);

// ── Helpers ───────────────────────────────────────────────────
function _apEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _apAvg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function _ap2(x) { return x == null ? '' : Math.round(x * 100) / 100; }
function _apNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function _apFmt(iso) {
  if (!iso) return '';
  try { return new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return String(iso); }
}
function _apIndicators() {
  const out = [];
  (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).forEach(fa => fa.indicators.forEach(i => out.push({ ...i, domain: fa.id, domainLabel: fa.label })));
  return out;
}
function _apAreas() { return (typeof _getAreas === 'function' ? _getAreas() : ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [])) || []; }
function _apStaff() { return (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []; }
function _apReviews() { return (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || []; }

function _apLatestByStaff(areaCode) {
  const by = {};
  _apReviews().forEach(r => {
    if (areaCode && r.areaCode !== areaCode) return;
    const k = r.staffId || r.reviewId;
    if (!by[k] || String(r.date) > String(by[k].date)) by[k] = r;
  });
  return by;
}

// Per-indicator stats over a set of reviews.
function _apIndicatorStats(reviews) {
  return _apIndicators().map(ind => {
    const vals = reviews.map(r => r.domains && r.domains[ind.domain] && r.domains[ind.domain].indicatorScores && r.domains[ind.domain].indicatorScores[ind.id]).filter(v => typeof v === 'number');
    return { ...ind, n: vals.length, avg: _apAvg(vals), low: vals.filter(v => v <= 2).length, lowShare: vals.length ? vals.filter(v => v <= 2).length / vals.length : null };
  });
}

// ── Attendance list (Area-attendance-template) ────────────────
async function apFindAttendance() {
  if (typeof listFolderFiles !== 'function' || typeof hasFolderAccess === 'function' && !hasFolderAccess()) return null;
  const files = await listFolderFiles(n => /\.xlsx$/i.test(n) && !n.startsWith('~$') && /attendance/i.test(n));
  if (!files.length) return null;
  const { bytes, name, lastModified } = await readFolderFileBytes(files[0].name);
  return { name, lastModified, ...apParseAttendance(bytes) };
}

// One tab per area. Header row = the first of the top 15 rows with a
// "name" column. Recognised columns are mapped; everything else is kept.
function apParseAttendance(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const codes = _apAreas().map(a => a.areaCode);
  const people = [], sheets = [];
  const cellText = v => {
    if (v == null) return '';
    if (typeof v === 'number' && v > 0 && v < 1) { // a time of day
      const mins = Math.round(v * 24 * 60); return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
    return String(v).trim();
  };
  wb.SheetNames.forEach(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
    const hi = rows.slice(0, 15).findIndex(r => (r || []).some(c => /\bname\b|staff member|^staff$/i.test(String(c || ''))));
    if (hi < 0) return;
    const head = rows[hi].map(h => String(h == null ? '' : h).trim());
    const find = re => head.findIndex(h => re.test(h));
    const c = {
      name: find(/\bname\b|staff member|^staff$/i),
      attending: find(/attend|on the day|will they be|available|there on/i),
      session: find(/session/i),
      subgroup: find(/sub[\s-]*group/i),
      group: head.findIndex(h => /group/i.test(h) && !/sub[\s-]*group/i.test(h)),
      notes: find(/note|comment|taster/i),
      role: find(/role|job/i),
    };
    // Area for this tab: codes named in the sheet name, else in the rows above the header.
    const scan = [sn, ...rows.slice(0, hi).map(r => (r || []).join(' '))].join(' ').toUpperCase();
    const tabCodes = codes.filter(code => new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`).test(scan));
    sheets.push({ sheet: sn, codes: tabCodes, columns: head.filter(Boolean) });
    rows.slice(hi + 1).forEach(r => {
      const name = c.name >= 0 ? cellText(r[c.name]) : '';
      if (!name) return;
      const get = i => (i >= 0 ? cellText(r[i]) : '');
      const att = get(c.attending);
      const extra = {};
      head.forEach((h, i) => { if (h && !Object.values(c).includes(i)) { const v = cellText(r[i]); if (v) extra[h] = v; } });
      people.push({
        name, sheet: sn, codes: tabCodes,
        attending: /^(y|yes|true|attending|✓)/i.test(att) ? true : /^(n|no|false|not)/i.test(att) ? false : null,
        attendingText: att, session: get(c.session), group: get(c.group), subgroup: get(c.subgroup),
        role: get(c.role), notes: get(c.notes), extra,
      });
    });
  });
  return { people, sheets };
}

// Match a name to a Hub staff record (exact, case-insensitive).
function _apMatchStaff(name, areaCode) {
  const n = _apNorm(name);
  const pool = _apStaff().filter(s => _apNorm(s.name) === n);
  return pool.find(s => s.areaCode === areaCode) || pool[0] || null;
}

// Everyone in the area: Hub staff for the area, anyone reviewed in it, and
// anyone on the area's attendance tab.
function _apAreaPeople(areaCode, attendance) {
  const latest = _apLatestByStaff(areaCode);
  const map = new Map();
  const key = (staff, name) => (staff ? 'id:' + staff.staffId : 'n:' + _apNorm(name));
  _apStaff().filter(s => s.areaCode === areaCode && !s.archived).forEach(s => map.set(key(s), { staff: s, name: s.name }));
  Object.values(latest).forEach(r => {
    const s = _apStaff().find(x => x.staffId === r.staffId);
    const k = key(s, s ? s.name : 'Unknown');
    if (!map.has(k)) map.set(k, { staff: s || null, name: s ? s.name : 'Unknown' });
  });
  ((attendance && attendance.people) || []).forEach(p => {
    const s = _apMatchStaff(p.name, areaCode);
    // Matched people go to their own area; unmatched people go to the
    // tab's area, or the first area named on a shared tab (e.g. AGF / PAP).
    const inArea = s ? (s.areaCode === areaCode || !!latest[s.staffId]) : p.codes[0] === areaCode;
    if (!inArea) return;
    const k = key(s, p.name);
    const cur = map.get(k) || { staff: s, name: s ? s.name : p.name };
    cur.attend = p;
    map.set(k, cur);
  });
  return [...map.values()].map(x => ({ ...x, review: x.staff ? latest[x.staff.staffId] || null : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── ExcelJS loading and styling ───────────────────────────────
let _apExcelJSPromise = null;
function _apLoadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (_apExcelJSPromise) return _apExcelJSPromise;
  _apExcelJSPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'lib/exceljs.min.js';
    s.onload = () => resolve(window.ExcelJS);
    s.onerror = () => { _apExcelJSPromise = null; reject(new Error('Could not load lib/exceljs.min.js')); };
    document.head.appendChild(s);
  });
  return _apExcelJSPromise;
}

const AP_STYLE = {
  font: 'Arial',
  navy: 'FF1D3557', teal: 'FF0F766E', headFill: 'FFE2EDEC', sectionFill: 'FFF1F5F9', border: 'FFCBD5E1',
  // Score fills: light backgrounds, dark text, label always in words.
  scoreFill: { 1: 'FFFEE2E2', 2: 'FFFFEDD5', 3: 'FFFEF9C3', 4: 'FFDCFCE7', 5: 'FFD1FAE5' },
};

function _apSheetHelpers(ws, valueSpan = 2) {
  let r = 1;
  const font = (o = {}) => ({ name: AP_STYLE.font, size: o.size || 11, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || 'FF1E293B' } });
  const thin = { style: 'thin', color: { argb: AP_STYLE.border } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  return {
    get row() { return r; },
    gap(n = 1) { r += n; },
    title(text, sub) {
      const c = ws.getCell(r, 1); c.value = text; c.font = font({ size: 16, bold: true, color: AP_STYLE.navy }); r++;
      if (sub) { const s = ws.getCell(r, 1); s.value = sub; s.font = font({ italic: true, color: 'FF475569' }); r++; }
      r++;
    },
    section(text, span = 4) {
      for (let i = 1; i <= span; i++) ws.getCell(r, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AP_STYLE.sectionFill } };
      const c = ws.getCell(r, 1); c.value = text; c.font = font({ size: 13, bold: true, color: AP_STYLE.teal }); r++;
    },
    pairs(list) {
      list.forEach(([k, v]) => {
        const a = ws.getCell(r, 1), b = ws.getCell(r, 2);
        a.value = k; a.font = font({ bold: true }); a.alignment = { vertical: 'top', wrapText: true };
        b.value = (v === '' || v == null) ? 'None' : v; b.font = font(); b.alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };
        if (valueSpan > 2) ws.mergeCells(r, 2, r, valueSpan);
        r++;
      });
      r++;
    },
    para(text, o = {}) {
      const c = ws.getCell(r, 1); c.value = text; c.font = font(o); c.alignment = { wrapText: true, vertical: 'top' };
      if (o.span) ws.mergeCells(r, 1, r, o.span);
      r++;
    },
    table(head, rows, opts = {}) {
      head.forEach((h, i) => {
        const c = ws.getCell(r, i + 1); c.value = h; c.font = font({ bold: true, color: AP_STYLE.navy });
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AP_STYLE.headFill } }; c.border = box;
        c.alignment = { wrapText: true, vertical: 'top' };
      });
      r++;
      if (!rows.length) { const c = ws.getCell(r, 1); c.value = opts.empty || 'None'; c.font = font({ italic: true, color: 'FF475569' }); r++; }
      rows.forEach(row => {
        row.forEach((v, i) => {
          const c = ws.getCell(r, i + 1); c.value = v == null ? '' : v; c.font = font(); c.border = box;
          c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
          if (opts.scoreCol === i && typeof v === 'string') {
            const n = parseInt(v, 10);
            if (AP_STYLE.scoreFill[n]) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AP_STYLE.scoreFill[n] } };
          }
        });
        r++;
      });
      r++;
    },
  };
}

// Excel sheet names: 31 characters, none of []:*?/\ and unique.
function _apSheetName(name, used) {
  let base = String(name || 'Staff').replace(/[\[\]:*?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Staff';
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

// ── Workbook ──────────────────────────────────────────────────
async function apBuildAreaWorkbook(areaCode, attendance) {
  const ExcelJS = await _apLoadExcelJS();
  const area = _apAreas().find(a => a.areaCode === areaCode);
  if (!area) throw new Error('Unknown area ' + areaCode);
  const people = _apAreaPeople(areaCode, attendance);
  const reviewed = people.filter(p => p.review);
  const latestReviews = reviewed.map(p => p.review);
  const areaStats = _apIndicatorStats(latestReviews);
  const collegeStats = _apIndicatorStats(Object.values(_apLatestByStaff(null)));
  const sp = typeof hcSupportAnalysis === 'function' ? hcSupportAnalysis() : null;
  const spArea = sp ? sp.areas.find(a => a.areaCode === areaCode) : null;
  const rag = typeof getAreaEvidenceRAG === 'function' ? getAreaEvidenceRAG(areaCode) : null;
  const dl = rag && rag.dl && rag.dl.present ? rag.dl.name : '';
  const avgOf = rs => _apAvg(rs.map(r => _apAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null))).filter(v => v != null));
  const areaAvg = avgOf(latestReviews), collegeAvg = avgOf(Object.values(_apLatestByStaff(null)));
  const today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DPC Hub'; wb.created = new Date();
  wb.title = `${area.areaCode} DA&I Day area pack`;

  // ── Overview ──
  const ov = wb.addWorksheet('Overview', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ov.columns = [{ width: 44 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 56 }, { width: 22 }, { width: 22 }];
  const o = _apSheetHelpers(ov, 5);
  o.title(`${area.areaCode} ${area.areaName}: Digital Accessibility and Inclusion`, `Area pack for the DA&I Day, 23 October 2026. Prepared ${_apFmt(today)} from the DPC Hub.`);

  const booked = people.filter(p => p.attend && p.attend.attending === true).length;
  const notAttending = people.filter(p => p.attend && p.attend.attending === false).length;
  o.section('At a glance', 6);
  o.pairs([
    ['Head of Area', area.hoaName || ''],
    ['Digital Lead', dl],
    ['Staff in this pack', people.length],
    ['Staff reviewed (Health Check)', `${reviewed.length} of ${people.length}`],
    ['Average practice score', areaAvg != null ? `${_ap2(areaAvg)} of 5 (college ${_ap2(collegeAvg)})` : 'No Health Checks yet'],
    ['Support priority', spArea ? `${_ap2(spArea.priority)} of 7 (${spArea.band.label})` : 'None yet'],
    ['Main support need', spArea ? spArea.mainNeed : ''],
    ['Booked for 23 October', attendance ? `${booked} attending, ${notAttending} not attending, ${people.filter(p => !p.attend).length} not on the list` : 'Attendance list not found in the Data folder'],
  ]);

  // 23 October
  o.section('23 October: who is booked and when', 6);
  if (attendance) {
    // Only the columns the attendance list actually uses, notes last.
    const att = people.filter(p => p.attend).map(p => p.attend);
    const used = k => att.some(a => a[k]);
    const extraCols = _apUniq(att.flatMap(a => Object.keys(a.extra))).slice(0, 3);
    const cols = [['session', 'Session'], ['group', 'Group'], ['subgroup', 'Sub-group']].filter(([k]) => used(k));
    const notes = used('notes');
    o.table(['Name', 'Attending', ...cols.map(c => c[1]), ...(notes ? ['Notes'] : []), ...extraCols],
      people.map(p => p.attend
        ? [p.name, p.attend.attendingText || (p.attend.attending ? 'Yes' : ''), ...cols.map(([k]) => p.attend[k]), ...(notes ? [p.attend.notes] : []), ...extraCols.map(k => p.attend.extra[k] || '')]
        : [p.name, 'Not on the attendance list', ...cols.map(() => ''), ...(notes ? [''] : []), ...extraCols.map(() => '')]));
    const bySession = {};
    people.filter(p => p.attend && p.attend.attending !== false).forEach(p => { const k = p.attend.session || 'Not set'; bySession[k] = (bySession[k] || 0) + 1; });
    if (Object.keys(bySession).length) o.table(['Session', 'Staff'], Object.entries(bySession).sort().map(([k, v]) => [k, v]));
  } else {
    o.para('The attendance list (Area-attendance-template) was not found in the Data folder when this pack was made.', { italic: true, span: 6 });
    o.gap();
  }

  // Where the area is now
  o.section('Where the area is now (Health Checks, latest check per person)', 6);
  if (reviewed.length) {
    const domRows = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).map(fa => {
      const v = latestReviews.map(r => r.domains && r.domains[fa.id] && r.domains[fa.id].avgScore).filter(x => x != null);
      const cv = Object.values(_apLatestByStaff(null)).map(r => r.domains && r.domains[fa.id] && r.domains[fa.id].avgScore).filter(x => x != null);
      return v.length ? [fa.label, v.length, _ap2(_apAvg(v)), cv.length ? _ap2(_apAvg(cv)) : ''] : null;
    }).filter(Boolean);
    o.table(['Focus area', 'Staff reviewed', 'Area average (1 to 5)', 'College average'], domRows);

    const concerns = areaStats.filter(s => s.n && s.low).sort((a, b) => b.lowShare - a.lowShare || a.avg - b.avg).slice(0, 6);
    o.table(['Key concerns: indicators most often scored 1 or 2', 'Staff scoring 1 or 2', 'Area average', 'College average', 'First action for the team'],
      concerns.map(s => { const c = collegeStats.find(x => x.id === s.id); return [s.label, `${s.low} of ${s.n}`, _ap2(s.avg), c && c.avg != null ? _ap2(c.avg) : '', AP_FIRST_ACTIONS[s.id] || '']; }),
      { empty: 'No indicator was scored 1 or 2.' });
    const strengths = areaStats.filter(s => s.n && s.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 5);
    o.table(['Strengths: indicators averaging 4 or more', 'Staff reviewed', 'Area average'], strengths.map(s => [s.label, s.n, _ap2(s.avg)]), { empty: 'No indicator averages 4 or more yet.' });
  } else {
    o.para('No Health Checks have been completed in this area yet.', { italic: true, span: 6 });
    o.gap();
  }

  // Area Action Plan starter
  o.section('Starting point for your Area Action Plan (sections 2 and 3)', 6);
  const gate = AP_FIRST_GATE.map(g => { const s = areaStats.find(x => x.id === g.id); return [g.text, s && s.n ? `Average ${_ap2(s.avg)} of 5 from ${s.n} staff; ${s.low} scored 1 or 2` : 'Not yet reviewed']; });
  o.table(['First gate expectation', 'Where we are now'], gate);
  const topGaps = areaStats.filter(s => s.n && s.low).sort((a, b) => b.lowShare - a.lowShare).slice(0, 3).map(s => s.label).join('; ');
  const topWell = areaStats.filter(s => s.n && s.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 3).map(s => s.label).join('; ');
  o.pairs([
    ['Health check position', reviewed.length ? `${reviewed.length} staff reviewed, average ${_ap2(areaAvg)} of 5${spArea ? `, support priority ${spArea.band.band}` : ''}` : 'Not yet reviewed'],
    ['What we already do well', topWell],
    ['Our biggest gaps', topGaps],
  ]);
  o.para('Scores: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident. Individual results are on each person\'s own tab and are not ranked here.', { italic: true, color: 'FF475569', span: 6 });

  // ── One tab per person ──
  const used = new Set(['overview']);
  people.forEach(p => {
    const ws = wb.addWorksheet(_apSheetName(p.name, used), { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 34 }, { width: 46 }, { width: 16 }, { width: 60 }];
    const h = _apSheetHelpers(ws, 4);
    const r = p.review;
    h.title(p.name, `${area.areaCode} ${area.areaName}. Prepared ${_apFmt(today)}.`);

    h.section('23 October', 4);
    if (p.attend) {
      h.pairs([
        ['Attending', p.attend.attendingText || (p.attend.attending === true ? 'Yes' : p.attend.attending === false ? 'No' : '')],
        ['Session', p.attend.session], ['Group', p.attend.group], ['Sub-group', p.attend.subgroup],
        ...Object.entries(p.attend.extra), ['Notes', p.attend.notes],
      ].filter(([k, v]) => k === 'Attending' || (v !== '' && v != null)));
    } else {
      h.para(attendance ? 'Not on the attendance list for this area.' : 'Attendance list not available when this pack was made.', { italic: true, span: 4 });
      h.gap();
    }

    if (!r) {
      h.section('Health Check', 4);
      h.para('No Health Check completed yet.', { italic: true, span: 4 });
      return;
    }
    const spStaff = sp ? sp.staff.find(s => s.staffId === r.staffId) : null;
    h.section('Health Check summary', 4);
    h.pairs([
      ['Date of check', _apFmt(r.date)],
      ['Assessor', r.assessorName || ''],
      ['Provision and level', [r.provision, r.levelOfLearning].filter(Boolean).join(', ')],
      ['Average practice score', _ap2(_apAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null))) + ' of 5'],
      ['Support priority', spStaff ? `${_ap2(spStaff.priority)} of 7 (${spStaff.band.label})` : ''],
      ['Recommended support', spStaff ? spStaff.band.support : ''],
    ]);

    // Focus first: lowest-scored indicators (3 or below), lowest first.
    const scored = [];
    Object.entries(r.domains || {}).forEach(([did, d]) => Object.entries(d.indicatorScores || {}).forEach(([iid, s]) => {
      const ind = _apIndicators().find(x => x.id === iid);
      if (ind) scored.push({ ...ind, score: s, domainData: d });
    }));
    const focus = scored.filter(x => x.score <= 3).sort((a, b) => a.score - b.score).slice(0, 3);
    h.section('Focus first: action plan', 4);
    h.table(['Priority', 'What to work on', 'Score', 'First action'],
      focus.map((x, i) => [String(i + 1), x.label, `${x.score} ${AP_SCORE_LABEL[x.score]}`, AP_FIRST_ACTIONS[x.id] || '']),
      { scoreCol: 2, empty: 'Nothing scored 3 or below. Keep doing what works and share it with the team.' });
    const agreed = Object.entries(r.domains || {}).filter(([, d]) => d.actionDescription).map(([did, d]) => [
      (typeof HC_FOCUS_AREAS !== 'undefined' ? (HC_FOCUS_AREAS.find(f => f.id === did) || {}).label : did) || did,
      d.actionDescription, d.actionLevel || '']);
    if (agreed.length) h.table(['Action agreed in the review', 'Action', 'Level'], agreed);
    if (r.priorityNextSteps) h.pairs([['Priority next steps', r.priorityNextSteps]]);

    h.section('Scores by indicator', 4);
    h.table(['Focus area', 'Indicator', 'Score', 'What was seen'],
      // "What was seen" is recorded per focus area, so show it once.
      scored.map((x, i) => [x.domainLabel, x.label, `${x.score} ${AP_SCORE_LABEL[x.score]}`, (i === 0 || scored[i - 1].domain !== x.domain) ? (x.domainData.whatWasSeen || '') : '']),
      { scoreCol: 2 });
    h.pairs([
      ['Key strengths', r.keyStrengths || ''],
      ['Areas for improvement', r.areasForImprovement || ''],
      ['Overall reflection', r.overallReflection || ''],
    ]);
  });

  return wb;
}
function _apUniq(a) { return [...new Set(a.filter(Boolean))]; }

function _apFileName(area) { return `DAI-Day-area-pack-${area.areaCode}-${(typeof todayISO === 'function' ? todayISO() : '')}.xlsx`; }

async function _apWorkbookBytes(areaCode, attendance) {
  const wb = await apBuildAreaWorkbook(areaCode, attendance);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
function _apDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ── Reports panel ─────────────────────────────────────────────
async function apRenderPanel(body) {
  if (!body) return;
  body.innerHTML = '<p role="status" class="ms-muted">Reading the attendance list from the Data folder…</p>';
  let attendance = null, attErr = '';
  try { attendance = await apFindAttendance(); } catch (e) { attErr = e.message || String(e); }
  const areas = _apAreas();
  const rows = areas.map(a => {
    const people = _apAreaPeople(a.areaCode, attendance);
    return { a, people: people.length, reviewed: people.filter(p => p.review).length, booked: people.filter(p => p.attend && p.attend.attending === true).length };
  });
  const unmatchedTabs = attendance ? attendance.sheets.filter(s => !s.codes.length).map(s => s.sheet) : [];
  body.innerHTML = `
    <div class="ms-report">
      <p class="ms-muted">One Excel workbook per area: an Overview tab, then a tab for each member of staff. Built from the Health Checks in the Hub and the attendance list in the Data folder, at the moment you press the button.</p>
      <p>${attendance ? `Attendance list: <strong>${_apEsc(attendance.name)}</strong>, ${attendance.people.length} people on ${attendance.sheets.length} tabs.` : `<strong>No attendance list found.</strong> Save Area-attendance-template.xlsx in the Data folder, keeping "attendance" in the name. ${_apEsc(attErr)}`}
      ${unmatchedTabs.length ? `<br><span class="ms-muted">Tabs with no Hub area code in their name, so their people are matched by name only: ${_apEsc(unmatchedTabs.join(', '))}.</span>` : ''}</p>
      <div class="ms-actions" style="margin:var(--space-sm) 0;">
        <button type="button" class="btn btn--primary btn--sm" id="ap-save-all">Save all to Data folder (Area packs)</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ap-select-data">Select areas with data</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ap-select-none">Clear selection</button>
      </div>
      <p id="ap-status" role="status" class="ms-muted"></p>
      <div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Areas and what each pack will contain</caption>
        <thead><tr><th scope="col">Include</th><th scope="col">Area</th><th scope="col">Staff in pack</th><th scope="col">Reviewed</th><th scope="col">Booked for 23 Oct</th><th scope="col">Download</th></tr></thead>
        <tbody>${rows.map(x => `<tr>
          <td><input type="checkbox" class="ap-pick" value="${_apEsc(x.a.areaCode)}" ${x.reviewed || x.booked ? 'checked' : ''} aria-label="Include ${_apEsc(x.a.areaCode)}"></td>
          <th scope="row">${_apEsc(x.a.areaCode)} <span class="ms-muted">${_apEsc(x.a.areaName)}</span></th>
          <td>${x.people}</td><td>${x.reviewed}</td><td>${attendance ? x.booked : 'No list'}</td>
          <td><button type="button" class="btn btn--ghost btn--sm ap-one" data-area="${_apEsc(x.a.areaCode)}">Download</button></td></tr>`).join('')}</tbody></table></div>
      <p class="ms-muted">Each pack shows individual Health Check results on that person's own tab only. Send it to the Head of Area and Digital Lead for that area.</p>
    </div>`;

  const status = t => { const el = document.getElementById('ap-status'); if (el) el.textContent = t; };
  body.querySelectorAll('.ap-one').forEach(b => b.addEventListener('click', async () => {
    const area = areas.find(a => a.areaCode === b.dataset.area);
    status(`Building ${area.areaCode}…`);
    try { _apDownload(await _apWorkbookBytes(area.areaCode, attendance), _apFileName(area)); status(`${area.areaCode} downloaded.`); }
    catch (e) { console.error(e); status('Could not build the pack: ' + e.message); }
  }));
  document.getElementById('ap-select-data')?.addEventListener('click', () => body.querySelectorAll('.ap-pick').forEach(cb => {
    const x = rows.find(r => r.a.areaCode === cb.value); cb.checked = !!(x.reviewed || x.booked);
  }));
  document.getElementById('ap-select-none')?.addEventListener('click', () => body.querySelectorAll('.ap-pick').forEach(cb => { cb.checked = false; }));
  document.getElementById('ap-save-all')?.addEventListener('click', async () => {
    const picks = [...body.querySelectorAll('.ap-pick:checked')].map(cb => cb.value);
    if (!picks.length) { status('Select at least one area.'); return; }
    if (typeof hasFolderAccess === 'function' && !hasFolderAccess()) { status('No folder connected. Use Download on each area instead.'); return; }
    let done = 0;
    for (const code of picks) {
      const area = areas.find(a => a.areaCode === code);
      status(`Building ${code} (${done + 1} of ${picks.length})…`);
      try { await saveBytesToFolder(_apFileName(area), await _apWorkbookBytes(code, attendance), 'Area packs'); done++; }
      catch (e) { console.error(e); status(`Stopped at ${code}: ${e.message}`); return; }
    }
    status(`${done} area pack${done === 1 ? '' : 's'} saved to the Data folder, in "Area packs".`);
  });
}
