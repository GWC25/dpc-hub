// DPC Hub · js/currentfocus.js · v2.0 · September 2026
// v2.0 — Current Focus is now the front board. The narrative moves
// behind an Overview tab and the focus opens on evidence. Evidence
// panels appear once something links to them, or while empty if pinned.
// A scope control narrows every count to a caseload or a single area,
// and every scoped count carries its denominator.
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

// Which tab and scope the board is showing. Kept at module level so a
// re-render after an edit returns you to where you were rather than
// throwing you back to the first tab.
let _cfTab   = 'board';
let _cfScope = null;            // null means all areas
let _cfEvidenceView = null;     // { type, label } when drilled into a panel
let _cfEvidenceCycle = '';      // health check cycle filter

function _openCFDetail(focusId) {
  _cfCurrentId = focusId;
  _renderCFList();
  const detail = document.getElementById('cf-detail');
  if (!detail) return;
  detail.style.display = 'block';
  const f = _getAllFocuses().find(x => x.focusId === focusId);
  if (!f) return;

  const tabs = [
    { id:'board',    label:'Board' },
    { id:'plan',     label:'Action plan' },
    { id:'evidence', label:'Evidence' },
    { id:'overview', label:'Overview' },
  ];
  if (!tabs.some(t => t.id === _cfTab)) _cfTab = 'board';

  detail.innerHTML = `
    ${_cfRenderFocusHeader(f)}
    ${_cfRenderScopeBar(f)}

    <div role="tablist" aria-label="Focus sections" style="display:flex;gap:2px;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-lg);overflow-x:auto;">
      ${tabs.map(t => `
        <button type="button" role="tab" class="cf-tab" id="cf-tab-${t.id}" data-tab="${t.id}"
                aria-controls="cf-panel-${t.id}" aria-selected="${_cfTab === t.id ? 'true' : 'false'}"
                tabindex="${_cfTab === t.id ? '0' : '-1'}"
                style="background:none;border:0;border-bottom:4px solid ${_cfTab === t.id ? 'var(--color-teal)' : 'transparent'};
                       padding:var(--space-sm) var(--space-md);cursor:pointer;min-height:48px;white-space:nowrap;
                       font-size:var(--text-sm);font-weight:${_cfTab === t.id ? 'bold' : 'normal'};
                       color:${_cfTab === t.id ? 'var(--color-navy)' : 'var(--color-muted)'};">${_cfEsc(t.label)}</button>`).join('')}
    </div>

    <div id="cf-panel-board"    role="tabpanel" aria-labelledby="cf-tab-board"    tabindex="0" ${_cfTab === 'board' ? '' : 'hidden'}>${_cfRenderBoard(f)}</div>
    <div id="cf-panel-plan"     role="tabpanel" aria-labelledby="cf-tab-plan"     tabindex="0" ${_cfTab === 'plan' ? '' : 'hidden'}>${_cfRenderPlanPanel(f)}</div>
    <div id="cf-panel-evidence" role="tabpanel" aria-labelledby="cf-tab-evidence" tabindex="0" ${_cfTab === 'evidence' ? '' : 'hidden'}>${_cfRenderEvidencePanel(f)}</div>
    <div id="cf-panel-overview" role="tabpanel" aria-labelledby="cf-tab-overview" tabindex="0" ${_cfTab === 'overview' ? '' : 'hidden'}>${_cfRenderOverview(f)}</div>

    <p id="cf-ms-status" role="status" aria-live="polite" class="sr-only"></p>
  `;

  _wireCFTabs(focusId);
  _wireCFScope(focusId);
  document.getElementById('cf-edit-btn')?.addEventListener('click', () => _openCFModal(focusId));
  if (_cfTab === 'plan')     _wireCFMilestoneEvents(focusId);
  if (_cfTab === 'evidence') { _wireCFResourceEvents(focusId); _wireCFRetroEvents(focusId); _wireCFEvidenceEvents(focusId); }
  if (_cfTab === 'board')    _wireCFBoardEvents(focusId);
}

function _cfRenderFocusHeader(f) {
  const statusColour = { active:'var(--color-green)', paused:'var(--color-amber)', complete:'var(--color-muted)' };
  const prog = typeof getFocusProgress === 'function' ? getFocusProgress(f) : { total:0, complete:0 };
  const linked = typeof getLinkedActivities === 'function'
    ? getLinkedActivities(ACTIVITY_LINK_TYPES.FOCUS, f.focusId) : [];
  const instruments = new Set(linked.map(a => a.activityType));
  const bits = [];
  if (prog.total) bits.push(`${prog.total} milestone${prog.total === 1 ? '' : 's'}`);
  if (linked.length) bits.push(`${linked.length} linked record${linked.length === 1 ? '' : 's'} across ${instruments.size} instrument${instruments.size === 1 ? '' : 's'}`);

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-md);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
          <span style="font-size:var(--text-xs);font-weight:bold;color:${statusColour[f.status] || 'var(--color-muted)'};">${(f.status || 'active').toUpperCase()}</span>
          ${f.startDate ? `<span style="font-size:var(--text-xs);color:var(--color-muted);">Started ${_cfFmtDate(f.startDate)}</span>` : ''}
        </div>
        <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_cfEsc(f.title)}</h2>
        ${bits.length ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${_cfEsc(bits.join('. '))}.</p>` : ''}
      </div>
      <button id="cf-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit</button>
    </div>`;
}

// ── Scope ────────────────────────────────────────────────────────
// All areas, a dated caseload, or one area. Whatever is chosen, the
// board states it, because a filtered count with no denominator reads
// as cherry-picking.
function _cfRenderScopeBar(f) {
  const caseloads = typeof getCaseloads === 'function' ? getCaseloads() : [];
  const current   = typeof getCurrentCaseloads === 'function' ? getCurrentCaseloads() : [];
  const areas     = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  const val = !_cfScope ? '' : (_cfScope.caseloadId ? 'c:' + _cfScope.caseloadId : 'a:' + _cfScope.areaCodes[0]);

  return `
    <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:var(--space-md);padding:var(--space-sm) var(--space-md);background:var(--color-light);border-radius:var(--radius-md);">
      <label class="form-label" for="cf-scope" style="margin:0;font-size:var(--text-xs);white-space:nowrap;">Showing</label>
      <select class="form-select" id="cf-scope" style="max-width:340px;">
        <option value="">All areas</option>
        ${caseloads.length ? `<optgroup label="Caseloads">${caseloads.map(c => {
          const live = current.some(x => x.caseloadId === c.caseloadId);
          return `<option value="c:${_cfEsc(c.caseloadId)}" ${val === 'c:' + c.caseloadId ? 'selected' : ''}>${_cfEsc(c.name)}${live ? '' : ' (not current)'}</option>`;
        }).join('')}</optgroup>` : ''}
        <optgroup label="Single area">
          ${areas.map(a => `<option value="a:${_cfEsc(a.areaCode)}" ${val === 'a:' + a.areaCode ? 'selected' : ''}>${_cfEsc(a.areaCode)} ${_cfEsc(a.areaName || '')}</option>`).join('')}
        </optgroup>
      </select>
      <button id="cf-caseload-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-caseload-form">Manage caseloads</button>
      <span id="cf-scope-note" style="font-size:var(--text-xs);color:var(--color-muted);">${_cfEsc(_cfScopeNote())}</span>
    </div>
    <div id="cf-caseload-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <input type="hidden" id="cf-cl-id" value="">
      <div class="form-group">
        <label class="form-label" for="cf-cl-name">Caseload name</label>
        <input class="form-input" type="text" id="cf-cl-name" placeholder="e.g. Term 1: SEND and English and maths">
      </div>
      <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <legend style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);padding:0 var(--space-xs);">Areas</legend>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:var(--space-xs);margin-top:var(--space-xs);">
          ${areas.map(a => `
            <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin:0;min-height:32px;font-size:var(--text-xs);">
              <input type="checkbox" class="cf-cl-area" value="${_cfEsc(a.areaCode)}" style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
              <span>${_cfEsc(a.areaCode)} ${_cfEsc(a.areaName || '')}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:150px;">
          <label class="form-label" for="cf-cl-from">From</label>
          <input class="form-input" type="date" id="cf-cl-from">
        </div>
        <div class="form-group" style="flex:1;min-width:150px;">
          <label class="form-label form-label--optional" for="cf-cl-to">To</label>
          <input class="form-input" type="date" id="cf-cl-to">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="cf-cl-why">Why this caseload</label>
        <input class="form-input" type="text" id="cf-cl-why" placeholder="e.g. Greatest need and greatest reach, agreed at September review">
      </div>
      <p id="cf-cl-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-sm);"></p>
      <div class="btn-row">
        <button id="cf-cl-save" type="button" class="btn btn--primary btn--sm">Save caseload</button>
        <button id="cf-cl-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
      </div>
      ${caseloads.length ? `
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-muted);margin:var(--space-md) 0 var(--space-xs);">Existing</p>
        <ul style="list-style:none;margin:0;padding:0;">
          ${caseloads.map(c => `
            <li style="display:flex;gap:var(--space-sm);align-items:baseline;padding:var(--space-xs) 0;border-bottom:1px solid var(--color-border);font-size:var(--text-xs);">
              <span style="flex:1;"><strong>${_cfEsc(c.name)}</strong> \u00b7 ${(c.areaCodes || []).length} areas \u00b7 ${_cfEsc(_cfFmtDate(c.from))}${c.to ? ' to ' + _cfEsc(_cfFmtDate(c.to)) : ' onwards'}</span>
              <button type="button" class="btn btn--ghost btn--sm cf-cl-edit" data-cl="${_cfEsc(c.caseloadId)}" style="min-height:32px;font-size:11px;">Edit<span class="sr-only"> ${_cfEsc(c.name)}</span></button>
            </li>`).join('')}
        </ul>` : ''}
    </div>`;
}

