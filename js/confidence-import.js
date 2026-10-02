// DPC Hub · js/confidence-import.js · v1.0 · 02/10/26 · Session RAG-2 — staff confidence (WCAG 2.2 AA and Accessibility Checker): question set and Forms Excel import
// The question set below IS the specification for the Microsoft Form
// "Accessibility Confidence Check" (see Files repo:
// 07-resources/around-the-day/confidence-check/FORM-SPEC.md). The import
// finds each statement's column by its opening words, so the statement
// text in the Form must start exactly as written here.
//
// Every statement uses the same 1 to 5 scale, written with the number
// first ("4 Confident") so the score can be read straight from the
// answer whatever the export calls the column.
//
// Responses are stored in data-confidence.json, deduplicated by the Forms
// response ID. The Milestone Impact Report reads them: each person's
// latest response by a date counts.
//
// Exports: CONF_SCALE, CONF_ITEMS, confFindExportFiles(),
//          confParseExportWorkbook(arrayBuffer), confImportFromFolder()

const CONF_SCALE = Object.freeze([
  '1 Not confident yet',
  '2 A little confident',
  '3 Fairly confident',
  '4 Confident',
  '5 Very confident, I could show a colleague',
]);

// group: 'wcag' = making resources that meet WCAG 2.2 AA;
//        'checker' = the Microsoft 365 Accessibility Checker.
// sc = the WCAG 2.2 success criteria the statement covers (all Level A or AA).
const CONF_ITEMS = Object.freeze([
  { id: 'altText',      group: 'wcag', sc: '1.1.1', text: 'Add meaningful alt text to images, and mark decorative images as decorative' },
  { id: 'captions',     group: 'wcag', sc: '1.2.1, 1.2.2', text: 'Provide captions for videos and a transcript for audio' },
  { id: 'structure',    group: 'wcag', sc: '1.3.1', text: 'Use built-in Heading styles, lists and table headers instead of formatting text by hand' },
  { id: 'readingOrder', group: 'wcag', sc: '1.3.2', text: 'Check the reading order of slides and documents' },
  { id: 'colourOnly',   group: 'wcag', sc: '1.4.1', text: 'Make sure colour is never the only way information is shown' },
  { id: 'contrast',     group: 'wcag', sc: '1.4.3', text: 'Check that text and background colours have enough contrast' },
  { id: 'textInImages', group: 'wcag', sc: '1.4.5', text: 'Avoid putting text inside images' },
  { id: 'titles',       group: 'wcag', sc: '2.4.2, 2.4.6', text: 'Give every slide a unique title and every document a clear title and headings' },
  { id: 'linkText',     group: 'wcag', sc: '2.4.4', text: 'Write link text that makes sense on its own, not "click here"' },
  { id: 'interactive',  group: 'wcag', sc: '2.5.7, 2.5.8', text: 'Make sure interactive activities, such as drag and drop, have an option that does not need dragging and buttons that are easy to tap' },
  { id: 'checkerRun',   group: 'checker', sc: '', text: 'Find and run the Accessibility Checker' },
  { id: 'checkerRead',  group: 'checker', sc: '', text: 'Understand what the errors and warnings it lists mean' },
  { id: 'checkerFix',   group: 'checker', sc: '', text: 'Fix the issues it finds, using its recommended actions' },
  { id: 'checkerLive',  group: 'checker', sc: '', text: 'Keep it running while I work, so issues show as I create' },
  { id: 'checkerLimits',group: 'checker', sc: '', text: 'Know what it cannot check, and check those things myself' },
]);

const CONF_EXPORT_FILE_PATTERN = /confidence/i;

async function confFindExportFiles() {
  if (typeof listFolderFiles !== 'function') return [];
  return listFolderFiles(name => /\.xlsx$/i.test(name) && !name.startsWith('~$') && CONF_EXPORT_FILE_PATTERN.test(name));
}

