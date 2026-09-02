// DPC Hub · js/healthcheck.js · v2.1 · 01/09/26 · Session 63
// v2.1: shareable per-staff Word report (see "Shareable Word report" at
// the foot of this file), plus history items rebuilt as real buttons.
// Digital Health Check module — REBUILT to match the real instrument.
//
// The v1.0 module (area-level, 5 broad AI-extracted dimensions, written to
// area.healthChecks[]) was built against the wrong shape. The real,
// currently-in-use instrument is staff-level, observes one named person
// per review, scores specific indicator statements (not broad dimensions)
// across 5 focus areas, and tracks an action point with an escalation
// level per area. See HC_FOCUS_AREAS in schema.js for the indicator set,
// faithfully reproduced from the real Microsoft Form.
//
// A review can cover 1-5 focus areas in one sitting, matching the Form's
// own "select an area to review, then choose another or submit" flow.
// Records are cycle-tagged (HC_CYCLES) — baseline / Nov / Feb-Mar / Jun —
// so rounds stay comparable but distinct.
//
// Data lives in data-health-checks.json (a flat, central list — same
// denormalised pattern as AFIs and Resource Library shares — not nested
// under area or staff, so it can be queried by staff, by area, or by
// cycle equally easily). area.healthChecks[] (the old v1.0 field) is left
// untouched, not deleted, but nothing writes to it going forward.
//
// The "Support Priority Score" concept (weighting a lower practice score
// more heavily, used in Graeme's existing manual analysis) is implemented
// here as a documented, adjustable formula — NOT reverse-engineered with
// full confidence from the baseline spreadsheet. Treat _hcPriorityScore()
// as a first draft to confirm against known values, not ground truth.

// ── Delta colour classification (Session 47) ──────────────────────
// Thresholds are a judgement call, documented so they're adjustable:
// under 0.15 reads as noise/no real change on a 1-5 scale; 0.15-0.6 is a
// genuine but modest shift; 0.6-1.2 is a clear shift; 1.2+ is dramatic.
// See css/design.css for the actual verified-WCAG colour values.
function _hcDeltaClass(delta) {
  const abs = Math.abs(delta);
  if (abs < 0.15) return 'hc-delta-neutral';
  const magnitude = abs < 0.6 ? 'light' : abs < 1.2 ? 'medium' : 'strong';
  return delta > 0 ? `hc-delta-improve-${magnitude}` : `hc-delta-decline-${magnitude}`;
}

let _hcDraftReview = null; // in-progress review, not yet saved
let _hcSelectedStaffId = null;

