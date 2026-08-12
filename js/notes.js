/* ================================================================
   notes.js — DPC Hub
   Notes module. Built from the documented VIEW 18 spec (Documents/
   Current — DPC_Hub_Document_10_Build_Supplement.docx). The data
   layer (saveNote(), data-notes.json) already existed — only the UI
   was a placeholder.

   Quick capture is the whole point: "+ New note" is one textarea and
   Save, nothing else, matching the spec's "one tap, start writing."
   Everything else (tagging to an area/person/project, converting to
   a Task, attaching to a Meeting) happens later, in the detail modal
   — capture first, organise later, never the other way round.

   As with Meetings' actions, the spec's "Add to Post-It board" is
   deliberately not a separate button here — the live Jobs Board
   already renders directly from Tasks, so "Make this a task" already
   produces a post-it.
   ================================================================ */

let _nCurrentFilter = { area: '', person: '', tag: '' };

function initNotes() {
  const el = document.getElementById('main-content');
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);flex-wrap:wrap;gap:8px;">
      <h2 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Notes</h2>
      <button type="button" id="n-quick-add-btn" class="btn btn--primary btn--sm">+ New note</button>
    </div>

    <div id="n-quick-add" style="display:none;margin-bottom:var(--space-md);border:1px solid var(--color-teal);border-radius:var(--radius-md);padding:var(--space-md);">
      <textarea id="n-quick-text" class="form-textarea" rows="3" placeholder="Start writing…" style="width:100%;margin-bottom:8px;"></textarea>
      <button type="button" id="n-quick-save" class="btn btn--primary btn--sm">Save</button>
      <button type="button" id="n-quick-cancel" class="btn btn--ghost btn--sm">Cancel</button>
    </div>

    <div id="n-organise-banner"></div>

    <div style="display:flex;gap:8px;margin-bottom:var(--space-md);flex-wrap:wrap;">
      <input type="text" id="n-search" class="form-input" placeholder="Search notes…" style="max-width:240px;">
      <select id="n-filter-area" class="form-select" style="max-width:180px;"><option value="">All areas</option></select>
      <input type="text" id="n-filter-person" class="form-input" placeholder="Filter by person" style="max-width:180px;">
    </div>

    <div id="n-list"></div>

    <div id="n-modal" class="modal-overlay" role="presentation" style="display:none;">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="n-modal-title" style="max-width:560px;">
        <div class="card-header"><span class="card-title" id="n-modal-title">Note</span></div>
        <div class="card-body">
          <textarea id="n-detail-text" class="form-textarea" rows="5" style="width:100%;margin-bottom:8px;"></textarea>

          <div style="display:grid;grid-template-columns:2fr auto;gap:4px;align-items:center;margin-bottom:8px;">
            <select id="n-detail-area" class="form-select"><option value="">No area</option></select>
            <button type="button" id="n-open-area-btn" class="btn btn--ghost btn--sm" style="display:none;">Open →</button>
          </div>

          <div style="display:grid;grid-template-columns:2fr auto;gap:4px;align-items:center;margin-bottom:8px;">
            <input type="text" id="n-detail-person" class="form-input" list="n-staff-list" placeholder="Person (type a name — links automatically if it matches Staff)">
            <button type="button" id="n-open-person-btn" class="btn btn--ghost btn--sm" style="display:none;">Open →</button>
          </div>
          <datalist id="n-staff-list"></datalist>

          <div style="display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center;margin-bottom:8px;">
            <select id="n-detail-dept" class="form-select"><option value="">No department</option><option value="__other__">Other…</option></select>
          </div>
          <input type="text" id="n-detail-dept-other" class="form-input" placeholder="Name the department" style="display:none;margin-bottom:8px;">

          <input type="text" id="n-detail-project" class="form-input" placeholder="Project reference" style="margin-bottom:8px;">

          <div style="display:grid;grid-template-columns:2fr auto;gap:4px;align-items:center;margin-bottom:8px;">
            <select id="n-detail-meeting" class="form-select"><option value="">No meeting</option></select>
            <button type="button" id="n-open-meeting-btn" class="btn btn--ghost btn--sm" style="display:none;">Open →</button>
          </div>

          <div style="display:grid;grid-template-columns:2fr auto;gap:4px;align-items:center;margin-bottom:var(--space-md);">
            <select id="n-detail-loop" class="form-select"><option value="">No loop</option></select>
            <button type="button" id="n-open-loop-btn" class="btn btn--ghost btn--sm" style="display:none;">Open →</button>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:var(--space-md);">
            <button type="button" id="n-make-task-btn" class="btn btn--ghost btn--sm">Make this a task</button>
          </div>
          <div class="btn-row" style="gap:8px;">
            <button type="button" id="n-detail-save" class="btn btn--primary btn--sm">Save</button>
            <button type="button" id="n-detail-cancel" class="btn btn--secondary btn--sm">Cancel</button>
            <button type="button" id="n-detail-delete" class="btn btn--ghost btn--sm" style="color:var(--color-red);border-color:var(--color-red);margin-left:auto;">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  _nPopulateAreaDropdowns();
  _nRenderList();
  _nWireEvents();
}

