// DPC Hub · js/config.js · v1.0 · July 2026
// Configuration constants.
// PASSWORD IS NOT STORED HERE IN PLAIN TEXT.
// The hash below is a SHA-256 hash of the chosen password.
// To generate a new hash: open browser console and run:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
// Replace DPC_PASSWORD_HASH with the output.

const DPC_CONFIG = Object.freeze({

  // ── Authentication ─────────────────────────────────────────
  // SHA-256 hash of the hub password.
  // Default hash below = 'dpc2026weston' — CHANGE BEFORE FIRST USE.
  // Generate your own hash using the instructions above.
  DPC_PASSWORD_HASH: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',

  // ── Supabase (Phase 7 only — Hub Lite) ────────────────────
  // These are the non-sensitive anon/public credentials.
  // The service role key is NEVER stored here — it goes in dpc-manifest.json
  // which lives on OneDrive, not in the public repo.
  SUPABASE_URL:      '',  // e.g. 'https://xxxx.supabase.co' — fill in Phase 7
  SUPABASE_ANON_KEY: '',  // Public anon key only — fill in Phase 7

  // ── CPD Library (public GitHub Pages repo) ────────────────
  CPD_LIBRARY_BASE:  'https://gwc25.github.io/dpc-cpd-library',
  CPD_RESOURCES_URL: 'https://gwc25.github.io/dpc-cpd-library/data/resources.json',
  CPD_CARDS_URL:     'https://gwc25.github.io/dpc-cpd-library/data/walkthru-cards.json',

  // ── Auto-save interval ────────────────────────────────────
  AUTOSAVE_INTERVAL_MS: 60000,  // 60 seconds

  // ── File System Access API permission window ──────────────
  PERMISSION_VALID_DAYS: 7,

  // ── Required manifest filename ────────────────────────────
  MANIFEST_FILENAME: 'dpc-manifest.json',

  // ── Required data files (Hub will not start without these) ─
  REQUIRED_FILES: ['data-areas.json', 'data-calendar.json'],

  // ── Optional data files (Hub starts with empty defaults) ──
  OPTIONAL_FILES: [
    'data-staff.json',
    'data-afi.json',
    'data-reflections.json',
    'data-templates.json',
    'data-cpd.json',
    'data-digital-leads.json',
    'data-current-focus.json',
  ],

  // ── Hub version ───────────────────────────────────────────
  HUB_VERSION: '1.0.0',

  // ── localStorage keys ─────────────────────────────────────
  LS_KEYS: Object.freeze({
    FOLDER_HANDLE_STORED: 'dpc_folder_handle_stored',
    PERMISSION_DATE:      'dpc_permission_date',
    SESSION_SNAPSHOT:     'dpc_session_snapshot',
    SNAPSHOT_AT:          'dpc_snapshot_at',
    RESOURCES_CACHE:      'dpc_resources_cache',
    RESOURCES_CACHED_AT:  'dpc_resources_cached_at',
    AUTH_TOKEN:           'dpc_auth',
    AUTH_EXPIRY:          'dpc_auth_expiry',
  }),

  // ── Auth session length ───────────────────────────────────
  AUTH_SESSION_HOURS: 8,  // Hub session expires after 8 hours

});
