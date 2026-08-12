// DPC Hub · js/tasks.js · v1.0 · 07/08/26 · Session 48
// Tasks module. Was a bare placeholder (renderPlaceholder('Tasks','✓')) —
// no real data model existed at all before this.
//
// Deliberately NOT a new data-tasks.json store. Calendar already has a
// real, working entry model with entryType: CALENDAR_TYPE.TASK built in
// and completely unused. A task here IS a calendar entry — same
// saveCalendarEntry() function, same window.DPC_DATA.calendar.entries
// array. That's what actually makes "tasks populate my Calendar" true
// without a second store to keep in sync — there's only ever one copy.
//
// source / sourceRef are the two new fields this session adds to that
// entry shape (harmless — every existing calendar.js code path already
// tolerates fields it doesn't know about). They're what let a task say
// where it came from — a DL meeting, an Action Plan item — even though
// it's stored as an ordinary calendar entry alongside everything else.

let _tasksFilter = 'open'; // 'open' | 'complete' | 'all'

function initTasks() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Tasks</h1>
      <button id="task-new-btn" type="button" class="btn btn--primary btn--sm">+ New task</button>
    </div>

    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);">
      <button type="button" class="btn btn--ghost btn--sm task-filter-btn" data-filter="open" style="font-weight:bold;">Open</button>
      <button type="button" class="btn btn--ghost btn--sm task-filter-btn" data-filter="complete">Complete</button>
      <button type="button" class="btn btn--ghost btn--sm task-filter-btn" data-filter="all">All</button>
    </div>

    <div id="task-list"></div>

    <!-- New/Edit task modal -->
    <div id="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:480px;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="task-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">New task</h2>
          <button id="task-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="task-title">Title</label>
          <input class="form-input" type="text" id="task-title" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="task-date">Due date</label>
            <input class="form-input" type="date" id="task-date" required>
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="task-time">Time</label>
            <input class="form-input" type="time" id="task-time">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-area">Area</label>
          <select class="form-select" id="task-area"><option value="">— None —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-person">Person(s)</label>
          <input class="form-input" type="text" id="task-person" placeholder="Comma-separated names">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="task-notes">Notes</label>
          <textarea class="form-textarea" id="task-notes" rows="3"></textarea>
        </div>
        <input type="hidden" id="task-modal-id">
        <div class="btn-row">
          <button id="task-modal-save" type="button" class="btn btn--primary">Save</button>
          <button id="task-modal-cancel" type="button" class="btn btn--secondary">Cancel</button>
          <button id="task-modal-delete" type="button" class="btn btn--ghost" style="color:var(--color-red);border-color:var(--color-red);display:none;">Delete</button>
        </div>
      </div>
    </div>
  `;

  _tasksPopulateAreaDropdown();
  _renderTaskList();
  _wireTaskEvents();

  // Cross-module deep link (Session 51) — matches openStaffProfile() /
  // openAreaProfile() / openLoop(). Opens straight to a specific task's
  // edit modal rather than just landing on the Tasks list.
  if (window._pendingTaskOpen) {
    const targetId = window._pendingTaskOpen;
    window._pendingTaskOpen = null;
    _openTaskModal(targetId);
  }
}

// Public: navigate to Tasks and open a specific one — callable from
// anywhere that shows a task reference (Action Plan cards).
function openTask(taskId) {
  window._pendingTaskOpen = taskId;
  navigateTo('tasks');
}

function _renderTaskList() {
  const list = document.getElementById('task-list');
  if (!list) return;
  let tasks = _getAllTasks();

  if (_tasksFilter === 'open') tasks = tasks.filter(t => t.status !== TASK_STATUS.COMPLETE);
  if (_tasksFilter === 'complete') tasks = tasks.filter(t => t.status === TASK_STATUS.COMPLETE);

  // Overdue first, then by due date ascending, complete tasks last
  const today = todayISO();
  tasks.sort((a, b) => {
    if (a.status === TASK_STATUS.COMPLETE && b.status !== TASK_STATUS.COMPLETE) return 1;
    if (b.status === TASK_STATUS.COMPLETE && a.status !== TASK_STATUS.COMPLETE) return -1;
    return (a.date || '').localeCompare(b.date || '');
  });

  if (tasks.length === 0) {
    list.innerHTML = `<p style="color:var(--color-muted);font-size:var(--text-sm);">No ${_tasksFilter === 'all' ? '' : _tasksFilter + ' '}tasks.</p>`;
    return;
  }

  list.innerHTML = tasks.map(t => {
    const isOverdue = t.status !== TASK_STATUS.COMPLETE && t.date && t.date < today;
    const isDone = t.status === TASK_STATUS.COMPLETE;
    return `
    <div style="display:flex;align-items:flex-start;gap:var(--space-md);padding:var(--space-md);border:1px solid ${isOverdue ? 'var(--color-red)' : 'var(--color-border)'};border-radius:var(--radius-md);margin-bottom:var(--space-sm);${isDone ? 'opacity:0.6;' : ''}">
      <input type="checkbox" class="task-done-checkbox" data-task-id="${t.entryId}" ${isDone ? 'checked' : ''} style="margin-top:4px;width:20px;height:20px;">
      <div style="flex:1;cursor:pointer;" class="task-row-open" data-task-id="${t.entryId}">
        <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);${isDone ? 'text-decoration:line-through;' : ''}">${_tEsc(t.title)}</p>
        <p style="font-size:var(--text-xs);color:${isOverdue ? 'var(--color-red)' : 'var(--color-muted)'};">
          ${isOverdue ? 'Overdue — ' : ''}${_tFmtDate(t.date)}
          ${t.areaCode ? ' · ' + _tEsc(t.areaCode) : ''}
          ${(t.personRefs||[]).length ? ' · ' + _tEsc(t.personRefs.join(', ')) : ''}
          ${t.source && t.source !== 'manual' ? ` · <span style="font-style:italic;">from ${_tEsc(t.source)}</span>` : ''}
        </p>
        ${t.notes ? `<p style="font-size:var(--text-xs);color:var(--color-slate);margin-top:2px;">${_tEsc(t.notes)}</p>` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.task-done-checkbox').forEach(cb => {
    cb.addEventListener('change', () => _tSetTaskDone(cb.dataset.taskId, cb.checked));
  });
  list.querySelectorAll('.task-row-open').forEach(row => {
    row.addEventListener('click', () => _openTaskModal(row.dataset.taskId));
  });
}

