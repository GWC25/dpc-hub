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
      ${['overview','rag','activity','staff','resources','healthchecks','actionplan'].map(tab => `
        <button role="tab" type="button" id="tab-${tab}" data-tab="${tab}"
          aria-selected="${tab==='overview'?'true':'false'}"
          style="padding:10px 20px;border:none;border-bottom:3px solid ${tab==='overview'?'var(--color-teal)':'transparent'};
          background:none;cursor:pointer;font:${tab==='overview'?'bold':''} var(--text-base) Arial,sans-serif;
          color:${tab==='overview'?'var(--color-teal)':'var(--color-muted)'};min-height:44px;white-space:nowrap;">
          ${{overview:'Overview',rag:'RAG Matrix',activity:'Activity Log',staff:'Staff',resources:'Resources Shared',healthchecks:'Health Checks',actionplan:'Action Plan'}[tab]}
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
    const areaDLs = _getAllDLs().filter(d => d.areaCode === areaCode);
    const campuses = ['SWSC', 'Loxton', 'Knightstone', 'Winter Gardens', 'CTC', 'Puxton Park', 'AMTEC', 'AROSFA'];
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);">
        <div>
          <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Area details</h3>

          <div class="form-group">
            <label class="form-label" for="area-hoa-input">Head of Area</label>
            <input class="form-input" type="text" id="area-hoa-input" value="${_escHtml(area.hoaName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="area-dl-select">Digital Lead</label>
            <select class="form-select" id="area-dl-select">
              <option value="">— None —</option>
              ${areaDLs.map(d => `<option value="${d.dlId}" ${area.digitalLeadId===d.dlId?'selected':''}>${_escHtml(d.name)}</option>`).join('')}
            </select>
            ${areaDLs.length === 0 ? '<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">No Digital Lead profile exists for this area yet — add one in Digital Leads first.</p>' : ''}
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="area-campus-select">Campus</label>
            <select class="form-select" id="area-campus-select">
              <option value="">— Not set —</option>
              ${campuses.map(c => `<option value="${c}" ${area.campus===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="area-pyramid-select">Pyramid level</label>
            <select class="form-select" id="area-pyramid-select">
              <option value="foundations" ${area.pyramidLevel==='foundations'?'selected':''}>Foundations</option>
              <option value="inclusion" ${area.pyramidLevel==='inclusion'?'selected':''}>Inclusion</option>
              <option value="innovation" ${area.pyramidLevel==='innovation'?'selected':''}>Innovation</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="area-notes-input">Notes</label>
            <textarea class="form-textarea" id="area-notes-input" rows="2">${_escHtml(area.notes || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="area-historical-rag">Historical RAG (overall, pre-Hub figure)</label>
            <select class="form-select" id="area-historical-rag">
              <option value="">— Not set —</option>
              ${[1,2,3,4,5].map(n => `<option value="${n}" ${(area.historicalRAG&&area.historicalRAG.overall===n)?'selected':''}>${n}</option>`).join('')}
            </select>
            <p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Used as a coarse fallback suggestion for dimensions with no Health Check data yet — never overwrites real observed data.</p>
          </div>
          <button id="area-details-save" type="button" class="btn btn--primary btn--sm">Save changes</button>
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:var(--space-sm);">Last updated: ${area.lastUpdated ? _formatDateShort(area.lastUpdated) : 'Never'}</p>
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

    document.getElementById('area-details-save')?.addEventListener('click', () => {
      area.hoaName = document.getElementById('area-hoa-input').value.trim();
      area.digitalLeadId = document.getElementById('area-dl-select').value || null;
      area.campus = document.getElementById('area-campus-select').value;
      area.pyramidLevel = document.getElementById('area-pyramid-select').value;
      area.notes = document.getElementById('area-notes-input').value.trim();
      const histRAG = document.getElementById('area-historical-rag').value;
      if (histRAG) {
        saveHistoricalRAG(areaCode, parseInt(histRAG));
      } else if (area.historicalRAG) {
        delete area.historicalRAG.overall;
      }
      saveArea(area);
      if (typeof UI !== 'undefined') UI.showToast('success', 'Area details saved.');
      _renderAreaTab('overview', areaCode);
    });
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
        ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No staff profiles linked to this area yet. Staff profiles are created automatically when you log an Instructional Coaching session or Learning Walk.</p>'
        : areaStaff.map(s => `
          <div class="area-staff-row" data-staff-id="${s.staffId}" style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);cursor:pointer;" tabindex="0" role="button" aria-label="Open ${_escHtml(s.name)}'s profile">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--color-teal-lt);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--color-teal);font-size:var(--text-base);flex-shrink:0;">${(s.name||'?')[0].toUpperCase()}</div>
            <div style="flex:1;">
              <p style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-teal);text-decoration:underline;">${_escHtml(s.name)}</p>
              <p style="font-size:var(--text-xs);color:var(--color-muted);">${_escHtml(s.role||'')} ${s.etfStage ? '· ETF Stage '+s.etfStage : ''}</p>
            </div>
            ${_getStaffOpenAFIs(s.staffId) > 0 ? `<span style="font-size:var(--text-xs);font-weight:bold;color:var(--color-amber);">${_getStaffOpenAFIs(s.staffId)} open loop${_getStaffOpenAFIs(s.staffId)!==1?'s':''}</span>` : ''}
          </div>`).join('')
      }`;
    panel.querySelectorAll('.area-staff-row').forEach(row => {
      row.addEventListener('click', () => { if (typeof openStaffProfile === 'function') openStaffProfile(row.dataset.staffId); });
      row.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && typeof openStaffProfile === 'function') { e.preventDefault(); openStaffProfile(row.dataset.staffId); } });
    });
  }

  if (tab === 'resources') {
    // Reads from library.js — resource shares are stored centrally, not on
    // the area record, same reasoning as AFIs (area.afiRefs is a pointer,
    // not the source of truth). See data.js saveLibraryShare().
    const shares = (typeof _libGetSharesForArea === 'function' ? _libGetSharesForArea(areaCode) : []).slice().reverse();
    panel.innerHTML = `
      <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Resources shared (${shares.length})</h3>
      ${shares.length === 0
        ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No resources shared with staff in this area yet. Share one from the Resource Library.</p>'
        : shares.map(s => `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
            <span style="font-size:var(--text-xs);color:var(--color-muted);white-space:nowrap;padding-top:2px;min-width:70px;">${_formatDateShort(s.date)}</span>
            <div style="flex:1;">
              <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_escHtml(s.resourceTitle||'')}</p>
              <p style="font-size:var(--text-xs);color:var(--color-muted);">${typeof _libStaffNames==='function' ? _escHtml(_libStaffNames(s.staffIds)) : (s.staffIds||[]).length + ' staff'}</p>
              ${s.contextNotes?`<p style="font-size:var(--text-xs);color:var(--color-muted);font-style:italic;">${_escHtml(s.contextNotes)}</p>`:''}
            </div>
          </div>`).join('')
      }`;
  }

  if (tab === 'healthchecks') {
    // Reads from healthcheck.js — same reasoning as resources above:
    // reviews are stored centrally (data-health-checks.json), area is a
    // filter, not the source of truth. Shows latest review per staff
    // member so a re-check in a later cycle correctly supersedes an
    // earlier one rather than listing both.
    const reviews = typeof _hcGetReviewsForArea === 'function' ? _hcGetReviewsForArea(areaCode) : [];
    const byStaff = {};
    reviews.forEach(r => {
      if (!byStaff[r.staffId] || (r.date || '') > (byStaff[r.staffId].date || '')) byStaff[r.staffId] = r;
    });
    const latestReviews = Object.values(byStaff).sort((a, b) => (b.supportPriorityScore || 0) - (a.supportPriorityScore || 0));
    const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];

    panel.innerHTML = `
      <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Health Checks (${latestReviews.length} staff reviewed)</h3>
      ${latestReviews.length === 0
        ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No Health Checks recorded for this area yet.</p>'
        : latestReviews.map(r => {
            const staff = allStaff.find(s => s.staffId === r.staffId);
            const domainCount = Object.keys(r.domains || {}).length;
            return `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
            <span style="font-size:var(--text-xs);color:var(--color-muted);white-space:nowrap;padding-top:2px;min-width:70px;">${_formatDateShort(r.date)}</span>
            <div style="flex:1;">
              <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_escHtml(staff ? staff.name : r.staffId)}</p>
              <p style="font-size:var(--text-xs);color:var(--color-muted);">${domainCount} focus area(s) reviewed · Priority score ${r.supportPriorityScore != null ? r.supportPriorityScore.toFixed(1) : '—'}</p>
            </div>
          </div>`;
          }).join('')
      }`;
  }

  if (tab === 'actionplan') {
    _renderActionPlanTab(panel, areaCode);
  }
}

// ── Action Plan tab (Session 41) ──────────────────────────────────
// Wires together three things that already exist rather than inventing
// new ones: Templates (js/templates.js — teach-meet template + instance
// pattern, including the reflection-form URL), Loops (js/afi.js — an
// open AFI that tracks whether the work actually happened), and Areas.
// "Assign Teach Meet" on a plan calls assignTemplateToActionPlan()
// (data.js), which creates a real instance and a real Loop in one step —
// see that function's own comment for exactly what gets linked.
function _renderActionPlanTab(panel, areaCode) {
  const plans = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [])
    .filter(p => p.areaCode === areaCode)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);">
      <h3 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);">Action Plan (${plans.length})</h3>
      <button id="ap-new-btn" type="button" class="btn btn--primary btn--sm">+ New action plan</button>
    </div>
    <div id="ap-new-form" style="display:none;"></div>
    <div id="ap-list"></div>
  `;

  _renderAPList(areaCode);
  document.getElementById('ap-new-btn')?.addEventListener('click', () => _renderAPNewForm(areaCode));
}

function _renderAPList(areaCode) {
  const container = document.getElementById('ap-list');
  if (!container) return;
  const plans = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [])
    .filter(p => p.areaCode === areaCode)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (plans.length === 0) {
    container.innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">No action plans yet for this area.</p>';
    return;
  }

  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  container.innerHTML = plans.map(p => {
    const staffNames = (p.staffIds || []).map(id => { const s = allStaff.find(x => x.staffId === id); return s ? s.name : id; }).join(', ') || 'Whole team';
    const openLoops = (p.linkedAFIIds || []).filter(id => {
      const afi = (window.DPC_DATA.afi && window.DPC_DATA.afi.afis || []).find(a => a.afiId === id);
      return afi && afi.status !== 'closed';
    }).length;
    return `
      <div class="ap-card" data-plan-id="${p.planId}" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div>
            <p style="font-size:var(--text-xs);font-weight:bold;background:var(--color-light);color:var(--color-muted);padding:1px 8px;border-radius:999px;display:inline-block;margin-bottom:4px;">${_escHtml(p.type || 'General')}</p>
            <p style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${_escHtml(p.focus || p.aim || 'Untitled plan')}</p>
            <p style="font-size:var(--text-xs);color:var(--color-muted);">For: ${_escHtml(staffNames)} · Target: ${p.targetDate ? _formatDateShort(p.targetDate) : 'No date set'}</p>
          </div>
          ${openLoops > 0 ? `<span style="font-size:var(--text-xs);font-weight:bold;color:var(--color-amber);white-space:nowrap;">${openLoops} open loop${openLoops!==1?'s':''}</span>` : ''}
        </div>
        ${p.aim ? `<p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:var(--space-sm);"><strong>Aim:</strong> ${_escHtml(p.aim)}</p>` : ''}
        ${p.successCriteria ? `<p style="font-size:var(--text-sm);color:var(--color-slate);"><strong>Success criteria:</strong> ${_escHtml(p.successCriteria)}</p>` : ''}
        ${(p.linkedInstances || []).length > 0 ? `<p style="font-size:var(--text-xs);color:var(--color-teal);margin-top:var(--space-sm);">${p.linkedInstances.length} session(s) assigned</p>` : ''}
        <div class="btn-row" style="margin-top:var(--space-sm);">
          <button type="button" class="btn btn--ghost btn--sm ap-assign-btn" data-plan-id="${p.planId}">Assign Teach Meet</button>
        </div>
        <div class="ap-assign-form" data-plan-id="${p.planId}" style="display:none;margin-top:var(--space-sm);padding:var(--space-sm);background:var(--color-light);border-radius:var(--radius-sm);"></div>
      </div>`;
  }).join('');

  container.querySelectorAll('.ap-assign-btn').forEach(btn => {
    btn.addEventListener('click', () => _toggleAPAssignForm(btn.dataset.planId, areaCode));
  });
}

function _toggleAPAssignForm(planId, areaCode) {
  const form = document.querySelector(`.ap-assign-form[data-plan-id="${planId}"]`);
  if (!form) return;
  const showing = form.style.display !== 'none';
  if (showing) { form.style.display = 'none'; return; }

  const teachMeetTemplates = ((window.DPC_DATA.templates && window.DPC_DATA.templates.templates) || [])
    .filter(t => t.templateType === 'teach-meet');

  if (teachMeetTemplates.length === 0) {
    form.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-muted);">No Teach Meet templates exist yet — create one in Templates first.</p>';
    form.style.display = 'block';
    return;
  }

  form.innerHTML = `
    <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
      <select class="form-select ap-tmpl-select" style="flex:1;min-height:36px;font-size:var(--text-xs);">
        ${teachMeetTemplates.map(t => `<option value="${t.templateId}">${_escHtml(t.title || t.templateType)}</option>`).join('')}
      </select>
      <input type="date" class="form-input ap-tmpl-date" value="${todayISO()}" style="min-height:36px;font-size:var(--text-xs);">
      <button type="button" class="btn btn--primary btn--sm ap-tmpl-confirm">Assign</button>
    </div>
  `;
  form.style.display = 'block';

  form.querySelector('.ap-tmpl-confirm').addEventListener('click', () => {
    const templateId = form.querySelector('.ap-tmpl-select').value;
    const date = form.querySelector('.ap-tmpl-date').value;
    if (!date) { if (typeof UI !== 'undefined') UI.showToast('error', 'Please select a date.'); return; }

    const result = assignTemplateToActionPlan(planId, templateId, date);
    if (result) {
      if (typeof UI !== 'undefined') UI.showToast('success', 'Teach Meet assigned — session and Loop created.');
      _renderAPList(areaCode);
    } else {
      if (typeof UI !== 'undefined') UI.showToast('error', 'Could not assign — plan or template not found.');
    }
  });
}

function _renderAPNewForm(areaCode) {
  const container = document.getElementById('ap-new-form');
  if (!container) return;
  const showing = container.style.display !== 'none';
  if (showing) { container.style.display = 'none'; return; }

  const areaStaff = ((window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []).filter(s => s.areaCode === areaCode);

  container.innerHTML = `
    <div style="border:2px dashed var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);">
      <div class="form-group">
        <label class="form-label" for="ap-type">Type</label>
        <select class="form-select" id="ap-type">
          <option value="Training">Training</option>
          <option value="Coaching">Coaching</option>
          <option value="Resource sharing">Resource sharing</option>
          <option value="Whole team">Whole team</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="ap-focus">Focus</label>
        <input class="form-input" type="text" id="ap-focus" placeholder="e.g. Accessible resource creation">
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="ap-staff">Staff (leave blank for whole team)</label>
        <select class="form-select" id="ap-staff" multiple size="4">
          ${areaStaff.map(s => `<option value="${s.staffId}">${_escHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="ap-aim">Aim</label>
        <textarea class="form-textarea" id="ap-aim" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="ap-success">Success criteria</label>
        <textarea class="form-textarea" id="ap-success" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="ap-target">Target date</label>
        <input class="form-input" type="date" id="ap-target">
      </div>
      <div class="btn-row">
        <button type="button" id="ap-save-btn" class="btn btn--primary btn--sm">Save action plan</button>
        <button type="button" id="ap-cancel-btn" class="btn btn--ghost btn--sm">Cancel</button>
      </div>
    </div>
  `;
  container.style.display = 'block';

  document.getElementById('ap-cancel-btn').addEventListener('click', () => { container.style.display = 'none'; });
  document.getElementById('ap-save-btn').addEventListener('click', () => {
    const focus = document.getElementById('ap-focus').value.trim();
    if (!focus) { if (typeof UI !== 'undefined') UI.showToast('error', 'Please enter a focus for this plan.'); return; }

    const staffSel = document.getElementById('ap-staff');
    const staffIds = staffSel ? Array.from(staffSel.selectedOptions).map(o => o.value) : [];

    saveActionPlan({
      planId: generateId(),
      areaCode,
      type: document.getElementById('ap-type').value,
      focus,
      staffIds,
      aim: document.getElementById('ap-aim').value.trim(),
      successCriteria: document.getElementById('ap-success').value.trim(),
      targetDate: document.getElementById('ap-target').value || null,
      status: 'active',
      linkedInstances: [],
      linkedAFIIds: [],
    });

    container.style.display = 'none';
    _renderAPList(areaCode);
    if (typeof UI !== 'undefined') UI.showToast('success', `Action plan created: ${focus}`);
  });
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
function _getAreas(includeArchived = false) {
  const all = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  return includeArchived ? all : all.filter(a => !a.archived);
}
function _getArea(code) { return _getAreas(true).find(a => a.areaCode === code) || null; }
function _getDepartments(areaCode, includeArchived = false) {
  const area = _getArea(areaCode);
  const all = (area && area.departments) || [];
  return includeArchived ? all : all.filter(d => !d.archived);
}
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
