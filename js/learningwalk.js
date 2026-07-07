// DPC Hub · js/learningwalk.js · v1.0 · July 2026
// Learning Walk module. Quick capture with LRA theme tagging.
// Hyper focus areas prominently surfaced. Option to escalate to DevObs.
// Writes to area activityLog[] via saveArea().

function initLearningWalk() {
  // Learning Walk is primarily accessed via Quick Capture or sidebar
  // The sidebar click renders the LW form inline
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-lg);">Learning Walk</h1>
    <p style="font-size:var(--text-base);color:var(--color-muted);margin-bottom:var(--space-xl);">Quick capture for informal observations. Use the Quick Capture button (+) from any screen, or complete a Learning Walk below.</p>
    <div id="lw-recent" style="margin-bottom:var(--space-xl);">
      <h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Recent Learning Walks</h2>
      <div id="lw-recent-list"></div>
    </div>
    <button id="lw-new-btn" type="button" class="btn btn--primary">+ New Learning Walk</button>
  `;

  _renderRecentLWs();
  document.getElementById('lw-new-btn')?.addEventListener('click', openLearningWalkModal);
}

// ── Open LW modal (also callable from other modules) ─────────
function openLearningWalkModal(prefillData) {
  // Remove any existing LW modal
  document.getElementById('lw-modal')?.remove();

  const modal = document.createElement('div');
  modal.innerHTML = `
    <div id="lw-modal" role="dialog" aria-modal="true" aria-labelledby="lw-modal-title" style="
      display:flex;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:600;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">

        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="lw-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Learning Walk</h2>
          <button id="lw-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>

        <!-- Area and date -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="lw-area">Area</label>
            <select class="form-select" id="lw-area" required aria-required="true">
              <option value="">— Select area —</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-date">Date</label>
            <input class="form-input" type="date" id="lw-date" required aria-required="true">
          </div>
        </div>

        <!-- Hyper focus areas — PROMINENT (college priority) -->
        <div class="form-group">
          <fieldset style="border:2px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);">
            <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-teal);padding:0 var(--space-sm);">College priority focus areas — Hyper 2025-26</legend>
            <div style="display:flex;flex-direction:column;gap:var(--space-sm);margin-top:var(--space-sm);">
              ${HYPER_FOCUS.map(f => `
                <div id="lw-hyper-block-${f.id}" style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-md);transition:background 150ms ease;">
                  <label style="display:flex;align-items:center;gap:var(--space-sm);cursor:pointer;margin-bottom:var(--space-sm);">
                    <input type="checkbox" id="lw-hyper-${f.id}" name="lw-hyper" value="${f.id}" style="width:18px;height:18px;accent-color:var(--color-teal);flex-shrink:0;">
                    <span style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);">${_lwEsc(f.label)}</span>
                  </label>
                  <!-- Follow-up question appears when checked -->
                  <div id="lw-hyper-q-${f.id}" style="display:none;">
                    <p id="lw-hyper-prompt-${f.id}" style="font-size:var(--text-sm);color:var(--color-teal);font-style:italic;margin-bottom:var(--space-sm);"></p>
                    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);">
                      ${[AFI_SEVERITY.STRENGTH, AFI_SEVERITY.STRENGTHEN, AFI_SEVERITY.IMMEDIATE].map(sev => `
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 12px;border:2px solid var(--color-border);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:bold;transition:all 150ms;">
                          <input type="radio" name="lw-sev-${f.id}" value="${sev}" style="width:14px;height:14px;accent-color:var(--color-teal);">
                          ${sev}
                        </label>`).join('')}
                    </div>
                    <textarea id="lw-hyper-note-${f.id}" rows="2" placeholder="Brief observation note…" style="width:100%;padding:var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);font:var(--text-sm) Arial,sans-serif;resize:vertical;"></textarea>
                  </div>
                </div>`).join('')}
            </div>
          </fieldset>
        </div>

        <!-- Additional LRA themes (optional) -->
        <div class="form-group">
          <button type="button" id="lw-lra-toggle" style="background:none;border:none;cursor:pointer;color:var(--color-slate);font-size:var(--text-sm);font-weight:bold;padding:0;display:flex;align-items:center;gap:var(--space-xs);" aria-expanded="false" aria-controls="lw-lra-panel">
            <span id="lw-lra-arrow">▶</span> Additional LRA themes (optional)
          </button>
          <div id="lw-lra-panel" style="display:none;margin-top:var(--space-md);">
            ${LRA_TAXONOMY.map(cat => `
              <div style="margin-bottom:var(--space-md);">
                <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);text-transform:uppercase;letter-spacing:0.05em;">${_lwEsc(cat.label)}</p>
                <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;">
                  ${cat.themes.map(t => `
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px var(--space-sm);border:1px solid var(--color-border);border-radius:999px;font-size:var(--text-xs);" title="${_lwEsc(t.desc)}">
                      <input type="checkbox" name="lw-lra" value="${t.id}" style="width:12px;height:12px;accent-color:var(--color-navy);">
                      ${_lwEsc(t.id)} — ${_lwEsc(t.label)}
                    </label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Overall notes -->
        <div class="form-group">
          <label class="form-label form-label--optional" for="lw-notes">Overall notes</label>
          <textarea class="form-textarea" id="lw-notes" rows="3" placeholder="General observation notes for this Learning Walk…"></textarea>
        </div>

        <!-- Pyramid level -->
        <div class="form-group">
          <label class="form-label" for="lw-pyramid">Pyramid level</label>
          <select class="form-select" id="lw-pyramid">
            <option value="foundations">Foundations</option>
            <option value="inclusion">Inclusion</option>
            <option value="innovation">Innovation</option>
          </select>
        </div>

        <p id="lw-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>

        <div class="btn-row">
          <button id="lw-save" type="button" class="btn btn--primary">Save Learning Walk</button>
          <button id="lw-escalate" type="button" class="btn btn--ghost">Escalate to DevObs →</button>
          <button id="lw-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Populate areas
  _lwPopulateAreas('lw-area');

  // Set defaults
  document.getElementById('lw-date').value = todayISO();

  // Prefill if escalating from Quick Capture
  if (prefillData) {
    if (prefillData.areaCode) document.getElementById('lw-area').value = prefillData.areaCode;
    if (prefillData.notes)    document.getElementById('lw-notes').value = prefillData.notes;
  }

  // Wire Hyper checkboxes
  HYPER_FOCUS.forEach(f => {
    const cb = document.getElementById(`lw-hyper-${f.id}`);
    cb?.addEventListener('change', () => {
      const block = document.getElementById(`lw-hyper-block-${f.id}`);
      const qPanel = document.getElementById(`lw-hyper-q-${f.id}`);
      const prompt = document.getElementById(`lw-hyper-prompt-${f.id}`);
      if (cb.checked) {
        block.style.background = 'var(--color-teal-lt)';
        block.style.borderColor = 'var(--color-teal)';
        if (qPanel) qPanel.style.display = 'block';
        // Surface first follow-up question from heuristic
        const rules = getQuestionsForTheme(f.id);
        if (rules.length > 0 && prompt) {
          prompt.textContent = rules[0].followUpQuestions[0] || '';
        }
      } else {
        block.style.background = '';
        block.style.borderColor = 'var(--color-border)';
        if (qPanel) qPanel.style.display = 'none';
      }
    });
  });

  // Wire LRA toggle
  document.getElementById('lw-lra-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('lw-lra-panel');
    const btn   = document.getElementById('lw-lra-toggle');
    const arrow = document.getElementById('lw-lra-arrow');
    const open  = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    arrow.textContent = open ? '▶' : '▼';
  });

  // Wire buttons
  document.getElementById('lw-close')?.addEventListener('click', _closeLWModal);
  document.getElementById('lw-cancel')?.addEventListener('click', _closeLWModal);
  document.getElementById('lw-save')?.addEventListener('click', () => _saveLW(false));
  document.getElementById('lw-escalate')?.addEventListener('click', () => _saveLW(true));

  // Close on overlay
  document.getElementById('lw-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('lw-modal')) _closeLWModal();
  });

  // ESC
  const escFn = e => {
    if (e.key === 'Escape') {
      _closeLWModal();
      document.removeEventListener('keydown', escFn);
    }
  };
  document.addEventListener('keydown', escFn);

  document.getElementById('lw-area')?.focus();
}

