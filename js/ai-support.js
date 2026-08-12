/* ================================================================
   ai-support.js — DPC Hub
   AI Support module: Anthropic API calls live here and ONLY here.
   No other module should call the Anthropic API directly.

   Current scope:
   - generateNarrative() — performance review AI narrative prose
   - analyzeIndustrySkillsAmendment() — Industry Digital Skills
     multi-format diff-and-confirm (Session 60). Lives on each Area's
     Digital Skills tab, not as its own screen here, since it needs
     that area's live skill list as context — but this page links to
     it (Session 61: it wasn't discoverable from here before).

   Future scope (not built yet):
   - Area overview synthesis (individual-support vs whole-team-thread)
     for Action Plans
   - Bulk Action Plan generation from Health Checks

   Key handling: the Anthropic API key is never stored in DPC.DB,
   never written to OneDrive, never persisted to localStorage.
   It lives only in a module-level variable for the current browser
   session and is re-requested every time the page reloads.
   ================================================================ */

window.DPC = window.DPC || {};

// ── MODULE PAGE ─────────────────────────────────────────────────
// Registered in app.js's MODULES table as data-module="aisupport".
// Renders into the shared #main-content container, same convention
// as every other module (initAreas, initReflections, etc).
function initAISupport() {
  const el = document.getElementById('main-content');
  if (!el) return;

  const hasKey = !!DPC.AISupport._sessionKey;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];

  el.innerHTML = `
    <div class="card" style="max-width:640px;">
      <div class="card-header"><span class="card-title">AI Support</span></div>
      <div class="card-body">
        <p style="color:var(--color-muted);margin-bottom:var(--space-md);">
          Anthropic API calls for the Hub live here. This page lists what's actually built and where to use it — not everything AI Support powers has its own screen here, since some of it only makes sense with an Area already open.
        </p>

        <div style="background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
          <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Session API key</p>
          <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);">
            ${hasKey ? 'A key is set for this browser session.' : 'No key set — you\u2019ll be asked for one the first time any AI Support feature is used.'}
          </p>
          ${hasKey ? `<button class="btn btn--ghost btn--sm" id="ai-clear-key-btn" type="button">Clear session key</button>` : ''}
        </div>

        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:8px;">What's live right now</p>

        <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">Performance review narrative</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);">In Reports — generates the written narrative for a staff performance review.</p>
        </div>

        <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">Industry Digital Skills — amendment analysis</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">
            On each Area's Digital Skills tab: upload a HoA/DL's amended Word doc, Excel sheet, PDF, or a screenshot, and it proposes a structured diff against that area's current skill list — nothing applies automatically, you confirm each change first.
          </p>
          ${areas.length > 0 ? `
            <select id="ai-jump-area" class="form-select" style="max-width:280px;">
              <option value="">Jump to an area's Digital Skills tab…</option>
              ${areas.map(a => `<option value="${a.areaCode}">${a.areaName} (${a.areaCode})</option>`).join('')}
            </select>
          ` : ''}
        </div>

        <div class="empty-state" style="padding:var(--space-md) 0;">
          <p class="empty-state__body">RAG Matrix, Health Checks, Meeting Notes, and QSR document-workbench data types are next in progress — the workbench below is built generally, they'll slot in as their own dataType without changing how it works.</p>
        </div>

        <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-lg) 0;">

        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Document workbench</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:var(--space-md);">Upload a document (Word, Excel, PDF, or a screenshot), pick or write a prompt, tag what it's for, and run it. Nothing is created until you review and confirm.</p>

        <input type="file" id="ai-doc-file" accept=".docx,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp" style="margin-bottom:8px;">

        <select id="ai-prompt-select" class="form-select" style="margin-bottom:8px;">
          <option value="">Write a custom prompt…</option>
          ${getAIPrompts().map(p => `<option value="${p.templateId}">${_aiEsc(p.title)} (${_aiEsc(AI_PROMPT_DATA_TYPE_LABELS[p.dataType]||p.dataType)})</option>`).join('')}
        </select>

        <textarea id="ai-prompt-text" class="form-textarea" rows="2" placeholder="e.g. Extract tasks assigned to me from this document" style="width:100%;margin-bottom:8px;"></textarea>

        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:8px;">
          <select id="ai-data-type" class="form-select">
            ${Object.values(AI_PROMPT_DATA_TYPES).map(dt => `<option value="${dt}" ${dt==='tasks'?'selected':''}>${_aiEsc(AI_PROMPT_DATA_TYPE_LABELS[dt])}</option>`).join('')}
          </select>
          <label style="font-size:var(--text-xs);white-space:nowrap;"><input type="checkbox" id="ai-save-prompt-cb"> Save this prompt for reuse</label>
        </div>

        <button type="button" id="ai-run-btn" class="btn btn--primary btn--sm">Run</button>
        <p id="ai-run-status" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:8px;"></p>
        <div id="ai-run-results" style="margin-top:var(--space-md);"></div>

        <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-lg) 0;">

        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Import outcomes (no API cost)</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">
          If you've already had a document analysed in a Claude conversation or Project (using your Claude subscription, not this Hub's API key), paste the JSON result here instead of re-running it through the live workbench above — same review-before-apply screen, zero extra API cost.
        </p>
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-size:var(--text-xs);color:var(--color-teal);">What shape does the JSON need to be?</summary>
          <pre style="background:var(--color-light);border-radius:var(--radius-sm);padding:8px;font-size:10px;overflow-x:auto;margin-top:4px;">{"tasks":[{"description":"...","assignedTo":"...","deadline":"YYYY-MM-DD or null","detail":"...","isMine":true|false}]}</pre>
          <p style="font-size:10px;color:var(--color-muted);">Only "Tasks" can actually be applied right now — the same limit as the live workbench above. Give this exact shape to whatever Claude conversation or Project is doing the analysis.</p>
        </details>
        <select id="ai-import-type" class="form-select" style="margin-bottom:8px;max-width:280px;">
          ${Object.values(AI_PROMPT_DATA_TYPES).map(dt => `<option value="${dt}" ${dt==='tasks'?'selected':''}>${_aiEsc(AI_PROMPT_DATA_TYPE_LABELS[dt])}</option>`).join('')}
        </select>
        <textarea id="ai-import-json" class="form-textarea" rows="4" placeholder='Paste the JSON result here…' style="width:100%;font-family:monospace;font-size:11px;margin-bottom:8px;"></textarea>
        <button type="button" id="ai-import-preview-btn" class="btn btn--secondary btn--sm">Preview import</button>
        <p id="ai-import-status" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:8px;"></p>
        <div id="ai-import-results" style="margin-top:var(--space-md);"></div>

        <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-lg) 0;">
        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Recent activity</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">Every run, whether it succeeded, found nothing, or failed — so a run that costs real money is never unaccounted for.</p>
        <div id="ai-recent-activity"></div>
      </div>
    </div>`;

  el.querySelector('.card').style.maxWidth = '760px';

  const clearBtn = document.getElementById('ai-clear-key-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => { DPC.AISupport.clearSessionKey(); initAISupport(); });

  document.getElementById('ai-jump-area')?.addEventListener('change', (e) => {
    if (e.target.value && typeof openAreaProfile === 'function') openAreaProfile(e.target.value, 'industryskills');
  });

  document.getElementById('ai-prompt-select')?.addEventListener('change', (e) => {
    const promptId = e.target.value;
    const textArea = document.getElementById('ai-prompt-text');
    const dataTypeSel = document.getElementById('ai-data-type');
    if (!promptId) { textArea.value = ''; return; }
    const prompt = getAIPrompts().find(p => p.templateId === promptId);
    if (prompt) {
      textArea.value = prompt.promptText;
      dataTypeSel.value = prompt.dataType;
    }
  });

  document.getElementById('ai-run-btn')?.addEventListener('click', _aiRunDocumentWorkbench);
  document.getElementById('ai-import-preview-btn')?.addEventListener('click', _aiPreviewImport);
  _aiRenderRecentActivity();
}

