// DPC Hub · js/dai-evidence.js · v1.0 · 09/11/26 · evidence log for Area Action Plans: add, edit, delete; link to actions, milestones and staff
//
// Evidence is Graeme's record of work with an area: learning walks,
// coaching, conversations, meetings, training, Teach Meets, resources
// shared, audits. One entry can link to the whole plan, to any of its
// actions or milestones, and to the staff involved. Linked staff get a
// matching entry in their Touch History (sourceRef "evidence:<id>"), kept
// in step when the entry is edited or deleted.
//
// Stored in data-dai.json (OneDrive) as dai.evidence:
//   { id, areaCode, type, date, title, notes, link, links: ['plan' | 'action:<id>' | 'm<n>'],
//     staffIds: [], createdAt, updatedAt }
//
// Public: daiEvidenceFor(areaCode, linkKey?), daiEvidenceCell(areaCode, linkKey, label),
//         daiEvidenceSection(areaCode, plan), daiEvidenceWire(panel, areaCode, plan, rerender),
//         DAI_EVIDENCE_TYPES

const DAI_EVIDENCE_TYPES = Object.freeze([
  { id: 'learning-walk', label: 'Learning walk',           touch: 'learning-walk' },
  { id: 'coaching',      label: 'Instructional coaching',  touch: 'coaching' },
  { id: 'conversation',  label: 'Conversation',            touch: 'conversation' },
  { id: 'meeting',       label: 'Meeting',                 touch: 'meeting' },
  { id: 'training',      label: 'Training or CPD',         touch: 'training' },
  { id: 'teach-meet',    label: 'Teach Meet or drop-in',   touch: 'teach-meet' },
  { id: 'resource',      label: 'Resource shared',         touch: 'resource-assigned' },
  { id: 'audit',         label: 'Audit or resource check', touch: 'work-review' },
  { id: 'health-check',  label: 'Health check',            touch: 'health-check' },
  { id: 'other',         label: 'Other',                   touch: 'evidence' },
]);

function _devStore() {
  const d = _daiStore();
  if (!d.evidence) d.evidence = [];
  return d.evidence;
}
function _devType(id) { return DAI_EVIDENCE_TYPES.find(t => t.id === id) || DAI_EVIDENCE_TYPES[DAI_EVIDENCE_TYPES.length - 1]; }
function _devSafeUrl(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }

