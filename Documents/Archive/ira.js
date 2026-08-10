/* ================================================================
   DPC EVIDENCE HUB — lra.js
   Learning Review Activity form, mirroring the Weston Hyper
   College Platform LRA form exactly. Five sections.
   Fill here first → "Copy for Hyper" pastes into Hyper.
   ================================================================ */

'use strict';

let _lraReferralId = '';
let _lraThreadId   = '';
let _lraTags       = {};
let _lraId         = null; // if editing existing

function initLRA(ctx) {
  _lraReferralId = ctx?.referralId || '';
  _lraThreadId   = ctx?.threadId   || '';
  _lraId         = ctx?.editId     || null;
  _lraTags       = {};

  const container = document.getElementById('lra-form-container');
  if (!container) return;

  const areaOpts = DB.areas.map(a =>
    `<option value="${esc(a.code)}">${esc(a.code)} · ${esc(a.name)}</option>`
  ).join('');
  const reqOpts = getRequestedByOptions().map(o =>
    `<option value="${esc(o)}">${esc(o)}</option>`
  ).join('');
  const threadOpts = DB.threads.filter(t => t.status !== 'closed').map(t =>
    `<option value="${esc(t.id)}">${esc(t.name)}</option>`
  ).join('');

  // Pre-fill from referral
  const ref = _lraReferralId ? DB.referrals.find(r => r.id === _lraReferralId) : null;

  container.innerHTML = `
    ${ref ? `<div class="notice info mb-16">
      <h3>📎 Responding to referral</h3>
      <p><strong>${esc(ref.actionType)}</strong> requested by <strong>${esc(ref.requestedBy)}</strong>
      ${ref.regarding ? ' — ' + esc(ref.regarding) : ''}</p>
    </div>` : ''}

    <!-- SECTION 1 — OBSERVATION DETAILS -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'lra-s1')"
        aria-expanded="true" id="lra-s1-hdr">
        <span><span class="badge badge-navy" aria-hidden="true">1</span> &nbsp;Observation Details</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="lra-s1">
        <div class="form-row-4">
          <div class="form-group">
            <label for="lra-year">Academic year</label>
            <select id="lra-year">
              <option selected>2025/26</option>
              <option>2026/27</option>
              <option>2024/25</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lra-date">Date <span class="req" aria-hidden="true">*</span></label>
            <input type="date" id="lra-date" value="${today()}" required aria-required="true">
          </div>
          <div class="form-group">
            <label for="lra-time-began">Time began</label>
            <input type="time" id="lra-time-began">
          </div>
          <div class="form-group">
            <label for="lra-time-complete">Time complete</label>
            <input type="time" id="lra-time-complete">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="lra-lecturer">Lecturer / Assessor <span class="req" aria-hidden="true">*</span></label>
            <input type="text" id="lra-lecturer"
              value="${ref?.regarding ? esc(ref.regarding) : ''}"
              required aria-required="true" placeholder="Full name">
          </div>
          <div class="form-group">
            <label for="lra-observer">Observer</label>
            <input type="text" id="lra-observer" value="Graeme Wright" placeholder="Observer name">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="lra-joint-observer">Joint observer</label>
            <input type="text" id="lra-joint-observer" placeholder="If applicable">
          </div>
          <div class="form-group">
            <label for="lra-area">Department / area <span class="req" aria-hidden="true">*</span></label>
            <select id="lra-area" required aria-required="true">
              <option value="">— select area —</option>
              ${areaOpts}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="lra-division">Division <span class="hint">(free text as in Hyper)</span></label>
            <input type="text" id="lra-division" placeholder="e.g. Technology & Science">
          </div>
          <div class="form-group">
            <label for="lra-programme">Programme</label>
            <input type="text" id="lra-programme" placeholder="e.g. BTEC Level 3 IT">
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label for="lra-attendance">Attendance %</label>
            <input type="number" id="lra-attendance" min="0" max="100" placeholder="e.g. 85">
          </div>
          <div class="form-group">
            <label for="lra-session-type">Session type</label>
            <select id="lra-session-type">
              <option>— select —</option>
              <option>Classroom</option>
              <option>Workshop</option>
              <option>Work-based learning</option>
              <option>Online / remote</option>
              <option>Blended</option>
              <option>Tutorial</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lra-provision">Provision</label>
            <select id="lra-provision">
              <option>— select —</option>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Apprenticeship</option>
              <option>Higher Education</option>
              <option>Work-based learning</option>
              <option>Skills Bootcamp</option>
              <option>Community Education</option>
              <option>SEND / FIP</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="lra-level">Level</label>
            <select id="lra-level">
              <option>— select —</option>
              <option>Entry level</option>
              <option>Level 1</option>
              <option>Level 2</option>
              <option>Level 3</option>
              <option>Level 4</option>
              <option>Level 5</option>
              <option>Level 6+</option>
              <option>SEND / non-quals</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lra-type">LRA type</label>
            <select id="lra-type" onchange="updateLRAPrompts()">
              <option>Learning Walk</option>
              <option>Learning Talk</option>
              <option>Work Review</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 2 — FINDINGS -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'lra-s2')"
        aria-expanded="true" id="lra-s2-hdr">
        <span><span class="badge badge-navy" aria-hidden="true">2</span> &nbsp;Findings / Observation</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="lra-s2">
        <div class="notice info mb-12" role="note" id="lra-findings-prompt">
          <h3 id="lra-findings-prompt-title">Learning Walk — reference prompts</h3>
          <p id="lra-findings-prompt-text">Consider: Learning Without Barriers · Digital skills visible in session · Accessibility of resources · AI use (learner and teacher) · Teams environment quality · Formative assessment approaches · Evidence of feedback acted upon · SEND / AT tools in use</p>
        </div>
        <div class="form-group">
          <label for="lra-findings">Observation notes</label>
          <div class="input-with-mic" style="align-items:flex-start">
            <textarea id="lra-findings" rows="8"
              placeholder="What did you observe? Use bullet points or narrative. Reference digital practice, accessibility, and TLA strategies specifically."></textarea>
            <button class="mic-btn" onclick="startDictation('lra-findings')"
              aria-label="Dictate findings" style="margin-top:2px">🎤</button>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 3 — THEMES -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'lra-s3')"
        aria-expanded="true" id="lra-s3-hdr">
        <span><span class="badge badge-navy" aria-hidden="true">3</span> &nbsp;Themes</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="lra-s3">
        <p class="text-sm text-muted mb-12">
          Select Positive Findings and Areas for Development using the Hyper theme taxonomy below.
          Tags also available for Ofsted, DTPF, KPI, and accountabilities.
        </p>
        <div class="form-row mb-12">
          <div class="form-group">
            <label for="lra-positive">Positive findings</label>
            <div class="input-with-mic" style="align-items:flex-start">
              <textarea id="lra-positive" rows="4"
                placeholder="Positive themes — reference Hyper taxonomy"></textarea>
              <button class="mic-btn" onclick="startDictation('lra-positive')"
                aria-label="Dictate positive findings" style="margin-top:2px">🎤</button>
            </div>
          </div>
          <div class="form-group">
            <label for="lra-afds">Areas for Development (AFDs)</label>
            <div class="input-with-mic" style="align-items:flex-start">
              <textarea id="lra-afds" rows="4"
                placeholder="AFD themes — reference Hyper taxonomy"></textarea>
              <button class="mic-btn" onclick="startDictation('lra-afds')"
                aria-label="Dictate AFDs" style="margin-top:2px">🎤</button>
            </div>
          </div>
        </div>
        <div class="flex gap-8 flex-wrap mb-8">
          <button class="btn btn-secondary btn-sm"
            onclick="openTagPicker(tags=>{_lraTags=tags;updateLRATagDisplay()},_lraTags,'lra')"
            id="lra-tag-btn">
            🏷 Select tags (Hyper themes, Ofsted, DTPF…)
          </button>
          <span id="lra-tag-count" class="text-sm text-muted"></span>
        </div>
        <div id="lra-tag-chips" class="flex flex-wrap gap-4" aria-live="polite"></div>
      </div>
    </div>

    <!-- SECTION 4 — ACTIONS -->
    <div class="section-panel mb-12">
      <button class="section-panel-header" onclick="togglePanel(this,'lra-s4')"
        aria-expanded="true" id="lra-s4-hdr">
        <span><span class="badge badge-navy" aria-hidden="true">4</span> &nbsp;Actions</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="lra-s4">
        <p class="text-sm text-muted mb-12">
          Agreed actions from the AFDs above. Add as many as needed.
        </p>
        <div id="lra-actions-list">
          ${lraActionRow(1)}
        </div>
        <button class="btn btn-secondary btn-sm mt-8" onclick="addLRAActionRow()">+ Add action</button>
      </div>
    </div>

    <!-- SECTION 5 — REFERRAL -->
    <div class="section-panel mb-16">
      <button class="section-panel-header" onclick="togglePanel(this,'lra-s5')"
        aria-expanded="true" id="lra-s5-hdr">
        <span><span class="badge badge-navy" aria-hidden="true">5</span> &nbsp;Referral / Follow-up</span>
        <span class="panel-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="section-panel-body open" id="lra-s5">
        <div class="form-group">
          <label for="lra-referral-type">Refer for</label>
          <select id="lra-referral-type">
            <option value="">— no referral —</option>
            ${DB.referralActionTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="lra-referral-notes">Referral notes</label>
          <textarea id="lra-referral-notes" rows="2"
            placeholder="Brief for whoever follows up…"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="lra-thread-select">Link to thread</label>
            <select id="lra-thread-select">
              <option value="">— no thread —</option>
              ${threadOpts}
              ${_lraThreadId ? '' : `<option value="__new__">+ Start new thread</option>`}
            </select>
          </div>
          <div class="form-group">
            <label for="lra-new-thread-name">New thread name <span class="hint">(if starting new)</span></label>
            <input type="text" id="lra-new-thread-name" placeholder="Auto-suggested on save">
          </div>
        </div>
      </div>
    </div>

    <!-- EVIDENCE LINKS -->
    <div class="card mb-16">
      <div class="card-title flex-between">
        Evidence links &amp; resources
        <span class="text-xs text-muted fw-400">SharePoint, Teams recordings, screenshots, outputs…</span>
      </div>
      <div id="lra-evidence-links-list"></div>
      <button class="btn btn-sm btn-secondary mt-8" onclick="addLRAEvidenceLink()">+ Add link</button>
    </div>

    <!-- SAVE BAR -->
    <div class="flex gap-8 flex-wrap" style="padding:.75rem 0;border-top:1px solid var(--border)">
      <button class="btn btn-primary" onclick="saveLRA()">✦ Save LRA</button>
      <button class="btn btn-secondary" onclick="copyLRAToClipboard()" id="lra-copy-btn2">📋 Copy for Hyper</button>
      <button class="btn btn-ghost" onclick="clearLRA()">Clear form</button>
    </div>
  `;

  // Pre-select thread if coming from thread context
  if (_lraThreadId) {
    const sel = document.getElementById('lra-thread-select');
    if (sel) sel.value = _lraThreadId;
  }

  updateLRATagDisplay();
  let _lraActionCount = 1;
  window._lraActionCount = 1;
}

