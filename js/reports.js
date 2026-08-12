// DPC Hub · js/reports.js · v1.0 · July 2026
// Report Builder module. Five audience templates.
// Word doc generation via lib/docx.min.js (loaded locally, no CDN).
// AI narrative for the performance review calls js/ai-support.js —
// this file never talks to the Anthropic API directly.
//
// Reads only from window.DPC_DATA. Follows the established module
// convention: self-contained, private _rep*-prefixed helpers,
// no shared DPC namespace dependency.
//
// Imports from: js/schema.js (RAG_DIMENSIONS, RAG_LABELS, AFI_STATUS,
// AFI_SEVERITY, PYRAMID_LEVEL) and js/config.js only, per the
// one-way import rule. No cross-module API calls (Session 65) — the
// performance review narrative is built as a prompt from live data,
// copied out, and the result pasted back in, same as every other AI
// Support feature now.

// ── Report type definitions ─────────────────────────────────────
const REPORT_TYPES = Object.freeze({
  NEIL_FORTNIGHTLY: 'neil-fortnightly',
  DIGITAL_LEAD:     'digital-lead',
  AP_HOA_AREA:      'ap-hoa-area',
  BEN_MONTHLY:      'ben-monthly',
  PERFORMANCE_REVIEW: 'performance-review',
  COLLEGE_ACTION_PLAN: 'college-action-plan',
});

let _repCurrentType = null;

// ── Local helpers (module-private, per established convention) ──
function _repEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _repFmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
  catch(e){ return iso; }
}
function _repRagLabel(score) {
  if (!score) return 'Not scored';
  return RAG_LABELS[score] || 'Not scored';
}

