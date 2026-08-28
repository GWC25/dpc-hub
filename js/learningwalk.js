// DPC Hub · js/learningwalk.js · v2.0 · 28/08/2026
// Learning Walk module — mirrors the MyWeston "Learning Review Activity" (LRA) form
// so records can be exported to Word and transcribed into MyWeston/Hyper later.
// Sections: LRA Details · Findings · Themes · Actions Moving Forwards · Sign Off.
// "Refer for Instructional Coaching?" triggers the devobs escalation (sharedId link).
// Actions Moving Forwards rows → AFI drafts (Areas to Strengthen); Positive Findings
// tags → Strength AFIs. AFIs generated once, on first Submit and Complete.
// Writes to area activityLog[] via saveArea(). Word export via lib/docx.min.js.

// ── MyWeston display labels (module-local; schema ids unchanged) ──
// The Word export must match MyWeston field/theme titles exactly for easy re-keying.
const _LW_MW_CAT_LABELS = Object.freeze({
  CAT2: 'Inclusive Teaching, Learning & SEND',
});
const _LW_MW_THEME_LABELS = Object.freeze({
  AR:  'Accessible resources',
  ARD: 'Accessible resources (Digital skills)',
  LL2: 'Language & Literacy Skills (English)',
  NS:  'Numeracy Skills (Maths)',
  LED: 'Learning Environment (Dig navigation)',
  LM:  'Live modelling and guided practice',
  SSL: 'Subject specific language (CBL)',
  ISV: 'Industry & sector vocabulary (WBL)',
  AP:  'Adaptive practice',
  RTL: 'Ready To Learn',
  RTW: 'Ready To Work',
  RFL: 'Ready For Life',
});

const _LW_LEVELS = Object.freeze(['Entry Level', 'Level 1', 'Level 2', 'Level 3', 'HE']);
const _LW_SESSION_TYPES = Object.freeze(['Learning Walk']);

const _LW_GUIDANCE = Object.freeze([
  'Behaviour for learning',
  'Culture and the promotion of our values (BV)',
  'Planning for individual learning',
  'Assessment and feedback during learning',
  'Challenge and deeper learning',
  'Attendance and punctuality',
  'Resources and equipment',
  'The learning environment',
  'Learners\u2019 readiness to learn',
  'Engagement with learning activities',
  'Focus and mindset',
  'Development of ID skills',
  'Development of maths and English skills',
  'The use of technology to enhance learning',
  'Employability skill development',
]);

// ── Module state (reset on each modal open) ───────────────────
let _lwState = null;

function _lwFreshState() {
  return {
    editingActivityId: null,   // set when reopening an existing record
    editingAreaCode: null,     // area the record currently lives in
    areaCode: null,            // Department selection
    positive: [],              // theme ids
    afd: [],                   // theme ids (Areas for Development)
    themesTarget: null,        // 'positive' | 'afd' while Select Themes open
    returnFocusEl: null,       // element to restore focus to on modal close
    themesReturnFocusEl: null, // element to restore focus to on themes modal close
  };
}

// ── Theme label helpers ───────────────────────────────────────
function _lwThemeLabel(themeId) {
  if (_LW_MW_THEME_LABELS[themeId]) return _LW_MW_THEME_LABELS[themeId];
  for (const cat of LRA_TAXONOMY) {
    const t = cat.themes.find(th => th.id === themeId);
    if (t) return t.label;
  }
  return themeId;
}
function _lwCatLabel(cat) {
  return _LW_MW_CAT_LABELS[cat.id] || cat.label;
}

