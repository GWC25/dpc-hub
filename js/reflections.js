// DPC Hub · js/reflections.js · v1.0 · July 2026
// Reflection module. Lists all reflections. Links to staff profiles and AFIs.
// Anonymous at area level. Immediate + follow-up stages.
// Standalone reflection-form.html writes to Supabase (Phase 7) or pending captures.

function initReflections() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Reflections</h1>
      <button id="ref-add-btn" type="button" class="btn btn--primary btn--sm">+ Record reflection</button>
    </div>

    <!-- Summary metrics -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-md);margin-bottom:var(--space-xl);">
      <div style="background:var(--color-blue-lt);border:1px solid var(--color-blue);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;">
        <div id="ref-count-immediate" style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-blue);">0</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Immediate</div>
      </div>
      <div style="background:var(--color-purple-lt);border:1px solid var(--color-purple);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;">
        <div id="ref-count-followup" style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-purple);">0</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Follow-up</div>
      </div>
      <div style="background:var(--color-green-lt);border:1px solid var(--color-green);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;">
        <div id="ref-count-change" style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-green);">0</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Practice changes</div>
      </div>
    </div>

    <!-- Filter + list -->
    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md);flex-wrap:wrap;">
      <select id="ref-filter-stage" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by stage">
        <option value="">All stages</option>
        <option value="immediate">Immediate</option>
        <option value="follow-up">Follow-up</option>
      </select>
      <select id="ref-filter-area" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by area">
        <option value="">All areas</option>
      </select>
    </div>

    <div id="ref-list" aria-label="Reflections list"></div>
    <p id="ref-empty" style="display:none;color:var(--color-muted);font-size:var(--text-base);padding:var(--space-xl);text-align:center;">No reflections recorded yet.</p>

    <!-- Add reflection modal -->
    <div id="ref-modal" role="dialog" aria-modal="true" aria-labelledby="ref-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="ref-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Record reflection</h2>
          <button id="ref-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="ref-stage">Stage</label>
          <select class="form-select" id="ref-stage">
            <option value="immediate">Immediate — how did this land?</option>
            <option value="follow-up">Follow-up — what has changed in practice?</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ref-area">Area</label>
          <select class="form-select" id="ref-area" required>
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="ref-staff">Staff member (named in profile, anonymous at area level)</label>
          <select class="form-select" id="ref-staff">
            <option value="">— Anonymous / not linked —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ref-response">Reflection</label>
          <textarea class="form-textarea" id="ref-response" rows="4" placeholder="What was the key takeaway? What will you try or what has changed?"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="ref-confidence">Confidence rating (1–5)</label>
          <div style="display:flex;gap:var(--space-sm);">
            ${[1,2,3,4,5].map(n=>`
              <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;">
                <input type="radio" name="ref-confidence" value="${n}" style="width:18px;height:18px;accent-color:var(--color-teal);">
                <span style="font-size:var(--text-xs);color:var(--color-muted);">${n}</span>
              </label>`).join('')}
            <span style="font-size:var(--text-xs);color:var(--color-muted);align-self:center;margin-left:var(--space-sm);">1=Not confident · 5=Very confident</span>
          </div>
        </div>
        <div id="ref-practice-section" style="display:none;">
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-sm);cursor:pointer;font-size:var(--text-base);color:var(--color-slate);">
              <input type="checkbox" id="ref-practice-change" style="width:18px;height:18px;accent-color:var(--color-teal);">
              I have changed something in my practice
            </label>
          </div>
          <div id="ref-practice-desc-group" style="display:none;" class="form-group">
            <label class="form-label" for="ref-practice-desc">What changed?</label>
            <textarea class="form-textarea" id="ref-practice-desc" rows="2"></textarea>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="ref-afi">Link to a loop (optional)</label>
          <select class="form-select" id="ref-afi">
            <option value="">— Not linked —</option>
          </select>
        </div>

        <p id="ref-error" role="alert" style="color:var(--color-red);font-size:var(--text-sm);display:none;margin-bottom:var(--space-md);"></p>
        <div class="btn-row">
          <button id="ref-modal-save" type="button" class="btn btn--primary">Save reflection</button>
          <button id="ref-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _refPopulateFilters();
  _renderReflectionMetrics();
  _renderReflectionList();
  _wireReflectionEvents();
}

// ── Metrics ───────────────────────────────────────────────────
function _renderReflectionMetrics() {
  const refs = _getAllReflections();
  document.getElementById('ref-count-immediate').textContent = refs.filter(r=>r.stage==='immediate').length;
  document.getElementById('ref-count-followup').textContent  = refs.filter(r=>r.stage==='follow-up').length;
  document.getElementById('ref-count-change').textContent    = refs.filter(r=>r.practiceChangeReported).length;
}