function _confNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim(); }
function _confDate(v) {
  if (v == null || v === '') return null;
  const pad = n => String(n).padStart(2, '0');
  if (typeof v === 'number' && typeof XLSX !== 'undefined') { const p = XLSX.SSF.parse_date_code(v); if (p) return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
function _confScore(v) { const m = String(v == null ? '' : v).match(/^\s*([1-5])\b/); return m ? parseInt(m[1], 10) : null; }
function _confAvg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

function confParseExportWorkbook(arrayBuffer) {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet library did not load. Refresh the Hub and try again.');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  let rows = null, head = null;
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    const h = (r[0] || []).map(_confNorm);
    if (h.includes('id') && CONF_ITEMS.some(it => h.some(x => x.includes(_confNorm(it.text).slice(0, 30))))) { rows = r; head = h; break; }
  }
  if (!rows) throw new Error('No sheet with an ID column and the confidence statements. Is this the Accessibility Confidence Check export?');

  const col = (...names) => { for (const n of names) { const i = head.indexOf(_confNorm(n)); if (i >= 0) return i; } return -1; };
  const starts = (prefix) => head.findIndex(h => h.startsWith(_confNorm(prefix)));
  const itemCols = CONF_ITEMS.map(it => ({ it, c: head.findIndex(h => h.includes(_confNorm(it.text).slice(0, 30))) }));
  const missing = itemCols.filter(x => x.c < 0).map(x => x.it.text);

  const idC = col('id'), dateC = col('completion time', 'start time'), emailC = col('email'), nameC = col('name');
  const areaC = starts('your area'), roleC = starts('your role'), pointC = starts('which point'), helpC = starts('what would help');

  const responses = rows.slice(1).filter(r => r[idC] != null && r[idC] !== '').map(r => {
    const items = {};
    itemCols.forEach(({ it, c }) => { if (c >= 0) { const s = _confScore(r[c]); if (s != null) items[it.id] = s; } });
    const vals = g => CONF_ITEMS.filter(i => i.group === g && items[i.id] != null).map(i => items[i.id]);
    const areaRaw = areaC >= 0 && r[areaC] != null ? String(r[areaC]) : '';
    const am = areaRaw.match(/^\s*([A-Z]{2,4})\b/);
    return {
      responseId: String(r[idC]),
      date: _confDate(r[dateC]),
      email: emailC >= 0 && r[emailC] ? String(r[emailC]).trim().toLowerCase() : '',
      name: nameC >= 0 && r[nameC] ? String(r[nameC]).trim() : '',
      areaCode: am ? am[1] : '',
      areaRaw,
      role: roleC >= 0 && r[roleC] ? String(r[roleC]) : '',
      point: pointC >= 0 && r[pointC] ? String(r[pointC]) : '',
      help: helpC >= 0 && r[helpC] ? String(r[helpC]).replace(/\r\n?/g, '\n') : '',
      items,
      wcag: _confAvg(vals('wcag')),
      checker: _confAvg(vals('checker')),
      overall: _confAvg(Object.values(items)),
    };
  }).filter(x => x.overall != null);

  return { responses, missing };
}

// Reads the newest confidence export in the Data folder and adds any
// responses not already stored. Returns a summary for the caller to show.
async function confImportFromFolder() {
  const files = await confFindExportFiles();
  if (!files.length) return { ok: false, message: 'No confidence export found. Save the Accessibility Confidence Check Forms export (.xlsx) into the Data folder, keeping "Confidence" in the file name.' };
  const { bytes, name } = await readFolderFileBytes(files[0].name);
  const { responses, missing } = confParseExportWorkbook(bytes);
  if (!window.DPC_DATA.confidence) window.DPC_DATA.confidence = { responses: [] };
  const store = window.DPC_DATA.confidence;
  const have = new Set(store.responses.map(r => r.responseId));
  const fresh = responses.filter(r => !have.has(r.responseId)).map(r => ({ ...r, importSource: name, importedAt: nowISO() }));
  if (fresh.length && typeof saveConfidenceResponses === 'function') saveConfidenceResponses(fresh);
  return {
    ok: true,
    message: `${name}: ${responses.length} responses, ${fresh.length} new added.${missing.length ? ` ${missing.length} statement${missing.length === 1 ? '' : 's'} not found in the file, check the Form wording.` : ''}`,
  };
}
