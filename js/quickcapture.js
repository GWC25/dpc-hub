// DPC Hub · js/quickcapture.js · v1.3 · September 2026
// v1.3 — a resource or document can be attached to an activity, either
// picked from the Resource Library or pasted as a title + link. It rides
// on links[] as { type: 'resource' }, so it surfaces on whatever else the
// activity is linked to. Adding it to the Library is opt-in, off by
// default, to keep one-off links out of the shared list.
// v1.2 — Area is no longer required. An activity can be logged against a
// Current Focus, Digital Lead or Health Check review instead, and is then
// held in the cross-college store rather than an area log. The rule is
// "an area or at least one link", so nothing can be saved into nowhere.
// v1.1 — "Link to" panel: an activity can be linked to one or more
// Current Focus records, a Digital Lead, and a Health Check review.
// Links are stored on the activity only (activity.links[]); the reverse
// view is derived on read via getLinkedActivities() in data.js.
// Quick Capture module. Floating FAB opens a modal for fast activity logging.
// Logs to area activityLog[] via saveArea(). Called from app.js initQuickCapture().

let _qcResourceDraftId = null;

function initQuickCapture() {
  // Modal HTML injected once into body — persists across module navigation
  if (document.getElementById('qc-modal')) return; // already initialised

  const modalEl = document.createElement('div');
  modalEl.innerHTML = `
    <div id="qc-modal" role="dialog" aria-modal="true" aria-labelledby="qc-modal-title" style="
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:600;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">

        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="qc-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Quick Capture</h2>
          <button id="qc-close" type="button" aria-label="Close Quick Capture" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);">×</button>
        </div>

        <!-- Activity type -->
        <div class="form-group">
          <label class="form-label" for="qc-type">Activity type</label>
          <select class="form-select" id="qc-type" name="qc-type" aria-required="true">
            <optgroup label="Observations">
              <option value="learning-walk">Learning Walk</option>
              <option value="devobs">Instructional Coaching</option>
              <option value="work-review">Work Review</option>
            </optgroup>
            <optgroup label="Coaching & Development">
              <option value="coaching">1:1 Coaching Session</option>
              <option value="teach-meet">Teach Meet</option>
              <option value="cpd-delivered">CPD Delivered</option>
            </optgroup>
            <optgroup label="Meetings">
              <option value="hoa-meeting">HoA Meeting</option>
              <option value="digital-lead-meeting">Digital Lead Meeting</option>
              <option value="tlam-meeting">TLAM Meeting</option>
              <option value="meeting">Other Meeting</option>
            </optgroup>
            <optgroup label="Other">
              <option value="health-check-visit">Health Check Visit</option>
              <option value="referral">Referral</option>
              <option value="resource-created">Resource Created</option>
              <option value="communication">Communication (email / Teams message)</option>
            </optgroup>
          </select>
        </div>

        <!-- Area -->
        <div class="form-group">
          <label class="form-label form-label--optional" for="qc-area">Area</label>
          <select class="form-select" id="qc-area" name="qc-area" aria-describedby="qc-area-hint">
            <option value="">Cross-college / no specific area</option>
          </select>
          <p id="qc-area-hint" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Leave this as cross-college for work belonging to a focus, a Digital Lead or a Health Check review rather than one curriculum area. Link it below instead.</p>
        </div>

        <!-- Date -->
        <div class="form-group">
          <label class="form-label" for="qc-date">Date</label>
          <input class="form-input" type="date" id="qc-date" name="qc-date" aria-required="true">
        </div>

        <!-- Hyper focus tags (prominent — college priority) -->
        <div class="form-group">
          <fieldset style="border:2px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);">
            <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-teal);padding:0 var(--space-xs);">College priority focus areas (Hyper)</legend>
            <div style="display:flex;flex-direction:column;gap:var(--space-sm);margin-top:var(--space-xs);">
              ${HYPER_FOCUS.map(f => `
                <div id="qc-hyper-block-${f.id}" style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-sm);">
                  <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin-bottom:0;">
                    <input type="checkbox" name="qc-hyper" value="${f.id}" id="qc-hyper-${f.id}" style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
                    <span style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);">${_escHtml(f.label)}</span>
                  </label>
                  <div id="qc-hyper-detail-${f.id}" style="display:none;margin-top:var(--space-sm);padding-top:var(--space-sm);border-top:1px solid var(--color-border);">
                    <p id="qc-hyper-q-${f.id}" style="font-size:var(--text-xs);color:var(--color-teal);font-style:italic;margin-bottom:var(--space-sm);"></p>
                    <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;" role="group" aria-label="Severity for ${f.label}">
                      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 10px;border:2px solid var(--color-green);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:bold;color:var(--color-green);">
                        <input type="radio" name="qc-sev-${f.id}" value="Strength" style="width:12px;height:12px;accent-color:var(--color-green);"> Strength
                      </label>
                      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 10px;border:2px solid var(--color-amber);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:bold;color:var(--color-amber);">
                        <input type="radio" name="qc-sev-${f.id}" value="Areas to Strengthen" style="width:12px;height:12px;accent-color:var(--color-amber);"> Areas to Strengthen
                      </label>
                      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 10px;border:2px solid var(--color-red);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:bold;color:var(--color-red);">
                        <input type="radio" name="qc-sev-${f.id}" value="Areas for Immediate Improvement" style="width:12px;height:12px;accent-color:var(--color-red);"> Immediate
                      </label>
                    </div>
                  </div>
                </div>`).join('')}
            </div>
            <p id="qc-hyper-noarea" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:var(--space-sm);display:none;">Themes will be recorded on this activity, but AFIs are held against a curriculum area, so none will be raised while this is cross-college.</p>
          </fieldset>
        </div>

        <!-- LRA themes (collapsed by default) -->
        <div class="form-group">
          <button type="button" id="qc-lra-toggle" style="background:none;border:none;cursor:pointer;color:var(--color-teal);font-size:var(--text-sm);font-weight:var(--font-bold);padding:0;display:flex;align-items:center;gap:var(--space-xs);" aria-expanded="false" aria-controls="qc-lra-panel">
            <span id="qc-lra-arrow">▶</span> LRA themes (optional)
          </button>
          <div id="qc-lra-panel" style="display:none;margin-top:var(--space-md);">
            ${LRA_TAXONOMY.map(cat => `
              <div style="margin-bottom:var(--space-md);">
                <p style="font-size:var(--text-xs);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-xs);text-transform:uppercase;letter-spacing:0.05em;">${_escHtml(cat.label)}</p>
                <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;">
                  ${cat.themes.map(theme => `
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px var(--space-sm);border:1px solid var(--color-border);border-radius:999px;font-size:var(--text-xs);background:var(--color-white);" title="${_escHtml(theme.desc)}">
                      <input type="checkbox" name="qc-lra" value="${theme.id}" id="qc-lra-${theme.id}" style="width:12px;height:12px;accent-color:var(--color-navy);">
                      ${_escHtml(theme.id)} — ${_escHtml(theme.label)}
                    </label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Pyramid level -->
        <div class="form-group">
          <label class="form-label" for="qc-pyramid">Pyramid level</label>
          <select class="form-select" id="qc-pyramid" name="qc-pyramid">
            <option value="foundations">Foundations</option>
            <option value="inclusion">Inclusion</option>
            <option value="innovation">Innovation</option>
          </select>
        </div>

        <!-- Summary / notes -->
        <div class="form-group">
          <label class="form-label" for="qc-summary">Summary</label>
          <textarea class="form-textarea" id="qc-summary" name="qc-summary" rows="3" placeholder="Brief note about this activity…"></textarea>
        </div>

        <!-- QIP reference -->
        <div class="form-group">
          <label class="form-label form-label--optional" for="qc-qip">QIP reference</label>
          <input class="form-input" type="text" id="qc-qip" name="qc-qip" placeholder="e.g. Q3.2">
        </div>

        <!-- Link to (v1.1) -->
        <div class="form-group">
          <button type="button" id="qc-link-toggle" style="background:none;border:none;cursor:pointer;color:var(--color-teal);font-size:var(--text-sm);font-weight:var(--font-bold);padding:0;display:flex;align-items:center;gap:var(--space-xs);min-height:44px;" aria-expanded="false" aria-controls="qc-link-panel">
            <span id="qc-link-arrow" aria-hidden="true">&#9654;</span> Link to (optional)
          </button>
          <p id="qc-link-summary" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px;"></p>
          <p id="qc-link-status" role="status" aria-live="polite" class="sr-only"></p>

          <div id="qc-link-panel" style="display:none;margin-top:var(--space-md);">

            <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
              <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 var(--space-xs);">Current Focus</legend>
              <div id="qc-link-focus-list" style="display:flex;flex-direction:column;gap:var(--space-xs);margin-top:var(--space-xs);"></div>
            </fieldset>

            <div class="form-group">
              <label class="form-label form-label--optional" for="qc-link-dl">Digital Lead</label>
              <select class="form-select" id="qc-link-dl" aria-describedby="qc-link-dl-hint">
                <option value="">&mdash; None &mdash;</option>
              </select>
              <p id="qc-link-dl-hint" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Selected automatically for a Digital Lead Meeting once an area is chosen.</p>
            </div>

            <div class="form-group">
              <label class="form-label form-label--optional" for="qc-link-hc">Health Check review</label>
              <select class="form-select" id="qc-link-hc" aria-describedby="qc-link-hc-hint">
                <option value="">&mdash; None &mdash;</option>
              </select>
              <p id="qc-link-hc-hint" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Reviews are held against a named staff member. Linking one will show that name in this activity record.</p>
            </div>

            <div class="form-group">
              <label class="form-label form-label--optional" for="qc-link-resource">Resource or document</label>
              <select class="form-select" id="qc-link-resource" aria-describedby="qc-link-resource-hint">
                <option value="">&mdash; None &mdash;</option>
                <option value="__new__">Paste a new link&hellip;</option>
              </select>
              <p id="qc-link-resource-hint" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Everything is a link — for a file, paste its OneDrive or SharePoint address.</p>
              <div id="qc-res-new-fields" style="display:none;margin-top:var(--space-sm);padding:var(--space-md);background:var(--color-light);border-radius:var(--radius-md);">
                <div class="form-group">
                  <label class="form-label" for="qc-res-title">Title</label>
                  <input class="form-input" type="text" id="qc-res-title" placeholder="e.g. Teams environments walkthrough">
                </div>
                <div class="form-group">
                  <label class="form-label" for="qc-res-url">Link</label>
                  <input class="form-input" type="url" id="qc-res-url" placeholder="https://…">
                </div>
                <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin-bottom:0;min-height:32px;">
                  <input type="checkbox" id="qc-res-to-library" style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
                  <span style="font-size:var(--text-sm);color:var(--color-navy);">Also add to the Resource Library</span>
                </label>
              </div>
            </div>

          </div>
        </div>

        <p id="qc-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>

        <div class="btn-row">
          <button id="qc-save" type="button" class="btn btn--primary">Save activity</button>
          <button id="qc-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  _populateQCAreaDropdown();
  _wireQCEvents();

  // Wire the FAB button
  const fab = document.getElementById('quick-capture-btn');
  if (fab) {
    // Remove any previous listener by cloning
    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);
    newFab.addEventListener('click', openQuickCapture);
  }
}

function openQuickCapture() {
  const modal = document.getElementById('qc-modal');
  if (!modal) return;

  // Refresh area dropdown every open (data may have loaded since init)
  _populateQCAreaDropdown();

  // Reset form
  const form  = modal.querySelector('form') || modal;
  document.getElementById('qc-type').value    = 'learning-walk';
  document.getElementById('qc-area').value    = '';
  document.getElementById('qc-date').value    = todayISO();
  document.getElementById('qc-pyramid').value = 'foundations';
  document.getElementById('qc-summary').value = '';
  document.getElementById('qc-qip').value     = '';
  document.getElementById('qc-error').style.display = 'none';

  // Uncheck all checkboxes
  modal.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });

  // Reset Hyper label styles
  HYPER_FOCUS.forEach(f => {
    const lbl = document.getElementById(`qc-hyper-label-${f.id}`);
    if (lbl) { lbl.style.background = 'transparent'; lbl.style.color = 'var(--color-teal)'; }
  });

  // Collapse LRA panel
  document.getElementById('qc-lra-panel').style.display = 'none';
  document.getElementById('qc-lra-toggle').setAttribute('aria-expanded','false');
  document.getElementById('qc-lra-arrow').textContent = '▶';

  // A pasted resource keeps one id for the life of the open modal, so the
  // summary line, the saved link and any Resource Library entry all agree.
  _qcResourceDraftId = null;
  const resSel = document.getElementById('qc-link-resource');
  if (resSel) resSel.value = '';
  ['qc-res-title','qc-res-url'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const resLib = document.getElementById('qc-res-to-library'); if (resLib) resLib.checked = false;
  const resFields = document.getElementById('qc-res-new-fields'); if (resFields) resFields.style.display = 'none';

  // Reset + repopulate the Link to panel. Clearing the two selects first
  // matters: repopulating restores a still-valid previous value, which
  // would silently carry a link over from the last capture.
  const dlSel = document.getElementById('qc-link-dl');
  const hcSel = document.getElementById('qc-link-hc');
  if (dlSel) dlSel.value = '';
  if (hcSel) hcSel.value = '';
  const linkStatus = document.getElementById('qc-link-status');
  if (linkStatus) linkStatus.textContent = '';
  _qcSetLinkPanel(false);
  _qcPopulateLinkPickers();

  modal.style.display = 'flex';
  document.getElementById('qc-type').focus();
}

function _wireQCEvents() {
  document.getElementById('qc-close')?.addEventListener('click', _closeQC);
  document.getElementById('qc-cancel')?.addEventListener('click', _closeQC);
  document.getElementById('qc-save')?.addEventListener('click', _saveQC);

  // Close on overlay click
  document.getElementById('qc-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('qc-modal')) _closeQC();
  });

  // LRA toggle
  document.getElementById('qc-lra-toggle')?.addEventListener('click', () => {
    const panel  = document.getElementById('qc-lra-panel');
    const btn    = document.getElementById('qc-lra-toggle');
    const arrow  = document.getElementById('qc-lra-arrow');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    arrow.textContent = isOpen ? '▶' : '▼';
  });

  // Hyper checkbox — show severity + follow-up question when checked
  HYPER_FOCUS.forEach(f => {
    const cb = document.getElementById('qc-hyper-' + f.id);
    if (!cb) return;
    cb.addEventListener('change', function(e) {
      const block  = document.getElementById('qc-hyper-block-' + f.id);
      const detail = document.getElementById('qc-hyper-detail-' + f.id);
      const qEl    = document.getElementById('qc-hyper-q-' + f.id);
      if (e.target.checked) {
        if (block)  { block.style.background = 'var(--color-teal-lt)'; block.style.borderColor = 'var(--color-teal)'; }
        if (detail) detail.style.display = 'block';
        if (qEl && typeof getQuestionsForTheme === 'function') {
          var rules = getQuestionsForTheme(f.id);
          qEl.textContent = rules.length > 0 ? rules[0].followUpQuestions[0] : '';
        }
      } else {
        if (block)  { block.style.background = ''; block.style.borderColor = 'var(--color-border)'; }
        if (detail) detail.style.display = 'none';
      }
    });
  });

  // Link to toggle
  document.getElementById('qc-link-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('qc-link-panel');
    _qcSetLinkPanel(panel.style.display === 'none');
  });

  // Repopulate the area-dependent pickers whenever the area changes
  document.getElementById('qc-area')?.addEventListener('change', () => {
    _qcPopulateLinkPickers();
    _qcApplyTypeDefaults();
  });

  // Activity type drives sensible link defaults
  document.getElementById('qc-type')?.addEventListener('change', _qcApplyTypeDefaults);

  // Resource picker: title and link only apply when pasting something new
  document.getElementById('qc-link-resource')?.addEventListener('change', function() {
    const fields = document.getElementById('qc-res-new-fields');
    if (fields) fields.style.display = this.value === '__new__' ? 'block' : 'none';
    _qcUpdateLinkSummary();
  });
  ['qc-res-title','qc-res-url'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _qcUpdateLinkSummary);
  });

  // ESC
  document.addEventListener('keydown', function qcEsc(e) {
    if (e.key === 'Escape') {
      const m = document.getElementById('qc-modal');
      if (m && m.style.display === 'flex') { _closeQC(); e.stopPropagation(); }
      else document.removeEventListener('keydown', qcEsc);
    }
  });
}

function _closeQC() {
  const modal = document.getElementById('qc-modal');
  if (modal) modal.style.display = 'none';
}

function _saveQC() {
  const areaCode = document.getElementById('qc-area').value;
  const type     = document.getElementById('qc-type').value;
  const date     = document.getElementById('qc-date').value;
  const summary  = document.getElementById('qc-summary').value.trim();
  const errEl    = document.getElementById('qc-error');

  if (!date) { _showQCError('Please enter a date.'); document.getElementById('qc-date').focus(); return; }

  // An activity needs somewhere to live. With no area it must be linked to
  // a focus, a Digital Lead or a Health Check review, or it would save into
  // nowhere and never appear again.
  // A half-filled resource paste is a mistake worth catching — silently
  // dropping it would lose the link the user thought they had attached.
  const resVal = document.getElementById('qc-link-resource')?.value || '';
  if (resVal === '__new__' && !(document.getElementById('qc-res-url')?.value || '').trim()) {
    _showQCError('Enter a link for the resource, or set the resource picker back to None.');
    _qcSetLinkPanel(true);
    document.getElementById('qc-res-url').focus();
    return;
  }

  const links = _qcGatherLinks();
  // A resource on its own is not somewhere for the activity to live — it
  // still needs an area, a focus, a Digital Lead or a Health Check review.
  const homeLinks = links.filter(l => l.type !== 'resource');
  if (!areaCode && homeLinks.length === 0) {
    _showQCError('Choose an area, or link this to a Current Focus, Digital Lead or Health Check review. Without one of those it would not show up anywhere in the Hub.');
    _qcSetLinkPanel(true);
    document.getElementById('qc-link-toggle').focus();
    return;
  }

  // Collect Hyper themes + severity + generate AFI drafts
  var hyperThemes = [];
  var afiDrafts   = [];
  HYPER_FOCUS.forEach(function(f) {
    var cb = document.getElementById('qc-hyper-' + f.id);
    if (cb && cb.checked) {
      hyperThemes.push(f.id);
      var sevEl = document.querySelector('input[name="qc-sev-' + f.id + '"]:checked');
      // AFIs are held against a curriculum area, so a cross-college
      // capture records the theme but raises no AFI.
      if (areaCode && sevEl && typeof draftAFI === 'function') {
        var draft = draftAFI(f.id, sevEl.value, areaCode);
        if (draft) afiDrafts.push(draft);
      }
    }
  });

  // Collect LRA themes
  const lraThemeIds = Array.from(document.querySelectorAll('input[name="qc-lra"]:checked'))
    .map(cb => cb.value);

  const activity = {
    activityId:   generateId(),
    activityType: type,
    date,
    areaCode,
    staffIds:     [],
    lraThemeIds,
    hyperThemes,
    pyramidLevel: document.getElementById('qc-pyramid').value || 'foundations',
    summary:      summary || `${type} — ${areaCode || 'Cross-college'}`,
    afiIdsGenerated: [],
    sharedId:     null,
    links,
    qipRef:       document.getElementById('qc-qip').value.trim() || null,
    createdAt:    nowISO(),
  };

  // Write. saveActivity() routes to the area log when there is an area,
  // and to the cross-college store when there is not.
  const area = areaCode ? _getArea(areaCode) : null;
  if (areaCode && !area) { _showQCError('Area not found — please try again.'); return; }

  if (typeof saveActivity === 'function') {
    saveActivity(activity);
  } else {
    if (!area) { _showQCError('Could not save — activity store unavailable.'); return; }
    if (!area.activityLog) area.activityLog = [];
    area.activityLog.push(activity);
  }

  // Save any AFI drafts generated from Hyper severity selections
  if (afiDrafts.length > 0 && area && typeof saveAFI === 'function') {
    if (!area.afiRefs) area.afiRefs = [];
    var allAFIs = window.DPC_DATA.afi.afis || [];
    afiDrafts.forEach(function(draft) {
      draft.parentObservationId = activity.activityId;
      allAFIs.push(draft);
      area.afiRefs.push(draft.afiId);
      activity.afiIdsGenerated.push(draft.afiId);
    });
    window.DPC_DATA.afi.afis = allAFIs;
    // Job A5: attribute to the instrument that produced it.
    afiDrafts.forEach(a => { if (!a.source) a.source = AFI_SOURCE.QUICK_CAPTURE; });
    saveAFI(afiDrafts[0]);
  }

  if (area) { area.lastUpdated = nowISO(); saveArea(area); }

  // Opt-in Library write. Done here rather than in _qcGatherLinks(), which
  // runs on every keystroke to update the summary line.
  const newRes = links.find(l => l.type === 'resource' && l.id === _qcResourceDraftId);
  if (newRes && newRes.fromLibrary && typeof saveLibraryEntry === 'function') {
    saveLibraryEntry({
      resourceId:  newRes.id,
      type:        typeof LIBRARY_TYPE !== 'undefined' ? LIBRARY_TYPE.EXTERNAL_RESOURCE : 'external-resource',
      title:       newRes.title,
      url:         newRes.url,
      description: '',
      tags:        [],
    });
  }

  _closeQC();

  // Show confirmation toast
  if (typeof UI !== 'undefined' && UI.showToast) {
    const linkCount = (activity.links || []).length;
    UI.showToast('success', 'Activity logged: ' + type + ' — ' + (areaCode || 'cross-college')
      + (afiDrafts.length > 0 ? '. ' + afiDrafts.length + ' AFI' + (afiDrafts.length !== 1 ? 's' : '') + ' created.' : '')
      + (linkCount > 0 ? ' ' + linkCount + ' link' + (linkCount !== 1 ? 's' : '') + ' added.' : ''));
  }

  // Refresh current view if we're on areas
  if (typeof _areasCurrentArea !== 'undefined' && _areasCurrentArea === areaCode) {
    _renderAreaTab(_areasDetailTab || 'activity', areaCode);
  }
}

function _showQCError(msg) {
  const el = document.getElementById('qc-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _populateQCAreaDropdown() {
  const sel = document.getElementById('qc-area');
  if (!sel) return;
  // Clear existing options beyond the cross-college choice
  while (sel.options.length > 1) sel.remove(1);
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.sort((a,b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

// ── Link to panel (v1.1) ─────────────────────────────────────────

function _qcSetLinkPanel(open) {
  const panel = document.getElementById('qc-link-panel');
  const btn   = document.getElementById('qc-link-toggle');
  const arrow = document.getElementById('qc-link-arrow');
  if (!panel || !btn) return;
  panel.style.display = open ? 'block' : 'none';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (arrow) arrow.textContent = open ? '\u25bc' : '\u25b6';
}

// Populates the three pickers. Current Focus is cross-college so it is
// never filtered by area; Digital Lead and Health Check are both
// area-scoped, so both are rebuilt whenever the area changes.
function _qcPopulateLinkPickers() {
  const areaCode = document.getElementById('qc-area')?.value || '';
  const noAreaNote = document.getElementById('qc-hyper-noarea');
  if (noAreaNote) noAreaNote.style.display = areaCode ? 'none' : 'block';
  _qcPopulateFocusList();
  _qcPopulateDLSelect(areaCode);
  _qcPopulateHCSelect(areaCode);
  _qcPopulateResourceSelect();
  _qcUpdateLinkSummary();
}

function _qcPopulateFocusList() {
  const wrap = document.getElementById('qc-link-focus-list');
  if (!wrap) return;
  const focuses = ((window.DPC_DATA.currentFocus && window.DPC_DATA.currentFocus.focuses) || [])
    .filter(f => (f.status || 'active') === 'active')
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  if (focuses.length === 0) {
    wrap.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-muted);">No active focus areas. Create one in Current Focus.</p>';
    return;
  }

  wrap.innerHTML = focuses.map(f => `
    <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;margin-bottom:0;min-height:32px;">
      <input type="checkbox" name="qc-link-focus" value="${_escHtml(f.focusId)}" id="qc-link-focus-${_escHtml(f.focusId)}" style="width:16px;height:16px;accent-color:var(--color-teal);flex-shrink:0;">
      <span style="font-size:var(--text-sm);color:var(--color-navy);">${_escHtml(f.title)}</span>
    </label>`).join('');

  wrap.querySelectorAll('input[name="qc-link-focus"]').forEach(cb => {
    cb.addEventListener('change', _qcUpdateLinkSummary);
  });
}

function _qcPopulateDLSelect(areaCode) {
  const sel = document.getElementById('qc-link-dl');
  if (!sel) return;
  const previous = sel.value;
  const all = (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads) || [];
  const forArea = all.filter(d => d.areaCode === areaCode);
  const others  = all.filter(d => d.areaCode !== areaCode)
                     .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  let html = '<option value="">&mdash; None &mdash;</option>';
  if (forArea.length > 0) {
    html += `<optgroup label="${_escHtml(areaCode)}">`
         + forArea.map(d => `<option value="${_escHtml(d.dlId)}">${_escHtml(d.name)}</option>`).join('')
         + '</optgroup>';
  }
  if (others.length > 0) {
    html += '<optgroup label="Other areas">'
         + others.map(d => `<option value="${_escHtml(d.dlId)}">${_escHtml(d.name)} (${_escHtml(d.areaCode || '')})</option>`).join('')
         + '</optgroup>';
  }
  sel.innerHTML = html;
  if (previous && sel.querySelector(`option[value="${CSS.escape(previous)}"]`)) sel.value = previous;
  sel.removeEventListener('change', _qcUpdateLinkSummary);
  sel.addEventListener('change', _qcUpdateLinkSummary);
}

function _qcPopulateHCSelect(areaCode) {
  const sel = document.getElementById('qc-link-hc');
  if (!sel) return;
  const previous = sel.value;
  // With no area chosen the picker is not narrowed — all reviews are
  // offered, each labelled with its area code.
  const reviews = ((window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [])
    .filter(r => !areaCode || r.areaCode === areaCode)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const staffList = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const cycleLabel = (id) => (typeof _hcCycleLabel === 'function' ? _hcCycleLabel(id) : (id || ''));

  let html = '<option value="">&mdash; None &mdash;</option>';
  html += reviews.map(r => {
    const staff = staffList.find(s => s.staffId === r.staffId);
    const bits = [
      staff ? staff.name : 'Unnamed staff member',
      areaCode ? '' : (r.areaCode || ''),
      cycleLabel(r.cycleId),
      r.date || '',
    ].filter(Boolean);
    return `<option value="${_escHtml(r.reviewId)}">${_escHtml(bits.join(' \u2014 '))}</option>`;
  }).join('');

  sel.innerHTML = html;
  if (previous && sel.querySelector(`option[value="${CSS.escape(previous)}"]`)) sel.value = previous;
  sel.removeEventListener('change', _qcUpdateLinkSummary);
  sel.addEventListener('change', _qcUpdateLinkSummary);

  const status = document.getElementById('qc-link-status');
  if (status) {
    const scope = areaCode ? ` for ${areaCode}` : ' across the college';
    status.textContent = reviews.length === 0
      ? `No Health Check reviews recorded${scope}.`
      : `${reviews.length} Health Check review${reviews.length !== 1 ? 's' : ''} available${scope}.`;
  }
}

// Type-driven defaults: a Digital Lead Meeting should already point at
// that area's Digital Lead, and a Health Check Visit should open the
// panel so the review is not missed.
function _qcApplyTypeDefaults() {
  const type     = document.getElementById('qc-type')?.value || '';
  const areaCode = document.getElementById('qc-area')?.value || '';
  const dlSel    = document.getElementById('qc-link-dl');

  if (type === 'digital-lead-meeting' && dlSel && !dlSel.value && areaCode) {
    const all = (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads) || [];
    const dl  = all.find(d => d.areaCode === areaCode);
    if (dl) dlSel.value = dl.dlId;
  }

  if (type === 'digital-lead-meeting' || type === 'health-check-visit') _qcSetLinkPanel(true);
  _qcUpdateLinkSummary();
}

function _qcUpdateLinkSummary() {
  const el = document.getElementById('qc-link-summary');
  if (!el) return;
  const links = _qcGatherLinks();
  if (links.length === 0) { el.textContent = ''; return; }
  const counts = {
    focus: links.filter(l => l.type === 'focus').length,
    dl:    links.filter(l => l.type === 'digital-lead').length,
    hc:    links.filter(l => l.type === 'healthcheck').length,
    res:   links.filter(l => l.type === 'resource').length,
  };
  const parts = [];
  if (counts.focus) parts.push(`${counts.focus} focus area${counts.focus !== 1 ? 's' : ''}`);
  if (counts.dl)    parts.push('1 Digital Lead');
  if (counts.hc)    parts.push('1 Health Check review');
  if (counts.res)   parts.push('1 resource');
  el.textContent = 'Linked to: ' + parts.join(', ');
}

function _qcGatherLinks() {
  const links = [];

  document.querySelectorAll('input[name="qc-link-focus"]:checked').forEach(cb => {
    links.push({ type: 'focus', id: cb.value });
  });

  const dlId = document.getElementById('qc-link-dl')?.value;
  if (dlId) links.push({ type: 'digital-lead', id: dlId });

  const hcId = document.getElementById('qc-link-hc')?.value;
  if (hcId) links.push({ type: 'healthcheck', id: hcId });

  const resVal = document.getElementById('qc-link-resource')?.value || '';
  if (resVal === '__new__') {
    const url   = (document.getElementById('qc-res-url')?.value || '').trim();
    const title = (document.getElementById('qc-res-title')?.value || '').trim();
    if (url) {
      if (!_qcResourceDraftId) _qcResourceDraftId = generateId();
      links.push({
        type: 'resource', id: _qcResourceDraftId,
        title: title || url, url,
        fromLibrary: !!document.getElementById('qc-res-to-library')?.checked,
      });
    }
  } else if (resVal) {
    const entry = typeof getLibraryEntryById === 'function' ? getLibraryEntryById(resVal) : null;
    if (entry) {
      links.push({
        type: 'resource', id: entry.resourceId,
        title: entry.title, url: entry.url, fromLibrary: true,
      });
    }
  }

  return links;
}

function _qcPopulateResourceSelect() {
  const sel = document.getElementById('qc-link-resource');
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '<option value="">&mdash; None &mdash;</option>'
    + '<option value="__new__">Paste a new link&hellip;</option>'
    + (typeof renderLibraryOptionsHtml === 'function' ? renderLibraryOptionsHtml() : '');
  if (previous && sel.querySelector(`option[value="${CSS.escape(previous)}"]`)) sel.value = previous;
  const fields = document.getElementById('qc-res-new-fields');
  if (fields) fields.style.display = sel.value === '__new__' ? 'block' : 'none';
}

function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
