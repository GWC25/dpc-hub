/* ================================================================
   meetings.js — DPC Hub
   Meetings module. Built directly from the documented VIEW 6 spec
   (Documents/Current — DPC_Hub_Document_10_Build_Supplement.docx),
   not designed from scratch — that spec already existed, was just
   never built. A meeting is a CALENDAR_TYPE.MEETING calendar entry,
   same pattern as Tasks being CALENDAR_TYPE.TASK entries (Session
   48) — not a separate data store.

   Two-panel layout: left = list grouped by MEETING_TYPE, right =
   detail (prep notes / links / during-notes / Area+Loop context /
   actions that can spin off a real Task).

   The spec's "Add to Post-It board" checkbox is deliberately NOT a
   second action here — the live Jobs Board (homepage.js) already
   renders directly from Tasks, so "add to Tasks" already produces a
   post-it. Two checkboxes for what's actually one underlying action
   would be a duplicate, not a feature.
   ================================================================ */

let _mCurrentId = null;

function initMeetings() {
  const el = document.getElementById('main-content');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;gap:var(--space-lg);height:calc(100vh - 160px);min-height:500px;">
      <div style="width:280px;flex-shrink:0;border-right:1px solid var(--color-border);padding-right:var(--space-md);overflow-y:auto;">
        <input type="text" id="m-search" class="form-input" placeholder="Search meetings…" style="margin-bottom:var(--space-sm);">
        <button type="button" id="m-new-btn" class="btn btn--primary btn--sm" style="width:100%;margin-bottom:var(--space-md);">+ New meeting</button>
        <div id="m-list"></div>
      </div>
      <div id="m-detail" style="flex:1;overflow-y:auto;padding-left:var(--space-sm);">
        <p style="color:var(--color-muted);font-size:var(--text-sm);">Select a meeting or create a new one.</p>
      </div>
    </div>
  `;

  _mRenderList();
  _mWireListEvents();

  if (window._pendingMeetingOpen) {
    const targetId = window._pendingMeetingOpen;
    window._pendingMeetingOpen = null;
    _mOpenMeeting(targetId);
  }
}

function openMeeting(entryId) {
  window._pendingMeetingOpen = entryId;
  navigateTo('meetings');
}

function _mGetAll() {
  return ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || [])
    .filter(e => e.entryType === CALENDAR_TYPE.MEETING);
}
function _mGet(entryId) { return _mGetAll().find(e => e.entryId === entryId) || null; }
function _mEsc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mFmtDate(iso) { if (!iso) return '—'; try { return new Date(iso.split('T')[0]+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } catch { return iso; } }

function _mRenderList() {
  const list = document.getElementById('m-list');
  if (!list) return;
  const search = (document.getElementById('m-search')?.value || '').toLowerCase().trim();

  let meetings = _mGetAll().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if (search) {
    meetings = meetings.filter(m =>
      (m.title||'').toLowerCase().includes(search) ||
      (m.personRefs||[]).join(' ').toLowerCase().includes(search));
  }

  if (meetings.length === 0) {
    list.innerHTML = '<p style="font-size:var(--text-sm);color:var(--color-muted);">No meetings yet.</p>';
    return;
  }

  const byType = {};
  meetings.forEach(m => {
    const t = m.meetingType || MEETING_TYPE.OTHER_STAFF;
    (byType[t] = byType[t] || []).push(m);
  });

  list.innerHTML = Object.entries(byType).map(([type, items]) => `
    <p style="font-size:10px;font-weight:bold;color:var(--color-muted);text-transform:uppercase;margin:var(--space-md) 0 4px;">${_mEsc(MEETING_TYPE_LABELS[type] || type)}</p>
    ${items.map(m => `
      <button type="button" class="m-list-item" data-entry-id="${m.entryId}" style="
        display:block;width:100%;text-align:left;background:${m.entryId===_mCurrentId?'var(--color-light)':'none'};
        border:none;border-radius:var(--radius-sm);padding:6px 8px;cursor:pointer;margin-bottom:2px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.notesComplete?'var(--color-green)':'var(--color-amber)'};margin-right:6px;"></span>
        <span style="font-size:var(--text-sm);color:var(--color-navy);font-weight:${m.entryId===_mCurrentId?'bold':'normal'};">${_mEsc(m.title||'Untitled')}</span><br>
        <span style="font-size:10px;color:var(--color-muted);margin-left:14px;">${_mEsc((m.personRefs||[]).join(', ') || '—')} · ${_mFmtDate(m.date)}</span>
      </button>`).join('')}
  `).join('');
}

function _mWireListEvents() {
  document.getElementById('m-search')?.addEventListener('input', _mRenderList);
  document.getElementById('m-new-btn')?.addEventListener('click', _mNewMeeting);
  document.getElementById('m-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.m-list-item');
    if (item) _mOpenMeeting(item.dataset.entryId);
  });
}

function _mNewMeeting() {
  const entry = {
    entryId: generateId(),
    entryType: CALENDAR_TYPE.MEETING,
    meetingType: MEETING_TYPE.OTHER_STAFF,
    title: 'New meeting',
    date: todayISO(),
    startTime: null, endTime: null, location: null,
    personRefs: [], areaCode: null,
    linkedDocumentUrl: null, linkedDocumentLabel: null,
    prepNotes: null, links: [], myNotes: null,
    actions: [], notesComplete: false,
  };
  saveCalendarEntry(entry);
  _mRenderList();
  _mOpenMeeting(entry.entryId);
}

function _mOpenMeeting(entryId) {
  _mCurrentId = entryId;
  _mRenderList();
  const detail = document.getElementById('m-detail');
  const m = _mGet(entryId);
  if (!detail || !m) return;

  const openAFIs = m.areaCode ? ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => a.areaCode === m.areaCode && a.status !== 'closed') : [];
  const area = m.areaCode ? ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).find(a => a.areaCode === m.areaCode) : null;

  detail.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:var(--space-md);">
      <select id="m-type" class="form-select">${Object.entries(MEETING_TYPE_LABELS).map(([v,l]) => `<option value="${v}" ${m.meetingType===v?'selected':''}>${_mEsc(l)}</option>`).join('')}</select>
      <input type="date" id="m-date" class="form-input" value="${m.date||''}">
      <input type="time" id="m-time" class="form-input" value="${m.startTime||''}">
    </div>
    <input type="text" id="m-title" class="form-input" placeholder="Meeting title" value="${_mEsc(m.title||'')}" style="font-size:var(--text-lg);font-weight:bold;margin-bottom:8px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:var(--space-md);">
      <input type="text" id="m-person" class="form-input" list="m-staff-list" placeholder="Person(s), comma-separated — start typing to filter" value="${_mEsc((m.personRefs||[]).join(', '))}">
      <input type="text" id="m-location" class="form-input" placeholder="Location" value="${_mEsc(m.location||'')}">
    </div>
    <datalist id="m-staff-list">${((window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []).map(s => `<option value="${_mEsc(s.name)}">`).join('')}</datalist>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-bottom:var(--space-md);">
      <input type="text" id="m-doc-label" class="form-input" placeholder="Linked doc label" value="${_mEsc(m.linkedDocumentLabel||'')}">
      <input type="url" id="m-doc-url" class="form-input" placeholder="https://…" value="${_mEsc(m.linkedDocumentUrl||'')}">
    </div>

    <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-navy);margin-bottom:4px;">Before the meeting</p>
    <textarea id="m-prep" class="form-textarea" rows="3" style="background:var(--color-amber-lt);width:100%;margin-bottom:8px;">${_mEsc(m.prepNotes||'')}</textarea>

    <details style="margin-bottom:var(--space-md);">
      <summary style="cursor:pointer;font-size:var(--text-xs);color:var(--color-teal);">Import agenda from a Claude conversation (no API cost)</summary>
      <p style="font-size:10px;color:var(--color-muted);margin:4px 0;">Paste an agenda document into a Claude conversation and ask for agenda items, questions to raise, and anything you specifically own — paste the JSON result below and it's added into "Before the meeting" for you to edit before saving.</p>
      <pre style="background:var(--color-light);border-radius:var(--radius-sm);padding:8px;font-size:10px;overflow-x:auto;margin-bottom:4px;">{"agendaItems":["..."],"questionsToAsk":["..."],"myOwnership":["..."]}</pre>
      <textarea id="m-agenda-json" class="form-textarea" rows="3" placeholder="Paste the JSON result here…" style="width:100%;font-family:monospace;font-size:11px;margin-bottom:4px;"></textarea>
      <button type="button" id="m-agenda-import-btn" class="btn btn--ghost btn--sm">Add to prep notes</button>
      <p id="m-agenda-import-status" style="font-size:10px;color:var(--color-muted);margin-top:4px;"></p>
    </details>

    <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-navy);margin-bottom:4px;">Links</p>
    <div id="m-links-list">${(m.links||[]).map((l,i) => `
      <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:4px;margin-bottom:4px;">
        <input type="text" class="form-input m-link-label" data-idx="${i}" value="${_mEsc(l.label||'')}" placeholder="Label">
        <input type="url" class="form-input m-link-url" data-idx="${i}" value="${_mEsc(l.url||'')}" placeholder="https://…">
        <button type="button" class="btn btn--ghost btn--sm m-link-remove" data-idx="${i}">✕</button>
      </div>`).join('')}</div>
    <button type="button" id="m-add-link" class="btn btn--ghost btn--sm" style="margin-bottom:var(--space-md);">+ Add link</button>

    <p style="font-size:var(--text-xs);font-weight:bold;color:var(--color-navy);margin-bottom:4px;">During / after the meeting</p>
    <textarea id="m-notes" class="form-textarea" rows="4" style="width:100%;margin-bottom:var(--space-md);">${_mEsc(m.myNotes||'')}</textarea>

    ${m.areaCode ? `
      <button type="button" id="m-context-toggle" style="background:none;border:none;color:var(--color-teal);cursor:pointer;font-size:var(--text-xs);margin-bottom:8px;">▶ Show Area &amp; Loop context (${_mEsc(m.areaCode)})</button>
      <div id="m-context-body" style="display:none;background:var(--color-light);border-radius:var(--radius-sm);padding:var(--space-sm);margin-bottom:var(--space-md);">
        <p style="font-size:var(--text-xs);"><strong>${_mEsc(area?.areaName || m.areaCode)}</strong></p>
        <p style="font-size:var(--text-xs);color:var(--color-muted);">${openAFIs.length} open loop(s)${openAFIs.length ? ':' : '.'}</p>
        ${openAFIs.map(a => `<button type="button" class="m-context-loop-link" data-afi-id="${a.afiId}" style="display:block;background:none;border:none;color:var(--color-teal);text-decoration:underline;cursor:pointer;font-size:var(--text-xs);text-align:left;">${_mEsc((a.description||'').slice(0,60))}</button>`).join('')}
      </div>
    ` : ''}

    <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin:var(--space-md) 0 4px;">Actions (${(m.actions||[]).length})</p>
    <div id="m-actions-list">${(m.actions||[]).map((a,i) => `
      <div style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px;margin-bottom:6px;">
        <input type="text" class="form-input m-action-title" data-idx="${i}" value="${_mEsc(a.title||'')}" placeholder="Action" style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <input type="date" class="form-input m-action-deadline" data-idx="${i}" value="${a.deadline||''}" style="max-width:160px;">
          <label style="font-size:var(--text-xs);"><input type="checkbox" class="m-action-totask" data-idx="${i}" ${a.linkedTaskId?'checked disabled':''}> ${a.linkedTaskId ? 'On Tasks board' : 'Add to Tasks board'}</label>
        </div>
      </div>`).join('')}</div>
    <button type="button" id="m-add-action" class="btn btn--ghost btn--sm" style="margin-bottom:var(--space-lg);">+ Add action</button>

    <div style="position:sticky;bottom:0;background:var(--color-white);padding:var(--space-sm) 0;border-top:1px solid var(--color-border);display:flex;align-items:center;gap:var(--space-md);">
      <button type="button" id="m-save-btn" class="btn btn--primary btn--sm">Save</button>
      <button type="button" id="m-delete-btn" class="btn btn--ghost btn--sm" style="color:var(--color-red);border-color:var(--color-red);">Delete</button>
      <label style="font-size:var(--text-xs);"><input type="checkbox" id="m-notes-complete" ${m.notesComplete?'checked':''}> Notes complete</label>
      <span id="m-save-status" style="font-size:var(--text-xs);color:var(--color-muted);"></span>
    </div>
  `;

  _mWireDetailEvents();
}