function initHealthChecks() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);flex-wrap:wrap;gap:var(--space-sm);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Digital Health Checks</h1>
      <div style="display:flex;gap:var(--space-sm);">
        <button id="hc-import-btn" type="button" class="btn btn--ghost btn--sm">Import baseline data (2026)</button>
        <button id="hc-bulk-generate-btn" type="button" class="btn btn--secondary btn--sm">Generate all Action Plans</button>
      </div>
    </div>
    <p id="hc-bulk-generate-status" style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;"></p>
    <p style="font-size:var(--text-base);color:var(--color-muted);margin-bottom:var(--space-xl);">Accessibility and Inclusion Practice Review — staff-level observation across five focus areas.</p>

    <div id="hc-import-panel" style="display:none;margin-bottom:var(--space-2xl);"></div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:var(--space-xl);align-items:start;">
      <div>
        <div class="form-group">
          <label class="form-label" for="hc-area-sel">Area</label>
          <select class="form-select" id="hc-area-sel" aria-label="Select area">
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="hc-staff-sel">Staff member</label>
          <select class="form-select" id="hc-staff-sel" aria-label="Select staff member" disabled>
            <option value="">— Select area first —</option>
          </select>
        </div>
        <button id="hc-new-review-btn" type="button" class="btn btn--primary btn--sm" style="width:100%;margin-bottom:var(--space-lg);" disabled>+ New review</button>
        <div id="hc-staff-history"></div>
      </div>

      <div id="hc-main-panel">
        <div id="hc-placeholder" style="padding:var(--space-2xl);text-align:center;color:var(--color-muted);">
          <p style="font-size:48px;margin-bottom:var(--space-md);">📋</p>
          <p style="font-size:var(--text-base);">Select an area and staff member to start or review a Digital Health Check.</p>
        </div>
        <div id="hc-review-form" style="display:none;"></div>
      </div>
    </div>
  `;

  _hcPopulateAreaSelector();
  _wireHCEvents();
}

// ── Selectors ─────────────────────────────────────────────────
function _hcPopulateAreaSelector() {
  const sel = document.getElementById('hc-area-sel');
  if (!sel) return;
  (_getAreas() || []).sort((a, b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

function _hcPopulateStaffSelector(areaCode) {
  const sel = document.getElementById('hc-staff-sel');
  const newBtn = document.getElementById('hc-new-review-btn');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select staff member —</option>';
  sel.disabled = !areaCode;
  newBtn.disabled = true;
  if (!areaCode) return;

  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  allStaff.filter(s => s.areaCode === areaCode).sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.staffId;
    opt.textContent = s.name + (s.role ? ` (${s.role})` : '');
    sel.appendChild(opt);
  });
}

// ── Staff review history (left panel) ────────────────────────────
function _hcRenderStaffHistory(staffId) {
  const container = document.getElementById('hc-staff-history');
  const newBtn = document.getElementById('hc-new-review-btn');
  if (!container) return;
  newBtn.disabled = !staffId;
  if (!staffId) { container.innerHTML = ''; return; }

  const reviews = _hcGetReviewsForStaff(staffId).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (reviews.length === 0) {
    container.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-muted);">No Health Checks recorded yet.</p>';
    return;
  }
  const staffName = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff || []).find(s => s.staffId === staffId)?.name || 'this staff member';

  container.innerHTML = `
    <h3 style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Previous reviews</h3>
    ${reviews.map(r => {
      const label = `${_hcFmtDate(r.date)}, ${_hcCycleLabel(r.cycleId)} cycle`;
      return `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-xs);">
        <button type="button" class="hc-history-item" data-review-id="${r.reviewId}" style="display:block;width:100%;text-align:left;padding:var(--space-sm);background:none;border:0;cursor:pointer;font:inherit;">
          <span style="display:block;font-size:var(--text-xs);font-weight:bold;color:var(--color-slate);">${_hcFmtDate(r.date)} · ${_hcCycleLabel(r.cycleId)}</span>
          <span style="display:block;font-size:10px;color:var(--color-muted);">${Object.keys(r.domains || {}).length} area(s) · Priority ${r.supportPriorityScore != null ? r.supportPriorityScore.toFixed(1) : '—'}</span>
        </button>
        <div style="padding:0 var(--space-sm) var(--space-sm);">
          <button type="button" class="hc-history-download btn btn--ghost btn--sm" data-review-id="${r.reviewId}" style="width:100%;font-size:10px;">Download report (Word)<span class="sr-only"> for ${_hcEsc(staffName)}, ${_hcEsc(label)}</span></button>
        </div>
      </div>`;
    }).join('')}
  `;
  container.querySelectorAll('.hc-history-item').forEach(el => {
    el.addEventListener('click', () => _hcOpenReview(el.dataset.reviewId));
  });
  container.querySelectorAll('.hc-history-download').forEach(el => {
    el.addEventListener('click', () => _hcDownloadReportWord(el.dataset.reviewId));
  });
}

// ── New review ────────────────────────────────────────────────
function _hcStartNewReview() {
  const areaCode = document.getElementById('hc-area-sel').value;
  const staffId  = document.getElementById('hc-staff-sel').value;
  if (!areaCode || !staffId) return;

  _hcDraftReview = {
    reviewId: generateId(),
    cycleId: HC_CYCLES.BASELINE, // default selection; changeable in the form
    date: todayISO(),
    areaCode,
    staffId,
    assessorName: '',
    provision: '',
    levelOfLearning: '',
    domains: {},
    overallReflection: '', keyStrengths: '', areasForImprovement: '', priorityNextSteps: '',
  };
  _hcRenderReviewForm();
}

function _hcOpenReview(reviewId) {
  const review = _hcGetReview(reviewId);
  if (!review) return;
  _hcDraftReview = JSON.parse(JSON.stringify(review)); // work on a copy
  _hcRenderReviewForm();
}

// ── Review form ───────────────────────────────────────────────
function _hcRenderReviewForm() {
  document.getElementById('hc-placeholder').style.display = 'none';
  const form = document.getElementById('hc-review-form');
  form.style.display = 'block';
  const r = _hcDraftReview;
  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff || []).find(s => s.staffId === r.staffId);
  const area = _getArea(r.areaCode);

  const doneDomainIds = Object.keys(r.domains || {});
  // Only offer the download once the review actually exists in the data —
  // exporting an unsaved draft would produce a document with no record
  // behind it, and no action plan to resolve against.
  const isSaved = !!_hcGetReview(r.reviewId);

  form.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
      <div>
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">${_hcEsc(staff ? staff.name : '')} — ${_hcEsc(area ? area.areaName : r.areaCode)}</h2>
        <p style="font-size:var(--text-xs);color:var(--color-muted);">${doneDomainIds.length} of 5 focus areas completed this review</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <div class="form-group">
        <label class="form-label" for="hc-cycle">Cycle</label>
        <select class="form-select" id="hc-cycle">
          <option value="${HC_CYCLES.BASELINE}" ${r.cycleId === HC_CYCLES.BASELINE ? 'selected' : ''}>Baseline (2026)</option>
          <option value="${HC_CYCLES.NOVEMBER}" ${r.cycleId === HC_CYCLES.NOVEMBER ? 'selected' : ''}>November 2026</option>
          <option value="${HC_CYCLES.FEB_MARCH}" ${r.cycleId === HC_CYCLES.FEB_MARCH ? 'selected' : ''}>Feb/March 2027</option>
          <option value="${HC_CYCLES.JUNE}" ${r.cycleId === HC_CYCLES.JUNE ? 'selected' : ''}>June 2027</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="hc-date">Date of review</label>
        <input class="form-input" type="date" id="hc-date" value="${r.date}">
      </div>
      <div class="form-group">
        <label class="form-label" for="hc-assessor">Name of Assessor</label>
        <input class="form-input" type="text" id="hc-assessor" value="${_hcEsc(r.assessorName)}" placeholder="Often the Digital Lead, not always">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <div class="form-group">
        <label class="form-label form-label--optional" for="hc-provision">Provision</label>
        <select class="form-select" id="hc-provision">
          <option value="">—</option>
          ${['Further Education','Higher Education','Apprentices','Work-based Learning','Community Education','SEND / FIP','Skills Bootcamp','Other'].map(p => `<option value="${p}" ${r.provision===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="hc-level">Level of learning</label>
        <select class="form-select" id="hc-level">
          <option value="">—</option>
          ${['Entry Level','Level 1','Level 2','Level 3','Level 4','Level 5','Level 6','Level 7','Level 8+','SEND / Non-Quals','Other'].map(l => `<option value="${l}" ${r.levelOfLearning===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>

    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-sm);">Focus areas</h3>
    <div id="hc-domain-sections">
      ${HC_FOCUS_AREAS.map(fa => _hcRenderDomainSection(fa, r.domains[fa.id])).join('')}
    </div>

    <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin:var(--space-xl) 0 var(--space-sm);">Complete and submit review</h3>
    <div class="form-group">
      <label class="form-label form-label--optional" for="hc-overall-reflection">Overall observed reflection</label>
      <textarea class="form-textarea" id="hc-overall-reflection" rows="2">${_hcEsc(r.overallReflection)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label form-label--optional" for="hc-key-strengths">Key strengths observed</label>
      <textarea class="form-textarea" id="hc-key-strengths" rows="2">${_hcEsc(r.keyStrengths)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label form-label--optional" for="hc-afis">Areas for Improvement (AFIs)</label>
      <textarea class="form-textarea" id="hc-afis" rows="2">${_hcEsc(r.areasForImprovement)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label form-label--optional" for="hc-priority-next">Priority next steps and recommendations</label>
      <textarea class="form-textarea" id="hc-priority-next" rows="2">${_hcEsc(r.priorityNextSteps)}</textarea>
    </div>

    <p id="hc-save-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>
    <div class="btn-row">
      <button id="hc-save-btn" type="button" class="btn btn--primary">Save review</button>
      ${isSaved ? `<button id="hc-download-btn" type="button" class="btn btn--ghost" data-review-id="${r.reviewId}">Download report (Word)</button>` : ''}
    </div>
    ${isSaved ? '<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:var(--space-xs);">Includes the action plan — shareable with the Digital Lead. Save first if you have just made changes.</p>' : ''}
  `;

  _hcWireDomainSections();
  document.getElementById('hc-save-btn')?.addEventListener('click', _hcSaveReview);
  document.getElementById('hc-download-btn')?.addEventListener('click', e => _hcDownloadReportWord(e.currentTarget.dataset.reviewId));
}

function _hcRenderDomainSection(focusArea, existing) {
  const d = existing || {};
  const scores = d.indicatorScores || {};
  return `
    <details class="hc-domain-section" data-domain-id="${focusArea.id}" ${existing ? 'open' : ''} style="border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-md);">
      <summary style="cursor:pointer;padding:var(--space-md);font-weight:bold;color:var(--color-navy);display:flex;align-items:center;justify-content:space-between;">
        <span>${_hcEsc(focusArea.label)}</span>
        ${existing ? `<span style="font-size:var(--text-xs);font-weight:normal;color:var(--color-teal);">Avg ${d.avgScore != null ? d.avgScore.toFixed(1) : '—'}</span>` : '<span style="font-size:var(--text-xs);font-weight:normal;color:var(--color-muted);">Not yet reviewed</span>'}
      </summary>
      <div style="padding:0 var(--space-md) var(--space-md);">
        <div class="form-group">
          <label class="form-label form-label--optional" for="hc-context-${focusArea.id}">Context for this area</label>
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">Previous actions, historical context, technical issues, constraints, or relevant background.</p>
          <textarea class="form-textarea" id="hc-context-${focusArea.id}" rows="2">${_hcEsc(d.context || '')}</textarea>
        </div>

        ${focusArea.indicators.map(ind => `
          <div class="form-group">
            <span class="form-label" id="hc-ind-label-${ind.id}">${_hcEsc(ind.label)}</span>
            <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">${_hcEsc(ind.desc)}</p>
            <div role="group" aria-labelledby="hc-ind-label-${ind.id}" class="hc-score-group" data-indicator-id="${ind.id}" style="display:flex;gap:6px;flex-wrap:wrap;">
              ${[1,2,3,4,5].map(n => `<button type="button" class="btn btn--ghost btn--sm hc-score-btn" data-value="${n}" aria-pressed="${scores[ind.id]===n?'true':'false'}" style="${scores[ind.id]===n?'background:var(--color-teal);color:var(--color-white);':''}">${n} · ${HC_SCORE_LABELS[n]}</button>`).join('')}
            </div>
          </div>`).join('')}

        <div class="form-group">
          <label class="form-label form-label--optional" for="hc-seen-${focusArea.id}">What was seen?</label>
          <textarea class="form-textarea" id="hc-seen-${focusArea.id}" rows="2">${_hcEsc(d.whatWasSeen || '')}</textarea>
        </div>

        <div class="form-group">
          <span class="form-label">Is an action point identified for this area?</span>
          <div role="group" style="display:flex;gap:var(--space-sm);">
            <button type="button" class="btn btn--ghost btn--sm hc-action-toggle" data-value="yes" aria-pressed="${d.actionIdentified===true?'true':'false'}" style="${d.actionIdentified===true?'background:var(--color-amber);color:var(--color-white);':''}">Yes</button>
            <button type="button" class="btn btn--ghost btn--sm hc-action-toggle" data-value="no" aria-pressed="${d.actionIdentified===false?'true':'false'}" style="${d.actionIdentified===false?'background:var(--color-green);color:var(--color-white);':''}">No</button>
          </div>
        </div>
        <div class="hc-action-detail" style="display:${d.actionIdentified ? 'block' : 'none'};">
          <div class="form-group">
            <label class="form-label form-label--optional" for="hc-action-level-${focusArea.id}">Level of action required</label>
            <select class="form-select" id="hc-action-level-${focusArea.id}">
              <option value="">—</option>
              <option value="${HC_ACTION_LEVEL.INFORM_ONLY}" ${d.actionLevel===HC_ACTION_LEVEL.INFORM_ONLY?'selected':''}>Inform only</option>
              <option value="${HC_ACTION_LEVEL.SUPPORT}" ${d.actionLevel===HC_ACTION_LEVEL.SUPPORT?'selected':''}>Support / coaching</option>
              <option value="${HC_ACTION_LEVEL.TRAINING}" ${d.actionLevel===HC_ACTION_LEVEL.TRAINING?'selected':''}>Training or development</option>
              <option value="${HC_ACTION_LEVEL.FORMAL_FOLLOWUP}" ${d.actionLevel===HC_ACTION_LEVEL.FORMAL_FOLLOWUP?'selected':''}>Formal follow-up</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="hc-action-desc-${focusArea.id}">Describe the action point(s)</label>
            <textarea class="form-textarea" id="hc-action-desc-${focusArea.id}" rows="2">${_hcEsc(d.actionDescription || '')}</textarea>
          </div>
        </div>
      </div>
    </details>
  `;
}

function _hcWireDomainSections() {
  document.querySelectorAll('.hc-score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.hc-score-group');
      group.querySelectorAll('.hc-score-btn').forEach(b => {
        b.setAttribute('aria-pressed', 'false');
        b.style.background = ''; b.style.color = '';
      });
      btn.setAttribute('aria-pressed', 'true');
      btn.style.background = 'var(--color-teal)'; btn.style.color = 'var(--color-white)';
    });
  });
  document.querySelectorAll('.hc-action-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      group.querySelectorAll('.hc-action-toggle').forEach(b => { b.setAttribute('aria-pressed','false'); b.style.background=''; b.style.color=''; });
      btn.setAttribute('aria-pressed', 'true');
      const isYes = btn.dataset.value === 'yes';
      btn.style.background = isYes ? 'var(--color-amber)' : 'var(--color-green)';
      btn.style.color = 'var(--color-white)';
      const detail = btn.closest('.hc-domain-section').querySelector('.hc-action-detail');
      if (detail) detail.style.display = isYes ? 'block' : 'none';
    });
  });
}

