// DPC Hub · js/afi.js · v1.0 · July 2026
// AFI (Loop) lifecycle module. List view, status transitions, evidence chain,
// action selection panel. Reads from window.DPC_DATA.afi via data.js globals.

// ── Module state ──────────────────────────────────────────────
let _afiFilterStatus  = '';
let _afiFilterArea    = '';
let _afiFilterSev     = '';
let _afiSearch        = '';
let _afiCurrentId     = null;

function initAFIs() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Loops</h1>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:center;">
        <select id="afi-filter-status" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="impact-checked">Impact checked</option>
          <option value="closed">Closed</option>
          <option value="re-opened">Re-opened</option>
        </select>
        <select id="afi-filter-area" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by area">
          <option value="">All areas</option>
        </select>
        <select id="afi-filter-sev" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="${AFI_SEVERITY.STRENGTH}">Strength</option>
          <option value="${AFI_SEVERITY.STRENGTHEN}">Areas to Strengthen</option>
          <option value="${AFI_SEVERITY.IMMEDIATE}">Immediate Improvement</option>
        </select>
        <input id="afi-search" class="form-input" type="search" placeholder="Search loops…" style="width:180px;min-height:40px;font-size:var(--text-sm);" aria-label="Search AFIs">
      </div>
    </div>

    <!-- Summary metrics -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg);" aria-label="Loop summary counts">
      ${[
        { label:'Open',           key:'open',           col:'var(--color-amber)' },
        { label:'Actioned',       key:'actioned',       col:'var(--color-blue)' },
        { label:'Impact checked', key:'impact-checked', col:'var(--color-purple)' },
        { label:'Closed',         key:'closed',         col:'var(--color-green)' },
        { label:'Re-opened',      key:'re-opened',      col:'var(--color-rose)' },
      ].map(m => `
        <button type="button" data-status="${m.key}" class="afi-metric-btn" style="
          background:var(--color-white);border:2px solid var(--color-border);
          border-radius:var(--radius-md);padding:var(--space-md);text-align:center;
          cursor:pointer;transition:all 150ms;
        " aria-label="Filter by ${m.label}">
          <div id="afi-count-${m.key}" style="font-size:var(--text-2xl);font-weight:bold;color:${m.col};">0</div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);">${m.label}</div>
        </button>`).join('')}
    </div>

    <!-- Two-column layout: list + detail -->
    <div style="display:grid;grid-template-columns:1fr 480px;gap:var(--space-xl);align-items:start;" id="afi-layout">
      <div>
        <div id="afi-list" aria-label="AFI loops list" role="list"></div>
        <p id="afi-empty" style="display:none;color:var(--color-muted);font-size:var(--text-base);padding:var(--space-xl);text-align:center;">No loops match your filters.</p>
      </div>
      <div id="afi-detail-panel" style="display:none;position:sticky;top:calc(var(--nav-height) + var(--space-lg));background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);max-height:80vh;overflow-y:auto;"></div>
    </div>
  `;

  _afiPopulateAreaFilter();
  _afiRenderMetrics();
  _afiRenderList();
  _wireAFIEvents();
}

// ── Metrics ───────────────────────────────────────────────────
function _afiRenderMetrics() {
  const afis = _getAFIs();
  ['open','actioned','impact-checked','closed','re-opened'].forEach(status => {
    const el = document.getElementById(`afi-count-${status}`);
    if (el) el.textContent = afis.filter(a => a.status === status).length;
  });
}

// ── AFI list ──────────────────────────────────────────────────
function _afiRenderList() {
  const list  = document.getElementById('afi-list');
  const empty = document.getElementById('afi-empty');
  if (!list) return;

  let afis = _getAFIs();
  if (_afiFilterStatus) afis = afis.filter(a => a.status === _afiFilterStatus);
  if (_afiFilterArea)   afis = afis.filter(a => a.areaCode === _afiFilterArea);
  if (_afiFilterSev)    afis = afis.filter(a => a.severity === _afiFilterSev);
  if (_afiSearch)       afis = afis.filter(a =>
    (a.description||'').toLowerCase().includes(_afiSearch) ||
    (a.lraThemeLabel||'').toLowerCase().includes(_afiSearch) ||
    (a.areaCode||'').toLowerCase().includes(_afiSearch)
  );

  // Sort: immediate first, then strengthen, then strength; within each by date desc
  const sevOrder = { [AFI_SEVERITY.IMMEDIATE]:0, [AFI_SEVERITY.STRENGTHEN]:1, [AFI_SEVERITY.STRENGTH]:2 };
  afis.sort((a,b) => {
    const so = (sevOrder[a.severity]||1) - (sevOrder[b.severity]||1);
    if (so !== 0) return so;
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });

  list.innerHTML = '';

  if (afis.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  afis.forEach(afi => {
    const row = _buildAFIRow(afi);
    list.appendChild(row);
  });
}

function _buildAFIRow(afi) {
  const sevCol = {
    [AFI_SEVERITY.IMMEDIATE]:  { bg:'var(--color-red-lt)',    text:'var(--color-red)' },
    [AFI_SEVERITY.STRENGTHEN]: { bg:'var(--color-amber-lt)', text:'var(--color-amber)' },
    [AFI_SEVERITY.STRENGTH]:   { bg:'var(--color-green-lt)', text:'var(--color-green)' },
  }[afi.severity] || { bg:'var(--color-light)', text:'var(--color-muted)' };

  const statusBadge = {
    'open':           { bg:'var(--color-amber-lt)',  text:'var(--color-amber)',  label:'Open' },
    'actioned':       { bg:'var(--color-blue-lt)',   text:'var(--color-blue)',   label:'Actioned' },
    'impact-checked': { bg:'var(--color-purple-lt)', text:'var(--color-purple)', label:'Impact checked' },
    'closed':         { bg:'var(--color-green-lt)',  text:'var(--color-green)',  label:'Closed' },
    're-opened':      { bg:'var(--color-rose-lt)',   text:'var(--color-rose)',   label:'Re-opened' },
  }[afi.status] || { bg:'var(--color-light)', text:'var(--color-muted)', label:afi.status };

  const evidenceCount = (afi.evidenceChain||[]).length;
  const isActive = _afiCurrentId === afi.afiId;

  const row = document.createElement('div');
  row.role = 'listitem';
  row.dataset.afiId = afi.afiId;
  row.setAttribute('tabindex','0');
  row.style.cssText = `
    display:flex;gap:var(--space-md);align-items:flex-start;
    padding:var(--space-md);border-radius:var(--radius-md);
    border:2px solid ${isActive?'var(--color-teal)':'var(--color-border)'};
    background:${isActive?'var(--color-teal-lt)':'var(--color-white)'};
    cursor:pointer;margin-bottom:var(--space-sm);
    transition:all 150ms;
  `;

  row.innerHTML = `
    <div style="flex-shrink:0;padding-top:2px;">
      <span style="display:block;width:10px;height:10px;border-radius:50%;background:${sevCol.text};margin-bottom:4px;" aria-label="${afi.severity}"></span>
    </div>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:4px;">
        <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 8px;border-radius:999px;">${_afiEsc(afi.areaCode)}</span>
        <span style="font-size:var(--text-xs);font-weight:bold;background:${statusBadge.bg};color:${statusBadge.text};padding:1px 8px;border-radius:999px;">${statusBadge.label}</span>
        ${afi.hyperThemeMatch ? `<span style="font-size:10px;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;font-weight:bold;">${afi.hyperThemeMatch}</span>` : ''}
      </div>
      <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin-bottom:2px;">${_afiEsc(afi.lraThemeLabel||afi.lraThemeId)}</p>
      <p style="font-size:var(--text-xs);color:var(--color-muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${_afiEsc(afi.description||'')}</p>
    </div>
    <div style="flex-shrink:0;text-align:right;">
      ${evidenceCount > 0 ? `<span style="font-size:var(--text-xs);color:var(--color-teal);">${evidenceCount} evidence</span>` : ''}
      <p style="font-size:var(--text-xs);color:var(--color-muted);">${_afiFmtDate(afi.createdAt)}</p>
    </div>
  `;

  row.addEventListener('click', () => _openAFIDetail(afi.afiId));
  row.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); _openAFIDetail(afi.afiId); } });
  return row;
}

// ── AFI detail panel ──────────────────────────────────────────
function _openAFIDetail(afiId) {
  _afiCurrentId = afiId;
  _afiRenderList(); // re-render to show active state
  const panel = document.getElementById('afi-detail-panel');
  if (!panel) return;
  panel.style.display = 'block';

  const afi = _getAFIs().find(a => a.afiId === afiId);
  if (!afi) return;

  const sevCol = {
    [AFI_SEVERITY.IMMEDIATE]:  'var(--color-red)',
    [AFI_SEVERITY.STRENGTHEN]: 'var(--color-amber)',
    [AFI_SEVERITY.STRENGTH]:   'var(--color-green)',
  }[afi.severity] || 'var(--color-muted)';

  panel.innerHTML = `
    <div style="margin-bottom:var(--space-lg);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-sm);">
        <span style="font-size:var(--text-xs);font-weight:bold;color:${sevCol};">${_afiEsc(afi.severity)}</span>
        <button type="button" id="afi-detail-close" aria-label="Close detail panel" style="background:none;border:none;cursor:pointer;color:var(--color-muted);font-size:20px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
      </div>
      <h3 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">${_afiEsc(afi.lraThemeLabel||afi.lraThemeId)}</h3>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">${_afiEsc(afi.areaCode)} · Created ${_afiFmtDate(afi.createdAt)}</p>
      <p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-md);">${_afiEsc(afi.description)}</p>
      ${afi.digitalOpportunity ? `
        <div style="background:var(--color-teal-lt);border-radius:var(--radius-sm);padding:var(--space-sm);font-size:var(--text-xs);color:var(--color-teal);margin-bottom:var(--space-md);">
          <strong>Digital opportunity:</strong> ${_afiEsc(afi.digitalOpportunity)}
        </div>` : ''}
    </div>

    <!-- Status selector -->
    <div style="margin-bottom:var(--space-lg);">
      <label class="form-label" for="afi-status-sel">Status</label>
      <select id="afi-status-sel" class="form-select" style="margin-bottom:var(--space-sm);">
        ${['open','actioned','impact-checked','closed','re-opened'].map(s => `
          <option value="${s}" ${afi.status===s?'selected':''}>${{open:'Open',actioned:'Actioned','impact-checked':'Impact checked',closed:'Closed','re-opened':'Re-opened'}[s]}</option>`).join('')}
      </select>
      <button id="afi-status-update" type="button" class="btn btn--primary btn--sm">Update status</button>
    </div>

    <!-- Action selection -->
    <div style="margin-bottom:var(--space-lg);">
      <h4 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Add intervention</h4>
      <div style="display:flex;flex-direction:column;gap:var(--space-xs);">
        ${[
          { type:'coaching',          label:'📋 Book Coaching Session',       col:'var(--color-blue)' },
          { type:'teach-meet',        label:'👥 Plan Teach Meet',             col:'var(--color-purple)' },
          { type:'linkedin-pathway',  label:'🔗 Assign LinkedIn Pathway',     col:'var(--color-teal)' },
          { type:'resource',          label:'📄 Share Resource',              col:'var(--color-green)' },
          { type:'training-programme',label:'🎓 Refer to Training Programme', col:'var(--color-amber)' },
        ].map(a => `
          <button type="button" class="afi-action-btn" data-action-type="${a.type}" style="
            text-align:left;padding:var(--space-sm) var(--space-md);
            border:1px solid var(--color-border);border-radius:var(--radius-sm);
            background:var(--color-white);cursor:pointer;font-size:var(--text-sm);
            color:var(--color-slate);transition:all 150ms;min-height:44px;
          ">${a.label}</button>`).join('')}
      </div>
    </div>

    <!-- Evidence chain -->
    <div style="margin-bottom:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);">
        <h4 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">Evidence chain</h4>
        <button id="afi-add-evidence" type="button" class="btn btn--ghost btn--sm">+ Add evidence</button>
      </div>
      <div id="afi-evidence-list">
        ${(afi.evidenceChain||[]).length === 0
          ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">No evidence recorded yet.</p>'
          : (afi.evidenceChain||[]).map(ev => `
            <div style="padding:var(--space-sm);border-left:3px solid var(--color-teal);margin-bottom:var(--space-sm);background:var(--color-light);border-radius:0 var(--radius-sm) var(--radius-sm) 0;">
              <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:2px;">
                <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;">${_afiEsc(ev.evidenceType)}</span>
                <span style="font-size:var(--text-xs);color:var(--color-muted);">${_afiFmtDate(ev.date)}</span>
              </div>
              <p style="font-size:var(--text-sm);color:var(--color-slate);">${_afiEsc(ev.summary)}</p>
            </div>`).join('')
        }
      </div>
    </div>

    <!-- Add evidence form (hidden by default) -->
    <div id="afi-evidence-form" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <h4 style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Add evidence entry</h4>
      <div class="form-group">
        <label class="form-label" for="afi-ev-type">Evidence type</label>
        <select class="form-select" id="afi-ev-type">
          <option value="devobs">DevObs</option>
          <option value="learning-walk">Learning Walk</option>
          <option value="reflection-immediate">Reflection (immediate)</option>
          <option value="reflection-follow-up">Reflection (follow-up)</option>
          <option value="health-check-score">Health Check score</option>
          <option value="data-point">Data point</option>
          <option value="staff-voice">Staff voice</option>
          <option value="coaching-note">Coaching note</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="afi-ev-summary">Summary</label>
        <textarea class="form-textarea" id="afi-ev-summary" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="afi-ev-movement">Loop movement</label>
        <select class="form-select" id="afi-ev-movement">
          <option value="progresses">Progresses</option>
          <option value="closes">Closes loop</option>
          <option value="re-opens">Re-opens loop</option>
          <option value="opens">Opens new thread</option>
        </select>
      </div>
      <div class="btn-row">
        <button id="afi-ev-save" type="button" class="btn btn--primary btn--sm">Save evidence</button>
        <button id="afi-ev-cancel" type="button" class="btn btn--secondary btn--sm">Cancel</button>
      </div>
    </div>
  `;

  // Wire detail panel events
  document.getElementById('afi-detail-close')?.addEventListener('click', () => {
    _afiCurrentId = null;
    document.getElementById('afi-detail-panel').style.display = 'none';
    _afiRenderList();
  });

  document.getElementById('afi-status-update')?.addEventListener('click', () => {
    const newStatus = document.getElementById('afi-status-sel').value;
    _updateAFIStatus(afiId, newStatus);
  });

  document.querySelectorAll('.afi-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _logAFIAction(afiId, btn.dataset.actionType);
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--color-light)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--color-white)'; });
  });

  document.getElementById('afi-add-evidence')?.addEventListener('click', () => {
    const form = document.getElementById('afi-evidence-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('afi-ev-cancel')?.addEventListener('click', () => {
    document.getElementById('afi-evidence-form').style.display = 'none';
  });

  document.getElementById('afi-ev-save')?.addEventListener('click', () => {
    const summary  = document.getElementById('afi-ev-summary').value.trim();
    const type     = document.getElementById('afi-ev-type').value;
    const movement = document.getElementById('afi-ev-movement').value;
    if (!summary) return;

    const evidence = {
      evidenceId:   generateId(),
      evidenceType: type,
      date:         todayISO(),
      summary,
      sourceId:     null,
      loopMovement: movement,
    };

    const afis = _getAFIs();
    const idx  = afis.findIndex(a => a.afiId === afiId);
    if (idx >= 0) {
      if (!afis[idx].evidenceChain) afis[idx].evidenceChain = [];
      afis[idx].evidenceChain.push(evidence);
      afis[idx].lastUpdated = nowISO();
      // If movement = closes, update status
      if (movement === 'closes') afis[idx].status = AFI_STATUS.CLOSED;
      if (movement === 're-opens') afis[idx].status = AFI_STATUS.REOPENED;
      window.DPC_DATA.afi.afis = afis;
      saveAFI(afis[idx]);
    }

    _afiRenderMetrics();
    _openAFIDetail(afiId); // refresh panel
    if (typeof UI !== 'undefined') UI.showToast('success', 'Evidence added.');
  });
}

function _updateAFIStatus(afiId, newStatus) {
  const afis = _getAFIs();
  const idx  = afis.findIndex(a => a.afiId === afiId);
  if (idx < 0) return;
  afis[idx].status      = newStatus;
  afis[idx].lastUpdated = nowISO();
  if (newStatus === AFI_STATUS.CLOSED) afis[idx].closedAt = nowISO();
  window.DPC_DATA.afi.afis = afis;
  saveAFI(afis[idx]);
  _afiRenderMetrics();
  _afiRenderList();
  _openAFIDetail(afiId);
  if (typeof UI !== 'undefined') UI.showToast('success', `Loop status updated to: ${newStatus}`);
}

function _logAFIAction(afiId, actionType) {
  const afis = _getAFIs();
  const idx  = afis.findIndex(a => a.afiId === afiId);
  if (idx < 0) return;

  const action = {
    actionId:         generateId(),
    actionType,
    description:      `${actionType} initiated`,
    linkedTemplateId: null,
    linkedResourceId: null,
    linkedPathwayUrl: null,
    targetDate:       null,
    completedAt:      null,
    kpiTag:           null,
  };

  if (!afis[idx].linkedActions) afis[idx].linkedActions = [];
  afis[idx].linkedActions.push(action);
  if (afis[idx].status === AFI_STATUS.OPEN) afis[idx].status = AFI_STATUS.ACTIONED;
  afis[idx].lastUpdated = nowISO();
  window.DPC_DATA.afi.afis = afis;
  saveAFI(afis[idx]);

  _afiRenderMetrics();
  _afiRenderList();
  _openAFIDetail(afiId);
  if (typeof UI !== 'undefined') UI.showToast('success', `Action logged: ${actionType}. Loop status → Actioned.`);
}

// ── Wire events ───────────────────────────────────────────────
function _wireAFIEvents() {
  document.getElementById('afi-filter-status')?.addEventListener('change', e => { _afiFilterStatus = e.target.value; _afiRenderList(); });
  document.getElementById('afi-filter-area')?.addEventListener('change',   e => { _afiFilterArea   = e.target.value; _afiRenderList(); });
  document.getElementById('afi-filter-sev')?.addEventListener('change',    e => { _afiFilterSev    = e.target.value; _afiRenderList(); });
  document.getElementById('afi-search')?.addEventListener('input', e => { _afiSearch = e.target.value.toLowerCase().trim(); _afiRenderList(); });

  // Metric buttons — click to filter by status
  document.querySelectorAll('.afi-metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      _afiFilterStatus = _afiFilterStatus === status ? '' : status;
      const sel = document.getElementById('afi-filter-status');
      if (sel) sel.value = _afiFilterStatus;
      _afiRenderList();
    });
  });
}

function _afiPopulateAreaFilter() {
  const sel = document.getElementById('afi-filter-area');
  if (!sel) return;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.sort((a,b) => a.areaCode.localeCompare(b.areaCode)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAFIs() { return (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []; }
function _afiFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
  catch { return iso; }
}
function _afiEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
