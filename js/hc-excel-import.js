// DPC Hub · js/hc-excel-import.js · v1.0 · 02/10/26 · Session RAG-2 — read the Health Checks Forms export (.xlsx) straight from the Data folder
// Parses a Microsoft Forms "Digital Health Checks" Excel export in the
// browser into the same record shape as baseline-2026-parsed.json, so
// the existing import review in healthcheck.js works unchanged. Rules are
// the ones in HC_Import_Session_Brief.md and tools/parse-health-checks.py
// (Files repo), validated 02/10/26 against the 57 records already
// imported: identical structure and scores.
//
// Columns are found by header text, not position, so a re-ordered or
// extended export still parses. Repeated headers (Context, What was
// seen?, action questions) are matched by occurrence order, whether the
// export numbers them ("What was seen?2") or not.
//
// Exports: hcFindExportFiles(), hcParseExportWorkbook(arrayBuffer),
//          hcCycleForDate(isoDate), hcAreaMapKeys(rec)

const HC_EXPORT_FILE_PATTERN = /health\s*check/i;

// "What was seen?" occurrence per domain. Inclusive Knowledge and
// Practice has no "What was seen?" question in the Form.
const _HCX_SEEN_INDEX = {
  accessibilityByDesign: 0,
  promotingAccessiblePractice: 1,
  inclusiveKnowledgeAndPractice: null,
  digitalOrganisationAndHygiene: 2,
  effectiveDigitalCommunication: 3,
};

async function hcFindExportFiles() {
  if (typeof listFolderFiles !== 'function') return [];
  return listFolderFiles(name => /\.xlsx$/i.test(name) && !name.startsWith('~$') && HC_EXPORT_FILE_PATTERN.test(name));
}

// Review rounds by date: before November 2026 is the baseline, then the
// November, Feb/March and June rounds. Used as the default; the import
// panel lets Graeme override it for a whole batch.
function hcCycleForDate(iso) {
  const d = String(iso || '');
  if (!d || d < '2026-11-01') return HC_CYCLES.BASELINE;
  if (d < '2027-02-01') return HC_CYCLES.NOVEMBER;
  if (d < '2027-05-01') return HC_CYCLES.FEB_MARCH;
  return HC_CYCLES.JUNE;
}

// Keys used to remember an area match for a raw Forms code or name.
function hcAreaMapKeys(rec) {
  const code = String(rec.areaCode || '').trim().toUpperCase().replace(/\s+/g, '');
  const name = String(rec.areaName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return { code: code ? 'code:' + code : null, name: name ? 'name:' + name : null };
}

// The validated Python parser (pandas) reads these exact strings as empty,
// so "N/A" typed into a Form answer is treated as no answer. Kept
// identical so both parsers produce the same records.
const _HCX_NA = new Set(['', '#N/A', '#N/A N/A', '#NA', '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN', '<NA>', 'N/A', 'NA', 'NULL', 'NaN', 'None', 'n/a', 'nan', 'null']);
function _hcxEmpty(v) {
  return v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || (typeof v === 'string' && _HCX_NA.has(v));
}
// Excel stores line breaks as CRLF; the validated import file uses LF.
function _hcxText(v) { return _hcxEmpty(v) ? null : String(v).replace(/\r\n?/g, '\n'); }

function _hcxDate(v) {
  if (_hcxEmpty(v)) return null;
  const pad = n => String(n).padStart(2, '0');
  if (typeof v === 'number' && typeof XLSX !== 'undefined') {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  }
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // Forms exports use d/m/yyyy for UK locale
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}

function _hcxScore(v) {
  if (_hcxEmpty(v)) return null;
  const m = String(v).match(/^\s*(\d)/);
  return m ? parseInt(m[1], 10) : null;
}

// Picks the sheet that holds the responses: the one whose header row has
// both an ID column and "Staff Member Reviewed". Forms downloads call it
// Sheet1; Graeme's working copy calls it Review Responses.
function _hcxFindSheet(wb) {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    if (!rows.length) continue;
    const head = (rows[0] || []).map(h => String(h == null ? '' : h).trim());
    if (head.some(h => /^id$/i.test(h)) && head.includes('Staff Member Reviewed')) return { name, rows, head };
  }
  return null;
}

