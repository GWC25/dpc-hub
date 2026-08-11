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
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <select id="n-detail-area" class="form-select"><option value="">No area</option></select>
            <input type="text" id="n-detail-person" class="form-input" placeholder="Person">
          </div>
          <input type="text" id="n-detail-project" class="form-input" placeholder="Project reference" style="margin-bottom:8px;">
          <select id="n-detail-meeting" class="form-select" style="margin-bottom:8px;"><option value="">Attach to a meeting…</option></select>
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
  const opts = areas.map(a => `<option value="${a.areaCode}">${_nEsc(a.areaName)} (${a.areaCode})</option>`).join('');
  const filterSel = document.getElementById('n-filter-area');
  const detailSel = document.getElementById('n-detail-area');
  if (filterSel) filterSel.innerHTML += opts;
  if (detailSel) detailSel.innerHTML += opts;

  const meetings = ((window.DPC_DATA.calendar && window.DPC_DATA.calendar.entries) || []).filter(e => e.entryType === CALENDAR_TYPE.MEETING);
  const meetingSel = document.getElementById('n-detail-meeting');
  if (meetingSel) meetingSel.innerHTML += meetings.map(m => `<option value="${m.entryId}">${_nEsc(m.title)} (${_nFmtDate(m.date)})</option>`).join('');
}

// "Organised" = has at least an area, person, or project link. A note
// with none of those is the thing the amber banner is nudging toward.
function _nIsOrganised(note) { return !!(note.areaCode || note.personRef || note.projectRef); }

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
    saveNote({ noteId: generateId(), text, createdAt: nowISO(), areaCode: null, personRef: null, projectRef: null });
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

  document.getElementById('n-detail-save')?.addEventListener('click', () => {
    const noteId = modal.dataset.noteId;
    const n = _nGet(noteId);
    if (!n) return;
    n.text = document.getElementById('n-detail-text').value.trim();
    n.areaCode = document.getElementById('n-detail-area').value || null;
    n.personRef = document.getElementById('n-detail-person').value.trim() || null;
    n.projectRef = document.getElementById('n-detail-project').value.trim() || null;
    n.linkedMeetingId = document.getElementById('n-detail-meeting').value || null;
    saveNote(n);
    modal.style.display = 'none';
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
  modal.style.display = 'flex';
  document.getElementById('n-detail-text').focus();
}
