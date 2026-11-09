// DPC Hub · js/dai.js · v1.2 · 09/11/26 · progress page split into tabs; planning prompt buttons
// v1.1 · 09/11/26 · support recommendations section (dai-support.js), priorities filled from targets on import
// v1.0 · 09/11/26 · Digital Accessibility and Inclusion: Registration and "How's it going" imports, staff matching, progress view, staff profile card
//
// Reads two Microsoft Forms Excel exports from the connected Data folder:
//   Registration    who came to the DA&I training, with one overall
//                   confidence rating before the day.
//   How's it going  confidence in 11 accessibility elements after the
//                   day, three personal targets with confidence, and the
//                   support each person asks for.
// Files are recognised by their column headers, not their file names.
//
// Each response is matched to a staff profile: by email first, then by
// name (Graeme confirms each name match), otherwise a new profile is
// created. Answers are stored as written ("raw") and scored when shown,
// so a wording Graeme maps later re-scores everything already stored.
//
// Stored in data-dai.json in the OneDrive folder, never in the repo:
//   { responses: [...], areaMap: { rawAreaText: areaCode | '__none' },
//     scaleMap: { answerWording: 1..5 | 0 (not a rating) } }
//
// Public: initDAI(), daiRenderStaffCard(staffId), daiGetStaffSummary(staffId),
//         DAI_ELEMENTS, daiScore(raw)

const DAI_ELEMENTS = Object.freeze([
  { id: 'readingOrder',  label: 'PowerPoint reading order',   header: 'powerpoint reading order' },
  { id: 'slideTitles',   label: 'Slide titles',               header: 'slide titles' },
  { id: 'contrast',      label: 'Colour contrast',            header: 'colour contrast' },
  { id: 'tableHeader',   label: 'Table headers',              header: 'table header' },
  { id: 'mergedCells',   label: 'Merged or split cells',      header: 'merged or split cells' },
  { id: 'headings',      label: 'Heading styles',             header: 'heading styles' },
  { id: 'altText',       label: 'Alt text',                   header: 'alt text' },
  { id: 'hyperlinks',    label: 'Clear hyperlinks',           header: 'unclear hyperlinks' },
  { id: 'cognitiveLoad', label: 'Cognitive Load Theory',      header: 'understanding cognitive load theory' },
  { id: 'checker',       label: 'Accessibility Checker',      header: 'using accessibility checker' },
  { id: 'captions',      label: 'Captions',                   header: 'using captions' },
]);

const DAI_SCALE_WORDS = Object.freeze({ 1: 'Not confident', 2: 'Slightly confident', 3: 'Somewhat confident', 4: 'Confident', 5: 'Very confident' });
const DAI_LOW = 2.5; // an average at or below this goes on the coaching list

let _daiPending = null;   // scan result awaiting Graeme's review

// ── Store ─────────────────────────────────────────────────────
function _daiStore() {
  if (!window.DPC_DATA.dai) window.DPC_DATA.dai = { responses: [], areaMap: {}, scaleMap: {} };
  const d = window.DPC_DATA.dai;
  if (!d.responses) d.responses = [];
  if (!d.areaMap) d.areaMap = {};
  if (!d.scaleMap) d.scaleMap = {};
  return d;
}
function _daiStaffList() { return (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []; }
function _daiAreaList() { return ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).filter(a => !a.archived); }
function _daiAreaName(code) { const a = _daiAreaList().find(x => x.areaCode === code); return a ? a.areaName : (code || 'No area'); }