// Session 64 (11/08/26): "reverse engineer it so I have a Claude
// Project or set of rules... upload the documents there... you
// produce the outcomes... I import that outcome... I don't need to
// use lots of different credits." This is that import path — same
// review-before-apply screen as a live run, zero API call, because
// the analysis already happened in a Claude conversation/Project the
// DPC pays for separately. Deliberately reuses
// _aiRenderTaskExtractionResults/_aiCreateSelectedTasks unchanged
// rather than a parallel apply path — a task from an import and a
// task from a live run are the same shape, so they go through the
// same code, not two versions that could drift.
function _aiPreviewImport() {
  const status = document.getElementById('ai-import-status');
  const results = document.getElementById('ai-import-results');
  const setStatus = (msg, kind) => {
    if (!status) return;
    status.textContent = msg;
    const colours = { success: 'var(--color-green)', error: 'var(--color-red)' };
    status.style.color = colours[kind] || 'var(--color-muted)';
  };

  const dataType = document.getElementById('ai-import-type').value;
  const raw = document.getElementById('ai-import-json').value.trim();
  if (!raw) { setStatus('Paste the JSON result first.', 'error'); return; }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    setStatus(`Not valid JSON: ${e.message}`, 'error');
    logAIRun({ fileName: '(pasted import)', dataType, promptText: '', outcome: 'error', detail: `Invalid JSON: ${e.message}`, itemCount: 0, imported: true });
    _aiRenderRecentActivity();
    return;
  }

  if (dataType !== 'tasks') {
    setStatus(`Importing "${AI_PROMPT_DATA_TYPE_LABELS[dataType]}" isn't wired up to apply yet — same limit as the live workbench.`, 'error');
    return;
  }

  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : null;
  if (!tasks) { setStatus('JSON doesn\u2019t match the expected shape — needs a top-level "tasks" array.', 'error'); return; }

  setStatus(`✓ Parsed ${tasks.length} task(s) — review below before creating anything.`, 'success');
  logAIRun({ fileName: '(pasted import)', dataType, promptText: '', outcome: 'success', detail: null, itemCount: tasks.length, imported: true });
  _aiRenderRecentActivity();

  _aiLastExtractedTasks = tasks;
  results.innerHTML = _aiRenderTaskExtractionResults(tasks);
  results.querySelectorAll('.ai-task-create-btn').forEach(btn => btn.addEventListener('click', _aiCreateSelectedTasks));
}

