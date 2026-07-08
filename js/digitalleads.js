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
      <button id="dl-new-btn" type="button" class="btn btn--primary btn--sm">+ Add Digital Lead</button>
    </div>

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
  const all=(window.DPC_DATA.digitalLeads&&window.DPC_DATA.digitalLeads.digitalLeads)||[];
  const idx=all.findIndex(d=>d.dlId===dl.dlId);
  if(idx>=0) all[idx]=dl; else all.push(dl);
  window.DPC_DATA.digitalLeads.digitalLeads=all;
  // Trigger save via a dummy saveStaff call — data.js will write digitalLeads file
  if(window.DPC_DATA.digitalLeads){
    // Direct write
    const entries=window.DPC_DATA.digitalLeads;
    // Use the generic pattern — mark dirty
    if(typeof saveArea==='function'){
      // Piggyback on auto-save — mark dirty directly
      window._dlDirty=true;
    }
  }
}

function _wireDLEvents() {
  document.getElementById('dl-new-btn')?.addEventListener('click',()=>_openDLModal());
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
function _dlFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _dlEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
