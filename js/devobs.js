// DPC Hub · js/devobs.js · v1.0 · July 2026
// Development Observation modal. Full LRA theme selection with heuristic
// follow-up questions. Hyper themes prominent. AFI auto-draft review panel.
// Dual-write to area activityLog[] and data-afi.json via saveArea() / saveAFI().

function initDevObs() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-lg);">Development Observations</h1>
    <p style="font-size:var(--text-base);color:var(--color-muted);margin-bottom:var(--space-xl);">Structured developmental observations linked to the LRA taxonomy. Click to open a new DevObs or view recent observations.</p>
    <button id="devobs-new-btn" type="button" class="btn btn--primary" style="margin-bottom:var(--space-xl);">+ New DevObs</button>
    <h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Recent DevObs</h2>
    <div id="devobs-recent-list"></div>
  `;
  _renderRecentDevObs();
  document.getElementById('devobs-new-btn')?.addEventListener('click', () => openDevObsModal({}));
}

// ── Open DevObs modal ─────────────────────────────────────────
function openDevObsModal(prefillData={}) {
  document.getElementById('devobs-modal')?.remove();

  const el = document.createElement('div');
  el.innerHTML = `
    <div id="devobs-modal" role="dialog" aria-modal="true" aria-labelledby="devobs-title" style="
      display:flex;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:600;
      align-items:flex-start;justify-content:center;
      padding:var(--space-lg);overflow-y:auto;
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:800px;padding:var(--space-xl);margin:auto;">

        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="devobs-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Development Observation</h2>
          <button id="devobs-close" type="button" aria-label="Close DevObs" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>

        <!-- Header fields -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-lg);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="do-area">Area</label>
            <select class="form-select" id="do-area" required aria-required="true">
              <option value="">— Select —</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label form-label--optional" for="do-staff">Staff member</label>
            <input class="form-input" type="text" id="do-staff" placeholder="Name (auto-creates profile)" list="do-staff-list">
            <datalist id="do-staff-list"></datalist>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="do-date">Date</label>
            <input class="form-input" type="date" id="do-date" required aria-required="true">
          </div>
        </div>

        <!-- Hyper focus banner -->
        <div style="background:var(--color-teal-lt);border:2px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-teal);margin-bottom:var(--space-sm);">College priority focus areas — Hyper 2025-26</p>
          <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
            ${HYPER_FOCUS.map(f => `
              <label id="do-hyper-label-${f.id}" style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;padding:6px 14px;border:2px solid var(--color-teal);border-radius:999px;font-size:var(--text-sm);font-weight:bold;color:var(--color-teal);background:var(--color-white);transition:all 150ms;">
                <input type="checkbox" id="do-hyper-${f.id}" name="do-hyper" value="${f.id}" style="width:16px;height:16px;accent-color:var(--color-teal);" checked>
                ${_doEsc(f.label)}
              </label>`).join('')}
          </div>
        </div>

        <!-- LRA observation rows -->
        <div style="margin-bottom:var(--space-lg);">
          <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Observation themes</h3>
          <div id="do-lra-sections">
            ${LRA_TAXONOMY.map(cat => `
              <details style="margin-bottom:var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
                <summary style="padding:var(--space-sm) var(--space-md);cursor:pointer;font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);list-style:none;display:flex;align-items:center;justify-content:space-between;user-select:none;">
                  <span>${_doEsc(cat.label)}</span>
                  <span style="font-size:var(--text-xs);color:var(--color-muted);" id="do-cat-count-${cat.id}"></span>
                </summary>
                <div style="padding:var(--space-md);border-top:1px solid var(--color-border);">
                  ${cat.themes.map(theme => `
                    <div id="do-theme-block-${theme.id}" style="margin-bottom:var(--space-md);padding:var(--space-sm);border-radius:var(--radius-sm);border:1px solid transparent;transition:all 150ms;">
                      <label style="display:flex;align-items:center;gap:var(--space-sm);cursor:pointer;margin-bottom:4px;">
                        <input type="checkbox" id="do-theme-${theme.id}" name="do-theme" value="${theme.id}" style="width:16px;height:16px;accent-color:var(--color-navy);flex-shrink:0;">
                        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_doEsc(theme.id)} — ${_doEsc(theme.label)}</span>
                      </label>
                      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-left:28px;margin-bottom:var(--space-sm);">${_doEsc(theme.desc)}</p>
                      <!-- Follow-up questions + severity — shown when checked -->
                      <div id="do-theme-detail-${theme.id}" style="display:none;margin-left:28px;">
                        <div id="do-theme-questions-${theme.id}" style="margin-bottom:var(--space-sm);padding:var(--space-sm);background:var(--color-blue-lt);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-blue);font-style:italic;"></div>
                        <div role="group" aria-label="Severity for ${_doEsc(theme.label)}" style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);flex-wrap:wrap;">
                          ${[AFI_SEVERITY.STRENGTH, AFI_SEVERITY.STRENGTHEN, AFI_SEVERITY.IMMEDIATE].map(sev => `
                            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 12px;border:2px solid var(--color-border);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:bold;transition:all 150ms;">
                              <input type="radio" name="do-sev-${theme.id}" value="${sev}" style="width:14px;height:14px;accent-color:var(--color-teal);">
                              ${sev}
                            </label>`).join('')}
                        </div>
                        <textarea id="do-theme-note-${theme.id}" rows="2" placeholder="Observation note for this theme…" style="width:100%;padding:var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;resize:vertical;"></textarea>
                      </div>
                    </div>`).join('')}
                </div>
              </details>`).join('')}
          </div>
        </div>

        <!-- Overall notes -->
        <div class="form-group">
          <label class="form-label form-label--optional" for="do-notes">Overall observation notes</label>
          <textarea class="form-textarea" id="do-notes" rows="3" placeholder="General notes about this observation session…"></textarea>
        </div>

        <!-- Pyramid level -->
        <div class="form-group">
          <label class="form-label" for="do-pyramid">Pyramid level</label>
          <select class="form-select" id="do-pyramid">
            <option value="foundations">Foundations</option>
            <option value="inclusion">Inclusion</option>
            <option value="innovation">Innovation</option>
          </select>
        </div>

        <!-- Copy for Hyper -->
        <div style="background:var(--color-light);border-radius:var(--radius-sm);padding:var(--space-md);margin-bottom:var(--space-lg);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm);">
            <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">Copy for Hyper</p>
            <button id="do-copy-hyper" type="button" class="btn btn--ghost btn--sm">Copy Hyper summary</button>
          </div>
          <div id="do-hyper-preview" style="font-size:var(--text-xs);color:var(--color-muted);font-style:italic;">Select Hyper focus themes above to generate a summary for pasting into Hyper.</div>
        </div>

        <p id="do-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>

        <div class="btn-row">
          <button id="do-save" type="button" class="btn btn--primary">Save & Review AFI Drafts</button>
          <button id="do-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- AFI Review Panel -->
    <div id="afi-review-panel" style="
      display:none;position:fixed;top:0;right:0;bottom:0;width:420px;
      background:var(--color-white);box-shadow:-4px 0 24px rgba(0,0,0,0.12);
      z-index:700;overflow-y:auto;padding:var(--space-xl);
    " role="complementary" aria-label="AFI draft review">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
        <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);">Drafted AFIs — please review</h2>
        <button id="afi-panel-close" type="button" aria-label="Close AFI review panel" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-lg);">Review each draft below. Confirm, edit, or discard. Only confirmed AFIs will be saved.</p>
      <div id="afi-draft-list"></div>
      <div class="btn-row" style="margin-top:var(--space-lg);">
        <button id="afi-save-confirmed" type="button" class="btn btn--primary">Save confirmed AFIs</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // Populate fields
  _doPopulateAreas();
  _doPopulateStaffList();
  document.getElementById('do-date').value = prefillData.date || todayISO();
  if (prefillData.areaCode) document.getElementById('do-area').value = prefillData.areaCode;

  // Pre-check prefill LRA themes
  if (prefillData.prefillLRA) {
    prefillData.prefillLRA.forEach(id => {
      const cb = document.getElementById(`do-theme-${id}`);
      if (cb) { cb.checked = true; _doRevealThemeDetail(id); }
    });
  }

  // Wire Hyper checkboxes visual
  HYPER_FOCUS.forEach(f => {
    document.getElementById(`do-hyper-${f.id}`)?.addEventListener('change', () => _doUpdateHyperStyle(f.id));
    _doUpdateHyperStyle(f.id); // set initial state
  });

  // Wire theme checkboxes
  LRA_TAXONOMY.forEach(cat => {
    cat.themes.forEach(theme => {
      document.getElementById(`do-theme-${theme.id}`)?.addEventListener('change', e => {
        if (e.target.checked) _doRevealThemeDetail(theme.id);
        else _doHideThemeDetail(theme.id);
        _doUpdateCatCount(cat.id, cat.themes);
        _doUpdateHyperPreview();
      });
    });
  });

  // Wire copy Hyper button
  document.getElementById('do-copy-hyper')?.addEventListener('click', () => {
    const text = document.getElementById('do-hyper-preview').textContent;
    navigator.clipboard?.writeText(text).then(() => {
      if (typeof UI !== 'undefined') UI.showToast('success', 'Copied to clipboard');
    });
  });

  // Wire save and cancel
  document.getElementById('do-save')?.addEventListener('click', _saveDevObs);
  document.getElementById('do-cancel')?.addEventListener('click', () => document.getElementById('devobs-modal')?.remove());
  document.getElementById('devobs-close')?.addEventListener('click', () => document.getElementById('devobs-modal')?.remove());

  // Wire overlay click
  document.getElementById('devobs-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('devobs-modal')) document.getElementById('devobs-modal')?.remove();
  });

  // AFI panel close
  document.getElementById('afi-panel-close')?.addEventListener('click', _closeAFIPanel);

  document.getElementById('do-area')?.focus();
}

