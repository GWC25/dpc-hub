// DPC Hub · js/templates.js · v1.0 · July 2026
// Template Library. Teach Meet plans (Six Stages), Coaching Question sets
// (LRA-themed, AI-draft flagged, DPC approval), Meeting Agendas.
// Versioned — each edit creates a new version, instances reference their version.

let _tmplCurrentId  = null;
let _tmplFilterType = '';

function initTemplates() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Templates</h1>
      <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
        <select id="tmpl-filter-type" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="teach-meet">Teach Meet plans</option>
          <option value="coaching-questions">Coaching Question sets</option>
          <option value="meeting-agenda">Meeting Agendas</option>
          <option value="observation-framework">Observation Frameworks</option>
        </select>
        <div style="display:flex;gap:var(--space-xs);">
          <button id="tmpl-new-tm" type="button" class="btn btn--primary btn--sm">+ Teach Meet</button>
          <button id="tmpl-new-cq" type="button" class="btn btn--ghost btn--sm">+ Coaching Qs</button>
          <button id="tmpl-new-ag" type="button" class="btn btn--ghost btn--sm">+ Agenda</button>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:var(--space-xl);align-items:start;">
      <div>
        <div id="tmpl-list" role="list" aria-label="Templates"></div>
        <p id="tmpl-empty" style="font-size:var(--text-sm);color:var(--color-muted);padding:var(--space-lg) 0;">No templates yet. Create your first Teach Meet plan, Coaching Question set, or Meeting Agenda.</p>
      </div>
      <div id="tmpl-detail" style="display:none;"></div>
    </div>

    <!-- Builder modal -->
    <div id="tmpl-modal" role="dialog" aria-modal="true" aria-labelledby="tmpl-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:flex-start;justify-content:center;
      padding:var(--space-lg);overflow-y:auto;">
      <div id="tmpl-modal-inner" style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:760px;padding:var(--space-xl);margin:auto;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="tmpl-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);"></h2>
          <button id="tmpl-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div id="tmpl-modal-body"></div>
        <input type="hidden" id="tmpl-modal-id">
        <input type="hidden" id="tmpl-modal-type">
        <p id="tmpl-modal-error" role="alert" style="color:var(--color-red);font-size:var(--text-sm);display:none;margin-bottom:var(--space-md);"></p>
        <div class="btn-row">
          <button id="tmpl-modal-save" type="button" class="btn btn--primary">Save template</button>
          <button id="tmpl-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Instance modal -->
    <div id="instance-modal" role="dialog" aria-modal="true" aria-labelledby="instance-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:700;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="instance-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Create instance</h2>
          <button id="instance-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="inst-date">Date</label>
          <input class="form-input" type="date" id="inst-date" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="inst-area">Area</label>
          <select class="form-select" id="inst-area" required>
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="inst-context">Context notes</label>
          <textarea class="form-textarea" id="inst-context" rows="2" placeholder="Any context-specific notes for this delivery…"></textarea>
        </div>
        <input type="hidden" id="inst-template-id">
        <div class="btn-row">
          <button id="inst-save" type="button" class="btn btn--primary">Create instance</button>
          <button id="inst-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
        <div id="inst-result" style="display:none;margin-top:var(--space-lg);padding:var(--space-md);background:var(--color-teal-lt);border-radius:var(--radius-md);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-teal);margin-bottom:var(--space-sm);">Instance created</p>
          <p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-sm);">Reflection link:</p>
          <div style="display:flex;gap:var(--space-sm);align-items:center;">
            <input id="inst-reflection-url" type="text" readonly style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-xs) monospace;background:var(--color-white);">
            <button id="inst-copy-url" type="button" class="btn btn--ghost btn--sm">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;

  _tmplPopulateAreaDropdowns();
  _renderTemplateList();
  _wireTemplateEvents();
}

