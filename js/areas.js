// DPC Hub · js/areas.js · v1.0 · July 2026
// Areas module. 35-area overview grid, area detail view with tabs.
// Reads from window.DPC_DATA.areas via data.js globals.

// ── Module state ──────────────────────────────────────────────
let _areasCurrentArea = null;  // areaCode of open detail view
let _areasDetailTab   = 'overview';

function initAreas() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Areas</h1>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:center;">
        <label for="areas-filter-campus" class="sr-only">Filter by campus</label>
        <select id="areas-filter-campus" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by campus">
          <option value="">All campuses</option>
        </select>
        <label for="areas-filter-pyramid" class="sr-only">Filter by pyramid level</label>
        <select id="areas-filter-pyramid" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by pyramid level">
          <option value="">All levels</option>
          <option value="foundations">Foundations</option>
          <option value="inclusion">Inclusion</option>
          <option value="innovation">Innovation</option>
        </select>
        <label for="areas-search" class="sr-only">Search areas</label>
        <input id="areas-search" class="form-input" type="search" placeholder="Search areas…" style="width:200px;min-height:40px;font-size:var(--text-sm);" aria-label="Search areas by name or code">
      </div>
    </div>
    <div id="areas-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-md);" aria-label="Curriculum areas"></div>
    <p id="areas-empty" style="display:none;color:var(--color-muted);font-size:var(--text-base);padding:var(--space-2xl);text-align:center;">No areas match your search.</p>

    <!-- Area detail panel (slides over grid) -->
    <div id="area-detail" style="display:none;">
      <button id="area-detail-back" type="button" class="btn btn--ghost btn--sm" style="margin-bottom:var(--space-lg);">← Back to Areas</button>
      <div id="area-detail-content"></div>
    </div>
  `;

  _populateCampusFilter();
  _renderAreasGrid();
  _wireAreasEvents();
}

// ── Populate campus filter ────────────────────────────────────
function _populateCampusFilter() {
  const sel = document.getElementById('areas-filter-campus');
  if (!sel) return;
  const areas = _getAreas();
  const campuses = [...new Set(areas.map(a => a.campus).filter(Boolean))].sort();
  campuses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ── Areas grid ────────────────────────────────────────────────
function _renderAreasGrid() {
  const grid  = document.getElementById('areas-grid');
  const empty = document.getElementById('areas-empty');
  const detail= document.getElementById('area-detail');
  if (!grid) return;

  grid.style.display = 'grid';
  if (detail) detail.style.display = 'none';

  const campus  = document.getElementById('areas-filter-campus')?.value || '';
  const pyramid = document.getElementById('areas-filter-pyramid')?.value || '';
  const search  = (document.getElementById('areas-search')?.value || '').toLowerCase().trim();

  let areas = _getAreas();
  if (campus)  areas = areas.filter(a => a.campus === campus);
  if (pyramid) areas = areas.filter(a => a.pyramidLevel === pyramid);
  if (search)  areas = areas.filter(a =>
    a.areaCode.toLowerCase().includes(search) ||
    a.areaName.toLowerCase().includes(search)
  );

  grid.innerHTML = '';

  if (areas.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  areas.forEach(area => {
    const card = _buildAreaCard(area);
    grid.appendChild(card);
  });
}

function _buildAreaCard(area) {
  const ragSummary = _buildRagDots(area);
  const openAFIs   = _getAreaOpenAFIs(area.areaCode);
  const lastAct    = _getAreaLastActivity(area.areaCode);
  const pyramid    = area.pyramidLevel || 'foundations';
  const pyramidColour = { foundations:'var(--color-blue)', inclusion:'var(--color-purple)', innovation:'var(--color-green)' }[pyramid] || 'var(--color-muted)';
  const pyramidLabel  = { foundations:'Foundations', inclusion:'Inclusion', innovation:'Innovation' }[pyramid] || pyramid;

  const card = document.createElement('article');
  card.className = 'card card--clickable';
  card.setAttribute('tabindex','0');
  card.setAttribute('role','button');
  card.setAttribute('aria-label',`${area.areaName} — ${pyramidLabel}. ${openAFIs} open loops.`);
  card.dataset.areaCode = area.areaCode;

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-sm);">
      <span style="font-size:var(--text-xs);font-weight:var(--font-bold);background:var(--color-navy);color:var(--color-white);padding:2px 8px;border-radius:999px;">${_escHtml(area.areaCode)}</span>
      <span style="font-size:var(--text-xs);font-weight:var(--font-bold);color:${pyramidColour};">${pyramidLabel}</span>
    </div>
    <h2 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);line-height:1.3;">${_escHtml(area.areaName)}</h2>
    ${area.hoaName ? `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">${_escHtml(area.hoaName)}</p>` : ''}
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:var(--space-sm);" aria-label="RAG dimension scores">${ragSummary}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;">
      ${lastAct ? `<span style="font-size:var(--text-xs);color:var(--color-muted);">Last: ${_formatDateShort(lastAct)}</span>` : '<span></span>'}
      ${openAFIs > 0 ? `<span style="font-size:var(--text-xs);font-weight:var(--font-bold);background:var(--color-amber-lt);color:var(--color-amber);padding:2px 8px;border-radius:999px;" aria-label="${openAFIs} open loops">${openAFIs} open loop${openAFIs !== 1 ? 's' : ''}</span>` : ''}
    </div>
  `;

  card.addEventListener('click',  () => _openAreaDetail(area.areaCode));
  card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); _openAreaDetail(area.areaCode); } });
  return card;
}

function _buildRagDots(area) {
  const dims = area.ragDimensions || {};
  return RAG_DIMENSIONS.map(dim => {
    const d = dims[dim.id];
    const score = d && d.score ? d.score : null;
    const colour = score ? ['','var(--color-red)','var(--color-amber)','var(--color-amber)','var(--color-green)','var(--color-green)'][score] : 'var(--color-border)';
    const label = score ? `${dim.label}: ${RAG_LABELS[score]}` : `${dim.label}: Not scored`;
    return `<span style="width:10px;height:10px;border-radius:50%;background:${colour};flex-shrink:0;" aria-label="${label}" title="${label}"></span>`;
  }).join('');
}

// ── Area detail ───────────────────────────────────────────────
function _openAreaDetail(areaCode) {
  _areasCurrentArea = areaCode;
  _areasDetailTab   = 'overview';
  const grid   = document.getElementById('areas-grid');
  const detail = document.getElementById('area-detail');
  const empty  = document.getElementById('areas-empty');
  const filters= document.querySelector('[style*="display:flex;align-items:center;justify-content:space-between"]');

  if (grid)  grid.style.display   = 'none';
  if (empty) empty.style.display  = 'none';
  if (detail) detail.style.display = 'block';

  _renderAreaDetail(areaCode);
}

function _renderAreaDetail(areaCode) {
  const area = _getArea(areaCode);
  if (!area) return;

  const content = document.getElementById('area-detail-content');
  if (!content) return;

  const openAFIs = _getAreaOpenAFIs(areaCode);
  const pyramid  = area.pyramidLevel || 'foundations';
  const pyramidLabel = { foundations:'Foundations', inclusion:'Inclusion', innovation:'Innovation' }[pyramid] || pyramid;

  content.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);">
          <span style="font-size:var(--text-sm);font-weight:var(--font-bold);background:var(--color-navy);color:var(--color-white);padding:3px 10px;border-radius:999px;">${_escHtml(area.areaCode)}</span>
        </div>
        <h2 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">${_escHtml(area.areaName)}</h2>
      </div>
    </div>

    <!-- Tabs -->
    <div role="tablist" aria-label="Area sections" style="display:flex;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-lg);gap:0;">
      ${['overview','rag','activity','staff'].map(tab => `
        <button role="tab" type="button" id="tab-${tab}" data-tab="${tab}"
          aria-selected="${tab==='overview'?'true':'false'}"
          style="padding:10px 20px;border:none;border-bottom:3px solid ${tab==='overview'?'var(--color-teal)':'transparent'};
          background:none;cursor:pointer;font:${tab==='overview'?'bold':''} var(--text-base) Arial,sans-serif;
          color:${tab==='overview'?'var(--color-teal)':'var(--color-muted)'};min-height:44px;white-space:nowrap;">
          ${{overview:'Overview',rag:'RAG Matrix',activity:'Activity Log',staff:'Staff'}[tab]}
        </button>`).join('')}
    </div>

    <!-- Tab panels -->
    <div id="area-tab-panel" role="tabpanel" aria-labelledby="tab-overview"></div>
  `;

  _renderAreaTab('overview', areaCode);
  _wireAreaDetailTabs(areaCode);
}