/* ── LRA TYPE PROMPTS ─────────────────────────────────────────── */

const LRA_PROMPTS = {
  'Learning Walk': {
    title: 'Learning Walk — reference prompts',
    text: 'Consider: Learning Without Barriers · Digital skills visible in session · Accessibility of resources · AI use (learner and teacher) · Teams environment quality · Formative assessment approaches · Evidence of feedback acted upon · SEND / AT tools in use',
    placeholder: 'What did you observe during the session? Reference digital practice, accessibility tools, TLA strategies, and learner engagement with technology specifically.',
  },
  'Learning Talk': {
    title: 'Learning Talk — reference prompts',
    text: 'Provide a summary of the questions, discussion topics and learner responses. Consider: Behaviour for learning · Culture and promotion of values (BV) · Planning for individual learning · Assessment and feedback during learning · Challenge and deeper learning · Attendance and punctuality · Resources and equipment · The learning environment · Learners\' readiness to learn · Engagement with learning activities · Focus and mindset · Development of ID skills · Development of maths and English skills · Use of technology to enhance learning · Employability skill development',
    placeholder: 'Summarise the questions asked, discussion topics covered, and learner responses. What did learners say about their digital experience, skills, and confidence?',
  },
  'Work Review': {
    title: 'Work Review — reference prompts',
    text: 'Provide a summary of your findings and the context of the reviewed material. Consider: Behaviour for learning · Culture and promotion of values (BV) · Planning for individual learning · Assessment and feedback during learning · Challenge and deeper learning · Attendance and punctuality · Resources and equipment · The learning environment · Learners\' readiness to learn · Engagement with learning activities · Focus and mindset · Development of ID skills · Development of maths and English skills · Use of technology to enhance learning · Employability skill development',
    placeholder: 'Summarise findings from the reviewed material. What does the work tell you about digital skill development, quality of digital resources, and evidence of teacher feedback on digital outputs?',
  },
};