function _aiEsc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function _aiRunDocumentWorkbench() {
  const fileInput = document.getElementById('ai-doc-file');
  const status = document.getElementById('ai-run-status');
  const results = document.getElementById('ai-run-results');
  const setStatus = (msg, kind) => {
    if (!status) return;
    status.textContent = msg;
    // Session 63: a thin grey line was too easy to miss on something
    // that costs real money the moment it runs. A visible banner —
    // green for success, red for failure, amber while in flight —
    // can't be mistaken for "nothing happened."
    const colours = { success: 'var(--color-green)', error: 'var(--color-red)', running: 'var(--color-amber)' };
    const bgColours = { success: '#e6f4ea', error: '#fdecea', running: '#fff4e5' };
    status.style.color = colours[kind] || 'var(--color-muted)';
    status.style.background = bgColours[kind] || 'transparent';
    status.style.padding = kind ? '8px 12px' : '0';
    status.style.borderRadius = 'var(--radius-sm)';
    status.style.fontWeight = kind ? 'bold' : 'normal';
  };

  if (!fileInput.files || fileInput.files.length === 0) { setStatus('Choose a file first.', 'error'); return; }
  const fileName = fileInput.files[0].name;
  const promptText = document.getElementById('ai-prompt-text').value.trim();
  const dataType = document.getElementById('ai-data-type').value;
  const saveIt = document.getElementById('ai-save-prompt-cb').checked;
  const selectedPromptId = document.getElementById('ai-prompt-select').value || null;

  if (saveIt && promptText) {
    saveAIPrompt(promptText, dataType, promptText.slice(0, 60), selectedPromptId);
  }

  setStatus('Running — this calls Claude, may take a few seconds…', 'running');
  results.innerHTML = '';

  const myName = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff.find(s => s.role === 'Digital Pedagogy Coach')?.name) || null;
  const result = await DPC.AISupport.runDocumentPrompt(fileInput.files[0], promptText, dataType, { myName });

  if (!result.ok) {
    setStatus(`✗ Failed: ${result.error}`, 'error');
    logAIRun({ fileName, dataType, promptText, outcome: 'error', detail: result.error, itemCount: 0 });
    _aiRenderRecentActivity();
    return;
  }

  const count = dataType === 'tasks' ? (result.tasks || []).length : 0;
  setStatus(count > 0 ? `✓ Found ${count} item(s) — review below before creating anything.` : '✓ Ran successfully, but found 0 items in this document — nothing to create.', 'success');
  logAIRun({ fileName, dataType, promptText, outcome: 'success', detail: null, itemCount: count });
  _aiRenderRecentActivity();

  if (dataType === 'tasks') {
    _aiLastExtractedTasks = result.tasks;
    results.innerHTML = _aiRenderTaskExtractionResults(result.tasks);
    results.querySelectorAll('.ai-task-create-btn').forEach(btn => btn.addEventListener('click', _aiCreateSelectedTasks));
  }
}

