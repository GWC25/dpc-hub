// DPC Hub · js/app.js · v1.0 · July 2026
// Application controller. Tab routing. Module initialisation.
// UI helper functions passed to data.js as the `ui` object.
// Imports from all module files. This is the only file that does.

// ── DOM references ────────────────────────────────────────────
const DOM = {
  loadingOverlay:   () => document.getElementById('loading-overlay'),
  loadingMessage:   () => document.getElementById('loading-message'),
  mainContent:      () => document.getElementById('main-content'),
  navLinks:         () => document.querySelectorAll('.hub-sidebar__link'),
  saveIndicator:    () => document.getElementById('save-indicator'),
  notificationBadge:() => document.getElementById('notification-badge'),
  toastContainer:   () => document.getElementById('toast-container'),
  folderModal:      () => document.getElementById('folder-modal'),
  folderModalTitle: () => document.getElementById('folder-modal-title'),
  folderModalMsg:   () => document.getElementById('folder-modal-message'),
  folderModalSummary:()=> document.getElementById('folder-modal-summary'),
  folderModalBtn:   () => document.getElementById('folder-modal-btn'),
  folderModalErr:   () => document.getElementById('folder-modal-error'),
  folderModalOffline:()=> document.getElementById('folder-modal-offline'),
  restoreBanner:    () => document.getElementById('restore-banner'),
  restoreTime:      () => document.getElementById('restore-time'),
  restoreBtn:       () => document.getElementById('restore-btn'),
  bannerContainer:  () => document.getElementById('banner-container'),
};

// ── UI object passed to data.js ───────────────────────────────
const UI = {
  showFolderModal({ title, message, btnLabel, summary='', allowOffline=false, onConfirm, onOffline }) {
    // Delegates to window.DPC_FOLDER_MODAL which is set up in hub.html
    // with direct synchronous click handlers — required for showDirectoryPicker()
    if (window.DPC_FOLDER_MODAL) {
      window.DPC_FOLDER_MODAL.show({ message, btnLabel, summary, allowOffline, onConfirm, onOffline });
    }
  },

  hideFolderModal() {
    if (window.DPC_FOLDER_MODAL) window.DPC_FOLDER_MODAL.hide();
  },

  showFolderModalError(msg) {
    if (window.DPC_FOLDER_MODAL) window.DPC_FOLDER_MODAL.showError(msg);
  },

  showFatalError(msg, retryFn) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                  background:#1D3557;padding:24px;">
        <div style="background:#fff;border-radius:12px;padding:40px;max-width:500px;text-align:center;">
          <h1 style="font:bold 22px Arial,sans-serif;color:#DC2626;margin-bottom:16px;">Unable to load Hub</h1>
          <p style="font:16px Arial,sans-serif;color:#334155;margin-bottom:24px;">${msg}</p>
          <button onclick="location.reload()"
            style="background:#0F766E;color:#fff;border:none;padding:12px 24px;
                   border-radius:4px;font:bold 16px Arial,sans-serif;cursor:pointer;">
            Try again
          </button>
        </div>
      </div>`;
  },

  showSaveIndicator(state) {
    const el = DOM.saveIndicator();
    if (!el) return;
    if (state === 'saving') {
      el.textContent = 'Saving…';
      el.classList.add('hub-nav__save-indicator--visible');
    } else if (state === 'saved') {
      el.textContent = 'Saved ✓';
      el.classList.add('hub-nav__save-indicator--visible');
      setTimeout(() => el.classList.remove('hub-nav__save-indicator--visible'), 3000);
    }
  },

  showToast(type, message, persistent=false) {
    const container = DOM.toastContainer();
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `<span class="toast__message">${message}</span>`;
    if (!persistent) {
      const close = document.createElement('button');
      close.className = 'banner__close';
      close.setAttribute('aria-label', 'Dismiss notification');
      close.textContent = '×';
      close.onclick = () => toast.remove();
      toast.appendChild(close);
    }
    container.appendChild(toast);
    if (!persistent) setTimeout(() => toast.remove(), 6000);
  },

  showBanner({ type, message, dismissible=false, persistent=false }) {
    const container = DOM.bannerContainer();
    if (!container) return;
    const banner = document.createElement('div');
    banner.className = `banner banner--${type}`;
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<span>${message}</span>`;
    if (dismissible) {
      const close = document.createElement('button');
      close.className = 'banner__close';
      close.setAttribute('aria-label', 'Dismiss');
      close.textContent = '×';
      close.onclick = () => banner.remove();
      banner.appendChild(close);
    }
    container.appendChild(banner);
  },

  showRestoreBanner(time, onRestore) {
    const banner = DOM.restoreBanner();
    if (!banner) return;
    const timeEl = DOM.restoreTime();
    if (timeEl) timeEl.textContent = time || 'earlier';
    const restoreBtn = DOM.restoreBtn();
    if (restoreBtn) restoreBtn.onclick = onRestore;
    banner.style.display = 'flex';
  },

  hideRestoreBanner() {
    const banner = DOM.restoreBanner();
    if (banner) banner.style.display = 'none';
  },

  showMondayBanner(summary) {
    this.showBanner({
      type: 'teal',
      message: `Good morning — new week. ${summary}`,
      dismissible: true,
    });
  },

  setLoadingMessage(msg) {
    const el = DOM.loadingMessage();
    if (el) el.textContent = msg;
  },

  hideLoading() {
    // Loading overlay is removed from the flow entirely after hub loads
    // The hub shell is always visible behind any modals
    const el = DOM.loadingOverlay();
    if (el) el.style.display = 'none';
  },

  updateNotificationBadge(count) {
    const badge = DOM.notificationBadge();
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hub-nav__badge--hidden');
    } else {
      badge.classList.add('hub-nav__badge--hidden');
    }
  },
};

