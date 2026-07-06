// DPC Hub · js/data.js · v1.0 · July 2026
// Data layer. All read/write operations to OneDrive JSON files.
// File System Access API logic. Manifest loading. Auto-save scheduler.
// Session snapshot to localStorage. No UI logic in this file.
// Imports from: js/schema.js and js/config.js only.

// ── Module state ─────────────────────────────────────────────
let _folderHandle   = null;   // FileSystemDirectoryHandle
let _autoSaveTimer  = null;   // setInterval reference
let _lastSavedSnap  = null;   // JSON string of last saved state (for dirty-check)
let _pendingBanners = [];     // Banners to show after load (collected during loading)

// ── Public data store ─────────────────────────────────────────
// All modules read from and write to window.DPC_DATA.
// Never access OneDrive files directly from module files — always go through data.js.
window.DPC_DATA = {
  manifest:      null,
  areas:         { areas: [] },
  calendar:      { entries: [] },
  staff:         { staff: [] },
  afi:           { afis: [] },
  reflections:   { reflections: [] },
  templates:     { templates: [] },
  cpd:           { entries: [], plannedTraining: [], deliveredCPD: [] },
  digitalLeads:  { digitalLeads: [] },
  currentFocus:  { focuses: [] },
};

// Dirty tracking: which files have unsaved changes
const _dirty = new Set();