// ── Data access (mirrors the pattern in areas.js / afi.js etc) ──
function _repGetAreas()       { return (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []; }
function _repGetArea(code)    { return _repGetAreas().find(a => a.areaCode === code) || null; }
function _repGetAFIs()        { return (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []; }
function _repGetReflections() { return (window.DPC_DATA.reflections && window.DPC_DATA.reflections.reflections) || []; }
function _repGetStaff()       { return (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []; }
function _repGetCPD()         { return (window.DPC_DATA.cpd && window.DPC_DATA.cpd.cpd) || { entries:[], plannedTraining:[], deliveredCPD:[] }; }
function _repGetCalEntries()  { return (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []; }

function _repAFIsForArea(areaCode) {
  return _repGetAFIs().filter(a => a.areaCode === areaCode);
}
function _repOpenAFIsForArea(areaCode) {
  return _repAFIsForArea(areaCode).filter(a => a.status !== AFI_STATUS.CLOSED);
}
function _repInWindow(iso, from, to) {
  if (!iso) return false;
  const d = new Date(iso);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

// ── RENDER THE REPORT BUILDER UI ─────────────────────────────────
function initReports() {
  const el = document.getElementById('main-content');
  if (!el) return;

  el.innerHTML = `
    <div class="report-builder">
      <div class="card" style="margin-bottom:var(--space-lg);">
        <div class="card-header"><span class="card-title">Select report type</span></div>
        <div class="card-body">
          <div role="group" aria-label="Report type" style="display:flex;flex-direction:column;gap:8px;">
            ${_repTypeBtn(REPORT_TYPES.NEIL_FORTNIGHTLY, 'Neil Davies — Fortnightly', 'Cross-college: activity, open loops, RAG movers, coming up')}
            ${_repTypeBtn(REPORT_TYPES.DIGITAL_LEAD,     'Digital Lead — Area Report', 'Area RAG detail, current focus, CPD suggestions')}
            ${_repTypeBtn(REPORT_TYPES.AP_HOA_AREA,      'AP / HoA — Area Report', 'Area trajectory, staff CPD, suggested observation focus')}
            ${_repTypeBtn(REPORT_TYPES.BEN_MONTHLY,      'Ben Manning — Monthly Overview', 'College-wide RAG distribution, movers, strategic picture')}
            ${_repTypeBtn(REPORT_TYPES.PERFORMANCE_REVIEW, 'Performance Review', 'Full pilot evidence with AI-generated narrative (Sonnet)')}
            ${_repTypeBtn(REPORT_TYPES.COLLEGE_ACTION_PLAN, 'College Action Plan Overview', 'Every open action item, grouped by common theme across all areas — for Ben/Neil')}
          </div>
        </div>
      </div>

      <div id="rep-options-panel" class="card" style="display:none;margin-bottom:var(--space-lg);">
        <div class="card-header"><span class="card-title" id="rep-options-title">Options</span></div>
        <div class="card-body" id="rep-options-body"></div>
      </div>

      <div id="rep-generate-panel" style="display:none;margin-bottom:var(--space-lg);">
        <button class="btn btn--primary" id="rep-btn-generate" type="button">⬇ Generate Word document</button>
        <div id="rep-status" role="status" aria-live="polite" style="margin-top:8px;display:none;"></div>
      </div>

      <div id="rep-preview-panel" class="card" style="display:none;">
        <div class="card-header"><span class="card-title">Preview</span></div>
        <div class="card-body" id="rep-preview-body"></div>
      </div>
    </div>`;

  el.querySelectorAll('.rep-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.rep-type-btn').forEach(b => {
        b.classList.remove('active'); b.setAttribute('aria-pressed','false');
      });
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      _repCurrentType = btn.dataset.type;
      _repRenderOptions();
    });
  });

  document.getElementById('rep-btn-generate').addEventListener('click', _repGenerate);

  // Cross-module deep link (Session 67) — same window._pending*Open
  // pattern as openAreaProfile()/openStaffProfile()/openMeeting(),
  // so "jump to a specific report type" behaves consistently with
  // every other deep link in the Hub rather than inventing a new one.
  if (window._pendingReportType) {
    const targetType = window._pendingReportType;
    window._pendingReportType = null;
    const btn = el.querySelector(`.rep-type-btn[data-type="${targetType}"]`);
    if (btn) btn.click();
  }
}

function openReportType(reportType) {
  window._pendingReportType = reportType;
  navigateTo('reports');
}

function _repTypeBtn(type, label, desc) {
  return `<button class="rep-type-btn" data-type="${type}" type="button" role="button" aria-pressed="false"
    style="text-align:left;padding:var(--space-md);border:2px solid var(--color-border);border-radius:var(--radius-md);
    background:var(--color-white);cursor:pointer;min-height:44px;">
    <span style="display:block;font-weight:var(--font-bold);color:var(--color-navy);">${_repEsc(label)}</span>
    <span style="display:block;font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;">${_repEsc(desc)}</span>
  </button>`;
}

// ── OPTIONS PANEL ──────────────────────────────────────────────
function _repRenderOptions() {
  const panel = document.getElementById('rep-options-panel');
  const title = document.getElementById('rep-options-title');
  const body  = document.getElementById('rep-options-body');
  const genPanel = document.getElementById('rep-generate-panel');
  const type  = _repCurrentType;

  const today = todayISO();
  const twoWeeksAgo = new Date(Date.now() - 14*24*60*60*1000).toISOString().split('T')[0];
  const monthAgo    = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

  const dateRange = (from) => `
    <div style="display:flex;gap:12px;margin-bottom:var(--space-md);">
      <div style="flex:1;"><label class="form-label" for="rep-from">Period from</label>
        <input class="form-input" type="date" id="rep-from" value="${from}"></div>
      <div style="flex:1;"><label class="form-label" for="rep-to">Period to</label>
        <input class="form-input" type="date" id="rep-to" value="${today}"></div>
    </div>`;

  const areaSelect = `
    <div style="margin-bottom:var(--space-md);">
      <label class="form-label" for="rep-area">Curriculum area</label>
      <select class="form-input" id="rep-area">
        <option value="">Select an area…</option>
        ${_repGetAreas().map(a => `<option value="${_repEsc(a.areaCode)}">${_repEsc(a.areaCode)} — ${_repEsc(a.areaName)}</option>`).join('')}
      </select>
    </div>`;

  let html = '';
  if (type === REPORT_TYPES.NEIL_FORTNIGHTLY) {
    title.textContent = 'Neil Davies — Fortnightly Report Options';
    html = `
      ${dateRange(twoWeeksAgo)}
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-highlights">Key highlights this fortnight</label>
        <textarea class="form-input" id="rep-highlights" rows="3" placeholder="Freetext — appears in the summary"></textarea>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-blockers">Blockers / support needed</label>
        <textarea class="form-input" id="rep-blockers" rows="2"></textarea>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-coming">Coming up next fortnight</label>
        <textarea class="form-input" id="rep-coming" rows="2"></textarea>
      </div>`;
  }
  else if (type === REPORT_TYPES.DIGITAL_LEAD) {
    title.textContent = 'Digital Lead Area Report Options';
    html = `${areaSelect}${dateRange(monthAgo)}
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-dl-focus">Current focus statement <span style="font-weight:400;font-size:0.85em">(overrides auto-generated)</span></label>
        <textarea class="form-input" id="rep-dl-focus" rows="2" placeholder="Optional — leave blank to auto-generate from open loops"></textarea>
      </div>`;
  }
  else if (type === REPORT_TYPES.AP_HOA_AREA) {
    title.textContent = 'AP / HoA Area Report Options';
    html = `${areaSelect}${dateRange(monthAgo)}
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-obs-focus">Suggested observation focus</label>
        <textarea class="form-input" id="rep-obs-focus" rows="2" placeholder="E.g. Look for evidence of structured Teams feedback in assessed work…"></textarea>
      </div>`;
  }
  else if (type === REPORT_TYPES.BEN_MONTHLY) {
    title.textContent = 'Ben Manning Monthly Overview Options';
    html = `${dateRange(monthAgo)}
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-headline">Strategic headline <span style="font-weight:400;font-size:0.85em">(1–2 sentences)</span></label>
        <textarea class="form-input" id="rep-headline" rows="2"></textarea>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-risks">Risks / escalations</label>
        <textarea class="form-input" id="rep-risks" rows="2"></textarea>
      </div>`;
  }
  else if (type === REPORT_TYPES.PERFORMANCE_REVIEW) {
    title.textContent = 'Performance Review Options';
    html = `${dateRange(new Date(Date.now() - 180*24*60*60*1000).toISOString().split('T')[0])}
      <div style="background:var(--color-light);border:1px solid var(--color-border);border-radius:var(--radius-md);
        padding:var(--space-md);margin-bottom:var(--space-md);font-size:var(--text-sm);">
        This report uses <strong>currentActions/AFI status</strong> as the closure-rate measure and
        <strong>reflections.reflections[]</strong> for staff voice — both live data sources. The narrative
        section is written outside the Hub — copy the prompt below into a Claude conversation or Project,
        then paste the result back in. No API key, no cost against the Hub.
      </div>
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-pr-context">Additional context for the narrative <span style="font-weight:400;font-size:0.85em">(optional)</span></label>
        <textarea class="form-input" id="rep-pr-context" rows="3" placeholder="Anything you want the narrative to weight or reference specifically…"></textarea>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <button type="button" id="rep-pr-copy-prompt-btn" class="btn btn--ghost btn--sm">Copy narrative prompt (built from live data)</button>
        <p id="rep-pr-copy-status" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;"></p>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <label class="form-label" for="rep-pr-narrative">Paste the narrative back here</label>
        <textarea class="form-input" id="rep-pr-narrative" rows="6" placeholder="Paste the 3-4 paragraph narrative from your Claude conversation here…"></textarea>
      </div>`;
  }
  else if (type === REPORT_TYPES.COLLEGE_ACTION_PLAN) {
    title.textContent = 'College Action Plan Overview Options';
    const allThemes = _repGatherCollegeActionItems().map(t => t.theme);
    html = `
      <div style="background:var(--color-light);border:1px solid var(--color-border);border-radius:var(--radius-md);
        padding:var(--space-md);margin-bottom:var(--space-md);font-size:var(--text-sm);">
        Groups every open Action Plan item across every area by its tagged theme (e.g. "Accessibility & Inclusion," "Staff Capability") — real, existing data, no AI call, no cost. Answers "what are you doing about it" at a whole-college level, not just per-area.
      </div>
      <div style="margin-bottom:var(--space-md);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <p class="form-label">Areas to include <span style="font-weight:400;font-size:0.85em">(all selected by default)</span></p>
          <span>
            <button type="button" class="rep-select-all-btn" data-target="rep-college-area-cb" style="background:none;border:none;color:var(--color-teal);cursor:pointer;font-size:var(--text-xs);text-decoration:underline;">Select all</button> ·
            <button type="button" class="rep-deselect-all-btn" data-target="rep-college-area-cb" style="background:none;border:none;color:var(--color-teal);cursor:pointer;font-size:var(--text-xs);text-decoration:underline;">Deselect all</button>
          </span>
        </div>
        <div style="max-height:160px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px;">
          ${_repGetAreas().map(a => `<label style="display:block;font-size:var(--text-sm);margin-bottom:2px;"><input type="checkbox" class="rep-college-area-cb" value="${a.areaCode}" checked> ${_repEsc(a.areaName)} (${a.areaCode})</label>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:var(--space-md);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <p class="form-label">Themes to include <span style="font-weight:400;font-size:0.85em">(all selected by default)</span></p>
          <span>
            <button type="button" class="rep-select-all-btn" data-target="rep-college-theme-cb" style="background:none;border:none;color:var(--color-teal);cursor:pointer;font-size:var(--text-xs);text-decoration:underline;">Select all</button> ·
            <button type="button" class="rep-deselect-all-btn" data-target="rep-college-theme-cb" style="background:none;border:none;color:var(--color-teal);cursor:pointer;font-size:var(--text-xs);text-decoration:underline;">Deselect all</button>
          </span>
        </div>
        <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px;">
          ${allThemes.length === 0 ? '<p style="font-size:var(--text-xs);color:var(--color-muted);">No open action items right now.</p>' :
            allThemes.map(t => `<label style="display:block;font-size:var(--text-sm);margin-bottom:2px;"><input type="checkbox" class="rep-college-theme-cb" value="${_repEsc(t)}" checked> ${_repEsc(t)}</label>`).join('')}
        </div>
      </div>`;
  }

  body.innerHTML = html;
  panel.style.display = '';
  genPanel.style.display = '';

  document.getElementById('rep-pr-copy-prompt-btn')?.addEventListener('click', () => {
    const opts = _repGatherOptions();
    const promptText = _repBuildNarrativePrompt(opts);
    navigator.clipboard.writeText(promptText).then(() => {
      const s = document.getElementById('rep-pr-copy-status');
      if (s) { s.textContent = '✓ Copied — paste into a Claude conversation, then paste the reply back below.'; s.style.color = 'var(--color-green)'; }
    }).catch(() => {
      const s = document.getElementById('rep-pr-copy-status');
      if (s) { s.textContent = 'Could not copy automatically — select and copy the prompt manually.'; s.style.color = 'var(--color-red)'; }
    });
  });

  // College Action Plan Overview: select-all/deselect-all for the
  // Areas and Themes checklists — same "fresh DOM node per render"
  // reasoning as the copy-prompt button above, safe to bind directly
  // each time rather than needing a persistent-container guard.
  document.querySelectorAll('.rep-select-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`.${btn.dataset.target}`).forEach(cb => { cb.checked = true; });
    });
  });
  document.querySelectorAll('.rep-deselect-all-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`.${btn.dataset.target}`).forEach(cb => { cb.checked = false; });
    });
  });

  const areaSel = document.getElementById('rep-area');
  if (areaSel) areaSel.addEventListener('change', _repRenderPreview);
  el_wireLiveInputs();
  _repRenderPreview();
}

function el_wireLiveInputs() {
  document.querySelectorAll('#rep-options-body input, #rep-options-body textarea, #rep-options-body select')
    .forEach(inp => inp.addEventListener('input', _repRenderPreview));
}

function _repGatherOptions() {
  return {
    dateFrom:   document.getElementById('rep-from')?.value || null,
    dateTo:     document.getElementById('rep-to')?.value || null,
    areaCode:   document.getElementById('rep-area')?.value || null,
    highlights: document.getElementById('rep-highlights')?.value || '',
    blockers:   document.getElementById('rep-blockers')?.value || '',
    comingUp:   document.getElementById('rep-coming')?.value || '',
    dlFocus:    document.getElementById('rep-dl-focus')?.value || '',
    obsFocus:   document.getElementById('rep-obs-focus')?.value || '',
    headline:   document.getElementById('rep-headline')?.value || '',
    risks:      document.getElementById('rep-risks')?.value || '',
    prContext:  document.getElementById('rep-pr-context')?.value || '',
    prNarrative: document.getElementById('rep-pr-narrative')?.value || '',
  };
}

// ── DATA ASSEMBLY ────────────────────────────────────────────────
// Cross-college dataset for Neil / Ben reports
function _repCollegeData(opts) {
  const areas = _repGetAreas();
  const afis  = _repGetAFIs();
  const cal   = _repGetCalEntries().filter(e => _repInWindow(e.date || e.startDate, opts.dateFrom, opts.dateTo));

  const ragDistribution = {1:0,2:0,3:0,4:0,5:0,unscored:0};
  const movers = [];
  areas.forEach(area => {
    const dims = area.ragDimensions || {};
    const scores = RAG_DIMENSIONS.map(d => dims[d.id]?.score).filter(Boolean);
    const overall = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    ragDistribution[overall || 'unscored']++;
    // Movement: compare each dimension's history if present
    RAG_DIMENSIONS.forEach(d => {
      const hist = (dims[d.id]?.history) || [];
      if (hist.length >= 2) {
        const prev = hist[hist.length-2], curr = hist[hist.length-1];
        if (prev.score !== curr.score) {
          movers.push({ areaCode: area.areaCode, areaName: area.areaName, dimension: d.label, prev: prev.score, curr: curr.score, date: curr.date });
        }
      }
    });
  });

  const openAFIsByArea = {};
  afis.forEach(a => {
    if (a.status !== AFI_STATUS.CLOSED) {
      openAFIsByArea[a.areaCode] = (openAFIsByArea[a.areaCode] || 0) + 1;
    }
  });

  // Session 35: college-wide resource-sharing activity for this period —
  // reads from library.js, guarded since script load order shouldn't
  // matter by the time this actually runs (user-triggered, post-load) but
  // defensive either way.
  const allShares = typeof _libGetAllShares === 'function' ? _libGetAllShares() : [];
  const sharesInWindow = allShares.filter(s => _repInWindow(s.date, opts.dateFrom, opts.dateTo));
  const sharesByArea = {};
  sharesInWindow.forEach(s => { sharesByArea[s.areaCode] = (sharesByArea[s.areaCode] || 0) + 1; });

  return { areas, ragDistribution, movers, calEntries: cal, openAFIsByArea, totalAreas: areas.length,
    resourceShares: sharesInWindow, resourceSharesByArea: sharesByArea };
}

// Area-specific dataset for DL / AP-HoA reports
function _repAreaData(areaCode, opts) {
  const area = _repGetArea(areaCode);
  if (!area) return null;

  const afis = _repAFIsForArea(areaCode);
  const openAFIs = afis.filter(a => a.status !== AFI_STATUS.CLOSED);
  const closedAFIs = afis.filter(a => a.status === AFI_STATUS.CLOSED);

  const staff = _repGetStaff().filter(s => s.areaCode === areaCode);
  const cpdEntries = (_repGetCPD().deliveredCPD || []).filter(c =>
    staff.some(s => s.staffId === c.staffId) && _repInWindow(c.date, opts.dateFrom, opts.dateTo));

  const calEntries = _repGetCalEntries().filter(e =>
    e.areaCode === areaCode && _repInWindow(e.date || e.startDate, opts.dateFrom, opts.dateTo));

  const dims = area.ragDimensions || {};
  const ragRows = RAG_DIMENSIONS.map(d => ({
    label: d.label,
    score: dims[d.id]?.score || null,
  }));

  // Session 35: this area's resource-sharing activity for the period — the
  // actual "impact evidence" data: a resource shared with named staff, with
  // context, tied to a date. Sits alongside CPD delivered, same shape as
  // every other evidence type this report already surfaces.
  const resourceShares = (typeof _libGetSharesForArea === 'function' ? _libGetSharesForArea(areaCode) : [])
    .filter(s => _repInWindow(s.date, opts.dateFrom, opts.dateTo));

  return { area, afis, openAFIs, closedAFIs, staff, cpdEntries, calEntries, ragRows, resourceShares };
}

// ── PREVIEW ────────────────────────────────────────────────────
function _repRenderPreview() {
  const panel = document.getElementById('rep-preview-panel');
  const body  = document.getElementById('rep-preview-body');
  if (!panel || !body) return;

  const opts = _repGatherOptions();
  const type = _repCurrentType;
  let html = '<p style="color:var(--color-muted)">No preview available.</p>';

  if (type === REPORT_TYPES.NEIL_FORTNIGHTLY) {
    html = _repPreviewNeil(_repCollegeData(opts), opts);
  } else if (type === REPORT_TYPES.DIGITAL_LEAD || type === REPORT_TYPES.AP_HOA_AREA) {
    if (!opts.areaCode) { body.innerHTML = '<p style="color:var(--color-muted)">Select an area to preview.</p>'; panel.style.display=''; return; }
    const data = _repAreaData(opts.areaCode, opts);
    html = type === REPORT_TYPES.DIGITAL_LEAD ? _repPreviewDL(data, opts) : _repPreviewAPHoA(data, opts);
  } else if (type === REPORT_TYPES.BEN_MONTHLY) {
    html = _repPreviewBen(_repCollegeData(opts), opts);
  } else if (type === REPORT_TYPES.PERFORMANCE_REVIEW) {
    html = `<p style="color:var(--color-muted)">Performance review is generated directly to Word (the narrative is not shown in this preview pane — it's included in the generated document).</p>`;
  } else if (type === REPORT_TYPES.COLLEGE_ACTION_PLAN) {
    html = _repPreviewCollegeActionPlan();
  }

  body.innerHTML = html;
  panel.style.display = '';
}

function _repPreviewNeil(data, opts) {
  const rows = data.areas.map(a => {
    const dims = a.ragDimensions || {};
    const scores = RAG_DIMENSIONS.map(d => dims[d.id]?.score).filter(Boolean);
    const overall = scores.length ? Math.round(scores.reduce((x,y)=>x+y,0)/scores.length) : null;
    const openAFIs = data.openAFIsByArea[a.areaCode] || 0;
    return `<tr><td>${_repEsc(a.areaCode)}</td><td>${_repEsc(a.areaName)}</td>
      <td>${overall ? `${overall} · ${_repEsc(_repRagLabel(overall))}` : '—'}</td>
      <td>${openAFIs}</td></tr>`;
  }).join('');

  return `<div class="report-preview">
    <h3>Weekly/Fortnightly Update — Neil Davies</h3>
    <p style="color:var(--color-muted)">Period: ${_repFmtDate(opts.dateFrom)} – ${_repFmtDate(opts.dateTo)}</p>
    ${opts.highlights ? `<p><strong>Summary:</strong> ${_repEsc(opts.highlights)}</p>` : ''}
    <p>${data.calEntries.length} calendar entries logged this period across ${data.totalAreas} areas.</p>
    ${data.movers.length ? `<p><strong>RAG movers:</strong> ${data.movers.length} dimension movement(s) recorded.</p>` : '<p>No RAG movements recorded this period.</p>'}
    <p><strong>Resources shared:</strong> ${data.resourceShares.length} this period across ${Object.keys(data.resourceSharesByArea).length} area(s).</p>
    <table class="preview-table" style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead><tr><th>Code</th><th>Area</th><th>Overall RAG</th><th>Open loops</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${opts.blockers ? `<p><strong>Blockers:</strong> ${_repEsc(opts.blockers)}</p>` : ''}
    ${opts.comingUp ? `<p><strong>Coming up:</strong> ${_repEsc(opts.comingUp)}</p>` : ''}
  </div>`;
}

function _repPreviewDL(data, opts) {
  const dimRows = data.ragRows.map(d => `<tr><td>${_repEsc(d.label)}</td><td>${d.score ? `${d.score} · ${_repEsc(_repRagLabel(d.score))}` : '—'}</td></tr>`).join('');
  const focusText = opts.dlFocus || (data.openAFIs.length
    ? `${data.openAFIs.length} open loop${data.openAFIs.length!==1?'s':''}: ${data.openAFIs.slice(0,3).map(a=>a.lraThemeLabel||a.lraThemeId).join('; ')}`
    : 'No open loops currently logged.');

  return `<div class="report-preview">
    <h3>Digital Lead Report — ${_repEsc(data.area.areaCode)}: ${_repEsc(data.area.areaName)}</h3>
    <p style="color:var(--color-muted)">HoA: ${_repEsc(data.area.hoaName||'—')} · Digital Lead: ${_repEsc(data.area.dlName||'—')}</p>
    <p><strong>Current focus:</strong> ${_repEsc(focusText)}</p>
    <table class="preview-table" style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead><tr><th>Dimension</th><th>Score</th></tr></thead><tbody>${dimRows}</tbody>
    </table>
    <p style="margin-top:8px"><strong>Open loops:</strong> ${data.openAFIs.length} · <strong>Closed this period:</strong> ${data.closedAFIs.length}</p>
    <p><strong>CPD delivered:</strong> ${data.cpdEntries.length} entries this period</p>
    <p><strong>Resources shared:</strong> ${data.resourceShares.length} this period</p>
  </div>`;
}

function _repPreviewAPHoA(data, opts) {
  const dimRows = data.ragRows.map(d => `<tr><td>${_repEsc(d.label)}</td><td>${d.score ? `${d.score} · ${_repEsc(_repRagLabel(d.score))}` : '—'}</td></tr>`).join('');
  return `<div class="report-preview">
    <h3>AP / HoA Area Report — ${_repEsc(data.area.areaCode)}: ${_repEsc(data.area.areaName)}</h3>
    <p style="color:var(--color-muted)">HoA: ${_repEsc(data.area.hoaName||'—')}</p>
    <table class="preview-table" style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead><tr><th>Dimension</th><th>Score</th></tr></thead><tbody>${dimRows}</tbody>
    </table>
    <p style="margin-top:8px"><strong>Open loops:</strong> ${data.openAFIs.length} · <strong>Closed this period:</strong> ${data.closedAFIs.length}</p>
    <p><strong>Staff CPD this period:</strong> ${data.cpdEntries.length} entries</p>
    <p><strong>Resources shared this period (${data.resourceShares.length}):</strong></p>
    ${data.resourceShares.length ? `<table class="preview-table" style="width:100%;border-collapse:collapse;margin-top:4px;">
      <thead><tr><th>Resource</th><th>Staff</th><th>Date</th></tr></thead>
      <tbody>${data.resourceShares.map(s => `<tr><td>${_repEsc(s.resourceTitle)}</td><td>${_repEsc(typeof _libStaffNames === 'function' ? _libStaffNames(s.staffIds) : (s.staffIds||[]).length + ' staff')}</td><td>${_repFmtDate(s.date)}</td></tr>`).join('')}</tbody>
    </table>` : '<p style="color:var(--color-muted)">None recorded this period.</p>'}
    ${opts.obsFocus ? `<p><strong>Suggested observation focus:</strong> ${_repEsc(opts.obsFocus)}</p>` : ''}
  </div>`;
}

function _repPreviewBen(data, opts) {
  const total = Object.values(data.ragDistribution).reduce((a,b)=>a+b,0);
  const distRows = [5,4,3,2,1,'unscored'].map(n => {
    const count = data.ragDistribution[n] || 0;
    const pct = total ? Math.round(count/total*100) : 0;
    const label = n === 'unscored' ? 'Not yet scored' : `${n} · ${_repRagLabel(n)}`;
    return `<tr><td>${_repEsc(label)}</td><td>${count}</td><td>${pct}%</td></tr>`;
  }).join('');

  return `<div class="report-preview">
    <h3>Monthly Overview — Ben Manning</h3>
    <p style="color:var(--color-muted)">Period: ${_repFmtDate(opts.dateFrom)} – ${_repFmtDate(opts.dateTo)}</p>
    ${opts.headline ? `<p><strong>Strategic headline:</strong> ${_repEsc(opts.headline)}</p>` : ''}
    <table class="preview-table" style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead><tr><th>RAG level</th><th>Areas</th><th>%</th></tr></thead><tbody>${distRows}</tbody>
    </table>
    <p style="margin-top:8px">${data.movers.length} dimension movement(s) recorded this period across ${data.totalAreas} areas.</p>
    <p><strong>Resources shared:</strong> ${data.resourceShares.length} this period across ${Object.keys(data.resourceSharesByArea).length} area(s).</p>
    ${opts.risks ? `<p><strong>Risks / escalations:</strong> ${_repEsc(opts.risks)}</p>` : ''}
  </div>`;
}

// ── DOCX GENERATION HELPERS ───────────────────────────────────────
// Verified pattern (prototype-tested against real Word rendering):
// - explicit dual column widths (table + every cell), DXA units
// - ShadingType.CLEAR, never SOLID
// - bullets via numbering config, never literal "•"
// - separate Paragraphs, never "\n" inside a TextRun
function _repDocHeaderCell(docx, text, width) {
  const { TableCell, Paragraph, TextRun, WidthType, ShadingType } = docx;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: '1D3557' },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] })],
  });
}
function _repDocCell(docx, text, width) {
  const { TableCell, Paragraph, TextRun, WidthType, ShadingType } = docx;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
    children: [new Paragraph({ children: [new TextRun(String(text ?? '—'))] })],
  });
}
function _repDocTable(docx, headers, rows, colWidths) {
  const { Table, TableRow, WidthType } = docx;
  const tableWidth = colWidths.reduce((a,b)=>a+b,0);
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      // tableHeader: true marks this as a real header row for assistive
      // tech (screen readers announce "column header" navigating the
      // table) as well as repeating it on each printed page — not just
      // bold/coloured text that looks like a header. This was missing
      // from every existing report before this fix (Session 60,
      // 11/08/26) — applies retroactively to all five report types,
      // not just the one that surfaced it.
      new TableRow({ tableHeader: true, children: headers.map((h,i) => _repDocHeaderCell(docx, h, colWidths[i])) }),
      ...rows.map(r => new TableRow({ children: r.map((c,i) => _repDocCell(docx, c, colWidths[i])) })),
    ],
  });
}
function _repDocBullets(docx, items) {
  const { Paragraph, TextRun, LevelFormat } = docx;
  return items.map(text => new Paragraph({
    numbering: { reference: 'rep-bullets', level: 0 },
    children: [new TextRun(String(text))],
  }));
}
function _repDocNumberingConfig(docx) {
  const { LevelFormat, AlignmentType } = docx;
  return {
    config: [{
      reference: 'rep-bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  };
}
function _repDocSectionHeading(docx, text) {
  const { Paragraph, TextRun, HeadingLevel } = docx;
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, children: [new TextRun(text)] });
}
function _repDocPara(docx, text, opts={}) {
  const { Paragraph, TextRun } = docx;
  return new Paragraph({ spacing: opts.spacing || {}, children: [new TextRun({ text: String(text), italics: !!opts.italics })] });
}
function _repDocTitle(docx, text) {
  const { Paragraph, TextRun, HeadingLevel } = docx;
  return new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(text)] });
}