function _tSetTaskDone(taskId, done) {
  const task = _getAllTasks().find(t => t.entryId === taskId);
  if (!task) return;
  task.status = done ? TASK_STATUS.COMPLETE : TASK_STATUS.UPCOMING;
  saveCalendarEntry(task);
  // Session (11/08/26): a task created from an Action Plan item (via
  // createTaskFromSource) used to be a one-way copy — completing it here
  // never fed back to the item it came from, so the Action Plan and the
  // Tasks tab silently disagreed about whether the work was actually done.
  if (task.source === 'action-plan' && task.sourceRef && typeof toggleActionItemDone === 'function') {
    toggleActionItemDone(task.sourceRef.planId, task.sourceRef.itemId, done);
  }
  _renderTaskList();
}

function _openTaskModal(taskId = null) {
  const modal = document.getElementById('task-modal');
  const titleEl = document.getElementById('task-modal-title');
  const deleteBtn = document.getElementById('task-modal-delete');
  if (!modal) return;
  const task = taskId ? _getAllTasks().find(t => t.entryId === taskId) : null;
  titleEl.textContent = task ? 'Edit task' : 'New task';
  document.getElementById('task-title').value = task ? task.title : '';
  document.getElementById('task-date').value = task ? task.date : todayISO();
  document.getElementById('task-time').value = task ? (task.startTime || '') : '';
  document.getElementById('task-area').value = task ? (task.areaCode || '') : '';
  document.getElementById('task-person').value = task ? (task.personRefs || []).join(', ') : '';
  document.getElementById('task-notes').value = task ? (task.notes || '') : '';
  document.getElementById('task-modal-id').value = taskId || '';
  if (deleteBtn) deleteBtn.style.display = task ? 'inline-flex' : 'none';
  modal.style.display = 'flex';
  document.getElementById('task-title').focus();
}

