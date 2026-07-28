// DPC Hub · js/supabase-sync.js · v1.0 · July 2026
// Phase 7 — Supabase capture review & commit.
//
// Purpose: desktop Hub reads pending (synced = false) captures written by
// Hub Lite (mobile), shows them to Graeme for review, and on approval:
//   1. commits the capture into the right Tier 2 OneDrive location via the
//      existing saveCalendarEntry() / saveNote() functions in data.js
//   2. marks the capture synced = true in Supabase (RLS-permitted update)
//
// Routing (confirmed):
//   capture_type = 'calendar_entry'                 → data-calendar.json
//   capture_type = 'meeting_shell' | 'quick_note'    → data-notes.json
//
// There is no "reject" — Supabase RLS only permits inserting, selecting
// where synced = false, and updating synced false → true. "Skip for now"
// below only hides a capture from the current session's list; nothing is
// written to Supabase, so it reappears next time the Hub loads.
//
// IMPORTANT: this file must load AFTER js/data.js in hub.html. Its
// checkSupabaseCaptures() declaration below overrides the harmless stub
// defined in data.js — same override convention already used for
// initReports()/initAISupport() in app.js. Do not add a stub for this
// function back into data.js or app.js.

let _pendingCaptures = [];

// ── Public: called from loadHub() (data.js), non-blocking ──────
async function checkSupabaseCaptures() {
  if (!DPC_CONFIG.SUPABASE_URL || !DPC_CONFIG.SUPABASE_ANON_KEY) return;

  try {
    _pendingCaptures = await _fetchPendingCaptures();
    _renderCaptureBanner();
    if (typeof UI !== 'undefined') UI.updateNotificationBadge(_pendingCaptures.length);
  } catch (err) {
    // Non-blocking by design — a failed Supabase check should never stop
    // the Hub from loading. Silent to the user, logged for diagnosis.
    console.warn('DPC Hub: could not check Supabase captures:', err);
  }
}