function _doRevealThemeDetail(themeId) {
  const detail = document.getElementById(`do-theme-detail-${themeId}`);
  const block  = document.getElementById(`do-theme-block-${themeId}`);
  const qEl    = document.getElementById(`do-theme-questions-${themeId}`);
  if (detail) detail.style.display = 'block';
  if (block)  { block.style.background = 'var(--color-light)'; block.style.borderColor = 'var(--color-border)'; }
  // Surface heuristic questions
  if (qEl) {
    const rules = getQuestionsForTheme(themeId);
    const questions = rules.flatMap(r => r.followUpQuestions).slice(0, 3);
    qEl.innerHTML = questions.map(q => `<p style="margin-bottom:4px;">• ${_doEsc(q)}</p>`).join('');
  }
}

function _doHideThemeDetail(themeId) {
  const detail = document.getElementById(`do-theme-detail-${themeId}`);
  const block  = document.getElementById(`do-theme-block-${themeId}`);
  if (detail) detail.style.display = 'none';
  if (block)  { block.style.background = ''; block.style.borderColor = 'transparent'; }
}

function _doUpdateCatCount(catId, themes) {
  const count = themes.filter(t => document.getElementById(`do-theme-${t.id}`)?.checked).length;
  const el    = document.getElementById(`do-cat-count-${catId}`);
  if (el) el.textContent = count > 0 ? `${count} selected` : '';
}

