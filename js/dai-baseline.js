// DPC Hub · js/dai-baseline.js · v1.0 · 12/11/26 · baseline check: "How's it going" returners with no registration, likely matches, merge in one pass
//
// A returner has no baseline when none of their responses came from a
// register (day registration or catch-up Check-In). Usually the same person
// gave a different email or spelling on the register, so the import made a
// second profile. For each returner the Hub suggests registered people who
// have not returned the survey, scored on email, surname, first name,
// overall name similarity and area. Strong, unique matches are pre-ticked.
//
// Confirming a match moves the register response(s) and their Touch History
// to the returner's profile, and remembers the register's email and name
// (dai.aliases) so future imports link them straight away. The other
// profile is removed only if the DA&I import created it and it holds
// nothing else; otherwise it is kept and only the responses move.
//
// Public: daiBaselineGaps(), daiBaselineSectionHTML(), daiBaselineWire(root), daiAliasFor(email, name)

function _dblStore() { const d = _daiStore(); if (!d.aliases) d.aliases = {}; return d.aliases; }
function daiAliasFor(email, name) {
  const a = _dblStore();
  return (email && a['e:' + email.toLowerCase()]) || (name && a['n:' + _daiNameKey(name)]) || null;
}

function _dblLev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function _dblParts(name) {
  const w = _daiNorm(name).replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  return { first: w[0] || '', last: w[w.length - 1] || '', key: w.join(' ') };
}
function _dblLocal(email) { return String(email || '').toLowerCase().split('@')[0].replace(/[^a-z]/g, ''); }

function _dblScore(ret, cand) {
  let score = 0; const why = [];
  const a = _dblParts(ret.name), b = _dblParts(cand.name);
  const el = _dblLocal(ret.email), cl = _dblLocal(cand.email);
  if (el && cl && (el === cl || _dblLev(el, cl) <= 1)) { score += 5; why.push('email'); }
  if (a.last && a.last === b.last) { score += 3; why.push('surname'); }
  else if (a.last && b.last && a.last.length > 3 && _dblLev(a.last, b.last) <= 1) { score += 2; why.push('surname spelling'); }
  if (a.first && a.first === b.first) { score += 2; why.push('first name'); }
  else if (a.first && b.first && (a.first.startsWith(b.first) || b.first.startsWith(a.first))) { score += 1; why.push('first name shortened'); }
  if (a.key && b.key && a.key !== b.key && _dblLev(a.key, b.key) <= 2) { score += 2; why.push('name spelling'); }
  if (ret.areaCode && ret.areaCode === cand.areaCode) { score += 1; why.push('area'); }
  return { score, why };
}

function _dblPeople() {
  const staff = new Map(_daiStaffList().map(s => [s.staffId, s]));
  const by = new Map();
  _daiStore().responses.filter(r => r.staffId).forEach(r => {
    if (!by.has(r.staffId)) by.set(r.staffId, { staffId: r.staffId, reg: false, refl: false, email: '', name: '', areaCode: '' });
    const p = by.get(r.staffId);
    if (r.source === 'registration') p.reg = true; else if (r.source === 'reflection') p.refl = true;
    if (!p.email && r.email) p.email = r.email;
    if (!p.name && r.name) p.name = r.name;
    if (!p.areaCode && r.areaCode) p.areaCode = r.areaCode;
  });
  by.forEach(p => { const s = staff.get(p.staffId); if (s) { p.name = s.name || p.name; p.email = s.email || p.email; p.areaCode = s.areaCode || p.areaCode; } });
  return [...by.values()];
}

function daiBaselineGaps() {
  const people = _dblPeople();
  const pool = people.filter(p => p.reg && !p.refl);
  return people.filter(p => p.refl && !p.reg).map(ret => {
    const cands = pool.map(c => ({ c, ..._dblScore(ret, c) })).filter(x => x.score >= 4).sort((a, b) => b.score - a.score).slice(0, 3);
    const strong = cands.length && cands[0].score >= 5 && (cands.length === 1 || cands[0].score > cands[1].score);
    return { ret, cands, preselect: strong ? cands[0].c.staffId : '' };
  }).sort((a, b) => (b.cands.length > 0) - (a.cands.length > 0) || a.ret.name.localeCompare(b.ret.name));
}