// ── Save ──────────────────────────────────────────────────────
function _hcSaveReview() {
  const r = _hcDraftReview;
  r.cycleId = document.getElementById('hc-cycle').value;
  r.date = document.getElementById('hc-date').value;
  r.assessorName = document.getElementById('hc-assessor').value.trim();
  r.provision = document.getElementById('hc-provision').value;
  r.levelOfLearning = document.getElementById('hc-level').value;

  const errEl = document.getElementById('hc-save-error');
  if (!r.assessorName) { errEl.textContent = 'Please enter the assessor name.'; errEl.style.display = 'block'; return; }
  if (!r.date) { errEl.textContent = 'Please enter the date of review.'; errEl.style.display = 'block'; return; }

  const domains = {};
  document.querySelectorAll('.hc-domain-section').forEach(section => {
    const domainId = section.dataset.domainId;
    const focusArea = HC_FOCUS_AREAS.find(fa => fa.id === domainId);
    const indicatorScores = {};
    let anyScored = false;
    focusArea.indicators.forEach(ind => {
      const pressed = section.querySelector(`.hc-score-group[data-indicator-id="${ind.id}"] .hc-score-btn[aria-pressed="true"]`);
      if (pressed) { indicatorScores[ind.id] = parseInt(pressed.dataset.value); anyScored = true; }
    });
    if (!anyScored) return; // this focus area wasn't touched this session — skip it

    const scoreValues = Object.values(indicatorScores);
    const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
    const lowestScore = Math.min(...scoreValues);
    const actionBtn = section.querySelector('.hc-action-toggle[aria-pressed="true"]');
    const actionIdentified = actionBtn ? actionBtn.dataset.value === 'yes' : null;

    domains[domainId] = {
      context: section.querySelector(`#hc-context-${domainId}`)?.value.trim() || '',
      indicatorScores,
      avgScore, lowestScore,
      whatWasSeen: section.querySelector(`#hc-seen-${domainId}`)?.value.trim() || '',
      actionIdentified,
      actionLevel: actionIdentified ? section.querySelector(`#hc-action-level-${domainId}`)?.value || '' : '',
      actionDescription: actionIdentified ? section.querySelector(`#hc-action-desc-${domainId}`)?.value.trim() || '' : '',
    };
  });
  r.domains = domains;

  r.overallReflection = document.getElementById('hc-overall-reflection').value.trim();
  r.keyStrengths = document.getElementById('hc-key-strengths').value.trim();
  r.areasForImprovement = document.getElementById('hc-afis').value.trim();
  r.priorityNextSteps = document.getElementById('hc-priority-next').value.trim();

  r.supportPriorityScore = _hcPriorityScore(r);

  saveHealthCheckReview(r);
  errEl.style.display = 'none';
  _hcRenderStaffHistory(r.staffId);
  if (typeof UI !== 'undefined') UI.showToast('success', `Health Check saved — ${Object.keys(domains).length} focus area(s) recorded.`);
}

