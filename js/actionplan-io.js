// DPC Hub · js/actionplan-io.js · v1.0 · September 2026
// Action plan import and export for Current Focus milestones.
//
// One plain-text Markdown format serves as the blank template, the
// export and the import. The file carries every milestone's ID and a
// short {code} on every success criterion and task, so an import can
// change exactly what it names and nothing else:
//   - milestones left out of the file are not touched
//   - inside a milestone, only fields and sections written in the file change
//   - a section heading that is present replaces that whole list
//   - items match by {code} first, then by exact text, so ticks survive
//   - removal is explicit ("Remove: yes") and confirmed
// Nothing is saved until the preview has been read and Apply pressed.
// A backup of the plan as it stood is saved (or downloaded) first, and
// the last import can be undone for the rest of the session.
//
// Loads after js/currentfocus.js (uses _getAllFocuses, _openCFDetail,
// _cfEsc, _CF_STATE_LABEL) and js/export.js (downloadBytes, safeFilename).

const APIO_FORMAT_LINE = 'DPC HUB ACTION PLAN · format v1';

const APIO_STATE_FROM_LABEL = {
  'not started': 'not-started', 'not-started': 'not-started',
  'in progress': 'in-progress', 'in-progress': 'in-progress',
  'at risk':     'at-risk',     'at-risk':     'at-risk',
  'complete':    'complete',    'completed':   'complete', 'done': 'complete',
  'dropped':     'dropped',
};
const APIO_STATE_LABEL = {
  'not-started': 'Not started', 'in-progress': 'In progress',
  'at-risk': 'At risk', 'complete': 'Complete', 'dropped': 'Dropped',
};
const APIO_SECTION_KEY = {
  'success criteria': 'successCriteria', 'criteria': 'successCriteria',
  'tasks': 'tasks', 'task': 'tasks',
  'notes': 'notes', 'note': 'notes',
};
const APIO_SECTION_LABEL = { successCriteria: 'Success criteria', tasks: 'Tasks', notes: 'Notes' };

let _apioParsed = null;   // last parsed file, for the open preview
let _apioDiff   = null;   // last computed diff, for the open preview
let _apioUndo   = null;   // { focusId, milestones, removed, at } for this session only

// ── Ids and codes ───────────────────────────────────────────────
const _APIO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Short, readable code for an id. UUIDs print their first 8 characters;
// anything else prints in full so it can never be ambiguous.
function apioCode(id) {
  const s = String(id || '');
  return _APIO_UUID.test(s) ? s.slice(0, 8) : s;
}

function _apioIdMatches(id, code) {
  const s = String(id || ''), c = String(code || '').trim();
  if (!s || !c) return false;
  if (s === c) return true;
  return _APIO_UUID.test(s) && c.length >= 8 && s.toLowerCase().startsWith(c.toLowerCase());
}

// ── Export ──────────────────────────────────────────────────────
function _apioHeaderComment() {
  return [
    `<!-- ${APIO_FORMAT_LINE}`,
    '',
    'HOW THIS FILE WORKS',
    'The DPC Hub reads this file. Import it from the Action plan tab of the',
    'focus named below. Nothing is saved until you have checked the preview',
    'and pressed Apply.',
    '',
    'RULES',
    '1. Do not change or remove the "Focus ID:" line, any "ID:" line, or the',
    '   {codes} at the end of lines. They tell the Hub what each line is.',
    '2. Milestones left out of this file are not changed. You can send back',
    '   only the milestones you edited.',
    '3. Inside a milestone, only what is written here changes.',
    '   - Leave out "Due:" or "State:" to keep them as they are.',
    '     Write "Due: none" to clear a date.',
    '   - A "### Success criteria", "### Tasks" or "### Notes" section replaces',
    '     that whole list or note. Leave the heading out to keep it as it is.',
    '   - Deleting a line under one of those headings deletes that item.',
    '4. To add a milestone, add a "## Milestone:" block with no "ID:" line.',
    '   To add an item, add a line with no {code}.',
    '5. To reword a milestone or an item, change the words and keep its',
    '   "ID:" line or {code}. Ticks and linked evidence are kept.',
    '6. "- [x]" means done. "- [ ]" means not done.',
    '7. Dates are YYYY-MM-DD, for example 2026-10-09.',
    '8. States: Not started, In progress, At risk, Complete, Dropped.',
    '9. To retire a milestone, prefer "State: Dropped", which keeps its',
    '   history. "Remove: yes" deletes it, and the Hub asks you to confirm.',
    '',
    'FOR CLAUDE, OR ANY ASSISTANT EDITING THIS FILE',
    '- Keep this comment block, the Focus ID line and the Exported line',
    '  exactly as they are.',
    '- Keep every "ID:" line and {code} exactly as given. Never invent one.',
    '  New milestones and new items have none.',
    '- Unless asked for the full plan, return only the milestones you',
    '  changed, each with its "ID:" line.',
    '- When you change a list, return that whole section, keeping the',
    '  {codes} of the items you kept.',
    '- Do not reword anything you were not asked to change.',
    '- Return the result as a single .md file.',
    '',
    'EXAMPLE OF A NEW MILESTONE',
    '## Milestone: Baseline confidence survey',
    'Due: 2026-10-16',
    'State: Not started',
    '',
    '### Success criteria',
    '- [ ] All 10 SEND Leads complete the survey',
    '',
    '### Tasks',
    '- [ ] Send the survey',
    '-->',
  ].join('\n');
}

