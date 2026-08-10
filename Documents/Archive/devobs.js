/* ================================================================
   DPC EVIDENCE HUB — devobs.js
   Developmental Observation form mirroring the Weston Hyper
   College Platform Dev Obs form structure.
   Fill here first → "Copy for Hyper".
   ================================================================ */

'use strict';

let _devobsReferralId = '';
let _devobsThreadId   = '';
let _devobsTags       = {};
let _devobsId         = null;
let _obsRowCount      = 1;

function initDevObs(ctx) {
  _devobsReferralId = ctx?.referralId || '';
  _devobsThreadId   = ctx?.threadId   || '';
  _devobsId         = ctx?.editId     || null;
  _devobsTags       = {};
  _obsRowCount      = 1;

  const container = document.getElementById('devobs-form-container');
  if (!container) return;

  const areaOpts = DB.areas.map(a =>
    `<option value="${esc(a.code)}">${esc(a.code)} · ${esc(a.name)}</option>`
  ).join('');
  const threadOpts = DB.threads.filter(t => t.status !== 'closed').map(t =>
    `<option value="${esc(t.id)}">${esc(t.name)}</option>`
  ).join('');

  const ref = _devobsReferralId ? DB.referrals.find(r => r.id === _devobsReferralId) : null;

  container.innerHTML = `
    ${ref ? `<div class="notice info mb-16">
      <h3>📎 Developmental Observation — responding to referral</h3>
      <p>Requested by <strong>${esc(ref.requestedBy)}</strong>${ref.regarding ? ' — ' + esc(ref.regarding) : ''}</p>
    </div>` : ''}

    <!-- OBSERVATION DETAILS HEADER -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'devobs-s1')"
        aria-expanded="true">
        <span><span class="badge badge-navy" aria-hidden="true">1</span> &nbsp;Observation Details</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="devobs-s1">
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-lecturer">Lecturer / Assessor <span class="req" aria-hidden="true">*</span></label>
            <input type="text" id="devobs-lecturer"
              value="${ref?.regarding ? esc(ref.regarding) : ''}"
              required aria-required="true" placeholder="Full name">
          </div>
          <div class="form-group">
            <label for="devobs-area">Department / area <span class="req" aria-hidden="true">*</span></label>
            <select id="devobs-area" required aria-required="true">
              <option value="">— select —</option>
              ${areaOpts}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-coach">Coach / observer</label>
            <input type="text" id="devobs-coach" value="Graeme Wright">
          </div>
          <div class="form-group">
            <label for="devobs-date">Date <span class="req" aria-hidden="true">*</span></label>
            <input type="date" id="devobs-date" value="${today()}" required aria-required="true">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-context">Context / brief</label>
            <input type="text" id="devobs-context"
              placeholder="e.g. Follow-up from LRA — Teams environment coaching"
              value="${ref?.context ? esc(ref.context) : ''}">
          </div>
          <div class="form-group">
            <label for="devobs-session">Session / focus area</label>
            <input type="text" id="devobs-session" placeholder="e.g. Formative assessment in Teams">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-thread">Link to thread</label>
            <select id="devobs-thread">
              <option value="">— no thread —</option>
              ${threadOpts}
              <option value="__new__">+ Start new thread</option>
            </select>
          </div>
          <div class="form-group">
            <label for="devobs-new-thread-name">New thread name <span class="hint">(if starting new)</span></label>
            <input type="text" id="devobs-new-thread-name" placeholder="Auto-generated on save">
          </div>
        </div>
      </div>
    </div>

    <!-- OBSERVATION ROWS -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'devobs-s2')"
        aria-expanded="true">
        <span><span class="badge badge-navy" aria-hidden="true">2</span> &nbsp;Observation Record</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="devobs-s2">
        <p class="text-sm text-muted mb-12">
          Timestamped observation rows. Each row captures an evidence moment, the impact, and reviewer reflection.
        </p>

        <!-- Column headers — WCAG: use visually labelled columns, not just empty headers -->
        <div class="obs-col-header" role="row" aria-label="Observation table column headers">
          <div class="obs-col-label" role="columnheader">Time</div>
          <div class="obs-col-label" role="columnheader">Evidence of impact</div>
          <div class="obs-col-label" role="columnheader">Hyper themes</div>
          <div class="obs-col-label" role="columnheader">Review &amp; reflect</div>
          <div class="obs-col-label" role="columnheader"><span class="sr-only">Remove</span></div>
        </div>

        <div id="devobs-obs-rows" role="table" aria-label="Observation timestamps"></div>

        <button class="btn btn-secondary btn-sm mt-8" onclick="addObsRow()">
          + Add observation row
        </button>
      </div>
    </div>

    <!-- THE PLAN -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'devobs-s3')"
        aria-expanded="true">
        <span><span class="badge badge-navy" aria-hidden="true">3</span> &nbsp;The Plan</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="devobs-s3">
        <div class="form-group">
          <label for="devobs-goals">Agreed goals</label>
          <div class="input-with-mic" style="align-items:flex-start">
            <textarea id="devobs-goals" rows="3"
              placeholder="What has the member of staff agreed to work towards?"></textarea>
            <button class="mic-btn" onclick="startDictation('devobs-goals')"
              aria-label="Dictate goals" style="margin-top:2px">🎤</button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-strategies">Strategies / actions</label>
            <div class="input-with-mic" style="align-items:flex-start">
              <textarea id="devobs-strategies" rows="3"
                placeholder="Specific steps or approaches agreed…"></textarea>
              <button class="mic-btn" onclick="startDictation('devobs-strategies')"
                aria-label="Dictate" style="margin-top:2px">🎤</button>
            </div>
          </div>
          <div class="form-group">
            <label for="devobs-support">Support / training</label>
            <div class="input-with-mic" style="align-items:flex-start">
              <textarea id="devobs-support" rows="3"
                placeholder="CPD, resources, coaching to be provided…"></textarea>
              <button class="mic-btn" onclick="startDictation('devobs-support')"
                aria-label="Dictate" style="margin-top:2px">🎤</button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="devobs-evidence-type">Evidence to be gathered</label>
          <input type="text" id="devobs-evidence-type"
            placeholder="e.g. Screenshot of Teams environment, learner feedback, follow-up LRA">
        </div>
        <div class="form-group">
          <label for="devobs-staff-objectives">Staff objectives link</label>
          <input type="text" id="devobs-staff-objectives"
            placeholder="Links to which staff objective? (optional)">
        </div>
      </div>
    </div>

    <!-- THE OUTCOME -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'devobs-s4')"
        aria-expanded="true">
        <span><span class="badge badge-navy" aria-hidden="true">4</span> &nbsp;The Outcome</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="devobs-s4">
        <div class="notice info mb-12" role="note">
          <h3>Complete when the coaching cycle is closed</h3>
          <p>This section is filled in when you and the member of staff agree the outcome is ready to record. It is not required to save initially.</p>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-completed-by">Completed by</label>
            <input type="text" id="devobs-completed-by" placeholder="Staff name">
          </div>
          <div class="form-group">
            <label for="devobs-completed-date">Date completed</label>
            <input type="date" id="devobs-completed-date">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="devobs-viewable">Can be viewed by Ofsted?</label>
            <select id="devobs-viewable">
              <option value="">— not decided —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div class="form-group">
            <label for="devobs-is-complete">Is completed?</label>
            <select id="devobs-is-complete">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="devobs-outcome">Outcome summary / impact</label>
          <div class="input-with-mic" style="align-items:flex-start">
            <textarea id="devobs-outcome" rows="4"
              placeholder="What changed? What evidence exists? Quotes from the staff member if available."></textarea>
            <button class="mic-btn" onclick="startDictation('devobs-outcome')"
              aria-label="Dictate outcome" style="margin-top:2px">🎤</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EVIDENCE LINKS -->
    <div class="card mb-12">
      <div class="card-title flex-between">
        Evidence links &amp; resources
        <button class="btn btn-sm btn-ghost" onclick="addDevObsEvidenceLink()">+ Add link</button>
      </div>
      <div id="devobs-evidence-links-list"></div>
      <p class="text-xs text-muted mt-6">Teams recordings, SharePoint files, screenshots, resources created…</p>
    </div>

    <!-- TAGS + THREAD -->
    <div class="card mb-16">
      <div class="card-title flex-between">
        Tags
        <button class="btn btn-sm btn-secondary"
          onclick="openTagPicker(tags=>{_devobsTags=tags;updateDevObsTagDisplay()},_devobsTags,'devobs')">
          🏷 Tag this Dev Obs
        </button>
      </div>
      <div id="devobs-tag-chips" class="flex flex-wrap gap-4" aria-live="polite"></div>
    </div>

    <!-- SAVE BAR -->
    <div class="flex gap-8 flex-wrap" style="padding:.75rem 0;border-top:1px solid var(--border)">
      <button class="btn btn-primary" onclick="saveDevObs()">✦ Save Dev Obs</button>
      <button class="btn btn-secondary" onclick="copyDevObsToClipboard()">📋 Copy for Hyper</button>
      <button class="btn btn-ghost" onclick="clearDevObs()">Clear form</button>
    </div>
  `;

  // Add first observation row
  addObsRow();

  // Pre-select thread
  if (_devobsThreadId) {
    const sel = document.getElementById('devobs-thread');
    if (sel) sel.value = _devobsThreadId;
  }
}

