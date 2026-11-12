// DPC Hub · js/dai-roster.js · v1.0 · 12/11/26 · TLA Tracker (staff roster) and Area attendance workbook: import, profile updates, who has not trained
//
// TLA Tracker ("TLA Tracker 26-27", updated monthly): recognised by its
// FIRST NAME and LAST NAME columns. Only these columns are read:
//   FACULTY, CAMPUS, FIRST NAME, LAST NAME, Manager, JOB TITLE, STATUS, EMPLOYMENT.
// Observer, coaching, LRA, review, CPD and COG columns are never read.
// Each person is matched to a staff profile by name (exact, or a strong
// unique near-match; anything uncertain is shown for Graeme to confirm),
// otherwise a profile is created. Name, area, campus and role are kept in
// step with the tracker unless Graeme has changed them by hand. Profiles
// the tracker added that drop off a later tracker are flagged, never deleted.
//
// Area attendance workbook ("Area-attendance-DA&I 26"): every sheet with a
// Name column and an "Attending on 23 Oct" column is one area's list; the
// sheet name is the area. Read: name, role or subject, attending, trained
// for learning walks, the three session columns. Access or dietary needs
// and notes are never read. The whole list is replaced on each import.
//
// Trained = has a registration rating (day register or catch-up Check-In).
//
// Stored in data-dai.json: dai.roster { fileName, importedAt, hash, count },
// dai.expected [ { name, areaRaw, areaCode, role, attending, lw, sessions, staffId } ], dai.expectedHash.
// Tracker details live on each staff profile as profile.tracker.
//
// Public: daiRosterRead(bytes, fileName), daiRosterPrepare(results), daiRosterApply(prep, decisions),
//         daiAttendanceHTML(), daiRosterReviewHTML(prep), DAI_CAMPUSES

const DAI_CAMPUSES = Object.freeze(['SWSC', 'Loxton', 'Knightstone', 'Winter Gardens', 'CTC', 'Puxton Park', 'AMTEC', 'AROSFA']);

function _drsHash(v) {
  const s = JSON.stringify(v); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + s.length;
}
function _drsHeaderRow(rows, test) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const head = (rows[i] || []).map(_daiNorm);
    if (test(head)) return { i, head };
  }
  return null;
}
function _drsCampus(raw) {
  const n = _daiNorm(raw);
  if (!n) return '';
  const hit = DAI_CAMPUSES.find(c => n.includes(c.toLowerCase()) || c.toLowerCase().includes(n));
  if (hit) return hit;
  if (/south west skills|swsc/.test(n)) return 'SWSC';
  if (/winter/.test(n)) return 'Winter Gardens';
  if (/puxton/.test(n)) return 'Puxton Park';
  return String(raw).trim();
}
const _drsYes = v => /^\s*(y|yes|attending|true|✓|x)\b/i.test(String(v == null ? '' : v));
const _drsNo = v => /^\s*(n|no|not)\b/i.test(String(v == null ? '' : v));

// ── Read ──────────────────────────────────────────────────────
function daiRosterRead(bytes, fileName) {
  if (typeof XLSX === 'undefined') return null;
  let wb; try { wb = XLSX.read(bytes, { type: 'array' }); } catch { return null; }
  const sheets = wb.SheetNames.map(n => ({ n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }) }));

  // TLA Tracker
  for (const sh of sheets) {
    const h = _drsHeaderRow(sh.rows, head => head.includes('first name') && head.includes('last name') && (head.includes('faculty') || head.includes('job title')));
    if (!h) continue;
    const col = name => h.head.indexOf(name);
    const c = { faculty: col('faculty'), campus: col('campus'), first: col('first name'), last: col('last name'), manager: col('manager'), job: col('job title'), status: col('status'), employment: col('employment') };
    const people = sh.rows.slice(h.i + 1).map(r => {
      const t = i => (i >= 0 ? _daiText(r[i]) : '');
      const first = t(c.first), last = t(c.last);
      if (!first && !last) return null;
      return { first, last, name: [first, last].filter(Boolean).join(' '), faculty: t(c.faculty), campusRaw: t(c.campus), campus: _drsCampus(t(c.campus)),
        manager: t(c.manager), jobTitle: t(c.job), status: t(c.status), employment: t(c.employment) };
    }).filter(Boolean);
    return { kind: 'tracker', fileName, sheet: sh.n, people };
  }

  // Area attendance workbook
  const lists = [];
  sheets.forEach(sh => {
    const h = _drsHeaderRow(sh.rows, head => head.includes('name') && head.some(x => x.startsWith('attending on')));
    if (!h) return;
    const nameC = h.head.indexOf('name'), roleC = h.head.findIndex(x => x.startsWith('role')), attC = h.head.findIndex(x => x.startsWith('attending on'));
    const lwC = h.head.findIndex(x => x.startsWith('trained for learning walks'));
    const sesC = [1, 2, 3].map(n => h.head.findIndex(x => x.startsWith(`session ${n}`)));
    sh.rows.slice(h.i + 1).forEach(r => {
      const name = _daiText(r[nameC]);
      if (!name || /^(total|name|staff name)$/i.test(name)) return;
      lists.push({ name, areaRaw: sh.n.trim(), role: roleC >= 0 ? _daiText(r[roleC]) : '', attendingRaw: _daiText(r[attC]),
        lw: lwC >= 0 ? _drsYes(r[lwC]) : false, sessions: sesC.map(i => (i >= 0 ? _drsYes(r[i]) || (!!_daiText(r[i]) && !_drsNo(r[i])) : false)) });
    });
  });
  if (lists.length) return { kind: 'attendance', fileName, people: lists };
  return null;
}