function daiEvidenceFor(areaCode, linkKey) {
  return _devStore().filter(e => e.areaCode === areaCode && (!linkKey || (e.links || []).includes(linkKey)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// The things in a plan evidence can link to, with readable labels.
function _devTargets(plan) {
  const out = [{ key: 'plan', label: 'The plan as a whole' }];
  if (!plan) return out;
  DAI_PLAN_ACTIONS.forEach(a => {
    const x = (plan.actions || []).find(y => y.id === a.id) || {};
    if (x.where || x.what || x.how) out.push({ key: 'action:' + a.id, label: `${a.label}${x.what ? `: ${x.what.slice(0, 60)}` : ''}` });
  });
  (plan.milestones || []).filter(m => m.date || m.dateText || m.willBeTrue).forEach(m => {
    out.push({ key: 'm' + m.n, label: `Milestone ${m.n}${m.willBeTrue ? `: ${m.willBeTrue.slice(0, 60)}` : ''}` });
  });
  return out;
}
function _devLinkLabel(key, plan) {
  const t = _devTargets(plan).find(x => x.key === key);
  if (t) return t.label.split(':')[0];
  if (key.startsWith('action:')) { const a = DAI_PLAN_ACTIONS.find(x => 'action:' + x.id === key); return a ? a.label : key; }
  if (/^m\d$/.test(key)) return 'Milestone ' + key.slice(1);
  return key;
}

// Staff connected to an area: their profile area, an additional area, or a DA&I response from it.
function _devAreaStaff(areaCode) {
  const fromDai = new Set(_daiStore().responses.filter(r => r.areaCode === areaCode).map(r => r.staffId));
  return _daiStaffList().filter(s => s.areaCode === areaCode || (s.additionalAreas || []).includes(areaCode) || fromDai.has(s.staffId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Touch History on staff profiles ───────────────────────────
function _devSyncTouches(ev, previousStaffIds) {
  const ref = 'evidence:' + ev.id;
  const type = _devType(ev.type);
  const all = new Set([...(previousStaffIds || []), ...(ev.staffIds || [])]);
  all.forEach(id => {
    const s = _daiStaffList().find(x => x.staffId === id);
    if (!s) return;
    if (!s.touchHistory) s.touchHistory = [];
    s.touchHistory = s.touchHistory.filter(t => t.sourceRef !== ref);
    if ((ev.staffIds || []).includes(id)) {
      s.touchHistory.push({ touchId: generateId(), touchType: type.touch, date: ev.date, areaCode: ev.areaCode,
        summary: `${type.label}: ${ev.title}`, sourceRef: ref, createdAt: nowISO() });
    }
    s.lastUpdated = nowISO();
  });
  if (all.size && typeof saveStaffBulk === 'function') saveStaffBulk();
}

// ── Rendering ─────────────────────────────────────────────────
const _devBtnStyle = 'min-height:32px;padding:2px 10px;border:2px solid var(--color-teal);border-radius:999px;background:var(--color-white);color:var(--color-teal);font:bold var(--text-xs) Arial,sans-serif;cursor:pointer;white-space:nowrap;';

function daiEvidenceCell(areaCode, linkKey, label) {
  const list = daiEvidenceFor(areaCode, linkKey);
  const add = `<button type="button" data-dev-add="${_daiEsc(linkKey)}" aria-label="Add evidence for ${_daiEsc(label)}" style="${_devBtnStyle}">+ Add evidence</button>`;
  if (!list.length) return add;
  return `${add}<details style="margin-top:4px;"><summary style="cursor:pointer;min-height:24px;font-size:var(--text-sm);color:var(--color-teal);font-weight:bold;">${list.length} linked <span class="sr-only">to ${_daiEsc(label)}</span></summary>
    <ul style="list-style:none;margin-top:4px;font-size:var(--text-xs);">${list.map(e => `<li style="padding:2px 0;">${_daiFmtDate(e.date)}: ${_daiEsc(_devType(e.type).label)}, ${_daiEsc(e.title)}</li>`).join('')}</ul></details>`;
}

function daiEvidenceSection(areaCode, plan) {
  const list = daiEvidenceFor(areaCode);
  const staffById = new Map(_daiStaffList().map(s => [s.staffId, s]));
  const items = list.map(e => {
    const type = _devType(e.type);
    const url = _devSafeUrl(e.link);
    const people = (e.staffIds || []).map(id => staffById.get(id)).filter(Boolean);
    return `<li style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm);background:var(--color-white);">
      <p style="font-size:var(--text-xs);font-weight:var(--font-bold);color:var(--color-muted);text-transform:uppercase;letter-spacing:0.03em;">${_daiEsc(type.label)} · ${_daiFmtDate(e.date)}</p>
      <p style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-top:2px;">${_daiEsc(e.title)}</p>
      ${e.notes ? `<p style="font-size:var(--text-sm);white-space:pre-line;margin-top:var(--space-xs);max-width:80ch;">${_daiEsc(e.notes)}</p>` : ''}
      <p style="font-size:var(--text-sm);margin-top:var(--space-xs);"><strong>Linked to:</strong> ${(e.links || []).map(k => _daiEsc(_devLinkLabel(k, plan))).join(', ') || 'The plan as a whole'}</p>
      ${people.length ? `<p style="font-size:var(--text-sm);margin-top:2px;"><strong>Staff:</strong> ${people.map(s => `<button type="button" data-dev-staff="${_daiEsc(s.staffId)}" style="background:none;border:none;padding:0;color:var(--color-teal);text-decoration:underline;cursor:pointer;font:inherit;min-height:24px;">${_daiEsc(s.name)}</button>`).join(', ')}</p>` : ''}
      ${url ? `<p style="font-size:var(--text-sm);margin-top:2px;"><a href="${_daiEsc(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--color-teal);">Open the linked file or page<span class="sr-only"> (opens in a new tab)</span></a></p>` : ''}
      <div class="btn-row" style="margin-top:var(--space-sm);">
        <button type="button" class="btn btn--secondary btn--sm" data-dev-edit="${_daiEsc(e.id)}" aria-label="Edit evidence: ${_daiEsc(e.title)}">Edit</button>
        <button type="button" class="btn btn--ghost btn--sm" data-dev-delete="${_daiEsc(e.id)}" aria-label="Delete evidence: ${_daiEsc(e.title)}">Delete</button>
      </div>
    </li>`;
  }).join('');
  return `<section aria-labelledby="dev-h" style="margin-top:var(--space-xl);">
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-sm);">
      <h4 id="dev-h" style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);">Evidence (${list.length})</h4>
      <button type="button" class="btn btn--primary btn--sm" data-dev-add="plan">+ Add evidence</button>
    </div>
    <p style="font-size:var(--text-sm);color:var(--color-muted);margin:var(--space-xs) 0 var(--space-md);max-width:75ch;">Learning walks, coaching, conversations, meetings, training, resources shared and audits for this area. Each entry can link to actions, milestones and staff, and shows on each linked person's profile.</p>
    ${list.length ? `<ul style="list-style:none;">${items}</ul>` : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No evidence recorded yet.</p>'}
  </section>`;
}

// ── Add and edit dialog ───────────────────────────────────────
let _devReturnFocus = null;
function _devOpenDialog(areaCode, plan, opts, onSaved) {
  _devReturnFocus = document.activeElement;
  const existing = opts.id ? _devStore().find(e => e.id === opts.id) : null;
  const ev = existing || { type: 'learning-walk', date: todayISO(), title: '', notes: '', link: '', links: [opts.linkKey || 'plan'], staffIds: [] };
  const targets = _devTargets(plan);
  const staff = _devAreaStaff(areaCode);
  (ev.staffIds || []).forEach(id => { if (!staff.some(s => s.staffId === id)) { const s = _daiStaffList().find(x => x.staffId === id); if (s) staff.push(s); } });

  document.getElementById('dev-dialog')?.remove();
  const host = document.createElement('div');
  host.id = 'dev-dialog';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', 'dev-title');
  host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:700;display:flex;align-items:center;justify-content:center;padding:var(--space-lg);';
  host.innerHTML = `
    <form novalidate style="background:var(--color-white);color:var(--color-slate);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:680px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-md);">
        <h2 id="dev-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${existing ? 'Edit evidence' : 'Add evidence'}</h2>
        <button type="button" data-dev-close aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;">×</button>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);">${_daiEsc(_daiAreaName(areaCode))}. Use initials for anyone outside the Hub's staff list.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);">
        <div class="form-group"><label class="form-label" for="dev-type">Type</label>
          <select id="dev-type" class="form-select">${DAI_EVIDENCE_TYPES.map(t => `<option value="${t.id}"${t.id === ev.type ? ' selected' : ''}>${t.label}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="dev-date">Date</label>
          <input id="dev-date" type="date" class="form-input" value="${_daiEsc(ev.date)}" required></div>
      </div>
      <div class="form-group"><label class="form-label" for="dev-what">What it was <span aria-hidden="true">(required)</span></label>
        <input id="dev-what" type="text" class="form-input" value="${_daiEsc(ev.title)}" required aria-required="true" aria-describedby="dev-what-err">
        <p id="dev-what-err" role="alert" style="font-size:var(--text-sm);color:var(--color-red);min-height:1.2em;"></p></div>
      <div class="form-group"><label class="form-label form-label--optional" for="dev-notes">What happened and what it shows</label>
        <textarea id="dev-notes" class="form-textarea" rows="4">${_daiEsc(ev.notes)}</textarea></div>
      <div class="form-group"><label class="form-label form-label--optional" for="dev-link">Link to a file or page (SharePoint, OneDrive)</label>
        <input id="dev-link" type="url" class="form-input" value="${_daiEsc(ev.link)}" placeholder="https://" aria-describedby="dev-link-err">
        <p id="dev-link-err" role="alert" style="font-size:var(--text-sm);color:var(--color-red);min-height:1.2em;"></p></div>
      <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 4px;">Evidence for</legend>
        ${targets.map((t, i) => `<div style="display:flex;gap:var(--space-sm);align-items:flex-start;padding:4px 0;">
          <input type="checkbox" id="dev-l-${i}" value="${_daiEsc(t.key)}" data-dev-link ${(ev.links || []).includes(t.key) ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;flex-shrink:0;">
          <label for="dev-l-${i}" style="font-size:var(--text-sm);">${_daiEsc(t.label)}</label></div>`).join('')}
      </fieldset>
      <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);">
        <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 4px;">Staff involved (optional)</legend>
        ${staff.length ? `<label class="sr-only" for="dev-filter">Filter staff by name</label>
          <input id="dev-filter" type="search" class="form-input" placeholder="Filter by name" style="margin-bottom:var(--space-sm);">
          <div style="max-height:220px;overflow-y:auto;">${staff.map(s => `<div data-dev-row="${_daiEsc(s.name.toLowerCase())}" style="display:flex;gap:var(--space-sm);align-items:center;padding:4px 0;">
            <input type="checkbox" id="dev-s-${_daiEsc(s.staffId)}" value="${_daiEsc(s.staffId)}" data-dev-person ${(ev.staffIds || []).includes(s.staffId) ? 'checked' : ''} style="width:20px;height:20px;flex-shrink:0;">
            <label for="dev-s-${_daiEsc(s.staffId)}" style="font-size:var(--text-sm);">${_daiEsc(s.name)}</label></div>`).join('')}</div>`
          : '<p style="font-size:var(--text-sm);color:var(--color-muted);">No staff profiles linked to this area yet.</p>'}
      </fieldset>
      <div class="btn-row" style="margin-top:var(--space-lg);">
        <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : 'Add evidence'}</button>
        <button type="button" class="btn btn--secondary" data-dev-close>Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(host);

  const close = () => { host.remove(); if (_devReturnFocus && document.body.contains(_devReturnFocus)) _devReturnFocus.focus(); };
  host.querySelectorAll('[data-dev-close]').forEach(b => b.addEventListener('click', close));
  host.addEventListener('click', e => { if (e.target === host) close(); });
  host.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...host.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled && !el.closest('[data-dev-row][style*="none"]'));
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  host.querySelector('#dev-filter')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    host.querySelectorAll('[data-dev-row]').forEach(r => { r.style.display = !q || r.dataset.devRow.includes(q) ? 'flex' : 'none'; });
  });
  host.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const title = host.querySelector('#dev-what').value.trim();
    const link = host.querySelector('#dev-link').value.trim();
    host.querySelector('#dev-what-err').textContent = title ? '' : 'Say briefly what it was, for example "Learning walk, Level 2 group".';
    host.querySelector('#dev-link-err').textContent = !link || _devSafeUrl(link) ? '' : 'Links must start with https:// (copy the share link from SharePoint or OneDrive).';
    if (!title) { host.querySelector('#dev-what').focus(); return; }
    if (link && !_devSafeUrl(link)) { host.querySelector('#dev-link').focus(); return; }
    const links = [...host.querySelectorAll('[data-dev-link]:checked')].map(c => c.value);
    const record = {
      type: host.querySelector('#dev-type').value,
      date: host.querySelector('#dev-date').value || todayISO(),
      title, notes: host.querySelector('#dev-notes').value.trim(), link,
      links: links.length ? links : ['plan'],
      staffIds: [...host.querySelectorAll('[data-dev-person]:checked')].map(c => c.value),
      updatedAt: nowISO(),
    };
    let saved;
    if (existing) {
      const before = existing.staffIds || [];
      Object.assign(existing, record);
      saved = existing;
      _devSyncTouches(saved, before);
    } else {
      saved = { id: generateId(), areaCode, createdAt: nowISO(), ...record };
      _devStore().push(saved);
      _devSyncTouches(saved, []);
    }
    if (typeof saveDAIData === 'function') saveDAIData();
    host.remove();
    onSaved(existing ? 'Evidence updated.' : 'Evidence added.');
  });
  host.querySelector('#dev-type').focus();
}