// ── Page ──────────────────────────────────────────────────────
function initLearningWalk() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div id="banner-container" aria-live="polite"></div>
    <h1 style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-sm);">Learning Walk</h1>
    <p style="font-size:var(--text-base);color:var(--color-muted);margin-bottom:var(--space-xl);">
      Complete a Learning Review Activity for a walk, save drafts to finish later, and download
      completed walks as Word documents matching the MyWeston LRA layout.
    </p>
    <button id="lw-new-btn" type="button" class="btn btn--primary" style="margin-bottom:var(--space-xl);">+ New Learning Walk</button>
    <div id="lw-recent">
      <h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin-bottom:var(--space-md);">Recent Learning Walks</h2>
      <div id="lw-recent-list"></div>
    </div>
  `;
  _renderRecentLWs();
  document.getElementById('lw-new-btn')?.addEventListener('click', () => openLearningWalkModal());
}

function _renderRecentLWs() {
  const list = document.getElementById('lw-recent-list');
  if (!list) return;
  const areas = (window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [];
  const all = [];
  areas.forEach(area => {
    (area.activityLog || []).forEach(a => {
      if (a.activityType === ACTIVITY_TYPE.LEARNING_WALK) {
        all.push({ ...a, areaName: area.areaName });
      }
    });
  });
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recent = all.slice(0, 12);
  if (recent.length === 0) {
    list.innerHTML = '<p style="color:var(--color-muted);font-size:var(--text-sm);">No Learning Walks logged yet.</p>';
    return;
  }
  list.innerHTML = recent.map(lw => {
    const isDraft = lw.status === 'draft';
    const afiCount = (lw.afiIdsGenerated || []).length;
    const afdCount = ((lw.lra && lw.lra.areasForDevelopment) || lw.lraThemeIds || []).length;
    return `
    <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--color-border);align-items:flex-start;flex-wrap:wrap;">
      <span style="font-size:var(--text-xs);color:var(--color-muted);min-width:76px;padding-top:4px;">${_lwFmtDate(lw.date)}</span>
      <div style="flex:1;min-width:220px;">
        <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:var(--text-sm);font-weight:bold;color:var(--color-slate);">${_lwEsc(lw.areaCode || '—')} — ${_lwEsc(lw.areaName || '')}</span>
          ${isDraft ? '<span class="badge badge--amber">Draft</span>' : '<span class="badge badge--green">Complete</span>'}
          ${afiCount > 0 ? `<span class="badge badge--teal">${afiCount} AFI${afiCount !== 1 ? 's' : ''}</span>` : ''}
          ${afdCount > 0 && afiCount === 0 ? `<span class="badge badge--muted">${afdCount} theme${afdCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
        ${lw.summary ? `<p style="font-size:var(--text-xs);color:var(--color-muted);">${_lwEsc(lw.summary)}</p>` : ''}
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button type="button" class="btn btn--secondary btn--sm" data-lw-open="${_lwEsc(lw.activityId)}" data-lw-area="${_lwEsc(lw.areaCode)}">${isDraft ? 'Continue draft' : 'Open'}</button>
        ${!isDraft ? `<button type="button" class="btn btn--ghost btn--sm" data-lw-word="${_lwEsc(lw.activityId)}" data-lw-area="${_lwEsc(lw.areaCode)}">Download Word</button>` : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-lw-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = _lwFindActivity(btn.getAttribute('data-lw-area'), btn.getAttribute('data-lw-open'));
      if (rec) openLearningWalkModal(rec);
    });
  });
  list.querySelectorAll('[data-lw-word]').forEach(btn => {
    btn.addEventListener('click', () => {
      _lwDownloadWord(btn.getAttribute('data-lw-area'), btn.getAttribute('data-lw-word'));
    });
  });
}

function _lwFindActivity(areaCode, activityId) {
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area) return null;
  return (area.activityLog || []).find(a => a.activityId === activityId) || null;
}

// ── Modal ─────────────────────────────────────────────────────
function openLearningWalkModal(record) {
  document.getElementById('lw-modal')?.remove();
  _lwState = _lwFreshState();
  _lwState.returnFocusEl = document.activeElement;

  if (record) {
    _lwState.editingActivityId = record.activityId;
    _lwState.editingAreaCode = record.areaCode;
    _lwState.areaCode = record.areaCode || null;
    _lwState.positive = [...(((record.lra || {}).positiveFindings) || [])];
    _lwState.afd = [...(((record.lra || {}).areasForDevelopment) || [])];
  }

  const yearNow = new Date().getFullYear();
  const startYear = new Date().getMonth() >= 7 ? yearNow : yearNow - 1; // academic year rolls in August
  const acadYears = [];
  for (let y = 2025; y <= startYear + 2; y++) acadYears.push(`${y}/${y + 1}`);
  const defaultAY = `${startYear}/${startYear + 1}`;

  const sectionBar = (t) => `<div style="background:var(--color-navy);color:var(--color-white);font-size:var(--text-sm);font-weight:var(--font-bold);padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);margin:var(--space-lg) 0 var(--space-md);">${t}</div>`;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="lw-modal" role="dialog" aria-modal="true" aria-labelledby="lw-modal-title" style="
      display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:600;
      align-items:flex-start;justify-content:center;padding:var(--space-lg);overflow-y:auto;">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:860px;margin:auto 0;padding:var(--space-xl);">

        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-sm);">
          <h2 id="lw-modal-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">${record && record.status !== 'draft' ? 'Learning Review Activity' : record ? 'Continue Learning Review Activity (draft)' : 'New Learning Review Activity'}</h2>
          <button id="lw-close" type="button" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <p id="lw-error" role="alert" style="display:none;color:var(--color-red);font-size:var(--text-sm);font-weight:bold;margin-bottom:var(--space-sm);"></p>

        ${sectionBar('LRA Details')}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);">
          <div class="form-group">
            <label class="form-label" for="lw-acadyear">Academic Year</label>
            <select class="form-select" id="lw-acadyear">
              ${acadYears.map(y => `<option value="${y}"${y === defaultAY ? ' selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-lecturer">Lecturer/Assessor</label>
            <input class="form-input" type="text" id="lw-lecturer" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-observer">Observer</label>
            <input class="form-input" type="text" id="lw-observer" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-jointobserver">Joint Observer</label>
            <input class="form-input" type="text" id="lw-jointobserver" autocomplete="off">
          </div>
          <div class="form-group" style="position:relative;">
            <label class="form-label" for="lw-dept">Department</label>
            <input class="form-input" type="text" id="lw-dept" role="combobox" aria-expanded="false"
                   aria-controls="lw-dept-list" aria-autocomplete="list" autocomplete="off"
                   placeholder="Type to search areas…">
            <div id="lw-dept-list" role="listbox" aria-label="Department options" style="
              display:none;position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--color-white);
              border:1px solid var(--color-border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);
              max-height:220px;overflow-y:auto;"></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-division">Division</label>
            <input class="form-input" type="text" id="lw-division" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-programme">Programme</label>
            <input class="form-input" type="text" id="lw-programme" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-date">Date</label>
            <input class="form-input" type="date" id="lw-date">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-timebegan">Time Began</label>
            <input class="form-input" type="time" id="lw-timebegan">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-timecomplete">Time Complete</label>
            <input class="form-input" type="time" id="lw-timecomplete">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-sessiontype">Session Type</label>
            <select class="form-select" id="lw-sessiontype">
              ${_LW_SESSION_TYPES.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-provision">Provision</label>
            <input class="form-input" type="text" id="lw-provision" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-level">Level</label>
            <select class="form-select" id="lw-level">
              <option value="">Please Select</option>
              ${_LW_LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-attendance">Attendance %</label>
            <input class="form-input" type="number" id="lw-attendance" min="0" max="100" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label" for="lw-lratype">LRA Type</label>
            <select class="form-select" id="lw-lratype">
              <option value="Learning Walk" selected>Learning Walk</option>
            </select>
          </div>
        </div>

        ${sectionBar('Findings')}
        <p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-sm);">
          The divisional learning walks should be used as a tool for gathering first hand observational and verbal
          information about the quality of the learner/learning experience across the division.
          This may include (but is not limited to) some of the following:
        </p>
        <ul style="columns:2;column-gap:var(--space-xl);font-size:var(--text-sm);color:var(--color-slate);margin:0 0 var(--space-md) var(--space-lg);padding:0;">
          ${_LW_GUIDANCE.map(g => `<li style="margin-bottom:2px;">${g}</li>`).join('')}
        </ul>
        <div class="form-group">
          <label class="form-label" for="lw-observations">Learning Walk Observations – provide a summary of your observations.</label>
          <textarea class="form-input" id="lw-observations" rows="7" style="resize:vertical;"></textarea>
        </div>

        ${sectionBar('Themes')}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-md);">
          <div class="form-group">
            <span class="form-label" id="lw-positive-label">Positive Findings:</span>
            <div id="lw-positive-tags" role="group" aria-labelledby="lw-positive-label" style="display:flex;flex-wrap:wrap;gap:var(--space-xs);align-items:center;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-sm);min-height:44px;"></div>
          </div>
          <div class="form-group">
            <span class="form-label" id="lw-afd-label">Areas for Development:</span>
            <div id="lw-afd-tags" role="group" aria-labelledby="lw-afd-label" style="display:flex;flex-wrap:wrap;gap:var(--space-xs);align-items:center;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-sm);min-height:44px;"></div>
          </div>
        </div>

        ${sectionBar('Actions Moving Forwards')}
        <div id="lw-actions-rows"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-sm);">
          <button type="button" id="lw-action-add" class="btn btn--primary btn--sm" aria-label="Add action row">+</button>
        </div>

        ${sectionBar('Sign Off')}
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md);">
          <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--text-sm);color:var(--color-slate);cursor:pointer;min-height:44px;">
            <input type="checkbox" id="lw-refer" style="width:18px;height:18px;">
            Refer for Instructional Coaching?
          </label>
          <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
            <button type="button" id="lw-save-draft" class="btn btn--secondary">Save and Continue</button>
            <button type="button" id="lw-submit" class="btn btn--primary">Submit and Complete</button>
            ${record && record.status !== 'draft' ? '<button type="button" id="lw-word" class="btn btn--ghost">Download Word</button>' : ''}
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  const modal = document.getElementById('lw-modal');
  _lwSetupCombobox();
  _lwRenderTags('positive');
  _lwRenderTags('afd');
  _lwInitActions(record);
  _lwPrefill(record);

  document.getElementById('lw-close').addEventListener('click', _closeLWModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) _closeLWModal(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const deptList = document.getElementById('lw-dept-list');
      if (deptList && deptList.style.display !== 'none') return; // combobox handles its own Escape
      e.stopPropagation();
      _closeLWModal();
    }
  });
  _lwTrapFocus(modal);
  document.getElementById('lw-action-add').addEventListener('click', () => _lwAddActionRow());
  document.getElementById('lw-save-draft').addEventListener('click', () => _lwSave('draft'));
  document.getElementById('lw-submit').addEventListener('click', () => _lwSave('complete'));
  document.getElementById('lw-word')?.addEventListener('click', () => {
    if (record) _lwDownloadWord(record.areaCode, record.activityId);
  });

  // Initial focus
  document.getElementById('lw-acadyear').focus();
}

