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
  const title = line(/^##\s*Meeting\s*:\s*(.+)$/mi) || name.replace(/\.txt$/i, '');
  const date = line(/^Captured\s*:\s*(.+)$/mi);
  const area = line(/^Area\s*:\s*(.+)$/mi);
  const counts = {};
  (text.match(/^##\s*(Action|Date|Evidence|Note)\s*:/gmi) || []).forEach(h => {
    const k = h.replace(/^##\s*/, '').replace(/\s*:$/, '').toLowerCase(); counts[k] = (counts[k] || 0) + 1;
  });
  const checks = (text.match(/^##\s*Check\s*$([\s\S]*)/mi) || ['', ''])[1].split('\n').filter(l => /^\s*[-*•]\s+\S/.test(l)).length;
  return { name, text, ref, title, date, area: /^none$/i.test(area) ? '' : area, counts, checks };
}

// In the Hub already if anything carries an importId from this ref.
function ciIsApplied(ref) {
  if (!ref) return false;
  const pre = ref + ':';
  const hit = (arr) => (arr || []).some(x => x && typeof x.importId === 'string' && x.importId.indexOf(pre) === 0);
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
      <p class="mn-hint">Claude saves your talked-through notes to a private inbox. The Hub needs a read-only key to see them. You do this once on each computer.</p>
      ${message ? `<div class="mn-err" role="alert"><p style="margin:0;">${_mnEsc(message)}</p></div>` : ''}
      <ol style="margin:0 0 var(--space-md);padding-left:20px;font-size:var(--text-sm);line-height:1.6;">
        <li>On GitHub, signed in as GWC25, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">New fine-grained token<span class="mn-sr"> (opens in a new tab)</span></a>.</li>
        <li>Name it <strong>DPC Hub inbox (read only)</strong>. Resource owner: <strong>GWC25</strong>.</li>
        <li>Repository access: <strong>Only select repositories</strong>, then choose <strong>Files</strong>.</li>
        <li>Permissions: <strong>Contents: Read-only</strong>. Nothing else.</li>
        <li>Generate the token, copy it, and paste it below.</li>
      </ol>
      <div class="mn-field" style="max-width:520px;">
        <label for="ci-token">Read-only token</label>
        <input id="ci-token" type="password" class="form-input" autocomplete="off" spellcheck="false" aria-describedby="ci-token-hint">
        <span id="ci-token-hint" class="mn-hint" style="margin:0;">Kept in this browser only. It can read the Files repository and nothing else.</span>
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
    <p class="mn-hint"><button type="button" id="ci-forget" class="btn btn--ghost btn--sm">Remove the inbox token from this browser</button></p>`;

  document.getElementById('ci-refresh').addEventListener('click', async () => {
    _ci.items = null; _ci.error = null; ciRender(panel); _mnSay('Checking for new notes.');
  });
  document.getElementById('ci-toggle')?.addEventListener('click', () => { _ci.showAll = !_ci.showAll; _ciRenderList(panel); document.getElementById('ci-toggle')?.focus(); });
  document.getElementById('ci-forget').addEventListener('click', () => {
    if (!confirm('Remove the inbox token from this browser? You can add it again at any time.')) return;
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