function updateLRAPrompts() {
  const type    = document.getElementById('lra-type')?.value || 'Learning Walk';
  const prompts = LRA_PROMPTS[type] || LRA_PROMPTS['Learning Walk'];

  const titleEl = document.getElementById('lra-findings-prompt-title');
  const textEl  = document.getElementById('lra-findings-prompt-text');
  const fieldEl = document.getElementById('lra-findings');

  if (titleEl) titleEl.textContent = prompts.title;
  if (textEl)  textEl.textContent  = prompts.text;
  if (fieldEl) fieldEl.placeholder = prompts.placeholder;
}

/* ── EVIDENCE LINKS ───────────────────────────────────────────── */

let _lraEvidenceLinkCount = 0;

function addLRAEvidenceLink() {
  const list = document.getElementById('lra-evidence-links-list');
  if (!list) return;
  _lraEvidenceLinkCount++;
  const n   = _lraEvidenceLinkCount;
  const div = document.createElement('div');
  div.id    = 'lra-link-row-' + n;
  div.className = 'form-row mb-6';
  div.style.gridTemplateColumns = '1fr 1fr auto';
  div.innerHTML = `
    <div class="form-group" style="margin-bottom:0">
      <label for="lra-link-url-${n}" class="sr-only">Link URL ${n}</label>
      <input type="url" id="lra-link-url-${n}" placeholder="https://weston.sharepoint.com/…"
        aria-label="Evidence link URL ${n}">
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label for="lra-link-label-${n}" class="sr-only">Link description ${n}</label>
      <input type="text" id="lra-link-label-${n}" placeholder="Description (e.g. Teams recording, Screenshot)"
        aria-label="Evidence link description ${n}">
    </div>
    <button class="btn btn-sm btn-danger" onclick="document.getElementById('lra-link-row-${n}').remove()"
      aria-label="Remove link ${n}" style="align-self:center;margin-top:0">✕</button>
  `;
  list.appendChild(div);
}

