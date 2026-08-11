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
//
// Session (11/08/26): queryPermission() can benignly return 'prompt'
// instead of 'granted' on the very first check of a session even when
// permission genuinely was granted previously — a known Chromium timing
// quirk, worse on managed-browser setups. One retry after a short delay
// resolves this in the common case without ever bothering the user.
async function tryReconnectSilently() {
  const handle = await _idbGetHandle();
  if (!handle) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        _folderHandle = handle;
        return true;
      }
    } catch {
      // Handle reference is stale (e.g. file moved/deleted) — no point
      // retrying, fall through to the normal picker flow below.
      return false;
    }
    if (attempt === 0) await new Promise(r => setTimeout(r, 300));
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
    } else {
      // Session (11/08/26): 'expired' AND 'valid' both land here now.
      // Previously only 'expired' triggered the reconnect modal — if
      // localStorage said the permission was still 'valid' but the live
      // browser check (tryReconnectSilently) failed anyway, the Hub used
      // to silently continue in a fully empty offline state with no
      // indication anything was wrong. That silent-blank state is the
      // bug being fixed here: any time we believe we should be connected
      // but genuinely aren't, the user gets the same one-click reconnect
      // modal already used for the weekly-expiry case, instead of an
      // unexplained empty Hub that only a manual hard refresh happened
      // to fix.
      await reconnectFolder(ui);
    }
    // If still no folder after this (user chose offline mode) — continue
    // with defaults, same as before.
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

// ── Action Plan refinement (Session 47) ──────────────────────────
// "Refined detail by role (me, them, HoA, staff), accountability,
// timeframes, success criteria" — one plan now holds multiple
// actionItems, each independently assigned and trackable, rather than
// the plan-level aim/successCriteria being the only detail available.
const ACTION_ITEM_ROLE = Object.freeze({
  DPC: 'dpc', DIGITAL_LEAD: 'digital-lead', HOA: 'hoa', STAFF: 'staff',
});

function addActionItem(planId, item) {
  const plan = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans || []).find(p => p.planId === planId);
  if (!plan) return null;
  if (!plan.actionItems) plan.actionItems = [];
  const newItem = { itemId: generateId(), done: false, ...item };
  plan.actionItems.push(newItem);
  saveActionPlan(plan);
  return newItem;
}

function toggleActionItemDone(planId, itemId, done) {
  const plan = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans || []).find(p => p.planId === planId);
  if (!plan || !plan.actionItems) return false;
  const item = plan.actionItems.find(i => i.itemId === itemId);
  if (!item) return false;
  item.done = done;
  saveActionPlan(plan);
  return true;
}

// Closing a plan requires a report — written now, or a placeholder that
// can be filled in / a fileRef attached later. Never silently closes
// without SOME record of what happened, since that's the whole point of
// tracking impact.
function closeActionPlan(planId, reportText, fileRef = null) {
  const plan = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans || []).find(p => p.planId === planId);
  if (!plan) return false;
  plan.status = 'complete';
  plan.closureReport = { text: reportText || '', fileRef, closedAt: nowISO() };
  saveActionPlan(plan);
  return true;
}

function reopenActionPlan(planId) {
  const plan = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans || []).find(p => p.planId === planId);
  if (!plan) return false;
  plan.status = 'active';
  saveActionPlan(plan);
  return true;
}

// ── Auto-generated individual Action Plans (Session 50) ───────────
// One Health Check review with any actionIdentified domain becomes a
// real, individual Action Plan for that person — one action item per
// flagged domain, using the assessor's own actionDescription as the
// item text, defaulting to Staff as the responsible role since the
// action was identified as theirs to work on. Nothing invented: if a
// domain has no actionDescription text, it's skipped rather than
// creating an empty item.
// ── Shared Action Plan card rendering (Session 51) ────────────────
// Built because the same real bug existed in three separate places at
// once: Staff, Areas, and Digital Leads each had their own copy of
// "show a plan," and only the Digital Leads version actually showed the
// real action items — the other two only showed the generic templated
// aim/successCriteria text, never the specific gaps a Health Check
// actually flagged. One function now, used everywhere a plan is listed,
// so this can't quietly drift apart again.
const ACTION_ITEM_ROLE_LABELS = Object.freeze({
  dpc: 'Me (DPC)', 'digital-lead': 'Digital Lead', hoa: 'Head of Area', staff: 'Staff',
});

