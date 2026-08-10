/**
 * DPC Evidence Hub — hub.js
 * Navigation, config loading, template rendering, persistence, export
 */

let CONFIG = null;
let ENTRIES = {};
let DARK_MODE = localStorage.getItem('dpc-dark-mode') === 'true';

// ── DARK MODE ────────────────────────────────────────────────────────────────
function toggleDarkMode() {
  DARK_MODE = !DARK_MODE;
  localStorage.setItem('dpc-dark-mode', String(DARK_MODE));
  document.body.classList.toggle('dark-mode', DARK_MODE);
  const btn = document.querySelector('.dark-mode-toggle');
  if (btn) btn.textContent = DARK_MODE ? '☀️ Light mode' : '🌙 Dark mode';
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function navigateTo(sectionId, btn) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add('active');
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-current', 'page'); }
  // Reload editors when navigating to settings
  if (sectionId === 'settings') { loadAreasEditor(); loadPeopleEditor(); loadTemplateEditor(); }
}

// ── LOAD CONFIG ──────────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const res = await fetch('data/config.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONFIG = await res.json();

    document.getElementById('config-status').innerHTML = `
      <strong style="color:var(--color-success)">✓ Loaded</strong><br>
      ${CONFIG.areas?.length || 0} areas · 
      ${CONFIG.templates?.length || 0} templates · 
      ${CONFIG.commonPurposes?.length || 0} tags · 
      ${CONFIG.peopleRegistry?.length || 0} people
    `;
    loadAreas();
    showToast('Configuration loaded', 'success');
  } catch (err) {
    showToast('Config load failed: ' + err.message, 'error');
    console.error('loadConfig error:', err);
  }
}

// ── AREAS IN SETTINGS ────────────────────────────────────────────────────────
function loadAreas() {
  if (!CONFIG?.areas) return;
  const html = CONFIG.areas.map(a =>
    `<div style="padding:.4rem .6rem;background:var(--color-grey-bg);border-radius:4px;font-size:.8rem;">
       <strong>${a.code}</strong> — ${a.name}
     </div>`
  ).join('');
  document.getElementById('areas-status').innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.4rem;margin-top:.5rem;">${html}</div>`;
}

// ── LOAD TEMPLATE — renders the correct form for the selected activity ────────
function loadTemplate(templateId) {
  const container = document.getElementById('qc-form-container');
  container.innerHTML = '';

  if (!templateId) return;

  if (!CONFIG) {
    showToast('Load Config first (button in header)', 'error');
    document.getElementById('qc-activity-type').value = '';
    return;
  }

  const template = CONFIG.templates?.find(t => t.id === templateId);
  if (!template) {
    showToast(`Template "${templateId}" not found in config`, 'error');
    return;
  }

  const form = TemplateAssembler.buildForm(template, CONFIG);
  container.appendChild(form);
  // Show save-as-session button
  const sessionRow = document.getElementById('save-session-row');
  if (sessionRow) sessionRow.style.display = 'block';
  showToast(`Loaded: ${template.name}`, 'success');
}

// ── SAVE ENTRY ───────────────────────────────────────────────────────────────
function saveEntry(templateId) {
  if (!CONFIG) { showToast('Config not loaded', 'error'); return; }

  const template = CONFIG.templates?.find(t => t.id === templateId);
  if (!template) return;

  const entry = buildEntryFromForm(templateId, CONFIG);
  if (!entry) { showToast('Could not build entry', 'error'); return; }

  if (!ENTRIES[templateId]) ENTRIES[templateId] = [];
  ENTRIES[templateId].push(entry);

  const total = Object.values(ENTRIES).flat().length;
  const countEl = document.getElementById('entry-count');
  if (countEl) countEl.textContent = total;

  logEntryToEvidence(entry, template);
  showToast(`Saved: ${template.name}`, 'success');

  // Reset dropdown and clear form container
  document.getElementById('qc-activity-type').value = '';
  document.getElementById('qc-form-container').innerHTML = '';
  const sessionRowAfterSave = document.getElementById('save-session-row');
  if (sessionRowAfterSave) sessionRowAfterSave.style.display = 'none';
}

