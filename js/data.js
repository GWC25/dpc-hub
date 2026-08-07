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

// ── IndexedDB handle persistence (Session 34) ───────────────────
// A FileSystemDirectoryHandle cannot be stored in localStorage — it's a
// live browser object, not a string. The pre-Session-34 code only ever
// stored a boolean flag + a date there, and never actually restored
// _folderHandle from anything on page load. Result: within the "still
// valid" window, the Hub silently ran in offline/default mode on every
// fresh load, with no error and no warning — explains the recurring
// "0 areas, 0 staff" loads. IndexedDB can store structured/cloneable
// objects, including this kind of handle, which is the correct mechanism
// per the File System Access API spec. queryPermission() (as opposed to
// requestPermission()) does not require a user gesture, so this silent
// check is legitimate to run on every page load.
const _IDB_NAME    = 'dpc-hub-handles';
const _IDB_STORE    = 'handles';
const _IDB_KEY      = 'folderHandle';

function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(_IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbStoreHandle(handle) {
  try {
    const db = await _idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).put(handle, _IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  } catch {
    // IndexedDB unavailable (e.g. private browsing) — silent reconnect
    // just won't work next time; the existing weekly-picker flow still
    // does, so this is a soft failure, not a broken app.
  }
}

async function _idbGetHandle() {
  try {
    const db = await _idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readonly');
      const req = tx.objectStore(_IDB_STORE).get(_IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function _idbClearHandle() {
  try {
    const db = await _idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).delete(_IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* no-op */ }
}

// Tries to silently restore a real, still-valid connection from a
// previously stored handle. Returns true only if _folderHandle is now
// genuinely usable — never shows any UI, never requires a click.
async function tryReconnectSilently() {
  const handle = await _idbGetHandle();
  if (!handle) return false;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      _folderHandle = handle;
      return true;
    }
  } catch {
    // Handle reference is stale (e.g. file moved/deleted) — fall through
    // to the normal picker flow below.
  }
  return false;
}

// For the Settings tab connection-status display.
function getConnectionStatus() {
  return _folderHandle ? 'connected' : 'offline';
}

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
  notes:         { notes: [] },
  healthChecks:  { reviews: [] },
  actionPlans:   { plans: [] },
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
          await _idbStoreHandle(handle);
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
          await _idbStoreHandle(handle);
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
      notes:         'data-notes.json',
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
        const seedData = await _buildDefaultAreas();
        await _writeFile(filename, seedData);
        window.DPC_DATA.areas = seedData;
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

// ── Step 8: Check Supabase captures ────────────────────────────
// This stub is intentionally left as a harmless fallback. The real
// implementation is a same-named function declared in js/supabase-sync.js,
// which loads AFTER this file — its declaration overrides this one, same
// convention as app.js's real initReports()/initAISupport(). If
// supabase-sync.js is ever removed from hub.html's script list, this
// no-op keeps loadHub() safe rather than throwing.
async function checkSupabaseCaptures() {
  if (!DPC_CONFIG.SUPABASE_URL || !DPC_CONFIG.SUPABASE_ANON_KEY) return;
  // No-op fallback — see js/supabase-sync.js for the real implementation.
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
  let snapTime = '';
  try { snapTime = new Date(snapAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { snapTime = 'earlier'; }
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

  // Session 34: try a real, silent reconnect first — this is the fix for
  // the connection-persistence bug. Only fall back to the old
  // localStorage-flag-based modal flow if silent reconnect genuinely fails
  // (first ever visit, permission actually revoked, or IndexedDB
  // unavailable). Preserves all existing modal/offline behaviour as the
  // fallback path — nothing already working is being removed.
  const reconnected = await tryReconnectSilently();

  if (!reconnected) {
    const permState = getPermissionState();

    if (permState === 'first-time') {
      localStorage.removeItem(DPC_CONFIG.LS_KEYS.FOLDER_HANDLE_STORED);
      localStorage.removeItem(DPC_CONFIG.LS_KEYS.PERMISSION_DATE);
      await selectFolderFirstTime(ui);
    } else if (permState === 'expired') {
      await reconnectFolder(ui);
    }
    // If still no folder (offline mode) — continue with defaults
  }

  await loadManifest(ui);
  await loadRequiredFiles(ui);
  await loadOptionalFiles();
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

// ── Area rename / archive (Session 38) ──────────────────────────
// Built because the real area structure turned out to be genuinely
// unsettled — two source documents partially disagreed, several codes
// are still undecided, and Cass' own doc flags multiple possible future
// mergers (EFE/EHE, FIP -> four SEND programmes). areaCode is used as a
// foreign key across staff, AFIs, Health Checks, Resource Library shares,
// CPD entries and calendar entries — every one of those needs updating
// together, or a rename silently orphans real people's records.
//
// renameAreaCode always cascades through every one of those stores. It
// does NOT touch data-resource-tag-map.json (Learning Studio matching —
// not area-specific) or Supabase sync captures (Phase 7, parked, out of
// scope). If a new record type gains its own areaCode field later,
// extend the sweep list here — this is the one place it should live.
function renameAreaCode(oldCode, newCode) {
  if (!oldCode || !newCode || oldCode === newCode) return { changed: 0 };
  let changed = 0;

  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === oldCode);
  if (area) { area.areaCode = newCode; area.lastUpdated = nowISO(); changed++; }
  _dirty.add('data-areas.json');

  const sweep = [
    { store: () => (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [], file: 'data-staff.json' },
    { store: () => (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [], file: 'data-afi.json' },
    { store: () => (window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.shares) || [], file: 'data-resource-library.json' },
    { store: () => (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [], file: 'data-health-checks.json' },
    { store: () => (window.DPC_DATA.cpd && window.DPC_DATA.cpd.deliveredCPD) || [], file: 'data-cpd.json' },
    { store: () => (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [], file: 'data-calendar.json' },
  ];

  sweep.forEach(({ store, file }) => {
    const records = store();
    let touchedThisStore = false;
    records.forEach(r => {
      if (r.areaCode === oldCode) { r.areaCode = newCode; changed++; touchedThisStore = true; }
    });
    if (touchedThisStore) _dirty.add(file);
  });

  _writeLocalSnapshot();
  return { changed };
}

// Soft-hide rather than delete — an area with real linked history (staff,
// AFIs, Health Checks) should never be silently removed. Archived areas
// drop out of _getAreas() by default (see areas.js) but every record
// still pointing at that areaCode stays fully intact and queryable.
function archiveArea(areaCode, archived = true) {
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area) return false;
  area.archived = archived;
  area.lastUpdated = nowISO();
  _dirty.add('data-areas.json');
  _writeLocalSnapshot();
  return true;
}

// ── Area merge (Session 46) ──────────────────────────────────────
// Different from renameAreaCode: that function changes ONE area's own
// code and sweeps every linked record to match. This one is for when the
// target area already exists and the source should be absorbed into it —
// e.g. consolidating FAU/FCO/FEH/FPL back into SEL. Every linked record
// (staff, AFIs, Health Checks, resource shares, CPD, calendar) moves from
// sourceCode to targetCode, then the source area is archived, not
// deleted — its history stays intact and auditable, it just stops
// appearing as an active area.
function mergeAreaInto(sourceCode, targetCode) {
  if (!sourceCode || !targetCode || sourceCode === targetCode) return { changed: 0 };
  const target = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === targetCode);
  if (!target) return { changed: 0, error: 'Target area does not exist' };

  let changed = 0;
  const sweep = [
    { store: () => (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [], file: 'data-staff.json' },
    { store: () => (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [], file: 'data-afi.json' },
    { store: () => (window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.shares) || [], file: 'data-resource-library.json' },
    { store: () => (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [], file: 'data-health-checks.json' },
    { store: () => (window.DPC_DATA.cpd && window.DPC_DATA.cpd.deliveredCPD) || [], file: 'data-cpd.json' },
    { store: () => (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [], file: 'data-calendar.json' },
    { store: () => (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [], file: 'data-action-plans.json' },
    { store: () => (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads) || [], file: 'data-digital-leads.json' },
  ];

  sweep.forEach(({ store, file }) => {
    const records = store();
    let touched = false;
    records.forEach(r => {
      if (r.areaCode === sourceCode) { r.areaCode = targetCode; changed++; touched = true; }
    });
    if (touched) _dirty.add(file);
  });

  archiveArea(sourceCode, true);
  target.lastUpdated = nowISO();
  _dirty.add('data-areas.json');
  _writeLocalSnapshot();
  return { changed };
}

// ── Departments (Session 39) ─────────────────────────────────────
// Several areas turned out to be genuinely multi-department in real
// practice — PAP (Performing Arts / Music), DCI (several digital
// departments), SEL (distinct SEND programmes), SMS (individual A-Level
// subjects). Rather than duplicating a department field onto every
// record type (AFIs, Health Checks, resource shares...), departments are
// stored ONE level: nested inside the area (area.departments[]) as the
// catalog, and staff.departmentCode as the single, optional pointer.
// Every other record type is already tied to a staffId (Health Checks,
// AFIs) or a set of staffIds (Resource Library shares) — department for
// those is derived by looking up that staff member's departmentCode when
// needed, not stored redundantly. This is the same reasoning as areaCode
// living on staff and being the join key everywhere else, one level down.
//
// An area with no departments defined behaves exactly as before —
// departmentCode stays null/optional, nothing forces its use.

function saveDepartment(areaCode, dept) {
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area) return null;
  if (!area.departments) area.departments = [];
  const idx = area.departments.findIndex(d => d.departmentCode === dept.departmentCode);
  if (idx >= 0) {
    area.departments[idx] = { ...area.departments[idx], ...dept };
  } else {
    area.departments.push({ archived: false, ...dept });
  }
  area.lastUpdated = nowISO();
  _dirty.add('data-areas.json');
  _writeLocalSnapshot();
  return area.departments;
}

// Cascades through staff.departmentCode for every staff member in this
// area currently assigned to the old department code — same rename-safety
// principle as renameAreaCode, one level down.
function renameDepartmentCode(areaCode, oldCode, newCode) {
  if (!oldCode || !newCode || oldCode === newCode) return { changed: 0 };
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area || !area.departments) return { changed: 0 };

  const dept = area.departments.find(d => d.departmentCode === oldCode);
  if (dept) dept.departmentCode = newCode;
  area.lastUpdated = nowISO();
  _dirty.add('data-areas.json');

  let changed = dept ? 1 : 0;
  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  staff.forEach(s => {
    if (s.areaCode === areaCode && s.departmentCode === oldCode) { s.departmentCode = newCode; changed++; }
  });
  if (changed > (dept ? 1 : 0)) _dirty.add('data-staff.json');

  _writeLocalSnapshot();
  return { changed };
}

function archiveDepartment(areaCode, deptCode, archived = true) {
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area || !area.departments) return false;
  const dept = area.departments.find(d => d.departmentCode === deptCode);
  if (!dept) return false;
  dept.archived = archived;
  area.lastUpdated = nowISO();
  _dirty.add('data-areas.json');
  _writeLocalSnapshot();
  return true;
}

// ── RAG suggestions (Session 41) ─────────────────────────────────
// Discovered before building this: area.ragDimensions already carries
// real, human-entered scores WITH rationale text and a full snapshot
// history (js/rag.js) — 8 dimensions (staffCapability, hoaLeadership,
// infrastructure, digitalSkillsAssessment, curriculumIntegration,
// learnerReadiness, accessibilityInclusion, digitalLeadEngagement), not
// the 5 Health Check focus areas. An earlier draft of this function
// auto-computed and overwrote area.ragDimensions directly — that would
// have silently destroyed real rationale someone had written. Rebuilt as
// advisory only: never writes anything, just returns a suggestion for
// rag.js's existing "Update RAG scores" modal to show and pre-fill,
// which the human still has to actively confirm and save.
//
// Honest scope, not all 8 dimensions equally: only 'accessibilityInclusion'
// has a real, direct Hub data source (Health Check indicator scores are
// specifically about accessible/inclusive digital practice). The other 7
// genuinely aren't measured by anything in the Hub yet — staffCapability,
// hoaLeadership and digitalLeadEngagement in particular would need
// different data (general digital confidence, leadership judgement,
// Digital Lead activity tracking) that doesn't exist as structured data
// here. For those, the only honest fallback is area.historicalRAG — one
// overall figure from the pre-Hub tracker, explicitly labelled as a
// coarse, non-dimension-specific, lower-confidence guide per Graeme's
// own framing ("historical is less solid ground, it can guide").
function getSuggestedRAGScore(areaCode, dimensionId) {
  if (dimensionId === 'accessibilityInclusion') {
    const reviews = typeof _hcGetReviewsForArea === 'function' ? _hcGetReviewsForArea(areaCode) : [];
    const byStaff = {};
    reviews.forEach(r => {
      if (!byStaff[r.staffId] || (r.date || '') > (byStaff[r.staffId].date || '')) byStaff[r.staffId] = r;
    });
    const allScores = Object.values(byStaff).flatMap(r =>
      Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null)
    );
    if (allScores.length > 0) {
      const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      return { value: Math.round(avg), source: 'health-check', confidence: 'high', staffCount: Object.keys(byStaff).length };
    }
  }

  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (area && area.historicalRAG && area.historicalRAG.overall != null) {
    return { value: area.historicalRAG.overall, source: 'historical', confidence: 'low', staffCount: 0 };
  }

  return null;
}

function saveHistoricalRAG(areaCode, overallValue) {
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area) return false;
  if (!area.historicalRAG) area.historicalRAG = {};
  area.historicalRAG.overall = overallValue;
  saveArea(area);
  return true;
}

// ── Action Plans (Session 41) ─────────────────────────────────────
function saveActionPlan(plan) {
  if (!window.DPC_DATA.actionPlans) window.DPC_DATA.actionPlans = { plans: [] };
  const plans = window.DPC_DATA.actionPlans.plans;
  const idx = plans.findIndex(p => p.planId === plan.planId);
  if (idx >= 0) {
    plans[idx] = { ...plan, lastUpdated: nowISO() };
  } else {
    plans.push({ ...plan, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-action-plans.json');
  _writeLocalSnapshot();
}

// Assigns a Teach Meet (or any template) to an Action Plan. Creates a
// real Template instance — same shape templates.js already uses, so it
// shows up in Templates exactly like one created from there — and a Loop
// (AFI) that stays open until the plan's work is actually done. Both get
// linked back onto the plan. Nothing here duplicates existing mechanisms;
// it wires them together.
function assignTemplateToActionPlan(planId, templateId, date) {
  const plan = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans || []).find(p => p.planId === planId);
  const tmpl = (window.DPC_DATA.templates && window.DPC_DATA.templates.templates || []).find(t => t.templateId === templateId);
  if (!plan || !tmpl) return null;

  const instanceId = generateId();
  const instance = {
    instanceId,
    templateVersion: tmpl.version || 1,
    date,
    areaCode: plan.areaCode,
    attendeeIds: [], // filled in later via attendance, per Graeme's own note
    contextNotes: `Assigned from Action Plan: ${plan.focus || plan.type}`,
    linkedAFIIds: [],
    reflectionRefs: [],
  };

  const afi = {
    afiId: generateId(),
    areaCode: plan.areaCode,
    staffId: plan.staffIds && plan.staffIds.length === 1 ? plan.staffIds[0] : null,
    lraCategoryId: null,
    lraThemeId: null,
    lraThemeLabel: null,
    description: `${tmpl.title || tmpl.templateType}: ${plan.focus || plan.aim || 'Action plan session'}`,
    digitalOpportunity: null,
    digitalApplicable: null,
    rationaleTest: null,
    status: AFI_STATUS.OPEN,
    severity: null,
    closeWindow: plan.targetDate || null,
    linkedActions: [],
    evidenceChain: [{ type: 'action-plan', planId: plan.planId, instanceId }],
    parentObservationId: null,
    hyperThemeMatch: null,
    qipRef: null,
    createdAt: nowISO(),
    closedAt: null,
    lastUpdated: nowISO(),
  };

  instance.linkedAFIIds.push(afi.afiId);
  if (!tmpl.instances) tmpl.instances = [];
  tmpl.instances.push(instance);
  saveTemplate(tmpl);
  saveAFI(afi);

  if (!plan.linkedInstances) plan.linkedInstances = [];
  if (!plan.linkedAFIIds) plan.linkedAFIIds = [];
  plan.linkedInstances.push({ templateId, instanceId, templateType: tmpl.templateType });
  plan.linkedAFIIds.push(afi.afiId);
  saveActionPlan(plan);

  return { instance, afi };
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

// ── Public: save a Digital Lead profile (Session 43) ─────────────
// This function did not exist before. js/digitalleads.js's own _saveDL()
// only ever mutated window.DPC_DATA in memory and set an unused flag
// (window._dlDirty, read by nothing) — it never called _dirty.add() or
// _writeLocalSnapshot(). Every Digital Lead profile, every 1:1 meeting
// logged, was being silently lost on refresh. Real fix, not a patch: a
// proper save function matching every other one in this file, with
// digitalleads.js updated to actually call it.
function saveDigitalLead(dlData) {
  if (!window.DPC_DATA.digitalLeads) window.DPC_DATA.digitalLeads = { digitalLeads: [] };
  const dls = window.DPC_DATA.digitalLeads.digitalLeads;
  const idx = dls.findIndex(d => d.dlId === dlData.dlId);
  if (idx >= 0) {
    dls[idx] = { ...dlData, lastUpdated: nowISO() };
  } else {
    dls.push({ ...dlData, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-digital-leads.json');
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

// ── Resource Library (Session 32) ───────────────────────────────
// saveLibraryEntry: manual entries only (LinkedIn Pathway / DPC-created).
// Learning Studio entries are never saved here — see LIBRARY_TYPE in schema.js.
function saveLibraryEntry(entry) {
  if (!window.DPC_DATA.resourceLibrary) window.DPC_DATA.resourceLibrary = { entries: [], shares: [] };
  const entries = window.DPC_DATA.resourceLibrary.entries;
  const idx = entries.findIndex(e => e.resourceId === entry.resourceId);
  if (idx >= 0) {
    entries[idx] = { ...entry, lastUpdated: nowISO() };
  } else {
    entries.push({ ...entry, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-resource-library.json');
  _writeLocalSnapshot();
}

// saveLibraryShare: records that a resource (of any LIBRARY_TYPE, including
// an auto-derived Learning Studio one) was shared with one or more staff in
// an area, on a date, with optional context. Writes to two places, same
// denormalised-for-different-queries pattern already used elsewhere in this
// app (e.g. activityLog on the area + afiRefs on the area both point at the
// same AFI):
//   1. A central record in data-resource-library.json — for area-level and
//      resource-level queries ("who has this been shared with").
//   2. staff.touchHistory[] on every staff member shared with — for
//      staff-level queries. The History tab already renders touchHistory
//      generically, so this needs no new staff-side UI at all.
function saveLibraryShare(share) {
  if (!window.DPC_DATA.resourceLibrary) window.DPC_DATA.resourceLibrary = { entries: [], shares: [] };
  const shareRecord = {
    shareId:       share.shareId || generateId(),
    resourceId:    share.resourceId,
    resourceType:  share.resourceType,
    resourceTitle: share.resourceTitle,
    resourceUrl:   share.resourceUrl,
    date:          share.date,
    areaCode:      share.areaCode,
    staffIds:      share.staffIds || [],
    contextNotes:  share.contextNotes || '',
    createdAt:     nowISO(),
  };
  window.DPC_DATA.resourceLibrary.shares.push(shareRecord);
  _dirty.add('data-resource-library.json');

  // Mirror into each shared staff member's touchHistory
  const staffList = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const touchType = share.resourceType === LIBRARY_TYPE.LINKEDIN_PATHWAY
    ? TOUCH_TYPE.LINKEDIN_PATHWAY
    : TOUCH_TYPE.RESOURCE_ASSIGNED;

  shareRecord.staffIds.forEach(staffId => {
    const staff = staffList.find(s => s.staffId === staffId);
    if (!staff) return;
    if (!staff.touchHistory) staff.touchHistory = [];
    staff.touchHistory.push({
      touchId:      generateId(),
      touchType,
      date:         shareRecord.date,
      areaCode:     shareRecord.areaCode,
      resourceId:   shareRecord.resourceId,
      resourceUrl:  shareRecord.resourceUrl,
      summary:      `Shared: ${shareRecord.resourceTitle}`,
      contextNotes: shareRecord.contextNotes,
      createdAt:    nowISO(),
    });
    staff.lastUpdated = nowISO();
  });
  if (shareRecord.staffIds.length > 0) _dirty.add('data-staff.json');

  _writeLocalSnapshot();
  return shareRecord;
}

// ── Digital Health Check (Session 36 rebuild) ───────────────────
function saveHealthCheckReview(review) {
  if (!window.DPC_DATA.healthChecks) window.DPC_DATA.healthChecks = { reviews: [] };
  const reviews = window.DPC_DATA.healthChecks.reviews;
  const idx = reviews.findIndex(r => r.reviewId === review.reviewId);
  if (idx >= 0) {
    reviews[idx] = { ...review, lastUpdated: nowISO() };
  } else {
    reviews.push({ ...review, createdAt: nowISO(), lastUpdated: nowISO() });
  }
  _dirty.add('data-health-checks.json');
  _writeLocalSnapshot();
}

// ── Public: save a note (meeting shell / quick note) ──────────
function saveNote(note) {
  const notes = window.DPC_DATA.notes.notes;
  const idx = notes.findIndex(n => n.noteId === note.noteId);
  if (idx >= 0) {
    notes[idx] = { ...note, lastUpdated: nowISO() };
  } else {
    notes.push({ ...note, lastUpdated: nowISO() });
  }
  _dirty.add('data-notes.json');
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
  _dirty.add('data-notes.json');
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
    'data-notes.json':         'notes',
    'data-resource-library.json': 'resourceLibrary',
    'data-health-checks.json': 'healthChecks',
    'data-action-plans.json': 'actionPlans',
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
    'data-notes.json':         window.DPC_DATA.notes,
    'data-resource-library.json': window.DPC_DATA.resourceLibrary,
    'data-health-checks.json': window.DPC_DATA.healthChecks,
    'data-action-plans.json': window.DPC_DATA.actionPlans,
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
async function _buildDefaultAreas() {
  // Try to fetch the seed file from the GitHub Pages deployment
  try {
    const resp = await fetch('./data/areas-seed.json');
    if (resp.ok) {
      const seed = await resp.json();
      return seed;
    }
  } catch (e) {
    console.warn('DPC Hub: could not load areas-seed.json:', e);
  }
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