function daiEvidenceWire(panel, areaCode, plan, rerender) {
  const done = msg => {
    rerender();
    const m = document.getElementById('dpl-status-msg'); if (m) m.textContent = msg;
    const h = document.getElementById('dev-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  };
  panel.querySelectorAll('[data-dev-add]').forEach(b => b.addEventListener('click', () => _devOpenDialog(areaCode, plan, { linkKey: b.dataset.devAdd }, done)));
  panel.querySelectorAll('[data-dev-edit]').forEach(b => b.addEventListener('click', () => _devOpenDialog(areaCode, plan, { id: b.dataset.devEdit }, done)));
  panel.querySelectorAll('[data-dev-delete]').forEach(b => b.addEventListener('click', () => {
    const list = _devStore();
    const i = list.findIndex(e => e.id === b.dataset.devDelete);
    if (i < 0) return;
    if (!window.confirm(`Delete this evidence: "${list[i].title}"? This also removes it from the linked staff profiles and cannot be undone.`)) return;
    const [gone] = list.splice(i, 1);
    _devSyncTouches({ ...gone, staffIds: [] }, gone.staffIds || []);
    if (typeof saveDAIData === 'function') saveDAIData();
    done('Evidence deleted.');
  }));
  panel.querySelectorAll('[data-dev-staff]').forEach(b => b.addEventListener('click', () => { if (typeof openStaffProfile === 'function') openStaffProfile(b.dataset.devStaff); }));
}