function _wireAreaDetailTabs(areaCode) {
  document.querySelectorAll('[role="tab"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      _areasDetailTab = tab;
      document.querySelectorAll('[role="tab"]').forEach(b => {
        const active = b.dataset.tab === tab;
        b.setAttribute('aria-selected', active ? 'true' : 'false');
        b.style.borderBottomColor = active ? 'var(--color-teal)' : 'transparent';
        b.style.color = active ? 'var(--color-teal)' : 'var(--color-muted)';
        b.style.fontWeight = active ? 'bold' : 'normal';
      });
      const panel = document.getElementById('area-tab-panel');
      if (panel) panel.setAttribute('aria-labelledby', `tab-${tab}`);
      _renderAreaTab(tab, areaCode);
    });
  });
}

function _renderAreaTab(tab, areaCode) {
  const panel = document.getElementById('area-tab-panel');
  if (!panel) return;
  const area  = _getArea(areaCode);

  if (tab === 'overview') {
    const openAFIs = _getAreaOpenAFIs(areaCode);
    const afis = _getAFIs().filter(a => a.areaCode === areaCode && a.status !== AFI_STATUS.CLOSED);
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);">
        <div>
          <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Area details</h3>
          ${_detailRow('Head of Area', area.hoaName || 'Not set')}
          ${_detailRow('Digital Lead', area.digitalLeadId || 'Not set')}
          ${_detailRow('Campus', area.campus || 'Not set')}
          ${_detailRow('Pyramid level', ({foundations:'Foundations',inclusion:'Inclusion',innovation:'Innovation'}[area.pyramidLevel] || 'Not set'))}
          ${_detailRow('Last updated', area.lastUpdated ? _formatDateShort(area.lastUpdated) : 'Never')}
          ${area.notes ? `<div style="margin-top:var(--space-md);padding:var(--space-md);background:var(--color-light);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-slate);">${_escHtml(area.notes)}</div>` : ''}
        </div>
        <div>
          <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Open loops <span style="color:var(--color-amber);">(${openAFIs})</span></h3>
          ${afis.length === 0
            ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No open loops for this area.</p>'
            : afis.map(a => `
              <div style="padding:var(--space-sm) var(--space-md);border-left:3px solid ${a.severity===AFI_SEVERITY.IMMEDIATE?'var(--color-red)':a.severity===AFI_SEVERITY.STRENGTHEN?'var(--color-amber)':'var(--color-green)'};background:var(--color-light);border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:var(--space-sm);">
                <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-slate);">${_escHtml(a.lraThemeLabel || a.lraThemeId)}</p>
                <p style="font-size:var(--text-xs);color:var(--color-muted);">${_escHtml(a.description || '').substring(0,120)}${(a.description||'').length>120?'…':''}</p>
              </div>`).join('')
          }
        </div>
      </div>`;
  }

  if (tab === 'rag') {
    initRAGTab(areaCode);
  }

  if (tab === 'activity') {
    const log = (area.activityLog || []).slice().reverse();
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);">Activity log</h3>
        <span style="font-size:var(--text-sm);color:var(--color-muted);">${log.length} entries</span>
      </div>
      ${log.length === 0
        ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No activities logged yet for this area.</p>'
        : log.map(entry => `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
            <span style="font-size:var(--text-xs);color:var(--color-muted);white-space:nowrap;padding-top:2px;min-width:70px;">${_formatDateShort(entry.date)}</span>
            <div style="flex:1;">
              <span style="font-size:var(--text-xs);font-weight:var(--font-bold);background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;margin-right:var(--space-xs);">${_escHtml(entry.activityType||'')}</span>
              <span style="font-size:var(--text-sm);color:var(--color-slate);">${_escHtml(entry.summary||'')}</span>
            </div>
          </div>`).join('')
      }`;
  }

  if (tab === 'staff') {
    const staffRefs = area.staffRefs || [];
    const allStaff  = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
    const areaStaff = allStaff.filter(s => staffRefs.includes(s.staffId) || s.areaCode === areaCode);
    panel.innerHTML = `
      <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Staff (${areaStaff.length})</h3>
      ${areaStaff.length === 0
        ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No staff profiles linked to this area yet. Staff profiles are created automatically when you log a DevObs or Learning Walk.</p>'
        : areaStaff.map(s => `
          <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--color-teal-lt);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--color-teal);font-size:var(--text-base);flex-shrink:0;">${(s.name||'?')[0].toUpperCase()}</div>
            <div style="flex:1;">
              <p style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-slate);">${_escHtml(s.name)}</p>
              <p style="font-size:var(--text-xs);color:var(--color-muted);">${_escHtml(s.role||'')} ${s.etfStage ? '· ETF Stage '+s.etfStage : ''}</p>
            </div>
            ${_getStaffOpenAFIs(s.staffId) > 0 ? `<span style="font-size:var(--text-xs);font-weight:bold;color:var(--color-amber);">${_getStaffOpenAFIs(s.staffId)} open loop${_getStaffOpenAFIs(s.staffId)!==1?'s':''}</span>` : ''}
          </div>`).join('')
      }`;
  }
}