function _doUpdateHyperStyle(fId) {
  const cb  = document.getElementById(`do-hyper-${fId}`);
  const lbl = document.getElementById(`do-hyper-label-${fId}`);
  if (!cb || !lbl) return;
  lbl.style.background = cb.checked ? 'var(--color-teal)' : 'var(--color-white)';
  lbl.style.color      = cb.checked ? 'var(--color-white)' : 'var(--color-teal)';
  _doUpdateHyperPreview();
}

function _doUpdateHyperPreview() {
  const preview = document.getElementById('do-hyper-preview');
  if (!preview) return;
  const selected = HYPER_FOCUS.filter(f => document.getElementById(`do-hyper-${f.id}`)?.checked);
  const checked  = LRA_TAXONOMY.flatMap(c => c.themes).filter(t => document.getElementById(`do-theme-${t.id}`)?.checked);
  if (selected.length === 0 && checked.length === 0) {
    preview.textContent = 'Select themes above to generate a summary for Hyper.';
    return;
  }
  const lines = [];
  selected.forEach(f => {
    const sevEl = document.querySelector(`input[name="do-sev-${f.id}"]:checked`);
    const note  = document.getElementById(`do-theme-note-${f.id}`)?.value.trim() || '';
    lines.push(`${f.label}: ${sevEl ? sevEl.value : 'observed'}${note ? ' — ' + note : ''}`);
  });
  preview.textContent = lines.join('\n') || 'Hyper summary will appear here.';
}

