// DPC Hub · js/settings.js · v1.0 · 31/07/26 · Session 34
// Settings tab. Two independent things live here:
//
// 1. Connection status + manual Reconnect — the visible half of the
//    Session 34 connection-persistence fix (the silent half,
//    tryReconnectSilently(), lives in data.js and runs on every load
//    before this tab is ever opened). This gives Graeme a way to *see*
//    whether the silent reconnect actually worked today, and a manual
//    escape hatch if it didn't (permission genuinely revoked, folder
//    moved, switching machines, etc).
//
// 2. Display preferences — adapted from The Learning Studio's
//    assets/js/settings.js (21/07/26 v1), which Graeme supplied directly.
//    Same eight preferences, same localStorage-only storage discipline,
//    same hard constraint: no personal data, no identifiers, no cookies,
//    no network transmission — these eight string values are the only
//    thing ever written to storage. Adapted from an overlay/modal pattern
//    to render directly in this tab's body (DPC Hub has no site-wide
//    settings trigger button the way Learning Studio's page header does —
//    this tab IS the trigger), and from Learning Studio's own CSS class
//    names to DPC Hub's actual token set in css/design.css (Session 34
//    addition — see the theme block at the end of that file).

const DPC_SETTINGS_KEYS = {
  scheme:        'dpc-scheme',
  font:          'dpc-font',
  textSize:      'dpc-text-size',
  lineSpacing:   'dpc-line-spacing',
  letterSpacing: 'dpc-letter-spacing',
  motion:        'dpc-reduced-motion',
  focus:         'dpc-enhanced-focus',
  underline:     'dpc-underline-links',
};

const DPC_SETTINGS_DEFAULTS = {
  scheme: 'default', font: 'default', textSize: '17', lineSpacing: '1.75',
  letterSpacing: '0', motion: 'off', focus: 'off', underline: 'off',
};

const DPC_SCHEME_CLASS = { default: '', dark: 'theme-dark', 'high-contrast': 'theme-high-contrast' };
const DPC_FONT_CLASS   = { default: '', dyslexia: 'font-dyslexia', serif: 'font-serif', mono: 'font-mono' };