function _closeLWModal() {
  document.getElementById('lw-themes-modal')?.remove();
  document.getElementById('lw-modal')?.remove();
  const rf = _lwState && _lwState.returnFocusEl;
  if (rf && document.contains(rf)) rf.focus();
  _lwState = null;
  if (document.getElementById('lw-recent-list')) _renderRecentLWs();
}

function _lwPrefill(record) {
  if (!record) {
    document.getElementById('lw-date').value = new Date().toISOString().slice(0, 10);
    return;
  }
  const l = record.lra || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
  set('lw-acadyear', l.academicYear);
  set('lw-lecturer', l.lecturer);
  set('lw-observer', l.observer);
  set('lw-jointobserver', l.jointObserver);
  set('lw-division', l.division);
  set('lw-programme', l.programme);
  set('lw-date', record.date);
  set('lw-timebegan', l.timeBegan);
  set('lw-timecomplete', l.timeComplete);
  set('lw-sessiontype', l.sessionType);
  set('lw-provision', l.provision);
  set('lw-level', l.level);
  set('lw-attendance', l.attendancePct);
  document.getElementById('lw-observations').value = l.observations || record.summary || '';
  document.getElementById('lw-refer').checked = !!l.referForCoaching;
  if (record.areaCode) {
    const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === record.areaCode);
    if (area) document.getElementById('lw-dept').value = `${area.areaCode} — ${area.areaName}`;
  }
}