function _repDownloadDoc(docx, doc, filename) {
  const { Packer } = docx;
  Packer.toBlob(doc).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ── GENERATE ───────────────────────────────────────────────────
async function _repGenerate() {
  const status = document.getElementById('rep-status');
  const showStatus = (msg, kind) => {
    if (!status) return;
    status.style.display = '';
    status.textContent = msg;
    status.style.color = kind === 'error' ? 'var(--color-red)' : (kind === 'success' ? 'var(--color-green)' : 'var(--color-muted)');
  };

  if (typeof window.docx === 'undefined') {
    showStatus('lib/docx.min.js has not loaded. Check the script tag in hub.html.', 'error');
    return;
  }
  const docx = window.docx;
  const opts = _repGatherOptions();
  const type = _repCurrentType;
  if (!type) { showStatus('Select a report type first.', 'error'); return; }

  showStatus('Building document…', null);

  try {
    if (type === REPORT_TYPES.NEIL_FORTNIGHTLY) {
      _repBuildNeilDoc(docx, _repCollegeData(opts), opts);
    } else if (type === REPORT_TYPES.DIGITAL_LEAD) {
      if (!opts.areaCode) { showStatus('Select an area first.', 'error'); return; }
      _repBuildDLDoc(docx, _repAreaData(opts.areaCode, opts), opts);
    } else if (type === REPORT_TYPES.AP_HOA_AREA) {
      if (!opts.areaCode) { showStatus('Select an area first.', 'error'); return; }
      _repBuildAPHoADoc(docx, _repAreaData(opts.areaCode, opts), opts);
    } else if (type === REPORT_TYPES.BEN_MONTHLY) {
      _repBuildBenDoc(docx, _repCollegeData(opts), opts);
    } else if (type === REPORT_TYPES.PERFORMANCE_REVIEW) {
      await _repBuildPerformanceReviewDoc(docx, opts);
    } else if (type === REPORT_TYPES.COLLEGE_ACTION_PLAN) {
      _repBuildCollegeActionPlanDoc(docx);
    }
    showStatus('✓ Document generated and downloaded.', 'success');
  } catch (e) {
    console.error(e);
    showStatus(`Error generating document: ${e.message}`, 'error');
  }
}

function _repBuildNeilDoc(docx, data, opts) {
  const { Document, Packer, convertInchesToTwip } = docx;
  const colW = [1400, 5000, 2400, 1800];
  const rows = data.areas.map(a => {
    const dims = a.ragDimensions || {};
    const scores = RAG_DIMENSIONS.map(d => dims[d.id]?.score).filter(Boolean);
    const overall = scores.length ? Math.round(scores.reduce((x,y)=>x+y,0)/scores.length) : null;
    return [a.areaCode, a.areaName, overall ? `${overall} · ${_repRagLabel(overall)}` : '—', String(data.openAFIsByArea[a.areaCode]||0)];
  });

  const children = [
    _repDocTitle(docx, 'DPC Hub — Update for Neil Davies'),
    _repDocPara(docx, `Period: ${_repFmtDate(opts.dateFrom)} – ${_repFmtDate(opts.dateTo)} · Prepared: ${_repFmtDate(nowISO())}`, { italics: true, spacing:{after:200} }),
  ];
  if (opts.highlights) { children.push(_repDocSectionHeading(docx,'Summary')); children.push(_repDocPara(docx, opts.highlights)); }
  children.push(_repDocSectionHeading(docx, `Activity this period (${data.calEntries.length} entries logged)`));
  children.push(_repDocPara(docx, data.calEntries.length ? `${data.calEntries.length} calendar entries across ${data.totalAreas} curriculum areas.` : 'No calendar entries logged in this period.'));
  if (data.movers.length) {
    children.push(_repDocSectionHeading(docx, `RAG movements (${data.movers.length})`));
    children.push(..._repDocBullets(docx, data.movers.map(m => `${m.areaCode} — ${m.dimension}: ${_repRagLabel(m.prev)} → ${_repRagLabel(m.curr)} (${_repFmtDate(m.date)})`)));
  }
  if (opts.blockers) { children.push(_repDocSectionHeading(docx,'Blockers / support needed')); children.push(_repDocPara(docx, opts.blockers)); }
  if (opts.comingUp) { children.push(_repDocSectionHeading(docx,'Coming up')); children.push(_repDocPara(docx, opts.comingUp)); }
  children.push(_repDocSectionHeading(docx, `Resources shared (${data.resourceShares.length})`));
  children.push(_repDocPara(docx, data.resourceShares.length
    ? `${data.resourceShares.length} resource share(s) recorded across ${Object.keys(data.resourceSharesByArea).length} area(s) this period.`
    : 'No resources shared this period.'));
  children.push(_repDocSectionHeading(docx, 'RAG snapshot — all areas'));
  children.push(_repDocTable(docx, ['Code','Area','Overall RAG','Open loops'], rows, colW));

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `neil-fortnightly-${todayISO()}.docx`);
}