function _cfScopeNote() {
  if (!_cfScope) return 'Counts below cover all areas.';
  const n = (_cfScope.areaCodes || []).length;
  return `Counts below cover ${n} area${n === 1 ? '' : 's'} of ${((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).length}.`;
}

function _cfScopeFor() { return _cfScope; }

// ── Board ────────────────────────────────────────────────────────
// Instruments a focus can gather evidence from. Panels appear when
// something links to them, or while empty when pinned on this focus.
const _CF_INSTRUMENTS = [
  { type:'learning-walk',        label:'Learning Walks' },
  { type:'devobs',               label:'Instructional Coaching' },
  { type:'ppr',                  label:'Programme Performance Reviews' },
  { type:'cqrp',                 label:'Curriculum Quality Review Panels' },
  { type:'qra',                  label:'Quality Review Activity' },
  { type:'peer-review',          label:'Peer Reviews' },
  { type:'self-review',          label:'Self-Reviews' },
  { type:'work-review',          label:'Work Review Panels' },
  { type:'qip-review',           label:'QIP Reviews' },
  { type:'sar-contribution',     label:'SAR Contributions' },
  { type:'securing-improvement', label:'Securing Improvement' },
  { type:'health-check-visit',   label:'Health Check Visits' },
  { type:'coaching',             label:'1:1 Coaching' },
  { type:'teach-meet',           label:'Teach Meets' },
  { type:'cpd-delivered',        label:'CPD Delivered' },
  { type:'digital-lead-meeting', label:'Digital Lead Meetings' },
  { type:'hoa-meeting',          label:'HoA Meetings' },
  { type:'tlam-meeting',         label:'TLAM Meetings' },
  { type:'meeting',              label:'Other Meetings' },
  { type:'referral',             label:'Referrals' },
  { type:'resource-created',     label:'Resources Created' },
  { type:'communication',        label:'Communications' },
];

