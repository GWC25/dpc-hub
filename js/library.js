// DPC Hub · js/library.js · v1.0 · 31/07/26 · Session 32
// Resource Library module. Three entry types (LIBRARY_TYPE in schema.js):
//   - learning-studio  — never stored here. Computed at render time from
//                         data/resource-tag-map.json (the same file
//                         getResourcesForTags() in heuristic.js reads).
//                         Read-only in this UI — edit the source map instead.
//   - linkedin-pathway / dpc-created — hand-created here, stored in
//                         data-resource-library.json via saveLibraryEntry().
// "Sharing" a resource with staff writes via saveLibraryShare() (data.js),
// which also mirrors into each staff member's touchHistory[] — see data.js
// for why that's a deliberate two-place write, not duplication by accident.

let _libCurrentId    = null;
let _libFilterType   = '';
let _libFilterTag    = '';
let _libLSEntriesCache = null; // cached Learning Studio entries, fetched once

function initLibrary() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);">Resource Library</h1>
      <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
        <select id="lib-filter-type" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="learning-studio">Learning Studio</option>
          <option value="linkedin-pathway">LinkedIn Pathway</option>
          <option value="dpc-created">DPC-created</option>
          <option value="external-resource">External resource</option>
          <option value="reading-material">Reading material</option>
        </select>
        <select id="lib-filter-tag" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);" aria-label="Filter by category">
          <option value="">All categories</option>
        </select>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;">
          <button id="lib-new-linkedin" type="button" class="btn btn--primary btn--sm">+ LinkedIn Pathway</button>
          <button id="lib-new-dpc" type="button" class="btn btn--ghost btn--sm">+ DPC-created</button>
          <button id="lib-new-external" type="button" class="btn btn--ghost btn--sm">+ External resource</button>
          <button id="lib-new-reading" type="button" class="btn btn--ghost btn--sm">+ Reading material</button>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:340px 1fr;gap:var(--space-xl);align-items:start;">
      <div>
        <div id="lib-list" role="list" aria-label="Resource Library"></div>
        <p id="lib-empty" style="font-size:var(--text-sm);color:var(--color-muted);padding:var(--space-lg) 0;display:none;">No resources match this filter.</p>
        <p id="lib-loading" style="font-size:var(--text-sm);color:var(--color-muted);padding:var(--space-lg) 0;">Loading Learning Studio resources…</p>
      </div>
      <div id="lib-detail" style="display:none;"></div>
    </div>

    <!-- Entry modal (LinkedIn Pathway / DPC-created only) -->
    <div id="lib-entry-modal" role="dialog" aria-modal="true" aria-labelledby="lib-entry-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:600;align-items:flex-start;justify-content:center;
      padding:var(--space-lg);overflow-y:auto;">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:560px;padding:var(--space-xl);margin:auto;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="lib-entry-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);"></h2>
          <button id="lib-entry-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="lib-title">Name</label>
          <input class="form-input" type="text" id="lib-title" required>
        </div>
        <div class="form-group" id="lib-author-group" style="display:none;">
          <label class="form-label" for="lib-author">Author</label>
          <input class="form-input" type="text" id="lib-author">
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="lib-description">Description</label>
          <textarea class="form-textarea" id="lib-description" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="lib-url">Link</label>
          <input class="form-input" type="url" id="lib-url" placeholder="https://…" required>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="lib-skills">Key skills developed</label>
          <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">Comma-separated. Using existing heuristic tags (e.g. modelling, checks-for-understanding) means this resource can also surface automatically as a Learning Walk / Instructional Coaching recommendation.</p>
          <input class="form-input" type="text" id="lib-skills" placeholder="e.g. modelling, screen-recording">
        </div>
        <input type="hidden" id="lib-entry-id">
        <input type="hidden" id="lib-entry-type">
        <p id="lib-entry-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>
        <div class="btn-row">
          <button id="lib-entry-save" type="button" class="btn btn--primary">Save resource</button>
          <button id="lib-entry-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Share modal -->
    <div id="lib-share-modal" role="dialog" aria-modal="true" aria-labelledby="lib-share-modal-title" style="
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
      z-index:700;align-items:center;justify-content:center;padding:var(--space-lg);">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);">
          <h2 id="lib-share-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Share resource</h2>
          <button id="lib-share-modal-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="lib-share-date">Date</label>
          <input class="form-input" type="date" id="lib-share-date" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="lib-share-area">Area</label>
          <select class="form-select" id="lib-share-area" required>
            <option value="">— Select area —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="lib-share-staff">Staff</label>
          <select class="form-select" id="lib-share-staff" multiple size="6" aria-describedby="lib-share-staff-hint" required></select>
          <p id="lib-share-staff-hint" style="font-size:var(--text-xs);color:var(--color-muted);margin-top:4px;">Ctrl/Cmd-click to select more than one. List filters to the selected area.</p>
        </div>
        <div class="form-group">
          <label class="form-label form-label--optional" for="lib-share-context">Context</label>
          <textarea class="form-textarea" id="lib-share-context" rows="2" placeholder="e.g. shared during 1:1 coaching, with instructions to use before next observation…"></textarea>
        </div>
        <input type="hidden" id="lib-share-resource-id">
        <p id="lib-share-error" role="alert" style="font-size:var(--text-sm);color:var(--color-red);display:none;margin-bottom:var(--space-md);"></p>
        <div class="btn-row">
          <button id="lib-share-save" type="button" class="btn btn--primary">Record share</button>
          <button id="lib-share-cancel" type="button" class="btn btn--secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  _libLoadLearningStudioEntries().then(() => {
    document.getElementById('lib-loading')?.remove();
    _renderLibraryList();
  });
  _renderLibraryList(); // render manual entries immediately, don't block on the fetch
  _wireLibraryEvents();
}