// ── Tab routing ───────────────────────────────────────────────
const MODULES = {
  home:           { label: 'Home',           icon: '⌂',  init: () => initHomepage() },
  calendar:       { label: 'Calendar',       icon: '📅', init: () => initCalendar() },
  areas:          { label: 'Areas',          icon: '🗂',  init: () => initAreas() },
  tasks:          { label: 'Tasks',          icon: '✓',  init: () => initTasks() },
  meetings:       { label: 'Meetings',       icon: '💬', init: () => initMeetings() },
  notes:          { label: 'Notes',          icon: '✏',  init: () => initNotes() },
  staff:          { label: 'Staff',          icon: '👤', init: () => initStaff() },
  afis:           { label: 'Loops',          icon: '🔁', init: () => initAFIs() },
  templates:      { label: 'Templates',      icon: '📋', init: () => initTemplates() },
  healthchecks:   { label: 'Health Checks',  icon: '📊', init: () => initHealthChecks() },
  dashboards:     { label: 'Dashboards',     icon: '📈', init: () => initDashboards() },
  digitalleads:   { label: 'Digital Leads',  icon: '⭐', init: () => initDigitalLeads() },
  currentfocus:   { label: 'Current Focus',  icon: '🎯', init: () => initCurrentFocus() },
  cpd:            { label: 'CPD',            icon: '📚', init: () => initCPD() },
  reports:        { label: 'Reports',        icon: '📄', init: () => initReports() },
  aisupport:      { label: 'AI Support',     icon: '🤖', init: () => initAISupport() },
};

let _currentModule = null;

function navigateTo(moduleKey) {
  if (!(moduleKey in MODULES)) {
    console.warn(`DPC Hub: unknown module "${moduleKey}"`);
    return;
  }

  // Update sidebar active state
  DOM.navLinks().forEach(link => {
    link.classList.toggle('hub-sidebar__link--active', link.dataset.module === moduleKey);
  });

  // Update main content
  const main = DOM.mainContent();
  main.innerHTML = '';

  _currentModule = moduleKey;
  MODULES[moduleKey].init();
}

// ── Module stubs (Phases 2-7 fill these in) ───────────────────
// Phase 1 provides empty placeholder screens for all modules.
// Each placeholder shows the module name and a "coming in next phase" note.
// The pattern is identical — future phases replace these with real implementations.

function renderPlaceholder(label, icon) {
  const main = DOM.mainContent();
  main.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">${icon}</div>
      <h1 class="empty-state__title">${label}</h1>
      <p class="empty-state__body">This module will be available shortly.</p>
    </div>`;
}

function initTasks()        { renderPlaceholder('Tasks', '✓'); }
function initMeetings()     { renderPlaceholder('Meetings', '💬'); }
function initNotes()        { renderPlaceholder('Notes', '✏'); }
function initStaff()        { renderPlaceholder('Staff', '👤'); }
function initTemplates()    { renderPlaceholder('Templates', '📋'); }
function initHealthChecks() { renderPlaceholder('Health Checks', '📊'); }
function initDashboards()   { renderPlaceholder('Dashboards', '📈'); }
function initDigitalLeads() { renderPlaceholder('Digital Leads', '⭐'); }
function initCurrentFocus() { renderPlaceholder('Current Focus', '🎯'); }
function initCPD()          { renderPlaceholder('CPD', '📚'); }
function initReports()      { renderPlaceholder('Reports', '📄'); }
function initAISupport()    { renderPlaceholder('AI Support', '🤖'); }

// ── Quick Capture button ──────────────────────────────────────


// ── Notification badge update ─────────────────────────────────
function updateBadgeCount() {
  // Unorganised notes + pending Supabase captures
  const unorgNotes = 0; // Phase 7 will populate this
  const pending    = 0; // Phase 7 will populate this
  UI.updateNotificationBadge(unorgNotes + pending);
}

// ── Boot sequence ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Wire sidebar navigation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.hub-sidebar__link');
    if (link && link.dataset.module) {
      e.preventDefault();
      navigateTo(link.dataset.module);
    }
  });

  UI.setLoadingMessage('Loading your data…');

  const loaded = await loadHub(UI);

  UI.hideLoading();
  updateBadgeCount();
  // Quick capture is initialised by quickcapture.js — called via initQuickCapture()
  if (typeof initQuickCapture === 'function') initQuickCapture();

  if (loaded) {
    navigateTo('home');
  }
});
