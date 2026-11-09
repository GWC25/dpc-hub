// DPC Hub · js/dai-targets.js · v1.0 · 09/11/26 · personal DA&I targets on the staff profile: progress status, note, evidence
//
// Each person's three October to December targets (from their latest
// "How's it going" response) get a progress status and note that Graeme
// sets, and evidence he links (coaching, learning walks, resources shared
// and so on). Status is keyed by the target's wording, so it survives a
// re-import; a new target starts fresh.
//
// Evidence uses the same store and dialog as Area Action Plans
// (dai-evidence.js), linked with "tgt:<key>" and the person ticked, so it
// also appears in the area's evidence list and the person's Touch History.
//
// Stored in data-dai.json as dai.targetStatus: { "<staffId>|tgt:<key>": { status, note, updated } }
//
// Public: daiTargetKey(text), daiTargetsStaffHTML(staffId, targets),
//         daiStaffEvidenceHTML(staffId), daiStaffCardWire(root, staffId), daiTargetsSummary()

const DAI_TARGET_STATUS = Object.freeze(['Not started', 'In progress', 'Achieved', 'Changed or dropped']);

function daiTargetKey(text) {
  const s = _daiNorm(text);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'tgt:' + h.toString(36);
}
function _dtgStore() { const d = _daiStore(); if (!d.targetStatus) d.targetStatus = {}; return d.targetStatus; }
function _dtgGet(staffId, key) { return _dtgStore()[`${staffId}|${key}`] || {}; }
function _dtgSet(staffId, key, patch) {
  const st = _dtgStore(), k = `${staffId}|${key}`;
  st[k] = { ...(st[k] || {}), ...patch, updated: nowISO() };
  if (typeof saveDAIData === 'function') saveDAIData();
}

function _dtgCurrentTargets(staffId) {
  const r = _daiLatest('reflection').find(x => x.staffId === staffId);
  return r ? _daiTargets(r) : [];
}
function _dtgEvidenceTargets(staffId) {
  return _dtgCurrentTargets(staffId).map((t, i) => ({ key: daiTargetKey(t.text), label: `Target ${i + 1}: ${t.text.slice(0, 70)}` }));
}
function _dtgStaff(staffId) { return _daiStaffList().find(s => s.staffId === staffId); }

function daiTargetsStaffHTML(staffId, targets) {
  if (!targets.length) return '';
  const rows = targets.map((t, i) => {
    const key = daiTargetKey(t.text);
    const st = _dtgGet(staffId, key);
    const ev = typeof daiEvidenceFor === 'function' ? _devStore().filter(e => (e.links || []).includes(key) && (e.staffIds || []).includes(staffId)) : [];
    return `<li style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-sm);">
      <p style="font-size:var(--text-sm);"><strong>Target ${i + 1}:</strong> ${_daiEsc(t.text)} <span style="color:var(--color-muted);">(their confidence ${t.confidence == null ? 'not given' : t.confidence + ' of 5'})</span></p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);align-items:center;margin-top:var(--space-xs);">
        <label class="sr-only" for="dtg-s-${i}">Target ${i + 1} progress</label>
        <select id="dtg-s-${i}" class="form-select" data-dtg-status="${key}" style="min-height:36px;font-size:var(--text-sm);max-width:200px;">
          ${DAI_TARGET_STATUS.map(o => `<option${o === (st.status || 'Not started') ? ' selected' : ''}>${o}</option>`).join('')}</select>
        <label class="sr-only" for="dtg-n-${i}">Target ${i + 1} note</label>
        <input id="dtg-n-${i}" type="text" class="form-input" placeholder="Note" value="${_daiEsc(st.note || '')}" data-dtg-note="${key}" style="min-height:36px;font-size:var(--text-sm);flex:1 1 200px;">
        <button type="button" data-dtg-add="${key}" aria-label="Add evidence for target ${i + 1}" style="${_devBtnStyle}">+ Add evidence</button>
        ${ev.length ? `<span style="font-size:var(--text-sm);color:var(--color-slate);">${ev.length} linked</span>` : ''}
      </div>
    </li>`;
  }).join('');
  return `<h4 style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Their targets to December</h4>
    <ol style="list-style:none;margin-top:var(--space-xs);">${rows}</ol>
    <p id="dtg-msg" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-teal);min-height:1.2em;"></p>`;
}