function _repBuildDLDoc(docx, data, opts) {
  const { Document } = docx;
  const colW = [4400, 3200];
  const dimRows = data.ragRows.map(d => [d.label, d.score ? `${d.score} · ${_repRagLabel(d.score)}` : '—']);
  const focusText = opts.dlFocus || (data.openAFIs.length
    ? `${data.openAFIs.length} open loop(s): ${data.openAFIs.slice(0,5).map(a=>a.lraThemeLabel||a.lraThemeId).join('; ')}`
    : 'No open loops currently logged.');

  const children = [
    _repDocTitle(docx, `Digital Lead Report — ${data.area.areaCode}: ${data.area.areaName}`),
    _repDocPara(docx, `HoA: ${data.area.hoaName||'—'} · Digital Lead: ${data.area.dlName||'—'} · Prepared: ${_repFmtDate(nowISO())}`, { italics: true, spacing:{after:200} }),
    _repDocSectionHeading(docx, 'Current focus'),
    _repDocPara(docx, focusText),
    _repDocSectionHeading(docx, 'RAG summary — 8 dimensions'),
    _repDocTable(docx, ['Dimension','Score'], dimRows, colW),
    _repDocSectionHeading(docx, `Open loops (${data.openAFIs.length})`),
  ];
  if (data.openAFIs.length) {
    children.push(..._repDocBullets(docx, data.openAFIs.map(a => `${a.lraThemeLabel||a.lraThemeId} — ${a.severity}`)));
  } else {
    children.push(_repDocPara(docx, 'No open loops.'));
  }
  children.push(_repDocSectionHeading(docx, `Closed this period (${data.closedAFIs.length})`));
  children.push(_repDocPara(docx, data.closedAFIs.length ? `${data.closedAFIs.length} loop(s) closed.` : 'None closed this period.'));
  children.push(_repDocSectionHeading(docx, `Staff CPD delivered (${data.cpdEntries.length})`));
  children.push(data.cpdEntries.length
    ? _repDocTable(docx, ['Staff','Course','Date'], data.cpdEntries.map(c => [c.staffName||'—', c.course||'—', _repFmtDate(c.date)]), [2800,3600,1200])
    : _repDocPara(docx,'No CPD recorded this period.'));
  children.push(_repDocSectionHeading(docx, `Resources shared (${data.resourceShares.length})`));
  children.push(data.resourceShares.length
    ? _repDocTable(docx, ['Resource','Staff','Date'],
        data.resourceShares.map(s => [s.resourceTitle||'—', typeof _libStaffNames === 'function' ? _libStaffNames(s.staffIds) : `${(s.staffIds||[]).length} staff`, _repFmtDate(s.date)]),
        [3200,2600,1800])
    : _repDocPara(docx,'No resources shared this period.'));

  const doc = new (docx.Document)({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children: children.flat() }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `digital-lead-${data.area.areaCode}-${todayISO()}.docx`);
}