function initSettings() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-lg);">Settings</h1>

    <!-- Connection status -->
    <section style="margin-bottom:var(--space-2xl);padding:var(--space-lg);border:1px solid var(--color-border);border-radius:var(--radius-lg);">
      <h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">OneDrive connection</h2>
      <div id="dpc-conn-status" style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md);">
        <span id="dpc-conn-dot" style="width:12px;height:12px;border-radius:50%;flex-shrink:0;"></span>
        <span id="dpc-conn-label" style="font-size:var(--text-sm);color:var(--color-slate);"></span>
      </div>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">DPC Hub checks silently on every load whether it still has permission to your OneDrive data folder. If that check fails — permission revoked, folder moved, or a different machine — reconnect manually below.</p>
      <button id="dpc-reconnect-btn" type="button" class="btn btn--primary btn--sm">Reconnect to OneDrive folder</button>
    </section>

    <!-- Area Management -->
    <section style="margin-bottom:var(--space-2xl);padding:var(--space-lg);border:1px solid var(--color-border);border-radius:var(--radius-lg);">
      <h2 style="font-size:var(--text-lg);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">Area management</h2>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">
        Renaming an area's code updates every staff record, AFI, Health Check, resource share, CPD entry and calendar entry
        already linked to it — nothing gets orphaned. Archiving hides an area from selection lists without deleting its history.
      </p>
      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md);">
        <button id="dpc-area-add-btn" type="button" class="btn btn--primary btn--sm">+ Add area</button>
        <button id="dpc-area-bulk-btn" type="button" class="btn btn--ghost btn--sm">Bulk add areas</button>
        <button id="dpc-sel-consolidate-btn" type="button" class="btn btn--ghost btn--sm" style="display:none;">Consolidate FAU/FCO/FEH/FPL into SEL</button>
      </div>
      <div id="dpc-area-bulk-panel" style="display:none;"></div>
      <div id="dpc-area-list"></div>
    </section>

    <!-- Display preferences -->
    <section>
      <h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-xs);">Display preferences</h2>
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-lg);">Saved to your device only — never sent anywhere, no account needed.</p>
      <p id="dpc-settings-status" class="visually-hidden" role="status" aria-live="polite"></p>

      <div style="margin-bottom:var(--space-lg);">
        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);display:block;margin-bottom:var(--space-sm);" id="dpc-scheme-label">Colour scheme</span>
        <div role="group" aria-labelledby="dpc-scheme-label" style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="scheme" data-value="default" aria-pressed="true">Default</button>
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="scheme" data-value="dark" aria-pressed="false">Dark</button>
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="scheme" data-value="high-contrast" aria-pressed="false">High contrast</button>
        </div>
      </div>

      <div style="margin-bottom:var(--space-lg);">
        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);display:block;margin-bottom:var(--space-sm);" id="dpc-font-label">Font</span>
        <div role="group" aria-labelledby="dpc-font-label" style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="font" data-value="default" aria-pressed="true">Default</button>
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="font" data-value="dyslexia" aria-pressed="false">Dyslexia-friendly</button>
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="font" data-value="serif" aria-pressed="false">Serif</button>
          <button type="button" class="btn btn--ghost btn--sm dpc-setting-choice" data-setting="font" data-value="mono" aria-pressed="false">Monospace</button>
        </div>
      </div>

      <div style="margin-bottom:var(--space-lg);max-width:420px;">
        <label style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);display:block;margin-bottom:var(--space-sm);" for="dpc-text-size-range">Text size</label>
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <span aria-hidden="true" style="font-size:12px;">A</span>
          <input type="range" id="dpc-text-size-range" min="14" max="24" step="1" value="17" style="flex:1;">
          <span aria-hidden="true" style="font-size:20px;">A</span>
          <span id="dpc-text-size-value" style="font-size:var(--text-xs);color:var(--color-muted);min-width:44px;">17px</span>
        </div>
      </div>

      <div style="margin-bottom:var(--space-lg);max-width:420px;">
        <label style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);display:block;margin-bottom:var(--space-sm);" for="dpc-line-spacing-range">Line spacing</label>
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <input type="range" id="dpc-line-spacing-range" min="1.2" max="2.2" step="0.05" value="1.75" style="flex:1;">
          <span id="dpc-line-spacing-value" style="font-size:var(--text-xs);color:var(--color-muted);min-width:44px;">1.75</span>
        </div>
      </div>

      <div style="margin-bottom:var(--space-lg);max-width:420px;">
        <label style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);display:block;margin-bottom:var(--space-sm);" for="dpc-letter-spacing-range">Letter spacing</label>
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <input type="range" id="dpc-letter-spacing-range" min="0" max="0.12" step="0.01" value="0" style="flex:1;">
          <span id="dpc-letter-spacing-value" style="font-size:var(--text-xs);color:var(--color-muted);min-width:44px;">0.00em</span>
        </div>
      </div>

      <div style="margin-bottom:var(--space-lg);">
        <div style="display:flex;align-items:center;justify-content:space-between;max-width:420px;padding:var(--space-sm) 0;">
          <label for="dpc-toggle-motion" style="font-size:var(--text-sm);color:var(--color-slate);">Reduce motion</label>
          <input type="checkbox" id="dpc-toggle-motion">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;max-width:420px;padding:var(--space-sm) 0;">
          <label for="dpc-toggle-focus" style="font-size:var(--text-sm);color:var(--color-slate);">Enhanced focus outlines</label>
          <input type="checkbox" id="dpc-toggle-focus">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;max-width:420px;padding:var(--space-sm) 0;">
          <label for="dpc-toggle-underline" style="font-size:var(--text-sm);color:var(--color-slate);">Underline all links</label>
          <input type="checkbox" id="dpc-toggle-underline">
        </div>
      </div>

      <button id="dpc-settings-reset" type="button" class="btn btn--secondary btn--sm">Reset all to defaults</button>
    </section>
  `;

  _dpcRenderConnectionStatus();
  _dpcRenderAreaList();
  document.getElementById('dpc-area-add-btn')?.addEventListener('click', _dpcOpenAreaAddForm);
  document.getElementById('dpc-area-bulk-btn')?.addEventListener('click', _dpcOpenBulkAddPanel);
  _dpcWireSELConsolidate();
  _dpcSettingsInit();
  document.getElementById('dpc-reconnect-btn')?.addEventListener('click', async () => {
    await reconnectFolder(UI);
    _dpcRenderConnectionStatus();
    if (typeof UI !== 'undefined') UI.showToast(getConnectionStatus() === 'connected' ? 'success' : 'warning',
      getConnectionStatus() === 'connected' ? 'Reconnected to OneDrive.' : 'Still offline.');
  });
}

function _dpcRenderConnectionStatus() {
  const dot   = document.getElementById('dpc-conn-dot');
  const label = document.getElementById('dpc-conn-label');
  if (!dot || !label) return;
  const status = typeof getConnectionStatus === 'function' ? getConnectionStatus() : 'offline';
  const folderName = typeof getConnectedFolderName === 'function' ? getConnectedFolderName() : null;
  if (status === 'connected') {
    dot.style.background = 'var(--color-green)';
    label.textContent = folderName
      ? `Connected to "${folderName}" — changes are saving to OneDrive.`
      : 'Connected — changes are saving to OneDrive.';
  } else {
    dot.style.background = 'var(--color-red)';
    label.textContent = 'Offline — changes will not be saved until you reconnect.';
  }
}

// ── Area management (Session 38) ─────────────────────────────────
function _dpcRenderAreaList() {
  const container = document.getElementById('dpc-area-list');
  if (!container) return;
  const areas = typeof _getAreas === 'function' ? _getAreas(true) : []; // include archived here — this IS the management view
  container.innerHTML = '';

  areas.sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1) || a.areaCode.localeCompare(b.areaCode))
    .forEach(area => container.appendChild(_dpcRenderAreaRow(area)));
}

function _dpcRenderAreaRow(area) {
  const row = document.createElement('div');
  row.style.cssText = `padding:var(--space-sm);border:1px solid var(--color-border);border-radius:var(--radius-sm);margin-bottom:var(--space-xs);${area.archived ? 'opacity:0.5;' : ''}`;
  row.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-sm);">
      <input type="text" class="form-input dpc-area-code-input" value="${_dpcEsc(area.areaCode)}" style="width:90px;font-size:var(--text-xs);min-height:36px;" aria-label="Area code for ${_dpcEsc(area.areaName)}">
      <input type="text" class="form-input dpc-area-name-input" value="${_dpcEsc(area.areaName)}" style="flex:1;font-size:var(--text-xs);min-height:36px;" aria-label="Area name for ${_dpcEsc(area.areaCode)}">
      <button type="button" class="btn btn--ghost btn--sm dpc-area-save-btn">Save</button>
      <button type="button" class="btn btn--ghost btn--sm dpc-area-archive-btn">${area.archived ? 'Restore' : 'Archive'}</button>
      <button type="button" class="btn btn--ghost btn--sm dpc-dept-toggle-btn">Departments (${(area.departments||[]).filter(d=>!d.archived).length})</button>
    </div>
    <div class="dpc-dept-panel" style="display:none;margin:var(--space-sm) 0 0 var(--space-lg);padding-left:var(--space-md);border-left:2px solid var(--color-border);"></div>
  `;
  const codeInput = row.querySelector('.dpc-area-code-input');
  const nameInput = row.querySelector('.dpc-area-name-input');
  const originalCode = area.areaCode;

  row.querySelector('.dpc-area-save-btn').addEventListener('click', () => {
    const newCode = codeInput.value.trim().toUpperCase();
    const newName = nameInput.value.trim();
    if (!newCode || !newName) { if (typeof UI !== 'undefined') UI.showToast('error', 'Area code and name are both required.'); return; }

    if (newCode !== originalCode) {
      const existing = _getAreas(true).find(a => a.areaCode === newCode);
      if (existing) { if (typeof UI !== 'undefined') UI.showToast('error', `${newCode} is already in use by another area.`); return; }
      const result = renameAreaCode(originalCode, newCode);
      if (typeof UI !== 'undefined') UI.showToast('success', `Renamed ${originalCode} → ${newCode}. ${result.changed} record(s) updated.`);
    }
    const areaObj = _getArea(newCode !== originalCode ? newCode : originalCode);
    if (areaObj) { areaObj.areaName = newName; saveArea(areaObj); }
    _dpcRenderAreaList();
  });

  row.querySelector('.dpc-area-archive-btn').addEventListener('click', () => {
    archiveArea(area.areaCode, !area.archived);
    if (typeof UI !== 'undefined') UI.showToast('success', area.archived ? `${area.areaCode} restored.` : `${area.areaCode} archived — hidden from selection, history kept.`);
    _dpcRenderAreaList();
  });

  const deptPanel = row.querySelector('.dpc-dept-panel');
  row.querySelector('.dpc-dept-toggle-btn').addEventListener('click', () => {
    const showing = deptPanel.style.display !== 'none';
    if (showing) { deptPanel.style.display = 'none'; return; }
    deptPanel.style.display = 'block';
    _dpcRenderDeptPanel(deptPanel, area.areaCode);
  });

  return row;
}

