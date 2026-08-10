/* ================================================================
   areas.js — DPC Impact Hub
   Area selector, area rendering, all 7 tabs
   ================================================================ */

DPC.Areas = {

  currentArea: null,
  currentTab:  'overview',

  // ── AREA SELECTOR ──────────────────────────────────────────────
  renderSelector: function(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const areas = DPC.DB.areas;
    const groups = {};
    areas.forEach(a => {
      if (!groups[a.group]) groups[a.group] = [];
      groups[a.group].push(a);
    });

    let html = `<div class="filter-bar">
      <input type="search" class="form-input" id="area-search" placeholder="Search areas…" style="max-width:280px" aria-label="Search curriculum areas">
    </div>
    <div id="area-selector-content">`;

    Object.keys(groups).sort().forEach(grp => {
      html += `<div class="area-group-label">${DPC.escHtml(grp)}</div>
      <div class="area-selector-grid">`;
      groups[grp].forEach(area => {
        const rag = area.ragRatings?.current?.overall;
        const {label, cls} = DPC.ragLabel(rag);
        html += `<button class="area-selector-card"
          onclick="DPC.Areas.openArea('${area.code}')"
          aria-label="Open ${area.name}: RAG ${label}"
          type="button">
          <div class="area-selector-code">${DPC.escHtml(area.code)}</div>
          <div class="area-selector-name">${DPC.escHtml(area.name)}</div>
          <div class="area-selector-meta">${DPC.escHtml(area.campus || '—')}</div>
          <div class="area-selector-rag">
            ${rag ? `<span class="badge badge-${cls}">${rag} · ${label}</span>` : `<span class="badge badge-ns">Not rated</span>`}
          </div>
        </button>`;
      });
      html += `</div>`;
    });

    html += `</div>`;
    el.innerHTML = html;

    // Search
    const search = document.getElementById('area-search');
    if (search) {
      search.addEventListener('input', () => DPC.Areas.filterSelector(search.value));
    }
  },

  filterSelector: function(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.area-selector-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
    document.querySelectorAll('.area-group-label').forEach(label => {
      const grid = label.nextElementSibling;
      if (!grid) return;
      const anyVisible = [...grid.querySelectorAll('.area-selector-card')].some(c => c.style.display !== 'none');
      label.style.display = anyVisible ? '' : 'none';
      grid.style.display = anyVisible ? '' : 'none';
    });
  },

  // ── OPEN AREA ──────────────────────────────────────────────────
  openArea: function(code, tab) {
    const area = DPC.getArea(code);
    if (!area) return;
    this.currentArea = code;
    this.currentTab  = tab || 'overview';

    // Navigate to area section
    DPC.App.navigateTo('area');
    this.renderArea(code);
    this.switchTab(this.currentTab);

    // Update URL hash
    window.location.hash = `area/${code}/${this.currentTab}`;
  },

  // ── RENDER AREA SHELL ─────────────────────────────────────────
  renderArea: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;

    const rag = area.ragRatings?.current?.overall;
    const {label: ragLabel, cls: ragCls} = DPC.ragLabel(rag);

    // Header
    const headerEl = document.getElementById('area-header-content');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="area-header__top">
          <span class="area-header__code" aria-label="Area code">${DPC.escHtml(area.code)}</span>
          <h2 class="area-header__name">${DPC.escHtml(area.name)}</h2>
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="DPC.App.navigateTo('areas')" type="button">← All Areas</button>
          <button class="btn btn-ghost btn-sm" onclick="DPC.Areas.editAreaDetails('${code}')" type="button">✎ Edit Details</button>
        </div>
        <div class="area-header__meta">
          HoA: <strong>${DPC.escHtml(area.hoaName || '—')}</strong>
          &nbsp;·&nbsp;
          DL: <strong>${DPC.escHtml(area.dlName || 'TBC')}</strong>
          &nbsp;·&nbsp;
          ${DPC.escHtml(area.campus || '—')}
        </div>
        <div class="area-header__scores" id="area-scores-${code}">
          <div class="area-score-pill">RAG: <strong id="score-rag-${code}">${rag ? `${DPC.ragBadge(rag)}` : '<span class="badge badge-ns">Not rated</span>'}</strong></div>
          <div class="area-score-pill">Staff Conf: <strong id="score-staff-${code}">${area.aggregateStaffConfidence ? area.aggregateStaffConfidence.toFixed(1) : '—'}</strong></div>
          <div class="area-score-pill">Health: <strong id="score-health-${code}">${area.aggregateHealthCheckScore ? area.aggregateHealthCheckScore.toFixed(1) : '—'}</strong></div>
        </div>`;
    }

    // Tabs
    const tabsEl = document.getElementById('area-tabs-strip');
    const tabs = [
      {id:'overview',    label:'Overview Card',  icon:'◈'},
      {id:'activity',    label:'Activity Log',   icon:'◉'},
      {id:'interventions',label:'Interventions', icon:'◫'},
      {id:'rag',         label:'RAG Matrix',     icon:'⊡'},
      {id:'skills',      label:'Digital Skills', icon:'◎'},
      {id:'staffdev',    label:'Staff Dev',      icon:'◷'},
      {id:'healthchecks',label:'Health Checks',  icon:'◬'},
    ];

    if (tabsEl) {
      tabsEl.innerHTML = tabs.map(t => `
        <button class="area-tab-btn${this.currentTab===t.id?' active':''}"
          id="tab-btn-${t.id}"
          onclick="DPC.Areas.switchTab('${t.id}')"
          role="tab"
          aria-selected="${this.currentTab===t.id}"
          aria-controls="area-tab-panel-${t.id}"
          type="button">
          <span aria-hidden="true">${t.icon}</span> ${t.label}
        </button>`).join('');
    }

    // Render current tab panel
    this.renderTabPanel(code, this.currentTab);
  },

  // ── SWITCH TAB ─────────────────────────────────────────────────
  switchTab: function(tabId) {
    this.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.area-tab-btn').forEach(btn => {
      const active = btn.id === `tab-btn-${tabId}`;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active);
    });

    // Render panel
    if (this.currentArea) {
      this.renderTabPanel(this.currentArea, tabId);
    }

    window.location.hash = `area/${this.currentArea}/${tabId}`;
  },

  // ── RENDER TAB PANEL ──────────────────────────────────────────
  renderTabPanel: function(code, tabId) {
    const panelEl = document.getElementById('area-tab-panels');
    if (!panelEl) return;
    const area = DPC.getArea(code);
    if (!area) return;

    switch(tabId) {
      case 'overview':     panelEl.innerHTML = this.renderOverviewCard(area); this.wireOverview(code); break;
      case 'activity':     panelEl.innerHTML = this.renderActivityLog(area);  this.wireActivity(code); break;
      case 'interventions':panelEl.innerHTML = this.renderInterventions(area);this.wireInterventions(code); break;
      case 'rag':          panelEl.innerHTML = `<div class="page-inner"><h3 class="section-heading">RAG Matrix</h3><div id="rag-matrix-container-${code}"></div></div>`;
                           DPC.RAG.render(code, `rag-matrix-container-${code}`); break;
      case 'skills':       panelEl.innerHTML = this.renderSkills(area); this.wireSkills(code); break;
      case 'staffdev':     panelEl.innerHTML = this.renderStaffDevPlaceholder(area); break;
      case 'healthchecks': panelEl.innerHTML = this.renderHealthChecks(area); break;
      default:             panelEl.innerHTML = `<div class="page-inner"><div class="empty-state"><div class="empty-state__title">Tab not available</div></div></div>`;
    }
  },

  // ── UPDATE HEADER SCORES ──────────────────────────────────────
  updateHeaderScores: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    const el = document.getElementById(`score-rag-${code}`);
    if (el) el.innerHTML = area.ragRatings.current.overall ? DPC.ragBadge(area.ragRatings.current.overall) : '<span class="badge badge-ns">Not rated</span>';
  },

  // ── TAB 1: OVERVIEW CARD ──────────────────────────────────────
  renderOverviewCard: function(area) {
    const latestActivity = area.activityLog?.[area.activityLog.length - 1];
    const latestKDP = latestActivity?.keyDiscussionPoints || area.m2KDP || area.m1Summary || '—';
    const strengths = area.strengths || area.m2Strengths || area.m1Strengths || '—';
    const gaps = area.generalDigitalSkills?.currentGaps || '—';
    const m2AFIs = area.m2AFIs || '—';
    const nextAction = area.nextPlannedAction || '—';
    const rag = area.ragRatings?.current?.overall;
    const schema = DPC.ragSchema;

    // Phase chips
    const phases = area.afiPhases || [];
    const phaseHtml = phases.length
      ? phases.map(p => `<span class="phase-chip ${p.pyramidLevel || ''}" title="${DPC.escHtml(p.description)}">${p.phaseNumber}. ${DPC.escHtml(p.title)} ${DPC.statusBadge(p.status)}</span>`).join(' ')
      : '<span class="text-muted text-sm">No phases defined yet.</span>';

    // Active actions
    const allActions = (area.activityLog || []).flatMap(e => e.actions || []).filter(a => a.status !== 'completed');
    const actionsHtml = allActions.length
      ? `<div class="table-wrap"><table class="table-base"><thead><tr><th>Action</th><th>Status</th><th>Who</th><th>Target</th></tr></thead><tbody>${allActions.slice(0,5).map(a=>`<tr><td>${DPC.escHtml(a.text)}</td><td>${DPC.statusBadge(a.status)}</td><td>${DPC.escHtml(a.who||'—')}</td><td>${DPC.escHtml(a.targetDate||'—')}</td></tr>`).join('')}</tbody></table></div>`
      : '<span class="text-muted text-sm">No open actions.</span>';

    // Interventions
    const interventions = area.interventions || [];
    const recentInt = interventions.filter(i=>i.status==='completed').slice(-1)[0];
    const nextInt   = interventions.filter(i=>i.status==='planned')[0];
    const intCount  = interventions.length;

    // Dimension scores
    const dims = area.ragRatings?.current;
    let dimHtml = '';
    if (schema && dims) {
      dimHtml = schema.dimensionOrder.map(key => {
        const val = dims[key];
        const dim = schema.dimensions[key];
        const {label, cls} = DPC.ragLabel(val);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--col-border);font-size:var(--text-xs)">
          <span>${dim.icon} ${dim.shortLabel}</span>
          ${val ? `<span class="badge badge-${cls}">${val} · ${label}</span>` : '<span class="badge badge-ns">—</span>'}
        </div>`;
      }).join('');
    }

    return `<div class="page-inner">
      <div class="flex items-center justify-between mb-20">
        <h3 class="section-heading" style="margin-bottom:0">Overview Card</h3>
        <button class="btn btn-primary btn-sm" onclick="DPC.Areas.editAreaDetails('${area.code}')" type="button">✎ Edit Context & Strengths</button>
      </div>

      <div class="overview-grid">
        <div class="overview-cell full">
          <div class="overview-cell-label">Context</div>
          <div class="overview-cell-value" id="overview-context-${area.code}">${DPC.escHtml(area.context) || '<span class="text-muted">No context recorded yet. Click "Edit" to add.</span>'}</div>
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">Key Discussion Points (latest)</div>
          <div class="overview-cell-value">${DPC.escHtml(latestKDP)}</div>
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">Strengths</div>
          <div class="overview-cell-value">${DPC.escHtml(strengths)}</div>
        </div>

        <div class="overview-cell full">
          <div class="overview-cell-label">AFI Phases</div>
          <div class="overview-cell-value" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${phaseHtml}
            <button class="btn btn-ghost btn-sm" onclick="DPC.Areas.addPhaseModal('${area.code}')" type="button">+ Add Phase</button>
          </div>
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">Current AFIs & Next Steps</div>
          <div class="overview-cell-value">${DPC.escHtml(m2AFIs) || DPC.escHtml(gaps)}</div>
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">Next Planned Action</div>
          <div class="overview-cell-value">${DPC.escHtml(nextAction)}</div>
        </div>

        <div class="overview-cell full">
          <div class="overview-cell-label">Open Activity Actions</div>
          ${actionsHtml}
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">Interventions</div>
          <div class="overview-cell-value">
            <strong>${intCount}</strong> total<br>
            ${nextInt ? `Next planned: <strong>${DPC.escHtml(nextInt.name)}</strong>` : 'No planned interventions.'}<br>
            ${recentInt ? `Last completed: <em>${DPC.escHtml(recentInt.name)}</em>` : ''}
          </div>
        </div>

        <div class="overview-cell">
          <div class="overview-cell-label">8-Dimension RAG Scores</div>
          <div class="overview-cell-value">${dimHtml || '<span class="text-muted text-sm">Not yet rated. Go to RAG Matrix tab.</span>'}</div>
        </div>
      </div>
    </div>`;
  },

  wireOverview: function(code) {},

  // ── AREA DETAIL EDIT MODAL ────────────────────────────────────
  editAreaDetails: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    const body = `
      <div class="form-field">
        <label class="form-label" for="edit-context">Context (long-lasting notes about this area)</label>
        <textarea class="form-textarea tall" id="edit-context">${DPC.escHtml(area.context)}</textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-strengths">Strengths</label>
        <textarea class="form-textarea" id="edit-strengths">${DPC.escHtml(area.strengths)}</textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-hoa">Head of Area</label>
        <input class="form-input" id="edit-hoa" value="${DPC.escHtml(area.hoaName)}">
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-dl">Digital Lead</label>
        <input class="form-input" id="edit-dl" value="${DPC.escHtml(area.dlName)}">
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-campus">Campus</label>
        <input class="form-input" id="edit-campus" value="${DPC.escHtml(area.campus)}">
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-next-action">Next Planned Action</label>
        <textarea class="form-textarea" id="edit-next-action">${DPC.escHtml(area.nextPlannedAction)}</textarea>
      </div>`;

    DPC.App.openModal(`Edit ${area.code} — ${area.name}`, body, () => {
      area.context        = document.getElementById('edit-context')?.value || '';
      area.strengths      = document.getElementById('edit-strengths')?.value || '';
      area.hoaName        = document.getElementById('edit-hoa')?.value || '';
      area.dlName         = document.getElementById('edit-dl')?.value || '';
      area.campus         = document.getElementById('edit-campus')?.value || '';
      area.nextPlannedAction = document.getElementById('edit-next-action')?.value || '';
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.renderArea(code);
      DPC.showToast('Area details saved');
    });
  },

  // ── ADD PHASE MODAL ───────────────────────────────────────────
  addPhaseModal: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    const nextNum = (area.afiPhases?.length || 0) + 1;
    const body = `
      <div class="form-field">
        <label class="form-label" for="phase-num">Phase Number</label>
        <input class="form-input" id="phase-num" type="number" value="${nextNum}" min="1">
      </div>
      <div class="form-field">
        <label class="form-label" for="phase-title">Phase Title (free-form)</label>
        <input class="form-input" id="phase-title" placeholder="e.g. Confirm Digital Lead and baseline">
      </div>
      <div class="form-field">
        <label class="form-label" for="phase-desc">Description</label>
        <textarea class="form-textarea" id="phase-desc"></textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="phase-level">Pyramid Level</label>
        <select class="form-select" id="phase-level">
          <option value="auto">Auto (based on RAG score)</option>
          <option value="found">Foundations</option>
          <option value="incl">Inclusion</option>
          <option value="innov">Innovation</option>
        </select>
      </div>`;

    DPC.App.openModal('Add AFI Phase', body, () => {
      const phase = {
        id: DPC.uid(),
        phaseNumber: parseInt(document.getElementById('phase-num')?.value) || nextNum,
        title: document.getElementById('phase-title')?.value || '',
        description: document.getElementById('phase-desc')?.value || '',
        pyramidLevel: document.getElementById('phase-level')?.value || 'auto',
        status: 'not-started',
        createdAt: new Date().toISOString()
      };
      if (!area.afiPhases) area.afiPhases = [];
      area.afiPhases.push(phase);
      area.afiPhases.sort((a,b) => a.phaseNumber - b.phaseNumber);
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.renderArea(code);
      DPC.showToast('Phase added');
    });
  },

  // ── TAB 2: ACTIVITY LOG ───────────────────────────────────────
  renderActivityLog: function(area) {
    const log = [...(area.activityLog || [])].reverse();
    const typeOpts = ['meeting','conversation','message','observation','email','other'];

    let rows = '';
    if (!log.length) {
      rows = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state__icon">◷</div><div class="empty-state__title">No activity logged yet</div><div class="empty-state__body">Click "+ Log Activity" to add the first entry.</div></div></td></tr>`;
    } else {
      log.forEach(entry => {
        const actionCount = entry.actions?.length || 0;
        const openCount = entry.actions?.filter(a=>a.status!=='completed').length || 0;
        rows += `<tr class="activity-row" onclick="DPC.Areas.toggleActivityRow('${entry.id}')">
          <td style="white-space:nowrap">${DPC.escHtml(entry.date || '—')}</td>
          <td><span class="badge badge-ns">${DPC.escHtml(entry.type)}</span></td>
          <td>${DPC.escHtml((entry.keyDiscussionPoints || entry.notes || '').slice(0,80))}${(entry.notes||'').length > 80 ? '…' : ''}</td>
          <td>${actionCount > 0 ? `${openCount} open / ${actionCount} total` : '—'}</td>
          <td class="actions-col">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.Areas.editActivityEntry('${area.code}','${entry.id}')" type="button">✎</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.Areas.deleteActivityEntry('${area.code}','${entry.id}')" type="button" aria-label="Delete entry">✕</button>
          </td>
        </tr>
        <tr id="expand-${entry.id}" class="activity-expand" style="display:none">
          <td colspan="5">
            <div class="activity-expand-inner">
              <div style="white-space:pre-wrap;font-size:var(--text-sm);margin-bottom:10px">${DPC.escHtml(entry.notes)}</div>
              ${this.renderActionsTable(entry, area.code)}
            </div>
          </td>
        </tr>`;
      });
    }

    return `<div class="page-inner">
      <div class="flex items-center justify-between mb-16">
        <h3 class="section-heading" style="margin-bottom:0">Activity Log</h3>
        <button class="btn btn-primary" onclick="DPC.Areas.addActivityModal('${area.code}')" type="button">+ Log Activity</button>
      </div>
      <div class="table-wrap">
        <table class="table-base" aria-label="Activity log for ${DPC.escHtml(area.name)}">
          <thead><tr>
            <th>Date</th><th>Type</th><th>Notes / Key Points</th><th>Actions</th><th>Edit</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },

  renderActionsTable: function(entry, areaCode) {
    const actions = entry.actions || [];
    if (!actions.length) return `<div class="text-muted text-sm">No actions logged.
      <button class="btn btn-ghost btn-sm" onclick="DPC.Areas.addActionToEntry('${areaCode}','${entry.id}')" type="button">+ Add Action</button>
    </div>`;

    return `<table class="action-table" aria-label="Actions for this activity">
      <thead><tr><th>Action</th><th>Status</th><th>Phase</th><th>Who</th><th>Target Date</th><th></th></tr></thead>
      <tbody>
        ${actions.map(a => `<tr>
          <td>${DPC.escHtml(a.text)}</td>
          <td><select aria-label="Status" onchange="DPC.Areas.updateActionStatus('${areaCode}','${entry.id}','${a.id}',this.value)" style="font-size:var(--text-xs);padding:2px 4px">
            <option value="not-started"${a.status==='not-started'?' selected':''}>Not Started</option>
            <option value="in-progress"${a.status==='in-progress'?' selected':''}>In Progress</option>
            <option value="completed"${a.status==='completed'?' selected':''}>Completed</option>
          </select></td>
          <td>${DPC.escHtml(a.afiPhaseId || '—')}</td>
          <td>${DPC.escHtml(a.who || '—')}</td>
          <td>${DPC.escHtml(a.targetDate || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="DPC.Areas.deleteAction('${areaCode}','${entry.id}','${a.id}')" type="button" aria-label="Delete action">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-ghost btn-sm mt-8" onclick="DPC.Areas.addActionToEntry('${areaCode}','${entry.id}')" type="button">+ Add Action</button>`;
  },

  wireActivity: function(code) {},

  toggleActivityRow: function(entryId) {
    const row = document.getElementById(`expand-${entryId}`);
    if (!row) return;
    const visible = row.style.display !== 'none';
    row.style.display = visible ? 'none' : '';
  },

  addActivityModal: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    const typeOpts = ['meeting','conversation','message','observation','email','other'];
    const phaseOpts = (area.afiPhases || []).map(p => `<option value="${p.id}">${p.phaseNumber}. ${DPC.escHtml(p.title)}</option>`).join('');

    const body = `
      <div class="grid-2">
        <div class="form-field">
          <label class="form-label" for="act-date">Date</label>
          <input class="form-input" id="act-date" type="date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label" for="act-type">Type</label>
          <select class="form-select" id="act-type">
            ${typeOpts.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label" for="act-notes">Notes</label>
        <textarea class="form-textarea tall" id="act-notes" placeholder="Full notes from this activity…"></textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="act-kdp">Key Discussion Points (for Overview Card)</label>
        <textarea class="form-textarea" id="act-kdp" placeholder="Summary of key points…"></textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="act-action">Initial Action (optional)</label>
        <input class="form-input" id="act-action" placeholder="Action text…">
      </div>
      <div class="grid-2">
        <div class="form-field">
          <label class="form-label" for="act-who">Action Owner</label>
          <input class="form-input" id="act-who" value="Graeme Wright">
        </div>
        <div class="form-field">
          <label class="form-label" for="act-date2">Target Date</label>
          <input class="form-input" id="act-date2" type="date">
        </div>
      </div>
      ${phaseOpts ? `<div class="form-field">
        <label class="form-label" for="act-phase">Link to AFI Phase (optional)</label>
        <select class="form-select" id="act-phase">
          <option value="">— none —</option>${phaseOpts}
        </select>
      </div>` : ''}`;

    DPC.App.openModal(`Log Activity — ${area.code}`, body, () => {
      const actionText = document.getElementById('act-action')?.value?.trim();
      const entry = {
        id: DPC.uid(),
        date: document.getElementById('act-date')?.value || '',
        type: document.getElementById('act-type')?.value || 'meeting',
        notes: document.getElementById('act-notes')?.value || '',
        keyDiscussionPoints: document.getElementById('act-kdp')?.value || '',
        actions: actionText ? [{
          id: DPC.uid(),
          text: actionText,
          status: 'not-started',
          afiPhaseId: document.getElementById('act-phase')?.value || null,
          who: document.getElementById('act-who')?.value || '',
          targetDate: document.getElementById('act-date2')?.value || '',
          completedDate: null
        }] : []
      };
      if (!area.activityLog) area.activityLog = [];
      area.activityLog.push(entry);
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('activity');
      DPC.showToast('Activity logged');
    });
  },

  editActivityEntry: function(code, entryId) {
    const area = DPC.getArea(code);
    const entry = area?.activityLog?.find(e=>e.id===entryId);
    if (!entry) return;
    const typeOpts = ['meeting','conversation','message','observation','email','other'];
    const body = `
      <div class="grid-2">
        <div class="form-field">
          <label class="form-label" for="edit-act-date">Date</label>
          <input class="form-input" id="edit-act-date" type="date" value="${DPC.escHtml(entry.date)}">
        </div>
        <div class="form-field">
          <label class="form-label" for="edit-act-type">Type</label>
          <select class="form-select" id="edit-act-type">
            ${typeOpts.map(t=>`<option value="${t}"${entry.type===t?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-act-notes">Notes</label>
        <textarea class="form-textarea tall" id="edit-act-notes">${DPC.escHtml(entry.notes)}</textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="edit-act-kdp">Key Discussion Points</label>
        <textarea class="form-textarea" id="edit-act-kdp">${DPC.escHtml(entry.keyDiscussionPoints)}</textarea>
      </div>`;

    DPC.App.openModal(`Edit Activity — ${area.code}`, body, () => {
      entry.date = document.getElementById('edit-act-date')?.value || '';
      entry.type = document.getElementById('edit-act-type')?.value || 'meeting';
      entry.notes = document.getElementById('edit-act-notes')?.value || '';
      entry.keyDiscussionPoints = document.getElementById('edit-act-kdp')?.value || '';
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('activity');
      DPC.showToast('Activity updated');
    });
  },

  deleteActivityEntry: function(code, entryId) {
    if (!confirm('Delete this activity entry?')) return;
    const area = DPC.getArea(code);
    if (!area) return;
    area.activityLog = area.activityLog.filter(e=>e.id!==entryId);
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.Areas.switchTab('activity');
  },

  addActionToEntry: function(code, entryId) {
    const area = DPC.getArea(code);
    const entry = area?.activityLog?.find(e=>e.id===entryId);
    if (!entry) return;
    const phaseOpts = (area.afiPhases||[]).map(p=>`<option value="${p.id}">${p.phaseNumber}. ${DPC.escHtml(p.title)}</option>`).join('');
    const body = `
      <div class="form-field">
        <label class="form-label" for="new-act-text">Action</label>
        <input class="form-input" id="new-act-text">
      </div>
      <div class="grid-2">
        <div class="form-field">
          <label class="form-label" for="new-act-who">Who</label>
          <input class="form-input" id="new-act-who" value="Graeme Wright">
        </div>
        <div class="form-field">
          <label class="form-label" for="new-act-date">Target Date</label>
          <input class="form-input" id="new-act-date" type="date">
        </div>
      </div>
      ${phaseOpts ? `<div class="form-field">
        <label class="form-label" for="new-act-phase">AFI Phase</label>
        <select class="form-select" id="new-act-phase"><option value="">— none —</option>${phaseOpts}</select>
      </div>` : ''}`;

    DPC.App.openModal('Add Action', body, () => {
      const action = {
        id: DPC.uid(),
        text: document.getElementById('new-act-text')?.value || '',
        status: 'not-started',
        afiPhaseId: document.getElementById('new-act-phase')?.value || null,
        who: document.getElementById('new-act-who')?.value || '',
        targetDate: document.getElementById('new-act-date')?.value || '',
        completedDate: null
      };
      if (!entry.actions) entry.actions = [];
      entry.actions.push(action);
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('activity');
      DPC.showToast('Action added');
    });
  },

  updateActionStatus: function(code, entryId, actionId, status) {
    const area = DPC.getArea(code);
    const entry = area?.activityLog?.find(e=>e.id===entryId);
    const action = entry?.actions?.find(a=>a.id===actionId);
    if (!action) return;
    action.status = status;
    if (status === 'completed') action.completedDate = new Date().toISOString().split('T')[0];
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
  },

  deleteAction: function(code, entryId, actionId) {
    if (!confirm('Delete this action?')) return;
    const area = DPC.getArea(code);
    const entry = area?.activityLog?.find(e=>e.id===entryId);
    if (!entry) return;
    entry.actions = entry.actions.filter(a=>a.id!==actionId);
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.Areas.switchTab('activity');
  },

  // ── TAB 3: INTERVENTIONS ──────────────────────────────────────
  renderInterventions: function(area) {
    const interventions = area.interventions || [];
    const types = ['coaching','teach-meet','meeting','planning','co-planning','health-check','support','learning-walk','observation','workshop','cpd','peer-review','other'];

    let cards = '';
    if (!interventions.length) {
      cards = `<div class="empty-state"><div class="empty-state__icon">◫</div><div class="empty-state__title">No interventions recorded</div><div class="empty-state__body">Click "+ Add Intervention" to plan your first intervention for this area.</div></div>`;
    } else {
      [...interventions].reverse().forEach(intv => {
        cards += `<div class="intervention-card" id="intv-card-${intv.id}">
          <button class="intervention-card-header"
            onclick="DPC.Areas.toggleIntervention('${intv.id}')"
            aria-expanded="false" aria-controls="intv-body-${intv.id}" type="button">
            <span>${DPC.statusBadge(intv.status)}</span>
            <strong style="flex:1;text-align:left">${DPC.escHtml(intv.name)}</strong>
            <span class="badge badge-ns" style="margin-right:4px">${DPC.escHtml(intv.type)}</span>
            <span class="text-muted text-xs">${intv.dates?.[0] ? DPC.formatDate(intv.dates[0]) : '—'}</span>
            <span class="text-muted" style="margin-left:8px" aria-hidden="true">▾</span>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.Areas.editIntervention('${area.code}','${intv.id}')" type="button">✎</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.Areas.deleteIntervention('${area.code}','${intv.id}')" type="button" aria-label="Delete">✕</button>
          </button>
          <div class="intervention-card-body" id="intv-body-${intv.id}">
            ${intv.objectives ? `<div class="intervention-field"><div class="intervention-field-label">Objectives</div><div class="intervention-field-value">${DPC.escHtml(intv.objectives)}</div></div>` : ''}
            ${intv.plan ? `<div class="intervention-field"><div class="intervention-field-label">Plan</div><div class="intervention-field-value">${DPC.escHtml(intv.plan)}</div></div>` : ''}
            ${intv.reflectionNotes ? `<div class="intervention-field"><div class="intervention-field-label">Reflection</div><div class="intervention-field-value">${DPC.escHtml(intv.reflectionNotes)}</div></div>` : ''}
            ${intv.attendance ? `<div class="intervention-field"><div class="intervention-field-label">Attendance</div><div class="intervention-field-value">${intv.attendance} staff</div></div>` : ''}
            ${intv.furtherActionNeeded ? `<div class="intervention-field"><div class="intervention-field-label">Further Action Needed</div><div class="intervention-field-value">${DPC.escHtml(intv.furtherActionNeeded)}</div></div>` : ''}
          </div>
        </div>`;
      });
    }

    return `<div class="page-inner">
      <div class="flex items-center justify-between mb-16">
        <h3 class="section-heading" style="margin-bottom:0">Interventions</h3>
        <button class="btn btn-primary" onclick="DPC.Areas.addInterventionModal('${area.code}')" type="button">+ Add Intervention</button>
      </div>
      ${cards}
    </div>`;
  },

  wireInterventions: function(code) {},

  toggleIntervention: function(id) {
    const body = document.getElementById(`intv-body-${id}`);
    const btn  = body?.previousElementSibling;
    if (!body) return;
    const open = body.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', open);
  },

  addInterventionModal: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    const types = ['coaching','teach-meet','meeting','planning','co-planning','health-check','support','learning-walk','observation','workshop','cpd','peer-review','other'];
    const phaseOpts = (area.afiPhases||[]).map(p=>`<option value="${p.id}">${p.phaseNumber}. ${DPC.escHtml(p.title)}</option>`).join('');

    const body = `
      <div class="form-field">
        <label class="form-label" for="intv-name">Intervention Name</label>
        <input class="form-input" id="intv-name" placeholder="Describe this intervention…">
      </div>
      <div class="grid-2">
        <div class="form-field">
          <label class="form-label" for="intv-type">Type</label>
          <select class="form-select" id="intv-type">${types.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label class="form-label" for="intv-date">Date</label>
          <input class="form-input" id="intv-date" type="date" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      ${phaseOpts ? `<div class="form-field">
        <label class="form-label" for="intv-phase">AFI Phase</label>
        <select class="form-select" id="intv-phase"><option value="">Standalone</option>${phaseOpts}</select>
      </div>` : ''}
      <div class="form-field">
        <label class="form-label" for="intv-objectives">Objectives</label>
        <textarea class="form-textarea" id="intv-objectives"></textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="intv-plan">Plan / Notes</label>
        <textarea class="form-textarea tall" id="intv-plan"></textarea>
      </div>
      <div class="form-field">
        <label class="form-label" for="intv-impact">Expected Impact</label>
        <textarea class="form-textarea" id="intv-impact"></textarea>
      </div>`;

    DPC.App.openModal(`Add Intervention — ${area.code}`, body, () => {
      const intv = {
        id: DPC.uid(),
        name: document.getElementById('intv-name')?.value || '',
        type: document.getElementById('intv-type')?.value || 'coaching',
        dates: [document.getElementById('intv-date')?.value || ''],
        afiPhaseId: document.getElementById('intv-phase')?.value || 'standalone',
        audienceType: ['teaching-staff'],
        objectives: document.getElementById('intv-objectives')?.value || '',
        plan: document.getElementById('intv-plan')?.value || '',
        expectedImpact: document.getElementById('intv-impact')?.value || '',
        attendance: null,
        attendeeNames: '',
        reflectionNotes: '',
        furtherActionNeeded: '',
        status: 'planned'
      };
      if (!area.interventions) area.interventions = [];
      area.interventions.push(intv);
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('interventions');
      DPC.showToast('Intervention added');
    });
  },

  editIntervention: function(code, id) {
    const area = DPC.getArea(code);
    const intv = area?.interventions?.find(i=>i.id===id);
    if (!intv) return;

    const body = `
      <div class="form-field"><label class="form-label">Name</label><input class="form-input" id="edit-intv-name" value="${DPC.escHtml(intv.name)}"></div>
      <div class="form-field"><label class="form-label" for="edit-intv-status">Status</label>
        <select class="form-select" id="edit-intv-status">
          <option value="planned"${intv.status==='planned'?' selected':''}>Planned</option>
          <option value="completed"${intv.status==='completed'?' selected':''}>Completed</option>
          <option value="cancelled"${intv.status==='cancelled'?' selected':''}>Cancelled</option>
        </select>
      </div>
      <div class="form-field"><label class="form-label">Attendance (number of staff)</label><input class="form-input" id="edit-intv-att" type="number" value="${intv.attendance||''}"></div>
      <div class="form-field"><label class="form-label">Attendee Names</label><textarea class="form-textarea" id="edit-intv-attnames">${DPC.escHtml(intv.attendeeNames)}</textarea></div>
      <div class="form-field"><label class="form-label">Reflection Notes</label><textarea class="form-textarea tall" id="edit-intv-reflection">${DPC.escHtml(intv.reflectionNotes)}</textarea></div>
      <div class="form-field"><label class="form-label">Further Action Needed</label><textarea class="form-textarea" id="edit-intv-further">${DPC.escHtml(intv.furtherActionNeeded)}</textarea></div>`;

    DPC.App.openModal(`Edit Intervention — ${intv.name}`, body, () => {
      intv.name = document.getElementById('edit-intv-name')?.value || '';
      intv.status = document.getElementById('edit-intv-status')?.value || 'planned';
      intv.attendance = parseInt(document.getElementById('edit-intv-att')?.value) || null;
      intv.attendeeNames = document.getElementById('edit-intv-attnames')?.value || '';
      intv.reflectionNotes = document.getElementById('edit-intv-reflection')?.value || '';
      intv.furtherActionNeeded = document.getElementById('edit-intv-further')?.value || '';
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('interventions');
      DPC.showToast('Intervention updated');
    });
  },

  deleteIntervention: function(code, id) {
    if (!confirm('Delete this intervention?')) return;
    const area = DPC.getArea(code);
    if (!area) return;
    area.interventions = area.interventions.filter(i=>i.id!==id);
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.Areas.switchTab('interventions');
  },

  // ── TAB 5: DIGITAL SKILLS ─────────────────────────────────────
  renderSkills: function(area) {
    const gds = area.generalDigitalSkills || {};
    const ids = area.industryDigitalSkills || {};

    return `<div class="page-inner">
      <div class="flex items-center justify-between mb-16">
        <h3 class="section-heading" style="margin-bottom:0">Digital Skills</h3>
        <button class="btn btn-primary btn-sm" onclick="DPC.Areas.saveSkills('${area.code}')" type="button">Save Skills Data</button>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">General Digital Skills</span></div>
          <div class="card-body">
            <div class="form-field">
              <label class="form-label" for="gds-list">Curriculum Skills List</label>
              <textarea class="form-textarea" id="gds-list">${DPC.escHtml(gds.curriculumSkillsList)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="gds-gaps">Current Gaps</label>
              <textarea class="form-textarea" id="gds-gaps">${DPC.escHtml(gds.currentGaps)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="gds-plan">Gap Narrowing Plan</label>
              <textarea class="form-textarea" id="gds-plan">${DPC.escHtml(gds.gapNarrowingPlan)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="gds-tracking">Progress Tracking Plan</label>
              <textarea class="form-textarea" id="gds-tracking">${DPC.escHtml(gds.progressTrackingPlan)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="gds-data">Progress Data</label>
              <textarea class="form-textarea" id="gds-data">${DPC.escHtml(gds.progressData)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="gds-century">Century Average Data</label>
              <textarea class="form-textarea" id="gds-century">${DPC.escHtml(gds.centuryAverageData)}</textarea>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Industry-Specific Digital Skills</span></div>
          <div class="card-body">
            <div class="form-field">
              <label class="form-label" for="ids-list">Industry Skills List</label>
              <textarea class="form-textarea" id="ids-list">${DPC.escHtml(ids.curriculumSkillsList)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="ids-baseline">Learner Baseline Data</label>
              <textarea class="form-textarea" id="ids-baseline">${DPC.escHtml(ids.learnerBaselineData)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="ids-gaps">Current Gaps</label>
              <textarea class="form-textarea" id="ids-gaps">${DPC.escHtml(ids.currentGaps)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="ids-plan">Gap Narrowing Plan</label>
              <textarea class="form-textarea" id="ids-plan">${DPC.escHtml(ids.gapNarrowingPlan)}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="ids-data">Progress Data</label>
              <textarea class="form-textarea" id="ids-data">${DPC.escHtml(ids.progressData)}</textarea>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  wireSkills: function(code) {},

  saveSkills: function(code) {
    const area = DPC.getArea(code);
    if (!area) return;
    area.generalDigitalSkills = {
      curriculumSkillsList: document.getElementById('gds-list')?.value || '',
      currentGaps:          document.getElementById('gds-gaps')?.value || '',
      gapNarrowingPlan:     document.getElementById('gds-plan')?.value || '',
      progressTrackingPlan: document.getElementById('gds-tracking')?.value || '',
      progressData:         document.getElementById('gds-data')?.value || '',
      centuryAverageData:   document.getElementById('gds-century')?.value || '',
      curriculumPlanningScore: area.generalDigitalSkills?.curriculumPlanningScore || null
    };
    area.industryDigitalSkills = {
      curriculumSkillsList: document.getElementById('ids-list')?.value || '',
      learnerBaselineData:  document.getElementById('ids-baseline')?.value || '',
      currentGaps:          document.getElementById('ids-gaps')?.value || '',
      gapNarrowingPlan:     document.getElementById('ids-plan')?.value || '',
      progressData:         document.getElementById('ids-data')?.value || '',
      curriculumPlanningScore: area.industryDigitalSkills?.curriculumPlanningScore || null
    };
    DPC.saveToLocalStorage();
    DPC.App.markUnsaved();
    DPC.showToast('Digital skills saved');
  },

  // ── PHASE 2 PLACEHOLDERS ──────────────────────────────────────
  renderStaffDevPlaceholder: function(area) {
    return `<div class="page-inner">
      <h3 class="section-heading">Staff Development</h3>
      <div class="empty-state">
        <div class="empty-state__icon">◎</div>
        <div class="empty-state__title">Phase 2 Feature</div>
        <div class="empty-state__body">Staff digital development needs matrix (industry confidence + pedagogy dimensions), gap analysis, and auto-prioritised action plans will be available in Phase 2.</div>
      </div>
    </div>`;
  },

  // ── TAB 7: HEALTH CHECKS ─────────────────────────────────────────
  // Schema-driven: 5 dimensions × 5 indicators × 5 levels
  // Each indicator scored independently 1–5; dimension avg = mean of rated indicators
  // Success criteria per indicator per level loaded from data/hc-schema.json

  HC_METHODS: [
    { value: 'learning-walk',   label: 'Learning Walk' },
    { value: 'meeting',         label: 'Meeting' },
    { value: 'training-cpd',    label: 'Training / CPD' },
    { value: 'self-reflection', label: 'Self-Reflection' },
    { value: 'observation',     label: 'Observation' },
    { value: 'learner-voice',   label: 'Learner Voice' }
  ],

  HC_SCALE: [
    { value: 1, label: 'Urgent',     color: '#dc2626' },
    { value: 2, label: 'Challenged', color: '#ea580c' },
    { value: 3, label: 'Developing', color: '#ca8a04' },
    { value: 4, label: 'On Track',   color: '#16a34a' },
    { value: 5, label: 'Confident',  color: '#0284c7' }
  ],

  // ── HELPERS ──────────────────────────────────────────────────────

  _hcColor: function(score) {
    const s = DPC.Areas.HC_SCALE.find(s => s.value === Math.round(score));
    return s?.color || 'var(--col-muted)';
  },

  // Read per-indicator scores for a dimension from a record
  // record.scores[dimKey] is now { indicators: {0:n,…}, avg: n } or legacy integer
  _getIndicatorScores: function(record, dimKey) {
    const raw = record?.scores?.[dimKey];
    if (raw === null || raw === undefined) return { indicators: {}, avg: null };
    if (typeof raw === 'number') return { indicators: {}, avg: raw, _legacy: raw };
    return { indicators: raw.indicators || {}, avg: raw.avg };
  },

  _calcIndicatorAvg: function(indicators) {
    const vals = Object.values(indicators).filter(v => v !== null && v !== undefined);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10;
  },

  _calcHCAggregate: function(records) {
    if (!records || !records.length) return null;
    const schema = DPC.hcSchema;
    const dimKeys = schema ? Object.keys(schema.dimensions) : [];
    const allAvgs = records.flatMap(r =>
      dimKeys.map(k => DPC.Areas._getIndicatorScores(r, k).avg).filter(v => v !== null)
    );
    if (!allAvgs.length) return null;
    return Math.round((allAvgs.reduce((a,b)=>a+b,0) / allAvgs.length) * 10) / 10;
  },

  // ── MAIN RENDER ───────────────────────────────────────────────────

  renderHealthChecks: function(area) {
    const schema  = DPC.hcSchema;
    const hc      = area.healthChecks || { records: [], aggregateScore: null };
    const records = hc.records || [];
    const aggregate = this._calcHCAggregate(records);

    if (!schema) {
      return `<div class="page-inner"><div class="empty-state">
        <div class="empty-state__title">Health Check schema loading…</div>
        <div class="empty-state__body">Try switching away and back to this tab.</div>
      </div></div>`;
    }

    const dims = Object.entries(schema.dimensions);

    // Aggregate summary
    const aggHtml = aggregate !== null
      ? `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          ${dims.map(([dk, dim]) => {
            const avgs = records.map(r => DPC.Areas._getIndicatorScores(r, dk).avg).filter(v=>v!==null);
            const avg  = avgs.length ? (avgs.reduce((a,b)=>a+b,0)/avgs.length) : null;
            const color = avg ? DPC.Areas._hcColor(avg) : 'var(--col-border)';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px">
              <div style="font-size:1.1rem" aria-hidden="true">${dim.icon}</div>
              <div style="font-size:1.4rem;font-weight:700;font-family:var(--font-mono);color:${color}">${avg?avg.toFixed(1):'—'}</div>
              <div style="font-size:.6rem;color:var(--col-muted);text-align:center;line-height:1.2">${dim.label}</div>
            </div>`;
          }).join('')}
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:1.8rem;font-weight:700;font-family:var(--font-mono);color:${DPC.Areas._hcColor(aggregate)}">${aggregate.toFixed(1)}</div>
            <div style="font-size:.72rem;color:var(--col-muted)">Overall · ${records.length} record${records.length!==1?'s':''}</div>
          </div>
        </div>`
      : `<div style="color:var(--col-muted);font-size:.875rem">No records yet — add the first health check below.</div>`;

    // Open action points across all records
    const allActions = records.flatMap(r => (r.actionPoints||[]).map(ap=>({...ap,recordId:r.id,staffName:r.staffName,date:r.date})));
    const openActions = allActions.filter(ap=>ap.status!=='completed');

    const recordsHtml = records.length === 0
      ? `<div class="empty-state" style="padding:32px 0">
           <div class="empty-state__icon">◬</div>
           <div class="empty-state__title">No health checks recorded</div>
           <div class="empty-state__body">Click "+ Add Health Check" to record the first assessment.</div>
         </div>`
      : [...records].reverse().map(r => this._renderHCRecord(r, area.code, schema)).join('');

    return `<div class="page-inner">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div>
          <h3 class="section-heading" style="margin-bottom:0">Health Checks</h3>
          <p style="font-size:.82rem;color:var(--col-muted);margin-top:2px">5 dimensions · 5 indicators each · Per-indicator scoring · Success criteria for every level</p>
        </div>
        <button class="btn btn-primary" onclick="DPC.Areas.showAddHCModal('${area.code}')" type="button">+ Add Health Check</button>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><span class="card-title">Aggregate Scores</span></div>
        <div class="card-body">${aggHtml}</div>
      </div>

      ${openActions.length ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <span class="card-title">Open Action Points</span>
          <span class="badge badge-ip">${openActions.length} open</span>
        </div>
        <div class="card-body" style="padding:0">
          <table class="table-base" aria-label="Open health check action points">
            <thead><tr><th>Staff</th><th>Action</th><th>Deadline</th><th>Owner</th><th>Status</th></tr></thead>
            <tbody>
              ${openActions.map(ap=>`<tr>
                <td style="font-size:.78rem">${DPC.escHtml(ap.staffName||'—')}</td>
                <td style="font-size:.82rem">${DPC.escHtml(ap.plannedAction||'—')}</td>
                <td style="font-size:.75rem;white-space:nowrap;font-family:var(--font-mono)">${ap.deadline||'—'}</td>
                <td style="font-size:.78rem">${DPC.escHtml(ap.ownership||'—')}</td>
                <td><select aria-label="Status" style="font-size:.7rem;padding:2px 4px;border:1px solid var(--col-border);border-radius:var(--radius);background:var(--col-surface);color:var(--col-text)"
                  onchange="DPC.Areas.updateHCActionStatus('${area.code}','${ap.recordId}','${ap.id}',this.value)">
                  <option value="not-started"${ap.status==='not-started'?' selected':''}>Not Started</option>
                  <option value="in-progress"${ap.status==='in-progress'?' selected':''}>In Progress</option>
                  <option value="completed"${ap.status==='completed'?' selected':''}>Completed</option>
                </select></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <h4 style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--col-muted);margin-bottom:10px">
        Assessment Records (${records.length})
      </h4>
      <div id="hc-records-${area.code}">${recordsHtml}</div>
    </div>`;
  },

  // ── RECORD CARD ──────────────────────────────────────────────────

  _renderHCRecord: function(r, areaCode, schema) {
    const method = this.HC_METHODS.find(m=>m.value===r.assessmentMethod)||{label:r.assessmentMethod||'—'};
    const dims = Object.entries(schema.dimensions);

    // Compact dimension score pills
    const dimPills = dims.map(([dk,dim]) => {
      const d = DPC.Areas._getIndicatorScores(r, dk);
      const avg = d.avg;
      const color = avg ? DPC.Areas._hcColor(avg) : 'var(--col-border)';
      return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:.7rem;padding:2px 7px;border-radius:999px;
        background:${avg?color+'22':'var(--col-surface-2)'};color:${avg?color:'var(--col-muted)'};
        border:1px solid ${avg?color+'44':'var(--col-border)'}" title="${dim.label}: ${avg?avg.toFixed(1)+' avg':'not rated'}">
        <span aria-hidden="true">${dim.icon}</span> ${avg?avg.toFixed(1):'—'}
      </span>`;
    }).join('');

    const aps = r.actionPoints || [];

    return `<div class="intervention-card" id="hc-record-${r.id}" style="margin-bottom:10px">
      <button class="intervention-card-header" type="button"
        onclick="DPC.Areas.toggleHCRecord('${r.id}')"
        aria-expanded="false" aria-controls="hc-body-${r.id}">
        <div style="flex:1;text-align:left">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <strong style="font-size:.875rem">${DPC.escHtml(r.staffName||'Unnamed')}</strong>
            <span class="badge badge-ns" style="font-size:.68rem">${DPC.escHtml(method.label)}</span>
            <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--col-muted)">${r.date||'—'}</span>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">${dimPills}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${aps.length?`<span class="badge badge-ip" style="font-size:.65rem">${aps.filter(a=>a.status!=='completed').length}/${aps.length}</span>`:''}
          <button class="btn btn-ghost btn-sm" type="button"
            onclick="event.stopPropagation();DPC.Areas.editHCRecord('${areaCode}','${r.id}')">✎</button>
          <button class="btn btn-ghost btn-sm" type="button"
            onclick="event.stopPropagation();DPC.Areas.deleteHCRecord('${areaCode}','${r.id}')"
            aria-label="Delete">✕</button>
          <span style="color:var(--col-muted);font-size:.72rem" aria-hidden="true">▾</span>
        </div>
      </button>
      <div class="intervention-card-body" id="hc-body-${r.id}">
        <!-- Per-dimension indicator breakdown -->
        ${dims.map(([dk,dim]) => {
          const d = DPC.Areas._getIndicatorScores(r, dk);
          const avg = d.avg;
          const avgColor = avg ? DPC.Areas._hcColor(avg) : 'var(--col-muted)';
          return `<div style="margin-bottom:16px;border:1px solid ${avg?avgColor+'44':'var(--col-border)'};border-left:3px solid ${avg?avgColor:'var(--col-border)'};border-radius:var(--radius);overflow:hidden">
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--col-surface-2);border-bottom:1px solid var(--col-border)">
              <span aria-hidden="true">${dim.icon}</span>
              <strong style="font-size:.82rem;flex:1">${dim.label}</strong>
              ${avg!==null?`<span style="font-weight:700;font-size:.82rem;color:${avgColor}">${avg.toFixed(1)} avg</span>`:'<span style="font-size:.75rem;color:var(--col-muted)">Not rated</span>'}
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:.75rem">
              <thead>
                <tr style="background:var(--col-surface-2)">
                  <th style="padding:5px 10px;text-align:left;font-size:.66rem;font-weight:700;text-transform:uppercase;color:var(--col-muted);border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border)">Indicator</th>
                  ${DPC.Areas.HC_SCALE.map(s=>`<th style="text-align:center;padding:5px 4px;font-size:.64rem;font-weight:700;color:${s.color};border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);min-width:60px">${s.value} ${s.label}</th>`).join('')}
                  <th style="text-align:center;padding:5px 4px;font-size:.64rem;font-weight:700;color:var(--col-muted);border-bottom:1px solid var(--col-border)">Score</th>
                </tr>
              </thead>
              <tbody>
                ${(dim.indicators||[]).map((ind,idx) => {
                  const score = d.indicators[idx] ?? null;
                  const scoreColor = score ? DPC.Areas._hcColor(score) : null;
                  return `<tr style="background:${score?DPC.Areas._hcColor(score)+'08':'var(--col-surface)'}">
                    <td style="padding:7px 10px;border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);vertical-align:top">
                      <div style="font-size:.74rem;font-weight:500;color:var(--col-text-2)">${ind.label}</div>
                      <div style="font-size:.65rem;color:var(--col-muted);margin-top:2px;font-style:italic">${ind.observability}</div>
                    </td>
                    ${DPC.Areas.HC_SCALE.map(s=>{
                      const isSel = score === s.value;
                      const crit  = ind.levels?.[s.value] || '';
                      return `<td style="padding:6px 6px;border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);text-align:center;vertical-align:top;background:${isSel?s.color+'22':''}">
                        ${isSel?`<div style="font-size:.7rem;font-weight:700;color:${s.color};margin-bottom:3px">✓ ${s.value}</div>`:''}
                        <div style="font-size:.64rem;color:${isSel?'var(--col-text)':'var(--col-muted)'};line-height:1.4;text-align:left">${crit}</div>
                      </td>`;
                    }).join('')}
                    <td style="padding:6px;border-bottom:1px solid var(--col-border);text-align:center;vertical-align:middle">
                      ${score?`<span style="font-size:.9rem;font-weight:700;color:${scoreColor};font-family:var(--font-mono)">${score}</span>`:`<span style="color:var(--col-muted);font-size:.75rem">—</span>`}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
        }).join('')}

        ${r.notes?`<div style="margin-bottom:14px">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--col-muted);margin-bottom:4px">Observations</div>
          <div style="font-size:.875rem;white-space:pre-wrap;line-height:1.6">${DPC.escHtml(r.notes)}</div>
        </div>`:''}

        <!-- Action points -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--col-muted)">Action Points</div>
            <button class="btn btn-ghost btn-sm" type="button"
              onclick="DPC.Areas.showAddHCActionModal('${areaCode}','${r.id}')">+ Add Action</button>
          </div>
          ${aps.length===0
            ?`<div style="font-size:.8rem;color:var(--col-muted)">No action points yet.</div>`
            :`<table class="table-base" style="font-size:.78rem">
              <thead><tr><th>Action</th><th>Details</th><th>Deadline</th><th>Owner</th><th>Status</th><th></th></tr></thead>
              <tbody>
              ${aps.map(ap=>`<tr>
                <td style="font-weight:500">${DPC.escHtml(ap.plannedAction||'—')}</td>
                <td style="color:var(--col-muted)">${DPC.escHtml((ap.details||'').slice(0,80))}</td>
                <td style="white-space:nowrap;font-family:var(--font-mono);font-size:.72rem">${ap.deadline||'—'}</td>
                <td>${DPC.escHtml(ap.ownership||'—')}</td>
                <td><select aria-label="Status" style="font-size:.7rem;padding:2px 4px;border:1px solid var(--col-border);border-radius:var(--radius);background:var(--col-surface);color:var(--col-text)"
                  onchange="DPC.Areas.updateHCActionStatus('${areaCode}','${r.id}','${ap.id}',this.value)">
                  <option value="not-started"${ap.status==='not-started'?' selected':''}>Not Started</option>
                  <option value="in-progress"${ap.status==='in-progress'?' selected':''}>In Progress</option>
                  <option value="completed"${ap.status==='completed'?' selected':''}>Completed</option>
                </select></td>
                <td><button class="btn btn-ghost btn-sm" type="button"
                  onclick="DPC.Areas.deleteHCAction('${areaCode}','${r.id}','${ap.id}')"
                  aria-label="Delete action">✕</button></td>
              </tr>`).join('')}
              </tbody>
            </table>`}
        </div>
      </div>
    </div>`;
  },

  toggleHCRecord: function(id) {
    const body = document.getElementById(`hc-body-${id}`);
    const btn  = body?.previousElementSibling;
    if (!body) return;
    const open = body.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', open);
  },

  // ── ADD / EDIT HEALTH CHECK MODAL ────────────────────────────────
  // Modal uses per-indicator scoring grids with success criteria expandable per level

  showAddHCModal: function(areaCode, existingId) {
    const area     = DPC.getArea(areaCode);
    const schema   = DPC.hcSchema;
    if (!area || !schema) return;
    const existing = existingId ? (area.healthChecks?.records||[]).find(r=>r.id===existingId) : null;
    const title    = existing ? `Edit Health Check — ${existing.staffName||''}` : `Add Health Check — ${area.name}`;

    const dims = Object.entries(schema.dimensions);

    const dimFields = dims.map(([dk, dim]) => {
      const existingDimData = existing ? DPC.Areas._getIndicatorScores(existing, dk) : { indicators: {} };

      return `<div style="border:1px solid var(--col-border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:14px">
        <!-- Dimension header -->
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--col-surface-2);border-bottom:1px solid var(--col-border)">
          <span style="font-size:1rem" aria-hidden="true">${dim.icon}</span>
          <strong style="font-size:.85rem">${dim.label}</strong>
          <span style="font-size:.7rem;color:var(--col-muted);margin-left:4px" id="hc-dim-avg-${dk}">avg: —</span>
        </div>
        <div style="font-size:.7rem;color:var(--col-muted);padding:6px 14px;border-bottom:1px solid var(--col-border);background:var(--col-surface-2);font-style:italic">${dim.observability}</div>

        <!-- Indicator rows -->
        <table style="width:100%;border-collapse:collapse;font-size:.75rem">
          <thead>
            <tr style="background:var(--col-surface-2)">
              <th style="padding:6px 12px;text-align:left;font-size:.64rem;font-weight:700;text-transform:uppercase;color:var(--col-muted);border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);min-width:160px">Indicator</th>
              ${DPC.Areas.HC_SCALE.map(s=>`<th style="text-align:center;padding:6px 4px;font-size:.64rem;font-weight:700;color:${s.color};border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);min-width:68px">${s.value}<br>${s.label}</th>`).join('')}
              <th style="width:44px;padding:6px 4px;border-bottom:1px solid var(--col-border)"></th>
            </tr>
          </thead>
          <tbody>
            ${(dim.indicators||[]).map((ind, idx) => {
              const currentScore = existingDimData.indicators[idx] ?? null;
              return `<tr id="hc-row-${dk}-${idx}">
                <td style="padding:8px 12px;border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);vertical-align:top">
                  <div style="font-size:.74rem;font-weight:600;color:var(--col-text-2)">${ind.label}</div>
                  <div style="font-size:.64rem;color:var(--col-muted);margin-top:2px;font-style:italic">${ind.observability}</div>
                  <button type="button" style="font-size:.64rem;color:var(--col-accent);background:none;border:none;padding:2px 0;cursor:pointer;text-decoration:underline;margin-top:4px"
                    onclick="DPC.Areas._toggleHCCriteria('${dk}','${idx}')"
                    id="hc-crit-btn-${dk}-${idx}">Show success criteria ▾</button>
                  <div id="hc-criteria-${dk}-${idx}" style="display:none;margin-top:6px">
                    ${DPC.Areas.HC_SCALE.map(s=>{
                      const crit = ind.levels?.[s.value]||'';
                      return crit?`<div style="margin-bottom:5px;padding:5px 8px;border-radius:var(--radius);background:${s.color}11;border-left:3px solid ${s.color}">
                        <div style="font-size:.65rem;font-weight:700;color:${s.color}">${s.value} · ${s.label}</div>
                        <div style="font-size:.68rem;color:var(--col-text-2);margin-top:2px;line-height:1.45">${crit}</div>
                      </div>`:'';
                    }).join('')}
                  </div>
                </td>
                ${DPC.Areas.HC_SCALE.map(s=>{
                  const isSel = currentScore === s.value;
                  return `<td style="padding:6px 4px;border-bottom:1px solid var(--col-border);border-right:1px solid var(--col-border);text-align:center;vertical-align:middle;background:${isSel?s.color+'18':''}">
                    <button type="button"
                      class="hc-ind-btn${isSel?' hc-ind-selected':''}"
                      data-dim="${dk}" data-ind="${idx}" data-val="${s.value}"
                      onclick="DPC.Areas._hcIndScore(this,'${dk}',${idx},${s.value})"
                      aria-pressed="${isSel}"
                      aria-label="${ind.label}: ${s.value} — ${s.label}"
                      title="${ind.levels?.[s.value]||s.label}"
                      style="width:44px;height:32px;border-radius:var(--radius);cursor:pointer;
                        border:2px solid ${isSel?s.color:'var(--col-border)'};
                        background:${isSel?s.color:'var(--col-surface)'};
                        color:${isSel?'#fff':'var(--col-text-2)'};
                        font-size:.75rem;font-weight:${isSel?'700':'400'};
                        transition:all .12s;display:inline-flex;align-items:center;justify-content:center;
                      ">${isSel?'✓':s.value}</button>
                  </td>`;
                }).join('')}
                <td style="padding:4px;border-bottom:1px solid var(--col-border);text-align:center;vertical-align:middle">
                  <button type="button" style="font-size:.68rem;color:var(--col-muted);background:none;border:none;cursor:pointer;padding:2px 4px"
                    onclick="DPC.Areas._hcIndScore(null,'${dk}',${idx},null)"
                    aria-label="Clear score for ${ind.label}">×</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');

    const body = `
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="hc-staff">Staff Name</label>
          <input class="form-input" id="hc-staff" type="text" placeholder="e.g. Tracey White" value="${DPC.escHtml(existing?.staffName||'')}"></div>
        <div class="form-field"><label class="form-label" for="hc-date">Date</label>
          <input class="form-input" id="hc-date" type="date" value="${existing?.date||new Date().toISOString().split('T')[0]}"></div>
      </div>
      <div class="form-field"><label class="form-label" for="hc-method">Assessment Method</label>
        <select class="form-select" id="hc-method">
          ${DPC.Areas.HC_METHODS.map(m=>`<option value="${m.value}"${existing?.assessmentMethod===m.value?' selected':''}>${m.label}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:.78rem;font-weight:600;color:var(--col-text-2);margin:14px 0 8px">
        Dimension Scores
        <span style="font-weight:400;color:var(--col-muted)"> — score each indicator independently · leave blank if not observed · click "Show success criteria" for guidance</span>
      </div>
      <div id="hc-scores-container">${dimFields}</div>
      <div class="form-field" style="margin-top:12px">
        <label class="form-label" for="hc-notes">Observations / Notes</label>
        <textarea class="form-textarea" id="hc-notes" rows="4" placeholder="What did you observe? Context, strengths, areas for development…">${DPC.escHtml(existing?.notes||'')}</textarea>
      </div>`;

    DPC.App.openModal(title, body, () => {
      // Collect per-indicator scores per dimension
      const scores = {};
      Object.keys(schema.dimensions).forEach(dk => {
        const dim = schema.dimensions[dk];
        const indicators = {};
        (dim.indicators||[]).forEach((_, idx) => {
          const sel = document.querySelector(`.hc-ind-btn.hc-ind-selected[data-dim="${dk}"][data-ind="${idx}"]`);
          indicators[idx] = sel ? parseInt(sel.dataset.val) : null;
        });
        const avg = DPC.Areas._calcIndicatorAvg(indicators);
        scores[dk] = { indicators, avg };
      });

      const record = {
        id: existing?.id || DPC.uid(),
        staffName:        document.getElementById('hc-staff')?.value.trim() || '',
        date:             document.getElementById('hc-date')?.value || '',
        assessmentMethod: document.getElementById('hc-method')?.value || 'meeting',
        scores,
        notes:            document.getElementById('hc-notes')?.value || '',
        actionPoints:     existing?.actionPoints || []
      };

      if (!area.healthChecks) area.healthChecks = { records: [], aggregateScore: null };
      if (!area.healthChecks.records) area.healthChecks.records = [];
      const arr = area.healthChecks.records;
      const idx = arr.findIndex(r=>r.id===record.id);
      if (idx>=0) arr[idx]=record; else arr.push(record);

      area.healthChecks.aggregateScore = DPC.Areas._calcHCAggregate(arr);
      area.aggregateHealthCheckScore   = area.healthChecks.aggregateScore;
      DPC.saveToLocalStorage();
      DPC.App.markUnsaved();
      DPC.Areas.switchTab('healthchecks');
      DPC.showToast(existing ? 'Health check updated' : 'Health check recorded');
    });
  },

  // Toggle per-indicator success criteria in modal
  _toggleHCCriteria: function(dk, idx) {
    const el  = document.getElementById(`hc-criteria-${dk}-${idx}`);
    const btn = document.getElementById(`hc-crit-btn-${dk}-${idx}`);
    if (!el) return;
    const open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    if (btn) btn.textContent = open ? 'Hide success criteria ▴' : 'Show success criteria ▾';
  },

  // Per-indicator score selection in modal
  _hcIndScore: function(btn, dk, idx, val) {
    // Clear all buttons for this indicator
    document.querySelectorAll(`.hc-ind-btn[data-dim="${dk}"][data-ind="${idx}"]`).forEach(b => {
      const s = DPC.Areas.HC_SCALE.find(s=>s.value===parseInt(b.dataset.val));
      b.classList.remove('hc-ind-selected');
      b.setAttribute('aria-pressed','false');
      b.style.border = '2px solid var(--col-border)';
      b.style.background = 'var(--col-surface)';
      b.style.color = 'var(--col-text-2)';
      b.textContent = b.dataset.val;
      // Reset row background
      const row = document.getElementById(`hc-row-${dk}-${idx}`);
      if (row) row.cells[parseInt(b.dataset.val)].style.background = '';
    });

    if (val !== null && btn) {
      const s = DPC.Areas.HC_SCALE.find(s=>s.value===val);
      btn.classList.add('hc-ind-selected');
      btn.setAttribute('aria-pressed','true');
      btn.style.border = `2px solid ${s.color}`;
      btn.style.background = s.color;
      btn.style.color = '#fff';
      btn.textContent = '✓';
      const row = document.getElementById(`hc-row-${dk}-${idx}`);
      if (row) row.cells[val].style.background = `${s.color}18`;
    }

    // Update live dimension average shown in header
    const schema = DPC.hcSchema;
    if (schema) {
      const dim = schema.dimensions[dk];
      const indicators = {};
      (dim.indicators||[]).forEach((_,i) => {
        const sel = document.querySelector(`.hc-ind-btn.hc-ind-selected[data-dim="${dk}"][data-ind="${i}"]`);
        indicators[i] = sel ? parseInt(sel.dataset.val) : null;
      });
      const avg = DPC.Areas._calcIndicatorAvg(indicators);
      const avgEl = document.getElementById(`hc-dim-avg-${dk}`);
      if (avgEl) {
        const color = avg ? DPC.Areas._hcColor(avg) : 'var(--col-muted)';
        avgEl.style.color = color;
        avgEl.textContent = avg ? `avg: ${avg.toFixed(1)}` : 'avg: —';
      }
    }
  },

  editHCRecord: function(areaCode, recordId) {
    this.showAddHCModal(areaCode, recordId);
  },

  deleteHCRecord: function(areaCode, recordId) {
    if (!confirm('Delete this health check record?')) return;
    const area = DPC.getArea(areaCode);
    if (!area) return;
    area.healthChecks.records = area.healthChecks.records.filter(r=>r.id!==recordId);
    area.healthChecks.aggregateScore = this._calcHCAggregate(area.healthChecks.records);
    area.aggregateHealthCheckScore = area.healthChecks.aggregateScore;
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.Areas.switchTab('healthchecks');
    DPC.showToast('Record deleted');
  },

  showAddHCActionModal: function(areaCode, recordId) {
    const area   = DPC.getArea(areaCode);
    const record = area?.healthChecks?.records?.find(r=>r.id===recordId);
    if (!record) return;
    const body = `
      <div class="form-field"><label class="form-label" for="hca-staff">Staff Name</label>
        <input class="form-input" id="hca-staff" type="text" value="${DPC.escHtml(record.staffName||'')}"></div>
      <div class="form-field"><label class="form-label" for="hca-action">Planned Action *</label>
        <input class="form-input" id="hca-action" type="text" placeholder="Brief action description…"></div>
      <div class="form-field"><label class="form-label" for="hca-details">Full Details</label>
        <textarea class="form-textarea" id="hca-details" rows="3"></textarea></div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="hca-deadline">Deadline</label>
          <input class="form-input" id="hca-deadline" type="date"></div>
        <div class="form-field"><label class="form-label" for="hca-owner">Ownership</label>
          <input class="form-input" id="hca-owner" type="text" value="Graeme Wright"></div>
      </div>
      <div class="form-field"><label class="form-label" for="hca-impact">Expected Impact</label>
        <textarea class="form-textarea" id="hca-impact" rows="2"></textarea></div>`;
    DPC.App.openModal('Add Action Point', body, () => {
      const action = {
        id: DPC.uid(), staffId: null,
        staffName:      document.getElementById('hca-staff')?.value.trim()||'',
        plannedAction:  document.getElementById('hca-action')?.value.trim()||'',
        details:        document.getElementById('hca-details')?.value||'',
        deadline:       document.getElementById('hca-deadline')?.value||'',
        ownership:      document.getElementById('hca-owner')?.value.trim()||'',
        expectedImpact: document.getElementById('hca-impact')?.value||'',
        status: 'not-started', completedDate: null
      };
      if (!record.actionPoints) record.actionPoints = [];
      record.actionPoints.push(action);
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.Areas.switchTab('healthchecks');
      DPC.showToast('Action point added');
    });
  },

  updateHCActionStatus: function(areaCode, recordId, actionId, status) {
    const area   = DPC.getArea(areaCode);
    const record = area?.healthChecks?.records?.find(r=>r.id===recordId);
    const action = record?.actionPoints?.find(ap=>ap.id===actionId);
    if (!action) return;
    action.status = status;
    action.completedDate = status==='completed' ? new Date().toISOString().split('T')[0] : null;
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
  },

  deleteHCAction: function(areaCode, recordId, actionId) {
    if (!confirm('Delete this action point?')) return;
    const area   = DPC.getArea(areaCode);
    const record = area?.healthChecks?.records?.find(r=>r.id===recordId);
    if (!record) return;
    record.actionPoints = record.actionPoints.filter(ap=>ap.id!==actionId);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.Areas.switchTab('healthchecks');
  }
};