// ── Department combobox (searchable typeahead over Hub areas) ──
function _lwSetupCombobox() {
  const input = document.getElementById('lw-dept');
  const list = document.getElementById('lw-dept-list');
  let activeIdx = -1;
  let filtered = [];

  const areas = () => ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [])
    .slice().sort((a, b) => a.areaName.localeCompare(b.areaName));

  function open(items) {
    filtered = items;
    activeIdx = -1;
    if (items.length === 0) {
      list.innerHTML = '<div style="padding:var(--space-sm) var(--space-md);font-size:var(--text-sm);color:var(--color-muted);">No matching areas</div>';
    } else {
      list.innerHTML = items.map((a, i) => `
        <div id="lw-dept-opt-${i}" role="option" aria-selected="false" data-code="${_lwEsc(a.areaCode)}" style="
          padding:var(--space-sm) var(--space-md);font-size:var(--text-sm);color:var(--color-slate);cursor:pointer;">
          <strong>${_lwEsc(a.areaCode)}</strong> — ${_lwEsc(a.areaName)}
        </div>`).join('');
      list.querySelectorAll('[role="option"]').forEach((opt, i) => {
        opt.addEventListener('mousedown', (e) => { e.preventDefault(); select(i); });
        opt.addEventListener('mousemove', () => setActive(i));
      });
    }
    list.style.display = 'block';
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIdx = -1;
  }
  function setActive(i) {
    list.querySelectorAll('[role="option"]').forEach((opt, j) => {
      opt.setAttribute('aria-selected', j === i ? 'true' : 'false');
      opt.style.background = j === i ? 'var(--color-teal-lt)' : '';
    });
    activeIdx = i;
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', `lw-dept-opt-${i}`);
      const el = document.getElementById(`lw-dept-opt-${i}`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }
  function select(i) {
    const a = filtered[i];
    if (!a) return;
    _lwState.areaCode = a.areaCode;
    input.value = `${a.areaCode} — ${a.areaName}`;
    close();
    _lwHideError();
  }
  function filterNow() {
    const q = input.value.trim().toLowerCase();
    _lwState.areaCode = null; // typing invalidates previous selection
    const items = !q ? areas() : areas().filter(a =>
      a.areaCode.toLowerCase().includes(q) || a.areaName.toLowerCase().includes(q));
    // Exact code match auto-selects silently on blur; note it here for convenience
    open(items);
  }

  input.addEventListener('focus', filterNow);
  input.addEventListener('input', filterNow);
  input.addEventListener('blur', () => {
    // Exact single match (by code or full "CODE — Name") counts as a selection
    const q = input.value.trim().toLowerCase();
    if (!_lwState.areaCode && q) {
      const exact = areas().filter(a =>
        a.areaCode.toLowerCase() === q ||
        `${a.areaCode} — ${a.areaName}`.toLowerCase() === q);
      if (exact.length === 1) {
        _lwState.areaCode = exact[0].areaCode;
        input.value = `${exact[0].areaCode} — ${exact[0].areaName}`;
      }
    }
    setTimeout(close, 120);
  });
  input.addEventListener('keydown', (e) => {
    const isOpen = list.style.display !== 'none';
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { filterNow(); return; }
      setActive(Math.min(activeIdx + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && activeIdx >= 0) { e.preventDefault(); select(activeIdx); }
    } else if (e.key === 'Escape') {
      if (isOpen) { e.stopPropagation(); close(); }
    }
  });
}