// ── Text helpers ──────────────────────────────────────────────
function _daiEsc(v) { return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _daiNorm(v) { return String(v == null ? '' : v).toLowerCase().replace(/[“”"'’]/g, '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim(); }
function _daiNameKey(v) { return _daiNorm(v).replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).sort().join(' '); }
function _daiText(v) { return v == null || String(v).trim() === '' ? '' : String(v).replace(/\r\n?/g, '\n').trim(); }
function _daiFmt(n) { return n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1); }
function _daiAvg(list) { const v = list.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function _daiFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
}

// Excel dates arrive as serial numbers; text dates are read day first (UK)
// unless the numbers only make sense month first.
function _daiWhen(v) {
  if (v == null || v === '') return null;
  const pad = n => String(n).padStart(2, '0');
  if (typeof v === 'number' && typeof XLSX !== 'undefined') {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}:${pad(Math.floor(p.S))}`;
  }
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 19);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${pad(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    let day = a, mon = b; if (b > 12 && a <= 12) { day = b; mon = a; }
    return `${y}-${pad(mon)}-${pad(day)}T${pad(m[4] || 0)}:${m[5] || '00'}:${m[6] || '00'}`;
  }
  return null;
}

// ── Scoring ───────────────────────────────────────────────────
// A number 1 to 5, an answer starting with one ("4 Confident"), or a
// wording Graeme has mapped. Anything else scores nothing.
function daiScore(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return raw >= 1 && raw <= 5 && Number.isInteger(raw) ? raw : null;
  const s = String(raw).trim();
  const m = s.match(/^([1-5])(?:\s|$|[^\d])/);
  if (m) return parseInt(m[1], 10);
  const mapped = _daiStore().scaleMap[_daiNorm(s)];
  return mapped ? mapped : null;
}
function _daiIsMapped(raw) {
  if (raw == null || raw === '') return true;
  if (typeof raw === 'number') return daiScore(raw) != null;
  const s = String(raw).trim();
  if (/^[1-5](?:\s|$|[^\d])/.test(s)) return true;
  return Object.prototype.hasOwnProperty.call(_daiStore().scaleMap, _daiNorm(s));
}
// First guess for an unmapped wording, always shown to Graeme to confirm.
function _daiGuessScale(raw) {
  const s = _daiNorm(raw);
  if (/^not very|^not that|^not really/.test(s)) return 2;
  if (/^not|no confidence|unconfident|don.?t know how/.test(s)) return 1;
  if (/slightly|a little|a bit|^low/.test(s)) return 2;
  if (/somewhat|fairly|moderately|partly|neutral|unsure|^ok|okay/.test(s)) return 3;
  if (/very|extremely|completely|fully|highly|expert/.test(s)) return 5;
  if (/confident/.test(s)) return 4;
  return null;
}

// Scores for one stored response.
function _daiBefore(r) { return r.source === 'registration' ? daiScore(r.overallRaw) : null; }
function _daiElements(r) {
  const out = {};
  if (r.source !== 'reflection') return out;
  DAI_ELEMENTS.forEach(e => { const s = daiScore((r.elementsRaw || {})[e.id]); if (s != null) out[e.id] = s; });
  return out;
}
function _daiAfter(r) { return _daiAvg(Object.values(_daiElements(r))); }
function _daiTargets(r) {
  return (r.targets || []).filter(t => t.text).map(t => ({ text: t.text, confidence: daiScore(t.confidenceRaw) }));
}

// ── Reading the Forms exports ─────────────────────────────────
function _daiKind(head) {
  if (head.some(h => h.startsWith('how confident do you feel with each digital accessibility element'))) return 'reflection';
  if (head.some(h => h.startsWith('rate your confidence in meeting accessibility'))) return 'registration';
  if (head.includes('head of area initials') && head.some(h => h.startsWith('priority 1'))) return 'actionplan';
  return null;
}

function _daiReadWorkbook(bytes) {
  const wb = XLSX.read(bytes, { type: 'array' });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    if (!rows.length) continue;
    const head = (rows[0] || []).map(_daiNorm);
    const kind = _daiKind(head);
    if (kind) return { kind, head, rows: rows.slice(1) };
  }
  return null;
}

function _daiCols(head) {
  return {
    eq: (...names) => { for (const n of names) { const i = head.indexOf(_daiNorm(n)); if (i >= 0) return i; } return -1; },
    starts: p => head.findIndex(h => h.startsWith(_daiNorm(p))),
    all: p => head.map((h, i) => h.startsWith(_daiNorm(p)) ? i : -1).filter(i => i >= 0),
  };
}
const _daiCell = (r, i) => (i >= 0 ? r[i] : null);

function _daiParseRegistration(head, rows, fileName) {
  const c = _daiCols(head);
  const idC = c.eq('id'), doneC = c.eq('completion time', 'start time'), emailC = c.eq('email'), nameC = c.eq('name');
  const firstC = c.eq('first name'), surC = c.eq('surname'), areaC = c.starts('area or faculty name');
  const hoaC = c.starts('name of your head of area'), rateC = c.starts('rate your confidence in meeting accessibility');
  return rows.filter(r => _daiCell(r, idC) != null && _daiCell(r, idC) !== '').map(r => {
    const fromParts = [_daiText(_daiCell(r, firstC)), _daiText(_daiCell(r, surC))].filter(Boolean).join(' ');
    const formsName = _daiText(_daiCell(r, nameC));
    return {
      source: 'registration', fileName,
      formId: String(_daiCell(r, idC)),
      when: _daiWhen(_daiCell(r, doneC)),
      email: _daiText(_daiCell(r, emailC)).toLowerCase(),
      name: formsName && !/^anonymous$/i.test(formsName) ? formsName : fromParts,
      areaRaw: _daiText(_daiCell(r, areaC)),
      hoaNamed: _daiText(_daiCell(r, hoaC)),
      overallRaw: _daiCell(r, rateC),
    };
  });
}

function _daiParseReflection(head, rows, fileName) {
  const c = _daiCols(head);
  const idC = c.eq('id'), doneC = c.eq('completion time', 'start time'), emailC = c.eq('email'), nameC = c.eq('name');
  const elPrefix = 'how confident do you feel with each digital accessibility element';
  const elCols = DAI_ELEMENTS.map(e => ({ id: e.id, i: head.findIndex(h => h.startsWith(elPrefix) && h.includes(e.header)) }));
  const tText = [1, 2, 3].map(n => c.starts(`target ${n} for my`));
  const tConf = c.all('how confident are you that you can achieve'); // in order: targets 1, 2, 3
  const cols = {
    area: c.starts('your area'), attended: c.starts('did you attend'), catchup: c.starts('which catch-up session'),
    takeaway: c.starts('what did you take away'), tried: c.starts('what have you already tried'),
    why: c.starts('why does getting accessibility right'), help: c.starts('what support would help'),
    helpDetail: c.starts('tell us what you need support with'),
  };
  const missing = elCols.filter(x => x.i < 0).map(x => DAI_ELEMENTS.find(e => e.id === x.id).label);
  const list = rows.filter(r => _daiCell(r, idC) != null && _daiCell(r, idC) !== '').map(r => {
    const elementsRaw = {};
    elCols.forEach(({ id, i }) => { const v = _daiCell(r, i); if (v != null && v !== '') elementsRaw[id] = v; });
    return {
      source: 'reflection', fileName,
      formId: String(_daiCell(r, idC)),
      when: _daiWhen(_daiCell(r, doneC)),
      email: _daiText(_daiCell(r, emailC)).toLowerCase(),
      name: _daiText(_daiCell(r, nameC)),
      areaRaw: _daiText(_daiCell(r, cols.area)),
      attended: _daiText(_daiCell(r, cols.attended)),
      catchup: _daiText(_daiCell(r, cols.catchup)),
      elementsRaw,
      takeaway: _daiText(_daiCell(r, cols.takeaway)),
      tried: _daiText(_daiCell(r, cols.tried)),
      why: _daiText(_daiCell(r, cols.why)),
      targets: [0, 1, 2].map(k => ({ text: _daiText(_daiCell(r, tText[k])), confidenceRaw: tConf[k] != null ? _daiCell(r, tConf[k]) : null })),
      supportWanted: _daiText(_daiCell(r, cols.help)),
      supportDetail: _daiText(_daiCell(r, cols.helpDetail)),
    };
  });
  return { list, missing };
}

const _daiKey = rec => [rec.source, rec.formId, rec.email || _daiNameKey(rec.name), rec.when || ''].join('|');

// ── Area matching ─────────────────────────────────────────────
// Exact code or name, or a match Graeme confirmed before, needs no review.
function _daiAreaExact(raw) {
  const n = _daiNorm(raw);
  if (!n) return null;
  const areas = _daiAreaList();
  const remembered = _daiStore().areaMap[n];
  if (remembered) return remembered;
  const lead = String(raw).trim().match(/^([A-Za-z]{2,4})\b/);
  const byCode = areas.find(a => a.areaCode.toLowerCase() === n || (lead && a.areaCode.toLowerCase() === lead[1].toLowerCase() && n.includes(_daiNorm(a.areaName))));
  if (byCode) return byCode.areaCode;
  const byName = areas.find(a => _daiNorm(a.areaName) === n);
  return byName ? byName.areaCode : null;
}
function _daiAreaGuess(raw) {
  const n = _daiNorm(raw);
  const areas = _daiAreaList();
  const lead = String(raw).trim().match(/^([A-Z]{2,4})\b/);
  if (lead) { const a = areas.find(x => x.areaCode === lead[1]); if (a) return a.areaCode; }
  const inside = areas.filter(a => n.includes(_daiNorm(a.areaName)) || _daiNorm(a.areaName).includes(n));
  if (inside.length === 1) return inside[0].areaCode;
  const words = n.split(/[^a-z]+/).filter(w => w.length > 3);
  const scored = areas.map(a => ({ a, hits: words.filter(w => _daiNorm(a.areaName).includes(w)).length })).filter(x => x.hits > 0).sort((x, y) => y.hits - x.hits);
  if (scored.length && (scored.length === 1 || scored[0].hits > scored[1].hits)) return scored[0].a.areaCode;
  return '';
}
function _daiResolveArea(raw) {
  const v = _daiAreaExact(raw);
  return v === '__none' ? '' : (v || '');
}

// ── Scan: read the folder, work out what needs a decision ─────
async function _daiScan() {
  if (typeof listFolderFiles !== 'function' || typeof readFolderFileBytes !== 'function') throw new Error('The Hub data layer did not load. Refresh the Hub.');
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet library did not load. Refresh the Hub and try again.');
  const files = await listFolderFiles(n => /\.xlsx$/i.test(n) && !n.startsWith('~$'));
  if (!files.length) throw new Error('No Excel files found in the connected Data folder. Check the folder is connected in Settings.');

  const found = [], records = [], notes = [];
  for (const f of files) {
    let parsed = null;
    try { parsed = _daiReadWorkbook((await readFolderFileBytes(f.name)).bytes); } catch (e) { continue; }
    if (!parsed) continue;
    if (parsed.kind === 'registration') {
      const list = _daiParseRegistration(parsed.head, parsed.rows, f.name);
      found.push({ name: f.name, kind: 'Registration', count: list.length });
      records.push(...list);
    } else if (parsed.kind === 'reflection') {
      const { list, missing } = _daiParseReflection(parsed.head, parsed.rows, f.name);
      found.push({ name: f.name, kind: "How's it going", count: list.length });
      if (missing.length) notes.push(`${f.name}: no column found for ${missing.join(', ')}.`);
      records.push(...list);
    } else if (parsed.kind === 'actionplan') {
      found.push({ name: f.name, kind: 'Area Action Plan', count: parsed.rows.length, later: true });
    }
  }
  if (!found.some(f => !f.later)) throw new Error('No Registration or "How\'s it going" export found in the Data folder.');

  const store = _daiStore();
  const have = new Set(store.responses.map(r => r.key));
  const fresh = [];
  const seen = new Set();
  records.forEach(r => { r.key = _daiKey(r); if (!have.has(r.key) && !seen.has(r.key)) { seen.add(r.key); fresh.push(r); } });

  // Answer wordings the Hub cannot score yet.
  const wordings = new Map();
  const note = v => { if (v == null || v === '' || _daiIsMapped(v)) return; const k = _daiNorm(v); if (!wordings.has(k)) wordings.set(k, { raw: String(v).trim(), count: 0, guess: _daiGuessScale(v) }); wordings.get(k).count++; };
  fresh.forEach(r => {
    if (r.source === 'registration') note(r.overallRaw);
    else { Object.values(r.elementsRaw).forEach(note); r.targets.forEach(t => note(t.confidenceRaw)); }
  });

  // Area wordings without an exact or remembered match.
  const areaTexts = new Map();
  fresh.forEach(r => {
    if (!r.areaRaw || _daiAreaExact(r.areaRaw)) return;
    const k = _daiNorm(r.areaRaw);
    if (!areaTexts.has(k)) areaTexts.set(k, { raw: r.areaRaw, count: 0, guess: _daiAreaGuess(r.areaRaw) });
    areaTexts.get(k).count++;
  });

  // People: one per email (or name, if a row has no email).
  const staff = _daiStaffList();
  const byEmail = new Map(staff.filter(s => s.email).map(s => [s.email.toLowerCase(), s]));
  const people = new Map();
  fresh.forEach(r => {
    const pk = r.email || 'name:' + _daiNameKey(r.name);
    if (!people.has(pk)) people.set(pk, { pk, email: r.email, name: r.name, areaRaw: r.areaRaw, records: [] });
    const p = people.get(pk);
    p.records.push(r);
    if (!p.name && r.name) p.name = r.name;
    if (!p.areaRaw && r.areaRaw) p.areaRaw = r.areaRaw;
  });
  const nameMatches = [];
  let byEmailCount = 0, toCreate = 0;
  people.forEach(p => {
    const e = p.email && byEmail.get(p.email);
    if (e) { p.match = { type: 'email', staffId: e.staffId }; byEmailCount++; return; }
    const nk = _daiNameKey(p.name);
    const cands = nk ? staff.filter(s => _daiNameKey(s.name) === nk && (!s.email || !p.email)) : [];
    if (cands.length >= 1) { p.match = { type: 'name', staffId: cands[0].staffId, options: cands.map(s => s.staffId) }; nameMatches.push(p); return; }
    p.match = { type: 'new' }; toCreate++;
  });

  return {
    found, notes, fresh, already: records.length - fresh.length,
    wordings: [...wordings.values()].sort((a, b) => b.count - a.count),
    areaTexts: [...areaTexts.values()].sort((a, b) => a.raw.localeCompare(b.raw)),
    people: [...people.values()], nameMatches, byEmailCount, toCreate,
  };
}

// ── Apply the import after review ─────────────────────────────
function _daiApply(scan, decisions) {
  const store = _daiStore();
  Object.entries(decisions.scale).forEach(([k, v]) => { store.scaleMap[k] = v; });
  Object.entries(decisions.areas).forEach(([k, v]) => { if (v) store.areaMap[k] = v; });

  const staff = window.DPC_DATA.staff.staff;
  const touchedAreas = new Set();
  let created = 0, linked = 0, added = 0;
  const importedIds = [];

  scan.people.forEach(p => {
    let profile = null;
    if (p.match.type === 'email') profile = staff.find(s => s.staffId === p.match.staffId);
    if (p.match.type === 'name') {
      const chosen = decisions.names[p.pk];
      if (chosen && chosen !== '__new') profile = staff.find(s => s.staffId === chosen);
    }
    if (profile) {
      if (p.email && !profile.email) profile.email = p.email;
      linked++;
    } else {
      profile = {
        staffId: generateId(), name: p.name || p.email || 'Unnamed', email: p.email || '',
        areaCode: _daiResolveArea(p.areaRaw), departmentCode: null, additionalAreas: [], role: '',
        entryPathway: 'dai-forms', entryDate: todayISO(), etfStage: null,
        developmentPriorities: ['', '', ''], confidenceRating: null, touchHistory: [], reflectionRefs: [], afiRefs: [],
        isAnonymousAtAreaLevel: true, notes: 'Created from the DA&I Forms import.', createdAt: nowISO(), lastUpdated: nowISO(),
      };
      staff.push(profile);
      if (profile.areaCode) touchedAreas.add(profile.areaCode);
      created++;
    }
    if (!profile.touchHistory) profile.touchHistory = [];
    importedIds.push(profile.staffId);
    p.records.forEach(r => {
      const areaCode = _daiResolveArea(r.areaRaw) || profile.areaCode || '';
      const stored = { ...r, staffId: profile.staffId, areaCode, importedAt: nowISO() };
      store.responses.push(stored);
      added++;
      if (!profile.touchHistory.some(t => t.sourceRef === r.key)) {
        const b = _daiBefore(stored), a = _daiAfter(stored);
        profile.touchHistory.push({
          touchId: generateId(),
          touchType: r.source === 'registration' ? TOUCH_TYPE.TRAINING : TOUCH_TYPE.REFLECTION,
          date: (r.when || todayISO()).slice(0, 10), areaCode,
          summary: r.source === 'registration'
            ? `DA&I training registration${b != null ? `, confidence before ${b} of 5` : ''}`
            : `DA&I "How's it going"${a != null ? `, average confidence ${_daiFmt(a)} of 5` : ''}`,
          sourceRef: r.key, createdAt: nowISO(),
        });
      }
    });
    profile.lastUpdated = nowISO();
  });

  touchedAreas.forEach(code => {
    const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === code);
    if (!area) return;
    if (!area.staffRefs) area.staffRefs = [];
    staff.filter(s => s.areaCode === code && !area.staffRefs.includes(s.staffId)).forEach(s => area.staffRefs.push(s.staffId));
    if (typeof saveArea === 'function') saveArea(area);
  });
  if (typeof saveStaffBulk === 'function') saveStaffBulk();
  if (typeof saveDAIData === 'function') saveDAIData();
  // Empty development priorities take the person's DA&I targets.
  const pr = typeof daiFillPriorities === 'function' ? daiFillPriorities(importedIds) : { filled: 0 };
  return { created, linked, added, prioritiesFilled: pr.filled };
}

// ── Analysis ──────────────────────────────────────────────────
// Each person's latest response of each kind counts.
function _daiLatest(source) {
  const map = new Map();
  _daiStore().responses.filter(r => r.source === source).forEach(r => {
    const k = r.staffId || r.email || r.key;
    const cur = map.get(k);
    if (!cur || (r.when || '') > (cur.when || '')) map.set(k, r);
  });
  return [...map.values()];
}

function _daiCompute() {
  const regs = _daiLatest('registration');
  const refl = _daiLatest('reflection');
  const staffById = new Map(_daiStaffList().map(s => [s.staffId, s]));
  const people = new Map();
  const person = id => { if (!people.has(id)) { const s = staffById.get(id); people.set(id, { staffId: id, name: s ? s.name : 'Unknown', areaCode: s ? s.areaCode : '', before: null, after: null, elements: {}, targets: [], reg: null, refl: null }); } return people.get(id); };
  regs.forEach(r => { const p = person(r.staffId); p.reg = r; p.before = _daiBefore(r); if (r.areaCode) p.areaCode = r.areaCode; });
  refl.forEach(r => { const p = person(r.staffId); p.refl = r; p.elements = _daiElements(r); p.after = _daiAfter(r); p.targets = _daiTargets(r); if (r.areaCode) p.areaCode = r.areaCode; });
  const all = [...people.values()];

  const elements = DAI_ELEMENTS.map(e => {
    const scores = all.map(p => p.elements[e.id]).filter(v => v != null);
    return { ...e, avg: _daiAvg(scores), n: scores.length, low: scores.filter(v => v <= 2).length };
  }).sort((a, b) => (a.avg == null) - (b.avg == null) || (a.avg || 0) - (b.avg || 0));

  const areaMap = new Map();
  all.forEach(p => {
    const code = p.areaCode || '';
    if (!areaMap.has(code)) areaMap.set(code, []);
    areaMap.get(code).push(p);
  });
  const areas = [...areaMap.entries()].map(([code, ps]) => {
    const elAvg = DAI_ELEMENTS.map(e => ({ e, avg: _daiAvg(ps.map(p => p.elements[e.id])) })).filter(x => x.avg != null).sort((a, b) => a.avg - b.avg);
    const before = _daiAvg(ps.map(p => p.before)), after = _daiAvg(ps.map(p => p.after));
    return {
      code, name: code ? _daiAreaName(code) : 'No area matched',
      registered: ps.filter(p => p.reg).length, reflections: ps.filter(p => p.refl).length,
      before, after, weakest: elAvg[0] ? elAvg[0].e.label : '',
    };
  }).sort((a, b) => (a.after == null) - (b.after == null) || (a.after || 0) - (b.after || 0));

  const coaching = all.map(p => {
    const reasons = [];
    if (p.after != null && p.after <= DAI_LOW) reasons.push(`Low confidence after the day (${_daiFmt(p.after)})`);
    if (p.before != null && p.after != null && p.after < p.before) reasons.push('Confidence lower after the day than before');
    const lowT = p.targets.filter(t => t.confidence != null && t.confidence <= 2).length;
    if (lowT) reasons.push(`${lowT} target${lowT === 1 ? '' : 's'} rated 2 or below`);
    return { ...p, reasons };
  }).filter(p => p.reasons.length).sort((a, b) => (a.after ?? 9) - (b.after ?? 9));

  const support = new Map();
  all.forEach(p => {
    if (!p.refl || !p.refl.supportWanted) return;
    p.refl.supportWanted.split(/;|\n/).map(s => s.trim()).filter(Boolean).forEach(opt => {
      if (!support.has(opt)) support.set(opt, []);
      support.get(opt).push(p);
    });
  });

  return {
    all, regsCount: regs.length, reflCount: refl.length,
    before: _daiAvg(all.map(p => p.before)), after: _daiAvg(all.map(p => p.after)),
    both: all.filter(p => p.before != null && p.after != null),
    elements, areas, coaching,
    support: [...support.entries()].map(([opt, ps]) => ({ opt, people: ps })).sort((a, b) => b.people.length - a.people.length),
    unscored: _daiStore().responses.filter(r => (r.source === 'registration' && r.overallRaw != null && r.overallRaw !== '' && _daiBefore(r) == null)).length,
  };
}

// ── Page ──────────────────────────────────────────────────────
function initDAI() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="margin-bottom:var(--space-lg);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Digital Accessibility and Inclusion progress</h1>
      <p style="font-size:var(--text-sm);color:var(--color-muted);max-width:70ch;margin-top:var(--space-xs);">
        Staff confidence before and after the DA&amp;I training, personal targets and support asks, from the Registration and "How's it going" Forms exports in your Data folder.
      </p>
    </div>
    <section aria-labelledby="dai-import-h" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);margin-bottom:var(--space-xl);background:var(--color-white);">
      <h2 id="dai-import-h" style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">Import</h2>
      <p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-md);max-width:70ch;">Save the Forms exports (.xlsx) into the Data folder, then import. The Hub finds them by their columns, so the file names do not matter. Responses already imported are skipped.</p>
      <div class="btn-row">
        <button id="dai-scan-btn" type="button" class="btn btn--primary">Check the Data folder</button>
        <button id="dai-fill-btn" type="button" class="btn btn--secondary">Fill development priorities from targets</button>
      </div>
      <p id="dai-status" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-slate);margin-top:var(--space-md);"></p>
      <div id="dai-review"></div>
    </section>
    <div id="dai-body"></div>
  `;
  document.getElementById('dai-scan-btn').addEventListener('click', _daiOnScan);
  document.getElementById('dai-fill-btn').addEventListener('click', () => {
    const r = typeof daiFillPriorities === 'function' ? daiFillPriorities() : { people: 0, filled: 0 };
    document.getElementById('dai-status').textContent = r.filled
      ? `Filled ${r.filled} development priorit${r.filled === 1 ? 'y' : 'ies'} for ${r.people} ${r.people === 1 ? 'person' : 'people'}. Only empty slots were used.`
      : 'Nothing to fill: every target is already a priority, or the three slots are full.';
  });
  main.addEventListener('click', _daiDelegate);
  _daiRenderBody();
}

function _daiDelegate(ev) {
  const pb = ev.target.closest('[data-dsu-prompt]');
  if (pb) {
    ev.preventDefault();
    const spec = typeof daiPromptSpec === 'function' ? daiPromptSpec(+pb.getAttribute('data-dsu-prompt')) : null;
    if (spec && typeof daiPromptOpen === 'function') daiPromptOpen(spec, pb);
    return;
  }
  const b = ev.target.closest('[data-dai-staff]');
  if (!b) return;
  ev.preventDefault();
  if (typeof openStaffProfile === 'function') openStaffProfile(b.getAttribute('data-dai-staff'));
}

async function _daiOnScan() {
  const status = document.getElementById('dai-status');
  const review = document.getElementById('dai-review');
  review.innerHTML = '';
  status.textContent = 'Reading the Data folder…';
  try {
    _daiPending = await _daiScan();
  } catch (e) {
    status.textContent = e.message || String(e);
    return;
  }
  const s = _daiPending;
  status.textContent = `${s.found.map(f => `${f.kind}: ${f.name} (${f.count} rows)`).join('. ')}.`;
  review.innerHTML = _daiReviewHTML(s);
  document.getElementById('dai-apply-btn')?.addEventListener('click', _daiOnApply);
  document.getElementById('dai-cancel-btn')?.addEventListener('click', () => { _daiPending = null; review.innerHTML = ''; status.textContent = 'Import cancelled. Nothing was changed.'; });
  document.getElementById('dai-review-h')?.focus();
}

function _daiAreaOptions(selected) {
  const opts = _daiAreaList().slice().sort((a, b) => a.areaName.localeCompare(b.areaName))
    .map(a => `<option value="${_daiEsc(a.areaCode)}"${a.areaCode === selected ? ' selected' : ''}>${_daiEsc(a.areaCode)}, ${_daiEsc(a.areaName)}</option>`).join('');
  return `<option value=""${!selected ? ' selected' : ''}>Choose an area</option><option value="__none">No curriculum area (cross-college)</option>${opts}`;
}

function _daiReviewHTML(s) {
  const later = s.found.filter(f => f.later);
  const h3 = t => `<h4 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-xs);">${t}</h4>`;
  const hint = t => `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);max-width:70ch;">${t}</p>`;
  const row = 'display:flex;flex-wrap:wrap;gap:var(--space-sm);align-items:center;padding:var(--space-xs) 0;border-bottom:1px solid var(--color-border);';
  if (!s.fresh.length) {
    return `<h3 id="dai-review-h" tabindex="-1" style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Nothing new to import</h3>
      ${hint(`All ${s.already} responses in these files are already in the Hub.`)}
      ${later.length ? hint(`Area Action Plan export found (${_daiEsc(later[0].name)}). Its import comes in the next update.`) : ''}`;
  }

  const wordings = s.wordings.length ? `${h3('How should these answers be scored?')}
    ${hint('These answers do not start with a number. Check each one. The Hub remembers your choice for future imports.')}
    ${s.wordings.map((w, i) => `<div style="${row}">
      <label for="dai-scale-${i}" style="flex:1 1 260px;font-size:var(--text-sm);">"${_daiEsc(w.raw)}" <span style="color:var(--color-muted);">(${w.count} answer${w.count === 1 ? '' : 's'})</span></label>
      <select id="dai-scale-${i}" class="form-select" data-dai-scale="${_daiEsc(_daiNorm(w.raw))}" style="max-width:240px;">
        <option value="0"${w.guess == null ? ' selected' : ''}>Not a rating, ignore</option>
        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${w.guess === n ? ' selected' : ''}>${n}, ${DAI_SCALE_WORDS[n]}</option>`).join('')}
      </select></div>`).join('')}` : '';

  const areas = s.areaTexts.length ? `${h3('Which area is this?')}
    ${hint('These area answers do not exactly match a Hub area. The Hub has suggested a match where it could. It remembers your choice.')}
    ${s.areaTexts.map((a, i) => `<div style="${row}">
      <label for="dai-area-${i}" style="flex:1 1 260px;font-size:var(--text-sm);">"${_daiEsc(a.raw)}" <span style="color:var(--color-muted);">(${a.count})</span></label>
      <select id="dai-area-${i}" class="form-select" data-dai-area="${_daiEsc(_daiNorm(a.raw))}" style="max-width:320px;">${_daiAreaOptions(a.guess)}</select></div>`).join('')}` : '';

  const staffById = new Map(_daiStaffList().map(x => [x.staffId, x]));
  const names = s.nameMatches.length ? `${h3('Is this the same person?')}
    ${hint('These responses match an existing profile by name only. Keep the match to link them and save the email on that profile, or choose a new profile.')}
    ${s.nameMatches.map((p, i) => `<div style="${row}">
      <label for="dai-name-${i}" style="flex:1 1 260px;font-size:var(--text-sm);">${_daiEsc(p.name)} <span style="color:var(--color-muted);">${_daiEsc(p.email)}${p.areaRaw ? ', ' + _daiEsc(p.areaRaw) : ''}</span></label>
      <select id="dai-name-${i}" class="form-select" data-dai-name="${_daiEsc(p.pk)}" style="max-width:320px;">
        ${p.match.options.map(id => { const x = staffById.get(id); return `<option value="${_daiEsc(id)}">Same as profile: ${_daiEsc(x.name)}${x.areaCode ? ', ' + _daiEsc(x.areaCode) : ''}</option>`; }).join('')}
        <option value="__new">Different person, create a new profile</option>
      </select></div>`).join('')}` : '';

  const regs = s.fresh.filter(r => r.source === 'registration').length;
  const refl = s.fresh.length - regs;
  return `<h3 id="dai-review-h" tabindex="-1" style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Check before importing</h3>
    <ul style="font-size:var(--text-sm);color:var(--color-slate);margin:var(--space-sm) 0 0 var(--space-lg);">
      <li>${regs} new Registration response${regs === 1 ? '' : 's'} and ${refl} new "How's it going" response${refl === 1 ? '' : 's'}${s.already ? `, ${s.already} already in the Hub` : ''}.</li>
      <li>${s.people.length} people: ${s.byEmailCount} matched to a profile by email, ${s.nameMatches.length} by name (check below), ${s.toCreate} new profile${s.toCreate === 1 ? '' : 's'} to create.</li>
      ${later.length ? `<li>Area Action Plan export found (${_daiEsc(later[0].name)}). Its import comes in the next update.</li>` : ''}
      ${s.notes.map(n => `<li>${_daiEsc(n)}</li>`).join('')}
    </ul>
    ${wordings}${areas}${names}
    <div class="btn-row" style="margin-top:var(--space-lg);">
      <button id="dai-apply-btn" type="button" class="btn btn--primary">Import ${s.fresh.length} response${s.fresh.length === 1 ? '' : 's'}</button>
      <button id="dai-cancel-btn" type="button" class="btn btn--secondary">Cancel</button>
    </div>`;
}

function _daiOnApply() {
  if (!_daiPending) return;
  const decisions = { scale: {}, areas: {}, names: {} };
  document.querySelectorAll('[data-dai-scale]').forEach(el => { decisions.scale[el.getAttribute('data-dai-scale')] = parseInt(el.value, 10) || 0; });
  document.querySelectorAll('[data-dai-area]').forEach(el => { if (el.value) decisions.areas[el.getAttribute('data-dai-area')] = el.value; });
  document.querySelectorAll('[data-dai-name]').forEach(el => { decisions.names[el.getAttribute('data-dai-name')] = el.value; });
  const res = _daiApply(_daiPending, decisions);
  _daiPending = null;
  document.getElementById('dai-review').innerHTML = '';
  const msg = `Imported ${res.added} response${res.added === 1 ? '' : 's'}: ${res.linked} linked to existing profiles, ${res.created} new profile${res.created === 1 ? '' : 's'} created${res.prioritiesFilled ? `, ${res.prioritiesFilled} development priorit${res.prioritiesFilled === 1 ? 'y' : 'ies'} filled from targets` : ''}.`;
  document.getElementById('dai-status').textContent = msg;
  if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('success', msg);
  _daiRenderBody();
}

function _daiKPI(value, label, sub) {
  return `<div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);background:var(--color-white);">
    <p style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">${value}</p>
    <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-slate);">${label}</p>
    ${sub ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${sub}</p>` : ''}
  </div>`;
}