// ── Learning Studio entries (auto, read-only) ───────────────────
async function _libLoadLearningStudioEntries() {
  if (_libLSEntriesCache) return _libLSEntriesCache;
  try {
    const res = await fetch('./data/resource-tag-map.json');
    const map = res.ok ? await res.json() : {};
    const byUrl = new Map();
    Object.entries(map).forEach(([tag, links]) => {
      (links || []).forEach(link => {
        if (byUrl.has(link.url)) {
          byUrl.get(link.url).tags.push(tag);
        } else {
          byUrl.set(link.url, {
            resourceId:  link.url,
            type:        LIBRARY_TYPE.LEARNING_STUDIO,
            title:       link.title,
            description: '',
            url:         link.url,
            tags:        [tag],
            source:      'auto',
          });
        }
      });
    });
    _libLSEntriesCache = Array.from(byUrl.values());
  } catch {
    _libLSEntriesCache = [];
  }
  return _libLSEntriesCache;
}

// ── List ──────────────────────────────────────────────────────
// Session 33: grouped by type with headings (rather than one flat column),
// and filterable by category tag as well as type — the two together were
// the actual ask: "organised and easily filterable by type or problem
// categories."
const TYPE_ICONS  = { 'learning-studio': '🧭', 'linkedin-pathway': '💼', 'dpc-created': '✍️', 'external-resource': '🔗', 'reading-material': '📖' };
const TYPE_LABELS = { 'learning-studio': 'Learning Studio', 'linkedin-pathway': 'LinkedIn Pathway', 'dpc-created': 'DPC-created', 'external-resource': 'External resource', 'reading-material': 'Reading material' };
const TYPE_ORDER  = ['linkedin-pathway', 'dpc-created', 'external-resource', 'reading-material', 'learning-studio']; // your own curated content first