function getLRAEvidenceLinks() {
  const links = [];
  for (let i = 1; i <= _lraEvidenceLinkCount; i++) {
    const url   = document.getElementById('lra-link-url-'+i)?.value?.trim();
    const label = document.getElementById('lra-link-label-'+i)?.value?.trim();
    if (url) links.push({ url, label: label || url });
  }
  return links;
}

function lraActionRow(n) {
  return `<div class="form-row-3 mb-8" id="lra-action-row-${n}" style="align-items:flex-start">
    <div class="form-group">
      <label for="lra-action-theme-${n}">Theme (from AFD)</label>
      <input type="text" id="lra-action-theme-${n}" placeholder="Hyper theme reference">
    </div>
    <div class="form-group">
      <label for="lra-action-comment-${n}">Action / comment</label>
      <textarea id="lra-action-comment-${n}" rows="2" placeholder="What needs to happen?"></textarea>
    </div>
    <div class="form-group">
      <label for="lra-action-when-${n}">When / deadline</label>
      <input type="date" id="lra-action-when-${n}">
    </div>
  </div>`;
}

function addLRAActionRow() {
  window._lraActionCount = (window._lraActionCount || 1) + 1;
  const list = document.getElementById('lra-actions-list');
  if (!list) return;
  const div = document.createElement('div');
  div.innerHTML = lraActionRow(window._lraActionCount);
  list.appendChild(div.firstElementChild);
}

