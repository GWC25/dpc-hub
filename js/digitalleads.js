// DPC Hub · js/digital-leads.js · v1.0 · July 2026
// Digital Leads module. DL profiles with 1:1 meeting history,
// resources created, progress notes, support delivered, impact evidence.

let _dlCurrentId = null;

function initDigitalLeads() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Digital Leads</h1>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        <button id="dl-import-tracker-btn" type="button" class="btn btn--ghost btn--sm">Import HoA / Digital Lead data (2026)</button>
        <button id="dl-import-confirmed-btn" type="button" class="btn btn--ghost btn--sm">Import confirmed DL Training data (June 2026)</button>
        <button id="dl-new-btn" type="button" class="btn btn--primary btn--sm">+ Add Digital Lead</button>
      </div>
    </div>
    <div id="dl-tracker-import-panel" style="display:none;margin-bottom:var(--space-2xl);"></div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:var(--space-xl);align-items:start;">
      <div>
        <div id="dl-list" role="list" aria-label="Digital Lead profiles"></div>
        <p id="dl-empty" style="font-size:var(--text-sm);color:var(--color-muted);">No Digital Lead profiles yet. Add a Digital Lead to track their 1:1 meetings, progress and impact.</p>
      </div>
      <div id="dl-detail" style="display:none;"></div>
    </div>

    <!-- New/Edit DL modal -->
    <div id="dl-modal" role="dialog" aria-modal="true" aria-labelledby="dl-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:480px;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="dl-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Add Digital Lead</h2>
          <button id="dl-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="dl-name">Name</label>
          <input class="form-input" type="text" id="dl-name" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="dl-area">Area</label>
          <select class="form-select" id="dl-area" required>
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="dl-role">Role</label>
          <input class="form-input" type="text" id="dl-role" placeholder="e.g. Lecturer, Technician">
        </div>
        <input type="hidden" id="dl-modal-id">
        <div class="btn-row">
          <button id="dl-modal-save" type="button" class="btn btn--primary">Save</button>
          <button id="dl-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Meeting modal -->
    <div id="dl-meeting-modal" role="dialog" aria-modal="true" aria-labelledby="dl-meeting-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="dl-meeting-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Log 1:1 meeting</h2>
          <button id="dl-meeting-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="dl-meeting-date">Date</label>
          <input class="form-input" type="date" id="dl-meeting-date" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="dl-meeting-notes">Meeting notes</label>
          <textarea class="form-textarea" id="dl-meeting-notes" rows="4" placeholder="Key discussion points, observations, what was shared…"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="dl-meeting-actions">Actions agreed</label>
          <textarea class="form-textarea" id="dl-meeting-actions" rows="2" placeholder="Actions the DL agreed to take…"></textarea>
        </div>
        <input type="hidden" id="dl-meeting-dl-id">
        <div class="btn-row">
          <button id="dl-meeting-save" type="button" class="btn btn--primary">Save meeting</button>
          <button id="dl-meeting-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _dlPopulateAreaDropdown('dl-area');
  _renderDLList();
  _wireDLEvents();
}

function _renderDLList() {
  const list  = document.getElementById('dl-list');
  const empty = document.getElementById('dl-empty');
  if (!list) return;
  const dls = _getAllDLs();
  if (dls.length===0) { if(empty) empty.style.display='block'; list.innerHTML=''; return; }
  if(empty) empty.style.display='none';
  list.innerHTML='';
  dls.sort((a,b)=>(a.name||'').localeCompare(b.name||'')).forEach(dl=>{
    const isActive=_dlCurrentId===dl.dlId;
    const meetings=(dl.meetingHistory||[]).length;
    const item=document.createElement('div');
    item.role='listitem'; item.dataset.dlId=dl.dlId; item.setAttribute('tabindex','0');
    item.style.cssText=`padding:var(--space-md);border-radius:var(--radius-md);border:2px solid ${isActive?'var(--color-teal)':'var(--color-border)'};background:${isActive?'var(--color-teal-lt)':'var(--color-white)'};cursor:pointer;margin-bottom:var(--space-sm);transition:all 150ms;`;
    item.innerHTML=`
      <div style="display:flex;align-items:center;gap:var(--space-sm);">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--color-teal-lt);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--color-teal);flex-shrink:0;">${(dl.name||'?')[0].toUpperCase()}</div>
        <div>
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_dlEsc(dl.name)}</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);">${_dlEsc(dl.areaCode||'')} ${dl.role?'· '+dl.role:''}</p>
        </div>
        ${meetings>0?`<span style="margin-left:auto;font-size:10px;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;font-weight:bold;">${meetings} mtg${meetings!==1?'s':''}</span>`:''}
      </div>`;
    item.addEventListener('click',()=>_openDLDetail(dl.dlId));
    item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();_openDLDetail(dl.dlId);}});
    list.appendChild(item);
  });
}

