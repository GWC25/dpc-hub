// DPC Hub · js/staff.js · v1.0 · July 2026
// Staff Profile module. Dynamic creation via DevObs/LW/referral.
// Touch history, development priorities (3), ETF stage, reflection timeline.
// Reads from window.DPC_DATA.staff via data.js globals.

let _staffCurrentId = null;
let _staffTab = 'history';

function initStaff() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Staff</h1>
      <div style="display:flex;gap:var(--space-sm);align-items:center;">
        <input id="staff-search" class="form-input" type="search" placeholder="Search by name or area…" style="width:220px;min-height:40px;font-size:var(--text-sm);" aria-label="Search staff">
        <button id="staff-new-btn" type="button" class="btn btn--primary btn--sm">+ New profile</button>
      </div>
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:300px 1fr;gap:var(--space-xl);align-items:start;">
      <!-- Staff list -->
      <div>
        <div id="staff-list" role="list" aria-label="Staff profiles"></div>
        <p id="staff-empty" style="font-size:var(--text-sm);color:var(--color-muted);padding:var(--space-lg) 0;">
          No staff profiles yet. Profiles are created automatically when you log a DevObs or Learning Walk, or you can create one manually.
        </p>
      </div>
      <!-- Profile detail -->
      <div id="staff-detail" style="display:none;"></div>
    </div>

    <!-- New/Edit profile modal -->
    <div id="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="staff-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">New staff profile</h2>
          <button id="staff-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-name">Full name</label>
          <input class="form-input" type="text" id="staff-name" required aria-required="true">
        </div>
        <div class="form-group">
          <label class="form-label" for="staff-area">Primary area</label>
          <select class="form-select" id="staff-area" required aria-required="true">
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="staff-role">Role</label>
          <input class="form-input" type="text" id="staff-role" placeholder="e.g. Lecturer, TLAM, HoA">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="staff-entry">How did they enter the system?</label>
          <select class="form-select" id="staff-entry">
            <option value="referral">Referral (TLAM/HoA)</option>
            <option value="self-referral">Self-referral</option>
            <option value="devobs">DevObs</option>
            <option value="learning-walk">Learning Walk</option>
            <option value="health-check">Health Check visit</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="staff-etf">ETF DTPF stage (your assessment)</label>
          <select class="form-select" id="staff-etf">
            <option value="">— Not assessed —</option>
            <option value="1">Stage 1 — Explore</option>
            <option value="2">Stage 2 — Adopt</option>
            <option value="3">Stage 3 — Adapt</option>
            <option value="4">Stage 4 — Create</option>
            <option value="5">Stage 5 — Innovate</option>
          </select>
        </div>
        <input type="hidden" id="staff-modal-id">
        <p id="staff-modal-error" role="alert" style="color:var(--color-red);font-size:var(--text-sm);display:none;margin-bottom:var(--space-md);"></p>
        <div class="btn-row">
          <button id="staff-modal-save" type="button" class="btn btn--primary">Save profile</button>
          <button id="staff-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _staffPopulateAreaDropdown('staff-area');
  _renderStaffList();
  _wireStaffEvents();
}