/* ── OBSERVATION ROWS ─────────────────────────────────────────── */

function obsRowHyperOpts() {
  return DB.tags.hyperThemes.map(g =>
    `<optgroup label="${esc(g.label)}">
      ${g.items.map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('')}
    </optgroup>`
  ).join('');
}

function addObsRow() {
  const list = document.getElementById('devobs-obs-rows');
  if (!list) return;
  const n   = _obsRowCount++;
  const div = document.createElement('div');
  div.className = 'obs-row';
  div.setAttribute('role', 'row');
  div.id = 'obs-row-' + n;
  div.innerHTML = `
    <div role="cell">
      <label for="obs-time-${n}" class="sr-only">Time for row ${n}</label>
      <input type="time" id="obs-time-${n}" style="width:100%"
        aria-label="Observation time ${n}">
    </div>
    <div role="cell">
      <label for="obs-evidence-${n}" class="sr-only">Evidence of impact ${n}</label>
      <div class="input-with-mic" style="align-items:flex-start">
        <textarea id="obs-evidence-${n}" rows="3"
          style="width:100%" placeholder="What did you observe? Impact on learner?…"
          aria-label="Evidence of impact ${n}"></textarea>
        <button class="mic-btn" onclick="startDictation('obs-evidence-${n}')"
          aria-label="Dictate evidence ${n}" style="margin-top:2px;flex-shrink:0">🎤</button>
      </div>
    </div>
    <div role="cell">
      <label for="obs-themes-${n}" class="sr-only">Hyper themes for row ${n}</label>
      <select id="obs-themes-${n}" multiple style="width:100%;height:90px;font-size:.75rem"
        aria-label="Select Hyper themes for observation ${n}">
        ${obsRowHyperOpts()}
      </select>
    </div>
    <div role="cell">
      <label for="obs-reflect-${n}" class="sr-only">Review and reflect ${n}</label>
      <div class="input-with-mic" style="align-items:flex-start">
        <textarea id="obs-reflect-${n}" rows="3"
          style="width:100%" placeholder="Your reflection, coaching question, or next step…"
          aria-label="Review and reflect ${n}"></textarea>
        <button class="mic-btn" onclick="startDictation('obs-reflect-${n}')"
          aria-label="Dictate reflection ${n}" style="margin-top:2px;flex-shrink:0">🎤</button>
      </div>
    </div>
    <div role="cell">
      ${n > 1 ? `<button class="btn btn-sm btn-danger" onclick="removeObsRow(${n})"
        aria-label="Remove observation row ${n}" style="margin-top:2px">✕</button>` : ''}
    </div>
  `;
  list.appendChild(div);
}