// Documented, adjustable — see file header. Weights the single lowest
// indicator score more heavily than the overall average, matching the
// stated intent behind Graeme's existing manual analysis ("weights lower
// practice score more heavily"), but the exact original weighting wasn't
// reverse-engineered with full confidence from the baseline spreadsheet
// alone. Confirm/adjust once the baseline data is actually imported and
// can be checked against known values.
function _hcPriorityScore(review) {
  const domains = Object.values(review.domains || {});
  if (domains.length === 0) return null;
  const avgOfAvgs = domains.reduce((s, d) => s + d.avgScore, 0) / domains.length;
  const lowestOverall = Math.min(...domains.map(d => d.lowestScore));
  return (6 - lowestOverall) * 1.0 + (6 - avgOfAvgs) * 0.4;
}

// ── Wire top-level events ────────────────────────────────────────
function _wireHCEvents() {
  document.getElementById('hc-area-sel')?.addEventListener('change', e => {
    _hcPopulateStaffSelector(e.target.value);
    document.getElementById('hc-staff-history').innerHTML = '';
    document.getElementById('hc-placeholder').style.display = 'block';
    document.getElementById('hc-review-form').style.display = 'none';
  });
  document.getElementById('hc-staff-sel')?.addEventListener('change', e => {
    _hcSelectedStaffId = e.target.value;
    _hcRenderStaffHistory(_hcSelectedStaffId);
    document.getElementById('hc-placeholder').style.display = 'block';
    document.getElementById('hc-review-form').style.display = 'none';
  });
  document.getElementById('hc-new-review-btn')?.addEventListener('click', _hcStartNewReview);
  document.getElementById('hc-import-btn')?.addEventListener('click', _hcOpenBaselineImport);
  document.getElementById('hc-bulk-generate-btn')?.addEventListener('click', () => {
    const status = document.getElementById('hc-bulk-generate-status');
    if (status) status.textContent = 'Generating…';
    const result = bulkGenerateActionPlansFromHealthChecks();
    const msg = `${result.created} Action Plan(s) created. ${result.skippedExisting} already had one. ${result.skippedNoActions} had no flagged actions.`;
    if (status) status.textContent = msg;
    if (typeof UI !== 'undefined') UI.showToast('success', `${result.created} Action Plan(s) created.`);
  });
}