// ── Themes tag fields + Select Themes modal ───────────────────
function _lwRenderTags(target) {
  const container = document.getElementById(target === 'positive' ? 'lw-positive-tags' : 'lw-afd-tags');
  if (!container) return;
  const ids = _lwState[target === 'positive' ? 'positive' : 'afd'];
  const badgeClass = target === 'positive' ? 'badge--green' : 'badge--amber';
  const listName = target === 'positive' ? 'Positive Findings' : 'Areas for Development';
  container.innerHTML = `
    ${ids.map(id => `
      <span class="badge ${badgeClass}" style="gap:4px;">
        ${_lwEsc(_lwThemeLabel(id))}
        <button type="button" data-lw-untag="${_lwEsc(id)}" data-lw-target="${target}"
          aria-label="Remove ${_lwEsc(_lwThemeLabel(id))} from ${listName}"
          style="background:none;border:none;cursor:pointer;color:inherit;font-weight:bold;font-size:12px;line-height:1;padding:2px 4px;">×</button>
      </span>`).join('')}
    <button type="button" data-lw-addtags="${target}" class="btn btn--ghost btn--sm">Click to add tags</button>
  `;
  container.querySelectorAll('[data-lw-untag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-lw-untag');
      const t = btn.getAttribute('data-lw-target');
      _lwState[t === 'positive' ? 'positive' : 'afd'] = _lwState[t === 'positive' ? 'positive' : 'afd'].filter(x => x !== id);
      _lwRenderTags(t);
      if (t === 'afd') _lwSyncActionThemeOptions();
    });
  });
  container.querySelectorAll('[data-lw-addtags]').forEach(btn => {
    btn.addEventListener('click', () => _lwOpenThemesModal(btn.getAttribute('data-lw-addtags'), btn));
  });
}

function _lwOpenThemesModal(target, triggerEl) {
  document.getElementById('lw-themes-modal')?.remove();
  _lwState.themesTarget = target;
  _lwState.themesReturnFocusEl = triggerEl;
  const selected = new Set(_lwState[target === 'positive' ? 'positive' : 'afd']);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="lw-themes-modal" role="dialog" aria-modal="true" aria-labelledby="lw-themes-title" style="
      display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:650;
      align-items:flex-start;justify-content:center;padding:var(--space-lg);overflow-y:auto;">
      <div style="background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:820px;margin:auto 0;padding:var(--space-xl);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-md);">
          <h2 id="lw-themes-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Select Themes</h2>
          <button id="lw-themes-close" type="button" aria-label="Close theme selection" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-md);">
          ${LRA_TAXONOMY.map(cat => `
            <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-md);margin:0;">
              <legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 var(--space-xs);">${_lwEsc(_lwCatLabel(cat))}</legend>
              ${cat.themes.map(t => `
                <label style="display:flex;align-items:center;gap:var(--space-sm);font-size:var(--text-sm);color:var(--color-slate);cursor:pointer;min-height:32px;">
                  <input type="checkbox" name="lw-theme-pick" value="${_lwEsc(t.id)}"${selected.has(t.id) ? ' checked' : ''} style="width:16px;height:16px;">
                  ${_lwEsc(_lwThemeLabel(t.id))}
                </label>`).join('')}
            </fieldset>`).join('')}
        </div>
        <div class="btn-row" style="display:flex;justify-content:flex-end;gap:var(--space-sm);margin-top:var(--space-lg);">
          <button type="button" id="lw-themes-done" class="btn btn--primary">Done</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  const modal = document.getElementById('lw-themes-modal');
  const commit = () => {
    const picked = Array.from(modal.querySelectorAll('input[name="lw-theme-pick"]:checked')).map(cb => cb.value);
    _lwState[target === 'positive' ? 'positive' : 'afd'] = picked;
    _lwCloseThemesModal();
    _lwRenderTags(target);
    if (target === 'afd') _lwSyncActionThemeOptions();
  };
  document.getElementById('lw-themes-done').addEventListener('click', commit);
  document.getElementById('lw-themes-close').addEventListener('click', commit);
  modal.addEventListener('click', (e) => { if (e.target === modal) commit(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); commit(); }
  });
  _lwTrapFocus(modal);
  modal.querySelector('input[name="lw-theme-pick"]')?.focus();
}

function _lwCloseThemesModal() {
  document.getElementById('lw-themes-modal')?.remove();
  const rf = _lwState && _lwState.themesReturnFocusEl;
  if (rf && document.contains(rf)) rf.focus();
  if (_lwState) { _lwState.themesTarget = null; _lwState.themesReturnFocusEl = null; }
}

// ── Actions Moving Forwards ───────────────────────────────────
function _lwInitActions(record) {
  const existing = ((record && record.lra && record.lra.actions) || []);
  if (existing.length === 0) {
    _lwAddActionRow();
  } else {
    existing.forEach(a => _lwAddActionRow(a));
  }
}