function _dpcRenderDeptPanel(panel, areaCode) {
  const depts = typeof _getDepartments === 'function' ? _getDepartments(areaCode, true) : [];
  panel.innerHTML = `
    ${depts.map(d => `
      <div class="dpc-dept-row" data-dept-code="${_dpcEsc(d.departmentCode)}" style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;${d.archived ? 'opacity:0.5;' : ''}">
        <input type="text" class="form-input dpc-dept-code-input" value="${_dpcEsc(d.departmentCode)}" style="width:70px;font-size:10px;min-height:32px;">
        <input type="text" class="form-input dpc-dept-name-input" value="${_dpcEsc(d.departmentName)}" style="flex:1;font-size:10px;min-height:32px;">
        <button type="button" class="btn btn--ghost btn--sm dpc-dept-save-btn" style="font-size:10px;">Save</button>
        <button type="button" class="btn btn--ghost btn--sm dpc-dept-archive-btn" style="font-size:10px;">${d.archived ? 'Restore' : 'Archive'}</button>
      </div>`).join('')}
    <div style="display:flex;align-items:center;gap:var(--space-sm);margin-top:var(--space-xs);">
      <input type="text" id="dpc-new-dept-code" placeholder="Code" class="form-input" style="width:70px;font-size:10px;min-height:32px;">
      <input type="text" id="dpc-new-dept-name" placeholder="Department name" class="form-input" style="flex:1;font-size:10px;min-height:32px;">
      <button type="button" id="dpc-new-dept-save" class="btn btn--primary btn--sm" style="font-size:10px;">+ Add</button>
    </div>
  `;

  panel.querySelectorAll('.dpc-dept-row').forEach(row => {
    const originalCode = row.dataset.deptCode;
    row.querySelector('.dpc-dept-save-btn').addEventListener('click', () => {
      const newCode = row.querySelector('.dpc-dept-code-input').value.trim().toUpperCase();
      const newName = row.querySelector('.dpc-dept-name-input').value.trim();
      if (!newCode || !newName) { if (typeof UI !== 'undefined') UI.showToast('error', 'Department code and name required.'); return; }
      if (newCode !== originalCode) {
        const result = renameDepartmentCode(areaCode, originalCode, newCode);
        if (typeof UI !== 'undefined') UI.showToast('success', `Renamed department ${originalCode} → ${newCode}. ${result.changed} record(s) updated.`);
      }
      saveDepartment(areaCode, { departmentCode: newCode !== originalCode ? newCode : originalCode, departmentName: newName });
      _dpcRenderDeptPanel(panel, areaCode);
      _dpcRenderAreaList();
    });
    row.querySelector('.dpc-dept-archive-btn').addEventListener('click', () => {
      const dept = _getDepartments(areaCode, true).find(d => d.departmentCode === originalCode);
      archiveDepartment(areaCode, originalCode, !dept.archived);
      _dpcRenderDeptPanel(panel, areaCode);
      _dpcRenderAreaList();
    });
  });

  panel.querySelector('#dpc-new-dept-save').addEventListener('click', () => {
    const code = document.getElementById('dpc-new-dept-code').value.trim().toUpperCase();
    const name = document.getElementById('dpc-new-dept-name').value.trim();
    if (!code || !name) { if (typeof UI !== 'undefined') UI.showToast('error', 'Department code and name required.'); return; }
    if (_getDepartments(areaCode, true).find(d => d.departmentCode === code)) { if (typeof UI !== 'undefined') UI.showToast('error', `${code} already exists in this area.`); return; }
    saveDepartment(areaCode, { departmentCode: code, departmentName: name });
    if (typeof UI !== 'undefined') UI.showToast('success', `Added department ${code} — ${name}.`);
    _dpcRenderDeptPanel(panel, areaCode);
    _dpcRenderAreaList();
  });
}

