// DPC Hub · js/currentfocus.js · v1.0 · July 2026
// Current Focus module. Flexible targeted focus objects.
// Not tied to curriculum areas — could be SEND, a theme, an action, or a person.
// What / Why / How / Who / Impact structure.

let _cfCurrentId = null;

function initCurrentFocus() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Current Focus</h1>
      <button id="cf-new-btn" type="button" class="btn btn--primary btn--sm">+ New focus</button>
    </div>
    <p style="font-size:var(--text-base);color:var(--color-muted);margin-bottom:var(--space-xl);">Targeted focus areas beyond routine coaching — a specific theme, initiative, group, or action that needs sustained attention.</p>

    <div style="display:grid;grid-template-columns:260px 1fr;gap:var(--space-xl);align-items:start;">
      <div>
        <div id="cf-list" role="list"></div>
        <p id="cf-empty" style="font-size:var(--text-sm);color:var(--color-muted);">No focus areas yet. SEND digital accessibility is suggested as a first entry for September.</p>
      </div>
      <div id="cf-detail" style="display:none;"></div>
    </div>

    <!-- Focus modal -->
    <div id="cf-modal" role="dialog" aria-modal="true" aria-labelledby="cf-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:flex-start;justify-content:center;
      padding:var(--space-lg);overflow-y:auto;">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:620px;padding:var(--space-xl);margin:auto;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="cf-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">New focus</h2>
          <button id="cf-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="cf-title">Title</label>
            <input class="form-input" type="text" id="cf-title" placeholder="e.g. SEND — Digital Accessibility" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="cf-type">Type</label>
            <select class="form-select" id="cf-type">
              <option value="theme">Theme</option>
              <option value="area">Curriculum area</option>
              <option value="person">Person / group</option>
              <option value="action">Action / project</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="cf-start">Start date</label>
            <input class="form-input" type="date" id="cf-start">
          </div>
          <div class="form-group">
            <label class="form-label" for="cf-status">Status</label>
            <select class="form-select" id="cf-status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>

        ${['what','why','how','who','impact'].map(field=>`
          <div class="form-group">
            <label class="form-label" for="cf-${field}">${field.charAt(0).toUpperCase()+field.slice(1)}</label>
            <textarea class="form-textarea" id="cf-${field}" rows="2" placeholder="${{
              what:'What is this focus area?',
              why:'Why is this a priority right now?',
              how:'How will you approach it? What methods and tools?',
              who:'Who is involved? Which staff, areas, or groups?',
              impact:'How will you measure and evidence impact?'
            }[field]}"></textarea>
          </div>`).join('')}

        <input type="hidden" id="cf-modal-id">
        <div class="btn-row">
          <button id="cf-modal-save" type="button" class="btn btn--primary">Save focus</button>
          <button id="cf-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _renderCFList();
  _wireCFEvents();
}

function _renderCFList() {
  const list  = document.getElementById('cf-list');
  const empty = document.getElementById('cf-empty');
  if (!list) return;
  const focuses = _getAllFocuses();
  if (focuses.length===0) { if(empty) empty.style.display='block'; list.innerHTML=''; return; }
  if(empty) empty.style.display='none';
  list.innerHTML='';

  const statusCol={'active':'var(--color-green)','paused':'var(--color-amber)','complete':'var(--color-muted)'};
  const typeIcons={'theme':'🎯','area':'🗂','person':'👤','action':'⚡'};

  focuses.sort((a,b)=>{
    const so={'active':0,'paused':1,'complete':2};
    return (so[a.status]||0)-(so[b.status]||0)||((a.title||'').localeCompare(b.title||''));
  }).forEach(f=>{
    const isActive=_cfCurrentId===f.focusId;
    const item=document.createElement('div');
    item.role='listitem'; item.dataset.focusId=f.focusId; item.setAttribute('tabindex','0');
    item.style.cssText=`padding:var(--space-md);border-radius:var(--radius-md);border:2px solid ${isActive?'var(--color-teal)':'var(--color-border)'};background:${isActive?'var(--color-teal-lt)':'var(--color-white)'};cursor:pointer;margin-bottom:var(--space-sm);transition:all 150ms;`;
    item.innerHTML=`
      <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
        <span style="font-size:16px;">${typeIcons[f.focusType]||'🎯'}</span>
        <span style="font-size:10px;font-weight:bold;color:${statusCol[f.status]||'var(--color-muted)'};">${(f.status||'active').toUpperCase()}</span>
      </div>
      <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_cfEsc(f.title)}</p>
      ${f.startDate?`<p style="font-size:var(--text-xs);color:var(--color-muted);">Started ${_cfFmtDate(f.startDate)}</p>`:''}
    `;
    item.addEventListener('click',()=>_openCFDetail(f.focusId));
    item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();_openCFDetail(f.focusId);}});
    list.appendChild(item);
  });
}