// ── Reflection list ───────────────────────────────────────────
function _renderReflectionList() {
  const list  = document.getElementById('ref-list');
  const empty = document.getElementById('ref-empty');
  if (!list) return;

  const stageFilter = document.getElementById('ref-filter-stage')?.value||'';
  const areaFilter  = document.getElementById('ref-filter-area')?.value||'';

  let refs = _getAllReflections();
  if (stageFilter) refs = refs.filter(r=>r.stage===stageFilter);
  if (areaFilter)  refs = refs.filter(r=>r.areaCode===areaFilter);
  refs = refs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));

  list.innerHTML='';
  if (refs.length===0) { if(empty) empty.style.display='block'; return; }
  if (empty) empty.style.display='none';

  refs.forEach(r=>{
    const stageBg = r.stage==='immediate'?'var(--color-blue-lt)':'var(--color-purple-lt)';
    const stageCol= r.stage==='immediate'?'var(--color-blue)':'var(--color-purple)';
    const conf    = r.confidenceRating ? `★ ${r.confidenceRating}/5` : '';

    const div = document.createElement('div');
    div.style.cssText='padding:var(--space-md);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-sm);';
    div.innerHTML=`
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:var(--space-sm);">
        <span style="font-size:var(--text-xs);font-weight:bold;background:${stageBg};color:${stageCol};padding:1px 10px;border-radius:999px;">${r.stage}</span>
        <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 8px;border-radius:999px;">${_rEsc(r.areaCode||'')}</span>
        ${conf?`<span style="font-size:var(--text-xs);color:var(--color-amber);">${conf}</span>`:''}
        ${r.practiceChangeReported?'<span style="font-size:10px;background:var(--color-green-lt);color:var(--color-green);padding:1px 8px;border-radius:999px;font-weight:bold;">Practice change</span>':''}
        <span style="font-size:var(--text-xs);color:var(--color-muted);margin-left:auto;">${_rFmtDate(r.submittedAt)}</span>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-slate);">${_rEsc(r.responseText||'')}</p>
      ${r.practiceChangeDescription?`<p style="font-size:var(--text-xs);color:var(--color-green);margin-top:4px;font-style:italic;">Changed: ${_rEsc(r.practiceChangeDescription)}</p>`:''}
    `;
    list.appendChild(div);
  });
}

// ── Wire events ───────────────────────────────────────────────
function _wireReflectionEvents() {
  document.getElementById('ref-add-btn')?.addEventListener('click', _openRefModal);
  document.getElementById('ref-modal-close')?.addEventListener('click', ()=>document.getElementById('ref-modal').style.display='none');
  document.getElementById('ref-modal-cancel')?.addEventListener('click', ()=>document.getElementById('ref-modal').style.display='none');
  document.getElementById('ref-modal-save')?.addEventListener('click', _saveReflection);
  document.getElementById('ref-filter-stage')?.addEventListener('change', _renderReflectionList);
  document.getElementById('ref-filter-area')?.addEventListener('change', _renderReflectionList);
  document.getElementById('ref-modal')?.addEventListener('click', e=>{ if(e.target===document.getElementById('ref-modal')) document.getElementById('ref-modal').style.display='none'; });

  // Show/hide follow-up specific fields
  document.getElementById('ref-stage')?.addEventListener('change', e=>{
    const section = document.getElementById('ref-practice-section');
    if (section) section.style.display = e.target.value==='follow-up'?'block':'none';
  });

  // Show practice description if checkbox checked
  document.getElementById('ref-practice-change')?.addEventListener('change', e=>{
    const group = document.getElementById('ref-practice-desc-group');
    if (group) group.style.display = e.target.checked?'block':'none';
  });
}

function _openRefModal() {
  const modal = document.getElementById('ref-modal');
  if (!modal) return;

  // Reset
  document.getElementById('ref-stage').value = 'immediate';
  document.getElementById('ref-area').value  = '';
  document.getElementById('ref-staff').value = '';
  document.getElementById('ref-response').value = '';
  document.getElementById('ref-afi').value   = '';
  document.getElementById('ref-error').style.display='none';
  document.querySelectorAll('input[name="ref-confidence"]').forEach(r=>r.checked=false);
  document.getElementById('ref-practice-section').style.display='none';
  document.getElementById('ref-practice-desc-group').style.display='none';
  if(document.getElementById('ref-practice-change')) document.getElementById('ref-practice-change').checked=false;

  // Populate staff dropdown
  _refPopulateStaffDropdown();
  _refPopulateAFIDropdown();

  modal.style.display='flex';
  document.getElementById('ref-stage').focus();
}