// ── Fetch pending captures from Supabase ────────────────────────
// Supabase's newer sb_publishable_... keys are NOT JWTs — they must go
// ONLY in the apikey header. Sending one in Authorization: Bearer ...
// (even the same value) is rejected with 401. Leave Authorization unset
// for anonymous/publishable-key requests — this is Supabase's current
// documented behaviour, not specific to this project.
async function _fetchPendingCaptures() {
  const url = `${DPC_CONFIG.SUPABASE_URL}/rest/v1/dpc_captures?synced=eq.false&select=*&order=captured_at.asc`;
  const resp = await fetch(url, {
    headers: {
      apikey: DPC_CONFIG.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) throw new Error(`Supabase fetch failed: ${resp.status}`);
  return await resp.json();
}

// ── Mark a capture synced in Supabase (RLS: false → true only) ─
async function _markCaptureSynced(captureId) {
  const url = `${DPC_CONFIG.SUPABASE_URL}/rest/v1/dpc_captures?id=eq.${captureId}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: DPC_CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ synced: true, synced_at: nowISO() }),
  });
  if (!resp.ok) throw new Error(`Supabase update failed: ${resp.status}`);
}

// ── Commit an approved capture into the right OneDrive file ────
function _commitCapture(capture) {
  if (capture.capture_type === 'calendar_entry') {
    const entry = {
      entryId:    generateId(),
      entryType:  CALENDAR_TYPE.MEETING,
      title:      _deriveTitle(capture.content),
      date:       (capture.captured_at || '').split('T')[0] || todayISO(),
      startTime:  null,
      endTime:    null,
      personRefs: [],
      areaCode:   capture.area_code || null,
      projectRef: null,
      status:     TASK_STATUS.UPCOMING,
      notes:      capture.content,
      microTasks: [],
      isSurfaceLayerVisible: true,
    };
    saveCalendarEntry(entry);
  } else {
    // meeting_shell or quick_note
    const note = {
      noteId:     generateId(),
      type:       capture.capture_type,
      areaCode:   capture.area_code || null,
      content:    capture.content,
      capturedAt: capture.captured_at,  // preserve original, don't overwrite
      reviewedAt: nowISO(),
      source:     'hub-lite',
    };
    saveNote(note);
  }
}

// Calendar captures have no separate title field from Hub Lite — derive
// a short one from the first line of the free-text content so the entry
// isn't blank in Week/Month view. Full text is preserved in .notes.
function _deriveTitle(content) {
  if (!content) return 'Captured entry';
  const firstLine = content.split('\n')[0].trim();
  if (!firstLine) return 'Captured entry';
  return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
}

// ── Approve: mark synced remotely FIRST, then commit locally ────
// Order matters: if the remote update fails, nothing local should
// change, so the capture stays safely retryable with no risk of a
// duplicate entry being written to OneDrive on a second attempt.
async function _approveCapture(captureId) {
  const capture = _pendingCaptures.find(c => c.id === captureId);
  if (!capture) return;

  try {
    await _markCaptureSynced(captureId);
    _commitCapture(capture);
    _pendingCaptures = _pendingCaptures.filter(c => c.id !== captureId);
    _renderCaptureBanner();
    if (typeof UI !== 'undefined') {
      UI.updateNotificationBadge(_pendingCaptures.length);
      UI.showToast('success', 'Capture committed and marked reviewed.');
    }
  } catch (err) {
    console.error('DPC Hub: failed to approve capture:', err);
    if (typeof UI !== 'undefined') {
      UI.showToast('error', 'Could not commit that capture — check your connection and try again.');
    }
  }
}

// ── Skip: hide locally for this session only ─────────────────────
// Nothing is written to Supabase, so this capture will appear again
// next time the Hub loads (or on manual refresh of this list).
function _skipCapture(captureId) {
  _pendingCaptures = _pendingCaptures.filter(c => c.id !== captureId);
  _renderCaptureBanner();
  if (typeof UI !== 'undefined') UI.updateNotificationBadge(_pendingCaptures.length);
}

// ── Banner + review panel rendering ──────────────────────────────
function _renderCaptureBanner() {
  const banner  = document.getElementById('capture-review-banner');
  const summary = document.getElementById('capture-review-summary');
  const panel   = document.getElementById('capture-review-panel');
  if (!banner || !summary || !panel) return;

  if (_pendingCaptures.length === 0) {
    banner.style.display = 'none';
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  banner.style.display = 'flex';
  banner.style.flexDirection = 'column';
  summary.textContent = `${_pendingCaptures.length} capture${_pendingCaptures.length !== 1 ? 's' : ''} pending review`;

  panel.innerHTML = _pendingCaptures.map(c => `
    <div style="background:#fff;border:1px solid #BFDBFE;border-radius:4px;padding:12px;margin-top:8px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:bold;background:#DBEAFE;color:#1D4ED8;padding:1px 8px;border-radius:999px;">${_scEsc(_scLabel(c.capture_type))}</span>
        ${c.area_code ? `<span style="font-size:12px;font-weight:bold;background:#1D3557;color:#fff;padding:1px 8px;border-radius:999px;">${_scEsc(c.area_code)}</span>` : ''}
        <span style="font-size:12px;color:#64748B;">${_scFmtDate(c.captured_at)}</span>
      </div>
      <p style="font-size:14px;color:#334155;margin-bottom:10px;white-space:pre-wrap;">${_scEsc(c.content)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" data-approve="${c.id}" style="padding:6px 14px;background:#0F766E;color:#fff;border:none;border-radius:4px;font:bold 13px Arial,sans-serif;cursor:pointer;min-height:36px;">Approve &amp; commit</button>
        <button type="button" data-skip="${c.id}" style="padding:6px 14px;background:transparent;color:#64748B;border:1px solid #CBD5E1;border-radius:4px;font:13px Arial,sans-serif;cursor:pointer;min-height:36px;">Skip for now</button>
      </div>
    </div>
  `).join('');
}

function _scLabel(type) {
  return { calendar_entry: 'Calendar entry', meeting_shell: 'Meeting shell', quick_note: 'Quick note' }[type] || type;
}

function _scEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _scFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

// ── Wire banner controls (static markup — safe to wire on load) ─
document.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('capture-review-toggle');
  const dismiss = document.getElementById('capture-review-dismiss');
  const panel   = document.getElementById('capture-review-panel');
  const banner  = document.getElementById('capture-review-banner');

  toggle?.addEventListener('click', () => {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    toggle.textContent = isOpen ? 'Review' : 'Hide';
  });

  dismiss?.addEventListener('click', () => {
    if (banner) banner.style.display = 'none';
  });

  panel?.addEventListener('click', e => {
    const approveBtn = e.target.closest('[data-approve]');
    const skipBtn    = e.target.closest('[data-skip]');
    if (approveBtn) _approveCapture(approveBtn.dataset.approve);
    if (skipBtn)    _skipCapture(skipBtn.dataset.skip);
  });
});
