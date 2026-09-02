// DPC Hub · js/homepage.js · v1.1 · 02/09/26 · Session 64 — Needs your attention card
// Homepage module. Jobs Board (post-its), upcoming deadlines, upcoming meetings.
// Reads from window.DPC_DATA.calendar.entries
// Imports nothing — uses globals from schema.js, data.js, config.js

function initHomepage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>

    <!-- Metric strip -->
    <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <div style="flex:1;background:var(--color-amber-lt);border:1px solid var(--color-amber);border-radius:var(--radius-md);padding:var(--space-md) var(--space-lg);display:flex;flex-direction:column;gap:4px;">
        <span style="font-size:var(--text-xs);color:var(--color-amber);font-weight:var(--font-bold);text-transform:uppercase;letter-spacing:0.05em;">Open Loops</span>
        <span id="metric-open-afis" style="font-size:var(--text-3xl);font-weight:var(--font-bold);color:var(--color-amber);" aria-label="Open AFI loops">0</span>
      </div>
      <div style="flex:1;background:var(--color-green-lt);border:1px solid var(--color-green);border-radius:var(--radius-md);padding:var(--space-md) var(--space-lg);display:flex;flex-direction:column;gap:4px;">
        <span style="font-size:var(--text-xs);color:var(--color-green);font-weight:var(--font-bold);text-transform:uppercase;letter-spacing:0.05em;">Closed This Month</span>
        <span id="metric-closed-afis" style="font-size:var(--text-3xl);font-weight:var(--font-bold);color:var(--color-green);" aria-label="Loops closed this month">0</span>
      </div>
    </div>

    <!-- Needs your attention (Session 64) -->
    <section id="attention-card" aria-labelledby="attention-heading" style="display:none;margin-bottom:var(--space-lg);"></section>

    <!-- Main two-column layout -->
    <div style="display:grid;grid-template-columns:62% 38%;gap:var(--space-xl);align-items:start;">

      <!-- LEFT: Jobs Board -->
      <section aria-labelledby="jobs-board-heading">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
          <h2 id="jobs-board-heading" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Jobs Board</h2>
          <button id="add-task-btn" class="btn btn--primary btn--sm" type="button" aria-label="Add new task to Jobs Board">
            + Add task
          </button>
        </div>
        <div id="jobs-board-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-md);" aria-label="Jobs Board — task cards">
          <!-- Post-it cards injected here -->
        </div>
        <div id="jobs-board-empty" style="display:none;padding:var(--space-2xl);text-align:center;color:var(--color-muted);">
          <p style="font-size:var(--text-base);">No tasks yet — click <strong>+ Add task</strong> to create one.</p>
        </div>
      </section>

      <!-- RIGHT: Deadlines + Meetings -->
      <aside style="display:flex;flex-direction:column;gap:var(--space-lg);">

        <!-- Deadlines panel -->
        <section aria-labelledby="deadlines-heading" style="background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);max-height:340px;overflow-y:auto;">
          <h2 id="deadlines-heading" style="font-size:var(--text-md);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Next 14 days — Deadlines</h2>
          <div id="deadlines-list" aria-label="Upcoming deadlines"></div>
          <p id="deadlines-empty" style="font-size:var(--text-sm);color:var(--color-muted);display:none;">No deadlines in the next 14 days.</p>
        </section>

        <!-- Meetings panel -->
        <section aria-labelledby="meetings-heading" style="background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-lg);max-height:340px;overflow-y:auto;">
          <h2 id="meetings-heading" style="font-size:var(--text-md);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">This week — Meetings</h2>
          <div id="meetings-list" aria-label="Upcoming meetings this week"></div>
          <p id="meetings-empty" style="font-size:var(--text-sm);color:var(--color-muted);display:none;">No meetings this week.</p>
        </section>

      </aside>
    </div>

    <!-- Task detail modal -->
    <div id="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" style="
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:500;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="task-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);"></h2>
          <button id="task-modal-close" type="button" aria-label="Close task detail" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);">×</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="task-title">Title</label>
          <input class="form-input" type="text" id="task-title" name="task-title" required aria-required="true">
        </div>
        <div class="form-group">
          <label class="form-label" for="task-due">Due date</label>
          <input class="form-input" type="date" id="task-due" name="task-due">
        </div>
        <div class="form-group">
          <label class="form-label" for="task-status">Status</label>
          <select class="form-select" id="task-status" name="task-status">
            <option value="upcoming">Upcoming</option>
            <option value="in-progress">In Progress</option>
            <option value="complete">Complete</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-area">Linked area</label>
          <select class="form-select" id="task-area" name="task-area">
            <option value="">— None —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-project">Project / theme</label>
          <input class="form-input" type="text" id="task-project" name="task-project" placeholder="e.g. SEND focus, Digital Health Checks">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-desc">Description</label>
          <textarea class="form-textarea" id="task-desc" name="task-desc" rows="3"></textarea>
        </div>

        <input type="hidden" id="task-id">

        <div class="btn-row">
          <button id="task-save-btn" class="btn btn--primary" type="button">Save task</button>
          <button id="task-delete-btn" class="btn btn--danger" type="button" style="display:none;">Delete</button>
          <button id="task-cancel-btn" class="btn btn--secondary" type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _populateAreaDropdown('task-area');
  _renderMetrics();
  _renderAttentionCard();
  _renderJobsBoard();
  _renderDeadlines();
  _renderMeetings();
  _wireHomepageEvents();
}

