// DPC Hub · js/calendar.js · v1.0 · July 2026
// Calendar module. Week / Month / Year views.
// Add / edit / delete entries. Links to Meetings module.
// Reads from and writes to window.DPC_DATA.calendar.entries via data.js

// ── Module state ──────────────────────────────────────────────
let _calView    = 'week';   // 'week' | 'month' | 'year'
let _calAnchor  = null;     // Date — the anchor date for current view

function initCalendar() {
  _calAnchor = new Date();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>

    <!-- Calendar toolbar -->
    <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-lg);flex-wrap:wrap;">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-right:auto;">Calendar</h1>

      <!-- View toggle -->
      <div role="group" aria-label="Calendar view" style="display:flex;border:1px solid var(--color-border);border-radius:var(--radius-sm);overflow:hidden;">
        <button id="cal-view-week"  class="cal-view-btn cal-view-btn--active" type="button" aria-pressed="true"  data-view="week"  style="padding:8px 16px;border:none;cursor:pointer;font:bold var(--text-sm) Arial,sans-serif;min-height:44px;background:var(--color-teal);color:var(--color-white);">Week</button>
        <button id="cal-view-month" class="cal-view-btn" type="button" aria-pressed="false" data-view="month" style="padding:8px 16px;border:none;cursor:pointer;font:var(--text-sm) Arial,sans-serif;min-height:44px;background:var(--color-white);color:var(--color-slate);border-left:1px solid var(--color-border);">Month</button>
        <button id="cal-view-year"  class="cal-view-btn" type="button" aria-pressed="false" data-view="year"  style="padding:8px 16px;border:none;cursor:pointer;font:var(--text-sm) Arial,sans-serif;min-height:44px;background:var(--color-white);color:var(--color-slate);border-left:1px solid var(--color-border);">Year</button>
      </div>

      <!-- Navigation -->
      <button id="cal-prev" type="button" aria-label="Previous" style="background:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:var(--text-base);min-height:44px;min-width:44px;">‹</button>
      <span id="cal-period-label" style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-slate);min-width:180px;text-align:center;" aria-live="polite" aria-atomic="true"></span>
      <button id="cal-next" type="button" aria-label="Next" style="background:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:var(--text-base);min-height:44px;min-width:44px;">›</button>
      <button id="cal-today" type="button" class="btn btn--ghost btn--sm">Today</button>
      <button id="cal-add-btn" type="button" class="btn btn--primary btn--sm">+ Add entry</button>
    </div>

    <!-- Calendar grid -->
    <div id="cal-grid" style="background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden;"></div>

    <!-- Entry modal -->
    <div id="cal-modal" role="dialog" aria-modal="true" aria-labelledby="cal-modal-title" style="
      display:none;position:fixed;inset:0;
      background:rgba(0,0,0,0.5);z-index:500;
      align-items:center;justify-content:center;padding:var(--space-lg);
    ">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="cal-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);"></h2>
          <button id="cal-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);">×</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="cal-entry-type">Type</label>
          <select class="form-select" id="cal-entry-type" name="cal-entry-type">
            <option value="meeting">Meeting</option>
            <option value="task">Task</option>
            <option value="work-block">Work block</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="cal-entry-title">Title</label>
          <input class="form-input" type="text" id="cal-entry-title" name="cal-entry-title" required aria-required="true">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="cal-entry-date">Date</label>
            <input class="form-input" type="date" id="cal-entry-date" name="cal-entry-date" required aria-required="true">
          </div>
          <div class="form-group">
            <label class="form-label form-label--optional" for="cal-entry-time">Start time</label>
            <input class="form-input" type="time" id="cal-entry-time" name="cal-entry-time">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cal-entry-end-time">End time</label>
          <input class="form-input" type="time" id="cal-entry-end-time" name="cal-entry-end-time">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cal-entry-person">Person(s)</label>
          <input class="form-input" type="text" id="cal-entry-person" name="cal-entry-person" placeholder="e.g. Neil Davies, Ben Manning">
          <p class="form-hint">Separate multiple names with commas</p>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cal-entry-location">Location</label>
          <input class="form-input" type="text" id="cal-entry-location" name="cal-entry-location" placeholder="e.g. Office, Teams, Room 204">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cal-entry-area">Linked area</label>
          <select class="form-select" id="cal-entry-area" name="cal-entry-area">
            <option value="">— None —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="cal-entry-notes">Notes</label>
          <textarea class="form-textarea" id="cal-entry-notes" name="cal-entry-notes" rows="2"></textarea>
        </div>

        <!-- Open in Meetings button — shown for meeting type -->
        <div id="cal-open-meetings-row" style="display:none;margin-bottom:var(--space-md);">
          <button id="cal-open-meetings-btn" type="button" class="btn btn--ghost btn--sm">Open in Meetings tab →</button>
        </div>

        <input type="hidden" id="cal-entry-id">

        <div class="btn-row">
          <button id="cal-entry-save" class="btn btn--primary" type="button">Save entry</button>
          <button id="cal-entry-delete" class="btn btn--danger" type="button" style="display:none;">Delete</button>
          <button id="cal-entry-cancel" class="btn btn--secondary" type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _populateCalAreaDropdown('cal-entry-area');
  _wireCalendarEvents();
  _renderCalendar();
}