function _lwAddActionRow(action) {
  const rows = document.getElementById('lw-actions-rows');
  if (!rows) return;
  const rowId = `lw-action-${Math.random().toString(36).slice(2, 8)}`;
  const row = document.createElement('div');
  row.id = rowId;
  row.setAttribute('data-lw-action-row', '');
  row.style.cssText = 'display:grid;grid-template-columns:minmax(160px,1fr) minmax(200px,2fr) minmax(140px,auto) auto;gap:var(--space-sm);align-items:start;background:var(--color-light);padding:var(--space-sm);border-radius:var(--radius-sm);margin-bottom:var(--space-sm);';
  row.innerHTML = `
    <div>
      <label class="form-label" for="${rowId}-theme">Theme</label>
      <select class="form-select" id="${rowId}-theme" data-lw-action-theme></select>
    </div>
    <div>
      <label class="form-label" for="${rowId}-comments">Comments</label>
      <textarea class="form-input" id="${rowId}-comments" data-lw-action-comments rows="2" style="resize:vertical;"></textarea>
    </div>
    <div>
      <label class="form-label" for="${rowId}-when">When?</label>
      <input class="form-input" type="date" id="${rowId}-when" data-lw-action-when>
    </div>
    <div style="padding-top:26px;">
      <button type="button" class="btn btn--danger btn--sm" data-lw-action-remove aria-label="Remove this action row">X</button>
    </div>`;
  rows.appendChild(row);
  row.querySelector('[data-lw-action-remove]').addEventListener('click', () => row.remove());
  _lwFillActionThemeSelect(row.querySelector('[data-lw-action-theme]'), action ? action.themeId : '');
  if (action) {
    row.querySelector('[data-lw-action-comments]').value = action.comments || '';
    row.querySelector('[data-lw-action-when]').value = action.when || '';
  }
}

function _lwFillActionThemeSelect(sel, selectedId) {
  if (!sel) return;
  const current = selectedId || sel.value;
  sel.innerHTML = '<option value="">Please Select</option>' +
    _lwState.afd.map(id => `<option value="${_lwEsc(id)}"${id === current ? ' selected' : ''}>${_lwEsc(_lwThemeLabel(id))}</option>`).join('');
  // If previous selection is no longer an AfD tag, it falls back to Please Select.
}

function _lwSyncActionThemeOptions() {
  document.querySelectorAll('[data-lw-action-theme]').forEach(sel => _lwFillActionThemeSelect(sel));
}

function _lwReadActions() {
  const actions = [];
  document.querySelectorAll('[data-lw-action-row]').forEach(row => {
    const themeId = row.querySelector('[data-lw-action-theme]')?.value || '';
    const comments = row.querySelector('[data-lw-action-comments]')?.value.trim() || '';
    const when = row.querySelector('[data-lw-action-when]')?.value || '';
    if (themeId || comments || when) actions.push({ themeId: themeId || null, comments, when: when || null });
  });
  return actions;
}

// ── AFI construction ──────────────────────────────────────────
// draftAFI() returns null for themes with no heuristic rule (LL2, NS, PR, ISV,
// RTW, RFL, FS as of Aug 2026). A user-authored Action row must still become an
// AFI, so fall back to constructing the same shape directly from the taxonomy.
function _lwBuildAFI(themeId, severity, areaCode) {
  const viaRule = draftAFI(themeId, severity, areaCode);
  if (viaRule) return viaRule;
  let theme = null, catId = null;
  for (const cat of LRA_TAXONOMY) {
    const t = cat.themes.find(x => x.id === themeId);
    if (t) { theme = t; catId = cat.id; break; }
  }
  if (!theme) return null;
  return {
    afiId: generateId(),
    areaCode,
    staffId: null,
    lraCategoryId: catId,
    lraThemeId: themeId,
    lraThemeLabel: theme.label,
    description: '',
    digitalOpportunity: null,
    digitalApplicable: false,
    rationaleTest: null,
    status: AFI_STATUS.OPEN,
    severity,
    closeWindow: severity === AFI_SEVERITY.IMMEDIATE ? '2-weeks' : '6-weeks',
    linkedActions: [],
    evidenceChain: [],
    parentObservationId: null,
    hyperThemeMatch: HYPER_FOCUS.find(h => h.id === themeId) ? themeId : null,
    qipRef: null,
    createdAt: nowISO(),
    closedAt: null,
    lastUpdated: nowISO(),
  };
}

