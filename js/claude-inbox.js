/* ================================================================
   claude-inbox.js — DPC Hub
   From Claude: notes Claude has written up, waiting for approval
   (October 2026).

   How it works
     1. Graeme talks a meeting through with Claude. Claude writes it
        up in the notes import format (notes-import.js) and saves it
        to the private GWC25/Files repository, in
        08-platforms/dpc-hub/inbox/, one file per meeting.
     2. This tab lists those files. Each one opens in the same review
        screen as typed or Copilot notes (meetingnotes.js), so the
        same checks, routing and privacy flags apply.
     3. Saving writes to the OneDrive folder through the normal save
        path. Nothing is saved until Graeme ticks and saves.

   What is stored where
     - The inbox files: private Files repository (initials only).
     - The read token: this browser only (localStorage). It is a
       fine-grained token with read-only access to Files. It is never
       in this public repository and the Hub never writes to GitHub.
     - Whether an item is done: worked out from the Hub's own data.
       An item counts as in the Hub once anything carrying its import
       ID exists (meeting, task, date, note or evidence). Dismissed
       items are remembered on this device only.
   ================================================================ */

const CI_REPO = 'GWC25/Files';
const CI_DIR = '08-platforms/dpc-hub/inbox';
const CI_TOKEN_KEY = 'dpc-claude-inbox-token-v1';
const CI_DISMISSED_KEY = 'dpc-claude-inbox-dismissed-v1';

let _ci = { items: null, error: null, loading: false, showAll: false, editing: null };

function _ciGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function _ciSet(key, val) { try { if (val == null) localStorage.removeItem(key); else localStorage.setItem(key, val); return true; } catch (e) { return false; } }
function _ciDismissed() { try { return JSON.parse(_ciGet(CI_DISMISSED_KEY) || '[]'); } catch (e) { return []; } }
function _ciSetDismissed(list) { _ciSet(CI_DISMISSED_KEY, JSON.stringify(list)); }

// ── GitHub (read only) ────────────────────────────────────────
async function _ciFetch(url, token, raw) {
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28' },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (res.status === 401) throw new Error('The token was refused. It may have expired. Add a new one below.');
  if (res.status === 403) throw new Error('The token cannot read the Files repository. Check it has Contents: Read-only on GWC25/Files.');
  if (!res.ok) throw new Error('GitHub replied ' + res.status + '. Try again in a minute.');
  return raw ? res.text() : res.json();
}

async function ciLoadInbox() {
  const token = _ciGet(CI_TOKEN_KEY);
  if (!token) return;
  _ci.loading = true; _ci.error = null;
  try {
    const list = await _ciFetch(`https://api.github.com/repos/${CI_REPO}/contents/${CI_DIR}?ref=main`, token, false);
    const files = (Array.isArray(list) ? list : []).filter(f => f.type === 'file' && /\.txt$/i.test(f.name));
    const texts = await Promise.all(files.map(f => _ciFetch(`https://api.github.com/repos/${CI_REPO}/contents/${encodeURI(f.path)}?ref=main`, token, true)));
    _ci.items = files.map((f, i) => _ciDescribe(f.name, texts[i] || '')).sort((a, b) => b.name.localeCompare(a.name));
  } catch (e) {
    _ci.error = e.message || String(e);
  } finally {
    _ci.loading = false;
  }
}

