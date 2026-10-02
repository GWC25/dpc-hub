// DPC Hub · js/area-packs.js · v1.1 · 02/10/26 · Session RAG-4 — matched to the real Area attendance workbook: one pack per Head of Area tab, sessions and groups per person, access and dietary needs never included
// v1.0 · 02/10/26 · Session RAG-4 — DA&I Day area packs: one styled Excel workbook per area for Heads of Area and Digital Leads
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
// Exports: apFindAttendance(), apParseAttendance(buf), apUnits(attendance),
//          apUnitPeople(unit), apBuildUnitWorkbook(unit, attendance),
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

// Area-attendance-template (v1.1, matched to the real workbook 02/10/26):
//   - one tab per Head of Area group, named by area codes, e.g. "AGF - PAP",
//     "BUI - CON - EMV - SMX", "SEL - (AG)"; B2 = curriculum area, B3 = Head
//   - header row with Name, Role / Subject Area, Attending on 23 Oct,
//     Trained for learning walks, one column per session ("Session 1 -
//     9:00 to 10:30") holding the group letter (A, B, C), Access or dietary
//     needs, Notes
//   - summary tabs (Session Totals, LW Trained, Session Groups, Area
//     Completion) and "Template - ..." tabs are skipped.
// Access or dietary needs is personal, for catering only: it is read past
// and never put in a pack. Any other unrecognised column is carried over.
const AP_SKIP_TABS = /^template\b|session totals|lw trained|session groups|area completion/i;
const AP_PRIVATE_COLS = /dietary|access needs|access or|medical|allerg/i;