function _saveTaskModal() {
  const title = document.getElementById('task-title').value.trim();
  const date = document.getElementById('task-date').value;
  if (!title) { document.getElementById('task-title').focus(); return; }
  if (!date) { document.getElementById('task-date').focus(); return; }

  const existingId = document.getElementById('task-modal-id').value;
  const existing = existingId ? _getAllTasks().find(t => t.entryId === existingId) : null;
  const personStr = document.getElementById('task-person').value.trim();

  const task = {
    entryId: existingId || generateId(),
    entryType: CALENDAR_TYPE.TASK,
    title,
    date,
    startTime: document.getElementById('task-time').value || null, endTime: null,
    personRefs: personStr ? personStr.split(',').map(p => p.trim()).filter(Boolean) : [],
    areaCode: document.getElementById('task-area').value || null,
    projectRef: null,
    status: existing ? existing.status : TASK_STATUS.UPCOMING,
    notes: document.getElementById('task-notes').value.trim() || null,
    microTasks: [],
    isSurfaceLayerVisible: true,
    source: existing?.source || 'manual',
    sourceRef: existing?.sourceRef || null,
  };
  saveCalendarEntry(task);
  document.getElementById('task-modal').style.display = 'none';
  _renderTaskList();
  if (typeof UI !== 'undefined') UI.showToast('success', `Task ${existing ? 'updated' : 'created'}: ${title}`);
}

function _wireTaskEvents() {
  document.getElementById('task-new-btn')?.addEventListener('click', () => _openTaskModal());
  document.getElementById('task-modal-close')?.addEventListener('click', () => { document.getElementById('task-modal').style.display = 'none'; });
  document.getElementById('task-modal-cancel')?.addEventListener('click', () => { document.getElementById('task-modal').style.display = 'none'; });
  document.getElementById('task-modal-save')?.addEventListener('click', _saveTaskModal);
  document.getElementById('task-modal-delete')?.addEventListener('click', () => {
    const taskId = document.getElementById('task-modal-id').value;
    if (!taskId) return;
    if (!confirm('Delete this task permanently? This cannot be undone.')) return;
    deleteCalendarEntry(taskId);
    document.getElementById('task-modal').style.display = 'none';
    _renderTaskList();
    if (typeof UI !== 'undefined') UI.showToast('success', 'Task deleted.');
  });
  document.getElementById('task-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('task-modal')) document.getElementById('task-modal').style.display = 'none'; });

  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _tasksFilter = btn.dataset.filter;
      document.querySelectorAll('.task-filter-btn').forEach(b => b.style.fontWeight = 'normal');
      btn.style.fontWeight = 'bold';
      _renderTaskList();
    });
  });
}

function _tasksPopulateAreaDropdown() {
  const sel = document.getElementById('task-area');
  if (!sel) return;
  (_getAreas() || []).sort((a, b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

// ── Public helper: create a task from elsewhere in the app ────────
// Used by Digital Leads (meeting actions agreed) and Action Plans
// (individual action items) so those genuinely create a real task here,
// not just a text note that says a task should exist.
function createTaskFromSource(taskData, source, sourceRef) {
  const task = {
    entryId: generateId(),
    entryType: CALENDAR_TYPE.TASK,
    title: taskData.title,
    date: taskData.date || todayISO(),
    startTime: null, endTime: null,
    personRefs: taskData.personRefs || [],
    areaCode: taskData.areaCode || null,
    projectRef: null,
    status: TASK_STATUS.UPCOMING,
    notes: taskData.notes || null,
    microTasks: [],
    isSurfaceLayerVisible: true,
    source,
    sourceRef,
  };
  saveCalendarEntry(task);
  return task;
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllTasks() {
  return ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []).filter(e => e.entryType === CALENDAR_TYPE.TASK);
}
function _tFmtDate(iso) { if (!iso) return ''; try { return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } }
function _tEsc(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