function _cfScopedLinked(f) {
  const all = typeof getLinkedActivities === 'function'
    ? getLinkedActivities(ACTIVITY_LINK_TYPES.FOCUS, f.focusId) : [];
  if (typeof applyScope !== 'function') return { items: all, total: all.length, scoped: all.length };
  return applyScope(all, _cfScope);
}

function _cfRenderBoard(f) {
  const res  = _cfScopedLinked(f);
  const acts = res.items;
  const prog = typeof getFocusProgress === 'function' ? getFocusProgress(f) : { total:0, complete:0, inProgress:0, atRisk:0 };
  const pinned = f.pinnedInstruments || [];
  const areasReached = new Set(acts.map(a => a.areaCode).filter(Boolean)).size;
  const areaTotal = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).length;

  const stat = (n, of, label, sub) => `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);">
      <p style="font-size:var(--text-xl);font-weight:bold;color:var(--color-navy);line-height:1;">${n}${of ? `<span style="font-size:var(--text-md);color:var(--color-muted);">/${of}</span>` : ''}</p>
      <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-slate);margin-top:var(--space-xs);">${_cfEsc(label)}</p>
      ${sub ? `<p style="font-size:12px;color:var(--color-muted);">${_cfEsc(sub)}</p>` : ''}
    </div>`;

  const msSub = [
    prog.inProgress ? `${prog.inProgress} in progress` : '',
    prog.atRisk ? `${prog.atRisk} at risk` : '',
  ].filter(Boolean).join(', ');

  const counts = {};
  acts.forEach(a => { counts[a.activityType] = (counts[a.activityType] || 0) + 1; });

  const panel = (inst, n, isPinned) => {
    const stream = (typeof ACTIVITY_TYPE_CALENDAR_STREAM !== 'undefined') ? ACTIVITY_TYPE_CALENDAR_STREAM[inst.type] : null;
    const win = stream && typeof getCalendarWindow === 'function' ? getCalendarWindow(stream) : null;
    return `
      <button type="button" class="cf-ev-panel" data-type="${_cfEsc(inst.type)}" data-label="${_cfEsc(inst.label)}"
              style="text-align:left;background:${n ? 'var(--color-white)' : 'var(--color-light)'};border:1px ${n ? 'solid' : 'dashed'} var(--color-border);
                     border-radius:var(--radius-md);padding:var(--space-md);cursor:pointer;min-height:110px;display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:var(--text-xl);font-weight:bold;color:${n ? 'var(--color-navy)' : 'var(--color-muted)'};line-height:1;">${n}</span>
        <span style="font-size:var(--text-xs);font-weight:bold;color:var(--color-slate);">${_cfEsc(inst.label)}</span>
        ${win ? `<span style="font-size:12px;color:var(--color-muted);">${_cfEsc(describeCalendarWindow(win))}</span>` : ''}
        ${isPinned && !n ? '<span style="font-size:11px;color:var(--color-amber);font-weight:bold;">Pinned. Nothing logged yet.</span>' : ''}
      </button>`;
  };

  const visible = _CF_INSTRUMENTS.filter(i => (counts[i.type] || 0) > 0 || pinned.includes(i.type));

  return `
    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Progress at a glance</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-md);margin-bottom:var(--space-lg);">
      ${stat(prog.complete, prog.total, 'Milestones complete', msSub)}
      ${stat(acts.length, null, 'Linked records', res.total !== res.scoped ? `${res.total} before scoping` : '')}
      ${stat(areasReached, areaTotal, 'Areas reached', '')}
      ${stat(Object.keys(counts).length, null, 'Instruments used', '')}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-sm);">
      <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Evidence</h3>
      <button id="cf-pin-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-pin-form">Pin instruments</button>
    </div>

    <div id="cf-pin-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <fieldset style="border:0;">
        <legend style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Pinned instruments stay visible on this focus while empty, with their Quality Calendar window. Use it for the ones you are accountable for.</legend>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:var(--space-xs);">
          ${_CF_INSTRUMENTS.map(i => `
            <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin:0;min-height:32px;font-size:var(--text-xs);">
              <input type="checkbox" class="cf-pin" value="${_cfEsc(i.type)}" ${pinned.includes(i.type) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
              <span>${_cfEsc(i.label)}</span>
            </label>`).join('')}
        </div>
      </fieldset>
    </div>

    ${visible.length === 0
      ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">Nothing linked to this focus yet. Link activity as you log it in Quick Capture, or use Link existing activity on the Evidence tab.</p>'
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:var(--space-md);">
          ${visible.map(i => panel(i, counts[i.type] || 0, pinned.includes(i.type))).join('')}
        </div>`}`;
}

function _cfRenderOverview(f) {
  const fields = ['what','why','how','who','impact'];
  const fieldLabels = { what:'What', why:'Why', how:'How', who:'Who', impact:'Impact' };
  const fieldDesc = {
    what:'What this focus area is',
    why:'Why it is a priority',
    how:'Approach and methods',
    who:'People and areas involved',
    impact:'How impact will be measured and evidenced',
  };
  return `
    ${fields.map(field => f[field] ? `
      <div style="margin-bottom:var(--space-lg);padding-bottom:var(--space-lg);border-bottom:1px solid var(--color-border);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm);">
          <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-teal);color:var(--color-white);padding:2px 10px;border-radius:999px;">${fieldLabels[field]}</span>
          <span style="font-size:var(--text-xs);color:var(--color-muted);">${fieldDesc[field]}</span>
        </div>
        <p style="font-size:var(--text-base);color:var(--color-slate);white-space:pre-wrap;">${_cfEsc(f[field])}</p>
      </div>` : '').join('')}
    ${(f.linkedAreaCodes && f.linkedAreaCodes.length > 0) ? `
      <div>
        <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-muted);margin-bottom:var(--space-sm);">LINKED AREAS</p>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;">
          ${f.linkedAreaCodes.map(c => `<span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:2px 10px;border-radius:999px;">${_cfEsc(c)}</span>`).join('')}
        </div>
      </div>` : ''}`;
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
    pinnedInstruments:existing?.pinnedInstruments||[],
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

// ── Action plan panel ────────────────────────────────────────────
function _cfRenderPlanPanel(f) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);gap:var(--space-md);flex-wrap:wrap;">
      <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Milestones</h3>
      <button id="cf-ms-add-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-ms-form">+ Add milestone</button>
    </div>
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Every part is optional. A milestone can be one line with a date, or carry success criteria and tasks.</p>

    <div id="cf-ms-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <input type="hidden" id="cf-ms-id" value="">
      <div class="form-group">
        <label class="form-label" for="cf-ms-title">Milestone</label>
        <input class="form-input" type="text" id="cf-ms-title" placeholder="e.g. Audit returns above 80 per cent">
      </div>
      <div style="display:flex;gap:var(--space-md);flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:150px;">
          <label class="form-label form-label--optional" for="cf-ms-due">Due date</label>
          <input class="form-input" type="date" id="cf-ms-due">
        </div>
        <div class="form-group" style="flex:1;min-width:150px;">
          <label class="form-label" for="cf-ms-state">State</label>
          <select class="form-select" id="cf-ms-state">
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="at-risk">At risk</option>
            <option value="complete">Complete</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
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

    ${_cfRenderMilestones(f)}`;
}

// ── Evidence panel ───────────────────────────────────────────────
// Either the full linked list, or one instrument drilled into from a
// board panel. Health Check visits additionally offer a cycle filter,
// since that is how audits are actually reviewed.
function _cfRenderEvidencePanel(f) {
  const res  = _cfScopedLinked(f);
  let items  = res.items;
  const view = _cfEvidenceView;

  if (view) items = items.filter(a => a.activityType === view.type);

  const cycles = _cfHealthCheckCycles();
  const showCycle = view && view.type === 'health-check-visit' && cycles.length > 0;
  if (showCycle && _cfEvidenceCycle) {
    items = items.filter(a => _cfActivityCycle(a) === _cfEvidenceCycle);
  }

  const stream = view && typeof ACTIVITY_TYPE_CALENDAR_STREAM !== 'undefined'
    ? ACTIVITY_TYPE_CALENDAR_STREAM[view.type] : null;
  const win = stream && typeof getCalendarWindow === 'function' ? getCalendarWindow(stream) : null;

  const denom = res.total !== res.scoped
    ? `${items.length} of ${res.total} linked records, after scoping to ${_cfEsc(res.scopeLabel)}.`
    : `${items.length} of ${res.total} linked records.`;

  return `
    ${view ? `
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:var(--space-sm);">
        <button id="cf-ev-back" type="button" class="btn btn--ghost btn--sm">\u2190 All evidence</button>
        <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${_cfEsc(view.label)}</h3>
      </div>
      ${win ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Quality Calendar: ${_cfEsc(describeCalendarWindow(win))}</p>` : ''}
      ${showCycle ? `
        <div class="form-group" style="max-width:320px;">
          <label class="form-label" for="cf-ev-cycle">Cycle</label>
          <select class="form-select" id="cf-ev-cycle">
            <option value="">All cycles</option>
            ${cycles.map(c => `<option value="${_cfEsc(c.id)}" ${_cfEvidenceCycle === c.id ? 'selected' : ''}>${_cfEsc(c.label)}${c.upcoming ? ' (opens ' + _cfEsc(_cfFmtDate(c.opens)) + ')' : ''}</option>`).join('')}
          </select>
        </div>` : ''}
    ` : `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-sm);">
        <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Linked activity</h3>
        <button id="cf-retro-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-retro-form">Link existing activity</button>
      </div>`}

    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">${denom}</p>

    <div id="cf-retro-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
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

    ${typeof renderLinkedActivityList === 'function'
      ? renderLinkedActivityList(items, {
          heading:   '',
          headingId: 'cf-linked-activity',
          emptyMsg:  view
            ? 'Nothing logged against this instrument for this focus yet.'
            : 'No activity linked to this focus yet. Tick it in the "Link to" panel when you log an activity in Quick Capture.'
        })
      : ''}

    <section style="margin-top:var(--space-lg);" aria-labelledby="cf-resources-heading">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);gap:var(--space-md);flex-wrap:wrap;">
        <h3 id="cf-resources-heading" style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Resources</h3>
        <button id="cf-res-add-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="cf-res-form">+ Add resource</button>
      </div>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">Documents and links this focus is built on. Everything is a link. For a file, paste its OneDrive or SharePoint address.</p>

      <div id="cf-res-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <div class="form-group">
          <label class="form-label" for="cf-res-pick">Resource</label>
          <select class="form-select" id="cf-res-pick">
            <option value="__new__">Paste a new link\u2026</option>
            ${typeof renderLibraryOptionsHtml === 'function' ? renderLibraryOptionsHtml() : ''}
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

      ${typeof getFocusResources === 'function' && typeof renderResourceList === 'function'
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
    </section>`;
}