function _mWireDetailEvents() {
  const detail = document.getElementById('m-detail');
  if (!detail || detail._mWired) return;
  // Bound exactly ONCE, ever — #m-detail is a single persistent container
  // reused across every meeting opened in a session (unlike e.g. Areas'
  // per-area tab panel, which is recreated fresh on navigation). Handlers
  // below resolve _mCurrentId at fire-time rather than closing over a
  // specific entryId, so the one bound listener set stays correct no
  // matter how many different meetings get opened afterwards.
  detail._mWired = true;

  detail.addEventListener('click', (e) => {
    const contextToggle = e.target.closest('#m-context-toggle');
    if (contextToggle) {
      const body = document.getElementById('m-context-body');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      contextToggle.textContent = contextToggle.textContent.replace(isOpen ? '▼' : '▶', isOpen ? '▶' : '▼');
      return;
    }

    const loopLink = e.target.closest('.m-context-loop-link');
    if (loopLink && typeof openLoop === 'function') { openLoop(loopLink.dataset.afiId); return; }

    if (e.target.id === 'm-add-link') {
      const m = _mGet(_mCurrentId);
      if (!m) return;
      m.links = m.links || [];
      m.links.push({ label: '', url: '' });
      saveCalendarEntry(m);
      _mOpenMeeting(_mCurrentId);
      return;
    }
    const removeLink = e.target.closest('.m-link-remove');
    if (removeLink) {
      const m = _mGet(_mCurrentId);
      if (!m) return;
      m.links.splice(Number(removeLink.dataset.idx), 1);
      saveCalendarEntry(m);
      _mOpenMeeting(_mCurrentId);
      return;
    }
    if (e.target.id === 'm-add-action') {
      const m = _mGet(_mCurrentId);
      if (!m) return;
      m.actions = m.actions || [];
      m.actions.push({ actionId: generateId(), title: '', deadline: null, linkedTaskId: null });
      saveCalendarEntry(m);
      _mOpenMeeting(_mCurrentId);
      return;
    }
    if (e.target.id === 'm-save-btn') {
      _mSaveMeeting(_mCurrentId);
      return;
    }
    if (e.target.id === 'm-delete-btn') {
      if (!confirm('Delete this meeting permanently? This cannot be undone.')) return;
      deleteCalendarEntry(_mCurrentId);
      if (typeof UI !== 'undefined') UI.showToast('success', 'Meeting deleted.');
      _mCurrentId = null;
      document.getElementById('m-detail').innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">Select a meeting or create a new one.</p>';
      _mRenderList();
      return;
    }
    if (e.target.id === 'm-agenda-import-btn') {
      const status = document.getElementById('m-agenda-import-status');
      const raw = document.getElementById('m-agenda-json').value.trim();
      if (!raw) { status.textContent = 'Paste the JSON result first.'; status.style.color = 'var(--color-red)'; return; }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        status.textContent = `Not valid JSON: ${err.message}`;
        status.style.color = 'var(--color-red)';
        return;
      }
      const sections = [];
      if (Array.isArray(parsed.agendaItems) && parsed.agendaItems.length) sections.push('Agenda:\n' + parsed.agendaItems.map(i => `- ${i}`).join('\n'));
      if (Array.isArray(parsed.questionsToAsk) && parsed.questionsToAsk.length) sections.push('Questions to raise:\n' + parsed.questionsToAsk.map(i => `- ${i}`).join('\n'));
      if (Array.isArray(parsed.myOwnership) && parsed.myOwnership.length) sections.push('Mine to update on:\n' + parsed.myOwnership.map(i => `- ${i}`).join('\n'));
      if (sections.length === 0) { status.textContent = 'JSON parsed, but none of agendaItems/questionsToAsk/myOwnership had any content.'; status.style.color = 'var(--color-red)'; return; }
      const prepField = document.getElementById('m-prep');
      const existing = prepField.value.trim();
      prepField.value = (existing ? existing + '\n\n' : '') + sections.join('\n\n');
      status.textContent = '✓ Added to prep notes below — review, edit if needed, then Save.';
      status.style.color = 'var(--color-green)';
      return;
    }
  });

  detail.addEventListener('change', (e) => {
    if (e.target.matches('.m-action-totask')) {
      if (!e.target.checked) return;
      const m = _mGet(_mCurrentId);
      if (!m) return;
      const idx = Number(e.target.dataset.idx);
      // Read the LIVE input values for this row, not the last-saved data
      // model — a user typing a title then immediately ticking the box
      // (without clicking Save first) is the normal flow, not an edge case.
      const titleEl = document.querySelector(`.m-action-title[data-idx="${idx}"]`);
      const deadlineEl = document.querySelector(`.m-action-deadline[data-idx="${idx}"]`);
      const liveTitle = titleEl ? titleEl.value.trim() : '';
      const action = m.actions[idx];
      if (!action || !liveTitle) { if (typeof UI !== 'undefined') UI.showToast('error', 'Give the action a title first.'); e.target.checked = false; return; }
      action.title = liveTitle;
      action.deadline = deadlineEl ? (deadlineEl.value || null) : action.deadline;
      if (typeof createTaskFromSource !== 'function') return;
      const task = createTaskFromSource(
        { title: action.title, date: action.deadline || todayISO(), areaCode: m.areaCode, personRefs: m.personRefs, notes: `From meeting: ${m.title}` },
        'meeting', { entryId: m.entryId, actionId: action.actionId }
      );
      action.linkedTaskId = task.entryId;
      saveCalendarEntry(m);
      if (typeof UI !== 'undefined') UI.showToast('success', `Task created: ${task.title}`);
      _mOpenMeeting(_mCurrentId);
    }
  });
}