// ── Save (draft or complete) ──────────────────────────────────
function _lwSave(mode) {
  _lwHideError();
  const areaCode = _lwState.areaCode;
  if (!areaCode) {
    _lwShowError('Select a Department (curriculum area) so this walk can be saved to an area. Everything else can stay unfilled.');
    document.getElementById('lw-dept').focus();
    return;
  }
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === areaCode);
  if (!area) { _lwShowError('Area not found.'); return; }

  const val = (id) => document.getElementById(id)?.value.trim() || '';
  const actions = _lwReadActions();
  const refer = document.getElementById('lw-refer').checked;
  const observations = document.getElementById('lw-observations').value.trim();
  const date = val('lw-date') || new Date().toISOString().slice(0, 10);

  const lra = {
    academicYear: val('lw-acadyear'),
    lecturer: val('lw-lecturer'),
    observer: val('lw-observer'),
    jointObserver: val('lw-jointobserver'),
    division: val('lw-division'),
    programme: val('lw-programme'),
    timeBegan: val('lw-timebegan'),
    timeComplete: val('lw-timecomplete'),
    sessionType: val('lw-sessiontype') || 'Learning Walk',
    provision: val('lw-provision'),
    level: val('lw-level'),
    attendancePct: val('lw-attendance'),
    lraType: 'Learning Walk',
    observations,
    positiveFindings: [..._lwState.positive],
    areasForDevelopment: [..._lwState.afd],
    actions,
    referForCoaching: refer,
  };

  const allThemeIds = [...new Set([..._lwState.positive, ..._lwState.afd])];
  const hyperThemes = allThemeIds.filter(id => HYPER_FOCUS.some(h => h.id === id));

  // Locate existing record if editing
  let activity = null;
  if (_lwState.editingActivityId) {
    const srcArea = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === _lwState.editingAreaCode);
    activity = srcArea ? (srcArea.activityLog || []).find(x => x.activityId === _lwState.editingActivityId) : null;
    // Moving a record between areas: remove from old area's log
    if (activity && _lwState.editingAreaCode !== areaCode && srcArea) {
      srcArea.activityLog = (srcArea.activityLog || []).filter(x => x.activityId !== activity.activityId);
      srcArea.lastUpdated = nowISO();
      saveArea(srcArea);
      if (!area.activityLog) area.activityLog = [];
      area.activityLog.push(activity);
    }
  }

  if (!activity) {
    activity = {
      activityId: generateId(),
      activityType: ACTIVITY_TYPE.LEARNING_WALK,
      createdAt: nowISO(),
      afiIdsGenerated: [],
      sharedId: null,
      qipRef: null,
      staffIds: [],
    };
    if (!area.activityLog) area.activityLog = [];
    area.activityLog.push(activity);
    _lwState.editingActivityId = activity.activityId;
    _lwState.editingAreaCode = areaCode;
  }

  activity.date = date;
  activity.areaCode = areaCode;
  activity.status = mode === 'complete' ? 'complete' : 'draft';
  activity.lra = lra;
  activity.lraThemeIds = allThemeIds;
  activity.hyperThemes = hyperThemes;
  activity.summary = observations
    ? (observations.length > 140 ? observations.slice(0, 137) + '…' : observations)
    : `Learning Walk — ${areaCode}`;
  activity.updatedAt = nowISO();

  // AFI generation — once, on first completion only (no duplicates on re-submit)
  let newAFIs = 0;
  if (mode === 'complete' && (!activity.afiIdsGenerated || activity.afiIdsGenerated.length === 0)) {
    if (!area.afiRefs) area.afiRefs = [];
    const generated = [];
    actions.filter(a => a.themeId).forEach(a => {
      const draft = _lwBuildAFI(a.themeId, AFI_SEVERITY.STRENGTHEN, areaCode);
      if (!draft) return;
      draft.description = a.comments || draft.description || `Action agreed: ${_lwThemeLabel(a.themeId)}`;
      draft.targetDate = a.when || null;
      draft.parentObservationId = activity.activityId;
      saveAFI(draft);
      area.afiRefs.push(draft.afiId);
      generated.push(draft.afiId);
    });
    _lwState.positive.forEach(id => {
      const draft = _lwBuildAFI(id, AFI_SEVERITY.STRENGTH, areaCode);
      if (!draft) return;
      if (!draft.description) draft.description = `Strength observed: ${_lwThemeLabel(id)}`;
      draft.parentObservationId = activity.activityId;
      saveAFI(draft);
      area.afiRefs.push(draft.afiId);
      generated.push(draft.afiId);
    });
    activity.afiIdsGenerated = generated;
    newAFIs = generated.length;
  }

  // Refer for Instructional Coaching
  let escalate = false;
  if (mode === 'complete' && refer && !activity.sharedId) {
    activity.sharedId = generateId();
    escalate = true;
  }

  area.lastUpdated = nowISO();
  saveArea(area);

  if (typeof UI !== 'undefined') {
    if (mode === 'draft') {
      UI.showToast('success', `Draft saved — ${areaCode}. You can continue now or reopen it later from Recent Learning Walks.`);
    } else {
      UI.showToast('success', `Learning Walk submitted — ${areaCode}${newAFIs > 0 ? `. ${newAFIs} AFI${newAFIs !== 1 ? 's' : ''} created.` : ''}`);
    }
  }

  if (mode === 'complete') {
    const areaCodeCopy = areaCode;
    const dateCopy = date;
    const sharedIdCopy = activity.sharedId;
    const afdCopy = [..._lwState.afd];
    _closeLWModal();
    if (escalate) {
      setTimeout(() => openDevObsModal({ areaCode: areaCodeCopy, date: dateCopy, sharedId: sharedIdCopy, prefillLRA: afdCopy }), 300);
    }
  } else if (document.getElementById('lw-recent-list')) {
    _renderRecentLWs();
  }
}

