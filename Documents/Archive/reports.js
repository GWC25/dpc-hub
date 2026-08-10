/* ================================================================
   reports.js — DPC Impact Hub  v1.0
   Report Builder: generates audience-specific Word .docx files
   via the python-docx server-side script.

   Templates:
   1. Neil Davies weekly (Line Manager)
   2. Digital Lead area report
   3. AP area report (for HoAs / APs)
   4. Ben Manning monthly (VP Overview)

   All reports pull from DPC.getAreaReportData() or
   DPC.getCollegeReportData() — no direct DB access here.
   ================================================================ */

DPC.Reports = {

  // ── DIMENSION LABELS ─────────────────────────────────────────────
  dimLabels: {
    staffCapability:         'Staff Digital Capability',
    hoaLeadership:           'HoA Digital Leadership',
    infrastructureDevices:   'Infrastructure & Devices',
    digitalSkillsAssessment: 'Digital Skills Assessment',
    curriculumIntegration:   'Curriculum Integration',
    learnerReadiness:        'Learner Readiness',
    accessibilityHealth:     'Accessibility & Inclusion',
    digitalLeadEngagement:   'Digital Lead Engagement',
  },

  ragLabels: {
    1: 'Urgent',
    2: 'Challenged',
    3: 'Developing',
    4: 'On Track',
    5: 'Confident',
  },

  ragColours: {
    1: 'C00000', // deep red
    2: 'FF0000', // red
    3: 'FF9900', // amber
    4: '92D050', // green
    5: '00B050', // deep green
  },

  // ── RENDER THE REPORT BUILDER UI ─────────────────────────────────
  renderUI: function(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
    <div class="report-builder">

      <!-- ── Report type selector ── -->
      <div class="card mb-16">
        <div class="card-header"><span class="card-title">Select Report Type</span></div>
        <div class="card-body">
          <div class="report-type-grid" role="group" aria-label="Report type">
            ${DPC.Reports._typeBtn('neil-weekly',    '◈', 'Neil Davies Weekly',       'What happened this week, open actions, coming up')}
            ${DPC.Reports._typeBtn('digital-lead',   '◉', 'Digital Lead Report',       'Area detail: RAG, focus, activities, health checks, staff dev')}
            ${DPC.Reports._typeBtn('ap-area',        '⊡', 'AP Area Report',            'Area trajectory, completed activity, expected impact, what to look for')}
            ${DPC.Reports._typeBtn('ben-monthly',    '◫', 'Ben Manning Monthly',       'College-wide RAG, movements, strategic progress, evidence')}
          </div>
        </div>
      </div>

      <!-- ── Report options (revealed per type) ── -->
      <div id="report-options-panel" class="card mb-16" style="display:none">
        <div class="card-header"><span class="card-title" id="report-options-title">Options</span></div>
        <div class="card-body" id="report-options-body">
          <!-- Populated by _renderOptions() -->
        </div>
      </div>

      <!-- ── Generate button + status ── -->
      <div id="report-generate-panel" style="display:none" class="mb-16">
        <button class="btn btn-primary" id="btn-generate-report" type="button"
          onclick="DPC.Reports.generate()" aria-label="Generate report document">
          ⬇ Generate Word Document
        </button>
        <div id="report-status" class="report-status" role="status" aria-live="polite" style="display:none"></div>
      </div>

      <!-- ── Preview pane ── -->
      <div id="report-preview-panel" class="card" style="display:none">
        <div class="card-header">
          <span class="card-title">Report Preview</span>
          <button class="btn btn-ghost btn-sm" onclick="DPC.Reports.generate()" type="button">
            ↻ Regenerate
          </button>
        </div>
        <div class="card-body">
          <div id="report-preview-body" class="report-preview-body"></div>
        </div>
      </div>

    </div>`;

    // Wire report type buttons
    el.querySelectorAll('.report-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.report-type-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        DPC.Reports._currentType = btn.dataset.type;
        DPC.Reports._renderOptions();
      });
    });
  },

  _currentType: null,
  _currentOptions: {},

  _typeBtn: function(type, icon, label, desc) {
    return `<button class="report-type-btn" data-type="${type}" type="button"
      role="button" aria-pressed="false">
      <span class="report-type-icon" aria-hidden="true">${icon}</span>
      <span class="report-type-label">${label}</span>
      <span class="report-type-desc">${desc}</span>
    </button>`;
  },

  _renderOptions: function() {
    const panel = document.getElementById('report-options-panel');
    const title = document.getElementById('report-options-title');
    const body  = document.getElementById('report-options-body');
    const genPanel = document.getElementById('report-generate-panel');
    if (!panel || !body) return;

    const type = DPC.Reports._currentType;
    let html = '';

    // Date range — all report types use this
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const dateRange = `
      <div class="form-row mb-12">
        <div class="form-group" style="flex:1">
          <label class="form-label" for="rpt-date-from">Activity from</label>
          <input class="form-input" type="date" id="rpt-date-from" value="${weekAgo}" aria-label="Activity from date">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label" for="rpt-date-to">Activity to</label>
          <input class="form-input" type="date" id="rpt-date-to" value="${today}" aria-label="Activity to date">
        </div>
      </div>`;

    // Area selector — for area-specific reports
    const areaOptions = (DPC.DB.areas || [])
      .map(a => `<option value="${a.code}">${a.code} — ${a.name}</option>`)
      .join('');
    const areaSelect = `
      <div class="form-group mb-12">
        <label class="form-label" for="rpt-area-select">Curriculum area</label>
        <select class="form-input" id="rpt-area-select" aria-label="Select curriculum area">
          <option value="">Select an area…</option>
          ${areaOptions}
        </select>
      </div>`;

    // Multi-area selector — for Ben Manning (all, or pick subset)
    const multiAreaSelect = `
      <div class="form-group mb-12">
        <label class="form-label" for="rpt-areas-multi">Areas to include
          <span style="font-weight:400;font-size:0.85em">(leave blank for all)</span>
        </label>
        <select class="form-input" id="rpt-areas-multi" multiple size="6"
          aria-label="Select areas to include (multi-select)">
          ${areaOptions}
        </select>
      </div>`;

    if (type === 'neil-weekly') {
      title.textContent = 'Neil Davies Weekly Report Options';
      html = `
        ${dateRange}
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-neil-highlights">Key highlights this week
            <span style="font-weight:400;font-size:0.85em">(freetext — appears in intro paragraph)</span>
          </label>
          <textarea class="form-input" id="rpt-neil-highlights" rows="3"
            placeholder="E.g. Completed second round of HoA meetings, delivered Teams CPD to BUI area…"
            aria-label="Key highlights this week"></textarea>
        </div>
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-neil-blockers">Blockers / support needed</label>
          <textarea class="form-input" id="rpt-neil-blockers" rows="2"
            placeholder="E.g. Awaiting Digital Strategy from Joe Abulgani to align framework targets…"
            aria-label="Blockers or support needed"></textarea>
        </div>
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-neil-coming">Coming up next week</label>
          <textarea class="form-input" id="rpt-neil-coming" rows="2"
            placeholder="E.g. Learning walk in HBH, Teach Meet on AI tools, RAG review for CON…"
            aria-label="Plans for next week"></textarea>
        </div>`;
    }

    else if (type === 'digital-lead') {
      title.textContent = 'Digital Lead Report Options';
      html = `
        ${areaSelect}
        ${dateRange}
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-dl-focus">Current focus statement
            <span style="font-weight:400;font-size:0.85em">(overrides auto-generated if provided)</span>
          </label>
          <textarea class="form-input" id="rpt-dl-focus" rows="2"
            placeholder="Optional — leave blank to auto-generate from current actions"
            aria-label="Current focus statement"></textarea>
        </div>`;
    }

    else if (type === 'ap-area') {
      title.textContent = 'AP Area Report Options';
      html = `
        ${areaSelect}
        ${dateRange}
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-ap-obs">Suggested observation focus</label>
          <textarea class="form-input" id="rpt-ap-obs" rows="2"
            placeholder="E.g. Look for evidence of structured peer feedback via Teams; check digital skills embedded in assessment tasks…"
            aria-label="Suggested observation focus"></textarea>
        </div>`;
    }

    else if (type === 'ben-monthly') {
      title.textContent = 'Ben Manning Monthly Overview Options';
      html = `
        ${dateRange}
        ${multiAreaSelect}
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-ben-headline">Strategic headline
            <span style="font-weight:400;font-size:0.85em">(1-2 sentences for the exec summary)</span>
          </label>
          <textarea class="form-input" id="rpt-ben-headline" rows="2"
            placeholder="E.g. The pilot has now completed its first full semester with 26 HoA meetings delivered and 12 Digital Leads identified…"
            aria-label="Strategic headline"></textarea>
        </div>
        <div class="form-group mb-12">
          <label class="form-label" for="rpt-ben-risks">Risks / escalations</label>
          <textarea class="form-input" id="rpt-ben-risks" rows="2"
            placeholder="E.g. College digital strategy remains unpublished — creates alignment risk for area targets…"
            aria-label="Risks and escalations"></textarea>
        </div>`;
    }

    body.innerHTML = html;
    panel.style.display = '';
    genPanel.style.display = '';

    // Trigger preview when area changes
    const areaSel = document.getElementById('rpt-area-select');
    if (areaSel) areaSel.addEventListener('change', () => DPC.Reports._renderPreview());
  },

  // ── PREVIEW ───────────────────────────────────────────────────────
  _renderPreview: function() {
    const type    = DPC.Reports._currentType;
    const preview = document.getElementById('report-preview-body');
    const panel   = document.getElementById('report-preview-panel');
    if (!preview || !panel) return;

    const opts = DPC.Reports._gatherOptions();
    let html = '';

    if (type === 'neil-weekly') {
      const data = DPC.getCollegeReportData({ weekStart: opts.dateFrom, weekEnd: opts.dateTo });
      html = DPC.Reports._previewNeilWeekly(data, opts);
    } else if (type === 'digital-lead' || type === 'ap-area') {
      if (!opts.areaCode) {
        preview.innerHTML = '<p class="text-muted">Select an area to preview.</p>';
        panel.style.display = '';
        return;
      }
      const data = DPC.getAreaReportData(opts.areaCode, { weekStart: opts.dateFrom, weekEnd: opts.dateTo });
      html = type === 'digital-lead'
        ? DPC.Reports._previewDigitalLead(data, opts)
        : DPC.Reports._previewAP(data, opts);
    } else if (type === 'ben-monthly') {
      const data = DPC.getCollegeReportData({ weekStart: opts.dateFrom, weekEnd: opts.dateTo });
      html = DPC.Reports._previewBenManning(data, opts);
    }

    preview.innerHTML = html || '<p class="text-muted">No data to preview.</p>';
    panel.style.display = '';
  },

  _gatherOptions: function() {
    return {
      dateFrom:       document.getElementById('rpt-date-from')?.value || null,
      dateTo:         document.getElementById('rpt-date-to')?.value || null,
      areaCode:       document.getElementById('rpt-area-select')?.value || null,
      highlights:     document.getElementById('rpt-neil-highlights')?.value || '',
      blockers:       document.getElementById('rpt-neil-blockers')?.value || '',
      comingUp:       document.getElementById('rpt-neil-coming')?.value || '',
      dlFocus:        document.getElementById('rpt-dl-focus')?.value || '',
      apObs:          document.getElementById('rpt-ap-obs')?.value || '',
      benHeadline:    document.getElementById('rpt-ben-headline')?.value || '',
      benRisks:       document.getElementById('rpt-ben-risks')?.value || '',
      multiAreas:     [...(document.getElementById('rpt-areas-multi')?.selectedOptions || [])].map(o => o.value),
    };
  },

  // ── PREVIEW RENDERERS ─────────────────────────────────────────────
  _previewNeilWeekly: function(data, opts) {
    const dateFrom = DPC.formatDate(opts.dateFrom);
    const dateTo   = DPC.formatDate(opts.dateTo);
    const actCount = data.allRecentActivities.length + data.recentIndividual.length;
    const openCount = data.allOpenActions.length;

    // Group activities by normalised cluster for the "this week" section
    const grouped = {};
    [...data.allRecentActivities, ...data.recentIndividual].forEach(a => {
      const key = DPC.normaliseAction(a.type + ' ' + (a.notes || ''));
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });

    let actHtml = '';
    if (actCount === 0) {
      actHtml = '<p class="text-muted">No activities logged in this period.</p>';
    } else {
      actHtml = '<ul class="preview-list">';
      Object.entries(grouped).forEach(([cluster, acts]) => {
        const label = cluster.replace(/[|-]/g, ' / ').replace(/\b\w/g, c => c.toUpperCase());
        actHtml += `<li><strong>${DPC.escHtml(label)}:</strong> ${acts.length} activity${acts.length > 1 ? 'ies' : 'y'}
          — ${acts.map(a => DPC.escHtml(a.areaCode || '')).filter(Boolean).join(', ') || 'cross-college'}</li>`;
      });
      actHtml += '</ul>';
    }

    const ragRows = DPC.DB.areas.map(area => {
      const overall = area.ragRatings?.current?.overall;
      const {label, cls} = DPC.ragLabel(overall);
      return `<tr>
        <td>${DPC.escHtml(area.code)}</td>
        <td>${DPC.escHtml(area.name)}</td>
        <td><span class="badge badge-${cls}">${overall ? `${overall} · ${label}` : '—'}</span></td>
      </tr>`;
    }).join('');

    return `
      <div class="preview-doc">
        <div class="preview-header">
          <div class="preview-logo">DPC Impact Hub</div>
          <div class="preview-meta">
            <strong>Weekly Update — Neil Davies</strong><br>
            Period: ${dateFrom} – ${dateTo}<br>
            Prepared: ${DPC.formatDate(new Date().toISOString())}
          </div>
        </div>

        ${opts.highlights ? `<div class="preview-section">
          <h3 class="preview-h3">Summary</h3>
          <p>${DPC.escHtml(opts.highlights)}</p>
        </div>` : ''}

        <div class="preview-section">
          <h3 class="preview-h3">Activity this period (${actCount} logged)</h3>
          ${actHtml}
        </div>

        ${openCount > 0 ? `<div class="preview-section">
          <h3 class="preview-h3">Open actions (${openCount})</h3>
          <ul class="preview-list">
            ${data.allOpenActions.slice(0,8).map(a =>
              `<li>${DPC.escHtml(a.areaCode)} — ${DPC.escHtml(a.text || a.notes || '').slice(0,100)}</li>`
            ).join('')}
            ${openCount > 8 ? `<li>…and ${openCount - 8} more</li>` : ''}
          </ul>
        </div>` : ''}

        ${opts.blockers ? `<div class="preview-section">
          <h3 class="preview-h3">Blockers / support needed</h3>
          <p>${DPC.escHtml(opts.blockers)}</p>
        </div>` : ''}

        ${opts.comingUp ? `<div class="preview-section">
          <h3 class="preview-h3">Coming up</h3>
          <p>${DPC.escHtml(opts.comingUp)}</p>
        </div>` : ''}

        <div class="preview-section">
          <h3 class="preview-h3">RAG snapshot (all areas)</h3>
          <table class="preview-table" aria-label="RAG snapshot">
            <thead><tr><th>Code</th><th>Area</th><th>Overall RAG</th></tr></thead>
            <tbody>${ragRows}</tbody>
          </table>
        </div>
      </div>`;
  },

  _previewDigitalLead: function(data, opts) {
    const focusText = opts.dlFocus ||
      (data.currentActions.length ? data.currentActions.map(a => a.phase).join('; ') : 'No current actions logged.');

    const dimRows = Object.entries(DPC.Reports.dimLabels).map(([key, label]) => {
      const score = data.ragSummary[key];
      const {label: rl, cls} = DPC.ragLabel(score);
      return `<tr>
        <td>${DPC.escHtml(label)}</td>
        <td><span class="badge badge-${cls}">${score ? `${score} · ${rl}` : '—'}</span></td>
        <td>${DPC.escHtml(data.currentActions.find(a =>
          DPC.normaliseAction(a.phase).includes(key.toLowerCase().slice(0,5))
        )?.expectedOutcome || '—')}</td>
      </tr>`;
    }).join('');

    const hcRows = data.healthChecks.slice(0,3).map(hc =>
      `<tr><td>${DPC.formatDate(hc.date)}</td><td>${DPC.escHtml(hc.type || '—')}</td><td>${hc.score || '—'}</td></tr>`
    ).join('') || '<tr><td colspan="3">No health check records.</td></tr>';

    const staffRows = data.staffMembers.map(sm => {
      const conf = sm.currentConfidence ? `${sm.currentConfidence}/5` : '—';
      const lastCPD = sm.cpdLog?.[sm.cpdLog.length - 1];
      return `<tr>
        <td>${DPC.escHtml(sm.name)}</td>
        <td>${conf}</td>
        <td>${lastCPD ? `${DPC.escHtml(lastCPD.course)} (${DPC.formatDate(lastCPD.date)})` : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="3">No staff development records.</td></tr>';

    return `
      <div class="preview-doc">
        <div class="preview-header">
          <div class="preview-logo">DPC Impact Hub</div>
          <div class="preview-meta">
            <strong>Digital Lead Report — ${DPC.escHtml(data.code)}: ${DPC.escHtml(data.name)}</strong><br>
            HoA: ${DPC.escHtml(data.hoaName || '—')} · Digital Lead: ${DPC.escHtml(data.dlName || '—')}<br>
            Prepared: ${DPC.formatDate(new Date().toISOString())}
          </div>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Area Overview</h3>
          <p>${DPC.escHtml(data.context || 'No context recorded.')}</p>
          <p><strong>Strengths:</strong> ${DPC.escHtml(data.strengths || '—')}</p>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Current Focus</h3>
          <p>${DPC.escHtml(focusText)}</p>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">RAG Summary — 8 Dimensions</h3>
          <table class="preview-table" aria-label="RAG dimension scores">
            <thead><tr><th>Dimension</th><th>Score</th><th>Focus / Expected Outcome</th></tr></thead>
            <tbody>${dimRows}</tbody>
          </table>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Recent Activity</h3>
          ${data.recentActivities.length
            ? `<ul class="preview-list">${data.recentActivities.map(a =>
                `<li>${DPC.formatDate(a.dateLogged)} — ${DPC.escHtml(a.type || 'Activity')}: ${DPC.escHtml((a.notes||'').slice(0,120))}</li>`
              ).join('')}</ul>`
            : '<p class="text-muted">No activities in this period.</p>'}
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Open Action Points</h3>
          ${data.openActions.length
            ? `<ul class="preview-list">${data.openActions.map(a =>
                `<li>${DPC.escHtml((a.text||a.notes||'').slice(0,120))}</li>`
              ).join('')}</ul>`
            : '<p class="text-muted">No open actions.</p>'}
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Accessibility & Inclusion Health Checks</h3>
          <table class="preview-table" aria-label="Health check records">
            <thead><tr><th>Date</th><th>Type</th><th>Score</th></tr></thead>
            <tbody>${hcRows}</tbody>
          </table>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Staff Development</h3>
          <table class="preview-table" aria-label="Staff development records">
            <thead><tr><th>Staff Member</th><th>Confidence</th><th>Most Recent CPD</th></tr></thead>
            <tbody>${staffRows}</tbody>
          </table>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Now / Next / Future</h3>
          ${data.currentActions.length
            ? `<ul class="preview-list">${data.currentActions.map(a =>
                `<li><strong>${DPC.escHtml(a.status === 'in-progress' ? 'Now' : 'Next')}:</strong>
                 ${DPC.escHtml(a.phase)}
                 ${a.targetDate ? ` (target: ${DPC.formatDate(a.targetDate)})` : ''}
                 ${a.expectedOutcome ? ` — ${DPC.escHtml(a.expectedOutcome)}` : ''}</li>`
              ).join('')}</ul>`
            : '<p class="text-muted">No current actions recorded.</p>'}
        </div>
      </div>`;
  },

  _previewAP: function(data, opts) {
    // Build trajectory narrative from RAG history
    let trajectory = '';
    if (data.ragHistory.length >= 2) {
      const first = data.ragHistory[0];
      const last  = data.ragHistory[data.ragHistory.length - 1];
      const dir   = last.overall > first.overall ? 'improved' : last.overall < first.overall ? 'declined' : 'remained stable';
      const fl    = DPC.Reports.ragLabels[first.overall] || '—';
      const ll    = DPC.Reports.ragLabels[last.overall]  || '—';
      trajectory  = `This area has ${dir} from ${fl} (${DPC.formatDate(first.date)}) to ${ll} (${DPC.formatDate(last.date)}).`;
    } else {
      trajectory = 'Insufficient RAG history for trajectory analysis.';
    }

    const dimRows = Object.entries(DPC.Reports.dimLabels).map(([key, label]) => {
      const score = data.ragSummary[key];
      const {label: rl, cls} = DPC.ragLabel(score);
      return `<tr>
        <td>${DPC.escHtml(label)}</td>
        <td><span class="badge badge-${cls}">${score ? `${score} · ${rl}` : '—'}</span></td>
      </tr>`;
    }).join('');

    const completedCPD = data.staffMembers.flatMap(sm =>
      (sm.cpdLog || []).map(c => ({ staffName: sm.name, ...c }))
    );

    const cpdRows = completedCPD.length
      ? completedCPD.map(c => `<tr>
          <td>${DPC.escHtml(c.staffName)}</td>
          <td>${DPC.escHtml(c.course)}</td>
          <td>${DPC.formatDate(c.date)}</td>
          <td>${c.hours || '—'}h</td>
        </tr>`).join('')
      : '<tr><td colspan="4">No staff CPD recorded.</td></tr>';

    return `
      <div class="preview-doc">
        <div class="preview-header">
          <div class="preview-logo">DPC Impact Hub</div>
          <div class="preview-meta">
            <strong>AP Area Report — ${DPC.escHtml(data.code)}: ${DPC.escHtml(data.name)}</strong><br>
            HoA: ${DPC.escHtml(data.hoaName || '—')}<br>
            Prepared: ${DPC.formatDate(new Date().toISOString())}
          </div>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Area Overview</h3>
          <p>${DPC.escHtml(data.context || 'No context recorded.')}</p>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Trajectory</h3>
          <p>${trajectory}</p>
          <p><strong>Overall RAG:</strong> ${DPC.ragBadge(data.ragSummary.overall)}</p>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">RAG by Dimension</h3>
          <table class="preview-table" aria-label="RAG dimension scores">
            <thead><tr><th>Dimension</th><th>Score</th></tr></thead>
            <tbody>${dimRows}</tbody>
          </table>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Recent Activity (completed)</h3>
          ${data.recentActivities.length
            ? `<ul class="preview-list">${data.recentActivities.map(a =>
                `<li>${DPC.formatDate(a.dateLogged)} — ${DPC.escHtml(a.type || 'Activity')}: ${DPC.escHtml((a.notes||'').slice(0,120))}</li>`
              ).join('')}</ul>`
            : '<p class="text-muted">No activities in this period.</p>'}
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Accessibility & Inclusion — Area Summary</h3>
          ${data.healthChecks.length
            ? `<p>Last health check: ${DPC.formatDate(data.healthChecks[0].date)}.
               Score: ${data.healthChecks[0].score || '—'}</p>`
            : '<p class="text-muted">No health check records.</p>'}
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Staff Development Completed</h3>
          <table class="preview-table" aria-label="Staff CPD log">
            <thead><tr><th>Staff</th><th>Course</th><th>Date</th><th>Hours</th></tr></thead>
            <tbody>${cpdRows}</tbody>
          </table>
        </div>

        ${data.recentInterventions.length ? `<div class="preview-section">
          <h3 class="preview-h3">Expected Impact</h3>
          <ul class="preview-list">
            ${data.recentInterventions.filter(iv => iv.expectedImpact).map(iv =>
              `<li>${DPC.escHtml(iv.expectedImpact)}</li>`
            ).join('') || '<li>No expected impact statements recorded for this period.</li>'}
          </ul>
        </div>` : ''}

        ${opts.apObs ? `<div class="preview-section">
          <h3 class="preview-h3">Suggested Observation Focus</h3>
          <p>${DPC.escHtml(opts.apObs)}</p>
        </div>` : ''}

        <div class="preview-section">
          <h3 class="preview-h3">Where Was / Is Now / Where Next</h3>
          <ul class="preview-list">
            <li><strong>Was:</strong> ${trajectory}</li>
            <li><strong>Is now:</strong> ${DPC.escHtml(data.context || data.strengths || '—')}</li>
            <li><strong>Where next:</strong> ${DPC.escHtml(data.currentActions.map(a => a.phase).join('; ') || data.m2AFIs || '—')}</li>
          </ul>
        </div>
      </div>`;
  },

  _previewBenManning: function(data, opts) {
    const dist = data.ragDistribution;
    const total = Object.values(dist).reduce((a,b) => a+b, 0);

    const distRows = [5,4,3,2,1].map(n => {
      const count = dist[n] || 0;
      const pct   = total ? Math.round(count / total * 100) : 0;
      const {label, cls} = DPC.ragLabel(n);
      return `<tr>
        <td><span class="badge badge-${cls}">${n} · ${label}</span></td>
        <td>${count} area${count !== 1 ? 's' : ''}</td>
        <td>${pct}%</td>
      </tr>`;
    }).join('');

    const moverRows = data.movers.length
      ? data.movers.map(m => {
          const {label: pl, cls: pc} = DPC.ragLabel(m.prev);
          const {label: cl, cls: cc} = DPC.ragLabel(m.curr);
          const dir = m.curr > m.prev ? '▲' : '▼';
          return `<tr>
            <td>${DPC.escHtml(m.code)}</td>
            <td>${DPC.escHtml(m.name)}</td>
            <td><span class="badge badge-${pc}">${m.prev} · ${pl}</span></td>
            <td>${dir}</td>
            <td><span class="badge badge-${cc}">${m.curr} · ${cl}</span></td>
            <td>${DPC.formatDate(m.date)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6">No RAG movements recorded.</td></tr>';

    const actCount = data.allRecentActivities.length + data.recentIndividual.length;

    return `
      <div class="preview-doc">
        <div class="preview-header">
          <div class="preview-logo">DPC Impact Hub</div>
          <div class="preview-meta">
            <strong>Monthly Overview — Ben Manning</strong><br>
            Period: ${DPC.formatDate(opts.dateFrom)} – ${DPC.formatDate(opts.dateTo)}<br>
            Prepared: ${DPC.formatDate(new Date().toISOString())}
          </div>
        </div>

        ${opts.benHeadline ? `<div class="preview-section">
          <h3 class="preview-h3">Strategic Headline</h3>
          <p>${DPC.escHtml(opts.benHeadline)}</p>
        </div>` : ''}

        <div class="preview-section">
          <h3 class="preview-h3">College-Wide RAG Distribution</h3>
          <table class="preview-table" aria-label="RAG distribution">
            <thead><tr><th>RAG Level</th><th>Areas</th><th>%</th></tr></thead>
            <tbody>${distRows}</tbody>
          </table>
          <p style="margin-top:8px">Total areas tracked: ${total}</p>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Significant RAG Movements</h3>
          <table class="preview-table" aria-label="RAG movements">
            <thead><tr><th>Code</th><th>Area</th><th>Previous</th><th></th><th>Current</th><th>Snapshot date</th></tr></thead>
            <tbody>${moverRows}</tbody>
          </table>
        </div>

        <div class="preview-section">
          <h3 class="preview-h3">Activity Volume</h3>
          <p>${actCount} activities logged in this period across ${data.totalAreas} curriculum areas.</p>
        </div>

        ${opts.benRisks ? `<div class="preview-section">
          <h3 class="preview-h3">Risks / Escalations</h3>
          <p>${DPC.escHtml(opts.benRisks)}</p>
        </div>` : ''}
      </div>`;
  },

  // ── GENERATE (triggers docx download via python-docx script) ─────
  generate: function() {
    const opts    = DPC.Reports._gatherOptions();
    const type    = DPC.Reports._currentType;
    const status  = document.getElementById('report-status');

    // First show preview
    DPC.Reports._renderPreview();

    if (status) {
      status.style.display = '';
      status.className = 'report-status report-status--info';
      status.textContent = 'Preview generated. To export as Word document, use the generate button — Word export requires the local server script (see README).';
    }

    // Build report data package for export
    let reportData;
    if (type === 'neil-weekly') {
      reportData = {
        type, opts,
        data: DPC.getCollegeReportData({ weekStart: opts.dateFrom, weekEnd: opts.dateTo }),
        dimLabels: DPC.Reports.dimLabels,
        ragLabels: DPC.Reports.ragLabels,
      };
    } else if (type === 'digital-lead' || type === 'ap-area') {
      if (!opts.areaCode) {
        if (status) { status.style.display = ''; status.className = 'report-status report-status--error'; status.textContent = 'Please select an area first.'; }
        return;
      }
      reportData = {
        type, opts,
        data: DPC.getAreaReportData(opts.areaCode, { weekStart: opts.dateFrom, weekEnd: opts.dateTo }),
        dimLabels: DPC.Reports.dimLabels,
        ragLabels: DPC.Reports.ragLabels,
      };
    } else if (type === 'ben-monthly') {
      reportData = {
        type, opts,
        data: DPC.getCollegeReportData({ weekStart: opts.dateFrom, weekEnd: opts.dateTo }),
        dimLabels: DPC.Reports.dimLabels,
        ragLabels: DPC.Reports.ragLabels,
      };
    }

    // Offer the data package as a JSON download for the server script
    // (In Phase 3, this will POST to a local endpoint)
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {type:'application/json'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `dpc-report-${type}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    if (status) {
      status.className = 'report-status report-status--success';
      status.textContent = '✓ Report data exported as JSON. Pass this to the report server script to generate the Word document. See README for setup.';
    }
  },

};
