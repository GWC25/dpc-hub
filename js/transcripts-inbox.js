/* ================================================================
   transcripts-inbox.js — DPC Hub
   From meeting summaries: Copilot summaries of meeting transcripts,
   read from the OneDrive folder (November 2026).

   How it works
     1. Graeme records and transcribes a meeting. The transcript stays
        in its own OneDrive folder, outside the Hub (it has full names).
     2. His Copilot agent turns the transcript into the notes import
        format (notes-import.js), initials only.
     3. He pastes the agent's reply into a Word document (or a .txt
        file) and saves it in "Meeting summaries" inside the Hub's
        OneDrive folder.
     4. This tab lists those files. Each one opens in the same review
        screen as typed, paper or Claude notes (meetingnotes.js), so
        the same checks, routing and privacy flags apply. Nothing is
        saved until Graeme ticks and saves.

   There is no AI in the Hub. Copilot does the summarising; the Hub
   only reads the fixed format and routes each block by its type and
   area code.

   Whether a file is done is worked out from the Hub's own data
   (ciIsApplied in claude-inbox.js): it counts as in the Hub once
   anything carries an import ID from its Ref. Dismissed files are
   remembered on this device only. The Hub never changes or deletes
   the files.
   ================================================================ */

const TI_FOLDER = 'Meeting summaries';
const TI_DISMISSED_KEY = 'dpc-transcript-inbox-dismissed-v1';

let _ti = { items: null, error: null, loading: false, showAll: false, editing: null };

function _tiDismissed() { try { return JSON.parse(localStorage.getItem(TI_DISMISSED_KEY) || '[]'); } catch (e) { return []; } }
function _tiSetDismissed(list) { try { localStorage.setItem(TI_DISMISSED_KEY, JSON.stringify(list)); } catch (e) { /* this device only anyway */ } }

async function tiLoad() {
  _ti.loading = true; _ti.error = null;
  try {
    const files = (await listFilesInSubfolder(TI_FOLDER)).filter(f => /\.(docx|txt|md)$/i.test(f.name));
    const items = [];
    for (const f of files) {
      let text = '', readError = null;
      try { text = await fileToText(f.file); } catch (e) { readError = e.message || String(e); }
      const it = _ciDescribe(f.name, text);
      // A Copilot reply may have no Ref line; use the same one the
      // parser derives, so "In the Hub" still works after saving.
      if (!it.ref && text && typeof niParse === 'function') it.ref = niParse(text, {}).header.ref || '';
      if (it.title === f.name.replace(/\.txt$/i, '')) it.title = f.name.replace(/\.(docx|txt|md)$/i, '');
      it.modified = f.lastModified;
      it.readError = readError || (text && !/DPC HUB NOTES IMPORT/i.test(text) ? 'This file does not contain the import text. Paste the whole Copilot reply into it.' : null);
      items.push(it);
    }
    _ti.items = items;
  } catch (e) {
    _ti.error = e.message || String(e);
  } finally {
    _ti.loading = false;
  }
}

function _tiStatus(item) {
  if (item.ref && typeof ciIsApplied === 'function' && ciIsApplied(item.ref)) return 'applied';
  if (_tiDismissed().indexOf(item.name) >= 0) return 'dismissed';
  return 'new';
}

// ── Render (inside the Meeting notes page) ───────────────────
function tiRender(panel) {
  const connected = typeof hasFolderAccess === 'function' && hasFolderAccess();
  if (!connected) { _tiRenderConnect(panel); return; }
  if (_ti.editing) { _tiRenderEdit(panel); return; }
  if (_ti.items === null && !_ti.error) {
    panel.innerHTML = `<p class="mn-hint" role="status">Reading the ${_mnEsc(TI_FOLDER)} folder…</p>`;
    tiLoad().then(() => { if (document.getElementById('mn-panel') === panel && _mn.tab === 'transcript') tiRender(panel); });
    return;
  }
  _tiRenderList(panel);
}