function _detailRow(label, value) {
  return `<div style="display:flex;gap:var(--space-md);padding:var(--space-xs) 0;border-bottom:1px solid var(--color-border);">
    <span style="font-size:var(--text-sm);color:var(--color-muted);min-width:120px;flex-shrink:0;">${_escHtml(label)}</span>
    <span style="font-size:var(--text-sm);color:var(--color-slate);font-weight:var(--font-bold);">${_escHtml(String(value))}</span>
  </div>`;
}

// ── Wire events ───────────────────────────────────────────────
function _wireAreasEvents() {
  document.getElementById('areas-search')?.addEventListener('input', _renderAreasGrid);
  document.getElementById('areas-filter-campus')?.addEventListener('change', _renderAreasGrid);
  document.getElementById('areas-filter-pyramid')?.addEventListener('change', _renderAreasGrid);
  document.getElementById('area-detail-back')?.addEventListener('click', () => {
    _areasCurrentArea = null;
    const grid   = document.getElementById('areas-grid');
    const detail = document.getElementById('area-detail');
    if (grid)   grid.style.display   = 'grid';
    if (detail) detail.style.display = 'none';
    _renderAreasGrid();
  });
}

// ── Data helpers ──────────────────────────────────────────────
function _getAreas()    { return (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []; }
function _getArea(code) { return _getAreas().find(a => a.areaCode === code) || null; }
function _getAFIs()     { return (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []; }

function _getAreaOpenAFIs(areaCode) {
  return _getAFIs().filter(a => a.areaCode === areaCode && a.status !== AFI_STATUS.CLOSED).length;
}
function _getStaffOpenAFIs(staffId) {
  return _getAFIs().filter(a => a.staffId === staffId && a.status !== AFI_STATUS.CLOSED).length;
}
function _getAreaLastActivity(areaCode) {
  const area = _getArea(areaCode);
  const log  = (area && area.activityLog) || [];
  if (log.length === 0) return null;
  return log.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''))[0].date;
}

function _formatDateShort(isoStr) {
  if (!isoStr) return '';
  try { return new Date(isoStr.split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return isoStr; }
}
function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
