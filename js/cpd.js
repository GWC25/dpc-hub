// DPC Hub · js/cpd.js · v1.0 · July 2026
// CPD module. DPC personal CPD log. Planned training. CPD delivered to areas/individuals.

function initCPD() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-lg);">CPD</h1>

    <!-- Tabs -->
    <div role="tablist" style="display:flex;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-xl);">
      ${['my-cpd','planned','delivered'].map((tab,i)=>`
        <button role="tab" type="button" data-cpd-tab="${tab}" aria-selected="${i===0?'true':'false'}"
          style="padding:10px 20px;border:none;border-bottom:3px solid ${i===0?'var(--color-teal)':'transparent'};background:none;cursor:pointer;font:${i===0?'bold':''} var(--text-base) Arial,sans-serif;color:${i===0?'var(--color-teal)':'var(--color-muted)'};min-height:44px;">
          ${({'my-cpd':'My CPD',planned:'Planned Training',delivered:'CPD Delivered'})[tab]}
        </button>`).join('')}
    </div>
    <div id="cpd-panel"></div>

    <!-- CPD entry modal -->
    <div id="cpd-modal" role="dialog" aria-modal="true" aria-labelledby="cpd-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="cpd-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);"></h2>
          <button id="cpd-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div id="cpd-modal-body"></div>
        <input type="hidden" id="cpd-modal-type">
        <div class="btn-row">
          <button id="cpd-modal-save" type="button" class="btn btn--primary">Save</button>
          <button id="cpd-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _renderCPDTab('my-cpd');

  document.querySelectorAll('[data-cpd-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-cpd-tab]').forEach(b=>{
        const active=b.dataset.cpdTab===btn.dataset.cpdTab;
        b.setAttribute('aria-selected',active?'true':'false');
        b.style.borderBottomColor=active?'var(--color-teal)':'transparent';
        b.style.color=active?'var(--color-teal)':'var(--color-muted)';
        b.style.fontWeight=active?'bold':'normal';
      });
      _renderCPDTab(btn.dataset.cpdTab);
    });
  });

  document.getElementById('cpd-modal-close')?.addEventListener('click',()=>document.getElementById('cpd-modal').style.display='none');
  document.getElementById('cpd-modal-cancel')?.addEventListener('click',()=>document.getElementById('cpd-modal').style.display='none');
  document.getElementById('cpd-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('cpd-modal'))document.getElementById('cpd-modal').style.display='none';});
  document.getElementById('cpd-modal-save')?.addEventListener('click',_saveCPDEntry);
}