// ── Step 1: Check File System Access API support ──────────────
function checkAPISupport() {
  if (typeof window.showDirectoryPicker !== 'function') {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#1D3557;padding:24px;">
        <div style="background:#fff;border-radius:12px;padding:40px;max-width:440px;text-align:center;">
          <h1 style="font:bold 24px Arial,sans-serif;color:#1D3557;margin-bottom:16px;">Browser not supported</h1>
          <p style="font:16px Arial,sans-serif;color:#334155;margin-bottom:24px;">
            DPC Hub requires Microsoft Edge or Google Chrome on a desktop device.
            Please open this page in Edge.
          </p>
        </div>
      </div>`;
    return false;
  }
  return true;
}

// ── Step 2: Check stored permission state ─────────────────────
function getPermissionState() {
  const stored      = localStorage.getItem(DPC_CONFIG.LS_KEYS.FOLDER_HANDLE_STORED);
  const permDateStr = localStorage.getItem(DPC_CONFIG.LS_KEYS.PERMISSION_DATE);
  if (!stored || stored !== 'true') return 'first-time';
  if (!permDateStr) return 'first-time';
  const permDate  = new Date(permDateStr);
  const daysSince = (Date.now() - permDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince >= DPC_CONFIG.PERMISSION_VALID_DAYS) return 'expired';
  return 'valid';
}

// ── Step 3a: First-time folder selection ──────────────────────
async function selectFolderFirstTime(ui) {
  return new Promise((resolve) => {
    ui.showFolderModal({
      title:   'Welcome to DPC Hub',
      message: 'Please select your OneDrive data folder to get started. This is a one-time setup — you\'ll reconnect once a week.',
      btnLabel:'Select OneDrive folder',
      onConfirm: async () => {
        try {
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          _folderHandle = handle;
          localStorage.setItem(DPC_CONFIG.LS_KEYS.FOLDER_HANDLE_STORED, 'true');
          localStorage.setItem(DPC_CONFIG.LS_KEYS.PERMISSION_DATE, new Date().toISOString());
          ui.hideFolderModal();
          resolve(true);
        } catch (err) {
          if (err.name === 'AbortError') {
            ui.showFolderModalError('Folder selection is required to use DPC Hub. Please try again.');
          } else {
            ui.showFolderModalError(`Could not access the folder: ${err.message}. Please try again.`);
          }
        }
      }
    });
  });
}

// ── Step 3b: Weekly reconnect ─────────────────────────────────
async function reconnectFolder(ui) {
  const lastWeekSummary = buildLastWeekSummary();
  return new Promise((resolve) => {
    ui.showFolderModal({
      title:   'Good morning — weekly reconnect needed',
      message: 'To keep your data secure, please reconnect to your OneDrive folder. This takes one click.',
      summary: lastWeekSummary,
      btnLabel:'Reconnect to OneDrive folder',
      allowOffline: true,
      onConfirm: async () => {
        try {
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          _folderHandle = handle;
          localStorage.setItem(DPC_CONFIG.LS_KEYS.PERMISSION_DATE, new Date().toISOString());
          ui.hideFolderModal();
          resolve(true);
        } catch (err) {
          if (err.name === 'AbortError') {
            ui.showFolderModalError('Reconnection cancelled. You can continue in offline mode.');
          } else {
            ui.showFolderModalError(`Could not reconnect: ${err.message}`);
          }
        }
      },
      onOffline: () => {
        ui.hideFolderModal();
        _pendingBanners.push({
          type: 'amber',
          message: 'Offline mode — changes will not be saved to OneDrive until you reconnect.',
          persistent: true,
        });
        resolve(false);
      }
    });
  });
}

function buildLastWeekSummary() {
  // Pull basic counts from current DPC_DATA for the weekly summary panel
  try {
    const afiCount  = (window.DPC_DATA.afi.afis || []).filter(a => a.status !== AFI_STATUS.CLOSED).length;
    const actCount  = (window.DPC_DATA.areas.areas || []).reduce((n, a) => n + (a.activityLog || []).length, 0);
    const refCount  = (window.DPC_DATA.reflections.reflections || []).length;
    return `Open loops: ${afiCount} · Activities logged: ${actCount} · Reflections received: ${refCount}`;
  } catch { return ''; }
}

// ── Step 4: Load manifest ─────────────────────────────────────
async function loadManifest(ui) {
  if (!_folderHandle) {
    // Offline mode — no folder. Return null.
    return null;
  }
  try {
    const fileHandle = await _folderHandle.getFileHandle(DPC_CONFIG.MANIFEST_FILENAME, { create: false });
    const file       = await fileHandle.getFile();
    const text       = await file.text();
    const manifest   = JSON.parse(text);
    // Validate required fields
    if (!manifest.version || !manifest.files) {
      throw new Error('Manifest is missing required fields (version, files).');
    }
    window.DPC_DATA.manifest = manifest;
    return manifest;
  } catch (err) {
    if (err.name === 'NotFoundError') {
      // First time — create a blank manifest
      const blank = _buildBlankManifest();
      await _writeFile(DPC_CONFIG.MANIFEST_FILENAME, blank);
      window.DPC_DATA.manifest = blank;
      return blank;
    }
    if (err instanceof SyntaxError) {
      ui.showFatalError('dpc-manifest.json is corrupted and cannot be read. Please restore from a backup or select your folder again.', () => selectFolderFirstTime(ui));
      return null;
    }
    // Validation error
    ui.showFatalError(`Manifest error: ${err.message}`, () => selectFolderFirstTime(ui));
    return null;
  }
}

function _buildBlankManifest() {
  return {
    version:    DPC_CONFIG.HUB_VERSION,
    createdAt:  nowISO(),
    lastSync:   nowISO(),
    files: {
      areas:         'data-areas.json',
      calendar:      'data-calendar.json',
      staff:         'data-staff.json',
      afi:           'data-afi.json',
      reflections:   'data-reflections.json',
      templates:     'data-templates.json',
      cpd:           'data-cpd.json',
      digitalLeads:  'data-digital-leads.json',
      currentFocus:  'data-current-focus.json',
    }
  };
}

// ── Step 5: Load required files ───────────────────────────────
async function loadRequiredFiles(ui) {
  if (!_folderHandle) return true; // Offline — proceed with defaults

  const results = await Promise.allSettled(
    DPC_CONFIG.REQUIRED_FILES.map(filename => _readFile(filename))
  );

  for (let i = 0; i < results.length; i++) {
    const filename = DPC_CONFIG.REQUIRED_FILES[i];
    const result   = results[i];
    if (result.status === 'rejected' || result.value === null) {
      // Try to create the file with defaults
      if (filename === 'data-areas.json') {
        await _writeFile(filename, _buildDefaultAreas());
        window.DPC_DATA.areas = _buildDefaultAreas();
      } else if (filename === 'data-calendar.json') {
        const def = { entries: [] };
        await _writeFile(filename, def);
        window.DPC_DATA.calendar = def;
      }
    } else {
      _assignToStore(filename, result.value);
    }
  }
  return true;
}

// ── Step 6: Load optional files ───────────────────────────────
async function loadOptionalFiles() {
  if (!_folderHandle) return; // Offline — defaults already set

  const results = await Promise.allSettled(
    DPC_CONFIG.OPTIONAL_FILES.map(filename => _readFile(filename))
  );

  for (let i = 0; i < results.length; i++) {
    const filename = DPC_CONFIG.OPTIONAL_FILES[i];
    const result   = results[i];
    if (result.status === 'rejected' || result.value === null) {
      // File missing — use default, queue a non-blocking banner
      const defaultVal = DEFAULT_DATA[filename];
      if (defaultVal) _assignToStore(filename, defaultVal);
      _pendingBanners.push({
        type:      'amber',
        message:   `${filename} not found — this module will start empty.`,
        dismissible: true,
      });
    } else {
      _assignToStore(filename, result.value);
    }
  }
}

// ── Step 7: Fetch public resource data ────────────────────────
async function fetchPublicResources() {
  // Non-blocking — don't await at load time
  (async () => {
    try {
      const [resResult, cardsResult] = await Promise.allSettled([
        fetch(DPC_CONFIG.CPD_RESOURCES_URL).then(r => r.ok ? r.json() : Promise.reject(r.status)),
        fetch(DPC_CONFIG.CPD_CARDS_URL).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      ]);
      const resources = resResult.status === 'fulfilled' ? resResult.value : null;
      const cards     = cardsResult.status === 'fulfilled' ? cardsResult.value : null;
      if (resources || cards) {
        window.DPC_RESOURCES = { resources, cards };
        localStorage.setItem(DPC_CONFIG.LS_KEYS.RESOURCES_CACHE, JSON.stringify({ resources, cards }));
        localStorage.setItem(DPC_CONFIG.LS_KEYS.RESOURCES_CACHED_AT, nowISO());
      }
    } catch {
      // Network unavailable — try cache
      const cached = localStorage.getItem(DPC_CONFIG.LS_KEYS.RESOURCES_CACHE);
      if (cached) {
        try { window.DPC_RESOURCES = JSON.parse(cached); } catch { /* ignore */ }
      }
      // Non-blocking — no error shown to user
      console.warn('DPC Hub: CPD Library unavailable — using cached resources or none.');
    }
  })();
}

// ── Step 8: Check Supabase captures (Phase 7 — stub for now) ──
async function checkSupabaseCaptures() {
  // Stub — implemented in Phase 7 (js/supabase-sync.js)
  // In Phase 1: no-op
  if (!DPC_CONFIG.SUPABASE_URL || !DPC_CONFIG.SUPABASE_ANON_KEY) return;
  // Phase 7 implementation will go here
}

// ── Step 9: Initialise auto-save ──────────────────────────────
function initAutoSave(ui) {
  _lastSavedSnap = _snapshotData();
  _autoSaveTimer = setInterval(async () => {
    const current = _snapshotData();
    if (current === _lastSavedSnap) return; // Nothing changed
    await _saveAllDirty(ui);
  }, DPC_CONFIG.AUTOSAVE_INTERVAL_MS);
}

async function _saveAllDirty(ui) {
  if (!_folderHandle) {
    // Offline — write to localStorage only
    _writeLocalSnapshot();
    return;
  }
  ui.showSaveIndicator('saving');
  const errors = [];
  const promises = [..._dirty].map(async (filename) => {
    try {
      const data = _getDataForFile(filename);
      await _writeFile(filename, data);
      _dirty.delete(filename);
    } catch (err) {
      errors.push(filename);
      console.error(`DPC Hub: failed to save ${filename}:`, err);
    }
  });
  await Promise.allSettled(promises);
  _lastSavedSnap = _snapshotData();
  _writeLocalSnapshot();
  if (errors.length > 0) {
    ui.showToast('warning', `Auto-save failed for: ${errors.join(', ')}. Check OneDrive connection.`, true);
  } else {
    ui.showSaveIndicator('saved');
  }
}

// ── Step 10: Session snapshot check ──────────────────────────
async function checkSessionSnapshot(ui) {
  const snapshot  = localStorage.getItem(DPC_CONFIG.LS_KEYS.SESSION_SNAPSHOT);
  const snapAt    = localStorage.getItem(DPC_CONFIG.LS_KEYS.SNAPSHOT_AT);
  if (!snapshot || !snapAt) return;
  const age = (Date.now() - new Date(snapAt).getTime()) / (1000 * 60 * 60);
  if (age > 24) return; // Snapshot too old
  // Show restore banner
  const snapTime = new Date(snapAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  ui.showRestoreBanner(snapTime, async () => {
    try {
      const parsed = JSON.parse(snapshot);
      Object.assign(window.DPC_DATA, parsed);
      markAllDirty();
      ui.showToast('success', 'Session restored successfully.');
      ui.hideRestoreBanner();
    } catch {
      ui.showToast('error', 'Could not restore session — snapshot may be corrupted.');
    }
  });
}

// ── Public: full load sequence ────────────────────────────────
async function loadHub(ui) {
  if (!checkAPISupport()) return false;

  const permState = getPermissionState();
  if (permState === 'first-time') {
    await selectFolderFirstTime(ui);
  } else if (permState === 'expired') {
    await reconnectFolder(ui);
  }
  // If still no folder (offline mode) — continue with defaults

  await loadManifest(ui);
  await loadRequiredFiles(ui);
  await loadOptionalFiles();
  fetchPublicResources();   // non-blocking
  checkSupabaseCaptures();  // non-blocking
  await checkSessionSnapshot(ui);
  initAutoSave(ui);

  // Show any queued banners
  for (const banner of _pendingBanners) {
    ui.showBanner(banner);
  }
  _pendingBanners = [];

  // Monday morning orientation
  if (new Date().getDay() === 1) {
    ui.showMondayBanner(buildLastWeekSummary());
  }

  console.log(`DPC Hub loaded — ${nowISO()} — ${(window.DPC_DATA.areas.areas || []).length} areas, ${(window.DPC_DATA.staff.staff || []).length} staff, ${(window.DPC_DATA.afi.afis || []).filter(a => a.status !== 'closed').length} open AFIs.`);
  return true;
}

// ── Public: save a specific area record ──────────────────────
function saveArea(areaData) {
  const areas = window.DPC_DATA.areas.areas;
  const idx = areas.findIndex(a => a.areaCode === areaData.areaCode);
  if (idx >= 0) {
    areas[idx] = { ...areaData, lastUpdated: nowISO() };
  } else {
    areas.push({ ...areaData, lastUpdated: nowISO() });
  }
  _dirty.add('data-areas.json');
  _writeLocalSnapshot();
}

// ── Public: save a staff profile ─────────────────────────────
function saveStaff(staffData) {
  const staff = window.DPC_DATA.staff.staff;
  const idx = staff.findIndex(s => s.staffId === staffData.staffId);
  if (idx >= 0) {
    staff[idx] = { ...staffData, lastUpdated: nowISO() };
  } else {
    staff.push({ ...staffData, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-staff.json');
  _writeLocalSnapshot();
}

// ── Public: save an AFI record ────────────────────────────────
function saveAFI(afiData) {
  const afis = window.DPC_DATA.afi.afis;
  const idx = afis.findIndex(a => a.afiId === afiData.afiId);
  if (idx >= 0) {
    afis[idx] = { ...afiData, lastUpdated: nowISO() };
  } else {
    afis.push({ ...afiData, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-afi.json');
  _writeLocalSnapshot();
}

// ── Public: save a calendar entry ─────────────────────────────
function saveCalendarEntry(entry) {
  const entries = window.DPC_DATA.calendar.entries;
  const idx = entries.findIndex(e => e.entryId === entry.entryId);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  _dirty.add('data-calendar.json');
  _writeLocalSnapshot();
}

// ── Public: delete a calendar entry ──────────────────────────
function deleteCalendarEntry(entryId) {
  window.DPC_DATA.calendar.entries = window.DPC_DATA.calendar.entries.filter(e => e.entryId !== entryId);
  _dirty.add('data-calendar.json');
  _writeLocalSnapshot();
}

// ── Public: save a reflection ─────────────────────────────────
function saveReflection(reflection) {
  const reflections = window.DPC_DATA.reflections.reflections;
  const idx = reflections.findIndex(r => r.reflectionId === reflection.reflectionId);
  if (idx >= 0) {
    reflections[idx] = reflection;
  } else {
    reflections.push(reflection);
  }
  _dirty.add('data-reflections.json');
  _writeLocalSnapshot();
}

// ── Public: save a template ───────────────────────────────────
function saveTemplate(template) {
  const templates = window.DPC_DATA.templates.templates;
  const idx = templates.findIndex(t => t.templateId === template.templateId);
  if (idx >= 0) {
    templates[idx] = { ...template, lastUpdated: nowISO() };
  } else {
    templates.push({ ...template, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-templates.json');
  _writeLocalSnapshot();
}

// ── Public: mark all files dirty (used after restore) ────────
function markAllDirty() {
  _dirty.add('data-areas.json');
  _dirty.add('data-calendar.json');
  _dirty.add('data-staff.json');
  _dirty.add('data-afi.json');
  _dirty.add('data-reflections.json');
  _dirty.add('data-templates.json');
  _dirty.add('data-cpd.json');
  _dirty.add('data-digital-leads.json');
  _dirty.add('data-current-focus.json');
}

// ── Public: force save now (called on user action) ────────────
async function forceSaveNow(ui) {
  await _saveAllDirty(ui);
}

// ── Internal: file read ───────────────────────────────────────
async function _readFile(filename) {
  if (!_folderHandle) return null;
  try {
    const fileHandle = await _folderHandle.getFileHandle(filename, { create: false });
    const file       = await fileHandle.getFile();
    const text       = await file.text();
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'NotFoundError') return null;
    throw err;
  }
}

// ── Internal: file write ──────────────────────────────────────
async function _writeFile(filename, data) {
  if (!_folderHandle) return;
  const fileHandle   = await _folderHandle.getFileHandle(filename, { create: true });
  const writable     = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// ── Internal: assign file data to store ──────────────────────
function _assignToStore(filename, data) {
  const keyMap = {
    'data-areas.json':         'areas',
    'data-calendar.json':      'calendar',
    'data-staff.json':         'staff',
    'data-afi.json':           'afi',
    'data-reflections.json':   'reflections',
    'data-templates.json':     'templates',
    'data-cpd.json':           'cpd',
    'data-digital-leads.json': 'digitalLeads',
    'data-current-focus.json': 'currentFocus',
  };
  const key = keyMap[filename];
  if (key && data) window.DPC_DATA[key] = data;
}

// ── Internal: get data object for a filename ──────────────────
function _getDataForFile(filename) {
  const keyMap = {
    'data-areas.json':         window.DPC_DATA.areas,
    'data-calendar.json':      window.DPC_DATA.calendar,
    'data-staff.json':         window.DPC_DATA.staff,
    'data-afi.json':           window.DPC_DATA.afi,
    'data-reflections.json':   window.DPC_DATA.reflections,
    'data-templates.json':     window.DPC_DATA.templates,
    'data-cpd.json':           window.DPC_DATA.cpd,
    'data-digital-leads.json': window.DPC_DATA.digitalLeads,
    'data-current-focus.json': window.DPC_DATA.currentFocus,
    [DPC_CONFIG.MANIFEST_FILENAME]: window.DPC_DATA.manifest,
  };
  return keyMap[filename] || null;
}

// ── Internal: snapshot current data for dirty-check ──────────
function _snapshotData() {
  return JSON.stringify(window.DPC_DATA);
}

// ── Internal: write localStorage snapshot (session protection) ─
function _writeLocalSnapshot() {
  try {
    localStorage.setItem(DPC_CONFIG.LS_KEYS.SESSION_SNAPSHOT, _snapshotData());
    localStorage.setItem(DPC_CONFIG.LS_KEYS.SNAPSHOT_AT, nowISO());
  } catch (e) {
    // localStorage full — not critical
    console.warn('DPC Hub: could not write session snapshot to localStorage:', e);
  }
}

// ── Internal: build default areas from seed ───────────────────
function _buildDefaultAreas() {
  // Minimal seed — full seed data is in data/areas-seed.json
  // If areas-seed.json is present, that takes precedence.
  return { areas: [] };
}

// ── Password authentication ───────────────────────────────────
async function hashPassword(password) {
  const msgBuffer  = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(inputPassword) {
  const hash = await hashPassword(inputPassword);
  return hash === DPC_CONFIG.DPC_PASSWORD_HASH;
}

function setAuthSession() {
  const expiry = new Date(Date.now() + DPC_CONFIG.AUTH_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  localStorage.setItem(DPC_CONFIG.LS_KEYS.AUTH_TOKEN, 'authenticated');
  localStorage.setItem(DPC_CONFIG.LS_KEYS.AUTH_EXPIRY, expiry);
}

function isAuthenticated() {
  const token  = localStorage.getItem(DPC_CONFIG.LS_KEYS.AUTH_TOKEN);
  const expiry = localStorage.getItem(DPC_CONFIG.LS_KEYS.AUTH_EXPIRY);
  if (!token || !expiry) return false;
  return new Date(expiry) > new Date();
}

function clearAuth() {
  localStorage.removeItem(DPC_CONFIG.LS_KEYS.AUTH_TOKEN);
  localStorage.removeItem(DPC_CONFIG.LS_KEYS.AUTH_EXPIRY);
}