// Session (10/08/26): added the `editable` option and the matching
// wireActionPlanCard() below. Before this, only the Digital Leads
// drill-down could add items / tick items done / close a plan — Staff
// and Areas could only view. That's exactly the drift this shared
// renderer was built to prevent (see Session 51 comment history),
// just recurring in a different shape: display had stayed shared,
// but editing had quietly grown its own private copy in Digital Leads.
// Both now go through this one function.
function renderActionPlanCard(plan, opts = {}) {
  const esc = opts.esc || ((s) => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  const fmtDate = opts.fmtDate || ((iso) => { if (!iso) return ''; try { return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } catch { return iso; } });
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const staffNames = (plan.staffIds || []).map(id => { const s = allStaff.find(x => x.staffId === id); return s ? s.name : id; }).join(', ') || 'Whole team';
  const items = plan.actionItems || [];
  const openCount = items.filter(i => !i.done).length;
  const editable = !!opts.editable;
  const isComplete = plan.status === 'complete';
  // Extension points — callers pass extra HTML in rather than the shared
  // template being spliced into afterwards, which is fragile and breaks
  // silently the moment this template's structure changes.
  const extraBadgeHtml = opts.extraBadgeHtml || '';
  const footerHtml = opts.footerHtml ? opts.footerHtml(plan) : '';

  return `
    <div class="ap-shared-card" data-plan-id="${plan.planId}" style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div>
          <p style="font-size:var(--text-xs);font-weight:bold;background:var(--color-light);color:var(--color-muted);padding:1px 8px;border-radius:999px;display:inline-block;margin-bottom:4px;">${esc(plan.type||'General')}</p>
          <p style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);">${esc(plan.focus||plan.aim||'Untitled plan')}</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);">For: ${esc(staffNames)} · Target: ${plan.targetDate?fmtDate(plan.targetDate):'No date set'}</p>
        </div>
        <div style="text-align:right;">
          ${items.length > 0 ? `<span style="font-size:var(--text-xs);font-weight:bold;color:${openCount>0?'var(--color-amber)':'var(--color-green)'};white-space:nowrap;">${openCount>0?`${openCount} open item${openCount!==1?'s':''}`:'All items complete'}</span>` : ''}
          ${extraBadgeHtml}
        </div>
      </div>

      ${items.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-xs);margin-top:var(--space-sm);">
          <thead><tr style="border-bottom:1px solid var(--color-border);">
            <th style="text-align:left;padding:4px;color:var(--color-muted);">What's actually needed</th>
            <th style="text-align:left;padding:4px;color:var(--color-muted);">Role</th>
            <th style="text-align:left;padding:4px;color:var(--color-muted);">Accountable</th>
            <th style="text-align:left;padding:4px;color:var(--color-muted);">By</th>
            ${editable ? '<th style="padding:4px;"></th>' : ''}
          </tr></thead>
          <tbody>
            ${items.map(item => `
              <tr style="border-bottom:1px solid var(--color-border);${item.done?'opacity:0.5;':''}">
                <td style="padding:4px;">${esc(item.description)}${item.sourceDomain ? `<br><span style="font-size:10px;color:var(--color-muted);">from ${esc(item.sourceDomain)}</span>` : ''}</td>
                <td style="padding:4px;">${esc(ACTION_ITEM_ROLE_LABELS[item.role]||item.role||'—')}</td>
                <td style="padding:4px;">${esc(item.accountableName||'—')}</td>
                <td style="padding:4px;">${item.timeframe?fmtDate(item.timeframe):'—'}</td>
                ${editable ? `<td style="padding:4px;">
                  ${!isComplete ? `
                    <input type="checkbox" class="ap-item-done" data-plan-id="${plan.planId}" data-item-id="${item.itemId}" ${item.done?'checked':''} aria-label="Mark done">
                    ${_renderTaskLinkForItem(plan.planId, item.itemId)}
                  ` : (item.done ? '✓' : '')}
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      ` : `<p style="font-size:var(--text-xs);color:var(--color-muted);margin-top:var(--space-sm);">No specific action items yet — general aim: ${esc(plan.aim||'not set')}</p>`}

      ${editable && !isComplete ? `
        <div class="ap-add-item-form" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:4px;margin-top:var(--space-sm);">
          <input type="text" class="form-input ap-item-desc" placeholder="Action description" style="min-height:32px;font-size:10px;">
          <select class="form-select ap-item-role" style="min-height:32px;font-size:10px;">
            <option value="dpc">Me (DPC)</option>
            <option value="digital-lead">Digital Lead</option>
            <option value="hoa">Head of Area</option>
            <option value="staff">Staff</option>
          </select>
          <input type="text" class="form-input ap-item-accountable" placeholder="Accountable" style="min-height:32px;font-size:10px;">
          <input type="date" class="form-input ap-item-timeframe" style="min-height:32px;font-size:10px;">
          <button type="button" class="btn btn--ghost btn--sm ap-add-item-btn" data-plan-id="${plan.planId}">+ Add</button>
        </div>
      ` : ''}

      ${plan.successCriteria ? `<p style="font-size:var(--text-xs);color:var(--color-slate);margin-top:var(--space-sm);"><strong>Success criteria:</strong> ${esc(plan.successCriteria)}</p>` : ''}
      ${_renderLinkedLoopsPreview(plan, esc, fmtDate)}

      ${editable ? (!isComplete ? `
        <button type="button" class="btn btn--secondary btn--sm ap-close-btn" data-plan-id="${plan.planId}" style="margin-top:var(--space-sm);">Close plan</button>
        <div class="ap-close-form" data-plan-id="${plan.planId}" style="display:none;margin-top:var(--space-sm);">
          <textarea class="form-textarea ap-close-report" rows="2" placeholder="What happened? What was the impact?"></textarea>
          <button type="button" class="btn btn--primary btn--sm ap-close-confirm" data-plan-id="${plan.planId}" style="margin-top:4px;">Confirm close</button>
        </div>
      ` : `
        <div style="background:var(--color-light);border-radius:var(--radius-sm);padding:var(--space-sm);margin-top:var(--space-sm);">
          <p style="font-size:10px;color:var(--color-muted);text-transform:uppercase;">Closure report — ${plan.closureReport?fmtDate(plan.closureReport.closedAt):''}</p>
          <p style="font-size:var(--text-xs);color:var(--color-slate);">${esc(plan.closureReport?.text || 'No report recorded.')}</p>
          <button type="button" class="btn btn--ghost btn--sm ap-reopen-btn" data-plan-id="${plan.planId}" style="margin-top:var(--space-sm);">Reopen plan</button>
        </div>
      `) : ''}
      ${footerHtml}
    </div>`;
}

// Session (11/08/26): "N session(s) already assigned" used to be static
// text with no way to reach what it referred to — exactly the gap Graeme
// flagged ("linked work should be accessible from multiple spaces, not
// just referenced"). Now shows each linked Loop with a short inline
// preview (status + description) and a real link via openLoop(), which
// navigates to Loops and opens that record's detail panel directly.
function _renderLinkedLoopsPreview(plan, esc, fmtDate) {
  const afiIds = plan.linkedAFIIds || [];
  if (afiIds.length === 0) return '';
  const allAfis = (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [];
  const loops = afiIds.map(id => allAfis.find(a => a.afiId === id)).filter(Boolean);
  if (loops.length === 0) return '';

  const statusColour = { open: 'var(--color-amber)', actioned: 'var(--color-teal)', 'impact-checked': 'var(--color-green)', closed: 'var(--color-muted)', 're-opened': 'var(--color-red)' };

  return `
    <div style="margin-top:var(--space-sm);">
      <p style="font-size:10px;color:var(--color-muted);text-transform:uppercase;margin-bottom:4px;">${loops.length} linked loop${loops.length!==1?'s':''}</p>
      ${loops.map(afi => `
        <button type="button" class="ap-loop-link" data-afi-id="${afi.afiId}" style="
          display:block;width:100%;text-align:left;background:var(--color-light);border:none;border-left:3px solid ${statusColour[afi.status]||'var(--color-muted)'};
          border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:4px 8px;margin-bottom:4px;cursor:pointer;font:inherit;">
          <span style="font-size:10px;font-weight:bold;color:${statusColour[afi.status]||'var(--color-muted)'};text-transform:capitalize;">${esc(afi.status)}</span>
          <span style="font-size:var(--text-xs);color:var(--color-slate);"> — ${esc((afi.description||'').slice(0,80))}${(afi.description||'').length>80?'…':''}</span>
        </button>`).join('')}
    </div>`;
}
// Session (11/08/26): the "task" link used to always mean "create a new
// one", even if you'd already clicked it before — clicking twice made two
// tasks pointing at the same item. Now checks for an existing linked task
// first and shows a real "open task" link to it instead of "task" again.
function _renderTaskLinkForItem(planId, itemId) {
  const existing = ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [])
    .find(t => t.source === 'action-plan' && t.sourceRef && t.sourceRef.planId === planId && t.sourceRef.itemId === itemId);
  if (existing) {
    return `<button type="button" class="ap-item-open-task" data-task-id="${existing.entryId}" style="font-size:10px;background:none;border:none;color:var(--color-navy);cursor:pointer;text-decoration:underline;margin-left:4px;">open task</button>`;
  }
  if (typeof createTaskFromSource === 'function') {
    return `<button type="button" class="ap-item-create-task" data-plan-id="${planId}" data-item-id="${itemId}" style="font-size:10px;background:none;border:none;color:var(--color-teal);cursor:pointer;text-decoration:underline;margin-left:4px;">task</button>`;
  }
  return '';
}

// Delegated event wiring for one or more renderActionPlanCard(..., {editable:true})
// cards inside `container`. One listener per event type on the container
// itself (not per-button), so it keeps working across re-renders without
// re-querying every element by hand — the exact bug class that made three
// separate copies of this logic drift apart before.
// `opts.refresh()` is called after every mutation so the caller re-renders
// its own tab/list however it normally does; this function never assumes
// how the caller's surrounding UI is structured.
function wireActionPlanCard(container, opts = {}) {
  if (!container || container._apWired) return; // avoid double-binding on re-use
  container._apWired = true;
  const refresh = typeof opts.refresh === 'function' ? opts.refresh : () => {};
  const toast = (type, msg) => { if (typeof UI !== 'undefined') UI.showToast(type, msg); };

  container.addEventListener('change', (e) => {
    if (e.target.matches('.ap-item-done')) {
      const planId = e.target.dataset.planId, itemId = e.target.dataset.itemId, done = e.target.checked;
      toggleActionItemDone(planId, itemId, done);
      // Session (11/08/26): keep any task created from this item (via the
      // "task" link) in sync — see the matching fix in tasks.js for the
      // reverse direction. Same underlying bug, same fix, both directions.
      const linkedTask = ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [])
        .find(t => t.source === 'action-plan' && t.sourceRef && t.sourceRef.planId === planId && t.sourceRef.itemId === itemId);
      if (linkedTask && typeof TASK_STATUS !== 'undefined') {
        linkedTask.status = done ? TASK_STATUS.COMPLETE : TASK_STATUS.UPCOMING;
        saveCalendarEntry(linkedTask);
      }
      refresh();
    }
  });

  container.addEventListener('click', (e) => {
    const loopLink = e.target.closest('.ap-loop-link');
    if (loopLink && typeof openLoop === 'function') {
      openLoop(loopLink.dataset.afiId);
      return;
    }

    const openTaskBtn = e.target.closest('.ap-item-open-task');
    if (openTaskBtn && typeof openTask === 'function') {
      openTask(openTaskBtn.dataset.taskId);
      return;
    }

    const createTaskBtn = e.target.closest('.ap-item-create-task');
    if (createTaskBtn) {
      const plan = ((window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || []).find(p => p.planId === createTaskBtn.dataset.planId);
      const item = plan && (plan.actionItems || []).find(i => i.itemId === createTaskBtn.dataset.itemId);
      if (!item) return;
      const task = createTaskFromSource(
        { title: item.description, date: item.timeframe || todayISO(), areaCode: plan.areaCode, personRefs: item.accountableName ? [item.accountableName] : [], notes: `From Action Plan: ${plan.focus || plan.aim || ''}` },
        'action-plan', { planId: plan.planId, itemId: item.itemId }
      );
      toast('success', `Task created: ${task.title}`);
      refresh();
      return;
    }

    const addBtn = e.target.closest('.ap-add-item-btn');
    if (addBtn) {
      const card = addBtn.closest('.ap-shared-card');
      const desc = card.querySelector('.ap-item-desc').value.trim();
      if (!desc) { toast('error', 'Please describe the action.'); return; }
      addActionItem(addBtn.dataset.planId, {
        description: desc,
        role: card.querySelector('.ap-item-role').value,
        accountableName: card.querySelector('.ap-item-accountable').value.trim(),
        timeframe: card.querySelector('.ap-item-timeframe').value || null,
      });
      refresh();
      return;
    }

    const closeBtn = e.target.closest('.ap-close-btn');
    if (closeBtn) {
      const form = container.querySelector(`.ap-close-form[data-plan-id="${closeBtn.dataset.planId}"]`);
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    const closeConfirmBtn = e.target.closest('.ap-close-confirm');
    if (closeConfirmBtn) {
      const card = closeConfirmBtn.closest('.ap-shared-card');
      const report = card.querySelector('.ap-close-report').value.trim();
      closeActionPlan(closeConfirmBtn.dataset.planId, report);
      toast('success', 'Plan closed.');
      refresh();
      return;
    }

    const reopenBtn = e.target.closest('.ap-reopen-btn');
    if (reopenBtn) {
      reopenActionPlan(reopenBtn.dataset.planId);
      toast('success', 'Plan reopened.');
      refresh();
      return;
    }
  });
}

function generateActionPlanFromHealthCheck(review, staffId) {
  const staff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff || []).find(s => s.staffId === staffId);
  const plan = {
    planId: generateId(),
    areaCode: review.areaCode,
    type: 'Health Check follow-up',
    focus: staff ? `${staff.name} — Health Check actions (${review.date})` : `Health Check actions (${review.date})`,
    staffIds: [staffId],
    aim: 'Address the specific practice gaps identified during this Health Check.',
    successCriteria: 'Each flagged area scores 4+ (On Track / Confident) at the next Health Check.',
    targetDate: null,
    status: 'active',
    actionItems: [],
    linkedInstances: [],
    linkedAFIIds: [],
    sourceHealthCheckReviewId: review.reviewId,
  };

  Object.entries(review.domains || {}).forEach(([domainId, d]) => {
    if (!d.actionIdentified || !d.actionDescription) return;
    const focusArea = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).find(fa => fa.id === domainId);
    plan.actionItems.push({
      itemId: generateId(),
      description: d.actionDescription,
      role: 'staff',
      accountableName: staff ? staff.name : '',
      timeframe: null,
      done: false,
      sourceDomain: focusArea ? focusArea.label : domainId,
    });
  });

  saveActionPlan(plan);
  return plan;
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

// ── Training history (Session 47) ────────────────────────────────
// Was a single free-text field (trainingSession). Now a real array, so
// there's genuinely something to show a history of, not just one line.
// The old field isn't deleted or force-migrated — a DL profile with just
// trainingSession set (from the earlier import) still displays that
// correctly; addTrainingEvent starts building the real array alongside
// it going forward.
function addTrainingEvent(dlId, event) {
  const dl = (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads || []).find(d => d.dlId === dlId);
  if (!dl) return null;
  if (!dl.trainingHistory) dl.trainingHistory = [];
  const newEvent = { eventId: generateId(), createdAt: nowISO(), ...event };
  dl.trainingHistory.push(newEvent);
  saveDigitalLead(dl);
  return newEvent;
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

// Session (11/08/26): deleteAFI() didn't exist at all — Loops could be
// created (including automatically, via "Assign Teach Meet" on an Action
// Plan) but never removed. Also cleans up the plan.linkedAFIIds
// back-reference so a deleted Loop doesn't leave a dangling "N open
// loops" count on the Action Plan that created it.
function deleteAFI(afiId) {
  window.DPC_DATA.afi.afis = (window.DPC_DATA.afi.afis || []).filter(a => a.afiId !== afiId);
  _dirty.add('data-afi.json');

  const plans = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [];
  plans.forEach(p => {
    if (p.linkedAFIIds && p.linkedAFIIds.includes(afiId)) {
      p.linkedAFIIds = p.linkedAFIIds.filter(id => id !== afiId);
      _dirty.add('data-action-plans.json');
    }
  });

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