// ── EVIDENCE LOG ─────────────────────────────────────────────────────────────
function logEntryToEvidence(entry, template) {
  const container = document.getElementById('evidence-log-placeholder');
  if (container.textContent.includes('No entries')) container.innerHTML = '';

  const item = document.createElement('div');
  item.className = 'log-entry';
  item.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;">
      <strong>${template.name}</strong>
      <span style="font-family:var(--font-mono);font-size:.75rem;color:var(--color-slate);">${new Date().toLocaleString('en-GB')}</span>
    </div>
    <div style="font-size:.78rem;color:var(--color-slate);margin-top:.25rem;">ID: ${entry.id}</div>
  `;
  container.insertBefore(item, container.firstChild);
}

// ── CLEAR FORM ───────────────────────────────────────────────────────────────
function clearFormById(templateId) {
  const form = document.getElementById(`form-${templateId}`);
  if (!form) return;
  form.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], textarea, select').forEach(f => f.value = '');
  form.querySelectorAll('input[type="checkbox"]').forEach(f => f.checked = false);
  form.querySelectorAll('input[type="range"]').forEach(f => { f.value = 5; });
}

// ── EXPORT ───────────────────────────────────────────────────────────────────
function exportToJSON() {
  if (!Object.keys(ENTRIES).length) {
    showToast('No entries to export yet', 'error');
    return;
  }
  const data = {
    exportedAt: new Date().toISOString(),
    totalEntries: Object.values(ENTRIES).flat().length,
    entries: ENTRIES
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dpc-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('Export downloaded — upload to OneDrive', 'success');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding:.65rem 1rem;
    border-radius:8px;
    font-size:.82rem;
    margin-bottom:.4rem;
    color:#fff;
    box-shadow:0 4px 12px rgba(0,0,0,.2);
    background:${type === 'success' ? '#15803d' : type === 'error' ? '#b91c1c' : '#0c1f35'};
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (DARK_MODE) {
    document.body.classList.add('dark-mode');
    const btn = document.querySelector('.dark-mode-toggle');
    if (btn) btn.textContent = '☀️ Light mode';
  }
  loadConfig();
});

// ── CURRICULUM AREAS EDITOR (Settings page) ──────────────────────────────────

/**
 * Populate the areas editor table from CONFIG.areas
 */
function loadAreasEditor() {
  const tbody = document.getElementById('areas-editor-tbody');
  if (!tbody || !CONFIG?.areas) return;
  tbody.innerHTML = '';
  CONFIG.areas.forEach((area, idx) => {
    tbody.appendChild(buildAreaRow(area, idx));
  });
}

function buildAreaRow(area, idx) {
  const tr = document.createElement('tr');
  tr.className = 'area-editor-row';
  tr.dataset.idx = idx;
  tr.innerHTML = `
    <td><input type="text" class="area-code" value="${area.code || ''}" placeholder="ENG" aria-label="Area code" style="width:80px;font-family:var(--font-mono);text-transform:uppercase;"></td>
    <td><input type="text" class="area-name" value="${area.name || ''}" placeholder="Area name" aria-label="Area name" style="width:100%;"></td>
    <td><input type="text" class="area-hoa"  value="${area.hoa  || ''}" placeholder="Name" aria-label="Head of Area" style="width:100%;"></td>
    <td><input type="text" class="area-lead" value="${area.digitalLead || ''}" placeholder="Name" aria-label="Digital Lead" style="width:100%;"></td>
    <td><button type="button" class="btn btn-icon btn-sm" onclick="removeAreaRow(this)" aria-label="Remove area">✕</button></td>
  `;
  // Uppercase code as user types
  tr.querySelector('.area-code').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });
  return tr;
}

function addAreaRow() {
  const tbody = document.getElementById('areas-editor-tbody');
  if (!tbody) return;
  const idx = tbody.querySelectorAll('tr').length;
  tbody.appendChild(buildAreaRow({ code: '', name: '', hoa: '', digitalLead: '' }, idx));
}

function removeAreaRow(btn) {
  btn.closest('tr').remove();
}

/**
 * Read the editor table back into CONFIG.areas and refresh area dropdowns
 */
function saveAreasToConfig() {
  if (!CONFIG) { showToast('Load Config first', 'error'); return; }
  const rows = document.querySelectorAll('.area-editor-row');
  const areas = Array.from(rows).map(row => ({
    code:        row.querySelector('.area-code').value.trim().toUpperCase(),
    name:        row.querySelector('.area-name').value.trim(),
    hoa:         row.querySelector('.area-hoa').value.trim(),
    digitalLead: row.querySelector('.area-lead').value.trim()
  })).filter(a => a.code && a.name);

  CONFIG.areas = areas;
  showToast(`${areas.length} areas saved to app — remember to export areas.json to make permanent`, 'success');
}

/**
 * Export current areas as areas.json for committing to GitHub
 */
function downloadAreasJSON() {
  if (!CONFIG?.areas) { showToast('No areas to export', 'error'); return; }
  
  // Read from editor first to capture any unsaved edits
  saveAreasToConfig();

  const data = { areas: CONFIG.areas, note: "Edit in Settings > Curriculum Areas. Export and commit to GitHub to make permanent." };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'areas.json';
  a.click();
  showToast('areas.json downloaded — commit to GitHub repo to make permanent', 'success');
}

// ── SETTINGS TABS ─────────────────────────────────────────────────────────────

function switchSettingsTab(tabId, btn) {
  document.querySelectorAll('.settings-tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.settings-tab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  const panel = document.getElementById('stab-' + tabId);
  if (panel) panel.style.display = '';
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
}

// ── TEMPLATE EDITOR (Settings > Templates tab) ───────────────────────────────

// All available webpart IDs with display names for the editor
const ALL_WEBPARTS = [
  { id: 'date',            label: 'Date (required)' },
  { id: 'title',           label: 'Title / Summary' },
  { id: 'areaSelector',    label: 'Curriculum Area dropdown' },
  { id: 'peoplePicker',    label: 'People Picker (registry checkboxes)' },
  { id: 'attendeesTable',  label: 'Attendees Table (free-type names)' },
  { id: 'keyPoints',       label: 'Key Points / Notes' },
  { id: 'newNotes',        label: 'Notes / Detail' },
  { id: 'coachingPrompt',  label: 'Coaching Question / Prompt' },
  { id: 'reflectionNotes', label: 'Reflection' },
  { id: 'planningNotes',   label: 'Planning for Next Session' },
  { id: 'resourceLinks',   label: 'Resources / Links' },
  { id: 'resourceUrl',     label: 'Single Resource / AI Agent URL' },
  { id: 'objectives',      label: 'Objectives / Learning Outcomes' },
  { id: 'sessionPlan',     label: 'Session Plan & Delivery Notes' },
  { id: 'learningTakeaway',label: 'Key Learning Takeaway' },
  { id: 'applicationPlan', label: 'How You\'ll Apply This' },
  { id: 'networkingNotes', label: 'Networking Notes & Contacts' },
  { id: 'moodSliders',     label: 'Wellbeing Check-in (mood/stress/confidence)' },
  { id: 'previousActions', label: 'Previous Actions (locked, tickable)' },
  { id: 'actionPoints',    label: 'Action Points / Next Steps' },
  { id: 'reviewDate',      label: 'Review / Follow-up Date' },
  { id: 'cogsTheme',       label: 'COGs Theme dropdown' },
  { id: 'attendeeCount',   label: 'Number of Attendees' },
  { id: 'tags',            label: 'Tags (common purposes)' },
  { id: 'threadLinker',    label: 'Link to Thread / Workflow' },
  { id: 'evidenceLinks',   label: 'Evidence Links' },
  { id: 'location',        label: 'Location / Venue' },
  { id: 'provider',        label: 'Provider / Organisation' },
  { id: 'duration',        label: 'Duration' },
  { id: 'eventType',       label: 'Event Type dropdown' },
  { id: 'targetAudience',  label: 'Target Audience' },
  { id: 'learningOutcomes',label: 'Expected Learning Outcomes' },
];

let EDITING_TEMPLATE_ID = null;

/**
 * Populate the template list panel
 */
function loadTemplateEditor() {
  if (!CONFIG?.templates) return;

  const listEl = document.getElementById('template-list-items');
  if (!listEl) return;

  // Group by category
  const groups = {};
  CONFIG.templates.forEach(t => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });

  listEl.innerHTML = '';
  Object.entries(groups).forEach(([cat, templates]) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'tpl-category';
    catDiv.innerHTML = `<div class="tpl-category-label">${cat}</div>`;

    templates.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tpl-list-item';
      btn.textContent = t.name;
      btn.dataset.id = t.id;
      btn.onclick = () => openTemplateForEditing(t.id);
      catDiv.appendChild(btn);
    });

    // "Add new template" button per category
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tpl-list-item tpl-add-btn';
    addBtn.textContent = '+ New template';
    addBtn.onclick = () => createNewTemplate(cat);
    catDiv.appendChild(addBtn);

    listEl.appendChild(catDiv);
  });
}

/**
 * Open a template in the editor panel
 */
function openTemplateForEditing(templateId) {
  if (!CONFIG) return;
  const template = CONFIG.templates.find(t => t.id === templateId);
  if (!template) return;

  EDITING_TEMPLATE_ID = templateId;

  // Highlight in list
  document.querySelectorAll('.tpl-list-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tpl-list-item[data-id="${templateId}"]`)?.classList.add('active');

  const panel = document.getElementById('template-editor-panel');
  if (!panel) return;

  const currentParts = template.webParts || [];
  const currentDefaults = template.defaultTags || [];

  // Build the editor
  panel.innerHTML = `
    <div class="tpl-editor">
      <div class="tpl-editor-header">
        <div>
          <div class="card-title" style="margin:0;">${template.name}</div>
          <div style="font-size:.78rem;color:var(--color-slate);">ID: ${template.id} · Category: ${template.category}</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="saveTemplateEdits('${templateId}')">💾 Save</button>
          <button class="btn btn-secondary btn-sm" onclick="deleteTemplate('${templateId}')">🗑 Delete</button>
        </div>
      </div>

      <div class="form-group" style="margin-top:1rem;">
        <label for="tpl-edit-name">Template name</label>
        <input type="text" id="tpl-edit-name" value="${template.name}" style="max-width:400px;">
      </div>

      <div class="form-group">
        <label>Webparts — drag to reorder, uncheck to remove</label>
        <p style="font-size:.78rem;color:var(--color-slate);margin-bottom:.5rem;">
          Checked = included in this template. Drag rows to change order.
        </p>
        <div id="tpl-webparts-editor" class="tpl-webparts-list">
          ${buildWebpartsChecklist(currentParts)}
        </div>
      </div>

      <div class="form-group">
        <label>Default tags (pre-selected when this template loads)</label>
        <div class="tpl-default-tags">
          ${(CONFIG.commonPurposes || []).map(cp => `
            <label class="tag-option" style="cursor:pointer;">
              <input type="checkbox" class="tpl-default-tag-cb" value="${cp.id}"
                ${currentDefaults.includes(cp.id) ? 'checked' : ''}>
              ${cp.label}
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Wire drag-to-reorder
  initWebpartsDrag();
}