function _daiBar(avg) {
  if (avg == null) return '';
  const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
  return `<span aria-hidden="true" style="display:inline-block;vertical-align:middle;width:100px;height:10px;border:1px solid var(--color-border);border-radius:999px;margin-left:var(--space-sm);overflow:hidden;"><span style="display:block;height:100%;width:${pct}%;background:var(--color-teal);"></span></span>`;
}

const _daiTh = t => `<th scope="col" style="text-align:left;padding:var(--space-sm);border-bottom:2px solid var(--color-border);color:var(--color-navy);">${t}</th>`;
const _daiTd = (t, extra) => `<td style="padding:var(--space-sm);border-bottom:1px solid var(--color-border);vertical-align:top;${extra || ''}">${t}</td>`;
function _daiSection(id, title, intro, inner) {
  return `<section aria-labelledby="${id}" style="margin-bottom:var(--space-xl);">
    <h2 id="${id}" style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-xs);">${title}</h2>
    ${intro ? `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);max-width:70ch;">${intro}</p>` : ''}
    ${inner}</section>`;
}
function _daiTable(caption, heads, rows, minWidth) {
  return `<div style="overflow-x:auto;" tabindex="0" role="region" aria-label="${_daiEsc(caption)}">
    <table style="border-collapse:collapse;width:100%;min-width:${minWidth || 560}px;font-size:var(--text-sm);">
      <caption style="text-align:left;font-size:var(--text-xs);color:var(--color-muted);padding-bottom:var(--space-xs);">${caption}</caption>
      <thead><tr>${heads.map(_daiTh).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
const _daiPersonBtn = p => `<button type="button" data-dai-staff="${_daiEsc(p.staffId)}" style="background:none;border:none;padding:0;color:var(--color-teal);text-decoration:underline;cursor:pointer;font:inherit;min-height:24px;text-align:left;">${_daiEsc(p.name)}</button>`;

function _daiRenderBody() {
  const body = document.getElementById('dai-body');
  if (!body) return;
  if (!_daiStore().responses.length) {
    body.innerHTML = `<p style="font-size:var(--text-sm);color:var(--color-muted);">No DA&amp;I responses imported yet. Use "Check the Data folder" above.</p>`;
    return;
  }
  const d = _daiCompute();
  const shift = d.both.length ? _daiAvg(d.both.map(p => p.after - p.before)) : null;

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-xl);">
    ${_daiKPI(d.regsCount, 'People registered', 'Came to the DA&amp;I training')}
    ${_daiKPI(d.reflCount, '"How\'s it going" returns', `${d.all.filter(p => p.reg && p.refl).length} of them also registered`)}
    ${_daiKPI(d.before == null ? '–' : `${_daiFmt(d.before)} of 5`, 'Confidence before', 'One overall rating at registration')}
    ${_daiKPI(d.after == null ? '–' : `${_daiFmt(d.after)} of 5`, 'Confidence after', 'Average across the 11 elements')}
    ${_daiKPI(shift == null ? '–' : `${shift >= 0 ? '+' : ''}${_daiFmt(shift)}`, 'Average change', `${d.both.length} people answered both`)}
  </div>`;

  const elRows = d.elements.map(e => `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(`${_daiFmt(e.avg)}${_daiBar(e.avg)}`)}${_daiTd(e.low)}${_daiTd(e.n)}</tr>`);
  const elements = _daiSection('dai-el-h', 'Confidence by element', 'Lowest first. These are the elements to train or resource next.',
    _daiTable('Average confidence after the training, out of 5, for each element', ['Element', 'Average of 5', 'People at 1 or 2', 'Answers'], elRows));

  const arRows = d.areas.map(a => `<tr>${_daiTd(a.code ? `<strong>${_daiEsc(a.code)}</strong> ${_daiEsc(a.name)}` : _daiEsc(a.name))}${_daiTd(a.registered)}${_daiTd(a.reflections)}${_daiTd(_daiFmt(a.before))}${_daiTd(_daiFmt(a.after))}${_daiTd(_daiEsc(a.weakest))}</tr>`);
  const areas = _daiSection('dai-ar-h', 'By area', 'Lowest confidence after the training first. The weakest element is where that area most needs support.',
    _daiTable('Confidence by curriculum area, out of 5', ['Area', 'Registered', 'Returns', 'Before', 'After', 'Weakest element'], arRows, 720));

  const coRows = d.coaching.map(p => `<tr>${_daiTd(_daiPersonBtn(p))}${_daiTd(_daiEsc(p.areaCode || ''))}${_daiTd(_daiFmt(p.before))}${_daiTd(_daiFmt(p.after))}${_daiTd(p.reasons.map(_daiEsc).join('<br>'))}</tr>`);
  const coaching = _daiSection('dai-co-h', `Coaching list (${d.coaching.length})`, `People with average confidence of ${DAI_LOW} or below after the training, lower confidence than before, or targets they feel unsure of. Select a name to open their profile.`,
    d.coaching.length ? _daiTable('Staff who may benefit from coaching', ['Name', 'Area', 'Before', 'After', 'Why listed'], coRows, 720) : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No one meets these conditions.</p>');

  const support = _daiSection('dai-su-h', 'Support asked for', 'From "What support would help you?". Open a group to see who asked and what for.',
    d.support.length ? d.support.map(g => `<details style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-sm);">
      <summary style="cursor:pointer;font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);min-height:24px;">${_daiEsc(g.opt)} (${g.people.length})</summary>
      <ul style="list-style:none;margin-top:var(--space-sm);">${g.people.map(p => `<li style="font-size:var(--text-sm);padding:var(--space-xs) 0;border-top:1px solid var(--color-border);">${_daiPersonBtn(p)}${p.areaCode ? ` <span style="color:var(--color-muted);">${_daiEsc(p.areaCode)}</span>` : ''}${p.refl.supportDetail ? `<br><span style="color:var(--color-slate);">${_daiEsc(p.refl.supportDetail)}</span>` : ''}</li>`).join('')}</ul>
    </details>`).join('') : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No support requests yet.</p>');

  const caveat = `<p style="font-size:var(--text-xs);color:var(--color-muted);max-width:75ch;">Before is one overall rating given at registration; after is the average of 11 element ratings. Treat the change as an indication, not a like-for-like measure. Each person's latest response of each kind counts.${d.unscored ? ` ${d.unscored} registration answer${d.unscored === 1 ? ' is' : 's are'} not scored yet: run the import again to map the wording.` : ''}</p>`;

  const sp = typeof daiSupportParts === 'function' ? daiSupportParts() : {};
  const panels = {
    overview:  kpis + (sp.actions || '') + caveat,
    resources: sp.resources || '',
    theme:     (sp.themes || '') + elements,
    area:      areas + (sp.areaNeeds || ''),
    campus:    sp.campus || '',
    people:    coaching + (sp.person || ''),
    asked:     support,
  };
  if (!panels[_daiTab]) _daiTab = 'overview';
  body.innerHTML = `
    <div role="tablist" aria-label="DA&amp;I progress views" style="display:flex;flex-wrap:wrap;gap:2px;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-lg);">
      ${DAI_TABS.map(t => `<button type="button" role="tab" id="dai-tab-${t.id}" aria-controls="dai-panel" aria-selected="${t.id === _daiTab}" tabindex="${t.id === _daiTab ? '0' : '-1'}" data-dai-tab="${t.id}"
        style="padding:10px 16px;min-height:44px;border:none;border-bottom:3px solid ${t.id === _daiTab ? 'var(--color-teal)' : 'transparent'};margin-bottom:-2px;background:none;cursor:pointer;font:${t.id === _daiTab ? 'bold ' : ''}var(--text-sm) Arial,sans-serif;color:${t.id === _daiTab ? 'var(--color-teal)' : 'var(--color-slate)'};">${t.label}</button>`).join('')}
    </div>
    <div id="dai-panel" role="tabpanel" aria-labelledby="dai-tab-${_daiTab}" tabindex="0">${panels[_daiTab]}</div>`;
  body.querySelectorAll('[data-dai-tab]').forEach(b => {
    b.addEventListener('click', () => _daiSetTab(b.dataset.daiTab));
    b.addEventListener('keydown', e => {
      const i = DAI_TABS.findIndex(t => t.id === b.dataset.daiTab);
      const go = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: DAI_TABS.length - 1 }[e.key];
      if (go == null) return;
      e.preventDefault();
      _daiSetTab(DAI_TABS[(go + DAI_TABS.length) % DAI_TABS.length].id);
    });
  });
  if (typeof daiWireSupportSection === 'function') daiWireSupportSection();
}