function _nGetAll() { return (window.DPC_DATA.notes && window.DPC_DATA.notes.notes) || []; }
function _nGet(id) { return _nGetAll().find(n => n.noteId === id) || null; }
function _nEsc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _nFmtDate(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) + ' ' + new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return iso; } }

function _nPopulateAreaDropdowns() {
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  const areaOpts = areas.map(a => `<option value="${a.areaCode}">${_nEsc(a.areaName)} (${a.areaCode})</option>`).join('');
  const filterSel = document.getElementById('n-filter-area');
  const detailSel = document.getElementById('n-detail-area');
  if (filterSel) filterSel.innerHTML += areaOpts;
  if (detailSel) detailSel.innerHTML += areaOpts;

  const meetings = ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []).filter(e => e.entryType === CALENDAR_TYPE.MEETING);
  const meetingSel = document.getElementById('n-detail-meeting');
  if (meetingSel) meetingSel.innerHTML += meetings.map(m => `<option value="${m.entryId}">${_nEsc(m.title)} (${_nFmtDate(m.date)})</option>`).join('');

  const depts = (window.DPC_DATA.departments && window.DPC_DATA.departments.departments) || [];
  const deptSel = document.getElementById('n-detail-dept');
  if (deptSel) {
    const otherOpt = deptSel.querySelector('option[value="__other__"]');
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      deptSel.insertBefore(opt, otherOpt);
    });
  }

  const staffList = document.getElementById('n-staff-list');
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  if (staffList) staffList.innerHTML = allStaff.map(s => `<option value="${_nEsc(s.name)}">`).join('');

  _nRefreshLoopDropdown();
}

// Loops are scoped to whichever area is currently selected — a
// college-wide flat list of every Loop would be unusably long, and a
// note's loop link only makes sense in the context of its area anyway.
function _nRefreshLoopDropdown() {
  const areaCode = document.getElementById('n-detail-area')?.value || '';
  const loopSel = document.getElementById('n-detail-loop');
  if (!loopSel) return;
  const currentValue = loopSel.value;
  const loops = ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => !areaCode || a.areaCode === areaCode);
  loopSel.innerHTML = '<option value="">No loop</option>' +
    loops.map(l => `<option value="${l.afiId}">${_nEsc((l.description||'').slice(0,60))} (${_nEsc(l.status)})</option>`).join('');
  if (loops.some(l => l.afiId === currentValue)) loopSel.value = currentValue;
}

// "Organised" = has at least an area, person, or project link. A note
// with none of those is the thing the amber banner is nudging toward.
function _nIsOrganised(note) { return !!(note.areaCode || note.personRef || note.projectRef || note.departmentId); }
function _nDeptName(id) { const d = ((window.DPC_DATA.departments && window.DPC_DATA.departments.departments) || []).find(x => x.id === id); return d ? d.name : id; }