// ── Template list ─────────────────────────────────────────────
function _renderTemplateList() {
  const list  = document.getElementById('tmpl-list');
  const empty = document.getElementById('tmpl-empty');
  if (!list) return;

  let tmpls = _getAllTemplates();
  if (_tmplFilterType) tmpls = tmpls.filter(t=>t.templateType===_tmplFilterType);
  tmpls.sort((a,b)=>(b.lastUpdated||'').localeCompare(a.lastUpdated||''));

  list.innerHTML = '';
  if (tmpls.length===0) { if(empty) empty.style.display='block'; return; }
  if (empty) empty.style.display='none';

  const typeIcons = {'teach-meet':'📋','coaching-questions':'💬','meeting-agenda':'📅','observation-framework':'🔍'};
  const typeLabels= {'teach-meet':'Teach Meet','coaching-questions':'Coaching Qs','meeting-agenda':'Agenda','observation-framework':'Obs Framework'};

  tmpls.forEach(t=>{
    const isActive = _tmplCurrentId===t.templateId;
    const item = document.createElement('div');
    item.role='listitem';
    item.dataset.templateId=t.templateId;
    item.setAttribute('tabindex','0');
    item.style.cssText=`
      padding:var(--space-md);border-radius:var(--radius-md);
      border:2px solid ${isActive?'var(--color-teal)':'var(--color-border)'};
      background:${isActive?'var(--color-teal-lt)':'var(--color-white)'};
      cursor:pointer;margin-bottom:var(--space-sm);transition:all 150ms;
    `;
    const instanceCount = (t.instances||[]).length;
    item.innerHTML=`
      <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
        <span style="font-size:16px;">${typeIcons[t.templateType]||'📄'}</span>
        <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-light);color:var(--color-muted);padding:1px 8px;border-radius:999px;">${typeLabels[t.templateType]||t.templateType}</span>
        <span style="font-size:var(--text-xs);color:var(--color-muted);margin-left:auto;">v${t.version||1}</span>
      </div>
      <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_tEsc(t.title)}</p>
      ${instanceCount>0?`<p style="font-size:var(--text-xs);color:var(--color-teal);margin-top:2px;">${instanceCount} instance${instanceCount!==1?'s':''}</p>`:''}
    `;
    item.addEventListener('click',()=>_openTemplateDetail(t.templateId));
    item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();_openTemplateDetail(t.templateId);}});
    list.appendChild(item);
  });
}