// ── Baseline import (Session 37) ─────────────────────────────────
// Imports the real June 2026 baseline round — 50 review rows, extracted
// and validated against the source spreadsheet's own independently-
// computed avg/lowest scores before ever reaching this code (all 49
// cross-checkable rows matched exactly; see the handoff notes).
//
// What this code does NOT do: silently guess and save. Area codes in the
// real data are genuinely messy ("BUI400" vs "BUI", "Performing" vs
// "PERFORMING ARTS" vs "Performing Arts", "CON/BUI" naming two areas at
// once, "PD tutor (all areas)" not being an area at all) — a wrong
// automatic match here would misattribute a real person's real practice
// review. Every row gets a best-guess suggestion; nothing saves until
// area AND staff are both explicitly confirmed for that row, one row at
// a time or via "select all confidently matched" as a convenience — never
// a silent bulk default.
//
// Dedup: every imported review carries baselineSourceRowId. Re-running
// the import skips rows whose sourceRowId already exists in saved
// reviews, so this is safe to open more than once.

let _hcBaselineData = null;

async function _hcOpenBaselineImport() {
  const panel = document.getElementById('hc-import-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<p style="color:var(--color-muted);">Loading baseline data…</p>';

  if (!_hcBaselineData) {
    try {
      const res = await fetch('./planning/health-check-import/baseline-2026-parsed.json');
      _hcBaselineData = res.ok ? await res.json() : [];
    } catch {
      _hcBaselineData = [];
    }
  }

  if (_hcBaselineData.length === 0) {
    panel.innerHTML = '<p style="color:var(--color-red);">Could not load baseline-2026-parsed.json.</p>';
    return;
  }

  const alreadyImported = new Set(_hcGetAllReviews().map(r => r.baselineSourceRowId).filter(Boolean));
  const areas = _getAreas() || [];
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];

  panel.innerHTML = `
    <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">Import baseline data — June 2026</h2>
        <button id="hc-import-close" type="button" class="btn btn--ghost btn--sm">Close</button>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);">
        ${_hcBaselineData.length} rows from the original Form export. Area and staff matches are suggestions only —
        confirm each one before importing. ${alreadyImported.size > 0 ? `${alreadyImported.size} already imported.` : ''}
      </p>
      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);">
        <button id="hc-select-matched" type="button" class="btn btn--ghost btn--sm">Select all confidently matched</button>
        <button id="hc-import-selected" type="button" class="btn btn--primary btn--sm">Import selected</button>
      </div>
      <div id="hc-import-rows"></div>
    </div>
  `;

  const rowsContainer = document.getElementById('hc-import-rows');
  _hcBaselineData.forEach((rec, idx) => {
    if (alreadyImported.has(rec.sourceRowId)) {
      rowsContainer.appendChild(_hcRenderImportedRow(rec));
      return;
    }
    const guess = _hcGuessMatch(rec, areas, allStaff);
    rowsContainer.appendChild(_hcRenderImportRow(rec, idx, guess, areas, allStaff));
  });

  document.getElementById('hc-import-close')?.addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('hc-select-matched')?.addEventListener('click', () => {
    document.querySelectorAll('.hc-import-row[data-confident="true"] .hc-import-checkbox').forEach(cb => { cb.checked = true; });
  });
  document.getElementById('hc-import-selected')?.addEventListener('click', _hcCommitSelectedImports);
}

// Best-guess only — never auto-confirmed. Tries an exact case-insensitive
// match on area code or name first, then a prefix match (stripping
// trailing digits, e.g. "BUI400" -> "BUI") since that covers the most
// common real pattern in this data. Anything else is left unmatched
// rather than guessed at — "CON/BUI", "PD tutor (all areas)", and the
// three different spellings of Performing Arts are exactly the cases
// that should NOT be auto-resolved.
function _hcGuessMatch(rec, areas, allStaff) {
  const raw = (rec.areaCode || '').trim().toLowerCase();
  const rawName = (rec.areaName || '').trim().toLowerCase();
  let areaMatch = areas.find(a => a.areaCode.toLowerCase() === raw || a.areaName.toLowerCase() === rawName);
  if (!areaMatch) {
    const prefix = raw.replace(/\d+$/, '');
    if (prefix && prefix !== raw) {
      const candidates = areas.filter(a => a.areaCode.toLowerCase() === prefix);
      if (candidates.length === 1) areaMatch = candidates[0];
    }
  }

  const rawStaffName = (rec.staffMemberName || '').trim().toLowerCase();
  const staffPool = areaMatch ? allStaff.filter(s => s.areaCode === areaMatch.areaCode) : allStaff;
  const staffMatches = staffPool.filter(s => (s.name || '').trim().toLowerCase() === rawStaffName);
  const staffMatch = staffMatches.length === 1 ? staffMatches[0] : null;

  return {
    areaCode: areaMatch ? areaMatch.areaCode : '',
    staffId: staffMatch ? staffMatch.staffId : '',
    confident: !!(areaMatch && staffMatch),
  };
}

