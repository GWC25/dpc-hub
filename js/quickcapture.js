// DPC Hub · js/quickcapture.js · v1.0 · July 2026
// Quick Capture module. Floating FAB opens a modal for fast activity logging.
// Logs to area activityLog[] via saveArea(). Called from app.js initQuickCapture().

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
              <option value="devobs">Development Observation (DevObs)</option>
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
            </optgroup>
          </select>
        </div>

        <!-- Area -->
        <div class="form-group">
          <label class="form-label" for="qc-area">Area</label>
          <select class="form-select" id="qc-area" name="qc-area" aria-required="true">
            <option value="">— Select area —</option>
          </select>
        </div>

        <!-- Date -->
        <div class="form-group">
          <label class="form-label" for="qc-date">Date</label>
          <input class="form-input" type="date" id="qc-date" name="qc-date" aria-required="true">
        </div>

        <!-- Hyper focus tags (prominent — college priority) -->
        <div class="form-group">
          <fieldset style="border:1px solid var(--color-teal);border-radius:var(--radius-sm);padding:var(--space-md);">
            <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-teal);padding:0 var(--space-xs);">College priority focus areas (Hyper)</legend>
            <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;margin-top:var(--space-xs);">
              ${HYPER_FOCUS.map(f => `
                <label style="display:flex;align-items:center;gap:var(--space-xs);cursor:pointer;padding:var(--space-xs) var(--space-sm);border:2px solid var(--color-teal);border-radius:999px;font-size:var(--text-sm);transition:all 150ms ease;" id="qc-hyper-label-${f.id}">
                  <input type="checkbox" name="qc-hyper" value="${f.id}" id="qc-hyper-${f.id}" style="width:16px;height:16px;accent-color:var(--color-teal);">
                  ${_escHtml(f.label)}
                </label>`).join('')}
            </div>
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

  // Hyper checkbox visual feedback
  HYPER_FOCUS.forEach(f => {
    document.getElementById(`qc-hyper-${f.id}`)?.addEventListener('change', e => {
      const lbl = document.getElementById(`qc-hyper-label-${f.id}`);
      if (lbl) {
        lbl.style.background = e.target.checked ? 'var(--color-teal)' : 'transparent';
        lbl.style.color      = e.target.checked ? 'var(--color-white)' : 'var(--color-teal)';
      }
    });
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

  if (!areaCode) { _showQCError('Please select an area.'); document.getElementById('qc-area').focus(); return; }
  if (!date)     { _showQCError('Please enter a date.'); document.getElementById('qc-date').focus(); return; }

  // Collect Hyper themes
  const hyperThemes = HYPER_FOCUS
    .filter(f => document.getElementById(`qc-hyper-${f.id}`)?.checked)
    .map(f => f.id);

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
    summary:      summary || `${type} — ${areaCode}`,
    afiIdsGenerated: [],
    sharedId:     null,
    qipRef:       document.getElementById('qc-qip').value.trim() || null,
    createdAt:    nowISO(),
  };

  // Write to area record
  const area = _getArea(areaCode);
  if (!area) { _showQCError('Area not found — please try again.'); return; }

  if (!area.activityLog) area.activityLog = [];
  area.activityLog.push(activity);
  area.lastUpdated = nowISO();
  saveArea(area);

  _closeQC();

  // Show confirmation toast
  if (typeof UI !== 'undefined' && UI.showToast) {
    UI.showToast('success', `Activity logged: ${type} — ${areaCode}`);
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
  // Clear existing options beyond first
  while (sel.options.length > 1) sel.remove(1);
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.sort((a,b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