function _renderLibraryList() {
  const list  = document.getElementById('lib-list');
  const empty = document.getElementById('lib-empty');
  if (!list) return;

  _libPopulateTagFilter();

  let entries = _libGetAllEntries();
  if (_libFilterType) entries = entries.filter(e => e.type === _libFilterType);
  if (_libFilterTag)  entries = entries.filter(e => (e.tags || []).includes(_libFilterTag));

  list.innerHTML = '';
  if (entries.length === 0) { if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';

  const groups = {};
  entries.forEach(e => { (groups[e.type] = groups[e.type] || []).push(e); });

  TYPE_ORDER.forEach(type => {
    const groupEntries = groups[type];
    if (!groupEntries || groupEntries.length === 0) return;
    groupEntries.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    const heading = document.createElement('h3');
    heading.style.cssText = 'font-size:var(--text-xs);font-weight:bold;color:var(--color-muted);text-transform:uppercase;letter-spacing:0.05em;margin:var(--space-lg) 0 var(--space-sm);';
    heading.textContent = `${TYPE_ICONS[type] || ''} ${TYPE_LABELS[type] || type} (${groupEntries.length})`;
    list.appendChild(heading);

    groupEntries.forEach(e => {
      const isActive = _libCurrentId === e.resourceId;
      const shareCount = _libGetSharesForResource(e.resourceId).length;
      const item = document.createElement('div');
      item.role = 'listitem';
      item.setAttribute('tabindex', '0');
      item.style.cssText = `
        padding:var(--space-md);border-radius:var(--radius-md);
        border:2px solid ${isActive ? 'var(--color-teal)' : 'var(--color-border)'};
        background:${isActive ? 'var(--color-teal-lt)' : 'var(--color-white)'};
        cursor:pointer;margin-bottom:var(--space-sm);transition:all 150ms;
      `;
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:4px;">
          ${(e.tags || []).slice(0, 2).map(t => `<span style="font-size:10px;background:var(--color-light);color:var(--color-muted);padding:1px 8px;border-radius:999px;">${_libEsc(_libHumanizeTag(t))}</span>`).join('')}
          ${shareCount > 0 ? `<span style="font-size:var(--text-xs);color:var(--color-teal);margin-left:auto;">${shareCount} share${shareCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);">${_libEsc(e.title)}</p>
      `;
      item.addEventListener('click', () => _openLibraryDetail(e.resourceId));
      item.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _openLibraryDetail(e.resourceId); } });
      list.appendChild(item);
    });
  });
}

function _libPopulateTagFilter() {
  const sel = document.getElementById('lib-filter-tag');
  if (!sel) return;
  const currentValue = sel.value;
  const allTags = new Set();
  _libGetAllEntries().forEach(e => (e.tags || []).forEach(t => allTags.add(t)));
  const sorted = Array.from(allTags).sort();

  // Only rebuild if the tag set actually changed (avoids losing focus/selection on every render)
  const existingValues = Array.from(sel.options).slice(1).map(o => o.value).join(',');
  if (existingValues === sorted.join(',')) return;

  sel.innerHTML = '<option value="">All categories</option>';
  sorted.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = _libHumanizeTag(tag);
    sel.appendChild(opt);
  });
  if (sorted.includes(currentValue)) sel.value = currentValue;
}