function hcParseExportWorkbook(arrayBuffer) {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet library did not load. Refresh the Hub and try again.');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = _hcxFindSheet(wb);
  if (!sheet) throw new Error('This workbook has no sheet with an ID column and "Staff Member Reviewed". Is it the Digital Health Checks Forms export?');
  const { rows, head } = sheet;

  const col = name => head.indexOf(name);
  const idCol = head.findIndex(h => /^id$/i.test(h));
  const occ = prefix => head.map((h, i) => (h.startsWith(prefix) ? i : -1)).filter(i => i >= 0);
  const ctxCols  = occ('Context for this area');
  const seenCols = occ('What was seen?');
  const aiCols   = occ('Is an action point identified for this area?');
  const lvlCols  = occ('Level of action required');
  const descCols = occ('Describe the action point(s)');

  // Indicator columns: header starts with the indicator label in schema.js.
  const lower = head.map(h => h.toLowerCase());
  const indicatorCol = label => lower.findIndex(h => h.startsWith(String(label).toLowerCase()));

  const warnings = [];
  const domains = HC_FOCUS_AREAS.map((fa, i) => {
    const inds = fa.indicators.map(ind => ({ id: ind.id, col: indicatorCol(ind.label) }));
    inds.filter(x => x.col < 0).forEach(x => warnings.push(`No column found for indicator "${x.id}".`));
    const seenIdx = _HCX_SEEN_INDEX[fa.id];
    return {
      id: fa.id, inds,
      ctx: ctxCols[i] ?? -1,
      seen: seenIdx == null ? null : (seenCols[seenIdx] ?? -1),
      ai: aiCols[i] ?? -1, lvl: lvlCols[i] ?? -1, desc: descCols[i] ?? -1,
    };
  });
  if (idCol < 0) throw new Error('No ID column found.');

  const get = (row, c) => (c == null || c < 0 ? null : row[c]);
  const top = [
    ['assessorName', 'Name of Assessor'], ['date', 'Date of Review'], ['areaName', 'Area Name'],
    ['areaCode', 'Area Code'], ['headOfArea', 'Head of Area'], ['staffMemberName', 'Staff Member Reviewed'],
    ['provision', 'Provision'], ['levelOfLearning', 'Level of Learning'],
  ];
  const tail = [
    ['overallReflection', 'Overall observed reflection'], ['keyStrengths', 'Key strengths observed'],
    ['areasForImprovement', 'Areas for Improvement (AFIs)'], ['priorityNextSteps', 'Priority next steps and recommendations'],
  ];

  const records = [];
  rows.slice(1).forEach(row => {
    const idRaw = get(row, idCol);
    if (_hcxEmpty(idRaw)) return;
    const rec = { sourceRowId: parseInt(idRaw, 10) };
    top.forEach(([k, h]) => {
      const v = get(row, col(h));
      if (_hcxEmpty(v)) { if (k === 'areaCode') rec[k] = null; return; }
      rec[k] = k === 'date' ? _hcxDate(v) : _hcxText(v);
    });

    const doms = {};
    domains.forEach(d => {
      const ctx = _hcxText(get(row, d.ctx));
      const sc = {};
      d.inds.forEach(x => { const s = _hcxScore(get(row, x.col)); if (s != null) sc[x.id] = s; });
      const ww = d.seen == null ? null : _hcxText(get(row, d.seen));
      const aiRaw = get(row, d.ai);
      const lv = _hcxText(get(row, d.lvl));
      const de = _hcxText(get(row, d.desc));
      if (!(Object.keys(sc).length || ctx || ww || !_hcxEmpty(aiRaw) || lv || de)) return;
      const vals = Object.values(sc);
      const dom = { context: ctx, indicatorScores: sc };
      dom.avgScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      dom.lowestScore = vals.length ? Math.min(...vals) : null;
      if (d.seen != null) dom.whatWasSeen = ww;
      dom.actionIdentified = _hcxEmpty(aiRaw) ? null : String(aiRaw).trim() === 'Yes';
      dom.actionLevel = lv ? lv.replace(/;+$/, '') : null;
      dom.actionDescription = de;
      doms[d.id] = dom;
    });
    rec.domains = doms;
    tail.forEach(([k, h]) => { const v = _hcxText(get(row, col(h))); if (v != null) rec[k] = v; });
    records.push(rec);
  });

  return { records, sheetName: sheet.name, warnings: [...new Set(warnings)] };
}
