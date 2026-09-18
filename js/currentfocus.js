// DPC Hub · js/currentfocus.js · v1.3 · September 2026
// v1.3 — optional action plan of milestones, each with an id from the
// moment it exists so anything can link to it later; and retrospective
// linking, so activity logged before the board existed can be attached
// to a focus or a milestone.
// v1.2 — resources can be pinned to a focus, either picked from the
// Resource Library or pasted as a title + link. Resources arriving via
// linked Quick Capture activity are shown separately and read-only.
// v1.1 — shows Quick Capture activity linked to this focus, and now
// persists via saveCurrentFocus() rather than an unread window flag.
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

    <section style="margin-top:var(--space-lg);" aria-labelledby="cf-plan-heading">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);gap:var(--space-md);flex-wrap:wrap;">
        <h3 id="cf-plan-heading" style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Action plan</h3>
        <button id="cf-ms-add-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-ms-form">+ Add milestone</button>
      </div>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Every part is optional. A milestone can be one line with a date, or carry success criteria and tasks.</p>

      <div id="cf-ms-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <input type="hidden" id="cf-ms-id" value="">
        <div class="form-group">
          <label class="form-label" for="cf-ms-title">Milestone</label>
          <input class="form-input" type="text" id="cf-ms-title" placeholder="e.g. Audit returns above 80 per cent">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cf-ms-due">Due date</label>
          <input class="form-input" type="date" id="cf-ms-due">
        </div>
        <div class="form-group">
          <label class="form-label" for="cf-ms-state">State</label>
          <select class="form-select" id="cf-ms-state">
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="at-risk">At risk</option>
            <option value="complete">Complete</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cf-ms-crit">Success criteria</label>
          <textarea class="form-input" id="cf-ms-crit" rows="3" placeholder="One per line"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cf-ms-tasks">Tasks</label>
          <textarea class="form-input" id="cf-ms-tasks" rows="3" placeholder="One per line"></textarea>
        </div>
        <p id="cf-ms-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-sm);"></p>
        <div class="btn-row">
          <button id="cf-ms-save" type="button" class="btn btn--primary btn--sm">Save milestone</button>
          <button id="cf-ms-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
        </div>
      </div>

      <p id="cf-ms-status" role="status" aria-live="polite" class="sr-only"></p>
      ${_cfRenderMilestones(f)}
    </section>

    <section style="margin-top:var(--space-lg);" aria-labelledby="cf-resources-heading">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);gap:var(--space-md);flex-wrap:wrap;">
        <h3 id="cf-resources-heading" style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Resources</h3>
        <button id="cf-res-add-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-res-form">+ Add resource</button>
      </div>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Documents and links this focus is built on. Everything is a link \u2014 for a file, paste its OneDrive or SharePoint address.</p>

      <div id="cf-res-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <div class="form-group">
          <label class="form-label" for="cf-res-pick">Resource</label>
          <select class="form-select" id="cf-res-pick">
            <option value="__new__">Paste a new link\u2026</option>
            ${typeof renderLibraryOptionsHtml==='function' ? renderLibraryOptionsHtml() : ''}
          </select>
        </div>
        <div id="cf-res-new-fields">
          <div class="form-group">
            <label class="form-label" for="cf-res-title">Title</label>
            <input class="form-input" type="text" id="cf-res-title" placeholder="e.g. SEND Digital Accessibility strategy dossier">
          </div>
          <div class="form-group">
            <label class="form-label" for="cf-res-url">Link</label>
            <input class="form-input" type="url" id="cf-res-url" placeholder="https://\u2026">
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin-bottom:0;min-height:32px;">
              <input type="checkbox" id="cf-res-to-library" checked style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
              <span style="font-size:var(--text-sm);color:var(--color-navy);">Also add to the Resource Library</span>
            </label>
          </div>
        </div>
        <p id="cf-res-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-sm);"></p>
        <div class="btn-row">
          <button id="cf-res-save" type="button" class="btn btn--primary btn--sm">Add</button>
          <button id="cf-res-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
        </div>
      </div>

      <p id="cf-res-status" role="status" aria-live="polite" class="sr-only"></p>

      ${typeof getFocusResources==='function' && typeof renderResourceList==='function'
        ? renderResourceList(getFocusResources(f), {
            removeAction: 'cf-res-remove',
            emptyMsg: 'No resources pinned to this focus yet.'
          })
        : ''}

      ${(() => {
        if (typeof getLinkedActivityResources !== 'function' || typeof renderResourceList !== 'function') return '';
        const fromActivity = getLinkedActivityResources(ACTIVITY_LINK_TYPES.FOCUS, f.focusId)
          .filter(r => !((f.resources || []).some(p => p.resourceId === r.resourceId)));
        if (fromActivity.length === 0) return '';
        return `
          <h4 style="font-size:var(--text-sm);font-weight:bold;color:var(--color-muted);margin:var(--space-lg) 0 var(--space-xs);">From linked activity</h4>
          ${renderResourceList(fromActivity, {})}`;
      })()}
    </section>

    <div style="margin-top:var(--space-lg);display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap;">
      <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Linked activity</h3>
      <button id="cf-retro-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-retro-form">Link existing activity</button>
    </div>
    <div id="cf-retro-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin:var(--space-sm) 0 var(--space-md);">
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Activity logged before this focus existed can be attached here. Only activity not already linked to this focus is listed.</p>
      <div class="form-group">
        <label class="form-label" for="cf-retro-pick">Activity</label>
        <select class="form-select" id="cf-retro-pick"></select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="cf-retro-ms">Milestone</label>
        <select class="form-select" id="cf-retro-ms"></select>
      </div>
      <p id="cf-retro-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-sm);"></p>
      <div class="btn-row">
        <button id="cf-retro-save" type="button" class="btn btn--primary btn--sm">Link</button>
        <button id="cf-retro-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
      </div>
    </div>

    ${typeof getLinkedActivities==='function' && typeof renderLinkedActivityList==='function'
      ? renderLinkedActivityList(getLinkedActivities(ACTIVITY_LINK_TYPES.FOCUS, f.focusId), {
          heading:   '',
          headingId: 'cf-linked-activity',
          emptyMsg:  'No activity linked to this focus yet. Tick it in the "Link to" panel when you log an activity in Quick Capture.'
        })
      : ''}
  `;

  document.getElementById('cf-edit-btn')?.addEventListener('click',()=>_openCFModal(focusId));
  _wireCFResourceEvents(focusId);
  _wireCFMilestoneEvents(focusId);
  _wireCFRetroEvents(focusId);
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
    resources:existing?.resources||[],
    milestones:existing?.milestones||[],
    status:document.getElementById('cf-status').value||'active',
    reviewDate:existing?.reviewDate||null,
  };
  // saveCurrentFocus() marks data-current-focus.json dirty so the edit
  // reaches disk on the normal auto-save cycle.
  if(typeof saveCurrentFocus==='function') {
    saveCurrentFocus(focus);
  } else {
    const all=(window.DPC_DATA.currentFocus&&window.DPC_DATA.currentFocus.focuses)||[];
    const idx=all.findIndex(x=>x.focusId===focus.focusId);
    if(idx>=0) all[idx]=focus; else all.push(focus);
    if(!window.DPC_DATA.currentFocus) window.DPC_DATA.currentFocus={focuses:[]};
    window.DPC_DATA.currentFocus.focuses=all;
  }
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

// ── Action plan and milestones (v1.3) ────────────────────────────

const _CF_STATE_LABEL = {
  'not-started':'Not started', 'in-progress':'In progress',
  'at-risk':'At risk', 'complete':'Complete', 'dropped':'Dropped',
};
// Colour is never the only carrier: every chip prints its state in words.
const _CF_STATE_STYLE = {
  'not-started':'background:var(--color-light);color:var(--color-muted);border-color:var(--color-border)',
  'in-progress':'background:var(--color-blue-lt);color:var(--color-blue);border-color:var(--color-blue)',
  'at-risk':    'background:var(--color-amber-lt);color:var(--color-amber);border-color:var(--color-amber)',
  'complete':   'background:var(--color-green-lt);color:var(--color-green);border-color:var(--color-green)',
  'dropped':    'background:var(--color-light);color:var(--color-muted);border-color:var(--color-border)',
};

function _cfFmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(String(iso).split('T')[0] + 'T12:00:00')
      .toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  } catch { return iso; }
}

function _cfRenderMilestones(f) {
  const list = typeof getMilestones === 'function' ? getMilestones(f) : [];
  if (list.length === 0) {
    return '<p style="font-size:var(--text-sm);color:var(--color-muted);">No milestones yet. This focus works perfectly well without them.</p>';
  }
  return list.map(m => {
    const linked = (typeof getLinkedActivities === 'function')
      ? getLinkedActivities(ACTIVITY_LINK_TYPES.MILESTONE, m.milestoneId) : [];
    const chk = (items, kind) => (items || []).length === 0 ? '' : `
      <p style="font-size:var(--text-xs);color:var(--color-muted);font-weight:bold;margin:var(--space-sm) 0 2px;">${kind}</p>
      <ul style="list-style:none;margin:0;padding:0;">
        ${items.map(it => `
          <li style="padding:2px 0;">
            <label style="display:flex;gap:var(--space-xs);align-items:flex-start;cursor:pointer;margin-bottom:0;min-height:28px;font-size:var(--text-xs);">
              <input type="checkbox" class="cf-ms-check" data-ms="${_cfEsc(m.milestoneId)}" data-item="${_cfEsc(it.id)}"
                     ${it.done ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;margin-top:4px;">
              <span style="color:${it.done ? 'var(--color-muted)' : 'var(--color-slate)'};${it.done ? 'text-decoration:line-through;' : ''}">${_cfEsc(it.text)}</span>
            </label>
          </li>`).join('')}
      </ul>`;

    return `
      <article style="border:1px solid var(--color-border);border-left:6px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <div style="display:flex;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap;align-items:baseline;">
          <h4 style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_cfEsc(m.title)}</h4>
          <span style="font-size:12px;font-weight:bold;padding:2px 10px;border-radius:999px;border:1px solid;${_CF_STATE_STYLE[m.state] || ''}">${_cfEsc(_CF_STATE_LABEL[m.state] || m.state)}</span>
        </div>
        ${m.dueDate ? `<p style="font-size:var(--text-xs);color:var(--color-muted);">Due ${_cfEsc(_cfFmtDate(m.dueDate))}${m.completedDate ? '. Completed ' + _cfEsc(_cfFmtDate(m.completedDate)) : ''}</p>` : ''}
        ${chk(m.successCriteria, 'Success criteria')}
        ${chk(m.tasks, 'Tasks')}
        ${linked.length > 0 ? `<p style="font-size:var(--text-xs);color:var(--color-teal);margin-top:var(--space-sm);">${linked.length} linked activit${linked.length === 1 ? 'y' : 'ies'}</p>` : ''}
        <div class="btn-row" style="margin-top:var(--space-sm);">
          <button type="button" class="btn btn--ghost btn--sm cf-ms-edit" data-ms="${_cfEsc(m.milestoneId)}">Edit<span class="sr-only"> ${_cfEsc(m.title)}</span></button>
          <button type="button" class="btn btn--ghost btn--sm cf-ms-del" data-ms="${_cfEsc(m.milestoneId)}">Delete<span class="sr-only"> ${_cfEsc(m.title)}</span></button>
        </div>
      </article>`;
  }).join('');
}

function _wireCFMilestoneEvents(focusId) {
  const form = document.getElementById('cf-ms-form');
  const add  = document.getElementById('cf-ms-add-btn');
  if (!form || !add) return;

  const setOpen = (open) => {
    form.style.display = open ? 'block' : 'none';
    add.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) document.getElementById('cf-ms-title').focus();
  };

  add.addEventListener('click', () => {
    if (form.style.display === 'none') { _cfResetMilestoneForm(); setOpen(true); }
    else setOpen(false);
  });
  document.getElementById('cf-ms-cancel')?.addEventListener('click', () => {
    _cfResetMilestoneForm(); setOpen(false); add.focus();
  });
  document.getElementById('cf-ms-save')?.addEventListener('click', () => _cfSaveMilestone(focusId));

  document.querySelectorAll('.cf-ms-edit').forEach(b => {
    b.addEventListener('click', () => { _cfFillMilestoneForm(focusId, b.dataset.ms); setOpen(true); });
  });
  document.querySelectorAll('.cf-ms-del').forEach(b => {
    b.addEventListener('click', () => _cfDeleteMilestone(focusId, b.dataset.ms));
  });
  document.querySelectorAll('.cf-ms-check').forEach(cb => {
    cb.addEventListener('change', () => _cfToggleCheck(focusId, cb.dataset.ms, cb.dataset.item, cb.checked));
  });
}

function _cfResetMilestoneForm() {
  ['cf-ms-id','cf-ms-title','cf-ms-due','cf-ms-crit','cf-ms-tasks'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const st = document.getElementById('cf-ms-state'); if (st) st.value = 'not-started';
  const err = document.getElementById('cf-ms-error'); if (err) err.style.display = 'none';
}

function _cfFillMilestoneForm(focusId, milestoneId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  const m = focus && typeof getMilestone === 'function' ? getMilestone(focus, milestoneId) : null;
  if (!m) return;
  document.getElementById('cf-ms-id').value    = m.milestoneId;
  document.getElementById('cf-ms-title').value = m.title || '';
  document.getElementById('cf-ms-due').value   = m.dueDate || '';
  document.getElementById('cf-ms-state').value = m.state || 'not-started';
  document.getElementById('cf-ms-crit').value  = (m.successCriteria || []).map(c => c.text).join('\n');
  document.getElementById('cf-ms-tasks').value = (m.tasks || []).map(t => t.text).join('\n');
}

// Existing items keep their id and their done state when the text is
// unchanged, so editing a milestone never silently unticks work already
// recorded as done.
function _cfMergeCheckItems(existing, lines) {
  const prev = (existing || []).slice();
  return lines.map(text => {
    const hit = prev.findIndex(p => p.text === text);
    if (hit >= 0) { const p = prev[hit]; prev.splice(hit, 1); return p; }
    return makeCheckItem(text);
  });
}

function _cfSaveMilestone(focusId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  if (!focus) return;
  const err = document.getElementById('cf-ms-error');
  const title = document.getElementById('cf-ms-title').value.trim();
  if (!title) {
    if (err) { err.textContent = 'Please give the milestone a title.'; err.style.display = 'block'; }
    document.getElementById('cf-ms-title').focus();
    return;
  }
  const lines = (id) => document.getElementById(id).value.split('\n').map(x => x.trim()).filter(Boolean);
  const id      = document.getElementById('cf-ms-id').value;
  const existing = id && typeof getMilestone === 'function' ? getMilestone(focus, id) : null;
  const state   = document.getElementById('cf-ms-state').value;

  const rec = makeMilestone({
    milestoneId:     existing ? existing.milestoneId : undefined,
    title,
    dueDate:         document.getElementById('cf-ms-due').value || null,
    state,
    successCriteria: _cfMergeCheckItems(existing && existing.successCriteria, lines('cf-ms-crit')),
    tasks:           _cfMergeCheckItems(existing && existing.tasks, lines('cf-ms-tasks')),
    notes:           existing ? existing.notes : '',
  });
  if (existing) {
    rec.createdAt = existing.createdAt;
    rec.resources = existing.resources || [];
  }
  // Completion date is set once, when the state first becomes complete.
  if (state === 'complete') rec.completedDate = (existing && existing.completedDate) || todayISO();
  else rec.completedDate = null;

  saveMilestone(focus, rec);
  _cfResetMilestoneForm();
  _openCFDetail(focusId);
  const st = document.getElementById('cf-ms-status');
  if (st) st.textContent = `Milestone saved: ${rec.title}.`;
}

function _cfDeleteMilestone(focusId, milestoneId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  if (!focus || !milestoneId) return;
  const m = getMilestone(focus, milestoneId);
  const linked = typeof getLinkedActivities === 'function'
    ? getLinkedActivities(ACTIVITY_LINK_TYPES.MILESTONE, milestoneId) : [];
  const warn = linked.length > 0
    ? `\n\n${linked.length} linked activit${linked.length === 1 ? 'y keeps its' : 'ies keep their'} link to this focus and lose${linked.length === 1 ? 's' : ''} only the milestone link.`
    : '';
  if (!window.confirm(`Delete the milestone "${m ? m.title : ''}"?${warn}`)) return;
  deleteMilestone(focus, milestoneId);
  _openCFDetail(focusId);
  const st = document.getElementById('cf-ms-status');
  if (st) st.textContent = 'Milestone deleted.';
}

function _cfToggleCheck(focusId, milestoneId, itemId, done) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  const m = focus ? getMilestone(focus, milestoneId) : null;
  if (!m) return;
  let found = false;
  ['successCriteria','tasks'].forEach(k => {
    (m[k] || []).forEach(it => { if (it.id === itemId) { it.done = !!done; found = true; } });
  });
  if (found) saveMilestone(focus, m);
}

// ── Retrospective linking (v1.3) ─────────────────────────────────

function _wireCFRetroEvents(focusId) {
  const form = document.getElementById('cf-retro-form');
  const btn  = document.getElementById('cf-retro-btn');
  if (!form || !btn) return;

  const setOpen = (open) => {
    form.style.display = open ? 'block' : 'none';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { _cfPopulateRetro(focusId); document.getElementById('cf-retro-pick').focus(); }
  };
  btn.addEventListener('click', () => setOpen(form.style.display === 'none'));
  document.getElementById('cf-retro-cancel')?.addEventListener('click', () => { setOpen(false); btn.focus(); });
  document.getElementById('cf-retro-save')?.addEventListener('click', () => _cfRetroLink(focusId));
}

function _cfPopulateRetro(focusId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  const pick  = document.getElementById('cf-retro-pick');
  const msSel = document.getElementById('cf-retro-ms');
  if (!pick || !focus) return;

  const all = typeof getAllActivities === 'function' ? getAllActivities() : [];
  const candidates = all
    .filter(a => !(a.links || []).some(l => l && l.type === ACTIVITY_LINK_TYPES.FOCUS && l.id === focusId))
    .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')))
    .slice(0, 100);

  pick.innerHTML = candidates.length === 0
    ? '<option value="">No unlinked activity found</option>'
    : candidates.map(a => {
        const label = [_cfFmtDate(a.date), a.areaCode || 'Cross-college',
                       (typeof activityTypeLabel === 'function' ? activityTypeLabel(a.activityType) : a.activityType),
                       a.summary || ''].filter(Boolean).join(' \u00b7 ');
        return `<option value="${_cfEsc(a.activityId)}">${_cfEsc(label.length > 110 ? label.slice(0, 110) + '\u2026' : label)}</option>`;
      }).join('');

  if (msSel) {
    const ms = typeof getMilestones === 'function' ? getMilestones(focus) : [];
    msSel.innerHTML = '<option value="">Focus only, no milestone</option>'
      + ms.map(m => `<option value="${_cfEsc(m.milestoneId)}">${_cfEsc(m.title)}</option>`).join('');
  }
}

function _cfRetroLink(focusId) {
  const activityId = document.getElementById('cf-retro-pick')?.value;
  const err = document.getElementById('cf-retro-error');
  const fail = (msg) => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
  if (!activityId) return fail('Select an activity to link.');

  const all = typeof getAllActivities === 'function' ? getAllActivities() : [];
  const act = all.find(a => a.activityId === activityId);
  if (!act) return fail('That activity could not be found. Try reopening this focus.');

  const links = (act.links || []).slice();
  links.push({ type: ACTIVITY_LINK_TYPES.FOCUS, id: focusId });
  const msId = document.getElementById('cf-retro-ms')?.value;
  if (msId && !links.some(l => l.type === ACTIVITY_LINK_TYPES.MILESTONE && l.id === msId)) {
    links.push({ type: ACTIVITY_LINK_TYPES.MILESTONE, id: msId });
  }
  if (typeof setActivityLinks !== 'function' || !setActivityLinks(activityId, links)) {
    return fail('That activity could not be updated.');
  }

  if (err) err.style.display = 'none';
  _openCFDetail(focusId);
  const st = document.getElementById('cf-ms-status');
  if (st) st.textContent = 'Activity linked to this focus.';
  if (typeof UI !== 'undefined') UI.showToast('success', 'Activity linked to this focus');
}

// ── Focus resources (v1.2) ───────────────────────────────────────

function _wireCFResourceEvents(focusId) {
  const form   = document.getElementById('cf-res-form');
  const addBtn = document.getElementById('cf-res-add-btn');
  const pick   = document.getElementById('cf-res-pick');
  if (!form || !addBtn) return;

  const setOpen = (open) => {
    form.style.display = open ? 'block' : 'none';
    addBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) pick?.focus();
  };

  addBtn.addEventListener('click', () => setOpen(form.style.display === 'none'));
  document.getElementById('cf-res-cancel')?.addEventListener('click', () => {
    _cfResetResourceForm();
    setOpen(false);
    addBtn.focus();
  });

  // Title and link only apply when pasting something new
  pick?.addEventListener('change', () => {
    const isNew = pick.value === '__new__';
    const fields = document.getElementById('cf-res-new-fields');
    if (fields) fields.style.display = isNew ? 'block' : 'none';
  });

  document.getElementById('cf-res-save')?.addEventListener('click', () => _cfSaveResource(focusId));

  document.querySelectorAll('.cf-res-remove').forEach(btn => {
    btn.addEventListener('click', () => _cfRemoveResource(focusId, btn.dataset.resourceId));
  });
}

function _cfResetResourceForm() {
  const pick = document.getElementById('cf-res-pick');
  if (pick) pick.value = '__new__';
  const fields = document.getElementById('cf-res-new-fields');
  if (fields) fields.style.display = 'block';
  ['cf-res-title','cf-res-url'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const lib = document.getElementById('cf-res-to-library'); if (lib) lib.checked = true;
  const err = document.getElementById('cf-res-error'); if (err) err.style.display = 'none';
}

function _cfSaveResource(focusId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  if (!focus) return;
  const pick = document.getElementById('cf-res-pick');
  const err  = document.getElementById('cf-res-error');
  const fail = (msg, focusEl) => {
    if (err) { err.textContent = msg; err.style.display = 'block'; }
    focusEl?.focus();
  };

  let ref;
  if (pick && pick.value !== '__new__') {
    const entry = typeof getLibraryEntryById === 'function' ? getLibraryEntryById(pick.value) : null;
    if (!entry) return fail('That Resource Library entry could not be found. Try pasting the link instead.', pick);
    ref = makeResourceRef({ resourceId: entry.resourceId, title: entry.title, url: entry.url, fromLibrary: true });
  } else {
    const title = document.getElementById('cf-res-title').value.trim();
    const url   = document.getElementById('cf-res-url').value.trim();
    if (!url)   return fail('Please enter a link.', document.getElementById('cf-res-url'));
    if (!title) return fail('Please give the resource a title, so it is recognisable in a report.', document.getElementById('cf-res-title'));

    const toLibrary = document.getElementById('cf-res-to-library')?.checked;
    ref = makeResourceRef({ title, url, fromLibrary: !!toLibrary });
    if (toLibrary && typeof saveLibraryEntry === 'function') {
      saveLibraryEntry({
        resourceId:  ref.resourceId,
        type:        typeof LIBRARY_TYPE !== 'undefined' ? LIBRARY_TYPE.EXTERNAL_RESOURCE : 'external-resource',
        title, url,
        description: '',
        tags:        [],
      });
    }
  }

  if (!focus.resources) focus.resources = [];
  if (focus.resources.some(r => r.url === ref.url)) {
    return fail('That link is already pinned to this focus.', pick);
  }
  focus.resources.push(ref);
  if (typeof saveCurrentFocus === 'function') saveCurrentFocus(focus);

  _cfResetResourceForm();
  _openCFDetail(focusId);
  const status = document.getElementById('cf-res-status');
  if (status) status.textContent = `Resource added: ${ref.title}.`;
  if (typeof UI !== 'undefined') UI.showToast('success', `Resource added: ${ref.title}`);
}

// Removes the pin only. Anything in the Resource Library stays there, and
// resources that arrived through linked activity are not pinned, so they
// cannot be removed from here.
function _cfRemoveResource(focusId, resourceId) {
  const focus = _getAllFocuses().find(x => x.focusId === focusId);
  if (!focus || !resourceId) return;
  const before = (focus.resources || []).length;
  focus.resources = (focus.resources || []).filter(r => r.resourceId !== resourceId);
  if (focus.resources.length === before) return;
  if (typeof saveCurrentFocus === 'function') saveCurrentFocus(focus);
  _openCFDetail(focusId);
  const status = document.getElementById('cf-res-status');
  if (status) status.textContent = 'Resource removed from this focus. It is still in the Resource Library if it was held there.';
}

function _getAllFocuses(){return(window.DPC_DATA.currentFocus&&window.DPC_DATA.currentFocus.focuses)||[];}
function _cfFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch{return iso;}}
function _cfEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