// Cycles that exist in the Health Check data, plus any window still to
// open. An upcoming cycle shows as scheduled rather than as zero, because
// "0" next to November in September reads as a failure rather than a date.
function _cfHealthCheckCycles() {
  const reviews = (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [];
  const seen = new Map();
  reviews.forEach(r => {
    if (!r.cycleId || seen.has(r.cycleId)) return;
    seen.set(r.cycleId, {
      id: r.cycleId,
      label: typeof _hcCycleLabel === 'function' ? _hcCycleLabel(r.cycleId) : r.cycleId,
      upcoming: false,
    });
  });
  return Array.from(seen.values());
}

function _cfActivityCycle(a) {
  const link = (a.links || []).find(l => l && l.type === ACTIVITY_LINK_TYPES.HEALTH_CHECK);
  if (!link) return '';
  const rev = ((window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [])
    .find(r => r.reviewId === link.id);
  return rev ? (rev.cycleId || '') : '';
}

// ── Tabs, scope and board wiring ─────────────────────────────────
function _wireCFTabs(focusId) {
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.cf-tab'));
  const go = (id) => { _cfTab = id; _openCFDetail(focusId); document.getElementById('cf-tab-' + id)?.focus(); };
  tabs.forEach(function(t, i) {
    t.addEventListener('click', () => go(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(tabs[(i + 1) % tabs.length].dataset.tab); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); go(tabs[(i - 1 + tabs.length) % tabs.length].dataset.tab); }
      if (e.key === 'Home')       { e.preventDefault(); go(tabs[0].dataset.tab); }
      if (e.key === 'End')        { e.preventDefault(); go(tabs[tabs.length - 1].dataset.tab); }
    });
  });
}