// ── Render dispatcher ─────────────────────────────────────────
function _renderCalendar() {
  _updatePeriodLabel();
  if (_calView === 'week')  _renderWeekView();
  if (_calView === 'month') _renderMonthView();
  if (_calView === 'year')  _renderYearView();
}

function _updatePeriodLabel() {
  const el = document.getElementById('cal-period-label');
  if (!el) return;
  if (_calView === 'week') {
    const { start, end } = _weekBounds(_calAnchor);
    el.textContent = `${_formatShort(start)} – ${_formatShort(end)}`;
  } else if (_calView === 'month') {
    el.textContent = _calAnchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } else {
    el.textContent = _calAnchor.getFullYear().toString();
  }
}

// ── Week view ─────────────────────────────────────────────────
function _renderWeekView() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const { start } = _weekBounds(_calAnchor);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const todayStr = todayISO();
  const colW = `${100/7}%`;

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:2px solid var(--color-border);">`;
  days.forEach(d => {
    const isToday = d.toISOString().split('T')[0] === todayStr;
    html += `<div style="padding:var(--space-sm) var(--space-md);text-align:center;font-size:var(--text-xs);font-weight:var(--font-bold);color:${isToday ? 'var(--color-teal)' : 'var(--color-muted)'};border-right:1px solid var(--color-border);background:${isToday ? 'var(--color-teal-lt)' : 'var(--color-light)'};">
      <div>${d.toLocaleDateString('en-GB',{weekday:'short'})}</div>
      <div style="font-size:var(--text-md);color:${isToday ? 'var(--color-teal)' : 'var(--color-slate)'};">${d.getDate()}</div>
    </div>`;
  });
  html += `</div>`;

  // Day columns with entries
  html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);min-height:400px;">`;
  days.forEach(d => {
    const dateStr  = d.toISOString().split('T')[0];
    const isToday  = dateStr === todayStr;
    const dayEntries = _getEntriesForDate(dateStr);

    html += `<div style="border-right:1px solid var(--color-border);padding:var(--space-sm);min-height:200px;background:${isToday ? '#FAFFFE' : 'var(--color-white)'};vertical-align:top;" data-date="${dateStr}">`;
    dayEntries.forEach(e => {
      html += _buildEntryChip(e);
    });
    html += `</div>`;
  });
  html += `</div>`;

  grid.innerHTML = html;
  _wireChipClicks(grid);
}