// ── Match people to profiles by name ─────────────────────────
// Common short forms, so "Bob Birch" on a form and "Robert Birch" on the tracker are offered as a match.
const DAI_NICKNAMES = Object.freeze([
  ['robert', 'rob', 'bob', 'bobby', 'robbie'], ['william', 'will', 'bill', 'billy', 'liam'], ['richard', 'rich', 'rick', 'dick'],
  ['elizabeth', 'liz', 'lizzie', 'beth', 'betty', 'eliza'], ['katherine', 'catherine', 'kathryn', 'kate', 'katie', 'kath', 'cath', 'cathy', 'kathy'],
  ['margaret', 'maggie', 'meg', 'peggy'], ['jennifer', 'jen', 'jenny'], ['rebecca', 'becky', 'becca', 'bex'], ['victoria', 'vicky', 'vicki', 'tori'],
  ['alexander', 'alex', 'sandy'], ['alexandra', 'alex', 'lexi'], ['christopher', 'chris'], ['christine', 'christina', 'chris', 'tina'],
  ['michael', 'mike', 'mick', 'mickey'], ['nicholas', 'nick', 'nicky'], ['nicola', 'nicky', 'nikki'], ['jonathan', 'jon', 'john', 'jonny'],
  ['james', 'jim', 'jimmy', 'jamie'], ['joseph', 'joe', 'joey'], ['thomas', 'tom', 'tommy'], ['matthew', 'matt'], ['andrew', 'andy', 'drew'],
  ['anthony', 'tony'], ['daniel', 'dan', 'danny'], ['david', 'dave', 'davey'], ['edward', 'ed', 'eddie', 'ted'], ['benjamin', 'ben'],
  ['samuel', 'sam'], ['samantha', 'sam'], ['stephen', 'steven', 'steve'], ['timothy', 'tim'], ['peter', 'pete'], ['philip', 'phillip', 'phil'],
  ['gareth', 'gaz'], ['susan', 'sue', 'susie'], ['deborah', 'debbie', 'deb'], ['patricia', 'pat', 'trish', 'tricia'], ['jacqueline', 'jackie', 'jacqui'],
  ['amanda', 'mandy'], ['charlotte', 'charlie', 'lottie'], ['charles', 'charlie', 'chas'], ['gregory', 'greg'], ['kenneth', 'ken', 'kenny'],
  ['lawrence', 'laurence', 'laurie', 'larry'], ['frederick', 'fred', 'freddie'], ['abigail', 'abi', 'abby'], ['jessica', 'jess'], ['eleanor', 'ellie', 'nell'],
  ['helen', 'nell'], ['joanne', 'joanna', 'jo'], ['josephine', 'jo', 'josie'], ['natalie', 'nat'], ['nathan', 'nathaniel', 'nat'], ['zachary', 'zach', 'zak'],
]);
function _drsSameFirst(a, b) {
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a) || _dblLev(a, b) <= 1) return true;
  return DAI_NICKNAMES.some(g => g.includes(a) && g.includes(b));
}