function _saveDevObs() {
  const areaCode  = document.getElementById('do-area').value;
  const staffName = document.getElementById('do-staff').value.trim();
  const date      = document.getElementById('do-date').value;

  if (!areaCode) { _doShowError('Please select an area.'); return; }
  if (!date)     { _doShowError('Please enter a date.'); return; }

  const hyperThemes = HYPER_FOCUS.filter(f => document.getElementById(`do-hyper-${f.id}`)?.checked).map(f => f.id);
  const selectedThemes = LRA_TAXONOMY.flatMap(c => c.themes).filter(t => document.getElementById(`do-theme-${t.id}`)?.checked);

  const sharedId = generateId();

  // Build AFI drafts from selected themes with severity
  const afiDrafts = [];
  selectedThemes.forEach(theme => {
    const sevEl = document.querySelector(`input[name="do-sev-${theme.id}"]:checked`);
    if (sevEl) {
      const note  = document.getElementById(`do-theme-note-${theme.id}`)?.value.trim() || '';
      const draft = draftAFI(theme.id, sevEl.value, areaCode);
      if (draft) {
        if (note) draft.description = note;
        draft.parentObservationId = sharedId;
        // Auto-set hyperThemeMatch
        if (HYPER_FOCUS.find(h => h.id === theme.id)) draft.hyperThemeMatch = theme.id;
        afiDrafts.push(draft);
      }
    }
  });

  // Store pending save data on window for AFI review panel
  window._devObsPending = { areaCode, staffName, date, hyperThemes, selectedThemes, sharedId, afiDrafts,
    notes: document.getElementById('do-notes').value.trim(),
    pyramid: document.getElementById('do-pyramid').value || 'foundations' };

  // Show AFI review panel
  _showAFIReviewPanel(afiDrafts);
}

function _showAFIReviewPanel(drafts) {
  const panel = document.getElementById('afi-review-panel');
  const list  = document.getElementById('afi-draft-list');
  if (!panel || !list) return;

  if (drafts.length === 0) {
    // No AFI drafts — save directly
    _commitDevObs([]);
    return;
  }

  list.innerHTML = drafts.map((draft, i) => `
    <div id="afi-draft-${i}" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm);">
        <span style="font-size:var(--text-xs);font-weight:bold;padding:2px 10px;border-radius:999px;background:${draft.severity===AFI_SEVERITY.IMMEDIATE?'var(--color-red-lt)':draft.severity===AFI_SEVERITY.STRENGTHEN?'var(--color-amber-lt)':'var(--color-green-lt)'};color:${draft.severity===AFI_SEVERITY.IMMEDIATE?'var(--color-red)':draft.severity===AFI_SEVERITY.STRENGTHEN?'var(--color-amber)':'var(--color-green)'};">${_doEsc(draft.severity)}</span>
        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_doEsc(draft.lraThemeLabel)}</span>
      </div>
      <textarea id="afi-draft-desc-${i}" rows="3" style="width:100%;padding:var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;resize:vertical;margin-bottom:var(--space-sm);">${_doEsc(draft.description)}</textarea>
      ${draft.digitalOpportunity ? `
        <div style="background:var(--color-teal-lt);border-radius:var(--radius-sm);padding:var(--space-sm);font-size:var(--text-xs);color:var(--color-teal);margin-bottom:var(--space-sm);">
          <strong>Digital opportunity:</strong> ${_doEsc(draft.digitalOpportunity)}
        </div>` : ''}
      <div style="display:flex;gap:var(--space-sm);">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:var(--text-sm);">
          <input type="checkbox" id="afi-confirm-${i}" checked style="width:16px;height:16px;accent-color:var(--color-teal);">
          Confirm this AFI
        </label>
      </div>
    </div>`).join('');

  panel.style.display = 'block';

  document.getElementById('afi-save-confirmed')?.addEventListener('click', () => {
    const confirmed = drafts.map((draft, i) => {
      if (!document.getElementById(`afi-confirm-${i}`)?.checked) return null;
      const desc = document.getElementById(`afi-draft-desc-${i}`)?.value.trim();
      return { ...draft, description: desc || draft.description };
    }).filter(Boolean);
    _commitDevObs(confirmed);
  });
}

function _closeAFIPanel() {
  document.getElementById('afi-review-panel').style.display = 'none';
}