// ── Month view ────────────────────────────────────────────────
function _renderMonthView() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const year  = _calAnchor.getFullYear();
  const month = _calAnchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const todayStr = todayISO();

  // Start from Monday before first day
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDow);

  const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);">`;
  dayHeaders.forEach(h => {
    html += `<div style="padding:var(--space-sm);text-align:center;font-size:var(--text-xs);font-weight:var(--font-bold);color:var(--color-muted);background:var(--color-light);border-bottom:1px solid var(--color-border);border-right:1px solid var(--color-border);">${h}</div>`;
  });

  const cursor = new Date(startDate);
  for (let week = 0; week < 6; week++) {
    for (let dow = 0; dow < 7; dow++) {
      const dateStr     = cursor.toISOString().split('T')[0];
      const isThisMonth = cursor.getMonth() === month;
      const isToday     = dateStr === todayStr;
      const entries     = _getEntriesForDate(dateStr);

      html += `<div style="border-right:1px solid var(--color-border);border-bottom:1px solid var(--color-border);padding:var(--space-xs) var(--space-sm);min-height:90px;background:${isToday ? 'var(--color-teal-lt)' : 'var(--color-white)'};" data-date="${dateStr}">
        <span style="font-size:var(--text-xs);font-weight:var(--font-bold);color:${isToday ? 'var(--color-teal)' : isThisMonth ? 'var(--color-slate)' : 'var(--color-border)'};">${cursor.getDate()}</span>`;

      const shown = entries.slice(0, 3);
      const extra = entries.length - shown.length;
      shown.forEach(e => { html += _buildEntryChip(e, true); });
      if (extra > 0) {
        html += `<button type="button" style="font-size:10px;color:var(--color-teal);background:none;border:none;cursor:pointer;padding:0;margin-top:2px;">+${extra} more</button>`;
      }

      html += `</div>`;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (cursor > lastDay && week >= 3) break;
  }

  html += `</div>`;
  grid.innerHTML = html;
  _wireChipClicks(grid);
}

// ── Year view ─────────────────────────────────────────────────
function _renderYearView() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const year     = _calAnchor.getFullYear();
  const todayStr = todayISO();
  const entries  = _getAllCalEntries();

  let html = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-md);padding:var(--space-lg);">`;

  for (let m = 0; m < 12; m++) {
    const monthName = new Date(year, m, 1).toLocaleDateString('en-GB', { month: 'long' });
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    // Count entries for this month
    const monthStr  = `${year}-${String(m+1).padStart(2,'0')}`;
    const monthCount = entries.filter(e => e.date && e.date.startsWith(monthStr)).length;
    const density    = monthCount === 0 ? 0 : monthCount <= 3 ? 1 : monthCount <= 8 ? 2 : 3;
    const densityBg  = ['var(--color-light)','var(--color-teal-lt)','#B2DFD8','var(--color-teal)'][density];

    html += `<button type="button" data-month="${m}" style="
      background:${densityBg};border:1px solid var(--color-border);
      border-radius:var(--radius-md);padding:var(--space-md);
      text-align:left;cursor:pointer;transition:box-shadow 150ms ease;
      min-height:80px;
    " aria-label="${monthName} ${year} — ${monthCount} entries">
      <div style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:4px;">${monthName}</div>
      ${monthCount > 0 ? `<div style="font-size:var(--text-xs);color:var(--color-teal);">${monthCount} entr${monthCount === 1 ? 'y' : 'ies'}</div>` : '<div style="font-size:var(--text-xs);color:var(--color-muted);">No entries</div>'}
    </button>`;
  }

  html += `</div>`;
  grid.innerHTML = html;

  // Month buttons navigate to month view
  grid.querySelectorAll('[data-month]').forEach(btn => {
    btn.addEventListener('click', () => {
      _calAnchor = new Date(_calAnchor.getFullYear(), parseInt(btn.dataset.month), 1);
      _setView('month');
    });
  });
}