function _hcRenderImportRow(rec, idx, guess, areas, allStaff) {
  const div = document.createElement('div');
  div.className = 'hc-import-row';
  div.dataset.idx = idx;
  div.dataset.confident = guess.confident ? 'true' : 'false';
  div.style.cssText = `padding:var(--space-md);border:1px solid ${guess.confident ? 'var(--color-border)' : 'var(--color-amber)'};border-radius:var(--radius-sm);margin-bottom:var(--space-sm);`;

  const domainSummary = Object.entries(rec.domains).map(([id, d]) => {
    const label = (HC_FOCUS_AREAS.find(fa => fa.id === id) || {}).label || id;
    return `${label} (avg ${d.avgScore.toFixed(1)})`;
  }).join(', ');

  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:var(--space-md);">
      <input type="checkbox" class="hc-import-checkbox" style="margin-top:6px;">
      <div style="flex:1;">
        <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">
          "${_hcEsc(rec.staffMemberName)}" — raw area: "${_hcEsc(rec.areaCode)}" (${_hcEsc(rec.areaName)})
          ${!guess.confident ? '<span style="font-size:10px;color:var(--color-amber);font-weight:bold;margin-left:6px;">NEEDS REVIEW</span>' : ''}
        </p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-xs);">${_hcFmtDate(rec.date)} · Assessor: ${_hcEsc(rec.assessorName)} · ${_hcEsc(domainSummary)}</p>
        <div style="display:flex;gap:var(--space-sm);">
          <select class="form-select hc-import-area" style="flex:1;min-height:36px;font-size:var(--text-xs);">
            <option value="">— No area match —</option>
            ${areas.map(a => `<option value="${a.areaCode}" ${a.areaCode === guess.areaCode ? 'selected' : ''}>${a.areaCode} — ${a.areaName}</option>`).join('')}
          </select>
          <select class="form-select hc-import-staff" style="flex:1;min-height:36px;font-size:var(--text-xs);">
            <option value="">— No staff match —</option>
            <option value="__create__" ${!guess.staffId ? 'selected' : ''}>+ Create new staff: "${_hcEsc(rec.staffMemberName)}"</option>
            ${allStaff.map(s => `<option value="${s.staffId}" ${s.staffId === guess.staffId ? 'selected' : ''}>${_hcEsc(s.name)} (${s.areaCode})</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;

  div.querySelector('.hc-import-area').addEventListener('change', function () {
    const staffSel = div.querySelector('.hc-import-staff');
    const chosen = this.value;
    Array.from(staffSel.options).forEach(opt => {
      if (!opt.value) return;
      const s = allStaff.find(x => x.staffId === opt.value);
      opt.hidden = chosen && s && s.areaCode !== chosen;
    });
  });

  return div;
}

function _hcRenderImportedRow(rec) {
  const div = document.createElement('div');
  div.style.cssText = 'padding:var(--space-sm) var(--space-md);border:1px solid var(--color-green);background:var(--color-green-lt);border-radius:var(--radius-sm);margin-bottom:var(--space-sm);font-size:var(--text-xs);color:var(--color-green);';
  div.textContent = `✓ Already imported: ${rec.staffMemberName} — ${rec.areaCode} (${_hcFmtDate(rec.date)})`;
  return div;
}

function _hcCommitSelectedImports() {
  const rows = document.querySelectorAll('.hc-import-row');
  let imported = 0, skipped = 0, staffCreated = 0;
  // Same-batch dedup: if two rows in this import both need to create
  // "Lee Baker" in area BUI, only create the staff record once, not twice.
  const newlyCreatedInThisBatch = {};

  rows.forEach(row => {
    const checkbox = row.querySelector('.hc-import-checkbox');
    if (!checkbox.checked) return;

    const idx = parseInt(row.dataset.idx);
    const rec = _hcBaselineData[idx];
    const areaCode = row.querySelector('.hc-import-area').value;
    let staffId = row.querySelector('.hc-import-staff').value;

    if (!areaCode || !staffId) { skipped++; return; }

    if (staffId === '__create__') {
      if (!areaCode) { skipped++; return; }
      const dedupeKey = `${rec.staffMemberName.trim().toLowerCase()}|${areaCode}`;
      if (newlyCreatedInThisBatch[dedupeKey]) {
        staffId = newlyCreatedInThisBatch[dedupeKey];
      } else {
        const newStaff = {
          staffId: generateId(),
          name: rec.staffMemberName.trim(),
          areaCode,
          departmentCode: null,
          additionalAreas: [],
          role: '',
          entryPathway: 'referral',
          entryDate: todayISO(),
          etfStage: null,
          developmentPriorities: ['', '', ''],
          confidenceRating: null,
          touchHistory: [],
          reflectionRefs: [],
          afiRefs: [],
          isAnonymousAtAreaLevel: true,
          notes: 'Created automatically during Health Check baseline import.',
          createdAt: nowISO(),
          lastUpdated: nowISO(),
        };
        saveStaff(newStaff);
        const area = _getArea(areaCode);
        if (area) { if (!area.staffRefs) area.staffRefs = []; area.staffRefs.push(newStaff.staffId); saveArea(area); }
        staffId = newStaff.staffId;
        newlyCreatedInThisBatch[dedupeKey] = staffId;
        staffCreated++;
      }
    }

    const review = {
      reviewId: generateId(),
      cycleId: HC_CYCLES.BASELINE,
      date: rec.date,
      areaCode,
      staffId,
      assessorName: rec.assessorName || '',
      provision: rec.provision || '',
      levelOfLearning: rec.levelOfLearning || '',
      domains: rec.domains,
      overallReflection: rec.overallReflection || '',
      keyStrengths: rec.keyStrengths || '',
      areasForImprovement: rec.areasForImprovement || '',
      priorityNextSteps: rec.priorityNextSteps || '',
      baselineSourceRowId: rec.sourceRowId, // dedup guard — see file header
    };
    review.supportPriorityScore = _hcPriorityScore(review);

    saveHealthCheckReview(review);
    imported++;
  });

  if (typeof UI !== 'undefined') {
    UI.showToast(imported > 0 ? 'success' : 'warning',
      `Imported ${imported} review(s).${staffCreated > 0 ? ` ${staffCreated} new staff profile(s) created.` : ''}${skipped > 0 ? ` ${skipped} skipped (area not selected).` : ''}`);
  }
  _hcOpenBaselineImport(); // re-render to show newly-imported rows as done
}

// ── Helpers ───────────────────────────────────────────────────
function _hcGetAllReviews() { return (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || []; }
function _hcGetReview(id) { return _hcGetAllReviews().find(r => r.reviewId === id) || null; }
function _hcGetReviewsForStaff(staffId) { return _hcGetAllReviews().filter(r => r.staffId === staffId); }
function _hcGetReviewsForArea(areaCode) { return _hcGetAllReviews().filter(r => r.areaCode === areaCode); }
function _hcCycleLabel(cycleId) {
  return { [HC_CYCLES.BASELINE]:'Baseline', [HC_CYCLES.NOVEMBER]:'November', [HC_CYCLES.FEB_MARCH]:'Feb/March', [HC_CYCLES.JUNE]:'June' }[cycleId] || cycleId;
}
function _hcFmtDate(iso) { if (!iso) return ''; try { return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); } catch { return iso; } }
function _hcEsc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Shareable Word report (Session 63) ───────────────────────────
// Digital Leads carry out and act on Health Checks but do not have Hub
// access, so the record has to leave the Hub as a document. This exports
// one staff member's review as a Word file, including the action plan.
//
// The action plan section resolves in two ways, in priority order:
//   1. A real generated Action Plan (matched on sourceHealthCheckReviewId)
//      — used if one exists, so the document shows the *actual* plan of
//      record, including any edits made to it since generation.
//   2. Otherwise the actions flagged on the review itself, presented as
//      suggested actions and labelled as such — so a Lead is never sent a
//      report with an empty action section just because nobody has
//      pressed "Generate Action Plan" yet.
//
// Accessibility (the document is being sent to someone else, so this
// matters as much as the Hub UI does): real Heading 1/2/3 styles rather
// than bold-and-shaded paragraphs, so the doc is navigable by screen
// reader and the Navigation Pane; header rows marked tableHeader so they
// repeat and are announced as headers; document title/description set in
// core properties; and every score written as "3 · Developing", never a
// bare colour-coded number — the meaning must not depend on colour
// (WCAG 2.2 AA, 1.4.1 Use of Colour).

function _hcActionLevelLabel(level) {
  return {
    [HC_ACTION_LEVEL.INFORM_ONLY]:     'Inform only',
    [HC_ACTION_LEVEL.SUPPORT]:         'Support / coaching',
    [HC_ACTION_LEVEL.TRAINING]:        'Training or development',
    [HC_ACTION_LEVEL.FORMAL_FOLLOWUP]: 'Formal follow-up',
  }[level] || '';
}

// Returns { source: 'plan'|'derived'|'none', plan, items[] }
function _hcResolveActionPlan(review) {
  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff || []).find(s => s.staffId === review.staffId);
  const plan = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [])
    .find(p => p.sourceHealthCheckReviewId === review.reviewId) || null;

  if (plan && (plan.actionItems || []).length > 0) {
    return { source: 'plan', plan, items: plan.actionItems };
  }

  const items = [];
  HC_FOCUS_AREAS.forEach(fa => {
    const d = (review.domains || {})[fa.id];
    if (!d || !d.actionIdentified || !d.actionDescription) return;
    items.push({
      description: d.actionDescription,
      sourceDomain: fa.label,
      accountableName: staff ? staff.name : '',
      timeframe: null,
      done: false,
      actionLevel: d.actionLevel || '',
    });
  });
  return { source: items.length ? 'derived' : 'none', plan: null, items };
}

function _hcDownloadReportWord(reviewId) {
  const review = _hcGetReview(reviewId);
  if (!review) {
    if (typeof UI !== 'undefined') UI.showToast('error', 'Health Check record not found.');
    return;
  }
  if (typeof window.docx === 'undefined') {
    if (typeof UI !== 'undefined') UI.showToast('error', 'Word library not loaded — cannot generate document.');
    return;
  }
  const docx = window.docx;
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
          WidthType, HeadingLevel, ShadingType, AlignmentType } = docx;

  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff || []).find(s => s.staffId === review.staffId);
  const area  = typeof _getArea === 'function' ? _getArea(review.areaCode) : null;
  const staffName = staff ? staff.name : 'Unnamed staff member';
  const areaLabel = area ? `${area.areaName} (${area.areaCode})` : (review.areaCode || '');

  // ── Building blocks ──
  const P = (text, opts = {}) => new Paragraph({
    children: [new TextRun({ text: text == null ? '' : String(text), size: 22, bold: !!opts.bold, italics: !!opts.italics })],
    spacing: { after: opts.after != null ? opts.after : 120 },
  });
  const h1 = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 26 })],
    shading: { type: ShadingType.CLEAR, fill: '1D3557' },
    spacing: { before: 280, after: 160 },
  });
  const h2 = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: '1D3557', size: 24 })],
    spacing: { before: 220, after: 100 },
  });
  const cell = (text, bold, widthPct) => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: text == null ? '' : String(text), size: 22, bold: !!bold })] })],
  });
  const kvTable = (pairs) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: pairs.map(([k, v]) => new TableRow({ children: [cell(k, true, 34), cell(v || '—', false, 66)] })),
  });
  // Score always carries its word label — never colour or number alone.
  const scoreText = (n) => (n == null ? '—' : `${n} · ${HC_SCORE_LABELS[n] || ''}`.trim());
  const paras = (text) => {
    const out = String(text || '').split(/\n+/).map(t => t.trim()).filter(Boolean).map(t => P(t));
    return out.length ? out : [P('—')];
  };

  // ── Review details ──
  const detailPairs = [
    ['Staff member', staffName],
    ['Role', staff && staff.role ? staff.role : ''],
    ['Curriculum area', areaLabel],
    ['Provision', review.provision],
    ['Level of learning', review.levelOfLearning],
    ['Health Check cycle', _hcCycleLabel(review.cycleId)],
    ['Date of review', _hcFmtDate(review.date)],
    ['Assessor', review.assessorName],
    ['Focus areas reviewed', `${Object.keys(review.domains || {}).length} of ${HC_FOCUS_AREAS.length}`],
    ['Support priority score', review.supportPriorityScore != null ? review.supportPriorityScore.toFixed(1) : '—'],
  ];

  // ── Focus area sections, in schema order ──
  const focusChildren = [];
  const reviewed = HC_FOCUS_AREAS.filter(fa => (review.domains || {})[fa.id]);

  if (reviewed.length === 0) {
    focusChildren.push(P('No focus areas were scored in this review.'));
  } else {
    reviewed.forEach(fa => {
      const d = review.domains[fa.id];
      focusChildren.push(h2(fa.label));
      focusChildren.push(P(`Average score for this focus area: ${d.avgScore != null ? d.avgScore.toFixed(1) : '—'} out of 5`, { bold: true }));

      const scoredIndicators = fa.indicators.filter(ind => d.indicatorScores && d.indicatorScores[ind.id] != null);
      if (scoredIndicators.length) {
        focusChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [cell('Indicator', true, 42), cell('What this means', true, 36), cell('Score', true, 22)] }),
            ...scoredIndicators.map(ind => new TableRow({
              children: [
                cell(ind.label, false, 42),
                cell(ind.desc, false, 36),
                cell(scoreText(d.indicatorScores[ind.id]), false, 22),
              ],
            })),
          ],
        }));
      }

      if (d.context) { focusChildren.push(P('Context for this area:', { bold: true, after: 60 })); focusChildren.push(...paras(d.context)); }
      focusChildren.push(P('What was seen:', { bold: true, after: 60 }));
      focusChildren.push(...paras(d.whatWasSeen));

      if (d.actionIdentified) {
        const lvl = _hcActionLevelLabel(d.actionLevel);
        focusChildren.push(P(`Action point identified: Yes${lvl ? ` — ${lvl}` : ''}`, { bold: true, after: 60 }));
        focusChildren.push(...paras(d.actionDescription));
      } else if (d.actionIdentified === false) {
        focusChildren.push(P('Action point identified: No'));
      }
    });
  }

  // ── Action plan ──
  const resolved = _hcResolveActionPlan(review);
  const planChildren = [];

  if (resolved.source === 'plan') {
    planChildren.push(P(`Taken from the Action Plan generated from this Health Check${resolved.plan.focus ? `: ${resolved.plan.focus}` : ''}.`, { italics: true }));
    if (resolved.plan.aim) { planChildren.push(P('Aim:', { bold: true, after: 60 })); planChildren.push(P(resolved.plan.aim)); }
    if (resolved.plan.successCriteria) { planChildren.push(P('Success criteria:', { bold: true, after: 60 })); planChildren.push(P(resolved.plan.successCriteria)); }
  } else if (resolved.source === 'derived') {
    planChildren.push(P('Suggested actions, drawn from the action points flagged against each focus area during this review. These have not yet been formalised into an Action Plan in the Hub.', { italics: true }));
  }

  if (resolved.items.length === 0) {
    planChildren.push(P('No action points were flagged during this review.'));
  } else {
    // A real Action Plan tracks progress; a derived list has no progress to
    // track but does carry the escalation level recorded on the review. One
    // column, two different meanings — so label it for whichever it is,
    // rather than leaving a header that is wrong half the time.
    const isPlan = resolved.source === 'plan';
    const thirdHeader = isPlan ? 'Status' : 'Level of action';
    const thirdValue = (it) => isPlan
      ? (it.done ? 'Complete' : 'Outstanding')
      : (_hcActionLevelLabel(it.actionLevel) || '—');

    planChildren.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [
          cell('Focus area', true, 24), cell('Action', true, 38), cell(thirdHeader, true, 18), cell('Responsible', true, 20),
        ] }),
        ...resolved.items.map(it => new TableRow({
          children: [
            cell(it.sourceDomain || '—', false, 24),
            cell(it.description || '', false, 38),
            cell(thirdValue(it), false, 18),
            cell(it.accountableName || staffName, false, 20),
          ],
        })),
      ],
    }));
    planChildren.push(P('Agreed review date: ______________________          Signed: ______________________', { after: 240 }));
  }

  // ── Document ──
  const doc = new Document({
    title: `Digital Health Check Report — ${staffName}`,
    description: `Accessibility and Inclusion Practice Review for ${staffName}, ${areaLabel}, ${_hcCycleLabel(review.cycleId)} cycle.`,
    creator: review.assessorName || 'Weston College — Digital Pedagogy Coach',
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: 'Digital Health Check Report', bold: true, size: 34, color: '1D3557' })],
          spacing: { after: 80 },
          alignment: AlignmentType.LEFT,
        }),
        P('Accessibility and Inclusion Practice Review', { bold: true, after: 240 }),

        h1('Review details'),
        kvTable(detailPairs),

        h1('Focus areas'),
        P('Each indicator is scored 1 to 5: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident.', { italics: true }),
        ...focusChildren,

        h1('Overall review'),
        h2('Overall observed reflection'),
        ...paras(review.overallReflection),
        h2('Key strengths observed'),
        ...paras(review.keyStrengths),
        h2('Areas for improvement'),
        ...paras(review.areasForImprovement),
        h2('Priority next steps and recommendations'),
        ...paras(review.priorityNextSteps),

        h1(resolved.source === 'plan' ? 'Action plan' : 'Suggested action plan'),
        ...planChildren,

        P(`Generated from the DPC Hub on ${_hcFmtDate(todayISO())}. This report contains a named individual's practice review — share it only with those who need it for support and development purposes.`, { italics: true }),
      ],
    }],
  });

  const safeName = staffName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Staff';
  // Strip first, then fall back — otherwise "undated" strips to an empty
  // string and the filename ends in a stray underscore.
  const safeDate = (review.date || '').replace(/[^0-9-]/g, '') || 'undated';
  Packer.toBlob(doc).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Digital_Health_Check_${safeName}_${safeDate}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (typeof UI !== 'undefined') UI.showToast('success', `Report downloaded for ${staffName}.`);
  }).catch(err => {
    console.error('Health Check Word export failed:', err);
    if (typeof UI !== 'undefined') UI.showToast('error', 'Word export failed — see console for details.');
  });
}