function _apioItemLine(it) {
  return `- [${it.done ? 'x' : ' '}] ${String(it.text || '').replace(/\s+/g, ' ').trim()} {${apioCode(it.id)}}`;
}

function _apioMilestoneBlock(m) {
  const out = [];
  out.push(`## Milestone: ${String(m.title || '').replace(/\s+/g, ' ').trim()}`);
  out.push(`ID: ${apioCode(m.milestoneId)}`);
  out.push(`Due: ${m.dueDate || 'none'}`);
  out.push(`State: ${APIO_STATE_LABEL[m.state] || 'Not started'}`);
  out.push('');
  out.push('### Success criteria');
  (m.successCriteria || []).forEach(it => out.push(_apioItemLine(it)));
  out.push('');
  out.push('### Tasks');
  (m.tasks || []).forEach(it => out.push(_apioItemLine(it)));
  if (m.notes && String(m.notes).trim()) {
    out.push('');
    out.push('### Notes');
    out.push(String(m.notes).trim());
  }
  return out.join('\n');
}

// blank = true gives the template: header and rules, no milestones.
function apioExportText(focus, blank) {
  const parts = [
    _apioHeaderComment(),
    '',
    `# Action plan: ${String(focus.title || 'Untitled focus').replace(/\s+/g, ' ').trim()}`,
    `Focus ID: ${focus.focusId}`,
    `Exported: ${nowISO()}`,
  ];
  if (!blank) {
    const list = typeof getMilestones === 'function' ? getMilestones(focus) : (focus.milestones || []);
    list.forEach(m => { parts.push(''); parts.push(_apioMilestoneBlock(m)); });
  }
  return parts.join('\n') + '\n';
}