function _drsCandidates(name, areaCode, staff) {
  const nk = _daiNameKey(name);
  const exact = staff.filter(s => _daiNameKey(s.name) === nk);
  if (exact.length === 1) return { auto: exact[0], options: [] };
  if (exact.length > 1) return { auto: null, options: exact };
  const a = _dblParts(name);
  const near = staff.filter(s => {
    const b = _dblParts(s.name);
    if (!a.last || !b.last) return false;
    const sameLast = a.last === b.last || (a.last.length > 3 && _dblLev(a.last, b.last) <= 1);
    // Same surname and a matching first name, or same surname in the same area (offered, never automatic).
    return sameLast && (_drsSameFirst(a.first, b.first) || (areaCode && s.areaCode === areaCode));
  });
  // A single near-match with the same surname and the same area is safe to link.
  if (near.length === 1 && _dblParts(near[0].name).last === a.last && areaCode && near[0].areaCode === areaCode && _drsSameFirst(a.first, _dblParts(near[0].name).first)) return { auto: near[0], options: [] };
  return { auto: null, options: near };
}

function daiRosterPrepare(results) {
  const store = _daiStore();
  const prep = { tracker: null, attendance: null, areaItems: [], changed: false };
  const tr = results.filter(r => r.kind === 'tracker').sort((a, b) => b.fileName.localeCompare(a.fileName))[0];
  if (tr) {
    const hash = _drsHash(tr.people);
    const same = store.roster && store.roster.hash === hash;
    const staff = _daiStaffList();
    const matched = [], review = [], create = [];
    tr.people.forEach((p, i) => {
      p.idx = i;
      p.areaCode = _daiResolveArea(p.faculty);
      const linked = staff.find(s => s.tracker && s.tracker.key === _daiNameKey(p.name));
      if (linked) { p.staffId = linked.staffId; matched.push(p); return; }
      const m = _drsCandidates(p.name, p.areaCode, staff);
      if (m.auto) { p.staffId = m.auto.staffId; matched.push(p); }
      else if (m.options.length) { p.options = m.options.map(s => s.staffId); review.push(p); }
      else create.push(p);
    });
    prep.tracker = { ...tr, hash, same, matched, review, create };
    if (!same) { prep.changed = true; tr.people.forEach(p => { if (p.faculty) prep.areaItems.push({ areaRaw: p.faculty }); }); }
  }
  const at = results.find(r => r.kind === 'attendance');
  if (at) {
    const hash = _drsHash(at.people);
    const same = store.expectedHash === hash;
    prep.attendance = { ...at, hash, same };
    if (!same) { prep.changed = true; [...new Set(at.people.map(p => p.areaRaw))].forEach(a => prep.areaItems.push({ areaRaw: a })); }
  }
  return prep;
}

function daiRosterReviewHTML(prep) {
  if (!prep || !prep.changed) return { li: '', block: '' };
  const li = [];
  const t = prep.tracker;
  if (t && !t.same) li.push(`<li>TLA Tracker (${_daiEsc(t.fileName)}): ${t.people.length} staff. ${t.matched.length} matched to a profile, ${t.review.length} to check below, ${t.create.length} new profile${t.create.length === 1 ? '' : 's'} to create. Only faculty, campus, name, manager, job title, status and employment are read.</li>`);
  const a = prep.attendance;
  if (a && !a.same) li.push(`<li>Area attendance lists (${_daiEsc(a.fileName)}): ${a.people.length} names across ${new Set(a.people.map(p => p.areaRaw)).size} sheets. This replaces the previous lists. Access, dietary needs and notes are not read.</li>`);
  let block = '';
  if (t && !t.same && t.review.length) {
    const byId = new Map(_daiStaffList().map(s => [s.staffId, s]));
    const row = 'display:flex;flex-wrap:wrap;gap:var(--space-sm);align-items:center;padding:var(--space-xs) 0;border-bottom:1px solid var(--color-border);';
    block = `<h4 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-xs);">TLA Tracker: is this the same person?</h4>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);max-width:70ch;">These tracker names are close to an existing profile but not certain. Keep the match, or create a new profile.</p>
      ${t.review.map(p => `<div style="${row}">
        <label for="drs-n-${p.idx}" style="flex:1 1 260px;font-size:var(--text-sm);">${_daiEsc(p.name)} <span style="color:var(--color-muted);">${_daiEsc(p.faculty)}${p.jobTitle ? ', ' + _daiEsc(p.jobTitle) : ''}</span></label>
        <select id="drs-n-${p.idx}" class="form-select" data-drs-name="${p.idx}" style="max-width:340px;">
          ${p.options.map(id => { const s = byId.get(id); return `<option value="${_daiEsc(id)}">Same as profile: ${_daiEsc(s.name)}${s.areaCode ? ', ' + _daiEsc(s.areaCode) : ''}${s.email ? ', ' + _daiEsc(s.email) : ''}</option>`; }).join('')}
          <option value="__new">Different person, create a new profile</option>
        </select></div>`).join('')}`;
  }
  return { li: li.join(''), block };
}