// ── Populate area dropdown ────────────────────────────────────
function _populateAreaDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  areas.forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

// ── Metrics ───────────────────────────────────────────────────
function _renderMetrics() {
  const afis = (window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [];
  const openCount = afis.filter(a => a.status !== AFI_STATUS.CLOSED).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const closedCount = afis.filter(a => a.status === AFI_STATUS.CLOSED && a.closedAt && a.closedAt >= monthStart).length;

  const openEl = document.getElementById('metric-open-afis');
  const closedEl = document.getElementById('metric-closed-afis');
  if (openEl) openEl.textContent = openCount;
  if (closedEl) closedEl.textContent = closedCount;
}

// ── Jobs Board ────────────────────────────────────────────────
function _renderJobsBoard() {
  const grid = document.getElementById('jobs-board-grid');
  const empty = document.getElementById('jobs-board-empty');
  if (!grid) return;

  const entries = _getTaskEntries();
  const active = entries.filter(e => e.status !== TASK_STATUS.COMPLETE);
  active.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  grid.innerHTML = '';

  if (active.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  if (empty) empty.style.display = 'none';

  active.forEach(entry => {
    const card = _buildPostitCard(entry);
    grid.appendChild(card);
  });
}

function _buildPostitCard(entry) {
  const status = entry.status || TASK_STATUS.UPCOMING;
  const dotColour = {
    [TASK_STATUS.UPCOMING]:    'var(--color-blue)',
    [TASK_STATUS.IN_PROGRESS]: 'var(--color-amber)',
    [TASK_STATUS.OVERDUE]:     'var(--color-red)',
    [TASK_STATUS.COMPLETE]:    'var(--color-green)',
  }[status] || 'var(--color-muted)';

  const statusLabel = {
    [TASK_STATUS.UPCOMING]:    'Upcoming',
    [TASK_STATUS.IN_PROGRESS]: 'In Progress',
    [TASK_STATUS.OVERDUE]:     'Overdue',
    [TASK_STATUS.COMPLETE]:    'Complete',
  }[status] || status;

  const dueDisplay = entry.date ? _formatDate(entry.date) : '';
  const areaTag = entry.areaCode ? `<span style="font-size:var(--text-xs);background:var(--color-teal-lt);color:var(--color-teal);padding:2px 8px;border-radius:999px;">${entry.areaCode}</span>` : '';
  const projectTag = entry.projectRef ? `<span style="font-size:var(--text-xs);color:var(--color-muted);">${entry.projectRef}</span>` : '';

  const card = document.createElement('article');
  card.className = 'postit';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Task: ${entry.title}. Status: ${statusLabel}. ${dueDisplay ? 'Due: ' + dueDisplay : ''}`);
  card.dataset.entryId = entry.entryId;

  card.innerHTML = `
    <div class="postit__header">
      <span class="postit__status-dot" style="background:${dotColour};width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:4px;" aria-label="Status: ${statusLabel}"></span>
      ${dueDisplay ? `<span class="postit__due" style="font-size:var(--text-xs);color:var(--color-muted);">${dueDisplay}</span>` : ''}
    </div>
    <p class="postit__title" style="font-size:var(--text-md);font-weight:var(--font-bold);color:var(--color-navy);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${_escHtml(entry.title)}</p>
    <div class="postit__footer" style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:var(--space-sm);flex-wrap:wrap;">
      ${areaTag}
      ${projectTag}
    </div>
  `;

  card.addEventListener('click', () => _homeOpenTaskModal(entry.entryId));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _homeOpenTaskModal(entry.entryId); } });

  return card;
}

// ── Deadlines panel ───────────────────────────────────────────
function _renderDeadlines() {
  const list = document.getElementById('deadlines-list');
  const empty = document.getElementById('deadlines-empty');
  if (!list) return;

  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const todayStr = todayISO();
  const in14Str  = in14.toISOString().split('T')[0];

  const entries = _getAllEntries().filter(e =>
    (e.entryType === CALENDAR_TYPE.DEADLINE || e.entryType === CALENDAR_TYPE.TASK) &&
    e.date >= todayStr && e.date <= in14Str
  );
  entries.sort((a, b) => a.date.localeCompare(b.date));

  list.innerHTML = '';

  if (entries.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  entries.forEach(entry => {
    const daysUntil = Math.ceil((new Date(entry.date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
    const urgency = daysUntil <= 2 ? 'var(--color-red)' : daysUntil <= 7 ? 'var(--color-amber)' : 'var(--color-green)';
    const urgencyLabel = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;

    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border);';
    item.innerHTML = `
      <span style="width:8px;height:8px;border-radius:50%;background:${urgency};flex-shrink:0;" aria-label="${urgencyLabel}"></span>
      <div style="flex:1;min-width:0;">
        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-slate);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtml(entry.title)}</p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);">${urgencyLabel}</p>
      </div>
    `;
    list.appendChild(item);
  });
}

// ── Meetings panel ────────────────────────────────────────────
function _renderMeetings() {
  const list = document.getElementById('meetings-list');
  const empty = document.getElementById('meetings-empty');
  if (!list) return;

  const now = new Date();
  const todayStr    = todayISO();
  const weekEnd     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const entries = _getAllEntries().filter(e =>
    e.entryType === CALENDAR_TYPE.MEETING &&
    e.date >= todayStr && e.date <= weekEnd
  );
  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

  list.innerHTML = '';

  if (entries.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  entries.forEach(entry => {
    const persons = (entry.personRefs || []).join(', ') || '—';
    const timeStr = entry.startTime ? entry.startTime : '';
    const dayLabel = entry.date === todayStr ? 'Today' : _formatDate(entry.date);

    const item = document.createElement('div');
    item.style.cssText = 'padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border);cursor:pointer;';
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Meeting with ${persons} on ${dayLabel}${timeStr ? ' at ' + timeStr : ''}`);
    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-sm);">
        <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-slate);">${_escHtml(entry.title)}</p>
        ${timeStr ? `<span style="font-size:var(--text-xs);color:var(--color-muted);flex-shrink:0;">${timeStr}</span>` : ''}
      </div>
      <p style="font-size:var(--text-xs);color:var(--color-muted);">${dayLabel} · ${_escHtml(persons)}</p>
    `;
    item.addEventListener('click', () => navigateTo('calendar'));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo('calendar'); } });
    list.appendChild(item);
  });
}

// ── Task modal ────────────────────────────────────────────────
function _homeOpenTaskModal(entryId) {
  const modal = document.getElementById('task-modal');
  const titleEl = document.getElementById('task-modal-title');
  const idEl    = document.getElementById('task-id');
  const deleteBtn = document.getElementById('task-delete-btn');

  if (!modal) return;

  let entry = null;
  if (entryId) {
    entry = _getAllEntries().find(e => e.entryId === entryId);
  }

  if (entry) {
    titleEl.textContent = 'Edit task';
    document.getElementById('task-title').value   = entry.title || '';
    document.getElementById('task-due').value     = entry.date || '';
    document.getElementById('task-status').value  = entry.status || TASK_STATUS.UPCOMING;
    document.getElementById('task-area').value    = entry.areaCode || '';
    document.getElementById('task-project').value = entry.projectRef || '';
    document.getElementById('task-desc').value    = entry.notes || '';
    idEl.value = entryId;
    deleteBtn.style.display = 'inline-flex';
  } else {
    titleEl.textContent = 'New task';
    document.getElementById('task-title').value   = '';
    document.getElementById('task-due').value     = '';
    document.getElementById('task-status').value  = TASK_STATUS.UPCOMING;
    document.getElementById('task-area').value    = '';
    document.getElementById('task-project').value = '';
    document.getElementById('task-desc').value    = '';
    idEl.value = '';
    deleteBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
  document.getElementById('task-title').focus();
}

function _closeTaskModal() {
  const modal = document.getElementById('task-modal');
  if (modal) modal.style.display = 'none';
}

function _saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) {
    document.getElementById('task-title').focus();
    return;
  }

  const existingId = document.getElementById('task-id').value;
  const entry = {
    entryId:    existingId || generateId(),
    entryType:  CALENDAR_TYPE.TASK,
    title,
    date:       document.getElementById('task-due').value || todayISO(),
    startTime:  null,
    endTime:    null,
    status:     document.getElementById('task-status').value || TASK_STATUS.UPCOMING,
    areaCode:   document.getElementById('task-area').value || null,
    projectRef: document.getElementById('task-project').value.trim() || null,
    notes:      document.getElementById('task-desc').value.trim() || null,
    personRefs: [],
    isSurfaceLayerVisible: true,
  };

  saveCalendarEntry(entry);
  _closeTaskModal();
  _renderJobsBoard();
  _renderDeadlines();
}

function _deleteTask() {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  if (!confirm('Delete this task?')) return;
  deleteCalendarEntry(id);
  _closeTaskModal();
  _renderJobsBoard();
  _renderDeadlines();
}

// ── Wire events ───────────────────────────────────────────────
function _wireHomepageEvents() {
  const addBtn    = document.getElementById('add-task-btn');
  const closeBtn  = document.getElementById('task-modal-close');
  const saveBtn   = document.getElementById('task-save-btn');
  const deleteBtn = document.getElementById('task-delete-btn');
  const cancelBtn = document.getElementById('task-cancel-btn');
  const modal     = document.getElementById('task-modal');

  if (addBtn)    addBtn.addEventListener('click', () => _homeOpenTaskModal(null));
  if (closeBtn)  closeBtn.addEventListener('click', _closeTaskModal);
  if (cancelBtn) cancelBtn.addEventListener('click', _closeTaskModal);
  if (saveBtn)   saveBtn.addEventListener('click', _saveTask);
  if (deleteBtn) deleteBtn.addEventListener('click', _deleteTask);

  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) _closeTaskModal();
    });
  }

  // ESC to close
  document.addEventListener('keydown', function homepageEsc(e) {
    if (e.key === 'Escape') {
      const m = document.getElementById('task-modal');
      if (m && m.style.display === 'flex') {
        _closeTaskModal();
        e.stopPropagation();
      } else {
        document.removeEventListener('keydown', homepageEsc);
      }
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllEntries() {
  return (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [];
}

function _getTaskEntries() {
  return _getAllEntries().filter(e =>
    e.entryType === CALENDAR_TYPE.TASK || e.entryType === CALENDAR_TYPE.DEADLINE
  );
}

function _formatDate(isoDate) {
  if (!isoDate) return '';
  try {
    return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return isoDate; }
}

function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ── Needs your attention (Session 64) ─────────────────────────────
// A prompt, not an automation. Two things drift quietly: Health Checks
// that flagged actions but never got an Action Plan, and areas where the
// Health Check basis behind the Accessibility & Inclusion RAG score has
// moved since the RAG was last saved.
//
// Generating Action Plans is safe to do automatically (deduped, derived
// entirely from what was already recorded) so it gets a one-click
// button. Writing a RAG score is not — snapshots carry rationale and
// build a history, and a silently-written score with a blank rationale
// is exactly the number that cannot be defended later. So RAG drift
// links you to the area and leaves the judgement with you.
function _renderAttentionCard() {
  const card = document.getElementById('attention-card');
  if (!card || typeof getAttentionItems !== 'function') return;

  const { unplannedCount, drifts } = getAttentionItems();
  if (unplannedCount === 0 && drifts.length === 0) { card.style.display = 'none'; return; }

  const driftRow = (d) => {
    const area = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas || []).find(a => a.areaCode === d.areaCode);
    const name = area ? `${area.areaCode} — ${area.areaName}` : d.areaCode;
    const act = d.tier === 'act';
    const arrow = d.delta > 0 ? '▲' : '▼';
    const why = typeof describeRAGDrift === 'function' ? describeRAGDrift(d) : '';
    return `
      <li style="padding:var(--space-sm) 0;border-top:1px solid var(--color-border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-sm);flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <p style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);">
              ${_hpEsc(name)}
              <span style="font-weight:normal;color:${act ? 'var(--color-amber)' : 'var(--color-muted)'};">
                ${arrow} ${d.delta > 0 ? '+' : '−'}${Math.abs(d.delta).toFixed(2)} · ${act ? 'worth acting on' : 'worth knowing'}
              </span>
            </p>
            <p style="font-size:var(--text-xs);color:var(--color-muted);">
              Basis ${d.previousRaw.toFixed(2)} → ${d.currentRaw.toFixed(2)}.
              Stored score ${d.storedScore != null ? d.storedScore : 'not set'}, now suggests ${d.suggestedScore}.
            </p>
            <p style="font-size:var(--text-xs);color:var(--color-slate);margin-top:2px;">${_hpEsc(why)}</p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm attention-rag-btn" data-area="${_hpEsc(d.areaCode)}" style="font-size:10px;">
            Review RAG<span class="sr-only"> for ${_hpEsc(name)}</span>
          </button>
        </div>
      </li>`;
  };

  card.innerHTML = `
    <div style="border:1px solid var(--color-amber);background:var(--color-amber-lt);border-radius:var(--radius-md);padding:var(--space-lg);">
      <h2 id="attention-heading" style="font-size:var(--text-md);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">Needs your attention</h2>

      ${unplannedCount > 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-sm);flex-wrap:wrap;padding-bottom:var(--space-sm);">
          <p style="font-size:var(--text-sm);color:var(--color-slate);flex:1;min-width:220px;">
            <strong>${unplannedCount}</strong> Health Check${unplannedCount === 1 ? '' : 's'} flagged actions but ${unplannedCount === 1 ? 'has' : 'have'} no Action Plan.
          </p>
          <button id="attention-generate-btn" type="button" class="btn btn--secondary btn--sm">Generate ${unplannedCount} Action Plan${unplannedCount === 1 ? '' : 's'}</button>
        </div>
        <p id="attention-generate-status" role="status" style="font-size:var(--text-xs);color:var(--color-muted);"></p>
      ` : ''}

      ${drifts.length > 0 ? `
        <p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:var(--space-sm);">
          Accessibility &amp; Inclusion basis has moved in ${drifts.length} area${drifts.length === 1 ? '' : 's'} since the RAG was last saved.
        </p>
        <ul style="list-style:none;padding:0;margin:0;">${drifts.map(driftRow).join('')}</ul>
      ` : ''}
    </div>
  `;
  card.style.display = 'block';

  document.getElementById('attention-generate-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const status = document.getElementById('attention-generate-status');
    btn.disabled = true;
    const result = bulkGenerateActionPlansFromHealthChecks();
    if (status) status.textContent = `${result.created} created. ${result.skippedExisting} already had one. ${result.skippedNoActions} had no flagged actions.`;
    if (typeof UI !== 'undefined') UI.showToast('success', `${result.created} Action Plan(s) created.`);
    _renderAttentionCard();
  });

  card.querySelectorAll('.attention-rag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof openAreaProfile === 'function') openAreaProfile(btn.dataset.area, 'rag');
    });
  });
}

function _hpEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
