// DPC Hub · js/dashboard.js · v1.0 · July 2026
// Dashboards module. Area RAG filterable dashboard. Health Check collegiate view.
// Reads from window.DPC_DATA across areas, AFIs, health checks.

function initDashboards() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-lg);">Dashboards</h1>

    <!-- Dashboard tabs -->
    <div role="tablist" style="display:flex;border-bottom:2px solid var(--color-border);margin-bottom:var(--space-xl);">
      <button role="tab" type="button" id="dash-tab-rag" aria-selected="true" data-dash="rag"
        style="padding:10px 20px;border:none;border-bottom:3px solid var(--color-teal);background:none;cursor:pointer;font:bold var(--text-base) Arial,sans-serif;color:var(--color-teal);min-height:44px;">
        Area RAG
      </button>
      <button role="tab" type="button" id="dash-tab-hc" aria-selected="false" data-dash="hc"
        style="padding:10px 20px;border:none;border-bottom:3px solid transparent;background:none;cursor:pointer;font:var(--text-base) Arial,sans-serif;color:var(--color-muted);min-height:44px;">
        Health Checks
      </button>
      <button role="tab" type="button" id="dash-tab-loops" aria-selected="false" data-dash="loops"
        style="padding:10px 20px;border:none;border-bottom:3px solid transparent;background:none;cursor:pointer;font:var(--text-base) Arial,sans-serif;color:var(--color-muted);min-height:44px;">
        Loops Overview
      </button>
      <button role="tab" type="button" id="dash-tab-impact" aria-selected="false" data-dash="impact"
        style="padding:10px 20px;border:none;border-bottom:3px solid transparent;background:none;cursor:pointer;font:var(--text-base) Arial,sans-serif;color:var(--color-muted);min-height:44px;">
        Numerical Impact
      </button>
    </div>

    <div id="dash-panel"></div>
  `;

  _renderDashRAG();

  document.querySelectorAll('[data-dash]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-dash]').forEach(b=>{
        const active=b.dataset.dash===btn.dataset.dash;
        b.setAttribute('aria-selected',active?'true':'false');
        b.style.borderBottomColor=active?'var(--color-teal)':'transparent';
        b.style.color=active?'var(--color-teal)':'var(--color-muted)';
        b.style.fontWeight=active?'bold':'normal';
      });
      if(btn.dataset.dash==='rag') _renderDashRAG();
      if(btn.dataset.dash==='hc') _renderDashHC();
      if(btn.dataset.dash==='loops') _renderDashLoops();
      if(btn.dataset.dash==='impact') _renderDashImpact();
    });
  });
}

// ── RAG Dashboard ─────────────────────────────────────────────
function _renderDashRAG() {
  const panel = document.getElementById('dash-panel');
  if (!panel) return;

  const areas = _getAreas()||[];
  const dims  = RAG_DIMENSIONS;

  // Filter controls
  panel.innerHTML=`
    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);flex-wrap:wrap;align-items:center;">
      <select id="dash-rag-dim" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by dimension">
        <option value="">All dimensions</option>
        ${dims.map(d=>`<option value="${d.id}">${d.label}</option>`).join('')}
      </select>
      <select id="dash-rag-score" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by score">
        <option value="">All scores</option>
        <option value="1">1 — Immediate priority</option>
        <option value="2">2 — Significant development</option>
        <option value="3">3 — Developing</option>
        <option value="4">4 — Establishing</option>
        <option value="5">5 — Embedded</option>
      </select>
      <select id="dash-rag-afi" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by open loops">
        <option value="">Any loops</option>
        <option value="has">Has open loops</option>
        <option value="none">No open loops</option>
      </select>
      <input type="search" id="dash-rag-search" class="form-input" placeholder="Search areas…" style="width:180px;min-height:40px;font-size:var(--text-sm);" aria-label="Search areas">
    </div>
    <div id="dash-rag-summary" style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg);"></div>
    <div style="margin-bottom:var(--space-md);">
      <button type="button" id="dash-college-ap-link" class="btn btn--ghost btn--sm">Download College Action Plan Overview →</button>
    </div>
    <div id="dash-rag-table" style="overflow-x:auto;"></div>
  `;

  _renderRAGTable();
  document.getElementById('dash-college-ap-link')?.addEventListener('click', () => {
    if (typeof openReportType === 'function') openReportType(REPORT_TYPES.COLLEGE_ACTION_PLAN);
    else if (typeof navigateTo === 'function') navigateTo('reports');
  });
  document.getElementById('dash-rag-dim')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-score')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-afi')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-search')?.addEventListener('input',_renderRAGTable);

  // Delegated once on the persistent #dash-rag-table container, not
  // inside _renderRAGTable() (which re-runs on every filter change and
  // would otherwise stack duplicate listeners — same bug class as
  // wireActionPlanCard()/_wireIndustrySkillsTab() earlier this session).
  const table = document.getElementById('dash-rag-table');
  if (table && !table._dashWired) {
    table._dashWired = true;
    table.addEventListener('click', (e) => {
      const cell = e.target.closest('.dash-rag-cell');
      if (cell && typeof openAreaProfile === 'function') openAreaProfile(cell.dataset.areaCode, 'actionplan');
    });
  }
}

function _renderRAGTable() {
  const dimFilter   = document.getElementById('dash-rag-dim')?.value||'';
  const scoreFilter = document.getElementById('dash-rag-score')?.value||'';
  const afiFilter   = document.getElementById('dash-rag-afi')?.value||'';
  const search      = (document.getElementById('dash-rag-search')?.value||'').toLowerCase().trim();

  let areas = _getAreas()||[];
  if (search) areas = areas.filter(a=>(a.areaCode+a.areaName).toLowerCase().includes(search));
  if (afiFilter) {
    const afis = (window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[];
    if (afiFilter==='has') areas=areas.filter(a=>afis.some(x=>x.areaCode===a.areaCode&&x.status!=='closed'));
    if (afiFilter==='none') areas=areas.filter(a=>!afis.some(x=>x.areaCode===a.areaCode&&x.status!=='closed'));
  }
  if (dimFilter && scoreFilter) {
    areas=areas.filter(a=>{
      const d=a.ragDimensions&&a.ragDimensions[dimFilter];
      return d&&String(d.score)===scoreFilter;
    });
  }

  // Summary strip
  const summary = document.getElementById('dash-rag-summary');
  if (summary) {
    const all = _getAreas()||[];
    const scoredCount = all.filter(a=>a.ragDimensions&&Object.keys(a.ragDimensions).length>0).length;
    const openAFIs = (window.DPC_DATA.afi&&window.DPC_DATA.afi.afis||[]).filter(a=>a.status!=='closed').length;
    const avgScores = RAG_DIMENSIONS.map(dim=>{
      const scores=all.map(a=>a.ragDimensions&&a.ragDimensions[dim.id]?.score).filter(Boolean);
      return scores.length>0?(scores.reduce((s,x)=>s+x,0)/scores.length).toFixed(1):'—';
    });
    summary.innerHTML=`
      <div style="padding:var(--space-md);background:var(--color-light);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-navy);">${all.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Total areas</div>
      </div>
      <div style="padding:var(--space-md);background:var(--color-teal-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-teal);">${scoredCount}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Areas scored</div>
      </div>
      <div style="padding:var(--space-md);background:var(--color-amber-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-amber);">${openAFIs}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Open loops</div>
      </div>
      <div style="padding:var(--space-md);background:var(--color-green-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-green);">${(window.DPC_DATA.afi&&window.DPC_DATA.afi.afis||[]).filter(a=>a.status==='closed').length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Loops closed</div>
      </div>
      <div style="padding:var(--space-md);background:var(--color-blue-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-xl);font-weight:bold;color:var(--color-blue);">${areas.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Showing</div>
      </div>
    `;
  }

  const table = document.getElementById('dash-rag-table');
  if (!table) return;

  if (areas.length===0) { table.innerHTML='<p style="color:var(--color-muted);padding:var(--space-lg);">No areas match your filters.</p>'; return; }

  const dimsToShow = dimFilter ? RAG_DIMENSIONS.filter(d=>d.id===dimFilter) : RAG_DIMENSIONS;
  const afis = (window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[];

  table.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
      <thead>
        <tr style="background:var(--color-navy);">
          <th style="text-align:left;padding:var(--space-sm) var(--space-md);color:var(--color-white);font-size:var(--text-xs);min-width:140px;">Area</th>
          ${dimsToShow.map(d=>`<th style="text-align:center;padding:var(--space-sm) var(--space-xs);color:var(--color-white);font-size:10px;min-width:80px;" title="${d.label}">${d.label.split(' ').slice(0,2).join(' ')}</th>`).join('')}
          <th style="text-align:center;padding:var(--space-sm) var(--space-xs);color:var(--color-white);font-size:10px;min-width:60px;">Open loops</th>
        </tr>
      </thead>
      <tbody>
        ${areas.map((area,ri)=>{
          const openCount=afis.filter(a=>a.areaCode===area.areaCode&&a.status!=='closed').length;
          return `<tr style="background:${ri%2===0?'var(--color-light)':'var(--color-white)'};border-bottom:1px solid var(--color-border);">
            <td style="padding:var(--space-sm) var(--space-md);">
              <span style="font-size:10px;font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 6px;border-radius:999px;margin-right:4px;">${_dEsc(area.areaCode)}</span>
              <span style="color:var(--color-slate);">${_dEsc(area.areaName)}</span>
            </td>
            ${dimsToShow.map(dim=>{
              const d=area.ragDimensions&&area.ragDimensions[dim.id];
              const score=d?.score;
              const bg=score?['','var(--rag-1-bg)','var(--rag-2-bg)','var(--rag-3-bg)','var(--rag-4-bg)','var(--rag-5-bg)'][score]:'transparent';
              const col=score?['','var(--rag-1-text)','var(--rag-2-text)','var(--rag-3-text)','var(--rag-4-text)','var(--rag-5-text)'][score]:'var(--color-border)';
              return `<td style="text-align:center;padding:var(--space-xs);">
                <button type="button" class="dash-rag-cell" data-area-code="${_dEsc(area.areaCode)}" title="Open ${_dEsc(area.areaName)}'s Action Plan"
                  style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);
                  background:${bg};color:${col};font-weight:bold;font-size:var(--text-base);border:none;cursor:pointer;"
                  aria-label="${dim.label}: ${score?RAG_LABELS[score]:'Not scored'} — open ${_dEsc(area.areaName)}'s Action Plan">${score||'—'}</button>
              </td>`;
            }).join('')}
            <td style="text-align:center;padding:var(--space-xs);">
              ${openCount>0?`<span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-amber-lt);color:var(--color-amber);padding:1px 8px;border-radius:999px;" aria-label="${openCount} open loops">${openCount}</span>`:'<span style="color:var(--color-border);">—</span>'}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ── Numerical Impact (Session 41) ─────────────────────────────────
// Replaces the manually-maintained tracker sheet — every number here is
// computed live from the same data everything else in the Hub already
// reads (data-health-checks.json, data-resource-library.json, areas),
// not re-typed or re-uploaded. Matches the shape of the old tracker's
// own "Numerical Impact" sheet (Problem / Action / Impact by numbers)
// where that made sense, but sourced from real records throughout.
function _renderDashImpact() {
  const panel = document.getElementById('dash-panel');
  if (!panel) return;

  const areas = _getAreas() || [];
  const reviews = typeof _hcGetAllReviews === 'function' ? _hcGetAllReviews() : [];
  const shares = typeof _libGetAllShares === 'function' ? _libGetAllShares() : [];

  const areasChecked = new Set(reviews.map(r => r.areaCode)).size;
  const staffReviewed = new Set(reviews.map(r => r.staffId)).size;

  let domainsReviewed = 0, actionsIdentified = 0;
  reviews.forEach(r => {
    Object.values(r.domains || {}).forEach(d => {
      domainsReviewed++;
      if (d.actionIdentified) actionsIdentified++;
    });
  });

  const cycleCounts = {};
  reviews.forEach(r => { cycleCounts[r.cycleId] = (cycleCounts[r.cycleId] || 0) + 1; });
  const cycleLabels = { 'baseline-2026': 'Baseline (2026)', 'nov-2026': 'November 2026', 'feb-mar-2027': 'Feb/March 2027', 'jun-2027': 'June 2027' };

  panel.innerHTML = `
    <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-lg);">
      Live, computed from real records as of ${_formatDateShort(nowISO())} — not a manually maintained figure.
    </p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-md);margin-bottom:var(--space-xl);">
      <button type="button" class="dash-impact-tile" data-drill="reviews" style="padding:var(--space-lg);background:var(--color-teal-lt);border:none;border-radius:var(--radius-md);text-align:center;cursor:pointer;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-teal);">${reviews.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Health Checks completed</div>
      </button>
      <button type="button" class="dash-impact-tile" data-drill="areas" style="padding:var(--space-lg);background:var(--color-blue-lt);border:none;border-radius:var(--radius-md);text-align:center;cursor:pointer;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-blue);">${areasChecked}/${areas.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Areas checked</div>
      </button>
      <button type="button" class="dash-impact-tile" data-drill="staff" style="padding:var(--space-lg);background:var(--color-light);border:none;border-radius:var(--radius-md);text-align:center;cursor:pointer;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-navy);">${staffReviewed}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Staff reviewed</div>
      </button>
      <button type="button" class="dash-impact-tile" data-drill="actions" style="padding:var(--space-lg);background:var(--color-amber-lt);border:none;border-radius:var(--radius-md);text-align:center;cursor:pointer;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-amber);">${actionsIdentified}/${domainsReviewed}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Action points identified (of ${domainsReviewed} domains reviewed)</div>
      </button>
    </div>

    <div id="dash-impact-drill" style="display:none;margin-bottom:var(--space-xl);padding:var(--space-lg);border:1px solid var(--color-border);border-radius:var(--radius-md);"></div>

    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Health Checks by cycle</h3>
    <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);margin-bottom:var(--space-xl);">
      <thead><tr style="border-bottom:2px solid var(--color-border);">
        <th style="text-align:left;padding:var(--space-sm);color:var(--color-muted);font-size:var(--text-xs);">Cycle</th>
        <th style="text-align:right;padding:var(--space-sm);color:var(--color-muted);font-size:var(--text-xs);">Reviews completed</th>
      </tr></thead>
      <tbody>
        ${['baseline-2026', 'nov-2026', 'feb-mar-2027', 'jun-2027'].map(cid => `
          <tr style="border-bottom:1px solid var(--color-border);">
            <td style="padding:var(--space-sm);color:var(--color-slate);">${cycleLabels[cid]}</td>
            <td style="padding:var(--space-sm);text-align:right;font-weight:bold;color:var(--color-navy);">${cycleCounts[cid] || 0}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Resource sharing activity</h3>
    <p style="font-size:var(--text-sm);color:var(--color-slate);">${shares.length} resource(s) shared with staff across ${new Set(shares.map(s=>s.areaCode)).size} area(s).</p>
  `;

  document.querySelectorAll('.dash-impact-tile').forEach(btn => {
    btn.addEventListener('click', () => _dashRenderImpactDrill(btn.dataset.drill, reviews, areas));
  });
}

// ── Numerical Impact drill-down (Session 51) ──────────────────────
// "48/57 — 57 what?" was a fair question — the label alone didn't say.
// Now it's spelled out on the tile itself, and every tile opens the
// records that actually make up the number, not just a bigger number.
function _dashRenderImpactDrill(kind, reviews, areas) {
  const panel = document.getElementById('dash-impact-drill');
  if (!panel) return;
  const alreadyShowing = panel.style.display !== 'none' && panel.dataset.kind === kind;
  if (alreadyShowing) { panel.style.display = 'none'; return; }
  panel.dataset.kind = kind;
  panel.style.display = 'block';

  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const nameOf = (staffId) => { const s = allStaff.find(x => x.staffId === staffId); return s ? s.name : staffId; };
  const areaNameOf = (code) => { const a = areas.find(x => x.areaCode === code); return a ? a.areaName : code; };

  if (kind === 'reviews' || kind === 'staff') {
    panel.innerHTML = `
      <h4 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Every Health Check counted</h4>
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-xs);">
        <thead><tr style="border-bottom:1px solid var(--color-border);">
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Staff</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Area</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Date</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Cycle</th>
        </tr></thead>
        <tbody>
          ${reviews.map(r => `<tr style="border-bottom:1px solid var(--color-border);">
            <td style="padding:4px;">${nameOf(r.staffId)}</td>
            <td style="padding:4px;">${r.areaCode} — ${areaNameOf(r.areaCode)}</td>
            <td style="padding:4px;">${_formatDateShort(r.date)}</td>
            <td style="padding:4px;">${r.cycleId}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  if (kind === 'areas') {
    const byArea = {};
    reviews.forEach(r => { (byArea[r.areaCode] = byArea[r.areaCode] || []).push(r); });
    panel.innerHTML = `
      <h4 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Areas checked</h4>
      ${Object.entries(byArea).map(([code, rs]) => `
        <p style="font-size:var(--text-sm);color:var(--color-slate);padding:4px 0;border-bottom:1px solid var(--color-border);">
          <strong>${code}</strong> — ${areaNameOf(code)} — ${new Set(rs.map(r=>r.staffId)).size} staff reviewed
        </p>`).join('')}`;
  }

  if (kind === 'actions') {
    // The "common threads" ask — every real action description, not just
    // a count, so patterns across areas actually become visible.
    const actionRows = [];
    reviews.forEach(r => {
      Object.entries(r.domains || {}).forEach(([domainId, d]) => {
        if (d.actionIdentified && d.actionDescription) {
          const focusArea = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).find(fa => fa.id === domainId);
          actionRows.push({ staffId: r.staffId, areaCode: r.areaCode, domain: focusArea ? focusArea.label : domainId, text: d.actionDescription });
        }
      });
    });
    panel.innerHTML = `
      <h4 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Every identified action point</h4>
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-xs);">
        <thead><tr style="border-bottom:1px solid var(--color-border);">
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Staff</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Area</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Domain</th>
          <th style="text-align:left;padding:4px;color:var(--color-muted);">Action</th>
        </tr></thead>
        <tbody>
          ${actionRows.map(a => `<tr style="border-bottom:1px solid var(--color-border);">
            <td style="padding:4px;">${nameOf(a.staffId)}</td>
            <td style="padding:4px;">${a.areaCode}</td>
            <td style="padding:4px;">${a.domain}</td>
            <td style="padding:4px;">${a.text}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }
}

// ── Health Check Dashboard ────────────────────────────────────
// Session 36: rewritten to read from data-health-checks.json (staff-level,
// 5 focus areas — see HC_FOCUS_AREAS in schema.js) instead of the
// abandoned area.healthChecks[] (old 5-broad-dimension model). Area-level
// rollup here = average across each area's most-recently-reviewed staff
// member per focus area, deduped by staffId so the same person's older
// review in an earlier cycle doesn't get double-counted alongside their
// newer one.
function _renderDashHC() {
  const panel = document.getElementById('dash-panel');
  if (!panel) return;

  const areas = _getAreas() || [];
  const allReviews = typeof _hcGetAllReviews === 'function' ? _hcGetAllReviews() : [];

  const areasWithHC = areas.filter(a => allReviews.some(r => r.areaCode === a.areaCode));
  const completion = Math.round((areasWithHC.length / Math.max(areas.length, 1)) * 100);

  // Latest review per (areaCode, staffId) — the dedupe step described above.
  function latestPerStaff(areaCode) {
    const areaReviews = allReviews.filter(r => r.areaCode === areaCode);
    const byStaff = {};
    areaReviews.forEach(r => {
      if (!byStaff[r.staffId] || (r.date || '') > (byStaff[r.staffId].date || '')) byStaff[r.staffId] = r;
    });
    return Object.values(byStaff);
  }

  function areaFocusAvg(areaCode, focusId) {
    const reviews = latestPerStaff(areaCode);
    const scores = reviews.map(r => r.domains && r.domains[focusId] && r.domains[focusId].avgScore).filter(v => v != null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-md);margin-bottom:var(--space-xl);">
      <div style="padding:var(--space-lg);background:var(--color-teal-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-teal);">${areasWithHC.length}/${areas.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Areas with a review</div>
      </div>
      <div style="padding:var(--space-lg);background:var(--color-blue-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-blue);">${completion}%</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Coverage</div>
      </div>
      ${HC_FOCUS_AREAS.slice(0, 2).map(fa => {
        const scores = areas.map(a => areaFocusAvg(a.areaCode, fa.id)).filter(v => v != null);
        const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
        return `<div style="padding:var(--space-lg);background:var(--color-light);border-radius:var(--radius-md);text-align:center;">
          <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-navy);">${avg}</div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);">Avg: ${fa.label}</div>
        </div>`;
      }).join('')}
    </div>

    <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Area Health Check scores</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
        <thead>
          <tr style="background:var(--color-navy);">
            <th style="text-align:left;padding:var(--space-sm) var(--space-md);color:var(--color-white);font-size:var(--text-xs);">Area</th>
            <th style="text-align:center;padding:var(--space-sm);color:var(--color-white);font-size:10px;">Staff reviewed</th>
            ${HC_FOCUS_AREAS.map(fa => `<th style="text-align:center;padding:var(--space-sm) var(--space-xs);color:var(--color-white);font-size:10px;min-width:80px;">${fa.label.split(' ').slice(0,2).join(' ')}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${areas.map((area, ri) => {
            const reviewed = latestPerStaff(area.areaCode);
            return `<tr class="dash-hc-row" data-area-code="${_dEsc(area.areaCode)}" style="background:${ri%2===0?'var(--color-light)':'var(--color-white)'};border-bottom:1px solid var(--color-border);cursor:pointer;">
              <td style="padding:var(--space-sm) var(--space-md);">
                <span style="font-size:10px;font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 6px;border-radius:999px;margin-right:4px;">${_dEsc(area.areaCode)}</span>
                <span style="color:var(--color-teal);text-decoration:underline;">${_dEsc(area.areaName)}</span>
              </td>
              <td style="text-align:center;font-size:var(--text-xs);color:var(--color-muted);padding:var(--space-sm);">${reviewed.length}</td>
              ${HC_FOCUS_AREAS.map(fa => {
                const avg = areaFocusAvg(area.areaCode, fa.id);
                const rounded = avg != null ? Math.round(avg) : null;
                const bg = rounded ? ['','var(--rag-1-bg)','var(--rag-2-bg)','var(--rag-3-bg)','var(--rag-4-bg)','var(--rag-5-bg)'][rounded] : 'transparent';
                const col = rounded ? ['','var(--rag-1-text)','var(--rag-2-text)','var(--rag-3-text)','var(--rag-4-text)','var(--rag-5-text)'][rounded] : 'var(--color-border)';
                return `<td style="text-align:center;padding:var(--space-xs);">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:${bg};color:${col};font-weight:bold;font-size:var(--text-base);">${avg != null ? avg.toFixed(1) : '—'}</span>
                </td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll('.dash-hc-row').forEach(row => {
    row.addEventListener('click', () => { if (typeof openAreaProfile === 'function') openAreaProfile(row.dataset.areaCode, 'healthchecks'); });
  });
}

// ── Loops Overview Dashboard ──────────────────────────────────
function _renderDashLoops() {
  const panel = document.getElementById('dash-panel');
  if (!panel) return;

  const afis  = (window.DPC_DATA.afi&&window.DPC_DATA.afi.afis)||[];
  const areas = _getAreas()||[];

  const byStatus={'open':0,'actioned':0,'impact-checked':0,'closed':0,'re-opened':0};
  afis.forEach(a=>{ if(byStatus.hasOwnProperty(a.status)) byStatus[a.status]++; });

  const byArea={};
  afis.filter(a=>a.status!=='closed').forEach(a=>{
    if(!byArea[a.areaCode]) byArea[a.areaCode]=0;
    byArea[a.areaCode]++;
  });
  const topAreas=Object.entries(byArea).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const bySeverity={[AFI_SEVERITY.IMMEDIATE]:0,[AFI_SEVERITY.STRENGTHEN]:0,[AFI_SEVERITY.STRENGTH]:0};
  afis.filter(a=>a.status!=='closed').forEach(a=>{ if(bySeverity.hasOwnProperty(a.severity)) bySeverity[a.severity]++; });

  panel.innerHTML=`
    <!-- Status summary -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-sm);margin-bottom:var(--space-xl);">
      ${Object.entries(byStatus).map(([status,count])=>{
        const cols={'open':['var(--color-amber-lt)','var(--color-amber)'],'actioned':['var(--color-blue-lt)','var(--color-blue)'],'impact-checked':['var(--color-purple-lt)','var(--color-purple)'],'closed':['var(--color-green-lt)','var(--color-green)'],'re-opened':['var(--color-rose-lt)','var(--color-rose)']};
        const [bg,col]=cols[status]||['var(--color-light)','var(--color-muted)'];
        const label={'open':'Open','actioned':'Actioned','impact-checked':'Impact checked','closed':'Closed','re-opened':'Re-opened'}[status]||status;
        return `<div style="padding:var(--space-md);background:${bg};border-radius:var(--radius-md);text-align:center;">
          <div style="font-size:var(--text-2xl);font-weight:bold;color:${col};">${count}</div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);">${label}</div>
        </div>`;
      }).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);">
      <!-- By severity -->
      <div>
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Open loops by severity</h2>
        ${Object.entries(bySeverity).map(([sev,count])=>{
          const col=sev===AFI_SEVERITY.IMMEDIATE?'var(--color-red)':sev===AFI_SEVERITY.STRENGTHEN?'var(--color-amber)':'var(--color-green)';
          const pct=afis.length>0?Math.round((count/afis.filter(a=>a.status!=='closed').length||1)*100):0;
          return `<div style="margin-bottom:var(--space-md);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:var(--text-sm);color:var(--color-slate);">${sev}</span>
              <span style="font-size:var(--text-sm);font-weight:bold;color:${col};">${count}</span>
            </div>
            <div style="height:8px;background:var(--color-light);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:width 500ms ease;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Top areas with open loops -->
      <div>
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Areas with most open loops</h2>
        ${topAreas.length===0
          ? '<p style="color:var(--color-muted);font-size:var(--text-sm);">No open loops recorded.</p>'
          : topAreas.map(([code,count])=>{
              const area=areas.find(a=>a.areaCode===code);
              return `<div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border);">
                <span style="font-size:var(--text-xs);font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 8px;border-radius:999px;flex-shrink:0;">${_dEsc(code)}</span>
                <span style="font-size:var(--text-sm);color:var(--color-slate);flex:1;">${_dEsc(area?.areaName||code)}</span>
                <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-amber);">${count}</span>
              </div>`;
            }).join('')}
      </div>
    </div>
  `;
}

function _dFmtDate(iso){if(!iso)return'';try{return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}catch{return iso;}}
function _dEsc(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