function _saveReflection() {
  const responseText = document.getElementById('ref-response').value.trim();
  const areaCode     = document.getElementById('ref-area').value;
  const errEl        = document.getElementById('ref-error');

  if (!areaCode)     { errEl.textContent='Please select an area.'; errEl.style.display='block'; return; }
  if (!responseText) { errEl.textContent='Please enter a reflection.'; errEl.style.display='block'; return; }

  const stage         = document.getElementById('ref-stage').value;
  const staffId       = document.getElementById('ref-staff').value||null;
  const linkedAFIId   = document.getElementById('ref-afi').value||null;
  const confRadio     = document.querySelector('input[name="ref-confidence"]:checked');
  const practiceChange= document.getElementById('ref-practice-change')?.checked||false;
  const practiceDesc  = document.getElementById('ref-practice-desc')?.value.trim()||null;

  const reflection = {
    reflectionId:          generateId(),
    stage,
    submittedAt:           nowISO(),
    eventId:               null,
    areaCode,
    staffId,
    linkedAFIId,
    responseText,
    confidenceRating:      confRadio ? parseInt(confRadio.value) : null,
    practiceChangeReported:practiceChange,
    practiceChangeDescription: practiceChange ? practiceDesc : null,
    isAnonymousAtAreaLevel:true,
  };

  saveReflection(reflection);

  // If linked to AFI — add as evidence
  if (linkedAFIId) {
    const afis = (window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[];
    const idx  = afis.findIndex(a=>a.afiId===linkedAFIId);
    if (idx>=0) {
      if (!afis[idx].evidenceChain) afis[idx].evidenceChain=[];
      afis[idx].evidenceChain.push({
        evidenceId:   generateId(),
        evidenceType: stage==='immediate'?'reflection-immediate':'reflection-follow-up',
        date:         todayISO(),
        summary:      responseText.substring(0,150)+(responseText.length>150?'…':''),
        sourceId:     reflection.reflectionId,
        loopMovement: (stage==='follow-up'&&practiceChange)?'progresses':'progresses',
      });
      if (stage==='impact-checked') afis[idx].status='impact-checked';
      window.DPC_DATA.afi.afis=afis;
      saveAFI(afis[idx]);
    }
  }

  // If linked to staff — add to reflectionRefs
  if (staffId) {
    const allStaff = window.DPC_DATA.staff&&window.DPC_DATA.staff.staff||[];
    const sIdx = allStaff.findIndex(s=>s.staffId===staffId);
    if (sIdx>=0) {
      if (!allStaff[sIdx].reflectionRefs) allStaff[sIdx].reflectionRefs=[];
      allStaff[sIdx].reflectionRefs.push(reflection.reflectionId);
      allStaff[sIdx].lastUpdated=nowISO();
      saveStaff(allStaff[sIdx]);
    }
  }

  document.getElementById('ref-modal').style.display='none';
  _renderReflectionMetrics();
  _renderReflectionList();
  if (typeof UI!=='undefined') UI.showToast('success','Reflection saved.'+(linkedAFIId?' Evidence added to loop.':''));
}

// ── Populate helpers ──────────────────────────────────────────
function _refPopulateFilters() {
  const areaSel = document.getElementById('ref-filter-area');
  if (areaSel) {
    while(areaSel.options.length>1) areaSel.remove(1);
    (_getAreas()||[]).sort((a,b)=>a.areaCode.localeCompare(b.areaCode)).forEach(area=>{
      const opt=document.createElement('option');
      opt.value=area.areaCode; opt.textContent=`${area.areaCode} — ${area.areaName}`; areaSel.appendChild(opt);
    });
  }
  const refAreaSel = document.getElementById('ref-area');
  if (refAreaSel) {
    while(refAreaSel.options.length>1) refAreaSel.remove(1);
    (_getAreas()||[]).sort((a,b)=>a.areaName.localeCompare(b.areaName)).forEach(area=>{
      const opt=document.createElement('option');
      opt.value=area.areaCode; opt.textContent=`${area.areaCode} — ${area.areaName}`; refAreaSel.appendChild(opt);
    });
  }
}

function _refPopulateStaffDropdown() {
  const sel = document.getElementById('ref-staff');
  if (!sel) return;
  while(sel.options.length>1) sel.remove(1);
  ((window.DPC_DATA.staff&&window.DPC_DATA.staff.staff)||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(s=>{
    const opt=document.createElement('option');
    opt.value=s.staffId; opt.textContent=`${s.name} (${s.areaCode||''})`; sel.appendChild(opt);
  });
}

function _refPopulateAFIDropdown() {
  const sel = document.getElementById('ref-afi');
  if (!sel) return;
  while(sel.options.length>1) sel.remove(1);
  const afis = ((window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[]).filter(a=>a.status!=='closed');
  afis.forEach(a=>{
    const opt=document.createElement('option');
    opt.value=a.afiId; opt.textContent=`${a.areaCode} — ${a.lraThemeLabel||a.lraThemeId} (${a.status})`; sel.appendChild(opt);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllReflections() { return (window.DPC_DATA.reflections&&window.DPC_DATA.reflections.reflections)||[]; }
function _rFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _rEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