function _openCFDetail(focusId) {
  _cfCurrentId=focusId;
  _renderCFList();
  const detail=document.getElementById('cf-detail');
  if(!detail) return;
  detail.style.display='block';
  const f=_getAllFocuses().find(x=>x.focusId===focusId);
  if(!f) return;

  const statusColour={'active':'var(--color-green)','paused':'var(--color-amber)','complete':'var(--color-muted)'};
  const fields=['what','why','how','who','impact'];
  const fieldLabels={what:'What',why:'Why',how:'How',who:'Who',impact:'Impact'};
  const fieldDesc={
    what:'What this focus area is',
    why:'Why it is a priority',
    how:'Approach and methods',
    who:'People and areas involved',
    impact:'How impact will be measured and evidenced'
  };

  detail.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
          <span style="font-size:var(--text-xs);font-weight:bold;color:${statusColour[f.status]||'var(--color-muted)'};">${(f.status||'active').toUpperCase()}</span>
          ${f.startDate?`<span style="font-size:var(--text-xs);color:var(--color-muted);">Started ${_cfFmtDate(f.startDate)}</span>`:''}
        </div>
        <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_cfEsc(f.title)}</h2>
      </div>
      <button id="cf-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit</button>
    </div>

    ${fields.map(field=>f[field]?`
      <div style="margin-bottom:var(--space-lg);padding-bottom:var(--space-lg);border-bottom:1px solid var(--color-border);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm);">
          <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-teal);color:var(--color-white);padding:2px 10px;border-radius:999px;">${fieldLabels[field]}</span>
          <span style="font-size:var(--text-xs);color:var(--color-muted);">${fieldDesc[field]}</span>
        </div>
        <p style="font-size:var(--text-base);color:var(--color-slate);white-space:pre-wrap;">${_cfEsc(f[field])}</p>
      </div>`:'').join('')}

    ${(f.linkedAreaCodes&&f.linkedAreaCodes.length>0)?`
      <div style="margin-bottom:var(--space-lg);">
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-muted);margin-bottom:var(--space-sm);">LINKED AREAS</p>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;">
          ${f.linkedAreaCodes.map(c=>`<span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:2px 10px;border-radius:999px;">${_cfEsc(c)}</span>`).join('')}
        </div>
      </div>`:''}
  `;

  document.getElementById('cf-edit-btn')?.addEventListener('click',()=>_openCFModal(focusId));
}

function _openCFModal(focusId=null) {
  const modal=document.getElementById('cf-modal');
  const titleEl=document.getElementById('cf-modal-title');
  if(!modal) return;
  const f=focusId?_getAllFocuses().find(x=>x.focusId===focusId):null;
  titleEl.textContent=f?'Edit focus':'New focus';
  document.getElementById('cf-title').value=f?.title||'';
  document.getElementById('cf-type').value=f?.focusType||'theme';
  document.getElementById('cf-start').value=f?.startDate||todayISO();
  document.getElementById('cf-status').value=f?.status||'active';
  ['what','why','how','who','impact'].forEach(field=>{
    document.getElementById(`cf-${field}`).value=f?.[field]||'';
  });
  document.getElementById('cf-modal-id').value=focusId||'';
  modal.style.display='flex';
  document.getElementById('cf-title').focus();
}

function _saveCFModal() {
  const title=document.getElementById('cf-title').value.trim();
  if(!title) return;
  const existId=document.getElementById('cf-modal-id').value;
  const existing=existId?_getAllFocuses().find(x=>x.focusId===existId):null;
  const focus={
    focusId:existId||generateId(),
    focusType:document.getElementById('cf-type').value||'theme',
    title,
    startDate:document.getElementById('cf-start').value||todayISO(),
    what:document.getElementById('cf-what').value.trim(),
    why:document.getElementById('cf-why').value.trim(),
    how:document.getElementById('cf-how').value.trim(),
    who:document.getElementById('cf-who').value.trim(),
    impact:document.getElementById('cf-impact').value.trim(),
    linkedAFIIds:existing?.linkedAFIIds||[],
    linkedAreaCodes:existing?.linkedAreaCodes||[],
    status:document.getElementById('cf-status').value||'active',
    reviewDate:existing?.reviewDate||null,
  };
  const all=(window.DPC_DATA.currentFocus&&window.DPC_DATA.currentFocus.focuses)||[];
  const idx=all.findIndex(x=>x.focusId===focus.focusId);
  if(idx>=0) all[idx]=focus; else all.push(focus);
  if(!window.DPC_DATA.currentFocus) window.DPC_DATA.currentFocus={focuses:[]};
  window.DPC_DATA.currentFocus.focuses=all;
  // Trigger auto-save
  if(typeof saveArea==='function') window._cfDirty=true;
  document.getElementById('cf-modal').style.display='none';
  _renderCFList();
  _openCFDetail(focus.focusId);
  if(typeof UI!=='undefined') UI.showToast('success',`Focus ${existId?'updated':'created'}: ${title}`);
}

function _wireCFEvents() {
  document.getElementById('cf-new-btn')?.addEventListener('click',()=>_openCFModal());
  document.getElementById('cf-modal-close')?.addEventListener('click',()=>document.getElementById('cf-modal').style.display='none');
  document.getElementById('cf-modal-cancel')?.addEventListener('click',()=>document.getElementById('cf-modal').style.display='none');
  document.getElementById('cf-modal-save')?.addEventListener('click',_saveCFModal);
  document.getElementById('cf-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('cf-modal'))document.getElementById('cf-modal').style.display='none';});
}

function _getAllFocuses(){return(window.DPC_DATA.currentFocus&&window.DPC_DATA.currentFocus.focuses)||[];}
function _cfFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _cfEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