function _mSaveMeeting(entryId) {
  const m = _mGet(entryId);
  if (!m) return;
  const status = document.getElementById('m-save-status');

  m.meetingType = document.getElementById('m-type').value;
  m.date = document.getElementById('m-date').value;
  m.startTime = document.getElementById('m-time').value || null;
  m.title = document.getElementById('m-title').value.trim() || 'Untitled meeting';
  m.personRefs = document.getElementById('m-person').value.split(',').map(s => s.trim()).filter(Boolean);
  m.location = document.getElementById('m-location').value.trim() || null;
  m.linkedDocumentLabel = document.getElementById('m-doc-label').value.trim() || null;
  m.linkedDocumentUrl = document.getElementById('m-doc-url').value.trim() || null;
  m.prepNotes = document.getElementById('m-prep').value.trim() || null;
  m.myNotes = document.getElementById('m-notes').value.trim() || null;
  m.notesComplete = document.getElementById('m-notes-complete').checked;

  document.querySelectorAll('.m-link-label').forEach((el, i) => { m.links[i] = m.links[i] || {}; m.links[i].label = el.value.trim(); });
  document.querySelectorAll('.m-link-url').forEach((el, i) => { m.links[i] = m.links[i] || {}; m.links[i].url = el.value.trim(); });
  document.querySelectorAll('.m-action-title').forEach((el, i) => { m.actions[i] = m.actions[i] || {}; m.actions[i].title = el.value.trim(); });
  document.querySelectorAll('.m-action-deadline').forEach((el, i) => { m.actions[i] = m.actions[i] || {}; m.actions[i].deadline = el.value || null; });

  saveCalendarEntry(m);
  if (status) { status.textContent = '✓ Saved'; setTimeout(() => { if (status) status.textContent = ''; }, 2000); }
  _mRenderList();
}