/**
 * Build the webparts checklist for the editor
 * Shows: checked items first (in current order), then unchecked items
 */
function buildWebpartsChecklist(currentParts) {
  const usedIds = new Set(currentParts);
  
  // First: items already in template (in their current order)
  const inTemplate = currentParts.map(id => {
    const def = ALL_WEBPARTS.find(w => w.id === id) || { id, label: id };
    return buildWebpartRow(def, true);
  }).join('');

  // Then: available items not in template
  const notInTemplate = ALL_WEBPARTS
    .filter(w => !usedIds.has(w.id))
    .map(w => buildWebpartRow(w, false))
    .join('');

  return inTemplate + notInTemplate;
}

function buildWebpartRow(def, checked) {
  return `
    <div class="tpl-webpart-row ${checked ? 'included' : ''}" data-id="${def.id}" draggable="true">
      <span class="drag-handle" aria-hidden="true">⠿</span>
      <label class="tpl-webpart-label">
        <input type="checkbox" class="tpl-wp-cb" value="${def.id}" ${checked ? 'checked' : ''}>
        ${def.label}
      </label>
    </div>
  `;
}

/**
 * Drag-to-reorder webparts within the editor
 */
function initWebpartsDrag() {
  const list = document.getElementById('tpl-webparts-editor');
  if (!list) return;

  let dragging = null;

  list.querySelectorAll('.tpl-webpart-row').forEach(row => {
    row.addEventListener('dragstart', () => {
      dragging = row;
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      dragging = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging || dragging === row) return;
      const rect = row.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        list.insertBefore(dragging, row);
      } else {
        list.insertBefore(dragging, row.nextSibling);
      }
    });
  });
}