function updateLRATagDisplay() {
  const chips = document.getElementById('lra-tag-chips');
  const count = document.getElementById('lra-tag-count');
  if (chips) chips.innerHTML = renderTagChips(_lraTags, { showAll: true });
  if (count) {
    const n = countTags(_lraTags);
    count.textContent = n ? `${n} tag${n > 1 ? 's' : ''} selected` : '';
  }
}

function saveLRA() {
  const date     = document.getElementById('lra-date')?.value;
  const lecturer = document.getElementById('lra-lecturer')?.value?.trim();
  const area     = document.getElementById('lra-area')?.value;

  if (!date)     { markInvalid('lra-date','Date required');         return; }
  if (!lecturer) { markInvalid('lra-lecturer','Lecturer required'); return; }
  if (!area)     { markInvalid('lra-area','Area required');         return; }

  // Collect actions
  const actions = [];
  const count = window._lraActionCount || 1;
  for (let i = 1; i <= count; i++) {
    const theme   = document.getElementById('lra-action-theme-'+i)?.value?.trim();
    const comment = document.getElementById('lra-action-comment-'+i)?.value?.trim();
    const when    = document.getElementById('lra-action-when-'+i)?.value;
    if (comment) actions.push({ theme, comment, when });
  }

  // Determine thread
  let threadId = document.getElementById('lra-thread-select')?.value || _lraThreadId || '';
  if (threadId === '__new__') {
    const tName = document.getElementById('lra-new-thread-name')?.value?.trim()
      || [area, lecturer, 'LRA', fmtDate(date)].filter(Boolean).join(' · ');
    threadId = createThread(tName, 'Self-initiated');
  }

  const entry = {
    id:          _lraId || genId('entry'),
    type:        'lra',
    subtype:     document.getElementById('lra-type')?.value || 'Learning Walk',
    date,
    title:       `LRA — ${lecturer} (${area})`,
    area,
    lecturer,
    observer:    document.getElementById('lra-observer')?.value?.trim()   || 'Graeme Wright',
    jointObs:    document.getElementById('lra-joint-observer')?.value?.trim() || '',
    division:    document.getElementById('lra-division')?.value?.trim()   || '',
    programme:   document.getElementById('lra-programme')?.value?.trim()  || '',
    timeBegan:   document.getElementById('lra-time-began')?.value         || '',
    timeComplete:document.getElementById('lra-time-complete')?.value      || '',
    sessionType: document.getElementById('lra-session-type')?.value       || '',
    provision:   document.getElementById('lra-provision')?.value          || '',
    level:       document.getElementById('lra-level')?.value              || '',
    attendance:  document.getElementById('lra-attendance')?.value         || '',
    academicYear:document.getElementById('lra-year')?.value               || '2025/26',
    notes:       document.getElementById('lra-findings')?.value?.trim()   || '',
    strengths:   document.getElementById('lra-positive')?.value?.trim()   || '',
    afis:        document.getElementById('lra-afds')?.value?.trim()       || '',
    actions:     actions.map(a => `${a.theme ? '['+a.theme+'] ' : ''}${a.comment}${a.when?' ('+a.when+')':''}`).join('\n'),
    lraActions:  actions,
    referralAction: document.getElementById('lra-referral-type')?.value   || '',
    referralNotes:  document.getElementById('lra-referral-notes')?.value?.trim() || '',
    tags:        _lraTags,
    evidenceLinks: getLRAEvidenceLinks(),
    referralId:  _lraReferralId || '',
    threadId,
    requestedBy: _lraReferralId ? (DB.referrals.find(r=>r.id===_lraReferralId)?.requestedBy||'') : '',
    created:     new Date().toISOString(),
  };

  // Update or insert
  if (_lraId) {
    const idx = DB.entries.findIndex(e => e.id === _lraId);
    if (idx !== -1) DB.entries[idx] = entry;
  } else {
    DB.entries.unshift(entry);
    markDirty();
  }

  if (threadId) linkEntryToThread(entry.id, threadId);

  // Create follow-up referral if specified
  const refType = entry.referralAction;
  if (refType) {
    const ref = {
      id:          genId('ref'),
      date:        date,
      deadline:    '',
      requestedBy: entry.observer || 'Graeme Wright',
      actionType:  refType,
      regarding:   lecturer + ' (' + area + ')',
      area,
      context:     entry.referralNotes || '',
      priority:    'normal',
      threadId,
      status:      'open',
      created:     new Date().toISOString(),
      tasks:       [],
    };
    DB.referrals.unshift(ref);
    createTaskFromReferral(ref);
    toast('Follow-up referral created: ' + refType, 'success');
  }

  // Mark original referral in-progress
  if (_lraReferralId) {
    const r = DB.referrals.find(x => x.id === _lraReferralId);
    if (r) r.status = 'in-progress';
    const task = DB.tasks.find(t => t.referralId === _lraReferralId && t.status !== 'done');
    if (task) { task.status = 'done'; task.entryId = entry.id; }
  }

  toast('LRA saved', 'success');
  updateReferralBadge();
  renderDashboard();
}