function removeObsRow(n) {
  const row = document.getElementById('obs-row-' + n);
  if (row) row.remove();
}

/* ── TAG DISPLAY ─────────────────────────────────────────────── */

function updateDevObsTagDisplay() {
  const chips = document.getElementById('devobs-tag-chips');
  if (chips) chips.innerHTML = renderTagChips(_devobsTags, { showAll: true });
}

/* ── EVIDENCE LINKS ───────────────────────────────────────────── */

let _devobsLinkCount = 0;

function addDevObsEvidenceLink() {
  const list = document.getElementById('devobs-evidence-links-list');
  if (!list) return;
  _devobsLinkCount++;
  const n   = _devobsLinkCount;
  const div = document.createElement('div');
  div.id    = 'devobs-link-row-' + n;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:.5rem;margin-bottom:.5rem;align-items:center';
  div.innerHTML = `
    <input type="url" id="devobs-link-url-${n}" placeholder="https://…" aria-label="Link URL ${n}">
    <input type="text" id="devobs-link-label-${n}" placeholder="Description" aria-label="Description ${n}">
    <button class="btn btn-sm btn-danger" onclick="document.getElementById('devobs-link-row-${n}').remove()"
      aria-label="Remove link">✕</button>
  `;
  list.appendChild(div);
}