function _wireCFScope(focusId) {
  document.getElementById('cf-scope')?.addEventListener('change', function() {
    const v = this.value;
    if (!v) _cfScope = null;
    else if (v.indexOf('c:') === 0) {
      const c = typeof getCaseload === 'function' ? getCaseload(v.slice(2)) : null;
      _cfScope = c ? { caseloadId: c.caseloadId, name: c.name, areaCodes: c.areaCodes || [] } : null;
    } else {
      _cfScope = { areaCodes: [v.slice(2)], name: v.slice(2) };
    }
    _openCFDetail(focusId);
  });

  const form = document.getElementById('cf-caseload-form');
  const btn  = document.getElementById('cf-caseload-btn');
  if (form && btn) {
    const setOpen = (open) => {
      form.style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) document.getElementById('cf-cl-name').focus();
    };
    btn.addEventListener('click', () => setOpen(form.style.display === 'none'));
    document.getElementById('cf-cl-cancel')?.addEventListener('click', () => { _cfResetCaseloadForm(); setOpen(false); btn.focus(); });
    document.getElementById('cf-cl-save')?.addEventListener('click', () => _cfSaveCaseload(focusId));
    document.querySelectorAll('.cf-cl-edit').forEach(b => {
      b.addEventListener('click', () => { _cfFillCaseloadForm(b.dataset.cl); setOpen(true); });
    });
  }
}