// ── Template detail ───────────────────────────────────────────
function _openTemplateDetail(templateId) {
  _tmplCurrentId = templateId;
  _renderTemplateList();
  const detail = document.getElementById('tmpl-detail');
  if (!detail) return;
  detail.style.display = 'block';

  const t = _getTemplate(templateId);
  if (!t) return;

  const typeLabels={'teach-meet':'Teach Meet Plan','coaching-questions':'Coaching Question Set','meeting-agenda':'Meeting Agenda','observation-framework':'Observation Framework'};
  const lraThemes = (t.lraThemeIds||[]).map(id=>{ const th=getLRATheme(id); return th?th.label:id; }).join(', ');

  detail.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">${typeLabels[t.templateType]||t.templateType} · Version ${t.version||1} · ${_tFmtDate(t.lastUpdated)}</p>
        <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_tEsc(t.title)}</h2>
        ${lraThemes?`<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">LRA: ${_tEsc(lraThemes)}</p>`:''}
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button id="tmpl-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit</button>
        <button id="tmpl-instance-btn" type="button" class="btn btn--primary btn--sm">Create instance</button>
      </div>
    </div>

    <!-- Template content preview -->
    <div id="tmpl-content-preview" style="margin-bottom:var(--space-lg);">
      ${_renderTemplateContentPreview(t)}
    </div>

    <!-- Instances -->
    <div>
      <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Instances (${(t.instances||[]).length})</h3>
      ${(t.instances||[]).length===0
        ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">No instances yet. Click "Create instance" to deploy this template.</p>'
        : (t.instances||[]).slice().reverse().map(inst=>`
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
            <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:70px;flex-shrink:0;padding-top:2px;">${_tFmtDate(inst.date)}</span>
            <div style="flex:1;">
              <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_tEsc(inst.areaCode||'')} — v${inst.templateVersion||1}</p>
              ${inst.contextNotes?`<p style="font-size:var(--text-xs);color:var(--color-muted);">${_tEsc(inst.contextNotes)}</p>`:''}
            </div>
          </div>`).join('')
      }
    </div>
  `;

  document.getElementById('tmpl-edit-btn')?.addEventListener('click', ()=>_openTemplateBuilder(t.templateType, templateId));
  document.getElementById('tmpl-instance-btn')?.addEventListener('click', ()=>_openInstanceModal(templateId));
}

function _renderTemplateContentPreview(t) {
  if (!t.content) return '<p style="color:var(--color-muted);font-size:var(--text-sm);">No content yet.</p>';
  const c = t.content;

  if (t.templateType==='teach-meet') {
    const stages = [
      ['Learning Intentions',c.learningIntentions],
      ['Building Blocks',c.buildingBlocks],
      ['Starting Points',c.startingPoints],
      ['Assessment',c.assessment],
      ['Lasting Learning',c.lastingLearning],
    ];
    return stages.filter(([,v])=>v).map(([label,val])=>`
      <div style="margin-bottom:var(--space-md);">
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-teal);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${label}</p>
        <p style="font-size:var(--text-sm);color:var(--color-slate);">${_tEsc(val)}</p>
      </div>`).join('')
    + (c.activities&&c.activities.length>0?`
      <div style="margin-bottom:var(--space-md);">
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-teal);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Activities</p>
        ${c.activities.map(a=>`<div style="display:flex;gap:var(--space-sm);margin-bottom:4px;"><span style="font-size:var(--text-xs);color:var(--color-muted);min-width:50px;">${a.duration}min</span><p style="font-size:var(--text-sm);color:var(--color-slate);">${_tEsc(a.description)}</p></div>`).join('')}
      </div>`:'');
  }

  if (t.templateType==='coaching-questions') {
    const sections=[['Opening',c.openingQuestions],['Exploring',c.exploringQuestions],['Challenging',c.challengingQuestions],['Closing',c.closingQuestions]];
    const approved = c.isApproved;
    return (!approved?`<div style="background:var(--color-amber-lt);border:1px solid var(--color-amber);border-radius:var(--radius-sm);padding:var(--space-sm);margin-bottom:var(--space-md);font-size:var(--text-sm);color:var(--color-amber);">⚠ AI-drafted — pending your review. Approve in edit view before use.</div>`:'')
    + sections.filter(([,qs])=>qs&&qs.length>0).map(([label,qs])=>`
      <div style="margin-bottom:var(--space-md);">
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-teal);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${label}</p>
        ${qs.map(q=>`<p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:4px;">• ${_tEsc(q)}</p>`).join('')}
      </div>`).join('');
  }

  if (t.templateType==='meeting-agenda') {
    return (c.agendaItems||[]).map((item,i)=>`
      <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-sm);">
        <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:30px;">${i+1}.</span>
        <div>
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_tEsc(item.title)}</p>
          ${item.duration?`<p style="font-size:var(--text-xs);color:var(--color-muted);">${item.duration} mins</p>`:''}
        </div>
      </div>`).join('') || '<p style="color:var(--color-muted);font-size:var(--text-sm);">No agenda items yet.</p>';
  }

  return `<pre style="font-size:var(--text-sm);color:var(--color-slate);white-space:pre-wrap;">${_tEsc(JSON.stringify(c,null,2))}</pre>`;
}

// ── Template builder modal ────────────────────────────────────
function _openTemplateBuilder(type, existingId=null) {
  const modal   = document.getElementById('tmpl-modal');
  const titleEl = document.getElementById('tmpl-modal-title');
  const body    = document.getElementById('tmpl-modal-body');
  const typeEl  = document.getElementById('tmpl-modal-type');
  const idEl    = document.getElementById('tmpl-modal-id');
  if (!modal) return;

  const existing = existingId ? _getTemplate(existingId) : null;
  const labels   = {'teach-meet':'Teach Meet Plan','coaching-questions':'Coaching Question Set','meeting-agenda':'Meeting Agenda','observation-framework':'Observation Framework'};
  titleEl.textContent = (existing?'Edit':'New') + ' ' + (labels[type]||type);
  typeEl.value = type;
  idEl.value   = existingId||'';
  document.getElementById('tmpl-modal-error').style.display='none';

  body.innerHTML = _buildTemplateForm(type, existing);
  modal.style.display='flex';

  // Wire coaching questions approval toggles
  if (type==='coaching-questions') {
    body.querySelectorAll('.cq-approve-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const idx = parseInt(btn.dataset.idx);
        btn.classList.toggle('approved');
        btn.textContent = btn.classList.contains('approved') ? '✓ Approved' : 'Approve';
        btn.style.background = btn.classList.contains('approved') ? 'var(--color-green)' : 'var(--color-light)';
        btn.style.color = btn.classList.contains('approved') ? 'var(--color-white)' : 'var(--color-muted)';
      });
    });

    // Add question buttons
    body.querySelectorAll('.cq-add-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const section = btn.dataset.section;
        const container = body.querySelector(`[data-questions="${section}"]`);
        if (!container) return;
        const idx = container.children.length;
        const div = document.createElement('div');
        div.style.cssText='display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-xs);';
        div.innerHTML=`<input type="text" class="form-input" name="cq-${section}" placeholder="Question…" style="flex:1;min-height:36px;font-size:var(--text-sm);">
          <button type="button" class="cq-approve-btn" data-idx="${idx}" style="padding:4px 10px;border:none;cursor:pointer;font-size:var(--text-xs);background:var(--color-light);color:var(--color-muted);border-radius:var(--radius-sm);min-height:36px;white-space:nowrap;">Approve</button>
          <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>`;
        container.appendChild(div);
        div.querySelector('.cq-approve-btn').addEventListener('click',function(){
          this.classList.toggle('approved');
          this.textContent=this.classList.contains('approved')?'✓ Approved':'Approve';
          this.style.background=this.classList.contains('approved')?'var(--color-green)':'var(--color-light)';
          this.style.color=this.classList.contains('approved')?'var(--color-white)':'var(--color-muted)';
        });
      });
    });
  }

  // Activity add button for Teach Meet
  if (type==='teach-meet') {
    document.getElementById('tm-add-activity')?.addEventListener('click',()=>{
      const container = document.getElementById('tm-activities-list');
      if (!container) return;
      const div = document.createElement('div');
      div.style.cssText='display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-sm);';
      div.innerHTML=`<input type="number" name="tm-activity-duration" placeholder="mins" min="1" max="120" style="width:70px;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
        <input type="text" name="tm-activity-desc" placeholder="Activity description…" style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
        <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>`;
      container.appendChild(div);
    });
  }

  // Agenda item add button
  if (type==='meeting-agenda') {
    document.getElementById('ag-add-item')?.addEventListener('click',()=>{
      const container = document.getElementById('ag-items-list');
      if (!container) return;
      const div=document.createElement('div');
      div.style.cssText='display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-sm);';
      div.innerHTML=`<input type="text" name="ag-item-title" placeholder="Agenda item…" style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
        <input type="number" name="ag-item-duration" placeholder="mins" min="1" max="120" style="width:70px;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
        <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>`;
      container.appendChild(div);
    });
  }
}

function _buildTemplateForm(type, existing) {
  const c = existing?.content || {};
  const e = existing || {};

  const commonHeader = `
    <div class="form-group">
      <label class="form-label" for="tmpl-title">Title</label>
      <input class="form-input" type="text" id="tmpl-title" value="${_tEsc(e.title||'')}" required>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
      <div class="form-group">
        <label class="form-label form-label--optional" for="tmpl-lra">LRA themes</label>
        <select class="form-select" id="tmpl-lra" multiple size="4" style="min-height:80px;">
          ${LRA_TAXONOMY.flatMap(cat=>cat.themes).map(t=>`<option value="${t.id}" ${(e.lraThemeIds||[]).includes(t.id)?'selected':''}>${t.id} — ${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="tmpl-pyramid">Pyramid level</label>
        <select class="form-select" id="tmpl-pyramid">
          <option value="all" ${!e.pyramidLevel||e.pyramidLevel==='all'?'selected':''}>All levels</option>
          <option value="foundations" ${e.pyramidLevel==='foundations'?'selected':''}>Foundations</option>
          <option value="inclusion" ${e.pyramidLevel==='inclusion'?'selected':''}>Inclusion</option>
          <option value="innovation" ${e.pyramidLevel==='innovation'?'selected':''}>Innovation</option>
        </select>
      </div>
    </div>`;

  if (type==='teach-meet') {
    const stages=[
      ['tm-intentions','Learning Intentions','What staff attending will know or be able to do.',c.learningIntentions||''],
      ['tm-building','Building Blocks','Prerequisite knowledge or context for attendees.',c.buildingBlocks||''],
      ['tm-starting','Starting Points','Where attendees are likely coming in.',c.startingPoints||''],
      ['tm-assessment','Assessment','How understanding will be checked during the session.',c.assessment||''],
      ['tm-lasting','Lasting Learning','The one thing attendees should implement after.',c.lastingLearning||''],
    ];
    return commonHeader + stages.map(([id,label,hint,val])=>`
      <div class="form-group">
        <label class="form-label" for="${id}">${label}</label>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">${hint}</p>
        <textarea class="form-textarea" id="${id}" rows="2">${_tEsc(val)}</textarea>
      </div>`).join('')
    + `<div class="form-group">
        <label class="form-label form-label--optional">Activities</label>
        <div id="tm-activities-list">
          ${(c.activities||[]).map(a=>`<div style="display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-sm);">
            <input type="number" name="tm-activity-duration" value="${a.duration||''}" placeholder="mins" style="width:70px;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
            <input type="text" name="tm-activity-desc" value="${_tEsc(a.description||'')}" placeholder="Activity description…" style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
            <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>
          </div>`).join('')}
        </div>
        <button id="tm-add-activity" type="button" class="btn btn--ghost btn--sm" style="margin-top:var(--space-xs);">+ Add activity</button>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="tm-facilitator">Facilitator notes</label>
        <textarea class="form-textarea" id="tm-facilitator" rows="2">${_tEsc(c.facilitatorNotes||'')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="tm-reflection">Reflection prompt</label>
        <textarea class="form-textarea" id="tm-reflection" rows="2" placeholder="The prompt shared with attendees at the end…">${_tEsc(c.reflectionPrompt||'')}</textarea>
      </div>`;
  }

  if (type==='coaching-questions') {
    const isAI = c.isAIDrafted && !c.isApproved;
    const sections=['opening','exploring','challenging','closing'];
    const sLabels={'opening':'Opening','exploring':'Exploring','challenging':'Challenging','closing':'Closing'};
    return commonHeader
    + `<div class="form-group">
        <label class="form-label form-label--optional" for="cq-lra-theme">LRA theme for these questions</label>
        <select class="form-select" id="cq-lra-theme">
          <option value="">— Any theme —</option>
          ${LRA_TAXONOMY.flatMap(cat=>cat.themes).map(t=>`<option value="${t.id}" ${c.lraThemeId===t.id?'selected':''}>${t.id} — ${t.label}</option>`).join('')}
        </select>
      </div>`
    + (isAI?`<div style="background:var(--color-amber-lt);border:1px solid var(--color-amber);border-radius:var(--radius-sm);padding:var(--space-md);margin-bottom:var(--space-lg);font-size:var(--text-sm);color:var(--color-amber);">⚠ AI-drafted — review each question and click Approve before saving as approved.</div>`:'')
    + sections.map(sec=>`
      <div class="form-group">
        <label class="form-label">${sLabels[sec]} questions</label>
        <div data-questions="${sec}">
          ${(c[sec+'Questions']||[]).map((q,i)=>`
            <div style="display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-xs);">
              <input type="text" class="form-input" name="cq-${sec}" value="${_tEsc(q)}" style="flex:1;min-height:36px;font-size:var(--text-sm);">
              <button type="button" class="cq-approve-btn ${(c.approvedQuestions&&c.approvedQuestions[sec]&&c.approvedQuestions[sec][i])?'approved':''}" data-section="${sec}" data-idx="${i}"
                style="padding:4px 10px;border:none;cursor:pointer;font-size:var(--text-xs);background:${(c.approvedQuestions&&c.approvedQuestions[sec]&&c.approvedQuestions[sec][i])?'var(--color-green)':'var(--color-light)'};color:${(c.approvedQuestions&&c.approvedQuestions[sec]&&c.approvedQuestions[sec][i])?'var(--color-white)':'var(--color-muted)'};border-radius:var(--radius-sm);min-height:36px;white-space:nowrap;">
                ${(c.approvedQuestions&&c.approvedQuestions[sec]&&c.approvedQuestions[sec][i])?'✓ Approved':'Approve'}
              </button>
              <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>
            </div>`).join('')}
        </div>
        <button type="button" class="cq-add-btn btn btn--ghost btn--sm" data-section="${sec}" style="margin-top:var(--space-xs);">+ Add question</button>
      </div>`).join('');
  }

  if (type==='meeting-agenda') {
    return commonHeader + `
      <div class="form-group">
        <label class="form-label">Agenda items</label>
        <div id="ag-items-list">
          ${(c.agendaItems||[]).map(item=>`
            <div style="display:flex;gap:var(--space-sm);align-items:flex-start;margin-bottom:var(--space-sm);">
              <input type="text" name="ag-item-title" value="${_tEsc(item.title||'')}" placeholder="Agenda item…" style="flex:1;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
              <input type="number" name="ag-item-duration" value="${item.duration||''}" placeholder="mins" style="width:70px;padding:var(--space-xs) var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;min-height:36px;">
              <button type="button" onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:36px;min-height:36px;">×</button>
            </div>`).join('')}
        </div>
        <button id="ag-add-item" type="button" class="btn btn--ghost btn--sm" style="margin-top:var(--space-xs);">+ Add item</button>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="ag-notes">Notes</label>
        <textarea class="form-textarea" id="ag-notes" rows="3">${_tEsc(c.notes||'')}</textarea>
      </div>`;
  }

  return commonHeader;
}

// ── Save template ─────────────────────────────────────────────
function _saveTemplate() {
  const title   = document.getElementById('tmpl-title')?.value.trim();
  const type    = document.getElementById('tmpl-modal-type')?.value;
  const existId = document.getElementById('tmpl-modal-id')?.value;
  const errEl   = document.getElementById('tmpl-modal-error');

  if (!title) { errEl.textContent='Please enter a title.'; errEl.style.display='block'; return; }

  const lraThemeSel = document.getElementById('tmpl-lra');
  const lraThemeIds = lraThemeSel ? Array.from(lraThemeSel.selectedOptions).map(o=>o.value) : [];

  let content = {};
  if (type==='teach-meet') {
    const durations = Array.from(document.querySelectorAll('input[name="tm-activity-duration"]')).map(i=>parseInt(i.value)||0);
    const descs     = Array.from(document.querySelectorAll('input[name="tm-activity-desc"]')).map(i=>i.value.trim());
    const activities= durations.map((d,i)=>({duration:d,description:descs[i]||'',resourceRefs:[]})).filter(a=>a.description);
    content = {
      learningIntentions: document.getElementById('tm-intentions')?.value.trim()||'',
      buildingBlocks:     document.getElementById('tm-building')?.value.trim()||'',
      startingPoints:     document.getElementById('tm-starting')?.value.trim()||'',
      activities,
      assessment:         document.getElementById('tm-assessment')?.value.trim()||'',
      lastingLearning:    document.getElementById('tm-lasting')?.value.trim()||'',
      facilitatorNotes:   document.getElementById('tm-facilitator')?.value.trim()||'',
      reflectionPrompt:   document.getElementById('tm-reflection')?.value.trim()||'',
      resourceLinks:      [],
    };
  } else if (type==='coaching-questions') {
    const sections=['opening','exploring','challenging','closing'];
    content = { lraThemeId: document.getElementById('cq-lra-theme')?.value||'', isAIDrafted:false, isApproved:true };
    const approvedQ = {};
    sections.forEach(sec=>{
      const inputs  = Array.from(document.querySelectorAll(`input[name="cq-${sec}"]`)).map(i=>i.value.trim()).filter(Boolean);
      const approves= Array.from(document.querySelectorAll(`[data-section="${sec}"].cq-approve-btn`)).map(b=>b.classList.contains('approved'));
      content[sec+'Questions'] = inputs;
      approvedQ[sec] = approves;
    });
    content.approvedQuestions = approvedQ;
    content.isApproved = Object.values(approvedQ).flat().every(Boolean);
  } else if (type==='meeting-agenda') {
    const titles    = Array.from(document.querySelectorAll('input[name="ag-item-title"]')).map(i=>i.value.trim());
    const durations = Array.from(document.querySelectorAll('input[name="ag-item-duration"]')).map(i=>parseInt(i.value)||0);
    content = {
      agendaItems: titles.map((t,i)=>({title:t,duration:durations[i]||null})).filter(i=>i.title),
      notes: document.getElementById('ag-notes')?.value.trim()||'',
    };
  }

  const existing = existId ? _getTemplate(existId) : null;
  const newVersion = existing ? (existing.version||1)+1 : 1;
  const snapshots  = existing ? [...(existing.versions||[]), {versionNumber:existing.version||1, savedAt:nowISO(), content:existing.content}] : [];

  const tmpl = {
    templateId:   existId || generateId(),
    templateType: type,
    title,
    version:      newVersion,
    versions:     snapshots,
    lraCategoryIds: [],
    lraThemeIds,
    pyramidLevel: document.getElementById('tmpl-pyramid')?.value||'all',
    tags:         [],
    content,
    linkedResourceIds:  [],
    linkedPathwayUrls:  [],
    isPublic:     false,
    instances:    existing?.instances || [],
    createdAt:    existing?.createdAt || nowISO(),
    lastUpdated:  nowISO(),
  };

  saveTemplate(tmpl);
  document.getElementById('tmpl-modal').style.display='none';
  _renderTemplateList();
  _openTemplateDetail(tmpl.templateId);
  if (typeof UI!=='undefined') UI.showToast('success',`Template saved: ${title} (v${newVersion})`);
}

// ── Instance modal ────────────────────────────────────────────
function _openInstanceModal(templateId) {
  const modal = document.getElementById('instance-modal');
  if (!modal) return;
  document.getElementById('inst-template-id').value = templateId;
  document.getElementById('inst-date').value = todayISO();
  document.getElementById('inst-area').value = '';
  document.getElementById('inst-context').value = '';
  document.getElementById('inst-result').style.display='none';
  modal.style.display='flex';
  document.getElementById('inst-date').focus();
}

function _saveInstance() {
  const templateId = document.getElementById('inst-template-id').value;
  const date       = document.getElementById('inst-date').value;
  const areaCode   = document.getElementById('inst-area').value;
  if (!date||!areaCode) { if(typeof UI!=='undefined') UI.showToast('warning','Please fill in date and area.'); return; }

  const tmpl = _getTemplate(templateId);
  if (!tmpl) return;

  const instanceId = generateId();
  const instance = {
    instanceId,
    templateVersion: tmpl.version||1,
    date,
    areaCode,
    attendeeIds:  [],
    contextNotes: document.getElementById('inst-context').value.trim()||'',
    linkedAFIIds: [],
    reflectionRefs:[],
  };

  if (!tmpl.instances) tmpl.instances=[];
  tmpl.instances.push(instance);
  saveTemplate(tmpl);

  // Generate reflection URL
  const baseUrl   = window.location.origin + window.location.pathname.replace('hub.html','');
  const reflUrl   = `${baseUrl}reflection-form.html?eventId=${instanceId}&areaCode=${areaCode}&stage=immediate`;
  const resultEl  = document.getElementById('inst-result');
  const urlEl     = document.getElementById('inst-reflection-url');
  if (urlEl) urlEl.value = reflUrl;
  if (resultEl) resultEl.style.display='block';

  document.getElementById('inst-copy-url')?.addEventListener('click',()=>{
    navigator.clipboard?.writeText(reflUrl).then(()=>{ if(typeof UI!=='undefined') UI.showToast('success','Reflection link copied!'); });
  });

  _openTemplateDetail(templateId);
  if (typeof UI!=='undefined') UI.showToast('success',`Instance created for ${areaCode} on ${date}`);
}

// ── Wire events ───────────────────────────────────────────────
function _wireTemplateEvents() {
  document.getElementById('tmpl-filter-type')?.addEventListener('change',e=>{ _tmplFilterType=e.target.value; _renderTemplateList(); });
  document.getElementById('tmpl-new-tm')?.addEventListener('click',()=>_openTemplateBuilder('teach-meet'));
  document.getElementById('tmpl-new-cq')?.addEventListener('click',()=>_openTemplateBuilder('coaching-questions'));
  document.getElementById('tmpl-new-ag')?.addEventListener('click',()=>_openTemplateBuilder('meeting-agenda'));
  document.getElementById('tmpl-modal-close')?.addEventListener('click',()=>{ document.getElementById('tmpl-modal').style.display='none'; });
  document.getElementById('tmpl-modal-cancel')?.addEventListener('click',()=>{ document.getElementById('tmpl-modal').style.display='none'; });
  document.getElementById('tmpl-modal-save')?.addEventListener('click',_saveTemplate);
  document.getElementById('tmpl-modal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('tmpl-modal')) document.getElementById('tmpl-modal').style.display='none'; });
  document.getElementById('instance-modal-close')?.addEventListener('click',()=>{ document.getElementById('instance-modal').style.display='none'; });
  document.getElementById('inst-cancel')?.addEventListener('click',()=>{ document.getElementById('instance-modal').style.display='none'; });
  document.getElementById('inst-save')?.addEventListener('click',_saveInstance);
  document.getElementById('instance-modal')?.addEventListener('click',e=>{ if(e.target===document.getElementById('instance-modal')) document.getElementById('instance-modal').style.display='none'; });
}

function _tmplPopulateAreaDropdowns() {
  ['inst-area'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    while(sel.options.length>1)sel.remove(1);
    (_getAreas()||[]).sort((a,b)=>a.areaName.localeCompare(b.areaName)).forEach(area=>{
      const opt=document.createElement('option');
      opt.value=area.areaCode; opt.textContent=`${area.areaCode} — ${area.areaName}`; sel.appendChild(opt);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllTemplates(){ return (window.DPC_DATA.templates&&window.DPC_DATA.templates.templates)||[]; }
function _getTemplate(id){ return _getAllTemplates().find(t=>t.templateId===id)||null; }
function _tFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _tEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