// ── Word export (matches MyWeston section titles for re-keying) ──
function _lwDownloadWord(areaCode, activityId) {
  const record = _lwFindActivity(areaCode, activityId);
  if (!record) {
    if (typeof UI !== 'undefined') UI.showToast('error', 'Learning Walk record not found.');
    return;
  }
  if (typeof window.docx === 'undefined') {
    if (typeof UI !== 'undefined') UI.showToast('error', 'Word library not loaded — cannot generate document.');
    return;
  }
  const docx = window.docx;
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ShadingType, AlignmentType } = docx;
  const l = record.lra || {};
  const area = (window.DPC_DATA.areas.areas || []).find(a => a.areaCode === record.areaCode);
  const deptLabel = area ? `${area.areaName} (${area.areaCode})` : (record.areaCode || '');

  const P = (text, opts = {}) => new Paragraph({
    children: [new TextRun({ text: text || '', size: 22, bold: !!opts.bold })],
    spacing: { after: opts.after != null ? opts.after : 120 },
  });
  const heading = (text) => new Paragraph({
    children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 24 })],
    shading: { type: ShadingType.CLEAR, fill: '1D3557' },
    spacing: { before: 240, after: 160 },
  });
  const cell = (text, bold, widthPct) => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 22, bold: !!bold })] })],
  });
  const kvTable = (pairs) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: pairs.map(([k, v]) => new TableRow({ children: [cell(k, true, 32), cell(v, false, 68)] })),
  });

  const themeList = (ids) => (ids || []).map(id => _lwThemeLabel(id)).join(', ') || '—';

  const detailPairs = [
    ['Academic Year', l.academicYear || ''],
    ['Lecturer/Assessor', l.lecturer || ''],
    ['Observer', l.observer || ''],
    ['Joint Observer', l.jointObserver || ''],
    ['Department', deptLabel],
    ['Division', l.division || ''],
    ['Programme', l.programme || ''],
    ['Date', _lwFmtDate(record.date)],
    ['Time Began', l.timeBegan || ''],
    ['Time Complete', l.timeComplete || ''],
    ['Session Type', l.sessionType || 'Learning Walk'],
    ['Provision', l.provision || ''],
    ['Level', l.level || ''],
    ['Attendance %', l.attendancePct || ''],
    ['LRA Type', l.lraType || 'Learning Walk'],
  ];

  const actionRows = (l.actions || []).filter(a => a.themeId || a.comments || a.when);
  const actionsTable = actionRows.length === 0
    ? [P('—')]
    : [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: [cell('Theme', true, 28), cell('Comments', true, 52), cell('When?', true, 20)] }),
          ...actionRows.map(a => new TableRow({
            children: [
              cell(a.themeId ? _lwThemeLabel(a.themeId) : '', false, 28),
              cell(a.comments || '', false, 52),
              cell(a.when ? _lwFmtDate(a.when) : '', false, 20),
            ],
          })),
        ],
      })];

  const obsParas = (l.observations || record.summary || '')
    .split(/\n+/).filter(Boolean).map(t => P(t));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Learning Review Activity — Learning Walk', bold: true, size: 32, color: '1D3557' })],
          spacing: { after: 240 },
          alignment: AlignmentType.LEFT,
        }),
        heading('LRA Details'),
        kvTable(detailPairs),
        heading('Findings'),
        P('Learning Walk Observations – provide a summary of your observations.', { bold: true }),
        ...(obsParas.length ? obsParas : [P('—')]),
        heading('Themes'),
        P('Positive Findings:', { bold: true, after: 60 }),
        P(themeList(l.positiveFindings)),
        P('Areas for Development:', { bold: true, after: 60 }),
        P(themeList(l.areasForDevelopment)),
        heading('Actions Moving Forwards'),
        ...actionsTable,
        heading('Sign Off'),
        P(`Refer for Instructional Coaching? ${l.referForCoaching ? 'Yes' : 'No'}`),
      ],
    }],
  });

  const safeDate = (record.date || 'undated').replace(/[^0-9-]/g, '');
  Packer.toBlob(doc).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Learning_Walk_${record.areaCode}_${safeDate}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    if (typeof UI !== 'undefined') UI.showToast('success', 'Word document downloaded.');
  }).catch(err => {
    console.error('LW Word export failed:', err);
    if (typeof UI !== 'undefined') UI.showToast('error', 'Word export failed — see console for details.');
  });
}

// ── Small helpers ─────────────────────────────────────────────
function _lwShowError(msg) {
  const el = document.getElementById('lw-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function _lwHideError() {
  const el = document.getElementById('lw-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}
function _lwFmtDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function _lwEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _lwTrapFocus(modalEl) {
  modalEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = modalEl.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const visible = Array.from(focusables).filter(el => el.offsetParent !== null);
    if (visible.length === 0) return;
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}