// ── Staff list ────────────────────────────────────────────────
function _renderStaffList() {
  const list  = document.getElementById('staff-list');
  const empty = document.getElementById('staff-empty');
  if (!list) return;

  const search = (document.getElementById('staff-search')?.value || '').toLowerCase().trim();
  let staff = _getAllStaff();
  if (search) staff = staff.filter(s =>
    (s.name||'').toLowerCase().includes(search) ||
    (s.areaCode||'').toLowerCase().includes(search) ||
    (s.role||'').toLowerCase().includes(search)
  );
  staff.sort((a,b) => (a.name||'').localeCompare(b.name||''));

  list.innerHTML = '';
  if (staff.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  staff.forEach(s => {
    const openAFIs = _getStaffOpenAFICount(s.staffId);
    const isActive = _staffCurrentId === s.staffId;
    const item = document.createElement('div');
    item.role = 'listitem';
    item.dataset.staffId = s.staffId;
    item.setAttribute('tabindex','0');
    item.style.cssText = `
      display:flex;align-items:center;gap:var(--space-md);
      padding:var(--space-md);border-radius:var(--radius-md);
      border:2px solid ${isActive?'var(--color-teal)':'var(--color-border)'};
      background:${isActive?'var(--color-teal-lt)':'var(--color-white)'};
      cursor:pointer;margin-bottom:var(--space-sm);transition:all 150ms;
    `;
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:var(--color-teal-lt);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--color-teal);font-size:var(--text-base);flex-shrink:0;">${(s.name||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_sEsc(s.name)}</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);">${_sEsc(s.areaCode||'')} ${s.role?'· '+s.role:''}</p>
      </div>
      ${openAFIs>0?`<span style="font-size:10px;font-weight:bold;background:var(--color-amber-lt);color:var(--color-amber);padding:1px 8px;border-radius:999px;flex-shrink:0;">${openAFIs}</span>`:''}
    `;
    item.addEventListener('click', () => _openStaffDetail(s.staffId));
    item.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();_openStaffDetail(s.staffId);} });
    list.appendChild(item);
  });
}

// ── Staff detail ──────────────────────────────────────────────
function _openStaffDetail(staffId) {
  _staffCurrentId = staffId;
  _renderStaffList();
  const detail = document.getElementById('staff-detail');
  if (!detail) return;
  detail.style.display = 'block';
  _renderStaffDetailContent(staffId);
}

function _renderStaffDetailContent(staffId) {
  const s = _getStaff(staffId);
  if (!s) return;
  const detail = document.getElementById('staff-detail');

  const etfLabels = {'1':'Stage 1 — Explore','2':'Stage 2 — Adopt','3':'Stage 3 — Adapt','4':'Stage 4 — Create','5':'Stage 5 — Innovate'};
  const openAFIs  = _getStaffAFIs(staffId).filter(a => a.status !== 'closed');

  detail.innerHTML = `
    <!-- Profile header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div style="display:flex;align-items:center;gap:var(--space-md);">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--color-teal-lt);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--color-teal);font-size:var(--text-xl);flex-shrink:0;">${(s.name||'?')[0].toUpperCase()}</div>
        <div>
          <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_sEsc(s.name)}</h2>
          <p style="font-size:var(--text-sm);color:var(--color-muted);">${_sEsc(s.areaCode||'')} ${s.role?'· '+_sEsc(s.role):''} ${s.etfStage?'· '+etfLabels[s.etfStage]:''}</p>
        </div>
      </div>
      <button id="staff-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit profile</button>
    </div>

    <!-- Development priorities -->
    <div style="background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <h3 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Three development priorities</h3>
      ${[0,1,2].map(i => `
        <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-sm);">
          <span style="width:24px;height:24px;border-radius:50%;background:var(--color-teal);color:var(--color-white);display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);font-weight:bold;flex-shrink:0;">${i+1}</span>
          <input type="text" id="staff-priority-${i}" value="${_sEsc(s.developmentPriorities&&s.developmentPriorities[i]?s.developmentPriorities[i]:'')}"
            placeholder="Priority ${i+1}…"
            style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
        </div>`).join('')}
      <button id="staff-save-priorities" type="button" class="btn btn--primary btn--sm" style="margin-top:var(--space-sm);">Save priorities</button>
    </div>

    <!-- Open AFIs summary -->
    ${openAFIs.length > 0 ? `
    <div style="background:var(--color-amber-lt);border:1px solid var(--color-amber);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);">
      <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-amber);margin-bottom:var(--space-sm);">${openAFIs.length} open loop${openAFIs.length!==1?'s':''}</p>
      ${openAFIs.map(a=>`<p style="font-size:var(--text-xs);color:var(--color-slate);">• ${_sEsc(a.lraThemeLabel||a.lraThemeId)} — ${_sEsc(a.severity)}</p>`).join('')}
    </div>` : ''}

    <!-- Tabs -->
    <div role="tablist" style="display:flex;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-lg);">
      ${['history','reflections','afis','notes'].map(tab=>`
        <button role="tab" type="button" data-staff-tab="${tab}" id="staff-tab-${tab}"
          aria-selected="${tab===_staffTab?'true':'false'}"
          style="padding:10px 16px;border:none;border-bottom:3px solid ${tab===_staffTab?'var(--color-teal)':'transparent'};
          background:none;cursor:pointer;font:${tab===_staffTab?'bold':''} var(--text-sm) Arial,sans-serif;
          color:${tab===_staffTab?'var(--color-teal)':'var(--color-muted)'};min-height:44px;">
          ${{history:'Touch History',reflections:'Reflections',afis:'Loops',notes:'Notes'}[tab]}
        </button>`).join('')}
    </div>
    <div id="staff-tab-panel"></div>
  `;

  _renderStaffTab(_staffTab, staffId);
  _wireStaffDetailEvents(staffId);
}

function _renderStaffTab(tab, staffId) {
  const panel = document.getElementById('staff-tab-panel');
  const s = _getStaff(staffId);
  if (!panel || !s) return;
  _staffTab = tab;

  if (tab === 'history') {
    const touches = (s.touchHistory||[]).slice().reverse();
    panel.innerHTML = touches.length === 0
      ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No touch history yet.</p>'
      : touches.map(t=>`
        <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
          <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:70px;flex-shrink:0;padding-top:2px;">${_sFmtDate(t.date)}</span>
          <div style="flex:1;">
            <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;">${_sEsc(t.touchType||'')}</span>
            <span style="font-size:var(--text-sm);color:var(--color-slate);margin-left:var(--space-sm);">${_sEsc(t.summary||'')}</span>
          </div>
        </div>`).join('');
  }

  if (tab === 'reflections') {
    const refs = (s.reflectionRefs||[]);
    const allRef = (window.DPC_DATA.reflections&&window.DPC_DATA.reflections.reflections)||[];
    const staffRef = allRef.filter(r=>refs.includes(r.reflectionId)||r.staffId===staffId);
    panel.innerHTML = staffRef.length === 0
      ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No reflections recorded yet.</p>'
      : staffRef.map(r=>`
        <div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
          <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm);">
            <span style="font-size:var(--text-xs);font-weight:bold;background:${r.stage==='immediate'?'var(--color-blue-lt)':'var(--color-purple-lt)'};color:${r.stage==='immediate'?'var(--color-blue)':'var(--color-purple)'};padding:1px 8px;border-radius:999px;">${r.stage}</span>
            <span style="font-size:var(--text-xs);color:var(--color-muted);">${_sFmtDate(r.submittedAt)}</span>
            ${r.practiceChangeReported?'<span style="font-size:10px;background:var(--color-green-lt);color:var(--color-green);padding:1px 8px;border-radius:999px;font-weight:bold;">Practice change reported</span>':''}
          </div>
          <p style="font-size:var(--text-sm);color:var(--color-slate);">${_sEsc(r.responseText||'')}</p>
          ${r.practiceChangeDescription?`<p style="font-size:var(--text-xs);color:var(--color-green);margin-top:4px;font-style:italic;">${_sEsc(r.practiceChangeDescription)}</p>`:''}
        </div>`).join('');
  }

  if (tab === 'afis') {
    const afis = _getStaffAFIs(staffId);
    panel.innerHTML = afis.length === 0
      ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No loops linked to this staff member.</p>'
      : afis.map(a=>`
        <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);">
          <span style="font-size:var(--text-xs);font-weight:bold;padding:2px 10px;border-radius:999px;background:${a.status==='closed'?'var(--color-green-lt)':'var(--color-amber-lt)'};color:${a.status==='closed'?'var(--color-green)':'var(--color-amber)'};flex-shrink:0;">${a.status}</span>
          <div>
            <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_sEsc(a.lraThemeLabel||a.lraThemeId)}</p>
            <p style="font-size:var(--text-xs);color:var(--color-muted);">${_sEsc(a.severity)}</p>
          </div>
        </div>`).join('');
  }

  if (tab === 'notes') {
    panel.innerHTML = `
      <label class="form-label" for="staff-notes-field" style="margin-bottom:var(--space-sm);">DPC notes (not shared)</label>
      <textarea id="staff-notes-field" class="form-textarea" rows="6" style="margin-bottom:var(--space-md);">${_sEsc(s.notes||'')}</textarea>
      <button id="staff-save-notes" type="button" class="btn btn--primary btn--sm">Save notes</button>
    `;
    document.getElementById('staff-save-notes')?.addEventListener('click', () => {
      const staff = _getStaff(staffId);
      if (!staff) return;
      staff.notes = document.getElementById('staff-notes-field').value.trim();
      staff.lastUpdated = nowISO();
      saveStaff(staff);
      if (typeof UI!=='undefined') UI.showToast('success','Notes saved.');
    });
  }
}

function _wireStaffDetailEvents(staffId) {
  // Tab switching
  document.querySelectorAll('[data-staff-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.staffTab;
      _staffTab = tab;
      document.querySelectorAll('[data-staff-tab]').forEach(b=>{
        const active = b.dataset.staffTab===tab;
        b.setAttribute('aria-selected',active?'true':'false');
        b.style.borderBottomColor = active?'var(--color-teal)':'transparent';
        b.style.color = active?'var(--color-teal)':'var(--color-muted)';
        b.style.fontWeight = active?'bold':'normal';
      });
      _renderStaffTab(tab, staffId);
    });
  });

  // Edit button
  document.getElementById('staff-edit-btn')?.addEventListener('click', () => _openStaffModal(staffId));

  // Save priorities
  document.getElementById('staff-save-priorities')?.addEventListener('click', () => {
    const staff = _getStaff(staffId);
    if (!staff) return;
    staff.developmentPriorities = [0,1,2].map(i=>document.getElementById(`staff-priority-${i}`)?.value.trim()||'');
    staff.lastUpdated = nowISO();
    saveStaff(staff);
    if (typeof UI!=='undefined') UI.showToast('success','Development priorities saved.');
  });
}

// ── Staff modal (create/edit) ─────────────────────────────────
function _openStaffModal(staffId=null) {
  const modal   = document.getElementById('staff-modal');
  const titleEl = document.getElementById('staff-modal-title');
  const idEl    = document.getElementById('staff-modal-id');
  if (!modal) return;

  const s = staffId ? _getStaff(staffId) : null;
  titleEl.textContent = s ? 'Edit profile' : 'New staff profile';
  document.getElementById('staff-name').value  = s ? s.name : '';
  document.getElementById('staff-area').value  = s ? (s.areaCode||'') : '';
  document.getElementById('staff-role').value  = s ? (s.role||'') : '';
  document.getElementById('staff-entry').value = s ? (s.entryPathway||'referral') : 'referral';
  document.getElementById('staff-etf').value   = s ? (s.etfStage||'') : '';
  idEl.value = staffId || '';
  document.getElementById('staff-modal-error').style.display = 'none';
  modal.style.display = 'flex';
  document.getElementById('staff-name').focus();
}

function _saveStaffModal() {
  const name     = document.getElementById('staff-name').value.trim();
  const areaCode = document.getElementById('staff-area').value;
  const errEl    = document.getElementById('staff-modal-error');

  if (!name)     { errEl.textContent='Please enter a name.'; errEl.style.display='block'; return; }
  if (!areaCode) { errEl.textContent='Please select an area.'; errEl.style.display='block'; return; }

  const existingId = document.getElementById('staff-modal-id').value;
  const existing   = existingId ? _getStaff(existingId) : null;

  const profile = {
    staffId:              existingId || generateId(),
    name,
    areaCode,
    additionalAreas:      existing?.additionalAreas || [],
    role:                 document.getElementById('staff-role').value.trim(),
    entryPathway:         document.getElementById('staff-entry').value,
    entryDate:            existing?.entryDate || todayISO(),
    etfStage:             document.getElementById('staff-etf').value || null,
    developmentPriorities:existing?.developmentPriorities || ['','',''],
    confidenceRating:     existing?.confidenceRating || null,
    touchHistory:         existing?.touchHistory || [],
    reflectionRefs:       existing?.reflectionRefs || [],
    afiRefs:              existing?.afiRefs || [],
    isAnonymousAtAreaLevel:true,
    notes:                existing?.notes || '',
    createdAt:            existing?.createdAt || nowISO(),
    lastUpdated:          nowISO(),
  };

  saveStaff(profile);

  // Link to area staffRefs
  const area = _getArea(areaCode);
  if (area) {
    if (!area.staffRefs) area.staffRefs = [];
    if (!area.staffRefs.includes(profile.staffId)) {
      area.staffRefs.push(profile.staffId);
      saveArea(area);
    }
  }

  document.getElementById('staff-modal').style.display = 'none';
  _renderStaffList();
  _openStaffDetail(profile.staffId);
  if (typeof UI!=='undefined') UI.showToast('success', `Profile ${existingId?'updated':'created'}: ${name}`);
}

function _wireStaffEvents() {
  document.getElementById('staff-search')?.addEventListener('input', _renderStaffList);
  document.getElementById('staff-new-btn')?.addEventListener('click', () => _openStaffModal());
  document.getElementById('staff-modal-close')?.addEventListener('click', () => { document.getElementById('staff-modal').style.display='none'; });
  document.getElementById('staff-modal-cancel')?.addEventListener('click', () => { document.getElementById('staff-modal').style.display='none'; });
  document.getElementById('staff-modal-save')?.addEventListener('click', _saveStaffModal);
  document.getElementById('staff-modal')?.addEventListener('click', e => { if(e.target===document.getElementById('staff-modal')) document.getElementById('staff-modal').style.display='none'; });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllStaff() { return (window.DPC_DATA.staff&&window.DPC_DATA.staff.staff)||[]; }
function _getStaff(id) { return _getAllStaff().find(s=>s.staffId===id)||null; }
function _getStaffAFIs(id) { return ((window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[]).filter(a=>a.staffId===id); }
function _getStaffOpenAFICount(id) { return _getStaffAFIs(id).filter(a=>a.status!=='closed').length; }
function _staffPopulateAreaDropdown(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  while(sel.options.length>1) sel.remove(1);
  (_getAreas()||[]).sort((a,b)=>a.areaName.localeCompare(b.areaName)).forEach(area=>{
    const opt=document.createElement('option');
    opt.value=area.areaCode; opt.textContent=`${area.areaCode} — ${area.areaName}`; sel.appendChild(opt);
  });
}
function _sFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _sEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