// ── Bulk add areas (Session 40) ──────────────────────────────────
// Pre-filled with the reconciled list from Cass' structure doc cross-
// checked against the real Learning Walk schedule — not invented here.
// One line per area: "CODE, Full Name" — add " [archived]" to a line to
// import it already archived (SMX: flagged by Cass as facing redundancy,
// absent from the live walk schedule — kept for history, not active use).
// AMT's code is a best guess for the EFE/EHE -> Advanced Manufacturing
// (AMTEC) merger — not explicitly confirmed, flagged below, easy to
// correct via Area management afterwards if wrong.
const DPC_BULK_AREA_DEFAULT = `AGF, Arts, Graphics & Fashion
AMT, Advanced Manufacturing (AMTEC)
ANM, Animal Management
BUI, Building Services (Construction)
BUS, Business & Tourism
CED, Community Education
CON, Construction Trades
COU, Counselling
DCI, Digital Computing & IT
EEY, Education & Early Years
EGL, English
EMV, Engineering & Motor Vehicle
ENG, Engineering (General/Classroom-based)
ESO, ESOL
GMA, Games, Media & Animation
HAC, Health (incl Health T-level)
HBH, Hair, Beauty & Hospitality
MAT, Maths
NEE, NEET Provision and Engagement
PAP, Performance & Production (Performing Arts & Music)
PM, Project Management
PRA, Professional Apprenticeships
PRE, Employment Services (Pre-employment)
PRS, Professional Studies
PSF, Public Services (Protective Services)
QUA, Quality (internal classification)
SEL, SEND (replacing FIP)
SKB, Skills Bootcamps
SMS, Sixth Form (incl A-Levels)
SMX, SOMAX [archived]
SPO, Sport`;