function _repBuildAPHoADoc(docx, data, opts) {
  const colW = [4400, 3200];
  const dimRows = data.ragRows.map(d => [d.label, d.score ? `${d.score} · ${_repRagLabel(d.score)}` : '—']);

  const children = [
    _repDocTitle(docx, `AP / HoA Area Report — ${data.area.areaCode}: ${data.area.areaName}`),
    _repDocPara(docx, `HoA: ${data.area.hoaName||'—'} · Prepared: ${_repFmtDate(nowISO())}`, { italics: true, spacing:{after:200} }),
    _repDocSectionHeading(docx, 'RAG by dimension'),
    _repDocTable(docx, ['Dimension','Score'], dimRows, colW),
    _repDocSectionHeading(docx, 'Loop activity'),
    _repDocPara(docx, `${data.openAFIs.length} open, ${data.closedAFIs.length} closed this period.`),
    _repDocSectionHeading(docx, 'Staff CPD this period'),
  ];
  children.push(data.cpdEntries.length
    ? _repDocTable(docx, ['Staff','Course','Date'], data.cpdEntries.map(c => [c.staffName||'—', c.course||'—', _repFmtDate(c.date)]), [2800,3600,1200])
    : _repDocPara(docx,'No CPD recorded this period.'));
  children.push(_repDocSectionHeading(docx, `Resources shared with staff (${data.resourceShares.length})`));
  children.push(data.resourceShares.length
    ? _repDocTable(docx, ['Resource','Staff','Date','Context'],
        data.resourceShares.map(s => [s.resourceTitle||'—', typeof _libStaffNames === 'function' ? _libStaffNames(s.staffIds) : `${(s.staffIds||[]).length} staff`, _repFmtDate(s.date), s.contextNotes||'—']),
        [2400,1800,1200,2400])
    : _repDocPara(docx,'No resources shared this period.'));
  if (opts.obsFocus) {
    children.push(_repDocSectionHeading(docx, 'Suggested observation focus'));
    children.push(_repDocPara(docx, opts.obsFocus));
  }

  const doc = new (docx.Document)({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children: children.flat() }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `ap-hoa-${data.area.areaCode}-${todayISO()}.docx`);
}