function _closeLWModal() {
  document.getElementById('lw-modal')?.remove();
}

function _saveLW(escalateToDevObs) {
  const areaCode = document.getElementById('lw-area').value;
  const date     = document.getElementById('lw-date').value;
  const notes    = document.getElementById('lw-notes').value.trim();

  if (!areaCode) { _lwShowError('Please select an area.'); return; }
  if (!date)     { _lwShowError('Please enter a date.'); return; }

  // Collect Hyper themes + per-theme data
  const hyperThemes = [];
  const afiDrafts   = [];

  HYPER_FOCUS.forEach(f => {
    if (document.getElementById(`lw-hyper-${f.id}`)?.checked) {
      hyperThemes.push(f.id);
      const sevRadio = document.querySelector(`input[name="lw-sev-${f.id}"]:checked`);
      const themeNote = document.getElementById(`lw-hyper-note-${f.id}`)?.value.trim() || '';
      if (sevRadio) {
        const draft = draftAFI(f.id, sevRadio.value, areaCode);
        if (draft) {
          draft.description = themeNote || draft.description;
          afiDrafts.push(draft);
        }
      }
    }
  });

  // Additional LRA themes
  const lraThemeIds = Array.from(document.querySelectorAll('input[name="lw-lra"]:checked'))
    .map(cb => cb.value);

  const sharedId = generateId();

  const activity = {
    activityId:      generateId(),
    activityType:    ACTIVITY_TYPE.LEARNING_WALK,
    date,
    areaCode,
    staffIds:        [],
    lraThemeIds:     [...hyperThemes, ...lraThemeIds],
    hyperThemes,
    pyramidLevel:    document.getElementById('lw-pyramid').value || 'foundations',
    summary:         notes || `Learning Walk — ${areaCode}`,
    afiIdsGenerated: afiDrafts.map(a => a.afiId),
    sharedId,
    qipRef:          null,
    createdAt:       nowISO(),
  };

  // Save activity to area
  const area = _getArea(areaCode);
  if (!area) { _lwShowError('Area not found.'); return; }
  if (!area.activityLog) area.activityLog = [];
  area.activityLog.push(activity);
  if (!area.afiRefs) area.afiRefs = [];

  // Save AFI drafts if any
  const allAFIs = window.DPC_DATA.afi.afis || [];
  afiDrafts.forEach(draft => {
    draft.parentObservationId = activity.activityId;
    allAFIs.push(draft);
    area.afiRefs.push(draft.afiId);
  });
  window.DPC_DATA.afi.afis = allAFIs;
  area.lastUpdated = nowISO();
  saveArea(area);
  saveAFI(afiDrafts[0] || { afiId: '__noop' }); // trigger AFI file write

  _closeLWModal();

  if (typeof UI !== 'undefined') {
    UI.showToast('success', `Learning Walk saved — ${areaCode}${afiDrafts.length > 0 ? `. ${afiDrafts.length} AFI draft${afiDrafts.length!==1?'s':''} created.` : ''}`);
  }

  if (escalateToDevObs) {
    setTimeout(() => openDevObsModal({ areaCode, date, sharedId, prefillLRA: [...hyperThemes, ...lraThemeIds] }), 300);
  }

  // Refresh if on LW page
  if (document.getElementById('lw-recent-list')) _renderRecentLWs();
}