function _dpcOpenBulkAddPanel() {
  const panel = document.getElementById('dpc-area-bulk-panel');
  if (!panel) return;
  const showing = panel.style.display !== 'none';
  if (showing) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="border:2px dashed var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-sm);">
        One area per line: <code>CODE, Full Name</code>. Add <code> [archived]</code> to a line to import it already archived.
        Review and edit before importing — nothing is saved until you click Import.
      </p>
      <p style="font-size:var(--text-xs);color:var(--color-amber);margin-bottom:var(--space-sm);">
        <strong>AMT</strong>'s code is a best guess for the merged Advanced Manufacturing area — confirm or rename after import.
      </p>
      <textarea id="dpc-bulk-area-text" class="form-textarea" rows="14" style="font-family:monospace;font-size:var(--text-xs);width:100%;">${_dpcEsc(DPC_BULK_AREA_DEFAULT)}</textarea>
      <p id="dpc-bulk-area-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-top:var(--space-sm);"></p>
      <div class="btn-row" style="margin-top:var(--space-sm);">
        <button id="dpc-bulk-area-import" type="button" class="btn btn--primary btn--sm">Import areas</button>
        <button id="dpc-bulk-area-cancel" type="button" class="btn btn--ghost btn--sm">Cancel</button>
      </div>
    </div>
  `;
  document.getElementById('dpc-bulk-area-cancel').addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('dpc-bulk-area-import').addEventListener('click', _dpcCommitBulkAdd);
}

function _dpcCommitBulkAdd() {
  const text = document.getElementById('dpc-bulk-area-text').value;
  const errEl = document.getElementById('dpc-bulk-area-error');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const existing = new Set(_getAreas(true).map(a => a.areaCode));
  const toAdd = [];
  const skipped = [];

  lines.forEach(line => {
    const archived = /\[archived\]\s*$/i.test(line);
    const cleanLine = line.replace(/\[archived\]\s*$/i, '').trim();
    const commaIdx = cleanLine.indexOf(',');
    if (commaIdx === -1) { skipped.push(line); return; }
    const code = cleanLine.slice(0, commaIdx).trim().toUpperCase();
    const name = cleanLine.slice(commaIdx + 1).trim();
    if (!code || !name) { skipped.push(line); return; }
    if (existing.has(code)) { skipped.push(`${line} (code already exists)`); return; }
    toAdd.push({ code, name, archived });
    existing.add(code); // guard against duplicate codes within the pasted list itself
  });

  if (toAdd.length === 0) {
    errEl.textContent = skipped.length > 0 ? `Nothing to import — all ${skipped.length} line(s) were invalid or already exist.` : 'No valid lines found.';
    errEl.style.display = 'block';
    return;
  }

  toAdd.forEach(({ code, name, archived }) => {
    saveArea({ areaCode: code, areaName: name, campus: '', hoaName: '', digitalLeadId: null, pyramidLevel: 'foundations',
      ragDimensions: {}, healthChecks: [], activityLog: [], afiRefs: [], actionPoints: [], staffRefs: [], notes: '',
      archived: archived || false });
  });

  // Departments already confirmed in conversation — seeded automatically
  // for the two areas we know are multi-department, so they're not an
  // extra manual step. Only runs if those exact areas were part of this
  // import (checking toAdd, not assuming) — harmless no-op otherwise.
  if (toAdd.some(a => a.code === 'PAP')) {
    saveDepartment('PAP', { departmentCode: 'PA', departmentName: 'Performing Arts' });
    saveDepartment('PAP', { departmentCode: 'MUS', departmentName: 'Music' });
  }
  if (toAdd.some(a => a.code === 'SEL')) {
    saveDepartment('SEL', { departmentCode: 'TRAN', departmentName: 'Transition Programmes' });
    saveDepartment('SEL', { departmentCode: 'SPEC', departmentName: 'Specialist Provision' });
    saveDepartment('SEL', { departmentCode: 'EMPL', departmentName: 'Supported Employment' });
    saveDepartment('SEL', { departmentCode: 'PREP', departmentName: 'Prep for Life' });
  }

  errEl.style.display = 'none';
  document.getElementById('dpc-area-bulk-panel').style.display = 'none';
  _dpcRenderAreaList();
  if (typeof UI !== 'undefined') {
    UI.showToast('success', `Imported ${toAdd.length} area(s).${skipped.length > 0 ? ` ${skipped.length} line(s) skipped.` : ''}`);
  }
  if (skipped.length > 0) console.warn('Bulk area import — skipped lines:', skipped);
}

function _dpcOpenAreaAddForm() {
  const container = document.getElementById('dpc-area-list');
  if (!container || document.getElementById('dpc-area-new-row')) return;
  const row = document.createElement('div');
  row.id = 'dpc-area-new-row';
  row.style.cssText = 'display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm);border:2px dashed var(--color-teal);border-radius:var(--radius-sm);margin-bottom:var(--space-md);';
  row.innerHTML = `
    <input type="text" id="dpc-new-area-code" class="form-input" placeholder="Code" style="width:90px;font-size:var(--text-xs);min-height:36px;">
    <input type="text" id="dpc-new-area-name" class="form-input" placeholder="Area name" style="flex:1;font-size:var(--text-xs);min-height:36px;">
    <button type="button" id="dpc-new-area-save" class="btn btn--primary btn--sm">Add</button>
    <button type="button" id="dpc-new-area-cancel" class="btn btn--ghost btn--sm">Cancel</button>
  `;
  container.prepend(row);
  document.getElementById('dpc-new-area-code').focus();

  document.getElementById('dpc-new-area-cancel').addEventListener('click', () => row.remove());
  document.getElementById('dpc-new-area-save').addEventListener('click', () => {
    const code = document.getElementById('dpc-new-area-code').value.trim().toUpperCase();
    const name = document.getElementById('dpc-new-area-name').value.trim();
    if (!code || !name) { if (typeof UI !== 'undefined') UI.showToast('error', 'Area code and name are both required.'); return; }
    if (_getAreas(true).find(a => a.areaCode === code)) { if (typeof UI !== 'undefined') UI.showToast('error', `${code} already exists.`); return; }
    saveArea({ areaCode: code, areaName: name, campus: '', hoaName: '', digitalLeadId: null, pyramidLevel: 'foundations',
      ragDimensions: {}, healthChecks: [], activityLog: [], afiRefs: [], actionPoints: [], staffRefs: [], notes: '' });
    if (typeof UI !== 'undefined') UI.showToast('success', `Added ${code} — ${name}.`);
    _dpcRenderAreaList();
  });
}

function _dpcEsc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Display preferences (adapted from Learning Studio settings.js) ──
function _dpcSafeGet(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v === null ? fallback : v; }
  catch { return fallback; }
}
function _dpcSafeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* persists for this view only */ }
}
function _dpcSafeRemove(key) {
  try { window.localStorage.removeItem(key); } catch { /* no-op */ }
}
function _dpcAnnounce(message) {
  const status = document.getElementById('dpc-settings-status');
  if (status) status.textContent = message;
}

function _dpcApplyScheme(value, announce) {
  Object.values(DPC_SCHEME_CLASS).forEach(cls => { if (cls) document.body.classList.remove(cls); });
  if (DPC_SCHEME_CLASS[value]) document.body.classList.add(DPC_SCHEME_CLASS[value]);
  document.querySelectorAll('[data-setting="scheme"]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-value') === value ? 'true' : 'false');
  });
  if (announce) _dpcAnnounce('Colour scheme set to ' + value.replace('-', ' '));
}
function _dpcApplyFont(value, announce) {
  Object.values(DPC_FONT_CLASS).forEach(cls => { if (cls) document.body.classList.remove(cls); });
  if (DPC_FONT_CLASS[value]) document.body.classList.add(DPC_FONT_CLASS[value]);
  document.querySelectorAll('[data-setting="font"]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-value') === value ? 'true' : 'false');
  });
  if (announce) _dpcAnnounce('Font set to ' + value);
}
function _dpcApplyTextSize(value, announce) {
  // DPC Hub sets font-size via var(--text-sm) etc. inline almost everywhere,
  // rather than inheriting from body — a flat "body { font-size: 17px }"
  // override (Learning Studio's approach) would barely be visible here.
  // Setting a scale factor and redefining the --text-* tokens themselves
  // (see css/design.css Session 34 block) actually reaches the whole app.
  // 17px is the default/baseline (scale 1.0), matching the slider default.
  const scale = (parseFloat(value) || 17) / 17;
  document.body.style.setProperty('--dpc-text-scale', scale.toFixed(4));
  const display = document.getElementById('dpc-text-size-value');
  if (display) display.textContent = value + 'px';
  const input = document.getElementById('dpc-text-size-range');
  if (input && input.value !== value) input.value = value;
  if (announce) _dpcAnnounce('Text size set to ' + value + ' pixels');
}
function _dpcApplyLineSpacing(value, announce) {
  document.body.style.setProperty('--user-line-height', value);
  const display = document.getElementById('dpc-line-spacing-value');
  if (display) display.textContent = parseFloat(value).toFixed(2);
  const input = document.getElementById('dpc-line-spacing-range');
  if (input && input.value !== value) input.value = value;
  if (announce) _dpcAnnounce('Line spacing set to ' + parseFloat(value).toFixed(2));
}
function _dpcApplyLetterSpacing(value, announce) {
  document.body.style.setProperty('--user-letter-spacing', value + 'em');
  const display = document.getElementById('dpc-letter-spacing-value');
  if (display) display.textContent = parseFloat(value).toFixed(2) + 'em';
  const input = document.getElementById('dpc-letter-spacing-range');
  if (input && input.value !== value) input.value = value;
  if (announce) _dpcAnnounce('Letter spacing set to ' + parseFloat(value).toFixed(2) + ' em');
}
function _dpcApplyMotion(state, announce) {
  const isReduced = state === 'on';
  document.body.classList.toggle('motion-reduced', isReduced);
  const input = document.getElementById('dpc-toggle-motion');
  if (input) input.checked = isReduced;
  if (announce) _dpcAnnounce(isReduced ? 'Reduce motion on' : 'Reduce motion off');
}
function _dpcApplyFocus(state, announce) {
  const isEnhanced = state === 'on';
  document.body.classList.toggle('enhanced-focus', isEnhanced);
  const input = document.getElementById('dpc-toggle-focus');
  if (input) input.checked = isEnhanced;
  if (announce) _dpcAnnounce(isEnhanced ? 'Enhanced focus outlines on' : 'Enhanced focus outlines off');
}
function _dpcApplyUnderline(state, announce) {
  const isUnderlined = state === 'on';
  document.body.classList.toggle('underline-links', isUnderlined);
  const input = document.getElementById('dpc-toggle-underline');
  if (input) input.checked = isUnderlined;
  if (announce) _dpcAnnounce(isUnderlined ? 'Underline all links on' : 'Underline all links off');
}

function _dpcResetSettings() {
  Object.values(DPC_SETTINGS_KEYS).forEach(_dpcSafeRemove);
  _dpcApplyScheme(DPC_SETTINGS_DEFAULTS.scheme, false);
  _dpcApplyFont(DPC_SETTINGS_DEFAULTS.font, false);
  _dpcApplyTextSize(DPC_SETTINGS_DEFAULTS.textSize, false);
  _dpcApplyLineSpacing(DPC_SETTINGS_DEFAULTS.lineSpacing, false);
  _dpcApplyLetterSpacing(DPC_SETTINGS_DEFAULTS.letterSpacing, false);
  _dpcApplyMotion(DPC_SETTINGS_DEFAULTS.motion, false);
  _dpcApplyFocus(DPC_SETTINGS_DEFAULTS.focus, false);
  _dpcApplyUnderline(DPC_SETTINGS_DEFAULTS.underline, false);
  _dpcAnnounce('All settings reset to defaults');
}

// Applies saved preferences on every page load, not just when the Settings
// tab is open — called once from the bottom of this file, outside
// initSettings(), so scheme/font/etc persist across every module.
function _dpcApplyStoredPreferencesOnLoad() {
  _dpcApplyScheme(_dpcSafeGet(DPC_SETTINGS_KEYS.scheme, DPC_SETTINGS_DEFAULTS.scheme), false);
  _dpcApplyFont(_dpcSafeGet(DPC_SETTINGS_KEYS.font, DPC_SETTINGS_DEFAULTS.font), false);
  _dpcApplyTextSize(_dpcSafeGet(DPC_SETTINGS_KEYS.textSize, DPC_SETTINGS_DEFAULTS.textSize), false);
  _dpcApplyLineSpacing(_dpcSafeGet(DPC_SETTINGS_KEYS.lineSpacing, DPC_SETTINGS_DEFAULTS.lineSpacing), false);
  _dpcApplyLetterSpacing(_dpcSafeGet(DPC_SETTINGS_KEYS.letterSpacing, DPC_SETTINGS_DEFAULTS.letterSpacing), false);
  _dpcApplyMotion(_dpcSafeGet(DPC_SETTINGS_KEYS.motion, DPC_SETTINGS_DEFAULTS.motion), false);
  _dpcApplyFocus(_dpcSafeGet(DPC_SETTINGS_KEYS.focus, DPC_SETTINGS_DEFAULTS.focus), false);
  _dpcApplyUnderline(_dpcSafeGet(DPC_SETTINGS_KEYS.underline, DPC_SETTINGS_DEFAULTS.underline), false);
}

// Wires the controls when the Settings tab itself is open (values already
// applied app-wide by _dpcApplyStoredPreferencesOnLoad — this just syncs
// the visible controls to match and attaches the change listeners).
function _dpcSettingsInit() {
  _dpcApplyScheme(_dpcSafeGet(DPC_SETTINGS_KEYS.scheme, DPC_SETTINGS_DEFAULTS.scheme), false);
  _dpcApplyFont(_dpcSafeGet(DPC_SETTINGS_KEYS.font, DPC_SETTINGS_DEFAULTS.font), false);
  _dpcApplyTextSize(_dpcSafeGet(DPC_SETTINGS_KEYS.textSize, DPC_SETTINGS_DEFAULTS.textSize), false);
  _dpcApplyLineSpacing(_dpcSafeGet(DPC_SETTINGS_KEYS.lineSpacing, DPC_SETTINGS_DEFAULTS.lineSpacing), false);
  _dpcApplyLetterSpacing(_dpcSafeGet(DPC_SETTINGS_KEYS.letterSpacing, DPC_SETTINGS_DEFAULTS.letterSpacing), false);
  _dpcApplyMotion(_dpcSafeGet(DPC_SETTINGS_KEYS.motion, DPC_SETTINGS_DEFAULTS.motion), false);
  _dpcApplyFocus(_dpcSafeGet(DPC_SETTINGS_KEYS.focus, DPC_SETTINGS_DEFAULTS.focus), false);
  _dpcApplyUnderline(_dpcSafeGet(DPC_SETTINGS_KEYS.underline, DPC_SETTINGS_DEFAULTS.underline), false);

  document.querySelectorAll('[data-setting="scheme"]').forEach(btn => {
    btn.addEventListener('click', () => { const v = btn.getAttribute('data-value'); _dpcSafeSet(DPC_SETTINGS_KEYS.scheme, v); _dpcApplyScheme(v, true); });
  });
  document.querySelectorAll('[data-setting="font"]').forEach(btn => {
    btn.addEventListener('click', () => { const v = btn.getAttribute('data-value'); _dpcSafeSet(DPC_SETTINGS_KEYS.font, v); _dpcApplyFont(v, true); });
  });

  const textSizeInput = document.getElementById('dpc-text-size-range');
  textSizeInput?.addEventListener('input', () => { _dpcSafeSet(DPC_SETTINGS_KEYS.textSize, textSizeInput.value); _dpcApplyTextSize(textSizeInput.value, false); });
  textSizeInput?.addEventListener('change', () => _dpcAnnounce('Text size set to ' + textSizeInput.value + ' pixels'));

  const lineSpacingInput = document.getElementById('dpc-line-spacing-range');
  lineSpacingInput?.addEventListener('input', () => { _dpcSafeSet(DPC_SETTINGS_KEYS.lineSpacing, lineSpacingInput.value); _dpcApplyLineSpacing(lineSpacingInput.value, false); });
  lineSpacingInput?.addEventListener('change', () => _dpcAnnounce('Line spacing set to ' + parseFloat(lineSpacingInput.value).toFixed(2)));

  const letterSpacingInput = document.getElementById('dpc-letter-spacing-range');
  letterSpacingInput?.addEventListener('input', () => { _dpcSafeSet(DPC_SETTINGS_KEYS.letterSpacing, letterSpacingInput.value); _dpcApplyLetterSpacing(letterSpacingInput.value, false); });
  letterSpacingInput?.addEventListener('change', () => _dpcAnnounce('Letter spacing set to ' + parseFloat(letterSpacingInput.value).toFixed(2) + ' em'));

  const motionInput = document.getElementById('dpc-toggle-motion');
  motionInput?.addEventListener('change', () => { const v = motionInput.checked ? 'on' : 'off'; _dpcSafeSet(DPC_SETTINGS_KEYS.motion, v); _dpcApplyMotion(v, true); });

  const focusInput = document.getElementById('dpc-toggle-focus');
  focusInput?.addEventListener('change', () => { const v = focusInput.checked ? 'on' : 'off'; _dpcSafeSet(DPC_SETTINGS_KEYS.focus, v); _dpcApplyFocus(v, true); });

  const underlineInput = document.getElementById('dpc-toggle-underline');
  underlineInput?.addEventListener('change', () => { const v = underlineInput.checked ? 'on' : 'off'; _dpcSafeSet(DPC_SETTINGS_KEYS.underline, v); _dpcApplyUnderline(v, true); });

  document.getElementById('dpc-settings-reset')?.addEventListener('click', _dpcResetSettings);
}

// Apply preferences immediately on script load, app-wide — not just when
// the Settings tab is opened.
_dpcApplyStoredPreferencesOnLoad();

// ── SEND consolidation (Session 46) ──────────────────────────────
// One-off patch, not a general feature — Graeme's direct steer: SEL
// should be the single SEND area, in place of the four separate FIP
// areas an earlier session split it into. Button only shows if any of
// the four source areas actually still exist, so it disappears on its
// own once used rather than sitting there as a stale action.
function _dpcWireSELConsolidate() {
  const btn = document.getElementById('dpc-sel-consolidate-btn');
  if (!btn) return;
  const sources = ['FAU', 'FCO', 'FEH', 'FPL'].filter(code => typeof _getArea === 'function' && _getArea(code));
  if (sources.length === 0 || (typeof _getArea === 'function' && !_getArea('SEL'))) return;
  btn.style.display = 'inline-block';

  btn.addEventListener('click', () => {
    if (!confirm(`Merge ${sources.join(', ')} into SEL? Every staff member, Digital Lead and record in these areas will move to SEL. The source areas will be archived, not deleted.`)) return;
    let totalChanged = 0;
    sources.forEach(code => {
      const result = mergeAreaInto(code, 'SEL');
      totalChanged += result.changed || 0;
    });
    if (typeof UI !== 'undefined') UI.showToast('success', `Consolidated ${sources.length} area(s) into SEL. ${totalChanged} record(s) moved.`);
    _dpcRenderAreaList();
    btn.style.display = 'none';
  });
}