function _openDLDetail(dlId) {
  _dlCurrentId=dlId;
  _renderDLList();
  const detail=document.getElementById('dl-detail');
  if(!detail) return;
  detail.style.display='block';
  _renderDLDetailContent(dlId);
}

function _renderDLDetailContent(dlId) {
  const dl=_getDL(dlId);
  if(!dl) return;
  const detail=document.getElementById('dl-detail');
  const meetings=(dl.meetingHistory||[]).slice().reverse();
  const resources=(dl.resourcesCreated||[]).slice().reverse();
  const progress=(dl.progressNotes||[]).slice().reverse();

  detail.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_dlEsc(dl.name)}</h2>
        <p style="font-size:var(--text-sm);color:var(--color-muted);">${_dlEsc(dl.areaCode||'')} ${dl.role?'· '+_dlEsc(dl.role):''}</p>
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button id="dl-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit</button>
        <button id="dl-log-meeting-btn" type="button" class="btn btn--primary btn--sm">+ Log 1:1</button>
      </div>
    </div>

    <!-- Stats strip -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg);">
      <div style="text-align:center;padding:var(--space-md);background:var(--color-teal-lt);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-teal);">${meetings.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">1:1 meetings</div>
      </div>
      <div style="text-align:center;padding:var(--space-md);background:var(--color-blue-lt);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-blue);">${resources.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Resources created</div>
      </div>
      <div style="text-align:center;padding:var(--space-md);background:var(--color-green-lt);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-green);">${(dl.impactEvidence||[]).length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Impact entries</div>
      </div>
    </div>

    <!-- Area impact (Session 43) — real cross-module data for the DL's
         area, not a separate parallel tracking system. Health Checks,
         Loops, Action Plans and Resource shares all already exist; this
         just surfaces what's already true about the area this DL leads. -->
    ${_dlRenderAreaImpact(dl.areaCode)}

    <!-- Meetings -->
    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">1:1 meeting history</h3>
    ${meetings.length===0
      ? '<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-lg);">No meetings logged yet.</p>'
      : meetings.map(m=>`
        <div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-xs);">${_dlFmtDate(m.date)}</p>
          ${m.notes?`<p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-xs);">${_dlEsc(m.notes)}</p>`:''}
          ${m.actionsAgreed?`<p style="font-size:var(--text-xs);color:var(--color-teal);font-style:italic;">Actions: ${_dlEsc(m.actionsAgreed)}</p>`:''}
        </div>`).join('')}

    <!-- Add resource -->
    <div style="margin-top:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Resources created</h3>
        <button id="dl-add-resource-btn" type="button" class="btn btn--ghost btn--sm">+ Add resource</button>
      </div>
      <div id="dl-add-resource-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <input type="text" id="dl-res-title" class="form-input" placeholder="Resource title">
          <input type="text" id="dl-res-url" class="form-input" placeholder="URL or description">
        </div>
        <div class="btn-row" style="margin-top:var(--space-sm);">
          <button id="dl-res-save" type="button" class="btn btn--primary btn--sm">Save</button>
          <button id="dl-res-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
        </div>
      </div>
      ${resources.length===0
        ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">No resources recorded yet.</p>'
        : resources.map(r=>`
          <div style="display:flex;gap:var(--space-md);padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border);">
            <div style="flex:1;">
              <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_dlEsc(r.title||'')}</p>
              ${r.url?`<a href="${_dlEsc(r.url)}" target="_blank" rel="noopener" style="font-size:var(--text-xs);color:var(--color-teal);">${_dlEsc(r.url)}</a>`:''}
            </div>
            <span style="font-size:var(--text-xs);color:var(--color-muted);flex-shrink:0;">${_dlFmtDate(r.date)}</span>
          </div>`).join('')}
    </div>

    <!-- Progress notes -->
    <div style="margin-top:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Progress notes</h3>
        <button id="dl-add-progress-btn" type="button" class="btn btn--ghost btn--sm">+ Add note</button>
      </div>
      <div id="dl-progress-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <textarea id="dl-progress-note" class="form-textarea" rows="2" placeholder="Progress observation…"></textarea>
        <div class="btn-row" style="margin-top:var(--space-sm);">
          <button id="dl-progress-save" type="button" class="btn btn--primary btn--sm">Save</button>
          <button id="dl-progress-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
        </div>
      </div>
      ${progress.length===0
        ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">No progress notes yet.</p>'
        : progress.map(p=>`
          <div style="padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border);">
            <p style="font-size:var(--text-xs);color:var(--color-muted);">${_dlFmtDate(p.date)}</p>
            <p style="font-size:var(--text-sm);color:var(--color-slate);">${_dlEsc(p.note)}</p>
          </div>`).join('')}
    </div>
  `;

  document.getElementById('dl-edit-btn')?.addEventListener('click',()=>_openDLModal(dlId));
  document.getElementById('dl-log-meeting-btn')?.addEventListener('click',()=>{
    document.getElementById('dl-meeting-dl-id').value=dlId;
    document.getElementById('dl-meeting-date').value=todayISO();
    document.getElementById('dl-meeting-notes').value='';
    document.getElementById('dl-meeting-actions').value='';
    document.getElementById('dl-meeting-modal').style.display='flex';
  });
  document.getElementById('dl-add-resource-btn')?.addEventListener('click',()=>{
    document.getElementById('dl-add-resource-form').style.display='block';
  });
  document.getElementById('dl-res-cancel')?.addEventListener('click',()=>{
    document.getElementById('dl-add-resource-form').style.display='none';
  });
  document.getElementById('dl-res-save')?.addEventListener('click',()=>{
    const title=document.getElementById('dl-res-title')?.value.trim();
    if(!title) return;
    const dl=_getDL(dlId);
    if(!dl) return;
    if(!dl.resourcesCreated) dl.resourcesCreated=[];
    dl.resourcesCreated.push({title,url:document.getElementById('dl-res-url')?.value.trim()||'',date:todayISO()});
    _saveDL(dl);
    _renderDLDetailContent(dlId);
  });
  document.getElementById('dl-add-progress-btn')?.addEventListener('click',()=>{
    document.getElementById('dl-progress-form').style.display='block';
  });
  document.getElementById('dl-progress-cancel')?.addEventListener('click',()=>{
    document.getElementById('dl-progress-form').style.display='none';
  });
  document.getElementById('dl-progress-save')?.addEventListener('click',()=>{
    const note=document.getElementById('dl-progress-note')?.value.trim();
    if(!note) return;
    const dl=_getDL(dlId);
    if(!dl) return;
    if(!dl.progressNotes) dl.progressNotes=[];
    dl.progressNotes.push({date:todayISO(),note});
    _saveDL(dl);
    _renderDLDetailContent(dlId);
  });
}

function _openDLModal(dlId=null) {
  const modal=document.getElementById('dl-modal');
  const titleEl=document.getElementById('dl-modal-title');
  if(!modal) return;
  const dl=dlId?_getDL(dlId):null;
  titleEl.textContent=dl?'Edit Digital Lead':'Add Digital Lead';
  document.getElementById('dl-name').value=dl?.name||'';
  document.getElementById('dl-area').value=dl?.areaCode||'';
  document.getElementById('dl-role').value=dl?.role||'';
  document.getElementById('dl-modal-id').value=dlId||'';
  modal.style.display='flex';
  document.getElementById('dl-name').focus();
}

function _saveDLModal() {
  const name=document.getElementById('dl-name').value.trim();
  const areaCode=document.getElementById('dl-area').value;
  if(!name||!areaCode) return;
  const existId=document.getElementById('dl-modal-id').value;
  const existing=existId?_getDL(existId):null;
  const dl={
    dlId:existId||generateId(),
    name,areaCode,role:document.getElementById('dl-role').value.trim(),
    meetingHistory:existing?.meetingHistory||[],
    resourcesCreated:existing?.resourcesCreated||[],
    progressNotes:existing?.progressNotes||[],
    supportDelivered:existing?.supportDelivered||[],
    impactEvidence:existing?.impactEvidence||[],
  };
  // Link staff profile
  const allStaff=(window.DPC_DATA.staff&&window.DPC_DATA.staff.staff)||[];
  const staffMatch=allStaff.find(s=>s.name.toLowerCase()===name.toLowerCase()&&s.areaCode===areaCode);
  if(staffMatch) dl.staffId=staffMatch.staffId;
  _saveDL(dl);
  // Update area record
  const area=_getArea(areaCode);
  if(area){area.digitalLeadId=dl.dlId;saveArea(area);}
  document.getElementById('dl-modal').style.display='none';
  _renderDLList();
  _openDLDetail(dl.dlId);
  if(typeof UI!=='undefined') UI.showToast('success',`Digital Lead ${existId?'updated':'added'}: ${name}`);
}

function _saveMeeting() {
  const dlId=document.getElementById('dl-meeting-dl-id').value;
  const date=document.getElementById('dl-meeting-date').value;
  const notes=document.getElementById('dl-meeting-notes').value.trim();
  if(!dlId||!date) return;
  const dl=_getDL(dlId);
  if(!dl) return;
  if(!dl.meetingHistory) dl.meetingHistory=[];
  dl.meetingHistory.push({meetingId:generateId(),date,notes,actionsAgreed:document.getElementById('dl-meeting-actions').value.trim(),linkedAFIIds:[]});
  _saveDL(dl);
  document.getElementById('dl-meeting-modal').style.display='none';
  _renderDLDetailContent(dlId);
  if(typeof UI!=='undefined') UI.showToast('success','1:1 meeting logged.');
}

function _saveDL(dl) {
  saveDigitalLead(dl);
}

function _wireDLEvents() {
  document.getElementById('dl-new-btn')?.addEventListener('click',()=>_openDLModal());
  document.getElementById('dl-import-tracker-btn')?.addEventListener('click', _dlOpenTrackerImport);
  document.getElementById('dl-import-confirmed-btn')?.addEventListener('click', _dlOpenConfirmedImport);
  document.getElementById('dl-modal-close')?.addEventListener('click',()=>document.getElementById('dl-modal').style.display='none');
  document.getElementById('dl-modal-cancel')?.addEventListener('click',()=>document.getElementById('dl-modal').style.display='none');
  document.getElementById('dl-modal-save')?.addEventListener('click',_saveDLModal);
  document.getElementById('dl-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('dl-modal'))document.getElementById('dl-modal').style.display='none';});
  document.getElementById('dl-meeting-close')?.addEventListener('click',()=>document.getElementById('dl-meeting-modal').style.display='none');
  document.getElementById('dl-meeting-cancel')?.addEventListener('click',()=>document.getElementById('dl-meeting-modal').style.display='none');
  document.getElementById('dl-meeting-save')?.addEventListener('click',_saveMeeting);
  document.getElementById('dl-meeting-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('dl-meeting-modal'))document.getElementById('dl-meeting-modal').style.display='none';});
}

function _dlPopulateAreaDropdown(selId) {
  const sel=document.getElementById(selId);
  if(!sel) return;
  while(sel.options.length>1) sel.remove(1);
  (_getAreas()||[]).sort((a,b)=>a.areaName.localeCompare(b.areaName)).forEach(area=>{
    const opt=document.createElement('option');
    opt.value=area.areaCode; opt.textContent=`${area.areaCode} — ${area.areaName}`; sel.appendChild(opt);
  });
}

function _getAllDLs(){return(window.DPC_DATA.digitalLeads&&window.DPC_DATA.digitalLeads.digitalLeads)||[];}
function _getDL(id){return _getAllDLs().find(d=>d.dlId===id)||null;}

// ── Area impact (Session 43) ─────────────────────────────────────
// "Link into the Digital Health Checks, Action plans, Loops they are
// involved in, Impact they have overseen" — reads from the same real
// data every other part of the Hub already reads (data-health-checks,
// data-afi via areaCode, data-action-plans, data-resource-library), not
// a second parallel tracking system for Digital Leads specifically.
function _dlRenderAreaImpact(areaCode) {
  if (!areaCode) return '';

  const reviews = typeof _hcGetReviewsForArea === 'function' ? _hcGetReviewsForArea(areaCode) : [];
  const byStaff = {};
  reviews.forEach(r => { if (!byStaff[r.staffId] || (r.date||'') > (byStaff[r.staffId].date||'')) byStaff[r.staffId] = r; });
  const latestReviews = Object.values(byStaff);
  const allScores = latestReviews.flatMap(r => Object.values(r.domains||{}).map(d=>d.avgScore).filter(v=>v!=null));
  const avgHC = allScores.length > 0 ? (allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1) : null;

  const areaAFIs = ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => a.areaCode === areaCode);
  const openAFIs = areaAFIs.filter(a => a.status !== 'closed').length;

  const areaPlans = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || []).filter(p => p.areaCode === areaCode);
  const activePlans = areaPlans.filter(p => p.status !== 'complete').length;

  const shares = typeof _libGetSharesForArea === 'function' ? _libGetSharesForArea(areaCode) : [];

  return `
  <div style="margin-bottom:var(--space-lg);">
    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Area impact — ${_dlEsc(areaCode)}</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-sm);">
      <div style="text-align:center;padding:var(--space-sm);background:var(--color-light);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">${avgHC != null ? avgHC : '—'}</div>
        <div style="font-size:10px;color:var(--color-muted);">Avg Health Check (${latestReviews.length} staff)</div>
      </div>
      <div style="text-align:center;padding:var(--space-sm);background:var(--color-light);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-lg);font-weight:bold;color:${openAFIs>0?'var(--color-amber)':'var(--color-green)'};">${openAFIs}</div>
        <div style="font-size:10px;color:var(--color-muted);">Open loops</div>
      </div>
      <div style="text-align:center;padding:var(--space-sm);background:var(--color-light);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">${activePlans}</div>
        <div style="font-size:10px;color:var(--color-muted);">Active action plans</div>
      </div>
      <div style="text-align:center;padding:var(--space-sm);background:var(--color-light);border-radius:var(--radius-md);">
        <div style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">${shares.length}</div>
        <div style="font-size:10px;color:var(--color-muted);">Resources shared</div>
      </div>
    </div>
  </div>`;
}
function _dlFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _dlEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── HoA / Digital Lead tracker import (Session 44) ────────────────
// 34 rows from the real HoA Digital Tracker. 25 match an existing Hub
// area code cleanly — those are reviewable and importable here. The
// other 9 are shown for reference only, not imported, because they
// directly conflict with two consolidation decisions made earlier
// (EFE/EHE folded into AMT; FAU/FCO/FEH/FPL folded into SEL) — the
// tracker shows all six as still separately active with distinct real
// HoAs, which contradicts that merge. Force-importing them would either
// silently overwrite one HoA's name with another's, or invent a merge
// that isn't actually confirmed. AHE and CTC are genuinely new areas not
// yet in the Hub; EXT is explicitly noted in the source data as being
// retired next year. None of the 9 get written anywhere by this screen —
// they're listed so the decision can be made with the real data in view,
// not decided here.
let _dlTrackerData = null;

async function _dlOpenTrackerImport() {
  const panel = document.getElementById('dl-tracker-import-panel');
  if (!panel) return;
  const showing = panel.style.display !== 'none';
  if (showing) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.innerHTML = '<p style="color:var(--color-muted);">Loading tracker data…</p>';

  if (!_dlTrackerData) {
    try {
      const res = await fetch('./planning/hoa-tracker-import/hoa-tracker-2026-parsed.json');
      _dlTrackerData = res.ok ? await res.json() : [];
    } catch { _dlTrackerData = []; }
  }

  const hubAreaCodes = new Set((_getAreas(true) || []).map(a => a.areaCode));
  const clean = _dlTrackerData.filter(r => hubAreaCodes.has(r.code));
  const conflicted = _dlTrackerData.filter(r => !hubAreaCodes.has(r.code));

  panel.innerHTML = `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">Import HoA / Digital Lead data — 2026</h2>
        <button id="dl-import-close" type="button" class="btn btn--ghost btn--sm">Close</button>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);">
        ${clean.length} area(s) match cleanly and can be reviewed below. Nothing saves until you click Import.
      </p>
      <button id="dl-import-selected" type="button" class="btn btn--primary btn--sm" style="margin-bottom:var(--space-lg);">Import selected</button>
      <div id="dl-import-rows"></div>

      ${conflicted.length > 0 ? `
        <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-amber);margin:var(--space-xl) 0 var(--space-sm);">Not imported — needs a decision first (${conflicted.length})</h3>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
          EFE/EHE and FAU/FCO/FEH/FPL directly conflict with earlier merges into AMT and SEL — the tracker shows them
          still separately active with different real HoAs. AHE and CTC are new areas not yet in the Hub. EXT is
          noted as being retired next year. Shown for reference only.
        </p>
        ${conflicted.map(r => `
          <div style="padding:var(--space-sm) var(--space-md);border:1px solid var(--color-amber);background:var(--color-amber-lt);border-radius:var(--radius-sm);margin-bottom:var(--space-xs);font-size:var(--text-xs);">
            <strong>${_dlEsc(r.code)}</strong> — ${_dlEsc(r.department)} · HoA: ${_dlEsc(r.hoaName)} · DL: ${_dlEsc(r.digitalLeadRaw || '—')} · RAG: ${r.rag ?? '—'}
          </div>`).join('')}
      ` : ''}
    </div>
  `;

  const rowsContainer = document.getElementById('dl-import-rows');
  clean.forEach((rec, idx) => rowsContainer.appendChild(_dlRenderTrackerRow(rec, idx)));

  document.getElementById('dl-import-close')?.addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('dl-import-selected')?.addEventListener('click', _dlCommitTrackerImport);
}

// Light cleanup only — strips common trailing confirmation markers so the
// default text is tidier, never attempts to split multiple names apart
// (formats are inconsistent: "&", ",", "/" all appear) — that stays a
// manual edit if wanted, safer than guessing wrong.
function _dlCleanName(raw) {
  return String(raw || '')
    .replace(/\s*-\s*Confirmed\s*$/i, '')
    .replace(/\s*\(Confirmed\)\s*$/i, '')
    .replace(/\s*\?\?\?\s*$/g, '')
    .replace(/\s*\(TBC\)\s*$/i, '')
    .trim();
}

function _dlRenderTrackerRow(rec, idx) {
  const area = _getArea(rec.code);
  const cleanedDL = _dlCleanName(rec.digitalLeadRaw);
  const multiplePeople = /[&,/]/.test(cleanedDL);

  const div = document.createElement('div');
  div.className = 'dl-import-row';
  div.dataset.idx = idx;
  div.style.cssText = 'padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-sm);';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:var(--space-md);">
      <input type="checkbox" class="dl-import-checkbox" checked style="margin-top:6px;">
      <div style="flex:1;">
        <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_dlEsc(rec.code)} — ${_dlEsc(area ? area.areaName : rec.department)}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:var(--space-sm);margin-top:var(--space-sm);">
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">Head of Area</label>
            <input type="text" class="form-input dl-import-hoa" value="${_dlEsc(rec.hoaName)}" style="min-height:36px;font-size:var(--text-xs);">
          </div>
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">Digital Lead ${multiplePeople ? '<span style="color:var(--color-amber);">(multiple people listed — check before importing)</span>' : ''}</label>
            <input type="text" class="form-input dl-import-dl-name" value="${_dlEsc(cleanedDL)}" style="min-height:36px;font-size:var(--text-xs);">
          </div>
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">Historical RAG</label>
            <select class="form-select dl-import-rag" style="min-height:36px;font-size:var(--text-xs);">
              <option value="">—</option>
              ${[1,2,3,4,5].map(n => `<option value="${n}" ${rec.rag===n?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:var(--space-xs);">
          <label style="font-size:var(--text-xs);color:var(--color-slate);">
            <input type="checkbox" class="dl-import-create-dl" ${cleanedDL && !multiplePeople ? 'checked' : ''}> Create a Digital Lead profile for this person
          </label>
        </div>
      </div>
    </div>
  `;
  return div;
}

function _dlCommitTrackerImport() {
  const rows = document.querySelectorAll('.dl-import-row');
  let areasUpdated = 0, dlsCreated = 0, skipped = 0;
  const hubAreaCodes = new Set((_getAreas(true) || []).map(a => a.areaCode));
  const clean = _dlTrackerData.filter(r => hubAreaCodes.has(r.code));

  rows.forEach(row => {
    const checkbox = row.querySelector('.dl-import-checkbox');
    if (!checkbox.checked) return;
    const rec = clean[parseInt(row.dataset.idx)];
    if (!rec) { skipped++; return; }

    const hoaName = row.querySelector('.dl-import-hoa').value.trim();
    const dlName = row.querySelector('.dl-import-dl-name').value.trim();
    const ragValue = row.querySelector('.dl-import-rag').value;
    const createDL = row.querySelector('.dl-import-create-dl').checked;

    const area = _getArea(rec.code);
    if (area) {
      area.hoaName = hoaName;
      saveArea(area);
      areasUpdated++;
      if (ragValue) saveHistoricalRAG(rec.code, parseInt(ragValue));
    }

    if (createDL && dlName) {
      const existingDL = _getAllDLs().find(d => d.name.toLowerCase() === dlName.toLowerCase() && d.areaCode === rec.code);
      if (!existingDL) {
        const newDL = {
          dlId: generateId(), name: dlName, areaCode: rec.code, role: '',
          meetingHistory: [], resourcesCreated: [], progressNotes: [], supportDelivered: [], impactEvidence: [],
        };
        const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
        const staffMatch = allStaff.find(s => s.name.toLowerCase() === dlName.toLowerCase() && s.areaCode === rec.code);
        if (staffMatch) newDL.staffId = staffMatch.staffId;
        saveDigitalLead(newDL);
        if (area) { area.digitalLeadId = newDL.dlId; saveArea(area); }
        dlsCreated++;
      }
    }
  });

  if (typeof UI !== 'undefined') {
    UI.showToast('success', `${areasUpdated} area(s) updated, ${dlsCreated} Digital Lead profile(s) created.${skipped>0?` ${skipped} skipped.`:''}`);
  }
  document.getElementById('dl-tracker-import-panel').style.display = 'none';
  _renderDLList();
}

// ── Confirmed DL Training import (Session 45) ────────────────────
// Second, more authoritative dataset — supersedes the earlier RAG
// Summary tracker for HoA/DL names where they conflict. Two real
// structural decisions embedded in this data, not guessed by this code:
//   - EFE and EHE both list the SAME HoA and SAME Digital Lead here —
//     real evidence the earlier AMT merge was correct. Both rows target
//     areaCode 'AMT' and are deduped into one row below.
//   - FAU/FCO/FEH/FPL list FOUR DIFFERENT HoAs — the opposite signal —
//     so they're NOT folded into SEL. This import creates them as real,
//     separate areas and offers to archive SEL now that it's redundant.
// PRA / PRS / PM are kept as three separate areas (Graeme's own
// steer) despite messy overlapping labels in the source spreadsheet.
let _dlConfirmedData = null;

async function _dlOpenConfirmedImport() {
  const panel = document.getElementById('dl-tracker-import-panel');
  if (!panel) return;
  const showing = panel.style.display !== 'none';
  if (showing) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.innerHTML = '<p style="color:var(--color-muted);">Loading confirmed data…</p>';

  if (!_dlConfirmedData) {
    try {
      const res = await fetch('./planning/dl-confirmed-import/dl-confirmed-2026.json');
      _dlConfirmedData = res.ok ? await res.json() : [];
    } catch { _dlConfirmedData = []; }
  }

  // Dedupe EFE/EHE into one row targeting AMT
  const seen = new Set();
  const rows = [];
  _dlConfirmedData.forEach(r => {
    if (seen.has(r.targetAreaCode)) return;
    seen.add(r.targetAreaCode);
    rows.push(r);
  });

  const selExists = !!_getArea('SEL');

  panel.innerHTML = `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">Import confirmed DL Training data — June 2026</h2>
        <button id="dl-confirmed-close" type="button" class="btn btn--ghost btn--sm">Close</button>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);">
        ${rows.length} area(s). New areas (AHE, CTC, FAU, FCO, FEH, FPL) are clearly marked. EXT is unchecked by
        default — it was noted elsewhere as being retired next year. Nothing saves until you click Import.
      </p>
      ${selExists ? `
        <label style="display:block;font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-lg);padding:var(--space-sm);background:var(--color-amber-lt);border-radius:var(--radius-sm);">
          <input type="checkbox" id="dl-archive-sel" checked> Archive SEL now that FAU/FCO/FEH/FPL exist as separate areas
        </label>` : ''}
      <button id="dl-confirmed-import-btn" type="button" class="btn btn--primary btn--sm" style="margin-bottom:var(--space-lg);">Import selected</button>
      <div id="dl-confirmed-rows"></div>
    </div>
  `;

  const rowsContainer = document.getElementById('dl-confirmed-rows');
  rows.forEach((rec, idx) => rowsContainer.appendChild(_dlRenderConfirmedRow(rec, idx)));

  document.getElementById('dl-confirmed-close')?.addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('dl-confirmed-import-btn')?.addEventListener('click', () => _dlCommitConfirmedImport(rows));
}

function _dlRenderConfirmedRow(rec, idx) {
  const isExt = rec.targetAreaCode === 'EXT';
  const div = document.createElement('div');
  div.className = 'dl-confirmed-row';
  div.dataset.idx = idx;
  div.style.cssText = `padding:var(--space-md);border:1px solid ${rec.isNewArea ? 'var(--color-teal)' : 'var(--color-border)'};border-radius:var(--radius-sm);margin-bottom:var(--space-sm);`;
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:var(--space-md);">
      <input type="checkbox" class="dl-confirmed-checkbox" ${isExt ? '' : 'checked'} style="margin-top:6px;">
      <div style="flex:1;">
        <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">
          ${_dlEsc(rec.targetAreaCode)} — ${_dlEsc(rec.dept)}
          ${rec.isNewArea ? '<span style="font-size:10px;background:var(--color-teal);color:var(--color-white);padding:1px 8px;border-radius:999px;margin-left:6px;">NEW AREA</span>' : ''}
          ${rec.mergeNote ? '<span style="font-size:10px;background:var(--color-blue);color:var(--color-white);padding:1px 8px;border-radius:999px;margin-left:6px;">MERGED</span>' : ''}
          ${isExt ? '<span style="font-size:10px;background:var(--color-amber);color:var(--color-white);padding:1px 8px;border-radius:999px;margin-left:6px;">FLAGGED AS RETIRING</span>' : ''}
        </p>
        ${rec.mergeNote ? `<p style="font-size:10px;color:var(--color-muted);margin-top:2px;">${_dlEsc(rec.mergeNote)}</p>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-sm);margin-top:var(--space-sm);">
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">Head of Area</label>
            <input type="text" class="form-input dl-confirmed-hoa" value="${_dlEsc(rec.hoa)}" style="min-height:36px;font-size:var(--text-xs);">
          </div>
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">Digital Lead</label>
            <input type="text" class="form-input dl-confirmed-dl" value="${_dlEsc(rec.dl)}" style="min-height:36px;font-size:var(--text-xs);">
          </div>
          <div>
            <label style="font-size:10px;color:var(--color-muted);display:block;">DL Training booked</label>
            <input type="text" class="form-input dl-confirmed-training" value="${_dlEsc(rec.training)}" style="min-height:36px;font-size:var(--text-xs);">
          </div>
        </div>
      </div>
    </div>
  `;
  return div;
}

function _dlCommitConfirmedImport(rows) {
  const rowEls = document.querySelectorAll('.dl-confirmed-row');
  let areasCreated = 0, areasUpdated = 0, dlsHandled = 0, skipped = 0;

  rowEls.forEach(rowEl => {
    if (!rowEl.querySelector('.dl-confirmed-checkbox').checked) { skipped++; return; }
    const rec = rows[parseInt(rowEl.dataset.idx)];
    const hoa = rowEl.querySelector('.dl-confirmed-hoa').value.trim();
    const dlName = rowEl.querySelector('.dl-confirmed-dl').value.trim();
    const training = rowEl.querySelector('.dl-confirmed-training').value.trim();
    const code = rec.targetAreaCode;

    let area = _getArea(code);
    if (!area) {
      area = { areaCode: code, areaName: rec.dept, campus: '', hoaName: '', digitalLeadId: null,
        pyramidLevel: 'foundations', ragDimensions: {}, healthChecks: [], activityLog: [],
        afiRefs: [], actionPoints: [], staffRefs: [], notes: '' };
      areasCreated++;
    } else {
      areasUpdated++;
    }
    area.hoaName = hoa;
    saveArea(area);

    if (dlName) {
      let dl = _getAllDLs().find(d => d.areaCode === code);
      if (dl) {
        dl.name = dlName;
        dl.trainingSession = training;
        saveDigitalLead(dl);
      } else {
        dl = { dlId: generateId(), name: dlName, areaCode: code, role: '', trainingSession: training,
          meetingHistory: [], resourcesCreated: [], progressNotes: [], supportDelivered: [], impactEvidence: [] };
        const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
        const staffMatch = allStaff.find(s => s.name.toLowerCase() === dlName.toLowerCase() && s.areaCode === code);
        if (staffMatch) dl.staffId = staffMatch.staffId;
        saveDigitalLead(dl);
      }
      area.digitalLeadId = dl.dlId;
      saveArea(area);
      dlsHandled++;
    }
  });

  const archiveCheckbox = document.getElementById('dl-archive-sel');
  let selArchived = false;
  if (archiveCheckbox && archiveCheckbox.checked && typeof archiveArea === 'function') {
    selArchived = archiveArea('SEL', true);
  }

  if (typeof UI !== 'undefined') {
    UI.showToast('success', `${areasCreated} area(s) created, ${areasUpdated} updated, ${dlsHandled} Digital Lead(s) handled.${selArchived ? ' SEL archived.' : ''}${skipped>0?` ${skipped} skipped.`:''}`);
  }
  document.getElementById('dl-tracker-import-panel').style.display = 'none';
  _renderDLList();
}