function getDevObsEvidenceLinks() {
  const links = [];
  for (let i = 1; i <= _devobsLinkCount; i++) {
    const url   = document.getElementById('devobs-link-url-'+i)?.value?.trim();
    const label = document.getElementById('devobs-link-label-'+i)?.value?.trim();
    if (url) links.push({ url, label: label || url });
  }
  return links;
}

/* ── SAVE ─────────────────────────────────────────────────────── */

function saveDevObs() {
  const date     = document.getElementById('devobs-date')?.value;
  const lecturer = document.getElementById('devobs-lecturer')?.value?.trim();
  const area     = document.getElementById('devobs-area')?.value;

  if (!date)     { markInvalid('devobs-date','Date required');          return; }
  if (!lecturer) { markInvalid('devobs-lecturer','Lecturer required');  return; }
  if (!area)     { markInvalid('devobs-area','Area required');          return; }

  // Collect observation rows
  const obsRows = [];
  const list = document.getElementById('devobs-obs-rows');
  if (list) {
    list.querySelectorAll('.obs-row').forEach(row => {
      const id = row.id.replace('obs-row-', '');
      const time     = document.getElementById('obs-time-'+id)?.value    || '';
      const evidence = document.getElementById('obs-evidence-'+id)?.value?.trim() || '';
      const reflect  = document.getElementById('obs-reflect-'+id)?.value?.trim()  || '';
      const themes   = Array.from(document.getElementById('obs-themes-'+id)?.selectedOptions||[])
        .map(o => o.value);
      if (evidence || reflect) obsRows.push({ time, evidence, reflect, themes });
    });
  }

  // Thread
  let threadId = document.getElementById('devobs-thread')?.value || _devobsThreadId || '';
  if (threadId === '__new__') {
    const tName = document.getElementById('devobs-new-thread-name')?.value?.trim()
      || [area, lecturer, 'Dev Obs', fmtDate(date)].filter(Boolean).join(' · ');
    threadId = createThread(tName, 'Self-initiated');
  }

  const isComplete = document.getElementById('devobs-is-complete')?.value === 'yes';

  const entry = {
    id:          _devobsId || genId('entry'),
    type:        'devobs',
    subtype:     'Developmental Observation',
    date,
    title:       `Dev Obs — ${lecturer} (${area})`,
    area,
    lecturer,
    coach:       document.getElementById('devobs-coach')?.value?.trim()    || 'Graeme Wright',
    context:     document.getElementById('devobs-context')?.value?.trim()  || '',
    session:     document.getElementById('devobs-session')?.value?.trim()  || '',
    // Section 2: obs rows
    obsRows,
    notes:       obsRows.map(r => `[${r.time||'—'}] ${r.evidence}`).join('\n\n'),
    // Section 3: plan
    goals:       document.getElementById('devobs-goals')?.value?.trim()      || '',
    strategies:  document.getElementById('devobs-strategies')?.value?.trim() || '',
    support:     document.getElementById('devobs-support')?.value?.trim()    || '',
    evidenceType:document.getElementById('devobs-evidence-type')?.value?.trim() || '',
    staffObjectives: document.getElementById('devobs-staff-objectives')?.value?.trim() || '',
    // Section 4: outcome
    completedBy:   document.getElementById('devobs-completed-by')?.value?.trim()   || '',
    completedDate: document.getElementById('devobs-completed-date')?.value          || '',
    viewable:      document.getElementById('devobs-viewable')?.value                || '',
    isComplete,
    outcome:       document.getElementById('devobs-outcome')?.value?.trim()         || '',
    // Structured fields for log display
    strengths: obsRows.filter(r=>r.evidence).map(r=>r.evidence).join('\n\n'),
    afis:      '',
    actions:   document.getElementById('devobs-strategies')?.value?.trim()  || '',
    // Meta
    tags:        _devobsTags,
    evidenceLinks: getDevObsEvidenceLinks(),
    referralId:  _devobsReferralId || '',
    threadId,
    requestedBy: _devobsReferralId ? (DB.referrals.find(r=>r.id===_devobsReferralId)?.requestedBy||'') : '',
    created:     new Date().toISOString(),
  };

  if (_devobsId) {
    const idx = DB.entries.findIndex(e => e.id === _devobsId);
    if (idx !== -1) DB.entries[idx] = entry;
  } else {
    DB.entries.unshift(entry);
    markDirty();
  }

  if (threadId) linkEntryToThread(entry.id, threadId);

  if (_devobsReferralId) {
    const r = DB.referrals.find(x => x.id === _devobsReferralId);
    if (r) r.status = isComplete ? 'complete' : 'in-progress';
    const task = DB.tasks.find(t => t.referralId === _devobsReferralId && t.status !== 'done');
    if (task && isComplete) { task.status = 'done'; task.entryId = entry.id; }
  }

  toast('Developmental Observation saved', 'success');
  updateReferralBadge();
  renderDashboard();
}