function _nRenderList() {
  const list = document.getElementById('n-list');
  const banner = document.getElementById('n-organise-banner');
  if (!list) return;

  const search = (document.getElementById('n-search')?.value || '').toLowerCase().trim();
  const areaFilter = document.getElementById('n-filter-area')?.value || '';
  const personFilter = (document.getElementById('n-filter-person')?.value || '').toLowerCase().trim();

  let notes = _nGetAll().slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  const unorganisedCount = notes.filter(n => !_nIsOrganised(n)).length;

  if (banner) {
    banner.innerHTML = unorganisedCount > 0
      ? `<button type="button" id="n-organise-btn" style="display:block;width:100%;text-align:left;background:var(--color-amber-lt);border:none;border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-md);cursor:pointer;font:inherit;color:var(--color-navy);">You have ${unorganisedCount} note${unorganisedCount!==1?'s':''} to organise — tap here to sort ${unorganisedCount!==1?'them':'it'}.</button>`
      : '';
  }

  if (search) notes = notes.filter(n => (n.text||'').toLowerCase().includes(search));
  if (areaFilter) notes = notes.filter(n => n.areaCode === areaFilter);
  if (personFilter) notes = notes.filter(n => (n.personRef||'').toLowerCase().includes(personFilter));

  if (notes.length === 0) {
    list.innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">No notes yet — use "+ New note" to start writing.</p>';
    return;
  }

  list.innerHTML = notes.map(n => `
    <button type="button" class="n-list-item" data-note-id="${n.noteId}" style="
      display:block;width:100%;text-align:left;background:var(--color-white);border:1px solid var(--color-border);
      border-radius:var(--radius-sm);padding:var(--space-sm) var(--space-md);margin-bottom:6px;cursor:pointer;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;background:${_nIsOrganised(n)?'var(--color-green)':'var(--color-muted)'};"></span>
        <div style="flex:1;">
          <p style="font-size:var(--text-sm);color:var(--color-slate);">${_nEsc((n.text||'').slice(0,80))}${(n.text||'').length>80?'…':''}</p>
          <p style="font-size:10px;color:var(--color-muted);margin-top:2px;">
            ${_nFmtDate(n.createdAt)}
            ${n.areaCode ? ` · <span style="background:var(--color-light);padding:1px 6px;border-radius:999px;">${_nEsc(n.areaCode)}</span>` : ''}
            ${n.personRef ? ` · <span style="background:var(--color-light);padding:1px 6px;border-radius:999px;">${_nEsc(n.personRef)}</span>` : ''}
            ${n.departmentId ? ` · <span style="background:var(--color-light);padding:1px 6px;border-radius:999px;">${_nEsc(_nDeptName(n.departmentId))}</span>` : ''}
            ${n.projectRef ? ` · <span style="background:var(--color-light);padding:1px 6px;border-radius:999px;">${_nEsc(n.projectRef)}</span>` : ''}
          </p>
        </div>
      </div>
    </button>`).join('');
}