// ── Apply ─────────────────────────────────────────────────────
function daiRosterApply(prep, decisions) {
  const out = { created: 0, updated: 0, gone: 0, expected: 0 };
  if (!prep) return out;
  const store = _daiStore();
  const t = prep.tracker;
  if (t && !t.same) {
    const staff = window.DPC_DATA.staff.staff;
    const seen = new Set();
    const choose = p => {
      if (p.staffId) return staff.find(s => s.staffId === p.staffId);
      const d = decisions.tracker && decisions.tracker[p.idx];
      if (d && d !== '__new') return staff.find(s => s.staffId === d);
      return null;
    };
    t.people.forEach(p => {
      const areaCode = _daiResolveArea(p.faculty);
      let s = choose(p);
      if (!s) {
        s = { staffId: generateId(), name: p.name, email: '', areaCode, campus: p.campus, departmentCode: null, additionalAreas: [], role: p.jobTitle,
          entryPathway: 'tla-tracker', entryDate: todayISO(), etfStage: null, developmentPriorities: ['', '', ''], confidenceRating: null,
          touchHistory: [], reflectionRefs: [], afiRefs: [], isAnonymousAtAreaLevel: true, notes: 'Created from the TLA Tracker.', createdAt: nowISO(), lastUpdated: nowISO() };
        staff.push(s); out.created++;
      } else out.updated++;
      // Keep name, area, campus and role in step with the tracker unless changed by hand since the last tracker import.
      const prev = s.trackerSync || {};
      const sync = (field, val) => {
        if (!val) return;
        if (!s[field] || !s.trackerSync || s[field] === prev[field]) s[field] = val;
      };
      sync('name', p.name); sync('areaCode', areaCode); sync('campus', p.campus); sync('role', p.jobTitle);
      s.trackerSync = { name: p.name, areaCode, campus: p.campus, role: p.jobTitle };
      s.tracker = { key: _daiNameKey(p.name), faculty: p.faculty, campus: p.campusRaw, manager: p.manager, jobTitle: p.jobTitle, status: p.status, employment: p.employment, seen: todayISO(), fileName: t.fileName, onLatest: true };
      s.lastUpdated = nowISO();
      seen.add(s.staffId);
      if (areaCode) {
        const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
        if (area) { if (!area.staffRefs) area.staffRefs = []; if (!area.staffRefs.includes(s.staffId)) area.staffRefs.push(s.staffId); }
      }
    });
    staff.forEach(s => { if (s.tracker && !seen.has(s.staffId) && s.tracker.onLatest) { s.tracker.onLatest = false; out.gone++; } });
    store.roster = { fileName: t.fileName, importedAt: nowISO(), hash: t.hash, count: t.people.length };
    if (typeof _dirty !== 'undefined') _dirty.add('data-areas.json');
  }
  const a = prep.attendance;
  if (a && !a.same) {
    const staff = _daiStaffList();
    store.expected = a.people.map(p => {
      const areaCode = _daiResolveArea(p.areaRaw);
      const m = _drsCandidates(p.name, areaCode, staff);
      return { name: p.name, areaRaw: p.areaRaw, areaCode, role: p.role, attending: _drsYes(p.attendingRaw) ? 'yes' : _drsNo(p.attendingRaw) ? 'no' : 'unknown',
        attendingRaw: p.attendingRaw, lw: p.lw, sessions: p.sessions, staffId: m.auto ? m.auto.staffId : '' };
    });
    store.expectedHash = a.hash;
    out.expected = store.expected.length;
  }
  return out;
}

// ── Attendance view ───────────────────────────────────────────
function _drsTrained() {
  const map = new Map();
  _daiStore().responses.filter(r => r.source === 'registration').forEach(r => {
    const cur = map.get(r.staffId);
    if (!cur || r.session !== 'catch-up') map.set(r.staffId, r.session === 'catch-up' ? 'catch-up' : 'day');
  });
  return map;
}