function _tiRenderConnect(panel) {
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ti-h-connect">
      <h3 id="ti-h-connect" tabindex="-1">Connect your OneDrive folder</h3>
      <p class="mn-hint">Meeting summaries are read from the "${_mnEsc(TI_FOLDER)}" folder inside your Hub folder, so the folder needs to be connected first.</p>
      <div class="mn-actions-bar"><button type="button" id="ti-reconnect" class="btn btn--primary">Reconnect the folder</button></div>
    </section>`;
  document.getElementById('ti-reconnect').addEventListener('click', async () => {
    if (typeof requestStoredFolderPermission !== 'function' || !(await requestStoredFolderPermission())) {
      _mnToast('error', 'The folder could not be reconnected here. Use Settings to choose it again.');
      return;
    }
    try { sessionStorage.setItem('dpc-meeting-notes-return', 'transcript'); } catch (err) { /* lands on home instead */ }
    location.reload();
  });
}

function _tiWhen(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function _tiRenderList(panel) {
  const items = _ti.items || [];
  const withStatus = items.map(it => ({ it, st: _tiStatus(it) }));
  const fresh = withStatus.filter(x => x.st === 'new');
  const shown = _ti.showAll ? withStatus : fresh;
  const hidden = withStatus.length - fresh.length;
  const label = { new: 'New', applied: 'In the Hub', dismissed: 'Dismissed' };

  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ti-h-list">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <h3 id="ti-h-list" tabindex="-1">From meeting summaries</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="ti-refresh" class="btn btn--secondary btn--sm">Check the folder</button>
          ${hidden ? `<button type="button" id="ti-toggle" class="btn btn--ghost btn--sm" aria-pressed="${_ti.showAll}">${_ti.showAll ? 'Show new only' : 'Show all (' + withStatus.length + ')'}</button>` : ''}
        </div>
      </div>
      <p class="mn-hint">Copilot summaries of your meeting transcripts. Save each one as a Word or text file in the "${_mnEsc(TI_FOLDER)}" folder inside your Hub folder. Keep the transcripts themselves somewhere else, because they contain full names.</p>
      ${_ti.error ? `<div class="mn-err" role="alert"><p style="margin:0;">The folder could not be read: ${_mnEsc(_ti.error)}</p></div>` : ''}
      ${shown.length ? `<ul style="list-style:none;margin:0;padding:0;">${shown.map(({ it, st }) => {
        const i = items.indexOf(it);
        return `
        <li class="mn-item" style="grid-template-columns:minmax(0,1fr);">
          <div>
            <h4 style="margin:0;font-size:var(--text-base);color:var(--color-navy);">${_mnEsc(it.title)}</h4>
            <div class="mn-meta">
              <span class="mn-chip${st === 'new' ? '' : ' mn-chip--update'}">${label[st]}</span>
              ${it.date ? `<span class="mn-chip">Meeting ${_mnEsc(_ciDate(it.date))}</span>` : ''}
              ${it.area ? `<span class="mn-chip">Area ${_mnEsc(it.area)}</span>` : ''}
              ${Object.keys(it.counts).map(k => `<span class="mn-chip">${it.counts[k]} ${_mnEsc(k)}${it.counts[k] === 1 ? '' : 's'}</span>`).join('')}
              ${it.checks ? `<span class="mn-chip mn-chip--update">${it.checks} question${it.checks === 1 ? '' : 's'} to settle</span>` : ''}
            </div>
            <p class="mn-hint" style="margin:4px 0 0;">File: ${_mnEsc(it.name)} · saved ${_mnEsc(_tiWhen(it.modified))}</p>
            ${it.readError ? `<p class="mn-hint" style="margin:4px 0 0;color:var(--color-red, #a4262c);font-weight:600;">${_mnEsc(it.readError)}</p>` : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              ${it.readError && !it.text ? '' : `<button type="button" class="btn btn--primary btn--sm" data-ti="review" data-i="${i}" aria-label="Review: ${_mnEsc(it.title)}">Review</button>
              <button type="button" class="btn btn--secondary btn--sm" data-ti="edit" data-i="${i}" aria-label="Edit text: ${_mnEsc(it.title)}">Edit text</button>`}
              ${st === 'dismissed'
                ? `<button type="button" class="btn btn--ghost btn--sm" data-ti="restore" data-i="${i}" aria-label="Restore: ${_mnEsc(it.title)}">Restore</button>`
                : st === 'new' ? `<button type="button" class="btn btn--ghost btn--sm" data-ti="dismiss" data-i="${i}" aria-label="Dismiss: ${_mnEsc(it.title)}">Dismiss</button>` : ''}
            </div>
          </div>
        </li>`; }).join('')}</ul>`
      : `<p class="mn-hint" style="margin:var(--space-sm) 0 0;">${items.length ? 'Nothing new. Everything here is already in the Hub or dismissed.' : 'No summaries yet. Save a Copilot summary into the "' + _mnEsc(TI_FOLDER) + '" folder, then check again.'}</p>`}
    </section>`;

  document.getElementById('ti-refresh').addEventListener('click', () => {
    _ti.items = null; _ti.error = null; tiRender(panel); _mnSay('Checking the folder.');
  });
  document.getElementById('ti-toggle')?.addEventListener('click', () => { _ti.showAll = !_ti.showAll; _tiRenderList(panel); document.getElementById('ti-toggle')?.focus(); });
  panel.querySelectorAll('[data-ti]').forEach(b => b.addEventListener('click', () => {
    const it = items[+b.dataset.i], act = b.dataset.ti;
    if (act === 'review') { _mnReview(it.text, 'transcript'); return; }
    if (act === 'edit') { _ti.editing = { name: it.name, text: it.text }; _tiRenderEdit(panel); return; }
    const list = _tiDismissed().filter(n => n !== it.name);
    if (act === 'dismiss') list.push(it.name);
    _tiSetDismissed(list);
    _tiRenderList(panel);
    _mnSay(act === 'dismiss' ? 'Dismissed.' : 'Restored.');
    document.getElementById('ti-h-list').focus();
  }));
  if (!_ti.loading) document.getElementById('ti-h-list').focus();
}

function _tiRenderEdit(panel) {
  const e = _ti.editing;
  panel.innerHTML = `
    <section class="mn-section" aria-labelledby="ti-h-edit">
      <h3 id="ti-h-edit" tabindex="-1">Edit before review</h3>
      <p class="mn-hint">Change anything, for example initials or an area code. Changes here are used for this review only; the file in your folder stays as it is.</p>
      <label for="ti-edit" class="mn-sr">Notes import text</label>
      <textarea id="ti-edit" class="form-textarea" rows="18" style="width:100%;font-family:monospace;font-size:13px;">${_mnEsc(e.text)}</textarea>
      <div class="mn-actions-bar">
        <button type="button" id="ti-edit-review" class="btn btn--primary">Review</button>
        <button type="button" id="ti-edit-cancel" class="btn btn--secondary">Back to the summaries</button>
      </div>
    </section>`;
  const ta = document.getElementById('ti-edit');
  ta.addEventListener('input', () => { e.text = ta.value; });
  document.getElementById('ti-edit-review').addEventListener('click', () => { _mnReview(e.text, 'transcript'); });
  document.getElementById('ti-edit-cancel').addEventListener('click', () => { _ti.editing = null; _tiRenderList(panel); });
  document.getElementById('ti-h-edit').focus();
}