function _aiFmtRunDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return iso; }
}

function _aiRenderRecentActivity() {
  const el = document.getElementById('ai-recent-activity');
  if (!el) return;
  const runs = (window.DPC_DATA.aiRuns && window.DPC_DATA.aiRuns.runs) || [];
  if (runs.length === 0) {
    el.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-muted);">No runs yet.</p>';
    return;
  }
  el.innerHTML = runs.slice(0, 10).map(r => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border);">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${r.outcome==='error'?'var(--color-red)':r.itemCount>0?'var(--color-green)':'var(--color-muted)'};"></span>
      <div style="flex:1;">
        <p style="font-size:var(--text-xs);color:var(--color-navy);">
          <strong>${_aiEsc(r.fileName)}</strong> — ${_aiEsc(AI_PROMPT_DATA_TYPE_LABELS[r.dataType]||r.dataType)}
          ${r.outcome==='error' ? `<span style="color:var(--color-red);">failed</span>` : `${r.itemCount} item(s)`}
          ${r.imported ? `<span style="font-size:10px;color:var(--color-teal);background:var(--color-light);padding:1px 6px;border-radius:999px;margin-left:4px;">imported — no API cost</span>` : ''}
        </p>
        <p style="font-size:10px;color:var(--color-muted);">${_aiFmtRunDate(r.timestamp)}${r.outcome==='error' && r.detail ? ` — ${_aiEsc(r.detail)}` : ''}</p>
      </div>
    </div>`).join('');
}

let _aiLastExtractedTasks = [];

function _aiRenderTaskExtractionResults(tasks) {
  if (!tasks || tasks.length === 0) return '<p style="font-size:var(--text-sm);color:var(--color-muted);">No tasks found in this document.</p>';
  return `
    <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin-bottom:8px;">Extracted tasks — untick any you don't want created</p>
    ${tasks.map((t, i) => `
      <label style="display:block;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:6px;cursor:pointer;">
        <input type="checkbox" class="ai-task-cb" data-idx="${i}" ${t.isMine ? 'checked' : ''}>
        <strong>${_aiEsc(t.description)}</strong>
        ${t.isMine ? '<span style="font-size:10px;color:var(--color-teal);margin-left:6px;">yours</span>' : ''}
        <br><span style="font-size:var(--text-xs);color:var(--color-muted);margin-left:20px;">Assigned to: ${_aiEsc(t.assignedTo)}${t.deadline ? ` · Due: ${_aiEsc(t.deadline)}` : ''}</span>
        ${t.detail ? `<br><span style="font-size:var(--text-xs);color:var(--color-slate);margin-left:20px;">${_aiEsc(t.detail)}</span>` : ''}
      </label>`).join('')}
    <button type="button" class="btn btn--primary btn--sm ai-task-create-btn" style="margin-top:8px;">Create selected tasks</button>
  `;
}

function _aiCreateSelectedTasks(e) {
  // Session 64 bug fix: this used to hardcode #ai-run-results, which
  // is only correct when triggered from the live workbench. Called
  // from the import flow, the checkboxes live in #ai-import-results
  // instead -- found and confirmed via a real test (0 tasks created
  // when it should have been 1), not just spotted by inspection.
  // Finding the actual containing results div, whichever one it is,
  // is correct for both call sites without needing two copies of
  // this function.
  const results = e.target.closest('[id^="ai-"][id$="-results"]');
  if (!results) return;
  const tasks = _aiLastExtractedTasks;
  const checkedIdx = Array.from(results.querySelectorAll('.ai-task-cb:checked')).map(el => Number(el.dataset.idx));

  let created = 0;
  checkedIdx.forEach(i => {
    const t = tasks[i];
    if (!t || typeof createTaskFromSource !== 'function') return;
    createTaskFromSource(
      { title: t.description, date: t.deadline || todayISO(), personRefs: t.assignedTo ? [t.assignedTo] : [], notes: t.detail || '' },
      'ai-document-extraction', { }
    );
    created++;
  });

  if (typeof UI !== 'undefined') UI.showToast('success', `${created} task(s) created.`);
  e.target.disabled = true;
  e.target.textContent = `${created} task(s) created ✓`;
}

DPC.AISupport = {

  // ── SESSION-ONLY KEY STORE ────────────────────────────────────
  _sessionKey: null,

  // Model used for narrative prose generation. Sonnet, per the
  // Master Blueprint — quality of writing matters more here than
  // speed or cost (unlike healthcheck.js's Haiku extraction).
  NARRATIVE_MODEL: 'claude-sonnet-5',

  // ── KEY PROMPT MODAL ──────────────────────────────────────────
  // Returns a Promise<string|null> — resolves with the key, or
  // null if the DPC cancels.
  _promptForKey: function() {
    return new Promise((resolve) => {
      // Reuse existing key for this session if already provided
      if (DPC.AISupport._sessionKey) {
        resolve(DPC.AISupport._sessionKey);
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'presentation');
      overlay.innerHTML = `
        <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="ai-key-modal-title">
          <div class="card-header">
            <span class="card-title" id="ai-key-modal-title">Anthropic API Key Required</span>
          </div>
          <div class="card-body">
            <p class="text-muted mb-12" id="ai-key-modal-desc">
              Needed to generate the AI narrative section. Used for this session only —
              never saved to OneDrive, never written to disk, cleared when you close the tab.
            </p>
            <div class="form-group mb-12">
              <label class="form-label" for="ai-key-input">Anthropic API key</label>
              <input class="form-input" type="password" id="ai-key-input"
                placeholder="sk-ant-…" autocomplete="off"
                aria-describedby="ai-key-modal-desc" aria-label="Anthropic API key">
            </div>
            <div class="form-row" style="gap:8px">
              <button class="btn btn-primary" type="button" id="ai-key-submit">Continue</button>
              <button class="btn btn-ghost" type="button" id="ai-key-cancel">Cancel</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#ai-key-input');
      input.focus();

      const cleanup = (value) => {
        document.body.removeChild(overlay);
        resolve(value);
      };

      overlay.querySelector('#ai-key-submit').addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) { input.focus(); return; }
        DPC.AISupport._sessionKey = val;
        cleanup(val);
      });
      overlay.querySelector('#ai-key-cancel').addEventListener('click', () => cleanup(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#ai-key-submit').click();
        if (e.key === 'Escape') overlay.querySelector('#ai-key-cancel').click();
      });
    });
  },

  // Allows the DPC to clear the session key manually (e.g. Settings tab)
  clearSessionKey: function() {
    DPC.AISupport._sessionKey = null;
  },

  // ── CORE NARRATIVE GENERATOR ───────────────────────────────────
  // promptText: fully-assembled prompt string (caller's responsibility
  //             to build this — keeps prompt content close to the
  //             report that needs it, e.g. in reports.js).
  // Returns: { ok: true, text } or { ok: false, error }
  generateNarrative: async function(promptText, options = {}) {
    const apiKey = await DPC.AISupport._promptForKey();
    if (!apiKey) {
      return { ok: false, error: 'No API key provided — narrative generation cancelled.' };
    }

    const model = options.model || DPC.AISupport.NARRATIVE_MODEL;
    const maxTokens = options.maxTokens || 2000;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: promptText }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody.error?.message || `API error (HTTP ${response.status})`;
        // A 401 on a key that was just entered means it's wrong —
        // clear it so the next attempt re-prompts rather than retrying silently.
        if (response.status === 401) DPC.AISupport._sessionKey = null;
        return { ok: false, error: msg };
      }

      const data = await response.json();
      const text = (data.content || [])
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();

      if (!text) {
        return { ok: false, error: 'API returned no text content.' };
      }

      return { ok: true, text };

    } catch (e) {
      return { ok: false, error: `Network or fetch error: ${e.message}` };
    }
  },

  // ── Multi-format document analysis (Session 60, 11/08/26) ──────
  // Reads an uploaded file — .docx, .xlsx/.xls, .pdf, or an image
  // (screenshot) — and asks Claude to compare it against a current
  // data set, returning a STRUCTURED diff, never freeform prose.
  //
  // PDF and images are the easy half: sent to the API natively as
  // document/image content blocks, no client-side parsing needed.
  // Word and Excel need real extraction first (mammoth / SheetJS,
  // vendored in lib/ the same way docx.min.js already is) since the
  // API doesn't parse those formats itself.
  //
  // The prompt is deliberately conservative: told explicitly to flag
  // anything ambiguous under `uncertain` rather than guess, and to
  // change nothing it isn't confident about — matching the "never
  // silently overwrite, review before commit" pattern used everywhere
  // else data has flowed into this Hub today (RAG import, the merge
  // script, wireActionPlanCard).
  _fileToBase64: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    });
  },

  _extractDocxText: async function(file) {
    if (typeof mammoth === 'undefined') throw new Error('lib/mammoth.min.js has not loaded.');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  },

  // Session 64 (11/08/26): no size cap at all before this — a large or
  // busy spreadsheet (merged cells, many mostly-empty rows) could
  // produce an enormous, noisy CSV dump. Suspected real contributor to
  // an "Unexpected end of JSON input" failure on a real uploaded file
  // (large/messy input plausibly confusing the model into an empty or
  // malformed response). Capped with a clear truncation note rather
  // than silently sending everything.
  _extractXlsxText: async function(file) {
    if (typeof XLSX === 'undefined') throw new Error('lib/xlsx.min.js has not loaded.');
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const MAX_CHARS_PER_SHEET = 8000;
    return wb.SheetNames.map(name => {
      let csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      let truncated = false;
      if (csv.length > MAX_CHARS_PER_SHEET) { csv = csv.slice(0, MAX_CHARS_PER_SHEET); truncated = true; }
      return `--- Sheet: ${name}${truncated ? ' (truncated — sheet is larger than this excerpt)' : ''} ---\n${csv}`;
    }).join('\n\n');
  },

  // General-purpose file → Claude content-block conversion (Session 62,
  // 11/08/26). Extracted out of analyzeIndustrySkillsAmendment() so the
  // new general document workbench, and any future feature, use the
  // exact same tested extraction logic rather than a third copy.
  // Returns { ok:true, contentBlocks } or { ok:false, error }.
  fileToContentBlocks: async function(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'docx') {
        const text = await DPC.AISupport._extractDocxText(file);
        return { ok: true, contentBlocks: [{ type: 'text', text: `Document (Word, extracted text):\n\n${text}` }] };
      } else if (ext === 'xlsx' || ext === 'xls') {
        const text = await DPC.AISupport._extractXlsxText(file);
        return { ok: true, contentBlocks: [{ type: 'text', text: `Document (Excel, extracted as CSV per sheet):\n\n${text}` }] };
      } else if (ext === 'pdf') {
        const b64 = await DPC.AISupport._fileToBase64(file);
        return { ok: true, contentBlocks: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }] };
      } else if (['png','jpg','jpeg','webp'].includes(ext)) {
        const b64 = await DPC.AISupport._fileToBase64(file);
        const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return { ok: true, contentBlocks: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } }] };
      }
      return { ok: false, error: `Unsupported file type ".${ext}" — expected .docx, .xlsx, .xls, .pdf, .png, .jpg, .jpeg or .webp.` };
    } catch (e) {
      return { ok: false, error: `Could not read the file: ${e.message}` };
    }
  },

  // areaCode, file: the uploaded amendment. currentSkills: the area's
  // real industrySkills array right now (caller's responsibility to
  // pass the live data, not a stale copy).
  // Returns: { ok:true, changes:[{skillId,field,oldValue,newValue}],
  //            newSkills:[{name,stage1,stage2,stage3}], uncertain:[string] }
  //       or { ok:false, error }
  analyzeIndustrySkillsAmendment: async function(areaCode, file, currentSkills) {
    const apiKey = await DPC.AISupport._promptForKey();
    if (!apiKey) return { ok: false, error: 'No API key provided — analysis cancelled.' };

    const extraction = await DPC.AISupport.fileToContentBlocks(file);
    if (!extraction.ok) return extraction;
    const contentBlocks = extraction.contentBlocks;

    const systemPrompt = `You are comparing a CURRENT agreed list of digital skills for a college curriculum area against an AMENDED document someone has sent back with edits. Identify ONLY clear, unambiguous changes:
- A skill's "Include?" column changed from Yes to No, or No to Yes
- A Stage 1/2/3 description was reworded (give the exact new text)
- A genuinely new skill was added in the "Additional skills to add" section, with at least a name

Do NOT guess at ambiguous edits — if a comment or change isn't a clear, discrete edit to a specific field, list it under "uncertain" instead of proposing a change. Never invent a change that isn't actually evidenced in the document.

Respond ONLY with valid JSON, no other text, no markdown fences, in exactly this shape:
{"changes":[{"skillId":"...","field":"selected|stage1|stage2|stage3","oldValue":"...","newValue":"..."}],"newSkills":[{"name":"...","stage1":"...","stage2":"...","stage3":"..."}],"uncertain":["short description of anything ambiguous"]}`;

    const userText = `CURRENT skills for area ${areaCode} (skillId is what you must reference in "changes"):\n${JSON.stringify(currentSkills.map(s => ({ skillId: s.skillId, name: s.name, stage1: s.stage1, stage2: s.stage2, stage3: s.stage3, selected: s.selected })), null, 2)}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: DPC.AISupport.NARRATIVE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: [{ type: 'text', text: userText }, ...contentBlocks] }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody.error?.message || `API error (HTTP ${response.status})`;
        if (response.status === 401) DPC.AISupport._sessionKey = null;
        return { ok: false, error: msg };
      }

      const data = await response.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return { ok: false, error: text.trim() === ''
          ? `The AI returned an empty response (stop reason: ${data.stop_reason || 'unknown'}). This can happen with a very large or unusually formatted spreadsheet -- try a smaller file, a specific sheet, or converting to PDF.`
          : `Could not parse the AI's response as JSON: ${e.message}. Raw response: ${text.slice(0, 500)}` };
      }

      return {
        ok: true,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        newSkills: Array.isArray(parsed.newSkills) ? parsed.newSkills : [],
        uncertain: Array.isArray(parsed.uncertain) ? parsed.uncertain : [],
      };
    } catch (e) {
      return { ok: false, error: `Network or fetch error: ${e.message}` };
    }
  },

  // ── Area overview: individual vs whole-team synthesis (Session 61) ──
  // "help generate an Area overview of Action, whether it is likely
  // individual support because there is only one instance (or a
  // couple), or whole team because there is a common thread." Takes
  // every action item across an area's Action Plans (staff-specific
  // and whole-team) and asks Claude to group them into real themes,
  // each classified individual vs whole-team by how many people it
  // actually shows up for — not guessed, counted from the real data
  // handed to it. Read-only synthesis: this never creates or edits
  // anything itself, it's a reading aid for you to act on, same
  // spirit as the RAG Matrix advisory pattern from earlier sessions.
  analyzeAreaActionPatterns: async function(areaCode, actionItems) {
    const apiKey = await DPC.AISupport._promptForKey();
    if (!apiKey) return { ok: false, error: 'No API key provided — analysis cancelled.' };

    if (!actionItems || actionItems.length === 0) {
      return { ok: true, themes: [] };
    }

    const systemPrompt = `You are looking at every open action item logged against a college curriculum area's Action Plans — some tied to a named individual staff member, some whole-team. Group them into real recurring THEMES (not one theme per item — genuinely similar items belong together), and for each theme:
- List which named people it applies to (from the data given, never invent a name)
- Classify as "individual" if it genuinely only applies to one or two people, or "whole-team" if it's a common thread across several people or was already logged as whole-team
- Suggest a concrete next step: for "individual", 1:1 coaching; for "whole-team", a Teach Meet or team briefing

Do not invent themes that aren't evidenced in the data. If an item is genuinely standalone with nothing to group it with, still include it as its own single-item theme rather than forcing it into an unrelated group.

Respond ONLY with valid JSON, no other text, no markdown fences, in exactly this shape:
{"themes":[{"description":"...","staffInvolved":["..."],"classification":"individual|whole-team","recommendation":"..."}]}`;

    const userText = `Action items for area ${areaCode}:\n${JSON.stringify(actionItems, null, 2)}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: DPC.AISupport.NARRATIVE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userText }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody.error?.message || `API error (HTTP ${response.status})`;
        if (response.status === 401) DPC.AISupport._sessionKey = null;
        return { ok: false, error: msg };
      }

      const data = await response.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return { ok: false, error: text.trim() === ''
          ? `The AI returned an empty response (stop reason: ${data.stop_reason || 'unknown'}). This can happen with a very large or unusually formatted spreadsheet -- try a smaller file, a specific sheet, or converting to PDF.`
          : `Could not parse the AI's response as JSON: ${e.message}. Raw response: ${text.slice(0, 500)}` };
      }

      return { ok: true, themes: Array.isArray(parsed.themes) ? parsed.themes : [] };
    } catch (e) {
      return { ok: false, error: `Network or fetch error: ${e.message}` };
    }
  },

  // ── General document workbench (Session 62, 11/08/26) ──────────
  // "It seems narrow to just Digital Skills... I upload the Health
  // Check and there's a pre-generated prompt I can select... apply
  // this across the Curriculum Areas." This is the general engine:
  // upload anything, run a saved-or-custom prompt against it, tagged
  // by which data type the result should land in. Each dataType gets
  // its own extraction/shape below — 'tasks' is the first one built
  // (the concrete near-term test case), the others (rag, health-
  // checks, meeting-notes, qsr) follow the same shape once there's
  // real data to prove them against, per the design conversation.
  //
  // file: the uploaded document. promptText: the saved-or-custom
  // instruction (e.g. "Extract tasks assigned to me from this
  // document"). dataType: which handler below processes the result.
  // Returns a shape specific to dataType — see each handler's comment.
  runDocumentPrompt: async function(file, promptText, dataType, context = {}) {
    if (dataType === 'tasks') {
      return DPC.AISupport._extractTasksFromDocument(file, promptText, context.myName);
    }
    return { ok: false, error: `Data type "${dataType}" isn't wired up yet — only "tasks" is built so far.` };
  },

  // Extracts task-like items from any uploaded document. Told
  // explicitly never to guess whether an item belongs to "myName" —
  // only mark isMine true on a genuine textual match in the document,
  // not an inference. Everything comes back for review regardless;
  // isMine is a filter hint for the UI, never a silent exclusion.
  _extractTasksFromDocument: async function(file, promptText, myName) {
    const apiKey = await DPC.AISupport._promptForKey();
    if (!apiKey) return { ok: false, error: 'No API key provided — analysis cancelled.' };

    const extraction = await DPC.AISupport.fileToContentBlocks(file);
    if (!extraction.ok) return extraction;

    const systemPrompt = `You are extracting real, actionable tasks from an uploaded document (meeting minutes, an action list, notes — could be anything). For each task-like item found, capture:
- description: what actually needs doing, in enough detail to act on without re-reading the source document
- assignedTo: the person's name exactly as written in the document, or "Unclear" if genuinely not stated
- deadline: a date if one is explicitly given, otherwise null — never invent one
- detail: any extra context from the document that matters (why it's needed, what it depends on)
- isMine: true ONLY if assignedTo is a genuine textual match to "${myName || 'the user'}" as written in the document — never infer this from context, only from an actual name match. If uncertain, false.

Extract every genuine task, not just the user's own — this is a review list, not a pre-filtered one. Do not invent tasks that aren't actually in the document.

${promptText ? `Additional instruction from the user: ${promptText}` : ''}

Respond ONLY with valid JSON, no other text, no markdown fences, in exactly this shape:
{"tasks":[{"description":"...","assignedTo":"...","deadline":"YYYY-MM-DD or null","detail":"...","isMine":true|false}]}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: DPC.AISupport.NARRATIVE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Extract the tasks from this document.' }, ...extraction.contentBlocks] }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody.error?.message || `API error (HTTP ${response.status})`;
        if (response.status === 401) DPC.AISupport._sessionKey = null;
        return { ok: false, error: msg };
      }

      const data = await response.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return { ok: false, error: text.trim() === ''
          ? `The AI returned an empty response (stop reason: ${data.stop_reason || 'unknown'}). This can happen with a very large or unusually formatted spreadsheet -- try a smaller file, a specific sheet, or converting to PDF.`
          : `Could not parse the AI's response as JSON: ${e.message}. Raw response: ${text.slice(0, 500)}` };
      }

      return { ok: true, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
    } catch (e) {
      return { ok: false, error: `Network or fetch error: ${e.message}` };
    }
  },

};