const DAI_TABS = Object.freeze([
  { id: 'overview',  label: 'Overview' },
  { id: 'resources', label: 'By resource type' },
  { id: 'theme',     label: 'By theme' },
  { id: 'area',      label: 'By area' },
  { id: 'campus',    label: 'By campus' },
  { id: 'people',    label: 'By person' },
  { id: 'asked',     label: 'Support asked for' },
]);
let _daiTab = 'overview';
function _daiSetTab(id) {
  _daiTab = id;
  _daiRenderBody();
  document.getElementById('dai-tab-' + id)?.focus();
}

// ── Staff profile card ────────────────────────────────────────
function daiGetStaffSummary(staffId) {
  const rs = _daiStore().responses.filter(r => r.staffId === staffId).sort((a, b) => (a.when || '').localeCompare(b.when || ''));
  return { regs: rs.filter(r => r.source === 'registration'), refls: rs.filter(r => r.source === 'reflection') };
}

function daiRenderStaffCard(staffId) {
  if (!window.DPC_DATA || !window.DPC_DATA.dai) return '';
  const { regs, refls } = daiGetStaffSummary(staffId);
  if (!regs.length && !refls.length) return '';
  const reg = regs[regs.length - 1], refl = refls[refls.length - 1];
  const before = reg ? _daiBefore(reg) : null;
  const after = refl ? _daiAfter(refl) : null;
  const els = refl ? _daiElements(refl) : {};
  const word = n => n == null ? 'No answer' : `${n} of 5, ${DAI_SCALE_WORDS[n].toLowerCase()}`;
  const line = (label, text) => text ? `<p style="font-size:var(--text-sm);margin-top:var(--space-xs);"><strong>${label}:</strong> ${_daiEsc(text)}</p>` : '';
  const targets = refl ? _daiTargets(refl) : [];

  return `<section aria-labelledby="dai-card-h-${_daiEsc(staffId)}" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);margin-bottom:var(--space-lg);">
    <h3 id="dai-card-h-${_daiEsc(staffId)}" style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">Digital Accessibility and Inclusion</h3>
    <p style="font-size:var(--text-sm);color:var(--color-slate);">
      Before the training: <strong>${before == null ? 'not given' : word(before)}</strong>${reg && reg.when ? ` (${_daiFmtDate(reg.when)})` : ''}.
      After: <strong>${after == null ? (refl ? 'no ratings' : 'no "How\'s it going" response yet') : `${_daiFmt(after)} of 5 average`}</strong>${refl && refl.when ? ` (${_daiFmtDate(refl.when)})` : ''}.
    </p>
    ${refl ? `
      <div style="overflow-x:auto;margin-top:var(--space-md);" tabindex="0" role="region" aria-label="Confidence by element">
        <table style="border-collapse:collapse;width:100%;min-width:360px;font-size:var(--text-sm);">
          <caption style="text-align:left;font-size:var(--text-xs);color:var(--color-muted);padding-bottom:var(--space-xs);">Confidence after the training</caption>
          <thead><tr>${_daiTh('Element')}${_daiTh('Rating')}</tr></thead>
          <tbody>${DAI_ELEMENTS.map(e => `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(`${els[e.id] == null ? '–' : els[e.id] + ' of 5'}${_daiBar(els[e.id])}`)}</tr>`).join('')}</tbody>
        </table>
      </div>
      ${targets.length ? `<h4 style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Their targets to December</h4>
        <ol style="margin:var(--space-xs) 0 0 var(--space-lg);font-size:var(--text-sm);">${targets.map(t => `<li style="margin-bottom:var(--space-xs);">${_daiEsc(t.text)} <span style="color:var(--color-muted);">(confidence ${t.confidence == null ? 'not given' : t.confidence + ' of 5'})</span></li>`).join('')}</ol>` : ''}
      ${typeof daiSupportStaffHTML === 'function' ? daiSupportStaffHTML(staffId) : ''}
      ${line('Support asked for', (refl.supportWanted || '').split(/;|\n/).map(x => x.trim()).filter(Boolean).join(', '))}${line('What for', refl.supportDetail)}
      ${(refl.takeaway || refl.tried || refl.why) ? `<details style="margin-top:var(--space-md);"><summary style="cursor:pointer;font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);min-height:24px;">Their reflections</summary>
        ${line('Took away', refl.takeaway)}${line('Tried since', refl.tried)}${line('Why it matters to them', refl.why)}</details>` : ''}
    ` : ''}
  </section>`;
}
