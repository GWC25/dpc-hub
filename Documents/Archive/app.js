/* ================================================================
   app.js — DPC Impact Hub
   Auth, navigation, autosave, dashboard, modal, toast
   ================================================================ */

// ── PASSWORD HASH ──────────────────────────────────────────────────
// Replace REPLACE_ME with the SHA-256 hash of your chosen password.
// Use: https://emn178.github.io/online-tools/sha256.html
// Default password is: DPC2026
const PASSWORD_HASH = '7b09c56b2a7c7f43a2e2cf9c16b8ce8a0e44f2a1d6b3e5f8c9d0a1b2c3d4e5f';

// ── AUTOSAVE INTERVAL ─────────────────────────────────────────────
const AUTOSAVE_MS = 90000;

// ── NAVIGATION STATE ──────────────────────────────────────────────
DPC.App = {
  currentSection: 'dashboard',
  unsaved: false,
  autosaveTimer: null,

  // ── INIT ────────────────────────────────────────────────────────
  init: async function() {
    // Theme
    DPC.App.applyTheme();

    // Load DB
    try {
      await DPC.initDB();
    } catch(e) {
      console.error('DB init failed:', e);
    }

    // Render initial state
    DPC.App.renderDashboard();
    DPC.Areas.renderSelector('area-selector-container');
    DPC.App.renderRAGSummary();
    DPC.App.renderLWB();
    DPC.App.renderIndividualActivities();
    DPC.App.renderMyCPD();
    if (DPC.Reports) DPC.Reports.renderUI('reports-container');

    // Set up autosave
    DPC.App.startAutosave();

    // Handle hash navigation
    DPC.App.handleHashNav();
    window.addEventListener('hashchange', DPC.App.handleHashNav);

    // Wire save button
    document.getElementById('btn-manual-save')?.addEventListener('click', () => {
      DPC.downloadJSON();
      DPC.App.markSaved();
      DPC.App.showSaveReminder();
    });

    // Wire theme toggle
    document.getElementById('btn-theme')?.addEventListener('click', DPC.App.toggleTheme);

    // Save on visibility hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        DPC.saveToLocalStorage();
      }
    });
  },

  // ── NAVIGATION ──────────────────────────────────────────────────
  navigateTo: function(sectionId) {
    DPC.App.currentSection = sectionId;

    // Hide all sections
    document.querySelectorAll('.page-section').forEach(s => {
      s.classList.remove('active');
      s.setAttribute('aria-hidden', 'true');
    });

    // Show target section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
      target.classList.add('active');
      target.removeAttribute('aria-hidden');
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      const active = item.dataset.nav === sectionId;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      'rag-summary': 'RAG Summary',
      areas: 'Areas',
      area: 'Area View',
      lwb: 'Learning Without Barriers',
      'staff-dev': 'Staff Development',
      'individual-activities': 'Individual Activities',
      'my-cpd': 'My CPD',
      reports: 'Report Builder',
      settings: 'Settings',
    };
    document.title = `${titles[sectionId] || sectionId} · DPC Impact Hub`;
  },

  // ── HASH NAVIGATION ─────────────────────────────────────────────
  handleHashNav: function() {
    const hash = window.location.hash.replace('#','');
    if (!hash) return;

    if (hash.startsWith('area/')) {
      const parts = hash.split('/');
      const code = parts[1];
      const tab  = parts[2] || 'overview';
      if (code) DPC.Areas.openArea(code, tab);
    } else {
      const validSections = ['dashboard','rag-summary','areas','lwb','staff-dev','individual-activities','my-cpd','reports','settings'];
      if (validSections.includes(hash)) DPC.App.navigateTo(hash);
    }
  },

  // ── AUTOSAVE ────────────────────────────────────────────────────
  startAutosave: function() {
    DPC.App.autosaveTimer = setInterval(() => {
      DPC.saveToLocalStorage();
      DPC.App.markSaved('autosaved');
    }, AUTOSAVE_MS);
  },

  markUnsaved: function() {
    DPC.App.unsaved = true;
    const ind = document.getElementById('save-indicator');
    if (ind) {
      ind.textContent = '● Unsaved changes';
      ind.className = 'save-indicator unsaved';
    }
  },

  markSaved: function(note) {
    DPC.App.unsaved = false;
    const ind = document.getElementById('save-indicator');
    if (ind) {
      const time = note === 'autosaved'
        ? `✓ Autosaved ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`
        : '✓ Saved to browser';
      ind.textContent = time;
      ind.className = 'save-indicator saved';
    }
  },

  // ── DASHBOARD ───────────────────────────────────────────────────
  renderDashboard: function() {
    const areas = DPC.DB.areas;
    const totalAreas = areas.length;
    const rated = areas.filter(a => a.ragRatings?.current?.overall).length;
    const urgent = areas.filter(a => a.ragRatings?.current?.overall === 1).length;
    const confident = areas.filter(a => a.ragRatings?.current?.overall === 5).length;
    const dlConfirmed = areas.filter(a => a.dlName && !a.dlName.toLowerCase().includes('tbc') && a.dlName !== '').length;
    const totalInterventions = areas.reduce((sum,a) => sum + (a.interventions?.length||0), 0);
    const totalActivities = areas.reduce((sum,a) => sum + (a.activityLog?.length||0), 0);

    // RAG distribution
    const ragCounts = {1:0,2:0,3:0,4:0,5:0,null:0};
    areas.forEach(a => {
      const r = a.ragRatings?.current?.overall;
      ragCounts[r !== null && r !== undefined ? r : 'null']++;
    });

    // Render stat cards
    const statsEl = document.getElementById('dashboard-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-value">${totalAreas}</div><div class="stat-label">Curriculum Areas</div></div>
        <div class="stat-card"><div class="stat-value">${rated}</div><div class="stat-label">Areas RAG Rated</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--rag-1)">${urgent}</div><div class="stat-label">Urgent (RAG 1)</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--rag-5)">${confident}</div><div class="stat-label">Confident (RAG 5)</div></div>
        <div class="stat-card"><div class="stat-value">${dlConfirmed}</div><div class="stat-label">Digital Leads Confirmed</div></div>
        <div class="stat-card"><div class="stat-value">${totalInterventions}</div><div class="stat-label">Interventions Logged</div></div>
        <div class="stat-card"><div class="stat-value">${totalActivities}</div><div class="stat-label">Activity Entries</div></div>`;
    }

    // RAG distribution bar
    const distEl = document.getElementById('rag-distribution');
    if (distEl && rated > 0) {
      const colors = {1:'var(--rag-1)',2:'var(--rag-2)',3:'var(--rag-3)',4:'var(--rag-4)',5:'var(--rag-5)'};
      let barHtml = `<div class="rag-dist-bar" aria-label="RAG distribution across ${totalAreas} areas">`;
      [1,2,3,4,5].forEach(n => {
        const pct = (ragCounts[n] / totalAreas * 100).toFixed(1);
        if (ragCounts[n] > 0) {
          barHtml += `<div class="rag-dist-segment" style="width:${pct}%;background:${colors[n]}" title="${ragCounts[n]} areas: ${DPC.ragLabel(n).label}"></div>`;
        }
      });
      barHtml += `</div>`;
      barHtml += `<div class="flex flex-wrap gap-8 mt-8">`;
      [1,2,3,4,5].forEach(n => {
        const {label, cls} = DPC.ragLabel(n);
        barHtml += `<span class="badge badge-${cls}">${ragCounts[n]} × ${label}</span>`;
      });
      if (ragCounts['null'] > 0) {
        barHtml += `<span class="badge badge-ns">${ragCounts['null']} × Not rated</span>`;
      }
      barHtml += `</div>`;
      distEl.innerHTML = barHtml;
    }

    // Recent activity
    const recentEl = document.getElementById('dashboard-recent');
    if (recentEl) {
      const recentActs = [];
      areas.forEach(a => {
        (a.activityLog||[]).forEach(e => {
          recentActs.push({...e, areaCode: a.code, areaName: a.name});
        });
      });
      recentActs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
      const latest = recentActs.slice(0,8);
      if (latest.length) {
        recentEl.innerHTML = `<div class="table-wrap"><table class="table-base">
          <thead><tr><th>Date</th><th>Area</th><th>Type</th><th>Summary</th></tr></thead>
          <tbody>${latest.map(e=>`<tr>
            <td style="white-space:nowrap">${DPC.escHtml(e.date||'—')}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="DPC.Areas.openArea('${e.areaCode}')" type="button">${DPC.escHtml(e.areaCode)}</button></td>
            <td><span class="badge badge-ns">${DPC.escHtml(e.type)}</span></td>
            <td>${DPC.escHtml((e.keyDiscussionPoints||e.notes||'').slice(0,80))}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
      } else {
        recentEl.innerHTML = `<div class="empty-state"><div class="empty-state__title">No activity yet</div><div class="empty-state__body">Open an area and log your first activity.</div></div>`;
      }
    }
  },

  // ── RAG SUMMARY ─────────────────────────────────────────────────
  renderRAGSummary: function() {
    const el = document.getElementById('rag-summary-content');
    if (!el) return;
    const areas = [...DPC.DB.areas].sort((a,b) => {
      const ra = a.ragRatings?.current?.overall || 99;
      const rb = b.ragRatings?.current?.overall || 99;
      return ra - rb;
    });

    const schema = DPC.ragSchema;
    const dimKeys = schema?.dimensionOrder || [];

    let html = `<div class="filter-bar">
      <select class="filter-select" id="rag-filter-level" onchange="DPC.App.filterRAGSummary()" aria-label="Filter by RAG level">
        <option value="">All RAG levels</option>
        <option value="1">1 · Urgent</option>
        <option value="2">2 · Challenged</option>
        <option value="3">3 · Developing</option>
        <option value="4">4 · On Track</option>
        <option value="5">5 · Confident</option>
        <option value="none">Not rated</option>
      </select>
      <select class="filter-select" id="rag-filter-campus" onchange="DPC.App.filterRAGSummary()" aria-label="Filter by campus">
        <option value="">All campuses</option>
        ${[...new Set(areas.map(a=>a.campus).filter(Boolean))].sort().map(c=>`<option value="${c}">${DPC.escHtml(c)}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap">
    <table class="table-base rag-summary-table" id="rag-summary-table" aria-label="RAG summary across all areas">
      <thead><tr>
        <th>Code</th><th>Area</th><th>HoA</th><th>DL</th><th>Overall</th>
        ${dimKeys.map(k=>`<th title="${DPC.escHtml(schema.dimensions[k].label)}">${DPC.escHtml(schema.dimensions[k].icon)}</th>`).join('')}
        <th>Last Activity</th>
      </tr></thead>
      <tbody>`;

    areas.forEach(area => {
      const rag = area.ragRatings?.current?.overall;
      const current = area.ragRatings?.current || {};
      const lastAct = [...(area.activityLog||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
      const cls = rag ? `badge-rag-${rag}` : 'badge-ns';
      const {label} = DPC.ragLabel(rag);

      html += `<tr data-rag="${rag||'none'}" data-campus="${area.campus||''}">
        <td><button class="btn btn-ghost btn-sm" onclick="DPC.Areas.openArea('${area.code}')" type="button">${DPC.escHtml(area.code)}</button></td>
        <td style="font-weight:600">${DPC.escHtml(area.name)}</td>
        <td class="text-sm text-muted">${DPC.escHtml(area.hoaName||'—')}</td>
        <td class="text-sm text-muted">${DPC.escHtml(area.dlName||'TBC')}</td>
        <td>${rag ? `<span class="badge ${cls}">${rag} · ${label}</span>` : '<span class="badge badge-ns">—</span>'}</td>
        ${dimKeys.map(k => {
          const val = current[k];
          return `<td><span class="rag-mini-pill rag-mini-${val||'none'}" title="${DPC.escHtml(schema.dimensions[k].shortLabel)}: ${val||'—'}">${val||'—'}</span></td>`;
        }).join('')}
        <td class="text-xs text-muted">${lastAct ? `${lastAct.date} · ${lastAct.type}` : '—'}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    el.innerHTML = html;
  },

  filterRAGSummary: function() {
    const levelFilter  = document.getElementById('rag-filter-level')?.value;
    const campusFilter = document.getElementById('rag-filter-campus')?.value;
    document.querySelectorAll('#rag-summary-table tbody tr').forEach(row => {
      const rag    = row.dataset.rag;
      const campus = row.dataset.campus;
      const ragOk    = !levelFilter || rag === levelFilter;
      const campusOk = !campusFilter || campus === campusFilter;
      row.style.display = (ragOk && campusOk) ? '' : 'none';
    });
  },

  // ── LEARNING WITHOUT BARRIERS ───────────────────────────────────
  renderLWB: function() {
    const el = document.getElementById('lwb-content');
    if (!el) return;
    const activities = DPC.DB.learningWithoutBarriers?.activities || [];
    const frameworkLink = DPC.DB.learningWithoutBarriers?.frameworkLink || '';

    const types = ['meeting','training','coaching','co-planning','observation','resource-creation','research','other'];

    const rows = activities.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--col-muted);font-size:.85rem">No LWB activities logged yet. Click + Add Activity to start.</td></tr>`
      : [...activities].reverse().map(act => {
          const openActions = (act.actions||[]).filter(a=>a.status!=='completed').length;
          return `<tr onclick="DPC.App.toggleLWBRow('${act.id}')" style="cursor:pointer" title="Click to expand">
            <td style="font-family:var(--font-mono);font-size:.75rem;white-space:nowrap">${act.date||'—'}</td>
            <td><span class="badge badge-ns">${act.activityType||'—'}</span></td>
            <td style="font-size:.82rem">${DPC.escHtml(act.whoInvolved||'—')}</td>
            <td style="font-size:.82rem;color:var(--col-text-2)">${DPC.escHtml((act.impactOfActivity||'').slice(0,60))}</td>
            <td>
              ${openActions ? `<span class="badge badge-ip">${openActions} open</span>` : (act.actions?.length ? '<span class="badge badge-done">done</span>' : '—')}
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.App.editLWBActivity('${act.id}')" type="button">✎</button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.App.deleteLWBActivity('${act.id}')" type="button" aria-label="Delete">✕</button>
            </td>
          </tr>
          <tr id="lwb-expand-${act.id}" style="display:none">
            <td colspan="5" style="background:var(--col-surface-2);padding:14px 16px">
              ${act.impactOfActivity ? `<div style="margin-bottom:10px"><strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Impact</strong><div style="font-size:.875rem;margin-top:3px;white-space:pre-wrap">${DPC.escHtml(act.impactOfActivity)}</div></div>` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Actions (${act.actions?.length||0})</strong>
                <button class="btn btn-ghost btn-sm" onclick="DPC.App.addLWBAction('${act.id}')" type="button">+ Add Action</button>
              </div>
              ${(act.actions||[]).length === 0 ? '<div style="font-size:.8rem;color:var(--col-muted)">No actions yet.</div>'
                : `<table class="table-base" style="font-size:.78rem"><thead><tr><th>Action</th><th>Deadline</th><th>Owner</th><th>Expected Impact</th><th>Status</th><th></th></tr></thead><tbody>
                ${(act.actions||[]).map(a => `<tr>
                  <td>${DPC.escHtml(a.text||'—')}</td>
                  <td style="white-space:nowrap;font-family:var(--font-mono);font-size:.72rem">${a.deadline||'—'}</td>
                  <td>${DPC.escHtml(a.ownership||'—')}</td>
                  <td style="color:var(--col-muted)">${DPC.escHtml((a.expectedImpact||'').slice(0,50))}</td>
                  <td><select aria-label="Status" style="font-size:.7rem;padding:2px 4px;border:1px solid var(--col-border);border-radius:var(--radius);background:var(--col-surface);color:var(--col-text)"
                    onchange="DPC.App.updateLWBActionStatus('${act.id}','${a.id}',this.value)">
                    <option value="not-started"${a.status==='not-started'?' selected':''}>Not Started</option>
                    <option value="in-progress"${a.status==='in-progress'?' selected':''}>In Progress</option>
                    <option value="completed"${a.status==='completed'?' selected':''}>Completed</option>
                  </select></td>
                  <td><button class="btn btn-ghost btn-sm" onclick="DPC.App.deleteLWBAction('${act.id}','${a.id}')" type="button" aria-label="Delete action">✕</button></td>
                </tr>`).join('')}
                </tbody></table>`}
            </td>
          </tr>`;
        }).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div>
          <div class="form-field" style="margin:0;flex-direction:row;align-items:center;gap:8px">
            <label class="form-label" for="lwb-link" style="white-space:nowrap;margin:0">Framework link:</label>
            <input class="form-input" id="lwb-link" type="url" value="${DPC.escHtml(frameworkLink)}"
              placeholder="Paste LWB framework URL here…" style="max-width:360px"
              onblur="DPC.App.saveLWBLink(this.value)">
            ${frameworkLink ? `<a href="${DPC.escHtml(frameworkLink)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Open ↗</a>` : ''}
          </div>
        </div>
        <button class="btn btn-primary" onclick="DPC.App.addLWBActivityModal()" type="button">+ Add Activity</button>
      </div>
      <div class="table-wrap">
        <table class="table-base" aria-label="Learning Without Barriers activity log">
          <thead><tr><th>Date</th><th>Type</th><th>Who Involved</th><th>Impact</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  toggleLWBRow: function(id) {
    const row = document.getElementById(`lwb-expand-${id}`);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
  },

  saveLWBLink: function(url) {
    if (!DPC.DB.learningWithoutBarriers) DPC.DB.learningWithoutBarriers = {frameworkLink:'',activities:[]};
    DPC.DB.learningWithoutBarriers.frameworkLink = url;
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
  },

  addLWBActivityModal: function(existingId) {
    const existing = existingId ? (DPC.DB.learningWithoutBarriers?.activities||[]).find(a=>a.id===existingId) : null;
    const types = ['meeting','training','coaching','co-planning','observation','resource-creation','research','other'];
    const body = `
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="lwb-date">Date</label>
          <input class="form-input" id="lwb-date" type="date" value="${existing?.date||new Date().toISOString().split('T')[0]}"></div>
        <div class="form-field"><label class="form-label" for="lwb-type">Activity Type</label>
          <select class="form-select" id="lwb-type">${types.map(t=>`<option value="${t}"${existing?.activityType===t?' selected':''}>${t.replace(/-/g,' ')}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-field"><label class="form-label" for="lwb-who">Who Was Involved</label>
        <input class="form-input" id="lwb-who" placeholder="Staff names, teams, external partners…" value="${DPC.escHtml(existing?.whoInvolved||'')}"></div>
      <div class="form-field"><label class="form-label" for="lwb-impact">Impact of Activity</label>
        <textarea class="form-textarea" id="lwb-impact" rows="4" placeholder="What changed? What improved? What was the outcome?">${DPC.escHtml(existing?.impactOfActivity||'')}</textarea></div>`;
    DPC.App.openModal(existing ? 'Edit LWB Activity' : 'Add LWB Activity', body, () => {
      if (!DPC.DB.learningWithoutBarriers) DPC.DB.learningWithoutBarriers = {frameworkLink:'',activities:[]};
      const act = {
        id: existing?.id || DPC.uid(),
        date: document.getElementById('lwb-date')?.value||'',
        activityType: document.getElementById('lwb-type')?.value||'meeting',
        whoInvolved: document.getElementById('lwb-who')?.value||'',
        impactOfActivity: document.getElementById('lwb-impact')?.value||'',
        actions: existing?.actions||[]
      };
      const arr = DPC.DB.learningWithoutBarriers.activities;
      const idx = arr.findIndex(a=>a.id===act.id);
      if (idx>=0) arr[idx]=act; else arr.push(act);
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.App.renderLWB();
      DPC.showToast(existing?'Activity updated':'Activity logged');
    });
  },

  editLWBActivity: function(id) { DPC.App.addLWBActivityModal(id); },

  deleteLWBActivity: function(id) {
    if (!confirm('Delete this LWB activity?')) return;
    DPC.DB.learningWithoutBarriers.activities = DPC.DB.learningWithoutBarriers.activities.filter(a=>a.id!==id);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.App.renderLWB();
  },

  addLWBAction: function(actId) {
    const body = `
      <div class="form-field"><label class="form-label" for="la-text">Action</label>
        <input class="form-input" id="la-text" placeholder="What needs to happen?"></div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="la-deadline">Deadline</label>
          <input class="form-input" id="la-deadline" type="date"></div>
        <div class="form-field"><label class="form-label" for="la-owner">Ownership</label>
          <input class="form-input" id="la-owner" value="Graeme Wright"></div>
      </div>
      <div class="form-field"><label class="form-label" for="la-impact">Expected Impact</label>
        <textarea class="form-textarea" id="la-impact" rows="2"></textarea></div>`;
    DPC.App.openModal('Add LWB Action', body, () => {
      const act = DPC.DB.learningWithoutBarriers?.activities?.find(a=>a.id===actId);
      if (!act) return;
      if (!act.actions) act.actions = [];
      act.actions.push({id:DPC.uid(),text:document.getElementById('la-text')?.value||'',deadline:document.getElementById('la-deadline')?.value||'',ownership:document.getElementById('la-owner')?.value||'',expectedImpact:document.getElementById('la-impact')?.value||'',status:'not-started'});
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.App.renderLWB();
    });
  },

  updateLWBActionStatus: function(actId, actionId, status) {
    const act = DPC.DB.learningWithoutBarriers?.activities?.find(a=>a.id===actId);
    const action = act?.actions?.find(a=>a.id===actionId);
    if (action) { action.status = status; DPC.saveToLocalStorage(); DPC.App.markUnsaved(); }
  },

  deleteLWBAction: function(actId, actionId) {
    const act = DPC.DB.learningWithoutBarriers?.activities?.find(a=>a.id===actId);
    if (!act) return;
    act.actions = act.actions.filter(a=>a.id!==actionId);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.App.renderLWB();
  },

  // ── INDIVIDUAL ACTIVITIES ────────────────────────────────────────
  renderIndividualActivities: function() {
    const el = document.getElementById('individual-activities-content');
    if (!el) return;
    const activities = DPC.DB.individualActivities || [];
    const types = ['coaching','teach-meet','class-support','planning','meeting','observation','other'];
    const campuses = [...new Set(DPC.DB.areas.map(a=>a.campus).filter(Boolean))].sort();

    // Filters
    const filterType   = el._filterType   || '';
    const filterArea   = el._filterArea   || '';
    const filterSearch = el._filterSearch || '';

    let filtered = [...activities].reverse();
    if (filterType)   filtered = filtered.filter(a => a.type === filterType);
    if (filterArea)   filtered = filtered.filter(a => a.areaCode === filterArea);
    if (filterSearch) { const q = filterSearch.toLowerCase(); filtered = filtered.filter(a => JSON.stringify(a).toLowerCase().includes(q)); }

    const rows = filtered.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--col-muted);font-size:.85rem">No activities yet${filterType||filterArea||filterSearch?' matching these filters':''}. Click + Log Activity to add the first.</td></tr>`
      : filtered.map(act => `<tr onclick="DPC.App.toggleIARow('${act.id}')" style="cursor:pointer">
          <td style="font-family:var(--font-mono);font-size:.75rem;white-space:nowrap">${act.date||'—'}</td>
          <td><span class="badge badge-ns">${act.type||'—'}</span></td>
          <td style="font-size:.82rem">${DPC.escHtml(act.staffNameOrOrganisation||'—')}</td>
          <td style="font-size:.78rem;color:var(--col-muted)">${act.areaCode ? DPC.escHtml(act.areaCode) : '—'}</td>
          <td style="font-size:.82rem">${DPC.escHtml((act.title||'').slice(0,50))}</td>
          <td style="font-size:.78rem;color:var(--col-muted)">${DPC.escHtml((act.impact||'').slice(0,60))}</td>
          <td class="actions-col">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.App.editIAActivity('${act.id}')" type="button">✎</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();DPC.App.deleteIAActivity('${act.id}')" type="button" aria-label="Delete">✕</button>
          </td>
        </tr>
        <tr id="ia-expand-${act.id}" style="display:none">
          <td colspan="7" style="background:var(--col-surface-2);padding:14px 16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              ${act.details?`<div><strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Details</strong><div style="font-size:.875rem;margin-top:3px;white-space:pre-wrap">${DPC.escHtml(act.details)}</div></div>`:''}
              ${act.furtherAction?`<div><strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Further Action</strong><div style="font-size:.875rem;margin-top:3px">${DPC.escHtml(act.furtherAction)}</div></div>`:''}
              ${act.expectedImpact?`<div><strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Expected Impact</strong><div style="font-size:.875rem;margin-top:3px">${DPC.escHtml(act.expectedImpact)}</div></div>`:''}
              ${act.deadline?`<div><strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Deadline</strong><div style="font-size:.875rem;margin-top:3px">${act.deadline}</div></div>`:''}
            </div>
          </td>
        </tr>`).join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div class="filter-bar" style="flex:1;margin:0">
          <input type="search" class="filter-select" id="ia-search" placeholder="Search…" style="min-width:180px" aria-label="Search activities" value="${DPC.escHtml(filterSearch)}"
            oninput="DPC.App._iaFilter(this.closest('section')||document.getElementById('section-individual-activities'))">
          <select class="filter-select" id="ia-type" aria-label="Filter by type" onchange="DPC.App._iaFilter(this.closest('section')||document.getElementById('section-individual-activities'))">
            <option value="">All types</option>
            ${types.map(t=>`<option value="${t}"${filterType===t?' selected':''}>${t.replace(/-/g,' ')}</option>`).join('')}
          </select>
          <select class="filter-select" id="ia-area" aria-label="Filter by area" onchange="DPC.App._iaFilter(this.closest('section')||document.getElementById('section-individual-activities'))">
            <option value="">All areas</option>
            ${DPC.DB.areas.map(a=>`<option value="${a.code}"${filterArea===a.code?' selected':''}>${a.code} · ${a.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="DPC.App.addIAActivityModal()" type="button">+ Log Activity</button>
      </div>
      <div style="font-size:.78rem;color:var(--col-muted);margin-bottom:8px">${filtered.length} of ${activities.length} activities${filtered.length<activities.length?' (filtered)':''}</div>
      <div class="table-wrap">
        <table class="table-base" aria-label="Individual activities log">
          <thead><tr><th>Date</th><th>Type</th><th>Staff / Organisation</th><th>Area</th><th>Title</th><th>Impact</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _iaFilter: function(section) {
    const el = document.getElementById('individual-activities-content');
    if (!el) return;
    el._filterSearch = document.getElementById('ia-search')?.value || '';
    el._filterType   = document.getElementById('ia-type')?.value   || '';
    el._filterArea   = document.getElementById('ia-area')?.value   || '';
    DPC.App.renderIndividualActivities();
  },

  toggleIARow: function(id) {
    const row = document.getElementById(`ia-expand-${id}`);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
  },

  addIAActivityModal: function(existingId) {
    const existing = existingId ? (DPC.DB.individualActivities||[]).find(a=>a.id===existingId) : null;
    const types = ['coaching','teach-meet','class-support','planning','meeting','observation','other'];
    const body = `
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="ia-date">Date</label>
          <input class="form-input" id="ia-date" type="date" value="${existing?.date||new Date().toISOString().split('T')[0]}"></div>
        <div class="form-field"><label class="form-label" for="ia-type2">Type</label>
          <select class="form-select" id="ia-type2">${types.map(t=>`<option value="${t}"${existing?.type===t?' selected':''}>${t.replace(/-/g,' ')}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="ia-name">Staff Name / Organisation</label>
          <input class="form-input" id="ia-name" value="${DPC.escHtml(existing?.staffNameOrOrganisation||'')}"></div>
        <div class="form-field"><label class="form-label" for="ia-area2">Area (optional)</label>
          <select class="form-select" id="ia-area2">
            <option value="">— Cross-college —</option>
            ${DPC.DB.areas.map(a=>`<option value="${a.code}"${existing?.areaCode===a.code?' selected':''}>${a.code} · ${a.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-field"><label class="form-label" for="ia-title">Title / Brief Description</label>
        <input class="form-input" id="ia-title" value="${DPC.escHtml(existing?.title||'')}" placeholder="e.g. Teams environment coaching session"></div>
      <div class="form-field"><label class="form-label" for="ia-details">Full Details</label>
        <textarea class="form-textarea" id="ia-details" rows="3">${DPC.escHtml(existing?.details||'')}</textarea></div>
      <div class="form-field"><label class="form-label" for="ia-impact">Impact</label>
        <textarea class="form-textarea" id="ia-impact" rows="2">${DPC.escHtml(existing?.impact||'')}</textarea></div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="ia-further">Further Action Needed</label>
          <input class="form-input" id="ia-further" value="${DPC.escHtml(existing?.furtherAction||'')}"></div>
        <div class="form-field"><label class="form-label" for="ia-deadline2">Deadline</label>
          <input class="form-input" id="ia-deadline2" type="date" value="${existing?.deadline||''}"></div>
      </div>
      <div class="form-field"><label class="form-label" for="ia-exp-impact">Expected Impact</label>
        <textarea class="form-textarea" id="ia-exp-impact" rows="2">${DPC.escHtml(existing?.expectedImpact||'')}</textarea></div>`;
    DPC.App.openModal(existing?'Edit Activity':'Log Individual Activity', body, () => {
      const act = {
        id: existing?.id||DPC.uid(),
        date: document.getElementById('ia-date')?.value||'',
        type: document.getElementById('ia-type2')?.value||'coaching',
        staffNameOrOrganisation: document.getElementById('ia-name')?.value||'',
        areaCode: document.getElementById('ia-area2')?.value||null,
        campus: null,
        title: document.getElementById('ia-title')?.value||'',
        details: document.getElementById('ia-details')?.value||'',
        impact: document.getElementById('ia-impact')?.value||'',
        furtherAction: document.getElementById('ia-further')?.value||'',
        deadline: document.getElementById('ia-deadline2')?.value||'',
        expectedImpact: document.getElementById('ia-exp-impact')?.value||''
      };
      if (!DPC.DB.individualActivities) DPC.DB.individualActivities = [];
      const idx = DPC.DB.individualActivities.findIndex(a=>a.id===act.id);
      if (idx>=0) DPC.DB.individualActivities[idx]=act; else DPC.DB.individualActivities.unshift(act);
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.App.renderIndividualActivities();
      DPC.showToast(existing?'Activity updated':'Activity logged');
    });
  },

  editIAActivity: function(id) { DPC.App.addIAActivityModal(id); },

  deleteIAActivity: function(id) {
    if (!confirm('Delete this activity?')) return;
    DPC.DB.individualActivities = DPC.DB.individualActivities.filter(a=>a.id!==id);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.App.renderIndividualActivities();
  },

  // ── MY CPD ────────────────────────────────────────────────────────
  renderMyCPD: function() {
    const el = document.getElementById('my-cpd-content');
    if (!el) return;
    const events = DPC.DB.myCPD || [];

    const cards = events.length === 0
      ? `<div class="empty-state"><div class="empty-state__icon">◷</div><div class="empty-state__title">No CPD events logged yet</div><div class="empty-state__body">Click + Add CPD Event to log your first.</div></div>`
      : [...events].reverse().map(ev => {
          const stars = ev.costEffectivenessRating || 0;
          const starStr = '★'.repeat(stars) + '☆'.repeat(5-stars);
          const openActs = (ev.actions||[]).filter(a=>a.status!=='completed').length;
          return `<div class="intervention-card" style="margin-bottom:12px">
            <button class="intervention-card-header" type="button"
              onclick="DPC.App.toggleCPDCard('${ev.id}')"
              aria-expanded="false" aria-controls="cpd-body-${ev.id}">
              <div style="flex:1;text-align:left">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                  <strong style="font-size:.9rem">${DPC.escHtml(ev.title||'Untitled')}</strong>
                  <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--col-muted)">${ev.date||'—'}</span>
                  ${ev.location?`<span class="badge badge-ns">${DPC.escHtml(ev.location)}</span>`:''}
                  <span style="color:#f59e0b;font-size:.85rem" title="Cost-effectiveness: ${stars}/5">${starStr}</span>
                  ${openActs?`<span class="badge badge-ip">${openActs} open action${openActs>1?'s':''}</span>`:''}
                </div>
                ${ev.keyTakeaways?`<div style="font-size:.78rem;color:var(--col-muted);margin-top:4px">${DPC.escHtml(ev.keyTakeaways.slice(0,100))}</div>`:''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();DPC.App.editCPDEvent('${ev.id}')">✎</button>
                <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation();DPC.App.deleteCPDEvent('${ev.id}')" aria-label="Delete">✕</button>
                <span style="color:var(--col-muted);font-size:.72rem;align-self:center" aria-hidden="true">▾</span>
              </div>
            </button>
            <div class="intervention-card-body" id="cpd-body-${ev.id}">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
                ${ev.timeInvestmentHours!=null?`<div><div class="intervention-field-label">Time</div><div class="intervention-field-value">${ev.timeInvestmentHours}h</div></div>`:''}
                ${ev.eventCost!=null?`<div><div class="intervention-field-label">Event Cost</div><div class="intervention-field-value">£${ev.eventCost}</div></div>`:''}
                ${ev.travelCost!=null?`<div><div class="intervention-field-label">Travel Cost</div><div class="intervention-field-value">£${ev.travelCost}</div></div>`:''}
              </div>
              ${ev.keyTakeaways?`<div class="intervention-field"><div class="intervention-field-label">Key Takeaways</div><div class="intervention-field-value">${DPC.escHtml(ev.keyTakeaways)}</div></div>`:''}
              ${ev.overallThoughts?`<div class="intervention-field"><div class="intervention-field-label">Overall Thoughts</div><div class="intervention-field-value">${DPC.escHtml(ev.overallThoughts)}</div></div>`:''}
              ${(ev.resourceLinks||[]).length?`<div class="intervention-field"><div class="intervention-field-label">Resource Links</div>${ev.resourceLinks.map(l=>`<div><a href="${DPC.escHtml(l)}" target="_blank" rel="noopener" style="font-size:.82rem">${DPC.escHtml(l)}</a></div>`).join('')}</div>`:''}
              <!-- Actions -->
              <div style="margin-top:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <strong style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--col-muted)">Actions (${ev.actions?.length||0})</strong>
                  <button class="btn btn-ghost btn-sm" type="button" onclick="DPC.App.addCPDAction('${ev.id}')">+ Add Action</button>
                </div>
                ${(ev.actions||[]).length===0?'<div style="font-size:.8rem;color:var(--col-muted)">No actions yet.</div>'
                  :`<table class="table-base" style="font-size:.78rem"><thead><tr><th>Action</th><th>Expected Impact</th><th>Status</th><th></th></tr></thead><tbody>
                  ${(ev.actions||[]).map(a=>`<tr>
                    <td>${DPC.escHtml(a.text||'—')}</td>
                    <td style="color:var(--col-muted)">${DPC.escHtml((a.expectedImpact||'').slice(0,60))}</td>
                    <td><select aria-label="Status" style="font-size:.7rem;padding:2px 4px;border:1px solid var(--col-border);border-radius:var(--radius);background:var(--col-surface);color:var(--col-text)"
                      onchange="DPC.App.updateCPDActionStatus('${ev.id}','${a.id}',this.value)">
                      <option value="not-started"${a.status==='not-started'?' selected':''}>Not Started</option>
                      <option value="in-progress"${a.status==='in-progress'?' selected':''}>In Progress</option>
                      <option value="completed"${a.status==='completed'?' selected':''}>Completed</option>
                    </select></td>
                    <td><button class="btn btn-ghost btn-sm" type="button" onclick="DPC.App.deleteCPDAction('${ev.id}','${a.id}')" aria-label="Delete">✕</button></td>
                  </tr>`).join('')}
                  </tbody></table>`}
              </div>
            </div>
          </div>`;
        }).join('');

    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="DPC.App.addCPDEventModal()" type="button">+ Add CPD Event</button>
      </div>
      <div>${cards}</div>`;
  },

  toggleCPDCard: function(id) {
    const body = document.getElementById(`cpd-body-${id}`);
    const btn  = body?.previousElementSibling;
    if (!body) return;
    const open = body.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', open);
  },

  addCPDEventModal: function(existingId) {
    const existing = existingId ? (DPC.DB.myCPD||[]).find(e=>e.id===existingId) : null;
    const body = `
      <div class="form-field"><label class="form-label" for="cpd-title">Event Title</label>
        <input class="form-input" id="cpd-title" value="${DPC.escHtml(existing?.title||'')}" placeholder="e.g. Jisc Digital Leaders Conference 2026"></div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="cpd-date">Date</label>
          <input class="form-input" id="cpd-date" type="date" value="${existing?.date||new Date().toISOString().split('T')[0]}"></div>
        <div class="form-field"><label class="form-label" for="cpd-location">Location</label>
          <input class="form-input" id="cpd-location" value="${DPC.escHtml(existing?.location||'')}" placeholder="Venue or Online"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label class="form-label" for="cpd-hours">Time Investment (hours)</label>
          <input class="form-input" id="cpd-hours" type="number" min="0" step="0.5" value="${existing?.timeInvestmentHours??''}"></div>
        <div class="form-field"><label class="form-label" for="cpd-cost">Event Cost (£)</label>
          <input class="form-input" id="cpd-cost" type="number" min="0" step="0.01" value="${existing?.eventCost??''}"></div>
        <div class="form-field"><label class="form-label" for="cpd-travel">Travel Cost (£)</label>
          <input class="form-input" id="cpd-travel" type="number" min="0" step="0.01" value="${existing?.travelCost??''}"></div>
      </div>
      <div class="form-field"><label class="form-label" for="cpd-stars">Cost-Effectiveness Rating (1–5 ★)</label>
        <select class="form-select" id="cpd-stars">
          <option value="">— Not rated —</option>
          ${[1,2,3,4,5].map(n=>`<option value="${n}"${existing?.costEffectivenessRating===n?' selected':''}>${'★'.repeat(n)}${'☆'.repeat(5-n)} (${n}/5)</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label class="form-label" for="cpd-takeaways">Key Takeaways</label>
        <textarea class="form-textarea" id="cpd-takeaways" rows="4">${DPC.escHtml(existing?.keyTakeaways||'')}</textarea></div>
      <div class="form-field"><label class="form-label" for="cpd-thoughts">Overall Thoughts</label>
        <textarea class="form-textarea" id="cpd-thoughts" rows="3">${DPC.escHtml(existing?.overallThoughts||'')}</textarea></div>
      <div class="form-field"><label class="form-label" for="cpd-links">Resource Links (one per line)</label>
        <textarea class="form-textarea" id="cpd-links" rows="2">${DPC.escHtml((existing?.resourceLinks||[]).join('\n'))}</textarea></div>`;
    DPC.App.openModal(existing?'Edit CPD Event':'Add CPD Event', body, () => {
      const ev = {
        id: existing?.id||DPC.uid(),
        title:       document.getElementById('cpd-title')?.value||'',
        date:        document.getElementById('cpd-date')?.value||'',
        location:    document.getElementById('cpd-location')?.value||'',
        timeInvestmentHours: parseFloat(document.getElementById('cpd-hours')?.value)||null,
        eventCost:   parseFloat(document.getElementById('cpd-cost')?.value)||null,
        travelCost:  parseFloat(document.getElementById('cpd-travel')?.value)||null,
        costEffectivenessRating: parseInt(document.getElementById('cpd-stars')?.value)||null,
        keyTakeaways:  document.getElementById('cpd-takeaways')?.value||'',
        overallThoughts: document.getElementById('cpd-thoughts')?.value||'',
        resourceLinks: (document.getElementById('cpd-links')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean),
        actions: existing?.actions||[]
      };
      if (!DPC.DB.myCPD) DPC.DB.myCPD = [];
      const idx = DPC.DB.myCPD.findIndex(e=>e.id===ev.id);
      if (idx>=0) DPC.DB.myCPD[idx]=ev; else DPC.DB.myCPD.unshift(ev);
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.App.renderMyCPD();
      DPC.showToast(existing?'CPD event updated':'CPD event logged');
    });
  },

  editCPDEvent:   function(id) { DPC.App.addCPDEventModal(id); },

  deleteCPDEvent: function(id) {
    if (!confirm('Delete this CPD event?')) return;
    DPC.DB.myCPD = DPC.DB.myCPD.filter(e=>e.id!==id);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.App.renderMyCPD();
  },

  addCPDAction: function(evId) {
    const body = `
      <div class="form-field"><label class="form-label" for="ca-text">Action</label>
        <input class="form-input" id="ca-text" placeholder="What will you do with this learning?"></div>
      <div class="form-field"><label class="form-label" for="ca-impact">Expected Impact</label>
        <textarea class="form-textarea" id="ca-impact" rows="2"></textarea></div>`;
    DPC.App.openModal('Add CPD Action', body, () => {
      const ev = DPC.DB.myCPD?.find(e=>e.id===evId);
      if (!ev) return;
      if (!ev.actions) ev.actions = [];
      ev.actions.push({id:DPC.uid(),text:document.getElementById('ca-text')?.value||'',expectedImpact:document.getElementById('ca-impact')?.value||'',status:'not-started',completedDate:null});
      DPC.saveToLocalStorage(); DPC.App.markUnsaved();
      DPC.App.renderMyCPD();
    });
  },

  updateCPDActionStatus: function(evId, actionId, status) {
    const ev = DPC.DB.myCPD?.find(e=>e.id===evId);
    const action = ev?.actions?.find(a=>a.id===actionId);
    if (action) { action.status=status; action.completedDate=status==='completed'?new Date().toISOString().split('T')[0]:null; DPC.saveToLocalStorage(); DPC.App.markUnsaved(); }
  },

  deleteCPDAction: function(evId, actionId) {
    const ev = DPC.DB.myCPD?.find(e=>e.id===evId);
    if (!ev) return;
    ev.actions = ev.actions.filter(a=>a.id!==actionId);
    DPC.saveToLocalStorage(); DPC.App.markUnsaved();
    DPC.App.renderMyCPD();
  },

  // ── MODAL ────────────────────────────────────────────────────────
  modalSaveCallback: null,

  openModal: function(title, bodyHtml, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-backdrop').classList.add('open');
    document.getElementById('modal-backdrop').setAttribute('aria-hidden', 'false');
    DPC.App.modalSaveCallback = onSave || null;
    // Focus first input
    setTimeout(() => {
      const first = document.querySelector('#modal-body input, #modal-body textarea, #modal-body select');
      if (first) first.focus();
    }, 50);
  },

  closeModal: function() {
    document.getElementById('modal-backdrop').classList.remove('open');
    document.getElementById('modal-backdrop').setAttribute('aria-hidden', 'true');
    DPC.App.modalSaveCallback = null;
  },

  confirmModal: function() {
    if (DPC.App.modalSaveCallback) DPC.App.modalSaveCallback();
    DPC.App.closeModal();
  },

  // ── THEME ─────────────────────────────────────────────────────────
  applyTheme: function() {
    const theme = DPC.DB?.settings?.theme || localStorage.getItem('dpc-theme') || 'auto';
    if (theme === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else if (theme === 'light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  },

  toggleTheme: function() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dpc-theme', next);
    if (DPC.DB?.settings) DPC.DB.settings.theme = next;
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = next === 'dark' ? '☀' : '☾';
  },

  // ── SETTINGS ──────────────────────────────────────────────────────
  renderSettings: function() {
    const el = document.getElementById('settings-content');
    if (!el) return;
    el.innerHTML = `
      <div class="card mb-16">
        <div class="card-header"><span class="card-title">Data Management</span></div>
        <div class="card-body">
          <p class="text-sm mb-16">Your data is saved automatically to your browser. Use the buttons below to manage it.</p>
          <div class="flex gap-8 flex-wrap">
            <button class="btn btn-primary" onclick="DPC.downloadJSON();DPC.App.markSaved();" type="button">⬇ Download dpc-data.json</button>
            <button class="btn btn-secondary" onclick="DPC.App.importJSON()" type="button">⬆ Import dpc-data.json</button>
            <button class="btn btn-danger" onclick="DPC.App.clearData()" type="button">✕ Clear All Data</button>
          </div>
          <p class="text-xs text-muted mt-12">
            After downloading, save <code>dpc-data.json</code> to your backup folder
            (e.g. <code>Documents/DPC-Hub-Data/</code>). Your live data always stays in this browser.
            To restore on a new machine or after clearing your browser, use Import below.
          </p>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><span class="card-title">About This Build</span></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-8">DPC Impact Hub · Weston College Group · Digital Pedagogy Coach · 2025–27 Pilot</p>
          <p class="text-sm text-muted mb-8">Phase 3 complete · WCAG 2.2 AA · Schema v2.0</p>
          <p class="text-sm text-muted">Last saved: <strong id="s-last-saved">—</strong></p>
        </div>
      </div>`;
  },

  importJSON: function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported.areas && Array.isArray(imported.areas)) {
            DPC.DB = imported;
            DPC.saveToLocalStorage();
            DPC.App.markSaved();
            DPC.showToast('Data imported successfully');
            location.reload();
          } else {
            alert('Invalid data file format.');
          }
        } catch(ex) {
          alert('Could not parse JSON file: ' + ex.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  clearData: function() {
    if (!confirm('This will clear ALL locally stored data. Are you sure?')) return;
    localStorage.removeItem('dpc-impact-hub-v2');
    DPC.showToast('Local data cleared — page will reload');
    setTimeout(() => location.reload(), 1500);
  },

  // ── SAVE REMINDER ─────────────────────────────────────────────
  showSaveReminder: function() {
    // Show a persistent banner reminding where to save the file
    const existing = document.getElementById('save-reminder-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'save-reminder-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:var(--col-text);color:var(--col-surface);
      padding:14px 20px;border-radius:var(--radius-lg);
      box-shadow:var(--shadow-md);z-index:700;
      font-size:.875rem;line-height:1.5;
      display:flex;align-items:center;gap:16px;
      max-width:520px;width:calc(100vw - 40px);
    `;
    banner.innerHTML = `
      <span>
        <strong>dpc-data.json downloaded.</strong><br>
        Drag it into <code style="background:rgba(255,255,255,.15);padding:1px 5px;border-radius:3px">Documents/DPC-Hub-Data/</code> to keep your backup up to date.
      </span>
      <button type="button" onclick="this.parentElement.remove()" aria-label="Dismiss"
        style="background:rgba(255,255,255,.15);border:none;color:inherit;padding:4px 10px;border-radius:var(--radius);cursor:pointer;flex-shrink:0;font-size:.85rem">
        Got it
      </button>`;
    document.body.appendChild(banner);
    setTimeout(() => banner?.remove(), 8000);
  }
};

// ── SCREEN READER ANNOUNCE ────────────────────────────────────────
DPC.announce = function(msg) {
  const el = document.getElementById('sr-live');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
};

// ── TOAST ─────────────────────────────────────────────────────────
DPC.showToast = function(msg, duration) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.setAttribute('role','status');
  toast.setAttribute('aria-live','polite');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration || 3000);
};

// ── BOOT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => DPC.App.init());