function apParseAttendance(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const codes = _apAreas().map(a => a.areaCode);
  const people = [], sheets = [];
  const cellText = v => {
    if (v == null) return '';
    if (typeof v === 'number' && v > 0 && v < 1) { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
    return String(v).trim();
  };
  const afterColon = s => { const t = String(s || '').trim(); const i = t.indexOf(':'); return i >= 0 ? t.slice(i + 1).trim() : t; };
  wb.SheetNames.forEach(sn => {
    if (AP_SKIP_TABS.test(sn)) return;
    const ws = wb.Sheets[sn];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const hi = rows.slice(0, 15).findIndex(r => (r || []).some(c => /^\s*(staff\s+)?name\s*$/i.test(String(c || ''))));
    if (hi < 0) return;
    const head = rows[hi].map(h => String(h == null ? '' : h).trim());
    const find = re => head.findIndex(h => re.test(h));
    const c = {
      name: find(/^\s*(staff\s+)?name\s*$/i),
      role: find(/role|subject/i),
      attending: find(/attend/i),
      lw: find(/learning walk|lw/i),
      notes: find(/^notes?$|comment/i),
    };
    const sessionCols = head.map((h, i) => ({ h, i })).filter(x => /^session\s*\d/i.test(x.h)).map(x => {
      const m = x.h.match(/^(session\s*\d+)\s*[-:·]?\s*(.*)$/i);
      return { col: x.i, label: m ? m[1].replace(/\s+/g, ' ') : x.h, time: m && m[2] ? m[2].replace(/\s*to\s*/i, ' to ') : '' };
    });
    const known = new Set([...Object.values(c), ...sessionCols.map(s => s.col)]);
    // Curriculum area and Head: B2 and B3 ("Head: XX"), else the tab name.
    const b2 = afterColon(cellText((rows[1] || [])[1]));
    const b3 = afterColon(cellText((rows[2] || [])[1]));
    const label = b2 && !/^curriculum area$/i.test(b2) ? b2 : sn;
    const scan = `${sn} ${label}`.toUpperCase();
    const tabCodes = codes.filter(code => new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`).test(scan));
    const sheet = { sheet: sn, label, head: b3 && !/^head$/i.test(b3) ? b3 : '', codes: tabCodes, sessions: sessionCols.map(s => ({ label: s.label, time: s.time })), people: [] };
    sheets.push(sheet);
    rows.slice(hi + 1).forEach(r => {
      r = r || [];
      const name = c.name >= 0 ? cellText(r[c.name]) : '';
      if (!name) return;
      const get = i => (i >= 0 ? cellText(r[i]) : '');
      const att = get(c.attending), lw = get(c.lw);
      const extra = {};
      head.forEach((h, i) => { if (h && !known.has(i) && !AP_PRIVATE_COLS.test(h)) { const v = cellText(r[i]); if (v) extra[h] = v; } });
      const sessions = sessionCols.map(s => ({ label: s.label, time: s.time, group: get(s.col) })).filter(s => s.group);
      const p = {
        name, sheet: sn, codes: tabCodes, role: get(c.role),
        attending: /^y/i.test(att) ? true : /^n/i.test(att) ? false : null, attendingText: att,
        lwTrained: /^y/i.test(lw), sessions, notes: get(c.notes), extra,
      };
      people.push(p); sheet.people.push(p);
    });
  });
  return { people, sheets };
}

// Match a name to a Hub staff record (case-insensitive, punctuation ignored).
function _apMatchStaff(name, codes) {
  const n = _apNorm(name);
  const pool = _apStaff().filter(s => _apNorm(s.name) === n);
  return pool.find(s => (codes || []).includes(s.areaCode)) || pool[0] || null;
}

// A pack is one Head of Area group: a tab on the attendance list when
// there is one, otherwise a Hub area. Hub areas with Health Checks that no
// tab covers still get their own pack, so nothing is left out.
function apUnits(attendance) {
  const areas = _apAreas();
  const units = [];
  const covered = new Set();
  ((attendance && attendance.sheets) || []).forEach(s => {
    s.codes.forEach(c => covered.add(c));
    units.push({ id: 'tab:' + s.sheet, label: s.label, fileKey: s.sheet, codes: s.codes, head: s.head, sheet: s });
  });
  const reviewedCodes = new Set(_apReviews().map(r => r.areaCode));
  areas.forEach(a => {
    if (covered.has(a.areaCode)) return;
    if (attendance && !reviewedCodes.has(a.areaCode)) return;
    units.push({ id: 'area:' + a.areaCode, label: `${a.areaCode} ${a.areaName}`, fileKey: a.areaCode, codes: [a.areaCode], head: a.hoaName || '', sheet: null });
  });
  return units;
}

// Everyone in a pack: the tab's people, Hub staff in its areas, and anyone
// with a Health Check in its areas. Each person's latest check, wherever it was done.
function apUnitPeople(unit) {
  const latestAll = _apLatestByStaff(null);
  const map = new Map();
  const add = (staff, name, attend) => {
    const k = staff ? 'id:' + staff.staffId : 'n:' + _apNorm(name);
    const cur = map.get(k) || { staff: staff || null, name: staff ? staff.name : name };
    if (attend) cur.attend = attend;
    map.set(k, cur);
  };
  if (unit.sheet) unit.sheet.people.forEach(p => add(_apMatchStaff(p.name, unit.codes), p.name, p));
  _apStaff().filter(s => unit.codes.includes(s.areaCode) && !s.archived).forEach(s => add(s, s.name));
  _apReviews().filter(r => unit.codes.includes(r.areaCode)).forEach(r => {
    const s = _apStaff().find(x => x.staffId === r.staffId); if (s) add(s, s.name);
  });
  return [...map.values()].map(x => ({ ...x, review: x.staff ? latestAll[x.staff.staffId] || null : null }))
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

// Support priority for a set of checks (Copilot method, support-priority.js).
function _apSupport(reviews) {
  if (typeof hcSignalPriority !== 'function') return null;
  const sig = [];
  reviews.forEach(r => Object.entries(r.domains || {}).forEach(([did, d]) => { const p = hcSignalPriority(d); if (p != null) sig.push({ did, p }); }));
  if (!sig.length) return null;
  const p = _apAvg(sig.map(s => s.p));
  const top = sig.reduce((m, s) => (s.p >= m.p ? s : m));
  const band = typeof _spBand === 'function' ? _spBand(p) : null;
  const fa = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).find(f => f.id === top.did);
  return { priority: p, band, mainNeed: fa ? fa.label : top.did };
}
function _apTimetable(att) {
  if (!att || !att.sessions.length) return '';
  return att.sessions.map(s => `${s.label}${s.time ? ` (${s.time})` : ''}: ${att.lwTrained && /lw/i.test(s.group) ? 'Learning walk group' : 'Group ' + s.group}`).join('; ');
}

// ── Workbook ──────────────────────────────────────────────────
async function apBuildUnitWorkbook(unit, attendance) {
  const ExcelJS = await _apLoadExcelJS();
  const areas = _apAreas();
  const people = apUnitPeople(unit);
  const reviewed = people.filter(p => p.review);
  const latestReviews = reviewed.map(p => p.review);
  const allLatest = Object.values(_apLatestByStaff(null));
  const areaStats = _apIndicatorStats(latestReviews);
  const collegeStats = _apIndicatorStats(allLatest);
  const sup = _apSupport(latestReviews);
  const dls = _apUniq(unit.codes.map(code => { const r = typeof getAreaEvidenceRAG === 'function' ? getAreaEvidenceRAG(code) : null; return r && r.dl && r.dl.present ? r.dl.name : ''; }));
  const avgOf = rs => _apAvg(rs.map(r => _apAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null))).filter(v => v != null));
  const areaAvg = avgOf(latestReviews), collegeAvg = avgOf(allLatest);
  const today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
  const sessions = unit.sheet ? unit.sheet.sessions : [];
  const onList = people.filter(p => p.attend);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DPC Hub'; wb.created = new Date();
  wb.title = `${unit.label} DA&I Day area pack`;

  // ── Overview ──
  const ov = wb.addWorksheet('Overview', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ov.columns = [{ width: 40 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 40 }];
  const o = _apSheetHelpers(ov, 6);
  o.title(`${unit.label}: Digital Accessibility and Inclusion`, `Area pack for the DA&I Day, 23 October 2026. Prepared ${_apFmt(today)} from the DPC Hub.`);

  o.section('At a glance', 8);
  o.pairs([
    ['Head of Area', unit.head || _apUniq(unit.codes.map(c => (areas.find(a => a.areaCode === c) || {}).hoaName)).join(', ')],
    ['Digital Lead', dls.join(', ') || 'Not recorded'],
    ['Areas in this pack', unit.codes.length ? unit.codes.map(c => `${c} ${(areas.find(a => a.areaCode === c) || {}).areaName || ''}`.trim()).join('; ') : unit.label],
    ['Staff in this pack', people.length],
    ['Staff reviewed (Health Check)', `${reviewed.length} of ${people.length}`],
    ['Average practice score', areaAvg != null ? `${_ap2(areaAvg)} of 5 (college ${_ap2(collegeAvg)})` : 'No Health Checks yet'],
    ['Support priority', sup ? `${_ap2(sup.priority)} of 7${sup.band ? ` (${sup.band.label})` : ''}` : 'None yet'],
    ['Main support need', sup ? sup.mainNeed : ''],
    ['Booked for 23 October', unit.sheet ? `${onList.filter(p => p.attend.attending === true).length} attending, ${onList.filter(p => p.attend.attending === false).length} not attending, ${onList.filter(p => p.attend.attending == null).length} not answered` : (attendance ? 'This area has no tab on the attendance list' : 'Attendance list not found in the Data folder')],
  ]);

  // 23 October
  o.section('23 October: who is booked, and their sessions', 8);
  if (unit.sheet && onList.length) {
    const extraCols = _apUniq(onList.flatMap(p => Object.keys(p.attend.extra))).slice(0, 2);
    o.table(['Name', 'Role or subject', 'Attending', 'Learning walk trained', ...sessions.map(s => `${s.label}${s.time ? ' ' + s.time : ''}`), 'Notes', ...extraCols],
      onList.map(p => [p.name, p.attend.role, p.attend.attendingText || '', p.attend.lwTrained ? 'Yes' : '',
        ...sessions.map(s => { const x = p.attend.sessions.find(y => y.label === s.label); return x ? `Group ${x.group}` : ''; }),
        p.attend.notes, ...extraCols.map(k => p.attend.extra[k] || '')]));
    if (sessions.length) {
      const groups = _apUniq(onList.flatMap(p => p.attend.sessions.map(s => s.group))).sort();
      o.table(['Session', 'Staff booked', ...groups.map(g => `Group ${g}`)],
        sessions.map(s => {
          const inS = onList.filter(p => p.attend.attending !== false).map(p => p.attend.sessions.find(y => y.label === s.label)).filter(Boolean);
          return [`${s.label}${s.time ? ' ' + s.time : ''}`, inS.length, ...groups.map(g => inS.filter(x => x.group === g).length)];
        }));
    }
    const missing = people.filter(p => !p.attend && p.review).map(p => p.name);
    if (missing.length) o.para(`Reviewed but not on the attendance list: ${missing.join(', ')}.`, { italic: true, color: 'FF475569', span: 8 });
  } else {
    o.para(unit.sheet ? 'No staff listed on this tab yet.' : 'This area has no tab on the attendance list.', { italic: true, span: 8 });
  }
  o.gap();

  // Where the area is now
  o.section('Where the area is now (Health Checks, latest check per person)', 8);
  if (reviewed.length) {
    const domRows = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).map(fa => {
      const v = latestReviews.map(r => r.domains && r.domains[fa.id] && r.domains[fa.id].avgScore).filter(x => x != null);
      const cv = allLatest.map(r => r.domains && r.domains[fa.id] && r.domains[fa.id].avgScore).filter(x => x != null);
      return v.length ? [fa.label, v.length, _ap2(_apAvg(v)), cv.length ? _ap2(_apAvg(cv)) : ''] : null;
    }).filter(Boolean);
    o.table(['Focus area', 'Staff reviewed', 'Average (1 to 5)', 'College average'], domRows);
    if (unit.codes.length > 1) {
      o.table(['Area', 'Staff reviewed', 'Average (1 to 5)'], unit.codes.map(code => {
        const rs = latestReviews.filter(r => r.areaCode === code);
        return [`${code} ${(areas.find(a => a.areaCode === code) || {}).areaName || ''}`, rs.length, rs.length ? _ap2(avgOf(rs)) : 'None'];
      }));
    }
    const concerns = areaStats.filter(s => s.n && s.low).sort((a, b) => b.lowShare - a.lowShare || a.avg - b.avg).slice(0, 6);
    o.table(['Key concerns: indicators most often scored 1 or 2', 'Staff scoring 1 or 2', 'Average', 'College average', 'First action for the team'],
      concerns.map(s => { const c = collegeStats.find(x => x.id === s.id); return [s.label, `${s.low} of ${s.n}`, _ap2(s.avg), c && c.avg != null ? _ap2(c.avg) : '', AP_FIRST_ACTIONS[s.id] || '']; }),
      { empty: 'No indicator was scored 1 or 2.' });
    const strengths = areaStats.filter(s => s.n && s.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 5);
    o.table(['Strengths: indicators averaging 4 or more', 'Staff reviewed', 'Average'], strengths.map(s => [s.label, s.n, _ap2(s.avg)]), { empty: 'No indicator averages 4 or more yet.' });
  } else {
    o.para('No Health Checks have been completed in this area yet.', { italic: true, span: 8 });
    o.gap();
  }

  // Area Action Plan starter
  o.section('Starting point for your Area Action Plan (sections 2 and 3)', 8);
  o.table(['First gate expectation', 'Where we are now'], AP_FIRST_GATE.map(g => {
    const s = areaStats.find(x => x.id === g.id);
    return [g.text, s && s.n ? `Average ${_ap2(s.avg)} of 5 from ${s.n} staff; ${s.low} scored 1 or 2` : 'Not yet reviewed'];
  }));
  o.pairs([
    ['Health check position', reviewed.length ? `${reviewed.length} staff reviewed, average ${_ap2(areaAvg)} of 5${sup && sup.band ? `, support priority ${sup.band.band}` : ''}` : 'Not yet reviewed'],
    ['What we already do well', areaStats.filter(s => s.n && s.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 3).map(s => s.label).join('; ')],
    ['Our biggest gaps', areaStats.filter(s => s.n && s.low).sort((a, b) => b.lowShare - a.lowShare).slice(0, 3).map(s => s.label).join('; ')],
  ]);
  o.para("Scores: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident. Individual results are on each person's own tab and are not ranked here.", { italic: true, color: 'FF475569', span: 8 });

  // ── One tab per person ──
  const used = new Set(['overview']);
  people.forEach(p => {
    const ws = wb.addWorksheet(_apSheetName(p.name, used), { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 34 }, { width: 46 }, { width: 16 }, { width: 60 }];
    const h = _apSheetHelpers(ws, 4);
    const r = p.review;
    const homeArea = r ? areas.find(a => a.areaCode === r.areaCode) : (p.staff ? areas.find(a => a.areaCode === p.staff.areaCode) : null);
    h.title(p.name, `${homeArea ? `${homeArea.areaCode} ${homeArea.areaName}` : unit.label}. Prepared ${_apFmt(today)}.`);

    h.section('23 October', 4);
    if (p.attend) {
      h.pairs([
        ['Attending', p.attend.attendingText || 'Not answered yet'],
        ['Your sessions', _apTimetable(p.attend) || 'No session booked yet'],
        ['Learning walk trained', p.attend.lwTrained ? 'Yes' : ''],
        ['Role or subject', p.attend.role],
        ...Object.entries(p.attend.extra),
        ['Notes', p.attend.notes],
      ].filter(([k, v]) => k === 'Attending' || k === 'Your sessions' || (v !== '' && v != null)));
    } else {
      h.para(unit.sheet ? 'Not on the attendance list for this area.' : 'Attendance list not available for this area.', { italic: true, span: 4 });
      h.gap();
    }

    if (!r) {
      h.section('Health Check', 4);
      h.para('No Health Check completed yet.', { italic: true, span: 4 });
      return;
    }
    const sp = _apSupport([r]);
    h.section('Health Check summary', 4);
    h.pairs([
      ['Date of check', _apFmt(r.date)],
      ['Assessor', r.assessorName || ''],
      ['Provision and level', [r.provision, r.levelOfLearning].filter(Boolean).join(', ')],
      ['Average practice score', _ap2(_apAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null))) + ' of 5'],
      ['Support priority', sp ? `${_ap2(sp.priority)} of 7${sp.band ? ` (${sp.band.label})` : ''}` : ''],
      ['Recommended support', sp && sp.band ? sp.band.support : ''],
    ]);

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
      ((typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS.find(f => f.id === did) : null) || {}).label || did, d.actionDescription, d.actionLevel || '']);
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
function _apFileName(unit) {
  const key = String(unit.fileKey || unit.label).replace(/[^A-Za-z0-9()&]+/g, '-').replace(/^-|-$/g, '');
  return `DAI-Day-area-pack-${key}-${(typeof todayISO === 'function' ? todayISO() : '')}.xlsx`;
}
async function _apWorkbookBytes(unit, attendance) {
  const wb = await apBuildUnitWorkbook(unit, attendance);
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
  const units = apUnits(attendance);
  const rows = units.map(u => {
    const people = apUnitPeople(u);
    return { u, people: people.length, reviewed: people.filter(p => p.review).length,
      booked: people.filter(p => p.attend && p.attend.attending === true).length, listed: people.filter(p => p.attend).length };
  });
  const noCode = attendance ? attendance.sheets.filter(s => !s.codes.length).map(s => s.sheet) : [];
  body.innerHTML = `
    <div class="ms-report">
      <p class="ms-muted">One Excel workbook per Head of Area tab on the attendance list: an Overview, then a tab for each member of staff. Built from the Hub's Health Checks and the attendance list when you press the button.</p>
      <p>${attendance ? `Attendance list: <strong>${_apEsc(attendance.name)}</strong>, ${attendance.people.length} people on ${attendance.sheets.length} area tabs.` : `<strong>No attendance list found.</strong> Save the Area attendance workbook in the Data folder, keeping "attendance" in the name. Packs below are one per Hub area until it is there. ${_apEsc(attErr)}`}
      ${noCode.length ? `<br><span class="ms-muted">Tabs with no Hub area code (${_apEsc(noCode.join(', '))}): their staff's Health Checks are found by name.</span>` : ''}</p>
      <div class="ms-actions" style="margin:var(--space-sm) 0;">
        <button type="button" class="btn btn--primary btn--sm" id="ap-save-all">Save selected to Data folder (Area packs)</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ap-select-data">Select packs with data</button>
        <button type="button" class="btn btn--ghost btn--sm" id="ap-select-none">Clear selection</button>
      </div>
      <p id="ap-status" role="status" class="ms-muted"></p>
      <div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Packs and what each will contain</caption>
        <thead><tr><th scope="col">Include</th><th scope="col">Pack</th><th scope="col">Hub areas</th><th scope="col">Staff</th><th scope="col">Reviewed</th><th scope="col">Booked for 23 Oct</th><th scope="col">Download</th></tr></thead>
        <tbody>${rows.map((x, i) => `<tr>
          <td><input type="checkbox" class="ap-pick" value="${i}" ${x.reviewed || x.listed ? 'checked' : ''} aria-label="Include ${_apEsc(x.u.label)}"></td>
          <th scope="row">${_apEsc(x.u.label)}${x.u.head ? ` <span class="ms-muted">${_apEsc(x.u.head)}</span>` : ''}</th>
          <td>${_apEsc(x.u.codes.join(', ') || 'None')}</td><td>${x.people}</td><td>${x.reviewed}</td><td>${x.u.sheet ? `${x.booked} of ${x.listed}` : 'No tab'}</td>
          <td><button type="button" class="btn btn--ghost btn--sm ap-one" data-i="${i}">Download</button></td></tr>`).join('')}</tbody></table></div>
      <p class="ms-muted">Individual Health Check results are on each person's own tab only. Access and dietary needs are never included. Send each pack to that Head of Area and the Digital Lead.</p>
    </div>`;

  const status = t => { const el = document.getElementById('ap-status'); if (el) el.textContent = t; };
  body.querySelectorAll('.ap-one').forEach(b => b.addEventListener('click', async () => {
    const u = units[+b.dataset.i];
    status(`Building ${u.label}…`);
    try { _apDownload(await _apWorkbookBytes(u, attendance), _apFileName(u)); status(`${u.label} downloaded.`); }
    catch (e) { console.error(e); status('Could not build the pack: ' + e.message); }
  }));
  document.getElementById('ap-select-data')?.addEventListener('click', () => body.querySelectorAll('.ap-pick').forEach(cb => { const x = rows[+cb.value]; cb.checked = !!(x.reviewed || x.listed); }));
  document.getElementById('ap-select-none')?.addEventListener('click', () => body.querySelectorAll('.ap-pick').forEach(cb => { cb.checked = false; }));
  document.getElementById('ap-save-all')?.addEventListener('click', async () => {
    const picks = [...body.querySelectorAll('.ap-pick:checked')].map(cb => units[+cb.value]);
    if (!picks.length) { status('Select at least one pack.'); return; }
    if (typeof hasFolderAccess === 'function' && !hasFolderAccess()) { status('No folder connected. Use Download on each pack instead.'); return; }
    let done = 0;
    for (const u of picks) {
      status(`Building ${u.label} (${done + 1} of ${picks.length})…`);
      try { await saveBytesToFolder(_apFileName(u), await _apWorkbookBytes(u, attendance), 'Area packs'); done++; }
      catch (e) { console.error(e); status(`Stopped at ${u.label}: ${e.message}`); return; }
    }
    status(`${done} pack${done === 1 ? '' : 's'} saved to the Data folder, in "Area packs".`);
  });
}