// ── Parse ───────────────────────────────────────────────────────
function _apioParseDate(raw) {
  const s = String(raw || '').trim();
  if (!s || /^(none|no date|-|tbc)$/i.test(s)) return { ok: true, value: null };
  let y, m, d;
  let hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (hit) { y = +hit[1]; m = +hit[2]; d = +hit[3]; }
  else if ((hit = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { d = +hit[1]; m = +hit[2]; y = +hit[3]; }
  else return { ok: false };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return { ok: false };
  return { ok: true, value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

function apioParse(text) {
  const res = { focusId: null, exported: null, milestones: [], errors: [], warnings: [] };
  const src = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  // Blank out comment blocks but keep their line breaks, so line numbers
  // in messages still match the file.
  const body = src.replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ''));
  const lines = body.split('\n');

  let ms = null, section = null;
  const itemRe = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s*)?(.*)$/;

  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();

    // Milestone heading
    let h = t.match(/^##(?!#)\s*(.*)$/);
    if (h) {
      const title = h[1].replace(/^milestone\s*:\s*/i, '').trim();
      if (!title) res.errors.push({ line: n, msg: 'A milestone heading has no title.' });
      ms = { line: n, title, id: null, due: null, state: null, remove: false, sections: {}, notesLines: null };
      res.milestones.push(ms);
      section = null;
      return;
    }
    // Section heading
    h = t.match(/^###(?!#)\s*(.*)$/);
    if (h) {
      if (!ms) { res.warnings.push({ line: n, msg: `"${h[1]}" sits outside any milestone, so it was ignored.` }); section = null; return; }
      const key = APIO_SECTION_KEY[h[1].trim().toLowerCase().replace(/:$/, '')];
      if (!key) { res.errors.push({ line: n, msg: `Unknown section "${h[1].trim()}". Use Success criteria, Tasks or Notes.` }); section = '__skip'; return; }
      if (ms.sections[key] !== undefined) { res.errors.push({ line: n, msg: `"${APIO_SECTION_LABEL[key]}" appears twice in "${ms.title}".` }); section = '__skip'; return; }
      section = key;
      ms.sections[key] = key === 'notes' ? [] : [];
      return;
    }
    // Plan title line
    if (/^#(?!#)/.test(t)) return;

    // Before the first milestone: plan-level keys
    if (!ms) {
      if (!t) return;
      const kv = t.match(/^([A-Za-z ]+):\s*(.*)$/);
      if (kv && /^focus id$/i.test(kv[1].trim())) { res.focusId = kv[2].trim(); return; }
      if (kv && /^exported$/i.test(kv[1].trim())) {
        const d = new Date(kv[2].trim());
        if (isNaN(d.getTime())) res.warnings.push({ line: n, msg: 'The Exported time could not be read, so changes made in the Hub since then cannot be checked.' });
        else res.exported = d.toISOString();
        return;
      }
      res.warnings.push({ line: n, msg: 'Text before the first milestone was ignored.' });
      return;
    }

    if (section === '__skip') return;

    // Notes keep every line as written.
    if (section === 'notes') { ms.sections.notes.push(line); return; }

    // Milestone-level keys (before any section)
    if (!section) {
      if (!t) return;
      const kv = t.match(/^([A-Za-z ]+):\s*(.*)$/);
      const key = kv ? kv[1].trim().toLowerCase() : null;
      if (key === 'id') {
        if (ms.id) res.errors.push({ line: n, msg: `"${ms.title}" has more than one ID line.` });
        ms.id = { value: kv[2].trim(), line: n };
        return;
      }
      if (key === 'due' || key === 'due date') {
        const p = _apioParseDate(kv[2]);
        if (!p.ok) res.errors.push({ line: n, msg: `"${kv[2].trim()}" is not a date. Use YYYY-MM-DD, for example 2026-10-09, or "none".` });
        else ms.due = { value: p.value, line: n };
        return;
      }
      if (key === 'state' || key === 'status') {
        const v = APIO_STATE_FROM_LABEL[kv[2].trim().toLowerCase()];
        if (!v) res.errors.push({ line: n, msg: `"${kv[2].trim()}" is not a state. Use Not started, In progress, At risk, Complete or Dropped.` });
        else ms.state = { value: v, line: n };
        return;
      }
      if (key === 'remove' || key === 'delete') {
        ms.remove = /^(yes|y|true)$/i.test(kv[2].trim());
        return;
      }
      res.warnings.push({ line: n, msg: `Line ignored in "${ms.title}": ${t.slice(0, 60)}` });
      return;
    }

    // Checklist sections
    if (!t) return;
    const im = t.match(itemRe);
    if (!im) { res.warnings.push({ line: n, msg: `Not a list line, so ignored: ${t.slice(0, 60)}` }); return; }
    let txt = im[2].trim();
    let code = null;
    const cm = txt.match(/\s*\{([A-Za-z0-9-]{4,40})\}\s*$/);
    if (cm) { code = cm[1]; txt = txt.slice(0, cm.index).trim(); }
    if (!txt) { res.warnings.push({ line: n, msg: 'An empty list line was ignored.' }); return; }
    ms.sections[section].push({ line: n, text: txt, done: !!(im[1] && im[1].toLowerCase() === 'x'), code });
  });

  // Tidy notes: trim blank lines at either end.
  res.milestones.forEach(m => {
    if (m.sections.notes) {
      const arr = m.sections.notes.slice();
      while (arr.length && !arr[0].trim()) arr.shift();
      while (arr.length && !arr[arr.length - 1].trim()) arr.pop();
      m.sections.notes = arr.join('\n');
    }
  });
  if (!res.milestones.length) res.warnings.push({ line: 0, msg: 'The file has no milestones in it.' });
  return res;
}

// ── Diff ────────────────────────────────────────────────────────
function _apioClone(o) { return JSON.parse(JSON.stringify(o)); }

// Rebuild one checklist from the file. Returns { list, notes[] } and adds
// errors for codes that do not belong to this list.
function _apioMergeList(existing, otherList, parsedItems, label, msTitle, errors) {
  const pool = (existing || []).map(x => ({ ...x, _used: false }));
  const out = [], notes = [];
  parsedItems.forEach(p => {
    let hit = null;
    if (p.code) {
      hit = pool.find(x => _apioIdMatches(x.id, p.code));
      if (!hit) {
        const elsewhere = (otherList || []).some(x => _apioIdMatches(x.id, p.code));
        errors.push({ line: p.line, msg: elsewhere
          ? `{${p.code}} belongs to the other list in "${msTitle}". Move items in the Hub, or delete the code to add it as a new item.`
          : `{${p.code}} is not an item in "${msTitle}" ${label}. Delete the code to add it as a new item.` });
        return;
      }
      if (hit._used) { errors.push({ line: p.line, msg: `{${p.code}} is used twice in "${msTitle}" ${label}.` }); return; }
    } else {
      hit = pool.find(x => !x._used && x.text === p.text) || null;
    }
    if (hit) {
      hit._used = true;
      if (hit.text !== p.text) notes.push(`Reworded: "${hit.text}" → "${p.text}"`);
      if (!!hit.done !== p.done) notes.push(`${p.done ? 'Ticked' : 'Unticked'}: "${p.text}"`);
      out.push({ id: hit.id, text: p.text, done: p.done });
    } else {
      const it = typeof makeCheckItem === 'function' ? makeCheckItem(p.text) : { id: generateId(), text: p.text, done: false };
      it.done = p.done;
      notes.push(`Added: "${p.text}"${p.done ? ' (done)' : ''}`);
      out.push(it);
    }
  });
  pool.filter(x => !x._used).forEach(x => notes.push(`Removed: "${x.text}"`));
  const before = (existing || []).map(x => x.id).join('|');
  const after  = out.map(x => x.id).join('|');
  if (!notes.length && before !== after) notes.push('Reordered');
  return { list: out, notes };
}

function apioDiff(focus, parsed) {
  const errors = parsed.errors.slice(), warnings = parsed.warnings.slice();
  const entries = [];
  const existing = (focus.milestones || []);

  if (parsed.focusId && !_apioIdMatches(focus.focusId, parsed.focusId) && parsed.focusId !== focus.focusId) {
    errors.unshift({ line: 0, msg: `This file belongs to a different focus (Focus ID ${parsed.focusId}). Open that focus to import it.` });
    return { errors, warnings, entries, untouched: existing.length };
  }
  if (!parsed.focusId) warnings.push({ line: 0, msg: 'The file has no Focus ID, so it is being applied to the focus you have open.' });

  const claimed = new Set();
  parsed.milestones.forEach(pm => {
    let m = null, matchedBy = null;
    if (pm.id) {
      const hits = existing.filter(x => _apioIdMatches(x.milestoneId, pm.id.value));
      if (hits.length === 0) { errors.push({ line: pm.id.line, msg: `ID ${pm.id.value} ("${pm.title}") is not a milestone in this focus. Delete the ID line to add it as new.` }); return; }
      if (hits.length > 1)   { errors.push({ line: pm.id.line, msg: `ID ${pm.id.value} matches more than one milestone.` }); return; }
      m = hits[0]; matchedBy = 'id';
    } else if (pm.title) {
      const hits = existing.filter(x => String(x.title || '').trim().toLowerCase() === pm.title.toLowerCase());
      if (hits.length === 1) {
        m = hits[0]; matchedBy = 'title';
        warnings.push({ line: pm.line, msg: `"${pm.title}" has no ID, so it was matched to the existing milestone with the same title.` });
      }
    }
    if (m && claimed.has(m.milestoneId)) { errors.push({ line: pm.line, msg: `"${m.title}" appears more than once in the file.` }); return; }
    if (m) claimed.add(m.milestoneId);

    // Removal
    if (pm.remove) {
      if (!m) { errors.push({ line: pm.line, msg: `"${pm.title}" is marked for removal but is not in this focus.` }); return; }
      entries.push({ kind: 'remove', line: pm.line, milestone: m, title: m.title, notes: [], conflict: false });
      return;
    }

    // New milestone
    if (!m) {
      if (!pm.title) return;
      const local = [];
      const sc = _apioMergeList([], null, pm.sections.successCriteria || [], 'success criteria', pm.title, errors);
      const tk = _apioMergeList([], null, pm.sections.tasks || [], 'tasks', pm.title, errors);
      const rec = makeMilestone({
        title: pm.title,
        dueDate: pm.due ? pm.due.value : null,
        state: pm.state ? pm.state.value : 'not-started',
        successCriteria: sc.list, tasks: tk.list,
        notes: pm.sections.notes || '',
      });
      if (rec.state === 'complete') rec.completedDate = todayISO();
      if (rec.dueDate) local.push(`Due ${_cfFmtDate(rec.dueDate)}`);
      local.push(`State: ${APIO_STATE_LABEL[rec.state]}`);
      if (sc.list.length) local.push(`${sc.list.length} success criteri${sc.list.length === 1 ? 'on' : 'a'}`);
      if (tk.list.length) local.push(`${tk.list.length} task${tk.list.length === 1 ? '' : 's'}`);
      if (rec.notes) local.push('Notes');
      entries.push({ kind: 'new', line: pm.line, next: rec, title: rec.title, notes: local, conflict: false });
      return;
    }

    // Changed or unchanged
    const next = _apioClone(m);
    const notes = [];
    if (pm.title && pm.title !== m.title) { next.title = pm.title; notes.push(`Title: "${m.title}" → "${pm.title}"`); }
    if (pm.due && (pm.due.value || null) !== (m.dueDate || null)) {
      next.dueDate = pm.due.value;
      notes.push(`Due: ${m.dueDate ? _cfFmtDate(m.dueDate) : 'none'} → ${pm.due.value ? _cfFmtDate(pm.due.value) : 'none'}`);
    }
    if (pm.state && pm.state.value !== (m.state || 'not-started')) {
      next.state = pm.state.value;
      notes.push(`State: ${APIO_STATE_LABEL[m.state] || 'Not started'} → ${APIO_STATE_LABEL[pm.state.value]}`);
      if (pm.state.value === 'complete') next.completedDate = m.completedDate || todayISO();
      else next.completedDate = null;
    }
    ['successCriteria', 'tasks'].forEach(k => {
      if (pm.sections[k] === undefined) return;
      const other = k === 'tasks' ? m.successCriteria : m.tasks;
      const r = _apioMergeList(m[k], other, pm.sections[k], APIO_SECTION_LABEL[k].toLowerCase(), m.title, errors);
      next[k] = r.list;
      r.notes.forEach(x => notes.push(`${APIO_SECTION_LABEL[k]}: ${x}`));
    });
    if (pm.sections.notes !== undefined && pm.sections.notes !== String(m.notes || '').trim()) {
      next.notes = pm.sections.notes;
      notes.push(pm.sections.notes ? 'Notes updated' : 'Notes cleared');
    }
    if (!notes.length) { entries.push({ kind: 'unchanged', line: pm.line, milestone: m, title: m.title, notes: [], conflict: false }); return; }

    const conflict = !!(parsed.exported && m.lastUpdated && new Date(m.lastUpdated) > new Date(parsed.exported));
    entries.push({ kind: 'change', line: pm.line, milestone: m, next, title: next.title, notes, conflict, matchedBy });
  });

  const untouched = existing.filter(x => !claimed.has(x.milestoneId)).length;
  return { errors, warnings, entries, untouched };
}

// ── Apply ───────────────────────────────────────────────────────
function apioApply(focus, diff, allowConflictIds) {
  const allow = allowConflictIds || new Set();
  const snapshot = _apioClone(focus.milestones || []);
  const done = { added: 0, changed: 0, removed: 0, skipped: 0 };
  diff.entries.forEach(e => {
    if (e.kind === 'new') { saveMilestone(focus, e.next); done.added++; return; }
    if (e.kind === 'change') {
      if (e.conflict && !allow.has(e.milestone.milestoneId)) { done.skipped++; return; }
      saveMilestone(focus, e.next); done.changed++; return;
    }
    if (e.kind === 'remove') { deleteMilestone(focus, e.milestone.milestoneId); done.removed++; }
  });
  return { done, snapshot };
}

// ── UI ──────────────────────────────────────────────────────────
function apioRenderControls(f) {
  const undo = _apioUndo && _apioUndo.focusId === f.focusId;
  return `
    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:var(--space-sm);">
      <button id="apio-export-btn" type="button" class="btn btn--ghost btn--sm">Export plan</button>
      <button id="apio-import-btn" type="button" class="btn btn--ghost btn--sm" aria-expanded="false" aria-controls="apio-panel">Import plan</button>
      <button id="apio-template-btn" type="button" class="btn btn--ghost btn--sm">Blank template</button>
      ${undo ? `<button id="apio-undo-btn" type="button" class="btn btn--secondary btn--sm">Undo last import</button>` : ''}
    </div>
    <div id="apio-panel" style="display:none;background:var(--color-light);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <h4 style="font-size:var(--text-sm);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">Import an action plan</h4>
      <p style="font-size:var(--text-sm);margin-bottom:var(--space-sm);">Choose a plan file or paste its text. You will see every change before anything is saved.</p>
      <div class="form-group">
        <label class="form-label" for="apio-file">Plan file (.md or .txt)</label>
        <input class="form-input" type="file" id="apio-file" accept=".md,.markdown,.txt,text/markdown,text/plain">
      </div>
      <div class="form-group">
        <label class="form-label form-label--optional" for="apio-text">Or paste the plan text</label>
        <textarea class="form-input" id="apio-text" rows="6" spellcheck="false" style="font-family:monospace;"></textarea>
      </div>
      <div class="btn-row">
        <button id="apio-check-btn" type="button" class="btn btn--primary btn--sm">Check changes</button>
        <button id="apio-cancel-btn" type="button" class="btn btn--secondary btn--sm">Cancel</button>
      </div>
      <div id="apio-preview" style="margin-top:var(--space-md);"></div>
    </div>
    <p id="apio-status" role="status" aria-live="polite" class="sr-only"></p>`;
}

function _apioSay(msg) {
  const st = document.getElementById('apio-status') || document.getElementById('cf-ms-status');
  if (st) { st.textContent = ''; setTimeout(() => { st.textContent = msg; }, 50); }
}

function _apioFocus(focusId) { return _getAllFocuses().find(x => x.focusId === focusId) || null; }

function _apioStamp() {
  const d = new Date();
  return `${todayISO()} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function _apioDownloadText(text, name) {
  downloadBytes(new TextEncoder().encode(text), name, 'text/markdown;charset=utf-8');
}

function apioWire(focusId) {
  const panel = document.getElementById('apio-panel');
  const imp   = document.getElementById('apio-import-btn');
  if (!panel || !imp) return;

  const setOpen = (open) => {
    panel.style.display = open ? 'block' : 'none';
    imp.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) document.getElementById('apio-file')?.focus();
  };

  document.getElementById('apio-export-btn')?.addEventListener('click', () => {
    const f = _apioFocus(focusId); if (!f) return;
    _apioDownloadText(apioExportText(f, false), safeFilename(`${f.title} action plan ${_apioStamp()}`, 'md'));
    _apioSay('Action plan exported to your downloads.');
  });
  document.getElementById('apio-template-btn')?.addEventListener('click', () => {
    const f = _apioFocus(focusId); if (!f) return;
    _apioDownloadText(apioExportText(f, true), safeFilename(`${f.title} action plan template`, 'md'));
    _apioSay('Blank template downloaded.');
  });
  imp.addEventListener('click', () => setOpen(panel.style.display === 'none'));
  document.getElementById('apio-cancel-btn')?.addEventListener('click', () => {
    _apioParsed = null; _apioDiff = null;
    document.getElementById('apio-preview').innerHTML = '';
    setOpen(false); imp.focus();
  });
  document.getElementById('apio-file')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      document.getElementById('apio-text').value = await file.text();
      _apioSay(`${file.name} loaded. Press Check changes.`);
    } catch {
      _apioSay('That file could not be read.');
    }
  });
  document.getElementById('apio-check-btn')?.addEventListener('click', () => _apioCheck(focusId));
  document.getElementById('apio-undo-btn')?.addEventListener('click', () => _apioUndoLast(focusId));
}

function _apioCheck(focusId) {
  const f = _apioFocus(focusId); if (!f) return;
  const text = document.getElementById('apio-text').value;
  const box  = document.getElementById('apio-preview');
  if (!text.trim()) {
    box.innerHTML = `<p role="alert" style="color:var(--color-red);font-size:var(--text-sm);">Choose a file or paste the plan text first.</p>`;
    return;
  }
  _apioParsed = apioParse(text);
  _apioDiff   = apioDiff(f, _apioParsed);
  box.innerHTML = _apioRenderPreview(_apioDiff);
  document.getElementById('apio-preview-heading')?.focus();
  document.getElementById('apio-apply-btn')?.addEventListener('click', () => _apioApplyClick(focusId));
  document.getElementById('apio-preview-cancel')?.addEventListener('click', () => {
    box.innerHTML = ''; _apioDiff = null; document.getElementById('apio-check-btn')?.focus();
  });
}

function _apioLine(n) { return n ? `Line ${n}: ` : ''; }

function _apioRenderPreview(d) {
  const esc = _cfEsc;
  const by = k => d.entries.filter(e => e.kind === k);
  const nw = by('new'), ch = by('change'), rm = by('remove'), un = by('unchanged');
  const actionable = nw.length + ch.length + rm.length;
  const blocked = d.errors.length > 0;

  const card = (e, badge) => `
    <li style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-sm);background:var(--color-white);">
      <p style="font-weight:bold;margin-bottom:4px;"><span style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.03em;margin-right:6px;">${badge}</span>${esc(e.title)}</p>
      ${e.conflict ? `
        <p style="font-size:var(--text-sm);color:var(--color-amber);margin-bottom:4px;"><strong>Changed in the Hub since this file was exported.</strong> The Hub version is kept unless you tick below.</p>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <input type="checkbox" id="apio-cf-${esc(e.milestone.milestoneId)}" class="apio-conflict" data-ms="${esc(e.milestone.milestoneId)}" style="width:20px;height:20px;">
          <label for="apio-cf-${esc(e.milestone.milestoneId)}" style="font-size:var(--text-sm);">Apply the file's version of "${esc(e.title)}" anyway</label>
        </div>` : ''}
      ${e.notes.length ? `<ul style="font-size:var(--text-sm);padding-left:1.2em;margin:0;">${e.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </li>`;

  const section = (title, list, badge) => list.length ? `
    <h5 style="font-size:var(--text-sm);font-weight:bold;margin:var(--space-sm) 0 var(--space-xs);">${title} (${list.length})</h5>
    <ul style="list-style:none;padding:0;margin:0;">${list.map(e => card(e, badge)).join('')}</ul>` : '';

  return `
    <h4 id="apio-preview-heading" tabindex="-1" style="font-size:var(--text-base);font-weight:bold;color:var(--color-navy);margin-bottom:var(--space-xs);">Check before applying</h4>
    <p style="font-size:var(--text-sm);margin-bottom:var(--space-sm);">
      ${nw.length} new, ${ch.length} changed, ${rm.length} to remove, ${un.length} unchanged.
      ${d.untouched} milestone${d.untouched === 1 ? '' : 's'} not in the file will be left as ${d.untouched === 1 ? 'it is' : 'they are'}.
    </p>
    ${blocked ? `
      <div role="alert" class="banner banner--red" style="padding:var(--space-sm) var(--space-md);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
        <p style="font-weight:bold;margin-bottom:4px;">Fix ${d.errors.length === 1 ? 'this problem' : `these ${d.errors.length} problems`} in the file, then check again. Nothing has been saved.</p>
        <ul style="font-size:var(--text-sm);padding-left:1.2em;margin:0;">${d.errors.map(x => `<li>${esc(_apioLine(x.line) + x.msg)}</li>`).join('')}</ul>
      </div>` : ''}
    ${d.warnings.length ? `
      <div class="banner banner--amber" style="padding:var(--space-sm) var(--space-md);border-radius:var(--radius-md);margin-bottom:var(--space-sm);">
        <p style="font-weight:bold;margin-bottom:4px;">For your information</p>
        <ul style="font-size:var(--text-sm);padding-left:1.2em;margin:0;">${d.warnings.map(x => `<li>${esc(_apioLine(x.line) + x.msg)}</li>`).join('')}</ul>
      </div>` : ''}
    ${section('New milestones', nw, 'New')}
    ${section('Changed milestones', ch, 'Changed')}
    ${section('Milestones to remove', rm, 'Remove')}
    ${un.length ? `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-top:var(--space-sm);">Unchanged: ${un.map(e => esc(e.title)).join('; ')}.</p>` : ''}
    <div class="btn-row" style="margin-top:var(--space-md);">
      <button id="apio-apply-btn" type="button" class="btn btn--primary btn--sm" ${blocked || !actionable ? 'disabled aria-disabled="true"' : ''}>Apply ${actionable} change${actionable === 1 ? '' : 's'}</button>
      <button id="apio-preview-cancel" type="button" class="btn btn--secondary btn--sm">Back</button>
    </div>
    ${!blocked && !actionable ? '<p style="font-size:var(--text-sm);margin-top:var(--space-xs);">There is nothing to apply.</p>' : ''}`;
}

async function _apioApplyClick(focusId) {
  const f = _apioFocus(focusId);
  const d = _apioDiff;
  if (!f || !d || d.errors.length) return;

  const rm = d.entries.filter(e => e.kind === 'remove');
  if (rm.length) {
    const names = rm.map(e => `• ${e.title}`).join('\n');
    if (!window.confirm(`This import deletes ${rm.length} milestone${rm.length === 1 ? '' : 's'}:\n\n${names}\n\nLinked activities keep their focus link and lose only the milestone link. Continue?`)) return;
  }

  // Backup first: into the connected folder if there is one, otherwise a download.
  const backupName = safeFilename(`${f.title} action plan backup ${_apioStamp()}`, 'md');
  const backupText = apioExportText(f, false);
  let backupWhere = '';
  try {
    if (typeof hasFolderAccess === 'function' && hasFolderAccess()) {
      backupWhere = await saveBytesToFolder(backupName, new TextEncoder().encode(backupText), 'Action plan backups');
    } else {
      _apioDownloadText(backupText, backupName);
      backupWhere = 'your downloads';
    }
  } catch (err) {
    if (!window.confirm('The backup could not be saved. Apply the import without a backup file? You can still undo it during this session.')) return;
  }

  const allow = new Set([...document.querySelectorAll('.apio-conflict:checked')].map(cb => cb.dataset.ms));
  const { done, snapshot } = apioApply(f, d, allow);
  _apioUndo = { focusId, milestones: snapshot, removed: done.removed, at: nowISO() };
  _apioParsed = null; _apioDiff = null;

  _openCFDetail(focusId);
  const bits = [];
  if (done.added)   bits.push(`${done.added} added`);
  if (done.changed) bits.push(`${done.changed} changed`);
  if (done.removed) bits.push(`${done.removed} removed`);
  if (done.skipped) bits.push(`${done.skipped} kept as in the Hub`);
  const msg = `Import applied: ${bits.join(', ') || 'no changes'}.${backupWhere ? ` Backup saved to ${backupWhere}.` : ''}`;
  if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('success', msg);
  _apioSay(msg);
}

function _apioUndoLast(focusId) {
  const f = _apioFocus(focusId);
  if (!f || !_apioUndo || _apioUndo.focusId !== focusId) return;
  const warn = _apioUndo.removed
    ? '\n\nMilestones removed by the import come back, but activities that were linked to them stay linked to the focus only.'
    : '';
  if (!window.confirm(`Put the action plan back as it was before the last import?${warn}`)) return;
  f.milestones = _apioClone(_apioUndo.milestones);
  saveCurrentFocus(f);
  _apioUndo = null;
  _openCFDetail(focusId);
  _apioSay('Last import undone. The action plan is back as it was.');
}