/**
 * Save edits back to CONFIG.templates
 */
function saveTemplateEdits(templateId) {
  const template = CONFIG?.templates?.find(t => t.id === templateId);
  if (!template) return;

  // Read name
  template.name = document.getElementById('tpl-edit-name')?.value.trim() || template.name;

  // Read webparts — only checked, in DOM order
  const rows = document.querySelectorAll('#tpl-webparts-editor .tpl-webpart-row');
  template.webParts = Array.from(rows)
    .filter(row => row.querySelector('.tpl-wp-cb')?.checked)
    .map(row => row.dataset.id);

  // Read default tags
  template.defaultTags = Array.from(
    document.querySelectorAll('.tpl-default-tag-cb:checked')
  ).map(cb => cb.value);

  // Refresh the list button label
  document.querySelector(`.tpl-list-item[data-id="${templateId}"]`).textContent = template.name;

  // Refresh the activity type dropdown in Quick Capture
  refreshActivityDropdown();

  // If this template is currently loaded in Quick Capture, re-render it
  const activeSelect = document.getElementById('qc-activity-type');
  if (activeSelect && activeSelect.value === templateId) {
    loadTemplate(templateId);
    showToast(`"${template.name}" saved and form updated`, 'success');
  } else {
    showToast(`"${template.name}" saved — select it in Quick Capture to see changes`, 'success');
  }
}