function _renderRecentLWs() {
  const list = document.getElementById('lw-recent-list');
  if (!list) return;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  const allLWs = [];
  areas.forEach(area => {
    (area.activityLog || []).forEach(a => {
      if (a.activityType === ACTIVITY_TYPE.LEARNING_WALK) {
        allLWs.push({ ...a, areaName: area.areaName });
      }
    });
  });
  allLWs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const recent = allLWs.slice(0, 10);
  if (recent.length === 0) {
    list.innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">No Learning Walks logged yet.</p>';
    return;
  }
  list.innerHTML = recent.map(lw => `
    <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
      <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:70px;padding-top:2px;">${_lwFmtDate(lw.date)}</span>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_lwEsc(lw.areaCode)} — ${_lwEsc(lw.areaName||'')}</span>
          ${(lw.hyperThemes||[]).map(h => `<span style="font-size:10px;background:var(--color-teal-lt);color:var(--color-teal);padding:1px 8px;border-radius:999px;font-weight:bold;">${h}</span>`).join('')}
          ${lw.afiIdsGenerated && lw.afiIdsGenerated.length > 0 ? `<span style="font-size:10px;background:var(--color-amber-lt);color:var(--color-amber);padding:1px 8px;border-radius:999px;font-weight:bold;">${lw.afiIdsGenerated.length} AFI${lw.afiIdsGenerated.length!==1?'s':''}</span>` : ''}
        </div>
        ${lw.summary ? `<p style="font-size:var(--text-xs);color:var(--color-muted);">${_lwEsc(lw.summary)}</p>` : ''}
      </div>
    </div>`).join('');
}

function _lwPopulateAreas(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.sort((a,b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

function _lwShowError(msg) {
  const el = document.getElementById('lw-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _lwFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
  catch { return iso; }
}

function _lwEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