// Reads just enough of the text to list it. Full checks run on Review.
function _ciDescribe(name, text) {
  const line = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };
  const ref = line(/^Ref\s*:\s*(.+)$/mi).replace(/[^A-Za-z0-9_-]/g, '');
  const title = line(/^##\s*Meeting\s*:\s*(.+)$/mi) || line(/^##\s*[A-Za-z]+\s*:\s*(.+)$/m) || name.replace(/\.txt$/i, '');
  const date = line(/^Captured\s*:\s*(.+)$/mi);
  const area = line(/^Area\s*:\s*(.+)$/mi);
  const counts = {};
  (text.match(/^##\s*(Action|Date|Evidence|Note|Update)\s*:/gmi) || []).forEach(h => {
    const k = h.replace(/^##\s*/, '').replace(/\s*:$/, '').toLowerCase(); counts[k] = (counts[k] || 0) + 1;
  });
  const checks = (text.match(/^##\s*Check\s*$([\s\S]*)/mi) || ['', ''])[1].split('\n').filter(l => /^\s*[-*•]\s+\S/.test(l)).length;
  return { name, text, ref, title, date, area: /^none$/i.test(area) ? '' : area, counts, checks };
}

// In the Hub already if anything carries an importId from this ref.
function ciIsApplied(ref) {
  if (!ref) return false;
  const pre = ref + ':';
  const hit = (arr) => (arr || []).some(x => x && ((typeof x.importId === 'string' && x.importId.indexOf(pre) === 0) ||
    (Array.isArray(x.updateImportIds) && x.updateImportIds.some(u => String(u).indexOf(pre) === 0))));
  const D = window.DPC_DATA || {};
  if (hit(D.calendar && D.calendar.entries) || hit(D.notes && D.notes.notes)) return true;
  if (hit(D.activities && D.activities.activities)) return true;
  return ((D.areas && D.areas.areas) || []).some(a => hit(a.activityLog));
}

function ciStatus(item) {
  if (ciIsApplied(item.ref)) return 'applied';
  if (_ciDismissed().indexOf(item.ref || item.name) >= 0) return 'dismissed';
  return 'new';
}

// ── Render (inside the Meeting notes page) ───────────────────
function ciRender(panel) {
  const token = _ciGet(CI_TOKEN_KEY);
  if (!token) { _ciRenderSetup(panel, null); return; }
  if (_ci.editing) { _ciRenderEdit(panel); return; }
  if (_ci.items === null && !_ci.error) {
    panel.innerHTML = `<p class="mn-hint" role="status">Checking for notes from Claude…</p>`;
    ciLoadInbox().then(() => { if (document.getElementById('mn-panel') === panel && _mn.tab === 'claude') ciRender(panel); });
    return;
  }
  _ciRenderList(panel);
}

function _ciRenderSetup(panel, message) {
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ci-h-setup">
      <h3 id="ci-h-setup">Connect the Claude inbox</h3>
      <p class="mn-hint">Claude saves your talked-through notes to a private inbox, and the Hub sends Claude a copy of your task list so you can ask what is on today. The Hub needs a key for your private Files repository to do both. You do this once on each computer.</p>
      ${message ? `<div class="mn-err" role="alert"><p style="margin:0;">${_mnEsc(message)}</p></div>` : ''}
      <ol style="margin:0 0 var(--space-md);padding-left:20px;font-size:var(--text-sm);line-height:1.6;">
        <li>On GitHub, signed in as GWC25, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">New fine-grained token<span class="mn-sr"> (opens in a new tab)</span></a>.</li>
        <li>Name it <strong>DPC Hub and Claude</strong>. Resource owner: <strong>GWC25</strong>.</li>
        <li>Repository access: <strong>Only select repositories</strong>, then choose <strong>Files</strong>.</li>
        <li>Permissions: <strong>Contents: Read and write</strong>. Nothing else.</li>
        <li>Generate the token, copy it, and paste it below.</li>
      </ol>
      <div class="mn-field" style="max-width:520px;">
        <label for="ci-token">Token</label>
        <input id="ci-token" type="password" class="form-input" autocomplete="off" spellcheck="false" aria-describedby="ci-token-hint">
        <span id="ci-token-hint" class="mn-hint" style="margin:0;">Kept in this browser only. It works on the private Files repository and nothing else. The Hub uses it to read the inbox and to write one file: your task list for Claude.</span>
      </div>
      <div class="mn-actions-bar"><button type="button" id="ci-save-token" class="btn btn--primary">Save and check the inbox</button></div>
    </section>`;
  const inp = document.getElementById('ci-token');
  document.getElementById('ci-save-token').addEventListener('click', async () => {
    const v = inp.value.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(v)) { inp.focus(); _mnToast('error', 'That does not look like a GitHub token. Copy it again.'); return; }
    if (!_ciSet(CI_TOKEN_KEY, v)) { _mnToast('error', 'This browser would not keep the token. Private browsing may be on.'); return; }
    _ci.items = null; _ci.error = null;
    ciRender(panel);
    ciSyncTasks(true).then(() => { if (_mn.tab === 'claude' && !_ci.editing) _ciRenderSync(); });
  });
  if (!message) inp.focus();
}

function _ciRenderList(panel) {
  if (_ci.error && /token/i.test(_ci.error) && !_ci.items) { _ciRenderSetup(panel, _ci.error); return; }
  const items = _ci.items || [];
  const withStatus = items.map(it => ({ it, st: ciStatus(it) }));
  const fresh = withStatus.filter(x => x.st === 'new');
  const shown = _ci.showAll ? withStatus : fresh;
  const hidden = withStatus.length - fresh.length;
  const label = { new: 'New', applied: 'In the Hub', dismissed: 'Dismissed' };
  const connected = typeof hasFolderAccess === 'function' && hasFolderAccess();

  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ci-h-list">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <h3 id="ci-h-list" tabindex="-1">From Claude</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="ci-refresh" class="btn btn--secondary btn--sm">Check for new notes</button>
          ${hidden ? `<button type="button" id="ci-toggle" class="btn btn--ghost btn--sm" aria-pressed="${_ci.showAll}">${_ci.showAll ? 'Show new only' : 'Show all (' + withStatus.length + ')'}</button>` : ''}
        </div>
      </div>
      <p class="mn-hint">Notes you talked through with Claude. Review one to check where each part will go, then save the parts you want.</p>
      ${connected ? '' : `<div class="mn-callout" role="note"><h3>OneDrive folder not connected</h3><p class="mn-hint" style="margin:0;">You can review notes, but reconnect before saving so they reach your folder.</p></div>`}
      ${_ci.error ? `<div class="mn-err" role="alert"><p style="margin:0;">${_mnEsc(_ci.error)}</p></div>` : ''}
      ${shown.length ? `<ul style="list-style:none;margin:0;padding:0;">${shown.map(({ it, st }, i) => `
        <li class="mn-item" style="grid-template-columns:minmax(0,1fr);">
          <div>
            <h4 style="margin:0;font-size:var(--text-base);color:var(--color-navy);">${_mnEsc(it.title)}</h4>
            <div class="mn-meta">
              <span class="mn-chip${st === 'new' ? '' : ' mn-chip--update'}">${label[st]}</span>
              ${it.date ? `<span class="mn-chip">${_mnEsc(_ciDate(it.date))}</span>` : ''}
              ${it.area ? `<span class="mn-chip">Area ${_mnEsc(it.area)}</span>` : ''}
              ${Object.keys(it.counts).map(k => `<span class="mn-chip">${it.counts[k]} ${_mnEsc(k)}${it.counts[k] === 1 ? '' : 's'}</span>`).join('')}
              ${it.checks ? `<span class="mn-chip mn-chip--update">${it.checks} question${it.checks === 1 ? '' : 's'} to settle</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              <button type="button" class="btn btn--primary btn--sm" data-ci="review" data-i="${items.indexOf(it)}" aria-label="Review: ${_mnEsc(it.title)}">Review</button>
              <button type="button" class="btn btn--secondary btn--sm" data-ci="edit" data-i="${items.indexOf(it)}" aria-label="Edit text: ${_mnEsc(it.title)}">Edit text</button>
              ${st === 'dismissed'
                ? `<button type="button" class="btn btn--ghost btn--sm" data-ci="restore" data-i="${items.indexOf(it)}" aria-label="Restore: ${_mnEsc(it.title)}">Restore</button>`
                : st === 'new' ? `<button type="button" class="btn btn--ghost btn--sm" data-ci="dismiss" data-i="${items.indexOf(it)}" aria-label="Dismiss: ${_mnEsc(it.title)}">Dismiss</button>` : ''}
            </div>
          </div>
        </li>`).join('')}</ul>`
      : `<p class="mn-hint" style="margin:var(--space-sm) 0 0;">${items.length ? 'Nothing new. Everything here is already in the Hub or dismissed.' : 'The inbox is empty.'}</p>`}
    </section>
    <section class="mn-section" aria-labelledby="ci-h-sync">
      <h3 id="ci-h-sync">Your tasks for Claude</h3>
      <p class="mn-hint">After each save, the Hub sends Claude a copy of your open tasks and the next two weeks of your diary, so you can ask Claude what is on today. Names become initials in the copy.</p>
      <p id="ci-sync-status" class="mn-hint" role="status" style="margin:0 0 8px;"></p>
      <button type="button" id="ci-sync-now" class="btn btn--secondary btn--sm">Send tasks to Claude now</button>
    </section>
    <p class="mn-hint"><button type="button" id="ci-forget" class="btn btn--ghost btn--sm">Remove the key from this browser</button></p>`;

  document.getElementById('ci-refresh').addEventListener('click', async () => {
    _ci.items = null; _ci.error = null; ciRender(panel); _mnSay('Checking for new notes.');
  });
  document.getElementById('ci-toggle')?.addEventListener('click', () => { _ci.showAll = !_ci.showAll; _ciRenderList(panel); document.getElementById('ci-toggle')?.focus(); });
  _ciRenderSync();
  document.getElementById('ci-sync-now').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Sending…';
    await ciSyncTasks(true);
    b.disabled = false; b.textContent = 'Send tasks to Claude now';
    _ciRenderSync(); _mnSay(document.getElementById('ci-sync-status')?.textContent || '');
  });
  document.getElementById('ci-forget').addEventListener('click', () => {
    if (!confirm('Remove the key from this browser? You can add it again at any time.')) return;
    _ciSet(CI_TOKEN_KEY, null); _ci.items = null; ciRender(panel);
  });
  panel.querySelectorAll('[data-ci]').forEach(b => b.addEventListener('click', () => {
    const it = items[+b.dataset.i], act = b.dataset.ci, key = it.ref || it.name;
    if (act === 'review') { _mnReview(it.text, 'claude'); return; }
    if (act === 'edit') { _ci.editing = { name: it.name, text: it.text }; _ciRenderEdit(panel); return; }
    const list = _ciDismissed().filter(r => r !== key);
    if (act === 'dismiss') list.push(key);
    _ciSetDismissed(list);
    _ciRenderList(panel);
    _mnSay(act === 'dismiss' ? 'Dismissed.' : 'Restored.');
    document.getElementById('ci-h-list').focus();
  }));
  if (!_ci.loading) document.getElementById('ci-h-list').focus();
}

function _ciRenderSync() {
  const el = document.getElementById('ci-sync-status');
  if (!el) return;
  const st = ciSyncState(), connected = typeof hasFolderAccess === 'function' && hasFolderAccess();
  const when = (iso) => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const parts = [];
  if (st.at) parts.push('Last sent ' + when(st.at) + (st.open != null ? ', with ' + st.open + ' open task' + (st.open === 1 ? '' : 's') : '') + '.');
  else parts.push('Not sent yet.');
  if (st.error && (!st.at || st.errorAt > st.at)) parts.push(st.error);
  if (!connected) parts.push('Connect the OneDrive folder so the Hub can send your real list.');
  el.textContent = parts.join(' ');
}

function _ciRenderEdit(panel) {
  const e = _ci.editing;
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ci-h-edit">
      <h3 id="ci-h-edit" tabindex="-1">Edit before review</h3>
      <p class="mn-hint">Change anything, for example initials or an area code. Changes here are used for this review only; the inbox copy stays as it is.</p>
      <label for="ci-edit" class="mn-sr">Notes import text</label>
      <textarea id="ci-edit" class="form-textarea" rows="18" style="width:100%;font-family:monospace;font-size:13px;">${_mnEsc(e.text)}</textarea>
      <div class="mn-actions-bar">
        <button type="button" id="ci-edit-review" class="btn btn--primary">Review</button>
        <button type="button" id="ci-edit-cancel" class="btn btn--secondary">Back to the inbox</button>
      </div>
    </section>`;
  const ta = document.getElementById('ci-edit');
  ta.addEventListener('input', () => { e.text = ta.value; });
  document.getElementById('ci-edit-review').addEventListener('click', () => { _mnReview(e.text, 'claude'); });
  document.getElementById('ci-edit-cancel').addEventListener('click', () => { _ci.editing = null; _ciRenderList(panel); });
  document.getElementById('ci-h-edit').focus();
}

function _ciDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Task list for Claude (October 2026) ───────────────────────
// After each save to the OneDrive folder, and once at start-up, the Hub
// writes a copy of the task list to the private Files repository so
// Claude can answer "what's on today?". The Hub stays the only master
// copy; Claude sends changes back through the inbox for approval.
//
// Needs the inbox key to have Contents: Read and write on Files. With a
// read-only key the copy is skipped and the From Claude tab says why.
// Only runs while the folder is connected, so a Hub that opened without
// its data never overwrites the copy with an empty list.
const CI_TASKS_PATH = '08-platforms/dpc-hub/status/tasks.json';
const CI_SYNC_KEY = 'dpc-claude-task-sync-v1';
let _ciSyncTimer = null, _ciSyncing = false;

function ciSyncState() { try { return JSON.parse(_ciGet(CI_SYNC_KEY) || '{}'); } catch (e) { return {}; } }
function _ciSetSyncState(st) { _ciSet(CI_SYNC_KEY, JSON.stringify({ ...ciSyncState(), ...st })); }

function ciQueueTaskSync(delay) {
  clearTimeout(_ciSyncTimer);
  _ciSyncTimer = setTimeout(() => { ciSyncTasks().catch(() => { /* recorded in sync state */ }); }, delay == null ? 8000 : delay);
}

function ciBuildTaskSnapshot() {
  const D = window.DPC_DATA || {};
  const cal = (D.calendar && D.calendar.entries) || [];
  const focuses = (D.currentFocus && D.currentFocus.focuses) || [];
  const areaNames = ((D.areas && D.areas.areas) || []).map(a => a.areaName || '');
  const clean = (t) => (typeof niInitialiseNames === 'function' ? niInitialiseNames(t, areaNames) : String(t || ''));
  const today = todayISO();
  const fortnightAgo = (() => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const ahead = (() => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); })();
  const focusTitle = (id) => { const f = focuses.find(x => x.focusId === id); return f ? clean(f.title) : null; };
  const meetingTitle = (id) => { const m = cal.find(e => e.entryId === id); return m ? clean(m.title) : null; };

  const tasks = cal.filter(e => e.entryType === 'task')
    .filter(t => t.status !== 'complete' || (t.date && t.date >= fortnightAgo))
    .map(t => ({
      id: t.entryId,
      title: clean(t.title),
      due: t.date || null,
      doOn: t.doDate || null,
      status: t.status || 'upcoming',
      area: t.areaCode || null,
      focus: focusTitle(t.linkedFocusId),
      people: (t.personRefs || []).map(clean),
      steps: (t.microTasks || []).map(m => ({ title: clean(m.title), done: !!m.done })),
      fromMeeting: t.sourceRef && t.sourceRef.entryId ? meetingTitle(t.sourceRef.entryId) : null,
      notes: t.notes ? clean(String(t.notes).slice(0, 300)) : null,
    }))
    .sort((a, b) => String(a.doOn || a.due || '').localeCompare(String(b.doOn || b.due || '')));

  const diary = cal.filter(e => e.entryType !== 'task' && e.date && e.date >= today && e.date <= ahead)
    .map(e => ({ date: e.date, time: e.startTime || null, endTime: e.endTime || null, kind: e.entryType, title: clean(e.title), area: e.areaCode || null }))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const focusList = focuses.filter(f => f.status !== 'complete').map(f => clean(f.title || 'Untitled focus'));
  return { format: 'dpc-hub-tasks v1', today, openTasks: tasks.filter(t => t.status !== 'complete').length, tasks, diary, focuses: focusList };
}

function _ciB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function ciSyncTasks(force) {
  const token = _ciGet(CI_TOKEN_KEY);
  if (!token || _ciSyncing) return;
  if (typeof hasFolderAccess === 'function' && !hasFolderAccess()) return;
  const snap = ciBuildTaskSnapshot();
  const body = JSON.stringify(snap, null, 2);
  const sig = (typeof _ciSig === 'function') ? _ciSig(body) : body.length;
  if (!force && ciSyncState().sig === sig) return;
  _ciSyncing = true;
  const url = `https://api.github.com/repos/${CI_REPO}/contents/${CI_TASKS_PATH}`;
  const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await fetch(url + '?ref=main', { headers, cache: 'no-store' });
      const sha = cur.ok ? (await cur.json()).sha : null;
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({
        message: 'Hub: task list for Claude (' + snap.openTasks + ' open)', branch: 'main',
        content: _ciB64(body + '\n'), ...(sha ? { sha } : {}) }) });
      if (res.ok) { _ciSetSyncState({ sig, at: new Date().toISOString(), error: null, open: snap.openTasks }); return; }
      if ((res.status === 409 || res.status === 422) && attempt === 0) continue; // someone else wrote it; fetch the new sha once
      const msg = res.status === 403 || res.status === 404
        ? 'Your inbox key can only read. To send tasks to Claude, replace it with one that has Contents: Read and write on Files.'
        : res.status === 401 ? 'The inbox key was refused. It may have expired.' : 'GitHub replied ' + res.status + '.';
      _ciSetSyncState({ error: msg, errorAt: new Date().toISOString() });
      return;
    }
  } catch (e) {
    _ciSetSyncState({ error: 'Could not reach GitHub to send tasks. The Hub will try again after the next save.', errorAt: new Date().toISOString() });
  } finally {
    _ciSyncing = false;
  }
}

// Small stable signature, so an unchanged list is not sent again.
// "today" is left out, so a new day alone does not trigger a write.
function _ciSig(s) {
  const t = s.replace(/"today": "[^"]*",?/, '');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + t.length;
}