/**
 * Create a new template
 */
function createNewTemplate(category) {
  const name = prompt(`New template name for ${category}:`);
  if (!name?.trim()) return;

  const id = `custom-${Date.now()}`;
  const newTemplate = {
    id,
    name: name.trim(),
    category,
    webParts: ['date', 'newNotes', 'actionPoints', 'tags'],
    defaultTags: []
  };

  CONFIG.templates.push(newTemplate);
  loadTemplateEditor();
  openTemplateForEditing(id);
  showToast(`Template "${name}" created — add webparts and save`, 'success');
}

/**
 * Delete a template
 */
function deleteTemplate(templateId) {
  const template = CONFIG?.templates?.find(t => t.id === templateId);
  if (!confirm(`Delete "${template?.name}"? This cannot be undone until you reload config.`)) return;

  CONFIG.templates = CONFIG.templates.filter(t => t.id !== templateId);
  EDITING_TEMPLATE_ID = null;
  loadTemplateEditor();
  document.getElementById('template-editor-panel').innerHTML =
    '<p style="color:var(--color-slate);font-size:.9rem;">Select a template on the left to edit it.</p>';
  refreshActivityDropdown();
  showToast('Template deleted', 'success');
}

/**
 * Refresh the Quick Capture activity dropdown from CONFIG.templates
 */