// ── College Action Plan Overview (Session 66, 11/08/26) ─────────
// Real feedback: "I'd like to be able to download the action plan.
// There's no overview action plan that I can download to send as a
// whole organization view... where there is commonality, I need to
// be able to say these are the things flagged... lots of places need
// work on accessibility, or alt text, here's what I'm doing about
// those things. It needs to give an overview of the whole college."
//
// Deliberately NOT run through a Claude conversation like the other
// AI Support features — every action item already carries a
// sourceDomain tag (from Health Check generation, RAG follow-ups,
// etc.), so grouping by real, existing data is both more reliable
// and genuinely free. Themes are sorted by how many distinct areas
// they touch, so the most common threads across the college surface
// first — directly answering "what are you doing about it" at
// exactly the level Ben/Neil would ask the question.
function _repGatherCollegeActionItems(areaCodeFilter = null, themeFilter = null) {
  const plans = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || []).filter(p => p.status !== 'complete');
  const areas = _repGetAreas();
  const areaName = (code) => areas.find(a => a.areaCode === code)?.areaName || code;

  const byTheme = {};
  plans.forEach(plan => {
    if (areaCodeFilter && !areaCodeFilter.includes(plan.areaCode)) return;
    (plan.actionItems || []).filter(i => !i.done).forEach(item => {
      const theme = item.sourceDomain || 'Ungrouped';
      if (themeFilter && !themeFilter.includes(theme)) return;
      if (!byTheme[theme]) byTheme[theme] = { theme, items: [], areaCodes: new Set() };
      byTheme[theme].items.push({ description: item.description, areaCode: plan.areaCode, areaName: areaName(plan.areaCode), accountableName: item.accountableName || '' });
      byTheme[theme].areaCodes.add(plan.areaCode);
    });
  });

  return Object.values(byTheme)
    .map(t => ({ theme: t.theme, items: t.items, areaCount: t.areaCodes.size, areaCodes: Array.from(t.areaCodes) }))
    .sort((a, b) => b.areaCount - a.areaCount);
}