function clearDevObs() {
  if (!confirm('Clear the Dev Obs form?')) return;
  initDevObs({});
}

function copyDevObsToClipboard() {
  const lecturer = document.getElementById('devobs-lecturer')?.value     || '';
  const area     = document.getElementById('devobs-area')?.value          || '';
  const date     = document.getElementById('devobs-date')?.value          || '';
  const coach    = document.getElementById('devobs-coach')?.value         || 'Graeme Wright';
  const context  = document.getElementById('devobs-context')?.value       || '';

  // Obs rows
  const list = document.getElementById('devobs-obs-rows');
  const obsLines = [];
  if (list) {
    list.querySelectorAll('.obs-row').forEach(row => {
      const id       = row.id.replace('obs-row-','');
      const time     = document.getElementById('obs-time-'+id)?.value    || '—';
      const evidence = document.getElementById('obs-evidence-'+id)?.value?.trim() || '';
      const reflect  = document.getElementById('obs-reflect-'+id)?.value?.trim()  || '';
      const themes   = Array.from(document.getElementById('obs-themes-'+id)?.selectedOptions||[])
        .map(o=>o.text).join(', ');
      if (evidence || reflect) {
        obsLines.push(`[${time}] ${evidence}`);
        if (themes)  obsLines.push(`  Themes: ${themes}`);
        if (reflect) obsLines.push(`  Reflect: ${reflect}`);
        obsLines.push('');
      }
    });
  }

  const text = [
    `DEVELOPMENTAL OBSERVATION`,
    `=========================`,
    `Date: ${date}`,
    `Lecturer/Assessor: ${lecturer}`,
    `Coach/Observer: ${coach}`,
    `Department: ${area}`,
    `Context: ${context}`,
    ``,
    `OBSERVATION RECORD`,
    `------------------`,
    ...obsLines,
    `THE PLAN`,
    `--------`,
    `Goals: ${document.getElementById('devobs-goals')?.value||''}`,
    `Strategies: ${document.getElementById('devobs-strategies')?.value||''}`,
    `Support/Training: ${document.getElementById('devobs-support')?.value||''}`,
    `Evidence: ${document.getElementById('devobs-evidence-type')?.value||''}`,
    ``,
    `OUTCOME`,
    `-------`,
    `Completed: ${document.getElementById('devobs-is-complete')?.value||'no'}`,
    `${document.getElementById('devobs-outcome')?.value||''}`,
  ].join('\n');

  navigator.clipboard.writeText(text)
    .then(() => toast('Dev Obs copied to clipboard — paste into Hyper', 'success'))
    .catch(() => toast('Copy failed — use Ctrl+C', 'error'));
}