function daiAttendanceHTML() {
  const store = _daiStore();
  const staff = _daiStaffList();
  const onTracker = staff.filter(s => s.tracker && s.tracker.onLatest);
  const expected = store.expected || [];
  if (!onTracker.length && !expected.length) {
    return _dsuP('Save the TLA Tracker and the Area attendance workbook into the Data folder, then use "Check the Data folder". This tab then shows who was due to train, who attended on the day or at a catch-up, and who has not trained yet.');
  }
  const trained = _drsTrained();
  const due = new Map();
  expected.forEach(e => { if (e.attending !== 'no') due.set(e.staffId || 'x:' + _daiNameKey(e.name), e); });
  // Everyone to account for: tracker staff, plus names on the lists not on the tracker.
  const people = new Map();
  onTracker.forEach(s => people.set(s.staffId, { staffId: s.staffId, name: s.name, areaCode: s.areaCode, role: s.role, status: s.tracker.status }));
  expected.forEach(e => { const k = e.staffId || 'x:' + _daiNameKey(e.name); if (!people.has(k)) people.set(k, { staffId: e.staffId, name: e.name, areaCode: e.areaCode, role: e.role, notOnTracker: true }); });
  const all = [...people.entries()].map(([k, p]) => ({ ...p, k, due: due.has(k), said: (expected.find(e => (e.staffId || 'x:' + _daiNameKey(e.name)) === k) || {}).attending || '', how: p.staffId ? trained.get(p.staffId) || '' : '' }));
  const day = all.filter(p => p.how === 'day').length, cu = all.filter(p => p.how === 'catch-up').length;
  const notYet = all.filter(p => !p.how);
  const dueNot = notYet.filter(p => p.due);

  const tiles = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--space-md);margin-bottom:var(--space-xl);">
    ${_daiKPI(onTracker.length, 'Staff on the TLA Tracker', store.roster ? `Imported ${_daiFmtDate(store.roster.importedAt)}` : '')}
    ${_daiKPI(due.size, 'Due to attend on 23 Oct', 'From the area attendance lists')}
    ${_daiKPI(day, 'Trained on the day', 'On the day registration')}
    ${_daiKPI(cu, 'Trained at a catch-up', 'On the Check-In register')}
    ${_daiKPI(notYet.length, 'Not trained yet', `${dueNot.length} of them were due on the day`)}
  </div>`;

  const byArea = new Map();
  all.forEach(p => { const k = p.areaCode || ''; if (!byArea.has(k)) byArea.set(k, []); byArea.get(k).push(p); });
  const nameBtn = p => p.staffId ? _daiPersonBtn(p) : _daiEsc(p.name);
  const rows = [...byArea.entries()].map(([code, ps]) => ({ code, ps, not: ps.filter(p => !p.how) }))
    .sort((a, b) => b.not.length - a.not.length || a.code.localeCompare(b.code))
    .map(x => `<tr>${_daiTd(x.code ? `<strong>${_daiEsc(x.code)}</strong> ${_daiEsc(_daiAreaName(x.code))}` : 'No area matched')}${_daiTd(x.ps.length)}${_daiTd(x.ps.filter(p => p.due).length)}${_daiTd(x.ps.filter(p => p.how === 'day').length)}${_daiTd(x.ps.filter(p => p.how === 'catch-up').length)}
      ${_daiTd(x.not.length ? `<details><summary style="cursor:pointer;min-height:24px;color:var(--color-teal);font-weight:bold;">${x.not.length} <span class="sr-only">not trained, show who</span></summary><ul style="list-style:none;margin-top:4px;">${x.not.sort((a, b) => a.name.localeCompare(b.name)).map(p => `<li style="padding:2px 0;">${nameBtn(p)} <span style="color:var(--color-muted);">${_daiEsc(p.role || '')}${p.due ? ', was due' : p.said === 'no' ? ', said not attending' : ''}${p.status ? ', ' + _daiEsc(p.status) : ''}${p.notOnTracker ? ', not on tracker' : ''}</span></li>`).join('')}</ul></details>` : '0')}</tr>`);

  const gone = staff.filter(s => s.tracker && !s.tracker.onLatest);
  const unmatchedAreas = [...new Set(onTracker.filter(s => !s.areaCode).map(s => s.tracker.faculty).filter(Boolean))];
  return tiles
    + _dsuH3('By area') + _dsuP('Most not yet trained first. Open a number to see who. Trained means on the day registration or the catch-up Check-In.')
    + _daiTable('Training attendance by area', ['Area', 'Staff', 'Due on the day', 'Trained on the day', 'Trained at catch-up', 'Not trained yet'], rows, 860)
    + (unmatchedAreas.length ? _dsuH3('Tracker faculties with no Hub area', true) + _dsuP(`Map these when you next run the import, or add them as new areas: ${unmatchedAreas.map(_daiEsc).join(', ')}.`) : '')
    + (gone.length ? _dsuH3(`No longer on the TLA Tracker (${gone.length})`, true) + _dsuP('These profiles were on an earlier tracker but not the latest one. They are kept; check whether they have left.') + `<p style="font-size:var(--text-sm);">${gone.map(_daiPersonBtn).join(', ')}</p>` : '');
}