function _cfResetCaseloadForm() {
  ['cf-cl-id','cf-cl-name','cf-cl-from','cf-cl-to','cf-cl-why'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('.cf-cl-area').forEach(cb => { cb.checked = false; });
  const err = document.getElementById('cf-cl-error'); if (err) err.style.display = 'none';
}

function _cfFillCaseloadForm(caseloadId) {
  const c = typeof getCaseload === 'function' ? getCaseload(caseloadId) : null;
  if (!c) return;
  document.getElementById('cf-cl-id').value   = c.caseloadId;
  document.getElementById('cf-cl-name').value = c.name || '';
  document.getElementById('cf-cl-from').value = c.from || '';
  document.getElementById('cf-cl-to').value   = c.to || '';
  document.getElementById('cf-cl-why').value  = c.rationale || '';
  document.querySelectorAll('.cf-cl-area').forEach(cb => { cb.checked = (c.areaCodes || []).includes(cb.value); });
}

function _cfSaveCaseload(focusId) {
  const err  = document.getElementById('cf-cl-error');
  const fail = (m, el) => { if (err) { err.textContent = m; err.style.display = 'block'; } el?.focus(); };
  const name = document.getElementById('cf-cl-name').value.trim();
  if (!name) return fail('Please name the caseload, so the report can state what it is scoped to.', document.getElementById('cf-cl-name'));
  const codes = Array.prototype.map.call(document.querySelectorAll('.cf-cl-area:checked'), cb => cb.value);
  if (codes.length === 0) return fail('Select at least one area.', document.querySelector('.cf-cl-area'));

  const from = document.getElementById('cf-cl-from').value || todayISO();
  const to   = document.getElementById('cf-cl-to').value || null;
  if (to && to < from) return fail('The end date is before the start date.', document.getElementById('cf-cl-to'));

  const id = document.getElementById('cf-cl-id').value;
  const existing = id && typeof getCaseload === 'function' ? getCaseload(id) : null;
  const rec = makeCaseload({
    caseloadId: existing ? existing.caseloadId : undefined,
    name, areaCodes: codes, from, to,
    rationale: document.getElementById('cf-cl-why').value.trim(),
    staffIds: existing ? existing.staffIds : [],
  });
  if (existing) rec.createdAt = existing.createdAt;
  saveCaseload(rec);
  _cfResetCaseloadForm();
  _openCFDetail(focusId);
  const st = document.getElementById('cf-ms-status');
  if (st) st.textContent = `Caseload saved: ${rec.name}, ${codes.length} areas.`;
}

function _wireCFBoardEvents(focusId) {
  document.querySelectorAll('.cf-ev-panel').forEach(b => {
    b.addEventListener('click', () => {
      _cfEvidenceView  = { type: b.dataset.type, label: b.dataset.label };
      _cfEvidenceCycle = '';
      _cfTab = 'evidence';
      _openCFDetail(focusId);
    });
  });

  const form = document.getElementById('cf-pin-form');
  const btn  = document.getElementById('cf-pin-btn');
  if (form && btn) {
    btn.addEventListener('click', () => {
      const open = form.style.display === 'none';
      form.style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.cf-pin').forEach(cb => {
      cb.addEventListener('change', () => {
        const focus = _getAllFocuses().find(x => x.focusId === focusId);
        if (!focus) return;
        focus.pinnedInstruments = Array.prototype.map.call(document.querySelectorAll('.cf-pin:checked'), x => x.value);
        if (typeof saveCurrentFocus === 'function') saveCurrentFocus(focus);
        _openCFDetail(focusId);
        document.getElementById('cf-pin-btn')?.click();
      });
    });
  }
}

function _wireCFEvidenceEvents(focusId) {
  document.getElementById('cf-ev-back')?.addEventListener('click', () => {
    _cfEvidenceView = null; _cfEvidenceCycle = '';
    _openCFDetail(focusId);
  });
  document.getElementById('cf-ev-cycle')?.addEventListener('change', function() {
    _cfEvidenceCycle = this.value;
    _openCFDetail(focusId);
  });
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