function _nWireEvents() {
  document.getElementById('n-quick-add-btn')?.addEventListener('click', () => {
    document.getElementById('n-quick-add').style.display = 'block';
    document.getElementById('n-quick-text').focus();
  });
  document.getElementById('n-quick-cancel')?.addEventListener('click', () => {
    document.getElementById('n-quick-add').style.display = 'none';
    document.getElementById('n-quick-text').value = '';
  });
  document.getElementById('n-quick-save')?.addEventListener('click', () => {
    const text = document.getElementById('n-quick-text').value.trim();
    if (!text) return;
    saveNote({ noteId: generateId(), text, createdAt: nowISO(), areaCode: null, personRef: null, personStaffId: null, departmentId: null, projectRef: null, linkedMeetingId: null, linkedAfiId: null });
    document.getElementById('n-quick-text').value = '';
    document.getElementById('n-quick-add').style.display = 'none';
    _nRenderList();
  });

  document.getElementById('n-search')?.addEventListener('input', _nRenderList);
  document.getElementById('n-filter-area')?.addEventListener('change', _nRenderList);
  document.getElementById('n-filter-person')?.addEventListener('input', _nRenderList);

  document.getElementById('n-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.n-list-item');
    if (item) _nOpenDetail(item.dataset.noteId);
  });

  document.getElementById('n-organise-banner')?.addEventListener('click', (e) => {
    if (e.target.id === 'n-organise-btn') {
      const first = _nGetAll().find(n => !_nIsOrganised(n));
      if (first) _nOpenDetail(first.noteId);
    }
  });

  const modal = document.getElementById('n-modal');
  document.getElementById('n-detail-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // Cross-link "Open →" buttons — same openXProfile()/openLoop()/
  // openMeeting() pattern as everywhere else in the Hub. Each only
  // shows once the corresponding field actually has a value, and
  // navigating away closes the modal first so the deep link lands
  // cleanly rather than opening underneath it.
  document.getElementById('n-open-area-btn')?.addEventListener('click', () => {
    const code = document.getElementById('n-detail-area').value;
    if (code && typeof openAreaProfile === 'function') { modal.style.display = 'none'; openAreaProfile(code); }
  });
  document.getElementById('n-open-meeting-btn')?.addEventListener('click', () => {
    const id = document.getElementById('n-detail-meeting').value;
    if (id && typeof openMeeting === 'function') { modal.style.display = 'none'; openMeeting(id); }
  });
  document.getElementById('n-open-loop-btn')?.addEventListener('click', () => {
    const id = document.getElementById('n-detail-loop').value;
    if (id && typeof openLoop === 'function') { modal.style.display = 'none'; openLoop(id); }
  });
  document.getElementById('n-open-person-btn')?.addEventListener('click', () => {
    const staffId = document.getElementById('n-open-person-btn').dataset.staffId;
    if (staffId && typeof openStaffProfile === 'function') { modal.style.display = 'none'; openStaffProfile(staffId); }
  });

  document.getElementById('n-detail-area')?.addEventListener('change', () => {
    _nToggleOpenBtn('n-open-area-btn', document.getElementById('n-detail-area').value);
    _nRefreshLoopDropdown(); // loops are scoped to the selected area
  });
  document.getElementById('n-detail-meeting')?.addEventListener('change', () => {
    _nToggleOpenBtn('n-open-meeting-btn', document.getElementById('n-detail-meeting').value);
  });
  document.getElementById('n-detail-loop')?.addEventListener('change', () => {
    _nToggleOpenBtn('n-open-loop-btn', document.getElementById('n-detail-loop').value);
  });
  document.getElementById('n-detail-person')?.addEventListener('input', _nCheckPersonMatch);

  document.getElementById('n-detail-dept')?.addEventListener('change', () => {
    const isOther = document.getElementById('n-detail-dept').value === '__other__';
    document.getElementById('n-detail-dept-other').style.display = isOther ? 'block' : 'none';
    if (isOther) document.getElementById('n-detail-dept-other').focus();
  });

  document.getElementById('n-detail-save')?.addEventListener('click', () => {
    const noteId = modal.dataset.noteId;
    const n = _nGet(noteId);
    if (!n) return;
    n.text = document.getElementById('n-detail-text').value.trim();
    n.areaCode = document.getElementById('n-detail-area').value || null;
    n.projectRef = document.getElementById('n-detail-project').value.trim() || null;
    n.linkedMeetingId = document.getElementById('n-detail-meeting').value || null;
    n.linkedAfiId = document.getElementById('n-detail-loop').value || null;

    // Person: link to a real Staff record if the typed name matches one
    // exactly (via the datalist), otherwise keep it as free text with no
    // link — a note about "the plumber who fixed the WiFi" shouldn't
    // require a Staff record to exist just to write it down.
    const personText = document.getElementById('n-detail-person').value.trim();
    const matchedStaff = personText ? ((window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || []).find(s => s.name.toLowerCase() === personText.toLowerCase()) : null;
    n.personRef = personText || null;
    n.personStaffId = matchedStaff ? matchedStaff.staffId : null;

    // Department: growable — "Other" + free text saves a new one
    // permanently via saveDepartment(), so it's a real option next time.
    const deptSelectVal = document.getElementById('n-detail-dept').value;
    if (deptSelectVal === '__other__') {
      const otherName = document.getElementById('n-detail-dept-other').value.trim();
      const newDept = otherName ? saveDepartment(otherName) : null;
      n.departmentId = newDept ? newDept.id : null;
    } else {
      n.departmentId = deptSelectVal || null;
    }

    saveNote(n);
    modal.style.display = 'none';
    _nPopulateAreaDropdowns(); // pick up any newly-added department immediately
    _nRenderList();
  });

  document.getElementById('n-detail-delete')?.addEventListener('click', () => {
    const noteId = modal.dataset.noteId;
    if (!confirm('Delete this note permanently? This cannot be undone.')) return;
    deleteNote(noteId);
    modal.style.display = 'none';
    _nRenderList();
  });

  document.getElementById('n-make-task-btn')?.addEventListener('click', () => {
    const noteId = modal.dataset.noteId;
    const n = _nGet(noteId);
    if (!n) return;
    const liveText = document.getElementById('n-detail-text').value.trim();
    if (!liveText) { if (typeof UI !== 'undefined') UI.showToast('error', 'Note is empty.'); return; }
    if (typeof createTaskFromSource !== 'function') return;
    const task = createTaskFromSource(
      { title: liveText.slice(0, 100), date: todayISO(), areaCode: document.getElementById('n-detail-area').value || null, personRefs: [document.getElementById('n-detail-person').value.trim()].filter(Boolean), notes: `From note` },
      'note', { noteId }
    );
    n.linkedTaskId = task.entryId;
    saveNote(n);
    if (typeof UI !== 'undefined') UI.showToast('success', `Task created: ${task.title}`);
  });
}

function _nOpenDetail(noteId) {
  const n = _nGet(noteId);
  if (!n) return;
  const modal = document.getElementById('n-modal');
  modal.dataset.noteId = noteId;
  document.getElementById('n-detail-text').value = n.text || '';
  document.getElementById('n-detail-area').value = n.areaCode || '';
  document.getElementById('n-detail-person').value = n.personRef || '';
  document.getElementById('n-detail-project').value = n.projectRef || '';
  document.getElementById('n-detail-meeting').value = n.linkedMeetingId || '';
  document.getElementById('n-detail-dept').value = n.departmentId || '';
  document.getElementById('n-detail-dept-other').style.display = 'none';
  document.getElementById('n-detail-dept-other').value = '';

  _nRefreshLoopDropdown(); // must run before setting the loop value, since options depend on the area just set above
  document.getElementById('n-detail-loop').value = n.linkedAfiId || '';

  _nToggleOpenBtn('n-open-area-btn', n.areaCode);
  _nToggleOpenBtn('n-open-meeting-btn', n.linkedMeetingId);
  _nToggleOpenBtn('n-open-loop-btn', n.linkedAfiId);
  _nCheckPersonMatch();

  modal.style.display = 'flex';
  document.getElementById('n-detail-text').focus();
}

function _nToggleOpenBtn(btnId, value) {
  const btn = document.getElementById(btnId);
  if (btn) btn.style.display = value ? 'inline-flex' : 'none';
}

// Shows the "Open →" link next to Person only when the currently-typed
// text exactly matches a real Staff record — a partial/in-progress name
// shouldn't offer a link to the wrong person, or to nothing at all.
function _nCheckPersonMatch() {
  const text = document.getElementById('n-detail-person')?.value.trim().toLowerCase() || '';
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const match = text ? allStaff.find(s => s.name.toLowerCase() === text) : null;
  const btn = document.getElementById('n-open-person-btn');
  if (!btn) return;
  btn.style.display = match ? 'inline-flex' : 'none';
  if (match) btn.dataset.staffId = match.staffId;
}