// Reads the current checkbox state from the options panel — null means
// "not currently rendered" (e.g. called from Dashboard's preview before
// the panel exists), which _repGatherCollegeActionItems treats as "no
// filter, include everything," matching the pre-selection default.
function _repGetCollegeActionPlanFilters() {
  const areaCbs = document.querySelectorAll('.rep-college-area-cb');
  const themeCbs = document.querySelectorAll('.rep-college-theme-cb');
  const areaCodeFilter = areaCbs.length ? Array.from(areaCbs).filter(cb => cb.checked).map(cb => cb.value) : null;
  const themeFilter = themeCbs.length ? Array.from(themeCbs).filter(cb => cb.checked).map(cb => cb.value) : null;
  return { areaCodeFilter, themeFilter };
}

function _repPreviewCollegeActionPlan() {
  const { areaCodeFilter, themeFilter } = _repGetCollegeActionPlanFilters();
  const themes = _repGatherCollegeActionItems(areaCodeFilter, themeFilter);
  if (themes.length === 0) return '<p style="color:var(--color-muted)">No open action items match the current selection.</p>';
  return themes.map(t => `
    <div style="margin-bottom:var(--space-md);">
      <p style="font-weight:bold;color:var(--color-navy);">${_repEsc(t.theme)} — ${t.areaCount} area(s), ${t.items.length} item(s)</p>
      <p style="font-size:var(--text-xs);color:var(--color-muted);">${t.areaCodes.map(_repEsc).join(', ')}</p>
    </div>`).join('');
}

function _repBuildCollegeActionPlanDoc(docx) {
  const { areaCodeFilter, themeFilter } = _repGetCollegeActionPlanFilters();
  const themes = _repGatherCollegeActionItems(areaCodeFilter, themeFilter);
  const totalItems = themes.reduce((s, t) => s + t.items.length, 0);
  const totalAreas = new Set(themes.flatMap(t => t.areaCodes)).size;
  const isFiltered = (areaCodeFilter && areaCodeFilter.length < _repGetAreas().length) || (themeFilter && themeFilter.length < _repGatherCollegeActionItems().length);

  const children = [
    _repDocTitle(docx, 'College Action Plan Overview'),
    _repDocPara(docx, `Prepared: ${_repFmtDate(nowISO())} · ${totalItems} open action item(s) across ${totalAreas} area(s), grouped by theme${isFiltered ? ' · Filtered selection, not the full college' : ''}`, { italics: true, spacing:{after:200} }),
  ];

  if (themes.length === 0) {
    children.push(_repDocPara(docx, 'No open action items across any area at the time this was generated.'));
  }

  themes.forEach(t => {
    children.push(_repDocSectionHeading(docx, `${t.theme} — ${t.areaCount} area(s)`));
    children.push(_repDocPara(docx, `Affects: ${t.areaCodes.join(', ')}`, { italics: true, spacing:{after:100} }));
    children.push(_repDocTable(docx, ['Area', 'Action', 'Accountable'],
      t.items.map(i => [i.areaName, i.description, i.accountableName || '—']),
      [2000, 5200, 1800]));
  });

  const doc = new (docx.Document)({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `college-action-plan-overview-${todayISO()}.docx`);
}

function _repBuildBenDoc(docx, data, opts) {
  const total = Object.values(data.ragDistribution).reduce((a,b)=>a+b,0);
  const distRows = [5,4,3,2,1,'unscored'].map(n => {
    const count = data.ragDistribution[n] || 0;
    const pct = total ? Math.round(count/total*100) : 0;
    return [n === 'unscored' ? 'Not yet scored' : `${n} · ${_repRagLabel(n)}`, String(count), `${pct}%`];
  });
  const moverRows = data.movers.map(m => [m.areaCode, m.dimension, _repRagLabel(m.prev), _repRagLabel(m.curr), _repFmtDate(m.date)]);

  const children = [
    _repDocTitle(docx, 'Monthly Overview — Ben Manning'),
    _repDocPara(docx, `Period: ${_repFmtDate(opts.dateFrom)} – ${_repFmtDate(opts.dateTo)} · Prepared: ${_repFmtDate(nowISO())}`, { italics: true, spacing:{after:200} }),
  ];
  if (opts.headline) { children.push(_repDocSectionHeading(docx,'Strategic headline')); children.push(_repDocPara(docx, opts.headline)); }
  children.push(_repDocSectionHeading(docx, 'College-wide RAG distribution'));
  children.push(_repDocTable(docx, ['RAG level','Areas','%'], distRows, [3200,2200,2200]));
  children.push(_repDocPara(docx, `Total areas tracked: ${total}`, {spacing:{before:100}}));
  children.push(_repDocSectionHeading(docx, `RAG movements (${data.movers.length})`));
  children.push(moverRows.length
    ? _repDocTable(docx, ['Code','Dimension','Previous','Current','Date'], moverRows, [1200,2600,1800,1800,1200])
    : _repDocPara(docx, 'No dimension movements recorded this period.'));
  children.push(_repDocSectionHeading(docx, `Resources shared (${data.resourceShares.length})`));
  children.push(_repDocPara(docx, data.resourceShares.length
    ? `${data.resourceShares.length} resource share(s) recorded across ${Object.keys(data.resourceSharesByArea).length} area(s) this period.`
    : 'No resources shared this period.'));
  if (opts.risks) { children.push(_repDocSectionHeading(docx,'Risks / escalations')); children.push(_repDocPara(docx, opts.risks)); }

  const doc = new (docx.Document)({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children }],
    numbering: _repDocNumberingConfig(docx),
  });
  _repDownloadDoc(docx, doc, `ben-manning-monthly-${todayISO()}.docx`);
}