function _libHumanizeTag(tag) {
  return String(tag).replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

// ── Detail ────────────────────────────────────────────────────
function _openLibraryDetail(resourceId) {
  _libCurrentId = resourceId;
  _renderLibraryList();
  const detail = document.getElementById('lib-detail');
  if (!detail) return;
  detail.style.display = 'block';

  const e = _libGetEntry(resourceId);
  if (!e) return;

  const typeLabels = { 'learning-studio': 'Learning Studio', 'linkedin-pathway': 'LinkedIn Pathway', 'dpc-created': 'DPC-created', 'external-resource': 'External resource', 'reading-material': 'Reading material' };
  const shares = _libGetSharesForResource(resourceId).slice().reverse();
  const isManual = e.type !== LIBRARY_TYPE.LEARNING_STUDIO;

  detail.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-lg);flex-wrap:wrap;gap:var(--space-md);">
      <div>
        <p style="font-size:var(--text-xs);color:var(--color-muted);margin-bottom:4px;">${typeLabels[e.type] || e.type}${e.source === 'auto' ? ' · read-only, synced from Learning Studio' : ''}</p>
        <h2 style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${_libEsc(e.title)}</h2>
        ${e.author ? `<p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:2px;">by ${_libEsc(e.author)}</p>` : ''}
        ${e.description ? `<p style="font-size:var(--text-sm);color:var(--color-slate);margin-top:var(--space-xs);">${_libEsc(e.description)}</p>` : ''}
        <p style="font-size:var(--text-xs);margin-top:var(--space-xs);"><a href="${_libEsc(e.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--color-teal);">${_libEsc(e.url)}</a></p>
        ${(e.tags || []).length > 0 ? `<div style="margin-top:var(--space-sm);display:flex;gap:4px;flex-wrap:wrap;">${e.tags.map(t => `<span style="font-size:10px;background:var(--color-light);color:var(--color-muted);padding:1px 8px;border-radius:999px;">${_libEsc(_libHumanizeTag(t))}</span>`).join('')}</div>` : ''}
      </div>
      <div style="display:flex;gap:var(--space-sm);flex-shrink:0;">
        ${isManual ? `<button id="lib-edit-btn" type="button" class="btn btn--ghost btn--sm">Edit</button>` : ''}
        <button id="lib-share-btn" type="button" class="btn btn--primary btn--sm">Share with staff</button>
      </div>
    </div>

    <div>
      <h3 style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-md);">Shared (${shares.length})</h3>
      ${shares.length === 0
        ? '<p style="font-size:var(--text-sm);color:var(--color-muted);">Not shared with anyone yet.</p>'
        : shares.map(s => `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;">
            <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:70px;flex-shrink:0;padding-top:2px;">${_libFmtDate(s.date)}</span>
            <div style="flex:1;">
              <p style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_libEsc(s.areaCode || '')} — ${_libStaffNames(s.staffIds)}</p>
              ${s.contextNotes ? `<p style="font-size:var(--text-xs);color:var(--color-muted);">${_libEsc(s.contextNotes)}</p>` : ''}
            </div>
          </div>`).join('')
      }
    </div>
  `;

  document.getElementById('lib-edit-btn')?.addEventListener('click', () => _openEntryModal(e.type, resourceId));
  document.getElementById('lib-share-btn')?.addEventListener('click', () => _openShareModal(e));
}

// ── Entry modal (create/edit manual entries only) ────────────────
function _openEntryModal(type, existingId = null) {
  const modal   = document.getElementById('lib-entry-modal');
  const titleEl = document.getElementById('lib-entry-modal-title');
  const typeEl  = document.getElementById('lib-entry-type');
  const idEl    = document.getElementById('lib-entry-id');
  if (!modal) return;

  const existing = existingId ? _libGetEntry(existingId) : null;
  const labels   = { 'linkedin-pathway': 'LinkedIn Pathway', 'dpc-created': 'DPC-created resource', 'external-resource': 'External resource', 'reading-material': 'reading material' };
  titleEl.textContent = (existing ? 'Edit' : 'New') + ' ' + (labels[type] || type);
  typeEl.value = type;
  idEl.value   = existingId || '';
  document.getElementById('lib-entry-error').style.display = 'none';

  document.getElementById('lib-title').value       = existing?.title || '';
  document.getElementById('lib-author').value      = existing?.author || '';
  document.getElementById('lib-description').value = existing?.description || '';
  document.getElementById('lib-url').value         = existing?.url || '';
  document.getElementById('lib-skills').value      = (existing?.tags || []).join(', ');

  // Author only makes sense for Reading Material — matches the exact
  // three fields asked for (Title, Author, Link), not bolted onto
  // every type regardless of relevance.
  const authorGroup = document.getElementById('lib-author-group');
  if (authorGroup) authorGroup.style.display = type === LIBRARY_TYPE.READING_MATERIAL ? 'block' : 'none';

  modal.style.display = 'flex';
  document.getElementById('lib-title').focus();
}

function _saveEntry() {
  const title   = document.getElementById('lib-title').value.trim();
  const url     = document.getElementById('lib-url').value.trim();
  const type    = document.getElementById('lib-entry-type').value;
  const existId = document.getElementById('lib-entry-id').value;
  const errEl   = document.getElementById('lib-entry-error');

  if (!title) { errEl.textContent = 'Please enter a name.'; errEl.style.display = 'block'; return; }
  if (!url)   { errEl.textContent = 'Please enter a link.'; errEl.style.display = 'block'; return; }

  const tags = document.getElementById('lib-skills').value.split(',').map(t => t.trim()).filter(Boolean);
  const existing = existId ? _libGetEntry(existId) : null;

  const entry = {
    resourceId:  existId || generateId(),
    type,
    title,
    author:      document.getElementById('lib-author').value.trim(),
    description: document.getElementById('lib-description').value.trim(),
    url,
    tags,
    source:      'manual',
    createdAt:   existing?.createdAt || nowISO(),
  };

  saveLibraryEntry(entry);
  document.getElementById('lib-entry-modal').style.display = 'none';
  _renderLibraryList();
  _openLibraryDetail(entry.resourceId);
  if (typeof UI !== 'undefined') UI.showToast('success', `Resource saved: ${title}`);
}

// ── Share modal ───────────────────────────────────────────────
function _openShareModal(entry) {
  const modal = document.getElementById('lib-share-modal');
  if (!modal) return;
  document.getElementById('lib-share-resource-id').value = entry.resourceId;
  document.getElementById('lib-share-date').value = todayISO();
  document.getElementById('lib-share-area').value = '';
  document.getElementById('lib-share-context').value = '';
  document.getElementById('lib-share-error').style.display = 'none';
  _libPopulateAreaDropdown();
  _libPopulateStaffDropdown('');
  modal.style.display = 'flex';
  document.getElementById('lib-share-date').focus();
}

function _saveShare() {
  const resourceId = document.getElementById('lib-share-resource-id').value;
  const date        = document.getElementById('lib-share-date').value;
  const areaCode    = document.getElementById('lib-share-area').value;
  const staffSel    = document.getElementById('lib-share-staff');
  const staffIds    = staffSel ? Array.from(staffSel.selectedOptions).map(o => o.value) : [];
  const errEl       = document.getElementById('lib-share-error');

  if (!date)     { errEl.textContent = 'Please enter a date.'; errEl.style.display = 'block'; return; }
  if (!areaCode) { errEl.textContent = 'Please select an area.'; errEl.style.display = 'block'; return; }
  if (staffIds.length === 0) { errEl.textContent = 'Please select at least one staff member.'; errEl.style.display = 'block'; return; }

  const entry = _libGetEntry(resourceId);
  if (!entry) return;

  saveLibraryShare({
    resourceId,
    resourceType:  entry.type,
    resourceTitle: entry.title,
    resourceUrl:   entry.url,
    date,
    areaCode,
    staffIds,
    contextNotes: document.getElementById('lib-share-context').value.trim(),
  });

  document.getElementById('lib-share-modal').style.display = 'none';
  _renderLibraryList();
  _openLibraryDetail(resourceId);
  if (typeof UI !== 'undefined') UI.showToast('success', `Shared with ${staffIds.length} staff member${staffIds.length !== 1 ? 's' : ''}.`);
}

// ── Wire events ───────────────────────────────────────────────
function _wireLibraryEvents() {
  document.getElementById('lib-filter-type')?.addEventListener('change', e => { _libFilterType = e.target.value; _renderLibraryList(); });
  document.getElementById('lib-filter-tag')?.addEventListener('change', e => { _libFilterTag = e.target.value; _renderLibraryList(); });
  document.getElementById('lib-new-linkedin')?.addEventListener('click', () => _openEntryModal(LIBRARY_TYPE.LINKEDIN_PATHWAY));
  document.getElementById('lib-new-dpc')?.addEventListener('click', () => _openEntryModal(LIBRARY_TYPE.DPC_CREATED));
  document.getElementById('lib-new-external')?.addEventListener('click', () => _openEntryModal(LIBRARY_TYPE.EXTERNAL_RESOURCE));
  document.getElementById('lib-new-reading')?.addEventListener('click', () => _openEntryModal(LIBRARY_TYPE.READING_MATERIAL));

  document.getElementById('lib-entry-modal-close')?.addEventListener('click', () => { document.getElementById('lib-entry-modal').style.display = 'none'; });
  document.getElementById('lib-entry-cancel')?.addEventListener('click', () => { document.getElementById('lib-entry-modal').style.display = 'none'; });
  document.getElementById('lib-entry-save')?.addEventListener('click', _saveEntry);
  document.getElementById('lib-entry-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('lib-entry-modal')) document.getElementById('lib-entry-modal').style.display = 'none'; });

  document.getElementById('lib-share-modal-close')?.addEventListener('click', () => { document.getElementById('lib-share-modal').style.display = 'none'; });
  document.getElementById('lib-share-cancel')?.addEventListener('click', () => { document.getElementById('lib-share-modal').style.display = 'none'; });
  document.getElementById('lib-share-save')?.addEventListener('click', _saveShare);
  document.getElementById('lib-share-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('lib-share-modal')) document.getElementById('lib-share-modal').style.display = 'none'; });
  document.getElementById('lib-share-area')?.addEventListener('change', e => _libPopulateStaffDropdown(e.target.value));
}

function _libPopulateAreaDropdown() {
  const sel = document.getElementById('lib-share-area');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  (_getAreas() || []).sort((a, b) => a.areaName.localeCompare(b.areaName)).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area.areaCode;
    opt.textContent = `${area.areaCode} — ${area.areaName}`;
    sel.appendChild(opt);
  });
}

function _libPopulateStaffDropdown(areaCode) {
  const sel = document.getElementById('lib-share-staff');
  if (!sel) return;
  sel.innerHTML = '';
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const filtered = areaCode ? allStaff.filter(s => s.areaCode === areaCode) : allStaff;
  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.staffId;
    opt.textContent = s.name + (s.role ? ` (${s.role})` : '');
    sel.appendChild(opt);
  });
}

// ── Helpers ───────────────────────────────────────────────────
function _libGetAllEntries() {
  const manual = (window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.entries) || [];
  const auto   = _libLSEntriesCache || [];
  return [...auto, ...manual];
}
function _libGetEntry(resourceId) { return _libGetAllEntries().find(e => e.resourceId === resourceId) || null; }
function _libGetAllShares() { return (window.DPC_DATA.resourceLibrary && window.DPC_DATA.resourceLibrary.shares) || []; }
function _libGetSharesForResource(resourceId) { return _libGetAllShares().filter(s => s.resourceId === resourceId); }
function _libGetSharesForStaff(staffId) { return _libGetAllShares().filter(s => (s.staffIds || []).includes(staffId)); }
function _libGetSharesForArea(areaCode) { return _libGetAllShares().filter(s => s.areaCode === areaCode); }
function _libStaffNames(staffIds) {
  const allStaff = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  return (staffIds || []).map(id => { const s = allStaff.find(x => x.staffId === id); return s ? s.name : id; }).join(', ');
}
function _libFmtDate(iso) { if (!iso) return ''; try { return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } }
function _libEsc(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
