/* ================================================================
   ai-support.js — DPC Hub
   AI Support module: Anthropic API calls live here and ONLY here.
   No other module should call the Anthropic API directly.

   Current scope (Phase 7, reports.js dependency):
   - generateNarrative() — performance review AI narrative prose

   Future scope (later Phase 7 work, not built yet):
   - Strengths synthesis
   - AFI risk surfacing
   - Action plan generation

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

  el.innerHTML = `
    <div class="card" style="max-width:640px;">
      <div class="card-header"><span class="card-title">AI Support</span></div>
      <div class="card-body">
        <p style="color:var(--color-muted);margin-bottom:var(--space-md);">
          Anthropic API calls for the Hub live here. Currently in use for the
          <strong>performance review narrative</strong> in Reports.
        </p>

        <div style="background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
          <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">Session API key</p>
          <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);">
            ${hasKey ? 'A key is set for this browser session.' : 'No key set — you\u2019ll be asked for one the first time a report needs the AI narrative.'}
          </p>
          ${hasKey ? `<button class="btn btn--ghost btn--sm" id="ai-clear-key-btn" type="button">Clear session key</button>` : ''}
        </div>

        <div class="empty-state" style="padding:var(--space-lg) 0;">
          <p class="empty-state__body">Strengths synthesis, AFI risk surfacing, and action plan generation
            are planned for later in Phase 7 and will appear here.</p>
        </div>
      </div>
    </div>`;

  const clearBtn = document.getElementById('ai-clear-key-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => { DPC.AISupport.clearSessionKey(); initAISupport(); });
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

};