// ── PERFORMANCE REVIEW — proxy-data version, narrative pasted in ────
// Session 65 (11/08/26): removed the live Anthropic API call
// entirely, per "we don't have any AI API call paths at all... we
// just use it through this process [Import]." The prompt is still
// built from real live Hub data (unchanged) -- only the destination
// changed, from a direct API call to a "copy this, paste the result
// back" round-trip through whatever Claude conversation/Project the
// DPC is using, same as every other AI Support feature now.
function _repBuildNarrativePrompt(opts) {
  const areas = _repGetAreas();
  const afis  = _repGetAFIs();
  const reflections = _repGetReflections().filter(r => _repInWindow(r.date || r.createdAt, opts.dateFrom, opts.dateTo));
  const closedAFIs = afis.filter(a => a.status === AFI_STATUS.CLOSED);
  const closureRate = afis.length ? Math.round((closedAFIs.length / afis.length) * 100) : 0;
  const historyPoints = [];
  areas.forEach(a => {
    const dims = a.ragDimensions || {};
    RAG_DIMENSIONS.forEach(d => {
      (dims[d.id]?.history || []).forEach(h => historyPoints.push({ areaCode: a.areaCode, dimension: d.label, score: h.score, date: h.date }));
    });
  });
  const pyramidCounts = { foundations: 0, inclusion: 0, innovation: 0 };
  areas.forEach(a => { const p = a.pyramidLevel || 'foundations'; if (pyramidCounts[p] !== undefined) pyramidCounts[p]++; });

  return `You are helping a Digital Pedagogy Coach at an FE college write the narrative
section of their own performance review, covering a pilot programme.

Write in plain, honest, evidence-based British English. No overclaiming. Use FE sector terms
naturally (HoA, TLA, CPD, AFI, RAG) but do not lecture the reader on what they mean.
Structure with clear paragraphs, no headers needed — this text will be inserted under a
"Narrative Summary" heading that already exists in the document.

Evidence to synthesise:
- ${areas.length} curriculum areas engaged
- ${afis.length} total AFIs/loops logged, ${closedAFIs.length} closed (${closureRate}% closure rate)
- ${reflections.length} staff reflections received in the reporting period
- Pyramid level distribution across areas: Foundations ${pyramidCounts.foundations}, Inclusion ${pyramidCounts.inclusion}, Innovation ${pyramidCounts.innovation}
- ${historyPoints.length} RAG snapshot data points recorded across all dimensions
${opts.prContext ? `\nAdditional context from the DPC: ${opts.prContext}` : ''}

Write 3-4 paragraphs. Distinguish activity from impact — what happened versus what changed
as a result. Be precise about what the evidence does and doesn't show.

Respond with only the narrative paragraphs, no preamble, no headers, no markdown.`;
}

async function _repBuildPerformanceReviewDoc(docx, opts) {
  const areas = _repGetAreas();
  const afis  = _repGetAFIs();
  const reflections = _repGetReflections().filter(r => _repInWindow(r.date || r.createdAt, opts.dateFrom, opts.dateTo));

  const closedAFIs = afis.filter(a => a.status === AFI_STATUS.CLOSED);
  const closureRate = afis.length ? Math.round((closedAFIs.length / afis.length) * 100) : 0;

  const pyramidCounts = { foundations: 0, inclusion: 0, innovation: 0 };
  areas.forEach(a => { const p = a.pyramidLevel || 'foundations'; if (pyramidCounts[p] !== undefined) pyramidCounts[p]++; });

  // Session 65 bug: this was dropped when the narrative-prompt logic
  // moved into its own function, but historyPoints is also used
  // separately below for the RAG Snapshot History section — a real
  // test (not just a read-through) caught the ReferenceError this
  // caused before it ever reached a live document.
  const historyPoints = [];
  areas.forEach(a => {
    const dims = a.ragDimensions || {};
    RAG_DIMENSIONS.forEach(d => {
      (dims[d.id]?.history || []).forEach(h => historyPoints.push({ areaCode: a.areaCode, dimension: d.label, score: h.score, date: h.date }));
    });
  });

  const closureCol = [3600, 2200, 2200];
  const children = [
    _repDocTitle(docx, 'Performance Review — Full Pilot Evidence'),
    _repDocPara(docx, `Period: ${_repFmtDate(opts.dateFrom)} – ${_repFmtDate(opts.dateTo)} · Prepared: ${_repFmtDate(nowISO())}`, { italics: true, spacing:{after:200} }),
    _repDocSectionHeading(docx, 'Narrative Summary'),
  ];

  if (opts.prNarrative && opts.prNarrative.trim()) {
    opts.prNarrative.trim().split('\n\n').filter(Boolean).forEach(para => children.push(_repDocPara(docx, para, {spacing:{after:120}})));
  } else {
    children.push(_repDocPara(docx, `No narrative was pasted in before generating this document. Use "Copy narrative prompt," get a response from a Claude conversation, paste it into the box, then generate again.`, { italics: true }));
  }

  children.push(_repDocSectionHeading(docx, 'AFI Closure Rate'));
  children.push(_repDocTable(docx, ['Metric','Value','—'], [
    ['Total AFIs/loops logged', String(afis.length), ''],
    ['Closed', String(closedAFIs.length), ''],
    ['Closure rate', `${closureRate}%`, ''],
  ], closureCol));

  children.push(_repDocSectionHeading(docx, 'Staff Reflections'));
  children.push(_repDocPara(docx, `${reflections.length} reflection(s) received in this period.`));

  children.push(_repDocSectionHeading(docx, 'Pyramid Level Activity Breakdown'));
  children.push(_repDocPara(docx, `Note: area-level pyramid tagging used as a proxy pending activity-level pyramid tagging (not yet built).`, {italics:true}));
  children.push(_repDocTable(docx, ['Level','Areas'], [
    ['Foundations', String(pyramidCounts.foundations)],
    ['Inclusion', String(pyramidCounts.inclusion)],
    ['Innovation', String(pyramidCounts.innovation)],
  ], [4400,3200]));

  children.push(_repDocSectionHeading(docx, 'RAG Snapshot History'));
  children.push(_repDocPara(docx, `${historyPoints.length} snapshot data point(s) recorded across all areas and dimensions in this period.`));

  const doc = new (docx.Document)({
    sections: [{ properties: { page: { margin: { top:1440,bottom:1440,left:1440,right:1440 } } }, children }],
  });
  _repDownloadDoc(docx, doc, `performance-review-${todayISO()}.docx`);
}