function daiBaselineSectionHTML() {
  if (!_daiStore().responses.length) return '';
  const gaps = daiBaselineGaps();
  if (!gaps.length) return '';
  const withC = gaps.filter(g => g.cands.length);
  const rows = gaps.map((g, i) => `<tr>
    ${_daiTd(`<strong>${_daiEsc(g.ret.name)}</strong><br><span style="color:var(--color-muted);">${_daiEsc(g.ret.email)}${g.ret.areaCode ? ', ' + _daiEsc(g.ret.areaCode) : ''}</span>`)}
    ${_daiTd(g.cands.length ? `<label class="sr-only" for="dbl-${i}">Register match for ${_daiEsc(g.ret.name)}</label>
      <select id="dbl-${i}" class="form-select" data-dbl-ret="${_daiEsc(g.ret.staffId)}" style="min-height:36px;font-size:var(--text-sm);max-width:420px;">
        <option value="">Not a match, leave</option>
        ${g.cands.map(x => `<option value="${_daiEsc(x.c.staffId)}"${x.c.staffId === g.preselect ? ' selected' : ''}>${_daiEsc(x.c.name)} (${_daiEsc(x.c.email || 'no email')}${x.c.areaCode ? ', ' + _daiEsc(x.c.areaCode) : ''}). Matches on ${_daiEsc(x.why.join(', '))}</option>`).join('')}
      </select>` : '<span style="color:var(--color-muted);">No likely match on either register. They may not have registered.</span>')}</tr>`);
  return `<details id="dbl-section" ${withC.length ? 'open' : ''} style="border:2px solid var(--color-amber, #b45309);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);background:var(--color-white);">
    <summary style="cursor:pointer;font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);min-height:24px;">Baseline check: ${gaps.length} "How's it going" ${gaps.length === 1 ? 'return has' : 'returns have'} no registration rating</summary>
    <p style="font-size:var(--text-sm);color:var(--color-slate);margin:var(--space-sm) 0;max-width:75ch;">These people returned the survey but are not linked to the day registration or the catch-up Check-In, so they have no "before" score. ${withC.length} have a likely match on a register, usually a different email or spelling. Strong matches are already chosen; check the rest, then link them all at once. The Hub remembers each link for future imports.</p>
    ${_daiTable('Survey returns with no registration rating, and likely register matches', ['Returned the survey', 'Same person on a register?'], rows, 720)}
    ${withC.length ? `<div class="btn-row" style="margin-top:var(--space-md);"><button type="button" id="dbl-apply" class="btn btn--primary">Link the chosen matches</button></div>` : ''}
    <p id="dbl-msg" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-teal);min-height:1.2em;margin-top:var(--space-xs);"></p>
  </details>`;
}

function _dblMerge(targetId, fromId) {
  const store = _daiStore();
  const staff = window.DPC_DATA.staff.staff;
  const from = staff.find(s => s.staffId === fromId), target = staff.find(s => s.staffId === targetId);
  if (!from || !target) return false;
  const moved = store.responses.filter(r => r.staffId === fromId);
  moved.forEach(r => {
    r.staffId = targetId;
    if (r.email) _dblStore()['e:' + r.email.toLowerCase()] = targetId;
    if (r.name) _dblStore()['n:' + _daiNameKey(r.name)] = targetId;
  });
  const refs = new Set(moved.map(r => r.key));
  const touches = (from.touchHistory || []).filter(t => refs.has(t.sourceRef));
  from.touchHistory = (from.touchHistory || []).filter(t => !refs.has(t.sourceRef));
  target.touchHistory = (target.touchHistory || []).concat(touches);
  if (!target.areaCode && from.areaCode) target.areaCode = from.areaCode;
  if (!target.role && from.role) target.role = from.role;
  target.lastUpdated = nowISO();
  // Remove the other profile only if the import made it and nothing else uses it.
  const used = (store.evidence || []).some(e => (e.staffIds || []).includes(fromId))
    || store.responses.some(r => r.staffId === fromId)
    || (from.touchHistory || []).length || (from.reflectionRefs || []).length || (from.afiRefs || []).length
    || (from.developmentPriorities || []).some(Boolean);
  if (from.entryPathway === 'dai-forms' && !used) {
    window.DPC_DATA.staff.staff = staff.filter(s => s.staffId !== fromId);
    ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).forEach(a => { if (a.staffRefs) a.staffRefs = a.staffRefs.filter(id => id !== fromId); });
    return 'removed';
  }
  from.notes = ((from.notes || '') + `\nDA&I responses moved to ${target.name} (${todayISO()}).`).trim();
  return 'kept';
}

function daiBaselineWire(root) {
  const btn = root.querySelector('#dbl-apply');
  if (!btn) return;
  btn.addEventListener('click', () => {
    let linked = 0, removed = 0;
    root.querySelectorAll('[data-dbl-ret]').forEach(sel => {
      if (!sel.value) return;
      const res = _dblMerge(sel.dataset.dblRet, sel.value);
      if (res) { linked++; if (res === 'removed') removed++; }
    });
    if (!linked) { root.querySelector('#dbl-msg').textContent = 'No matches chosen.'; return; }
    if (typeof saveStaffBulk === 'function') saveStaffBulk();
    if (typeof saveDAIData === 'function') saveDAIData();
    _daiRenderBody();
    const m = document.getElementById('dai-status');
    if (m) m.textContent = `Linked ${linked} ${linked === 1 ? 'person' : 'people'} to their registration rating${removed ? `; ${removed} duplicate profile${removed === 1 ? '' : 's'} made by the import removed` : ''}.`;
    document.getElementById('dai-panel')?.focus();
  });
}
