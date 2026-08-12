/* ================================================================
   ai-support.js — DPC Hub
   AI Support page: Import outcomes only.

   Session 65 (11/08/26): removed every live Anthropic API call from
   the Hub entirely — generateNarrative(), analyzeIndustrySkillsAmendment(),
   analyzeAreaActionPatterns(), runDocumentPrompt() and the file-
   extraction helpers behind it, and the whole API-key modal
   (_promptForKey/_sessionKey), all gone. Per the actual instruction:
   "we don't have any AI API call paths at all... we just use it
   through this process [Import]."

   The analysis now happens outside the Hub entirely, in a Claude
   conversation or Project the DPC already pays for — see
   Documents/Current/DPC-Hub-Import-Schema-Reference.md for the exact
   JSON shapes to give it. This page's only job is importing the
   result safely: paste JSON, preview exactly what it means, confirm
   before anything is created. Same discipline as every other import
   in the Hub, just with zero API cost and one fewer moving part
   (no key handling, no network calls, no billing surprises).

   Only "tasks" has real apply-logic wired up so far — everything else
   (RAG, Health Checks, Meeting Notes, QSR) is tagged and ready to
   slot in as its own handler once there's real data to build it
   against, same as before.
   ================================================================ */

// ── MODULE PAGE ─────────────────────────────────────────────────
// Registered in app.js's MODULES table as data-module="aisupport".
function initAISupport() {
  const el = document.getElementById('main-content');
  if (!el) return;

  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];

  el.innerHTML = `
    <div class="card" style="max-width:640px;">
      <div class="card-header"><span class="card-title">AI Support</span></div>
      <div class="card-body">
        <p style="color:var(--color-muted);margin-bottom:var(--space-md);">
          No live API calls happen from the Hub — analysis is done in a Claude conversation or Project you already have (see the Import Schema Reference for the exact shapes it needs), and the result is imported here. Nothing costs anything beyond what you already pay for Claude.
        </p>

        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:8px;">Where the other imports live</p>

        <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">Performance review narrative</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);">In Reports — copy the data-driven prompt, paste the narrative back in.</p>
        </div>

        <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-sm);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">Industry Digital Skills — amendment import</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">On each Area's Digital Skills tab — paste the JSON diff, review, confirm.</p>
          ${areas.length > 0 ? `
            <select id="ai-jump-area" class="form-select" style="max-width:280px;">
              <option value="">Jump to an area's Digital Skills tab…</option>
              ${areas.map(a => `<option value="${a.areaCode}">${a.areaName} (${a.areaCode})</option>`).join('')}
            </select>
          ` : ''}
        </div>

        <div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
          <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">Area overview (individual vs whole-team)</p>
          <p style="font-size:var(--text-xs);color:var(--color-muted);">On each Area's Action Plan tab, and in Digital Leads — copy the action items, paste the themes back in.</p>
        </div>

        <div class="empty-state" style="padding:var(--space-md) 0;">
          <p class="empty-state__body">RAG Matrix, Health Checks, Meeting Notes, and QSR imports are next — each needs its own apply-logic built once there's real data to design it against.</p>
        </div>

        <hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-lg) 0;">

        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Import outcomes — Tasks</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">
          Paste the JSON result from a Claude conversation. Nothing is created until you review and confirm below.
        </p>
        <details style="margin-bottom:8px;">
          <summary style="cursor:pointer;font-size:var(--text-xs);color:var(--color-teal);">What shape does the JSON need to be?</summary>
          <pre style="background:var(--color-light);border-radius:var(--radius-sm);padding:8px;font-size:10px;overflow-x:auto;margin-top:4px;">{"tasks":[{"description":"...","assignedTo":"...","deadline":"YYYY-MM-DD or null","detail":"...","isMine":true|false}]}</pre>
          <p style="font-size:10px;color:var(--color-muted);">See Documents/Current/DPC-Hub-Import-Schema-Reference.md for the full, current reference.</p>
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
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:8px;">Every import, whether it applied cleanly or the JSON didn't match — so nothing is ever unaccounted for.</p>
        <div id="ai-recent-activity"></div>
      </div>
    </div>`;

  document.getElementById('ai-jump-area')?.addEventListener('change', (e) => {
    if (e.target.value && typeof openAreaProfile === 'function') openAreaProfile(e.target.value, 'industryskills');
  });

  document.getElementById('ai-import-preview-btn')?.addEventListener('click', _aiPreviewImport);
  _aiRenderRecentActivity();
}

function _aiEsc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Reused by every import-preview screen in the Hub (this page, the
// Digital Skills tab, the Area overview panel) — one place that
// parses, one place that logs, so behaviour can't drift between them.
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
    setStatus(`Importing "${AI_PROMPT_DATA_TYPE_LABELS[dataType]}" isn't wired up to apply yet.`, 'error');
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

function _aiFmtRunDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) + ' ' + new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return iso; }
}

function _aiRenderRecentActivity() {
  const el = document.getElementById('ai-recent-activity');
  if (!el) return;
  const runs = (window.DPC_DATA.aiRuns && window.DPC_DATA.aiRuns.runs) || [];
  if (runs.length === 0) {
    el.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-muted);">No imports yet.</p>';
    return;
  }
  el.innerHTML = runs.slice(0, 10).map(r => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border);">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${r.outcome==='error'?'var(--color-red)':r.itemCount>0?'var(--color-green)':'var(--color-muted)'};"></span>
      <div style="flex:1;">
        <p style="font-size:var(--text-xs);color:var(--color-navy);">
          <strong>${_aiEsc(r.fileName)}</strong> — ${_aiEsc(AI_PROMPT_DATA_TYPE_LABELS[r.dataType]||r.dataType)}
          ${r.outcome==='error' ? `<span style="color:var(--color-red);">failed</span>` : `${r.itemCount} item(s)`}
        </p>
        <p style="font-size:10px;color:var(--color-muted);">${_aiFmtRunDate(r.timestamp)}${r.outcome==='error' && r.detail ? ` — ${_aiEsc(r.detail)}` : ''}</p>
      </div>
    </div>`).join('');
}

let _aiLastExtractedTasks = [];

function _aiRenderTaskExtractionResults(tasks) {
  if (!tasks || tasks.length === 0) return '<p style="font-size:var(--text-sm);color:var(--color-muted);">No tasks found in this import.</p>';
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
  // Finds whichever results container this button lives in (the AI
  // Support page's own import box, or the same button reused
  // elsewhere) rather than a hardcoded id — a real bug (Session 64)
  // came from hardcoding this once already.
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