function _commitDevObs(confirmedAFIs) {
  const p = window._devObsPending;
  if (!p) return;

  const area = _getArea(p.areaCode);
  if (!area) return;

  // Handle staff profile creation
  let staffId = null;
  if (p.staffName) {
    const existing = (window.DPC_DATA.staff.staff || []).find(s =>
      s.name.toLowerCase() === p.staffName.toLowerCase() && s.areaCode === p.areaCode
    );
    if (existing) {
      staffId = existing.staffId;
    } else {
      // Create new staff profile stub
      staffId = generateId();
      const newProfile = {
        staffId, name: p.staffName, areaCode: p.areaCode, role: '',
        entryPathway: 'devobs', entryDate: p.date, etfStage: null,
        developmentPriorities: ['', '', ''], confidenceRating: null,
        touchHistory: [], reflectionRefs: [], afiRefs: [],
        isAnonymousAtAreaLevel: true, createdAt: nowISO(), lastUpdated: nowISO(),
      };
      if (!window.DPC_DATA.staff.staff) window.DPC_DATA.staff.staff = [];
      window.DPC_DATA.staff.staff.push(newProfile);
      saveStaff(newProfile);
      if (typeof UI !== 'undefined') UI.showToast('info', `Staff profile created for ${p.staffName}`);
    }
    // Add to area staffRefs
    if (!area.staffRefs) area.staffRefs = [];
    if (!area.staffRefs.includes(staffId)) area.staffRefs.push(staffId);
  }

  const activity = {
    activityId:      p.sharedId,
    activityType:    ACTIVITY_TYPE.DEVOBS,
    date:            p.date,
    areaCode:        p.areaCode,
    staffIds:        staffId ? [staffId] : [],
    lraThemeIds:     p.selectedThemes.map(t => t.id),
    hyperThemes:     p.hyperThemes,
    pyramidLevel:    p.pyramid,
    summary:         p.notes || `DevObs — ${p.areaCode}${p.staffName ? ' — ' + p.staffName : ''}`,
    afiIdsGenerated: confirmedAFIs.map(a => a.afiId),
    sharedId:        p.sharedId,
    qipRef:          null,
    createdAt:       nowISO(),
  };

  if (!area.activityLog) area.activityLog = [];
  area.activityLog.push(activity);
  if (!area.afiRefs) area.afiRefs = [];

  // Save confirmed AFIs
  const allAFIs = window.DPC_DATA.afi.afis || [];
  confirmedAFIs.forEach(afi => {
    afi.staffId = staffId;
    allAFIs.push(afi);
    area.afiRefs.push(afi.afiId);
  });
  window.DPC_DATA.afi.afis = allAFIs;
  area.lastUpdated = nowISO();
  saveArea(area);
  if (confirmedAFIs.length > 0) saveAFI(confirmedAFIs[0]); // triggers write

  // Cleanup
  _closeAFIPanel();
  document.getElementById('devobs-modal')?.remove();
  window._devObsPending = null;

  if (typeof UI !== 'undefined') {
    UI.showToast('success', `DevObs saved — ${p.areaCode}. ${confirmedAFIs.length} AFI${confirmedAFIs.length!==1?'s':''} confirmed.`);
  }

  if (document.getElementById('devobs-recent-list')) _renderRecentDevObs();
}

function _renderRecentDevObs() {
  const list = document.getElementById('devobs-recent-list');
  if (!list) return;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  const all = [];
  areas.forEach(area => {
    (area.activityLog || []).forEach(a => {
      if (a.activityType === ACTIVITY_TYPE.DEVOBS) all.push({ ...a, areaName: area.areaName });
    });
  });
  all.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const recent = all.slice(0, 8);
  if (recent.length === 0) {
    list.innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">No DevObs logged yet.</p>';
    return;
  }
  list.innerHTML = recent.map(d => `
    <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
      <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:70px;padding-top:2px;">${_doFmtDate(d.date)}</span>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_doEsc(d.areaCode)} — ${_doEsc(d.areaName||'')}</span>
          ${(d.hyperThemes||[]).map(h=>`<span style="font-size:10px;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;font-weight:bold;">${h}</span>`).join('')}
          ${d.afiIdsGenerated&&d.afiIdsGenerated.length>0?`<span style="font-size:10px;background:var(--color-amber-lt);color:var(--color-amber);padding:1px 8px;border-radius:999px;font-weight:bold;">${d.afiIdsGenerated.length} AFI${d.afiIdsGenerated.length!==1?'s':''}</span>`:''}
        </div>
        <p style="font-size:var(--text-xs);color:var(--color-muted);">${_doEsc(d.summary||'')}</p>
      </div>
    </div>`).join('');
}

function _doPopulateAreas() {
  const sel = document.getElementById('do-area');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.sort((a,b)=>a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

function _doPopulateStaffList() {
  const dl = document.getElementById('do-staff-list');
  if (!dl) return;
  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  staff.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    dl.appendChild(opt);
  });
}

function _doShowError(msg) {
  const el = document.getElementById('do-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _doFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
  catch { return iso; }
}

function _doEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