// ── Entry chip ────────────────────────────────────────────────
function _buildEntryChip(entry, compact=false) {
  const colours = {
    [CALENDAR_TYPE.MEETING]:    { bg:'var(--color-blue-lt)',   text:'var(--color-blue)' },
    [CALENDAR_TYPE.TASK]:       { bg:'var(--color-amber-lt)',  text:'var(--color-amber)' },
    [CALENDAR_TYPE.DEADLINE]:   { bg:'var(--color-red-lt)',    text:'var(--color-red)' },
    [CALENDAR_TYPE.WORK_BLOCK]: { bg:'var(--color-teal-lt)',   text:'var(--color-teal)' },
  };
  const c = colours[entry.entryType] || { bg:'var(--color-light)', text:'var(--color-muted)' };
  const timeStr = entry.startTime ? `${entry.startTime} ` : '';
  const label   = `${timeStr}${entry.title}`;

  return `<button type="button" data-entry-id="${entry.entryId}" style="
    display:block;width:100%;text-align:left;
    background:${c.bg};color:${c.text};
    border:none;border-radius:3px;
    padding:2px ${compact ? '4px' : '6px'};
    font-size:${compact ? '10px' : 'var(--text-xs)'};
    font-weight:var(--font-bold);
    cursor:pointer;margin-bottom:2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    min-height:${compact ? '20px' : 'var(--touch-target)'};
  " aria-label="Entry: ${_escHtml(label)}">${_escHtml(label)}</button>`;
}

function _wireChipClicks(grid) {
  grid.addEventListener('click', e => {
    const chip = e.target.closest('[data-entry-id]');
    if (chip) _openEntryModal(chip.dataset.entryId);
  });
}

// ── Entry modal ───────────────────────────────────────────────
function _openEntryModal(entryId, prefillDate) {
  const modal = document.getElementById('cal-modal');
  if (!modal) return;

  const titleEl    = document.getElementById('cal-modal-title');
  const deleteBtn  = document.getElementById('cal-entry-delete');
  const meetingsRow= document.getElementById('cal-open-meetings-row');

  let entry = null;
  if (entryId) entry = _getAllCalEntries().find(e => e.entryId === entryId);

  if (entry) {
    titleEl.textContent = 'Edit entry';
    document.getElementById('cal-entry-type').value     = entry.entryType || CALENDAR_TYPE.MEETING;
    document.getElementById('cal-entry-title').value    = entry.title || '';
    document.getElementById('cal-entry-date').value     = entry.date || '';
    document.getElementById('cal-entry-time').value     = entry.startTime || '';
    document.getElementById('cal-entry-end-time').value = entry.endTime || '';
    document.getElementById('cal-entry-person').value   = (entry.personRefs || []).join(', ');
    document.getElementById('cal-entry-location').value = entry.notes ? '' : '';
    document.getElementById('cal-entry-area').value     = entry.areaCode || '';
    document.getElementById('cal-entry-notes').value    = entry.notes || '';
    document.getElementById('cal-entry-id').value       = entry.entryId;
    deleteBtn.style.display = 'inline-flex';
  } else {
    titleEl.textContent = 'New entry';
    document.getElementById('cal-entry-type').value     = CALENDAR_TYPE.MEETING;
    document.getElementById('cal-entry-title').value    = '';
    document.getElementById('cal-entry-date').value     = prefillDate || todayISO();
    document.getElementById('cal-entry-time').value     = '';
    document.getElementById('cal-entry-end-time').value = '';
    document.getElementById('cal-entry-person').value   = '';
    document.getElementById('cal-entry-location').value = '';
    document.getElementById('cal-entry-area').value     = '';
    document.getElementById('cal-entry-notes').value    = '';
    document.getElementById('cal-entry-id').value       = '';
    deleteBtn.style.display = 'none';
  }

  // Show "Open in Meetings" for meeting type
  const typeEl = document.getElementById('cal-entry-type');
  const updateMeetingsBtn = () => {
    if (meetingsRow) meetingsRow.style.display = typeEl.value === 'meeting' ? 'block' : 'none';
  };
  typeEl.addEventListener('change', updateMeetingsBtn);
  updateMeetingsBtn();

  modal.style.display = 'flex';
  document.getElementById('cal-entry-title').focus();
}

function _closeEntryModal() {
  const modal = document.getElementById('cal-modal');
  if (modal) modal.style.display = 'none';
}