function refreshActivityDropdown() {
  const select = document.getElementById('qc-activity-type');
  if (!select || !CONFIG?.templates) return;

  // Group by category
  const groups = {};
  CONFIG.templates.forEach(t => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });

  select.innerHTML = '<option value="">— select type —</option>';
  Object.entries(groups).forEach(([cat, templates]) => {
    const og = document.createElement('optgroup');
    og.label = cat;
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
}

/**
 * Export config.json including template edits
 */
function downloadConfigJSON() {
  if (!CONFIG) { showToast('No config loaded', 'error'); return; }
  const blob = new Blob([JSON.stringify(CONFIG, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'config.json';
  a.click();
  showToast('config.json downloaded — commit to GitHub to make permanent', 'success');
}

// ── SETTINGS TAB SWITCHER ────────────────────────────────────────────────────
function showSettingsTab(tabId, btn) {
  document.querySelectorAll('.settings-tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.settings-tab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  const panel = document.getElementById(`stab-${tabId}`);
  if (panel) panel.style.display = '';
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
}

// ── PEOPLE REGISTRY EDITOR ───────────────────────────────────────────────────
function loadPeopleEditor() {
  const tbody = document.getElementById('people-editor-tbody');
  if (!tbody || !CONFIG?.peopleRegistry) return;
  tbody.innerHTML = '';
  CONFIG.peopleRegistry.forEach((p, idx) => tbody.appendChild(buildPersonRow(p, idx)));
}

function buildPersonRow(person, idx) {
  const tr = document.createElement('tr');
  tr.className = 'person-editor-row';
  tr.innerHTML = `
    <td><input type="text" class="person-id"   value="${person.id   || ''}" placeholder="jsmith" aria-label="ID" style="width:70px;font-family:var(--font-mono);font-size:.8rem;"></td>
    <td><input type="text" class="person-name" value="${person.name || ''}" placeholder="Full name" aria-label="Name" style="width:100%;"></td>
    <td><input type="text" class="person-role" value="${person.role || ''}" placeholder="Role / title" aria-label="Role" style="width:100%;"></td>
    <td><button type="button" class="btn btn-icon btn-sm" onclick="removePersonRow(this)" aria-label="Remove">✕</button></td>
  `;
  return tr;
}

function addPersonRow() {
  const tbody = document.getElementById('people-editor-tbody');
  if (!tbody) return;
  tbody.appendChild(buildPersonRow({ id: '', name: '', role: '' }, tbody.children.length));
}

function removePersonRow(btn) { btn.closest('tr').remove(); }

function savePeopleToConfig() {
  if (!CONFIG) { showToast('Load Config first', 'error'); return; }
  const rows = document.querySelectorAll('.person-editor-row');
  CONFIG.peopleRegistry = Array.from(rows).map(row => ({
    id:   row.querySelector('.person-id')?.value.trim(),
    name: row.querySelector('.person-name')?.value.trim(),
    role: row.querySelector('.person-role')?.value.trim()
  })).filter(p => p.name);
  showToast(`${CONFIG.peopleRegistry.length} people saved — export config.json to make permanent`, 'success');
}

// ── SAVED SESSIONS ────────────────────────────────────────────────────────────
// A "session" is a named snapshot of pre-filled form values for a template.
// Stored in SAVED_SESSIONS, exported with the main JSON export.
// Example: "HoA Meeting — ENG — May 2026" pre-fills area=ENG, title, objectives.

let SAVED_SESSIONS = JSON.parse(localStorage.getItem('dpc-saved-sessions') || '[]');

function persistSessions() {
  localStorage.setItem('dpc-saved-sessions', JSON.stringify(SAVED_SESSIONS));
}

/**
 * Save current form state as a named session
 */
function saveCurrentAsSession() {
  const select = document.getElementById('qc-activity-type');
  const templateId = select?.value;
  if (!templateId) { showToast('Select a template first', 'error'); return; }

  const name = prompt('Name this session (e.g. "HoA Meeting — ENG — May 2026"):');
  if (!name?.trim()) return;

  // Collect all current form values
  const form = document.getElementById('qc-form-container');
  const values = {};
  if (form) {
    form.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
      values[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    // Collect checkboxes by name for people picker and tags
    form.querySelectorAll('input[type="checkbox"][name]').forEach(el => {
      if (!values[el.name]) values[el.name] = [];
      if (el.checked) values[el.name].push(el.value);
    });
  }

  SAVED_SESSIONS.unshift({
    id: `session-${Date.now()}`,
    name: name.trim(),
    templateId,
    templateName: CONFIG?.templates?.find(t => t.id === templateId)?.name || templateId,
    savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    values
  });

  persistSessions();
  renderSavedSessions();
  showToast(`Session "${name}" saved`, 'success');
}

/**
 * Load a saved session back into the form
 */
function loadSession(sessionId) {
  const session = SAVED_SESSIONS.find(s => s.id === sessionId);
  if (!session) return;

  // Select the template first
  const select = document.getElementById('qc-activity-type');
  if (select) {
    select.value = session.templateId;
    loadTemplate(session.templateId);
  }

  // After form renders, fill values
  setTimeout(() => {
    const form = document.getElementById('qc-form-container');
    if (!form) return;
    Object.entries(session.values).forEach(([key, val]) => {
      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val;
      }
      // Restore checkbox groups (people, tags)
      if (Array.isArray(val)) {
        document.querySelectorAll(`[name="${key}"]`).forEach(cb => {
          cb.checked = val.includes(cb.value);
        });
      }
    });
    showToast(`Loaded: ${session.name}`, 'success');
  }, 150);
}

function deleteSession(sessionId) {
  SAVED_SESSIONS = SAVED_SESSIONS.filter(s => s.id !== sessionId);
  persistSessions();
  renderSavedSessions();
  showToast('Session deleted', 'success');
}

function renderSavedSessions() {
  const container = document.getElementById('saved-sessions-list');
  if (!container) return;

  if (!SAVED_SESSIONS.length) {
    container.innerHTML = '<p style="font-size:.82rem;color:var(--color-slate);font-style:italic;">No saved sessions yet. Fill a form and click "Save as session" to store it for reuse.</p>';
    return;
  }

  // Group by template name
  const groups = {};
  SAVED_SESSIONS.forEach(s => {
    if (!groups[s.templateName]) groups[s.templateName] = [];
    groups[s.templateName].push(s);
  });

  container.innerHTML = Object.entries(groups).map(([tName, sessions]) => `
    <div style="margin-bottom:1rem;">
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;color:var(--color-grey);font-weight:600;margin-bottom:.4rem;">${tName}</div>
      ${sessions.map(s => `
        <div class="session-card">
          <div class="session-info">
            <div class="session-name">${s.name}</div>
            <div class="session-meta">Saved ${s.savedAt}</div>
          </div>
          <div class="session-actions">
            <button class="btn btn-primary btn-sm" onclick="loadSession('${s.id}')">Load</button>
            <button class="btn btn-icon btn-sm" onclick="deleteSession('${s.id}')" aria-label="Delete session">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}