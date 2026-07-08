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
    <div id="dash-rag-table" style="overflow-x:auto;"></div>
  `;

  _renderRAGTable();
  document.getElementById('dash-rag-dim')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-score')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-afi')?.addEventListener('change',_renderRAGTable);
  document.getElementById('dash-rag-search')?.addEventListener('input',_renderRAGTable);
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
                <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:${bg};color:${col};font-weight:bold;font-size:var(--text-base);" aria-label="${dim.label}: ${score?RAG_LABELS[score]:'Not scored'}">${score||'—'}</span>
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

// ── Health Check Dashboard ────────────────────────────────────
function _renderDashHC() {
  const panel = document.getElementById('dash-panel');
  if (!panel) return;

  const areas  = _getAreas()||[];
  const hcDims = [
    {id:'digitalLearningEnv',label:'Digital Learning Env'},
    {id:'inclusivePractice',label:'Inclusive Practice'},
    {id:'accessibilityByDesign',label:'Accessibility by Design'},
    {id:'staffCapabilityHC',label:'Staff Capability'},
    {id:'learnerDigitalSkills',label:'Learner Digital Skills'},
  ];

  const areasWithHC = areas.filter(a=>a.healthChecks&&a.healthChecks.length>0);
  const completion  = Math.round((areasWithHC.length/Math.max(areas.length,1))*100);

  panel.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-md);margin-bottom:var(--space-xl);">
      <div style="padding:var(--space-lg);background:var(--color-teal-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-teal);">${areasWithHC.length}/${areas.length}</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Areas completed</div>
      </div>
      <div style="padding:var(--space-lg);background:var(--color-blue-lt);border-radius:var(--radius-md);text-align:center;">
        <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-blue);">${completion}%</div>
        <div style="font-size:var(--text-xs);color:var(--color-muted);">Completion rate</div>
      </div>
      ${hcDims.slice(0,2).map(dim=>{
        const scores=areasWithHC.map(a=>{const hc=a.healthChecks[a.healthChecks.length-1];return hc?.scores?.[dim.id]?.score;}).filter(Boolean);
        const avg=scores.length>0?(scores.reduce((s,x)=>s+x,0)/scores.length).toFixed(1):'—';
        return `<div style="padding:var(--space-lg);background:var(--color-light);border-radius:var(--radius-md);text-align:center;">
          <div style="font-size:var(--text-2xl);font-weight:bold;color:var(--color-navy);">${avg}</div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);">Avg: ${dim.label}</div>
        </div>`;
      }).join('')}
    </div>

    <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Area Health Check scores</h2>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm);">
        <thead>
          <tr style="background:var(--color-navy);">
            <th style="text-align:left;padding:var(--space-sm) var(--space-md);color:var(--color-white);font-size:var(--text-xs);">Area</th>
            <th style="text-align:center;padding:var(--space-sm);color:var(--color-white);font-size:10px;">Last check</th>
            ${hcDims.map(d=>`<th style="text-align:center;padding:var(--space-sm) var(--space-xs);color:var(--color-white);font-size:10px;min-width:80px;">${d.label.split(' ').slice(0,2).join(' ')}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${areas.map((area,ri)=>{
            const checks=area.healthChecks||[];
            const latest=checks.length>0?checks[checks.length-1]:null;
            return `<tr style="background:${ri%2===0?'var(--color-light)':'var(--color-white)'};border-bottom:1px solid var(--color-border);">
              <td style="padding:var(--space-sm) var(--space-md);">
                <span style="font-size:10px;font-weight:bold;background:var(--color-navy);color:var(--color-white);padding:1px 6px;border-radius:999px;margin-right:4px;">${_dEsc(area.areaCode)}</span>
                <span style="color:var(--color-slate);">${_dEsc(area.areaName)}</span>
              </td>
              <td style="text-align:center;font-size:var(--text-xs);color:var(--color-muted);padding:var(--space-sm);">${latest?_dFmtDate(latest.date):'—'}</td>
              ${hcDims.map(dim=>{
                const score=latest?.scores?.[dim.id]?.score;
                const bg=score?['','var(--rag-1-bg)','var(--rag-2-bg)','var(--rag-3-bg)','var(--rag-4-bg)','var(--rag-5-bg)'][score]:'transparent';
                const col=score?['','var(--rag-1-text)','var(--rag-2-text)','var(--rag-3-text)','var(--rag-4-text)','var(--rag-5-text)'][score]:'var(--color-border)';
                return `<td style="text-align:center;padding:var(--space-xs);">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:${bg};color:${col};font-weight:bold;font-size:var(--text-base);">${score||'—'}</span>
                </td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
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