function _renderCPDTab(tab) {
  const panel = document.getElementById('cpd-panel');
  if (!panel) return;
  const cpd = window.DPC_DATA.cpd || {};

  if (tab==='my-cpd') {
    const entries=(cpd.entries||[]).slice().reverse();
    panel.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">My CPD log</h2>
        <button id="cpd-add-my" type="button" class="btn btn--primary btn--sm">+ Add CPD entry</button>
      </div>
      ${entries.length===0
        ? '<p style="color:var(--color-muted);">No CPD entries yet.</p>'
        : entries.map(e=>`
          <div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
            <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);flex-wrap:wrap;">
              <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;">${_cpdEsc(e.type||'CPD')}</span>
              <span style="font-size:var(--text-xs);color:var(--color-muted);">${_cpdFmtDate(e.date)}</span>
              ${e.confidenceRating?`<span style="font-size:var(--text-xs);color:var(--color-amber);">★ ${e.confidenceRating}/5</span>`:''}
            </div>
            <p style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${_cpdEsc(e.title||'')}</p>
            ${e.notes?`<p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:4px;">${_cpdEsc(e.notes)}</p>`:''}
            ${e.actionsArising?`<p style="font-size:var(--text-xs);color:var(--color-teal);margin-top:4px;font-style:italic;">Actions: ${_cpdEsc(e.actionsArising)}</p>`:''}
          </div>`).join('')}
    `;
    document.getElementById('cpd-add-my')?.addEventListener('click',()=>_openCPDModal('my-cpd'));
  }

  if (tab==='planned') {
    const planned=(cpd.plannedTraining||[]).slice().reverse();
    panel.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">Planned training</h2>
        <button id="cpd-add-planned" type="button" class="btn btn--primary btn--sm">+ Add planned training</button>
      </div>
      ${planned.length===0
        ? '<p style="color:var(--color-muted);">No planned training recorded.</p>'
        : planned.map(p=>`
          <div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
            <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);">
              <span style="font-size:var(--text-xs);color:var(--color-muted);">${_cpdFmtDate(p.plannedDate)}</span>
              <span style="font-size:var(--text-xs);font-weight:bold;background:${p.status==='complete'?'var(--color-green-lt)':p.status==='booked'?'var(--color-blue-lt)':'var(--color-light)'};color:${p.status==='complete'?'var(--color-green)':p.status==='booked'?'var(--color-blue)':'var(--color-muted)'};padding:1px 8px;border-radius:999px;">${_cpdEsc(p.status||'planned')}</span>
            </div>
            <p style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${_cpdEsc(p.title||'')}</p>
            ${p.provider?`<p style="font-size:var(--text-sm);color:var(--color-muted);">${_cpdEsc(p.provider)}</p>`:''}
          </div>`).join('')}
    `;
    document.getElementById('cpd-add-planned')?.addEventListener('click',()=>_openCPDModal('planned'));
  }

  if (tab==='delivered') {
    const delivered=(cpd.deliveredCPD||[]).slice().reverse();
    panel.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">CPD delivered</h2>
        <button id="cpd-add-delivered" type="button" class="btn btn--primary btn--sm">+ Log CPD delivered</button>
      </div>
      ${delivered.length===0
        ? '<p style="color:var(--color-muted);">No delivered CPD logged yet.</p>'
        : delivered.map(d=>`
          <div style="padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
            <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);flex-wrap:wrap;">
              <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 8px;border-radius:999px;">${_cpdEsc(d.areaCode||'')}</span>
              <span style="font-size:var(--text-xs);color:var(--color-muted);">${_cpdFmtDate(d.date)}</span>
            </div>
            <p style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${_cpdEsc(d.title||'')}</p>
            ${d.attendees?`<p style="font-size:var(--text-sm);color:var(--color-muted);">${d.attendees} attendee${d.attendees!==1?'s':''}</p>`:''}
            ${d.notes?`<p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:4px;">${_cpdEsc(d.notes)}</p>`:''}
          </div>`).join('')}
    `;
    document.getElementById('cpd-add-delivered')?.addEventListener('click',()=>_openCPDModal('delivered'));
  }
}

function _openCPDModal(type) {
  const modal   = document.getElementById('cpd-modal');
  const titleEl = document.getElementById('cpd-modal-title');
  const body    = document.getElementById('cpd-modal-body');
  document.getElementById('cpd-modal-type').value=type;

  if (type==='my-cpd') {
    titleEl.textContent='Add CPD entry';
    body.innerHTML=`
      <div class="form-group"><label class="form-label" for="cpd-title">Title</label><input class="form-input" type="text" id="cpd-title" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group"><label class="form-label" for="cpd-date">Date</label><input class="form-input" type="date" id="cpd-date" value="${todayISO()}"></div>
        <div class="form-group"><label class="form-label form-label--optional" for="cpd-type-sel">Type</label>
          <select class="form-select" id="cpd-type-sel">
            <option value="conference">Conference</option><option value="course">Course</option>
            <option value="reading">Reading / research</option><option value="network">Professional network</option>
            <option value="observation">Observation</option><option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label form-label--optional" for="cpd-notes">Notes / reflections</label><textarea class="form-textarea" id="cpd-notes" rows="3"></textarea></div>
      <div class="form-group"><label class="form-label form-label--optional" for="cpd-actions">Actions arising</label><input class="form-input" type="text" id="cpd-actions" placeholder="What will you do differently?"></div>
      <div class="form-group"><label class="form-label form-label--optional">Post-CPD confidence (1–5)</label>
        <div style="display:flex;gap:var(--space-sm);">${[1,2,3,4,5].map(n=>`<label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="cpd-conf" value="${n}" style="accent-color:var(--color-teal);"><span style="font-size:var(--text-xs);color:var(--color-muted);">${n}</span></label>`).join('')}</div>
      </div>`;
  } else if (type==='planned') {
    titleEl.textContent='Add planned training';
    body.innerHTML=`
      <div class="form-group"><label class="form-label" for="cpd-title">Title</label><input class="form-input" type="text" id="cpd-title" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group"><label class="form-label" for="cpd-date">Planned date</label><input class="form-input" type="date" id="cpd-date"></div>
        <div class="form-group"><label class="form-label form-label--optional" for="cpd-status-sel">Status</label>
          <select class="form-select" id="cpd-status-sel">
            <option value="planned">Planned</option><option value="booked">Booked</option><option value="complete">Complete</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label form-label--optional" for="cpd-provider">Provider</label><input class="form-input" type="text" id="cpd-provider" placeholder="e.g. ETF, Jisc, LinkedIn Learning"></div>`;
  } else {
    titleEl.textContent='Log CPD delivered';
    body.innerHTML=`
      <div class="form-group"><label class="form-label" for="cpd-title">Title / topic</label><input class="form-input" type="text" id="cpd-title" required></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group"><label class="form-label" for="cpd-date">Date</label><input class="form-input" type="date" id="cpd-date" value="${todayISO()}"></div>
        <div class="form-group"><label class="form-label form-label--optional" for="cpd-area-del">Area</label>
          <select class="form-select" id="cpd-area-del"><option value="">— Select —</option>${(_getAreas()||[]).map(a=>`<option value="${a.areaCode}">${a.areaCode} — ${a.areaName}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label form-label--optional" for="cpd-attendees">Number of attendees</label><input class="form-input" type="number" id="cpd-attendees" min="1"></div>
      <div class="form-group"><label class="form-label form-label--optional" for="cpd-notes">Notes</label><textarea class="form-textarea" id="cpd-notes" rows="2"></textarea></div>`;
  }

  modal.style.display='flex';
  document.getElementById('cpd-title')?.focus();
}

function _saveCPDEntry() {
  const type  = document.getElementById('cpd-modal-type').value;
  const title = document.getElementById('cpd-title')?.value.trim();
  if (!title) return;

  if (!window.DPC_DATA.cpd) window.DPC_DATA.cpd={entries:[],plannedTraining:[],deliveredCPD:[]};
  const cpd = window.DPC_DATA.cpd;
  if (!cpd.entries) cpd.entries=[];
  if (!cpd.plannedTraining) cpd.plannedTraining=[];
  if (!cpd.deliveredCPD) cpd.deliveredCPD=[];

  if (type==='my-cpd') {
    const confRadio=document.querySelector('input[name="cpd-conf"]:checked');
    cpd.entries.push({id:generateId(),title,date:document.getElementById('cpd-date')?.value||todayISO(),type:document.getElementById('cpd-type-sel')?.value||'other',notes:document.getElementById('cpd-notes')?.value.trim()||'',actionsArising:document.getElementById('cpd-actions')?.value.trim()||'',confidenceRating:confRadio?parseInt(confRadio.value):null});
  } else if (type==='planned') {
    if(!cpd.plannedTraining) cpd.plannedTraining=[];
    cpd.plannedTraining.push({id:generateId(),title,plannedDate:document.getElementById('cpd-date')?.value||'',provider:document.getElementById('cpd-provider')?.value.trim()||'',status:document.getElementById('cpd-status-sel')?.value||'planned'});
  } else {
    if(!cpd.deliveredCPD) cpd.deliveredCPD=[];
    cpd.deliveredCPD.push({id:generateId(),title,date:document.getElementById('cpd-date')?.value||todayISO(),areaCode:document.getElementById('cpd-area-del')?.value||'',attendees:parseInt(document.getElementById('cpd-attendees')?.value)||null,notes:document.getElementById('cpd-notes')?.value.trim()||''});
  }

  window.DPC_DATA.cpd=cpd;
  document.getElementById('cpd-modal').style.display='none';
  _renderCPDTab(type);
  if(typeof UI!=='undefined') UI.showToast('success','CPD entry saved.');
}

function _cpdFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _cpdEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