// Every piece of evidence this person is linked to, from their targets or an area plan.
function daiStaffEvidenceHTML(staffId) {
  if (typeof _devStore !== 'function') return '';
  const list = _devStore().filter(e => (e.staffIds || []).includes(staffId)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tgts = new Map(_dtgEvidenceTargets(staffId).map(t => [t.key, t.label.split(':')[0]]));
  const label = (e, k) => k.startsWith('tgt:') ? (tgts.get(k) || 'An earlier target') : `${e.areaCode} plan: ${_devLinkLabel(k, typeof daiPlanLatest === 'function' ? daiPlanLatest(e.areaCode) : null)}`;
  return `<h4 id="dtg-ev-h" style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Evidence with this person (${list.length})</h4>
    ${list.length ? `<ul style="list-style:none;margin-top:var(--space-xs);">${list.map(e => {
      const url = _devSafeUrl(e.link);
      return `<li style="font-size:var(--text-sm);padding:var(--space-xs) 0;border-top:1px solid var(--color-border);">
        <strong>${_daiFmtDate(e.date)}, ${_daiEsc(_devType(e.type).label)}:</strong> ${_daiEsc(e.title)}
        <span style="color:var(--color-muted);">(${(e.links || []).map(k => _daiEsc(label(e, k))).join(', ')})</span>
        ${e.notes ? `<br><span style="white-space:pre-line;">${_daiEsc(e.notes)}</span>` : ''}
        ${url ? `<br><a href="${_daiEsc(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--color-teal);">Open the linked file or page<span class="sr-only"> (opens in a new tab)</span></a>` : ''}
        <span style="display:inline-flex;gap:var(--space-xs);margin-left:var(--space-xs);">
          <button type="button" class="btn btn--ghost btn--sm" data-dtg-edit="${_daiEsc(e.id)}" aria-label="Edit evidence: ${_daiEsc(e.title)}">Edit</button>
          <button type="button" class="btn btn--ghost btn--sm" data-dtg-delete="${_daiEsc(e.id)}" aria-label="Delete evidence: ${_daiEsc(e.title)}">Delete</button>
        </span></li>`;
    }).join('')}</ul>` : '<p style="font-size:var(--text-sm);color:var(--color-muted);">None yet. Use "+ Add evidence" on a target.</p>'}`;
}

function daiStaffCardWire(root, staffId) {
  if (!root) return;
  const msg = t => { const m = document.getElementById('dtg-msg'); if (m) m.textContent = t; };
  root.querySelectorAll('[data-dtg-status]').forEach(sel => sel.addEventListener('change', () => { _dtgSet(staffId, sel.dataset.dtgStatus, { status: sel.value }); msg('Target progress saved.'); }));
  root.querySelectorAll('[data-dtg-note]').forEach(inp => inp.addEventListener('change', () => { _dtgSet(staffId, inp.dataset.dtgNote, { note: inp.value.trim() }); msg('Note saved.'); }));
  const s = _dtgStaff(staffId);
  const area = (s && s.areaCode) || '';
  const rerender = text => {
    if (typeof _renderStaffDetailContent === 'function') _renderStaffDetailContent(staffId);
    const m = document.getElementById('dtg-msg'); if (m) m.textContent = text;
    const h = document.getElementById('dtg-ev-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  };
  const ctx = extra => ({ targets: _dtgEvidenceTargets(staffId), staffIds: [staffId], staffList: s ? [s] : [], ...extra });
  root.querySelectorAll('[data-dtg-add]').forEach(b => b.addEventListener('click', () => _devOpenDialog(area, null, ctx({ linkKey: b.dataset.dtgAdd }), rerender)));
  root.querySelectorAll('[data-dtg-edit]').forEach(b => b.addEventListener('click', () => {
    const e = _devStore().find(x => x.id === b.dataset.dtgEdit);
    if (!e) return;
    // Evidence from an area plan is edited with that plan's links; target evidence with this person's targets.
    const fromPlan = (e.links || []).some(k => !k.startsWith('tgt:'));
    const opts = fromPlan ? { id: e.id } : ctx({ id: e.id });
    _devOpenDialog(e.areaCode || area, fromPlan && typeof daiPlanLatest === 'function' ? daiPlanLatest(e.areaCode) : null, opts, rerender);
  }));
  root.querySelectorAll('[data-dtg-delete]').forEach(b => b.addEventListener('click', () => {
    const list = _devStore();
    const i = list.findIndex(x => x.id === b.dataset.dtgDelete);
    if (i < 0) return;
    if (!window.confirm(`Delete this evidence: "${list[i].title}"? It is removed everywhere it is linked and cannot be undone.`)) return;
    const [gone] = list.splice(i, 1);
    _devSyncTouches({ ...gone, staffIds: [] }, gone.staffIds || []);
    if (typeof saveDAIData === 'function') saveDAIData();
    rerender('Evidence deleted.');
  }));
}

// College-wide target progress, for the DA&I overview.
function daiTargetsSummary() {
  let total = 0, achieved = 0, inProgress = 0, withEvidence = 0;
  const ev = typeof _devStore === 'function' ? _devStore() : [];
  _daiLatest('reflection').forEach(r => _daiTargets(r).forEach(t => {
    total++;
    const key = daiTargetKey(t.text);
    const st = _dtgGet(r.staffId, key).status;
    if (st === 'Achieved') achieved++;
    if (st === 'In progress') inProgress++;
    if (ev.some(e => (e.links || []).includes(key) && (e.staffIds || []).includes(r.staffId))) withEvidence++;
  }));
  return { total, achieved, inProgress, withEvidence };
}