function _saveEntry() {
  const title = document.getElementById('cal-entry-title').value.trim();
  if (!title) { document.getElementById('cal-entry-title').focus(); return; }
  const date = document.getElementById('cal-entry-date').value;
  if (!date) { document.getElementById('cal-entry-date').focus(); return; }

  const existingId  = document.getElementById('cal-entry-id').value;
  const personStr   = document.getElementById('cal-entry-person').value.trim();
  const personRefs  = personStr ? personStr.split(',').map(p => p.trim()).filter(Boolean) : [];

  const entry = {
    entryId:    existingId || generateId(),
    entryType:  document.getElementById('cal-entry-type').value || CALENDAR_TYPE.MEETING,
    title,
    date,
    startTime:  document.getElementById('cal-entry-time').value || null,
    endTime:    document.getElementById('cal-entry-end-time').value || null,
    personRefs,
    areaCode:   document.getElementById('cal-entry-area').value || null,
    projectRef: null,
    status:     TASK_STATUS.UPCOMING,
    notes:      document.getElementById('cal-entry-notes').value.trim() || null,
    microTasks: [],
    isSurfaceLayerVisible: true,
  };

  saveCalendarEntry(entry);
  _closeEntryModal();
  _renderCalendar();
}

function _deleteEntry() {
  const id = document.getElementById('cal-entry-id').value;
  if (!id) return;
  if (!confirm('Delete this entry?')) return;
  deleteCalendarEntry(id);
  _closeEntryModal();
  _renderCalendar();
}

// ── View switching ────────────────────────────────────────────
function _setView(view) {
  _calView = view;
  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.style.background  = active ? 'var(--color-teal)' : 'var(--color-white)';
    btn.style.color       = active ? 'var(--color-white)' : 'var(--color-slate)';
    btn.style.fontWeight  = active ? 'bold' : 'normal';
  });
  _renderCalendar();
}

function _navigate(dir) {
  if (_calView === 'week') {
    _calAnchor = new Date(_calAnchor);
    _calAnchor.setDate(_calAnchor.getDate() + dir * 7);
  } else if (_calView === 'month') {
    _calAnchor = new Date(_calAnchor.getFullYear(), _calAnchor.getMonth() + dir, 1);
  } else {
    _calAnchor = new Date(_calAnchor.getFullYear() + dir, 0, 1);
  }
  _renderCalendar();
}

// ── Wire events ───────────────────────────────────────────────
function _wireCalendarEvents() {
  document.getElementById('cal-prev')?.addEventListener('click', () => _navigate(-1));
  document.getElementById('cal-next')?.addEventListener('click', () => _navigate(1));
  document.getElementById('cal-today')?.addEventListener('click', () => { _calAnchor = new Date(); _renderCalendar(); });
  document.getElementById('cal-add-btn')?.addEventListener('click', () => _openEntryModal(null));

  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => _setView(btn.dataset.view));
  });

  document.getElementById('cal-modal-close')?.addEventListener('click', _closeEntryModal);
  document.getElementById('cal-entry-cancel')?.addEventListener('click', _closeEntryModal);
  document.getElementById('cal-entry-save')?.addEventListener('click', _saveEntry);
  document.getElementById('cal-entry-delete')?.addEventListener('click', _deleteEntry);

  document.getElementById('cal-open-meetings-btn')?.addEventListener('click', () => {
    _closeEntryModal();
    navigateTo('meetings');
  });

  const modal = document.getElementById('cal-modal');
  if (modal) {
    modal.addEventListener('click', e => { if (e.target === modal) _closeEntryModal(); });
  }

  document.addEventListener('keydown', function calEsc(e) {
    if (e.key === 'Escape') {
      const m = document.getElementById('cal-modal');
      if (m && m.style.display === 'flex') { _closeEntryModal(); e.stopPropagation(); }
      else document.removeEventListener('keydown', calEsc);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _getAllCalEntries() {
  return (window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [];
}

function _getEntriesForDate(dateStr) {
  return _getAllCalEntries().filter(e => e.date === dateStr)
    .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
}

function _weekBounds(anchor) {
  const d = new Date(anchor);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function _formatShort(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function _populateCalAreaDropdown(selectId) {
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

function _escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