function clearLRA() {
  if (!confirm('Clear the LRA form?')) return;
  initLRA({});
}

function copyLRAToClipboard() {
  const date     = document.getElementById('lra-date')?.value          || '';
  const lecturer = document.getElementById('lra-lecturer')?.value      || '';
  const area     = document.getElementById('lra-area')?.value          || '';
  const division = document.getElementById('lra-division')?.value      || '';
  const programme= document.getElementById('lra-programme')?.value     || '';
  const type     = document.getElementById('lra-type')?.value          || '';
  const sessionT = document.getElementById('lra-session-type')?.value  || '';
  const level    = document.getElementById('lra-level')?.value         || '';
  const att      = document.getElementById('lra-attendance')?.value    || '';
  const findings = document.getElementById('lra-findings')?.value      || '';
  const positive = document.getElementById('lra-positive')?.value      || '';
  const afds     = document.getElementById('lra-afds')?.value          || '';

  // Collect actions
  const count = window._lraActionCount || 1;
  const actionLines = [];
  for (let i = 1; i <= count; i++) {
    const theme   = document.getElementById('lra-action-theme-'+i)?.value?.trim();
    const comment = document.getElementById('lra-action-comment-'+i)?.value?.trim();
    const when    = document.getElementById('lra-action-when-'+i)?.value;
    if (comment) actionLines.push(`  • ${theme?'['+theme+'] ':''}${comment}${when?' — '+when:''}`);
  }

  // Hyper theme tags
  const hyperLabels = (_lraTags.hyperThemes||[]).map(id => getHyperThemeLabel(id));
  const ofstedLabels= (_lraTags.ofsted||[]).map(id => DB.tags.ofsted.find(t=>t.id===id)?.label||id);

  const text = [
    `LEARNING REVIEW ACTIVITY (LRA)`,
    `=====================================`,
    `Date: ${date}`,
    `Lecturer/Assessor: ${lecturer}`,
    `Observer: ${document.getElementById('lra-observer')?.value||'Graeme Wright'}`,
    `Department: ${area}${division?' / '+division:''}`,
    `Programme: ${programme}`,
    `Session type: ${sessionT}  |  Level: ${level}  |  Attendance: ${att}%`,
    `LRA type: ${type}`,
    ``,
    `SECTION 2 — FINDINGS`,
    `---------------------`,
    findings,
    ``,
    `SECTION 3 — THEMES`,
    `-------------------`,
    `Positive findings:`,
    positive,
    ``,
    `Areas for Development:`,
    afds,
    ``,
    hyperLabels.length ? `Hyper themes: ${hyperLabels.join(', ')}` : '',
    ofstedLabels.length ? `Ofsted: ${ofstedLabels.join(', ')}` : '',
    ``,
    actionLines.length ? `SECTION 4 — ACTIONS\n-------------------\n${actionLines.join('\n')}` : '',
    ``,
    `Referral: ${document.getElementById('lra-referral-type')?.value||'None'}`,
    document.getElementById('lra-referral-notes')?.value||'',
  ].filter(s => s !== '').join('\n');

  navigator.clipboard.writeText(text)
    .then(() => toast('LRA copied to clipboard — paste into Hyper', 'success'))
    .catch(() => toast('Copy failed — use Ctrl+C on the text', 'error'));
}