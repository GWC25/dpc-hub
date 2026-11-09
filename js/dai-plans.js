// DPC Hub · js/dai-plans.js · v1.1 · 09/11/26 · evidence on actions, milestones and the plan (dai-evidence.js); evidence count in the overview
// v1.0 · 09/11/26 · Area Action Plans from the Heads of Area Forms export: import, area tab, college overview, status tracking
//
// The Area Action Plan form is completed by each Head of Area. It is
// imported with the DA&I exports ("Check the Data folder" on the DA&I
// progress page) and stored in data-dai.json:
//   plans:      every submission, newest kept alongside earlier versions
//   planStatus: Graeme's tracking, keyed "AREA|action:<id>" or "AREA|m<n>",
//               so a resubmitted plan keeps the status already recorded
//
// Public: daiPlanParse(head, rows, fileName), daiPlanKey(p), daiPlanLatest(areaCode),
//         daiPlanRenderAreaTab(panel, areaCode), daiPlansOverviewHTML(),
//         daiPlansWire(root), DAI_PLAN_ACTIONS

const DAI_PLAN_ACTIONS = Object.freeze([
  { id: 'checker',   label: 'Accessibility Checker', prefix: 'accessibility checker' },
  { id: 'immersive', label: 'Immersive Reader',      prefix: 'immersive reader' },
  { id: 'p1',        label: 'Priority 1',            prefix: 'priority 1' },
  { id: 'p2',        label: 'Priority 2',            prefix: 'priority 2' },
]);
const DAI_ACTION_STATUS = Object.freeze(['Not started', 'In progress', 'Done']);
const DAI_MILESTONE_STATUS = Object.freeze(['Not due yet', 'On track', 'At risk', 'Met', 'Missed']);

function _dplStore() {
  const d = _daiStore();
  if (!d.plans) d.plans = [];
  if (!d.planStatus) d.planStatus = {};
  return d;
}

// ── Parse ─────────────────────────────────────────────────────
function daiPlanParse(head, rows, fileName) {
  const c = _daiCols(head);
  const idC = c.eq('id'), doneC = c.eq('completion time', 'start time'), emailC = c.eq('email'), nameC = c.eq('name');
  const col = p => c.starts(p);
  const cols = {
    area: col('curriculum area and code'), hoa: col('head of area initials'), dl: col('digital lead initials'),
    dated: col('date completed'), position: col('health check position'), well: col('what we already do well'),
    gaps: col('our biggest gaps'), next: col('which are you taking next'),
    fixed: col('resources your team has fixed'), blockers: col('what is stopping you'),
    support: col('what support would help'), qip: col('has the plan been added to your qip'),
  };
  const part = (prefix, what) => c.starts(`${prefix}: ${what}`);
  return rows.filter(r => _daiCell(r, idC) != null && _daiCell(r, idC) !== '').map(r => {
    const t = i => _daiText(_daiCell(r, i));
    const fixedLines = t(cols.fixed).split('\n').map(x => x.trim()).filter(Boolean).map(line => {
      const bits = line.split(/\s*[,;]\s*|\s+[–-]\s+/);
      return bits.length >= 3 ? { initials: bits[0], resource: bits[1], fix: bits.slice(2).join(', '), line } : { initials: '', resource: '', fix: '', line };
    });
    const dateC = _daiCell(r, cols.dated);
    return {
      source: 'plan', fileName,
      formId: String(_daiCell(r, idC)),
      when: _daiWhen(_daiCell(r, doneC)),
      email: t(emailC).toLowerCase(), name: t(nameC),
      areaRaw: t(cols.area),
      hoaInitials: t(cols.hoa), dlInitials: t(cols.dl),
      dateCompleted: _daiWhen(dateC) ? _daiWhen(dateC).slice(0, 10) : t(cols.dated),
      position: t(cols.position), strengths: t(cols.well), gaps: t(cols.gaps), takingNext: t(cols.next),
      actions: DAI_PLAN_ACTIONS.map(a => ({ id: a.id, where: t(part(a.prefix, 'where we are now')), what: t(part(a.prefix, 'what we will do')), how: t(part(a.prefix, 'how we will know')) })),
      milestones: [1, 2, 3].map(n => {
        const raw = _daiCell(r, part(`milestone ${n}`, 'date'));
        const iso = _daiWhen(raw);
        return { n, date: iso ? iso.slice(0, 10) : '', dateText: iso ? '' : _daiText(raw), willBeTrue: t(part(`milestone ${n}`, 'what will be true')), evidence: t(part(`milestone ${n}`, 'the evidence')) };
      }),
      fixed: fixedLines,
      blockers: t(cols.blockers), support: t(cols.support), qip: t(cols.qip),
    };
  });
}
function daiPlanKey(p) { return ['plan', p.formId, p.email, p.when || ''].join('|'); }

// Called from _daiApply with the plans Graeme approved.
function daiPlanSave(fresh) {
  const store = _dplStore();
  fresh.forEach(p => store.plans.push({ ...p, areaCode: _daiResolveArea(p.areaRaw), importedAt: nowISO() }));
  return fresh.length;
}

function _dplForArea(areaCode) {
  return _dplStore().plans.filter(p => p.areaCode === areaCode).sort((a, b) => (b.when || '').localeCompare(a.when || ''));
}
function daiPlanLatest(areaCode) { return _dplForArea(areaCode)[0] || null; }

// ── Status ────────────────────────────────────────────────────
function _dplStatus(areaCode, key) { return _dplStore().planStatus[`${areaCode}|${key}`] || {}; }
function _dplSetStatus(areaCode, key, patch) {
  const st = _dplStore().planStatus;
  const k = `${areaCode}|${key}`;
  st[k] = { ...(st[k] || {}), ...patch, updated: nowISO() };
  if (typeof saveDAIData === 'function') saveDAIData();
}
function _dplMilestoneState(areaCode, m) {
  const s = _dplStatus(areaCode, 'm' + m.n).status;
  if (s) return s;
  return m.date && m.date < todayISO() ? 'Past date, not recorded' : 'Not due yet';
}
function _dplDaysTo(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
}

// ── Area tab ──────────────────────────────────────────────────
const _dplH = (lvl, t, id) => `<h${lvl}${id ? ` id="${id}"` : ''} style="font-size:var(--text-${lvl === 3 ? 'lg' : 'base'});font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-xs);">${t}</h${lvl}>`;
const _dplText = (t, empty) => t ? `<p style="font-size:var(--text-sm);white-space:pre-line;max-width:80ch;">${_daiEsc(t)}</p>` : `<p style="font-size:var(--text-sm);color:var(--color-muted);">${empty || 'Not answered.'}</p>`;
function _dplSelect(id, label, options, value, data) {
  return `<label class="sr-only" for="${id}">${_daiEsc(label)}</label><select id="${id}" class="form-select" ${data} style="min-height:36px;font-size:var(--text-sm);max-width:200px;">
    ${options.map(o => `<option value="${_daiEsc(o)}"${o === value ? ' selected' : ''}>${_daiEsc(o)}</option>`).join('')}</select>`;
}

function daiPlanRenderAreaTab(panel, areaCode) {
  const versions = _dplForArea(areaCode);
  const p = versions[0];
  const areaName = _daiAreaName(areaCode);
  if (!p) {
    panel.innerHTML = `${_dplH(3, 'DA&amp;I Area Action Plan')}<p style="font-size:var(--text-sm);color:var(--color-muted);max-width:70ch;">No Area Action Plan imported for ${_daiEsc(areaName)} yet. When the Head of Area submits the form, save the export into the Data folder and use "Check the Data folder" on the DA&amp;I progress page. You can still record evidence for the area below.</p>${_dplConfidence(areaCode)}${typeof daiEvidenceSection === 'function' ? daiEvidenceSection(areaCode, null) : ''}<p id="dpl-status-msg" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-teal);min-height:1.5em;margin-top:var(--space-md);"></p>`;
    if (typeof daiEvidenceWire === 'function') daiEvidenceWire(panel, areaCode, null, () => daiPlanRenderAreaTab(panel, areaCode));
    return;
  }
  const meta = [
    p.dateCompleted ? `Completed ${_daiFmtDate(p.dateCompleted) || _daiEsc(p.dateCompleted)}` : (p.when ? `Submitted ${_daiFmtDate(p.when)}` : ''),
    p.hoaInitials ? `Head of Area ${_daiEsc(p.hoaInitials)}` : '', p.dlInitials ? `Digital Lead ${_daiEsc(p.dlInitials)}` : '',
  ].filter(Boolean).join(' · ');

  const actRows = DAI_PLAN_ACTIONS.map(a => {
    const x = p.actions.find(y => y.id === a.id) || {};
    if (!x.where && !x.what && !x.how) return '';
    const st = _dplStatus(areaCode, 'action:' + a.id);
    return `<tr>${_daiTd(`<strong>${_daiEsc(a.label)}</strong>`)}${_daiTd(_daiEsc(x.where), 'white-space:pre-line;')}${_daiTd(_daiEsc(x.what), 'white-space:pre-line;')}${_daiTd(_daiEsc(x.how), 'white-space:pre-line;')}
      ${_daiTd(_dplSelect(`dpl-a-${a.id}`, `${a.label} progress`, DAI_ACTION_STATUS, st.status || 'Not started', `data-dpl-status="action:${a.id}" data-dpl-area="${_daiEsc(areaCode)}"`))}
      ${_daiTd(typeof daiEvidenceCell === 'function' ? daiEvidenceCell(areaCode, 'action:' + a.id, a.label) : '')}</tr>`;
  }).filter(Boolean);

  const msRows = p.milestones.filter(m => m.date || m.dateText || m.willBeTrue).map(m => {
    const st = _dplStatus(areaCode, 'm' + m.n);
    const days = _dplDaysTo(m.date);
    const when = m.date ? `${_daiFmtDate(m.date)}${days != null ? `<br><span style="color:var(--color-muted);">${days < 0 ? `${-days} days ago` : days === 0 ? 'today' : `in ${days} days`}</span>` : ''}` : _daiEsc(m.dateText || 'No date');
    return `<tr>${_daiTd(`<strong>${m.n}</strong>`)}${_daiTd(when)}${_daiTd(_daiEsc(m.willBeTrue), 'white-space:pre-line;')}${_daiTd(_daiEsc(m.evidence), 'white-space:pre-line;')}
      ${_daiTd(`${_dplSelect(`dpl-m-${m.n}`, `Milestone ${m.n} status`, DAI_MILESTONE_STATUS, st.status || 'Not due yet', `data-dpl-status="m${m.n}" data-dpl-area="${_daiEsc(areaCode)}"`)}
        <label class="sr-only" for="dpl-mn-${m.n}">Milestone ${m.n} note</label><input id="dpl-mn-${m.n}" type="text" class="form-input" placeholder="Note" value="${_daiEsc(st.note || '')}" data-dpl-note="m${m.n}" data-dpl-area="${_daiEsc(areaCode)}" style="margin-top:4px;min-height:36px;font-size:var(--text-sm);max-width:200px;">`)}
      ${_daiTd(typeof daiEvidenceCell === 'function' ? daiEvidenceCell(areaCode, 'm' + m.n, `milestone ${m.n}`) : '')}</tr>`;
  });

  const fixed = p.fixed.length ? `<ul style="margin:0 0 0 var(--space-lg);font-size:var(--text-sm);">${p.fixed.map(f => `<li>${f.resource ? `<strong>${_daiEsc(f.resource)}</strong>${f.initials ? ` (${_daiEsc(f.initials)})` : ''}: ${_daiEsc(f.fix)}` : _daiEsc(f.line)}</li>`).join('')}</ul>` : _dplText('', 'None listed yet.');

  panel.innerHTML = `
    ${_dplH(3, 'DA&amp;I Area Action Plan')}
    <p style="font-size:var(--text-sm);color:var(--color-slate);">${meta}</p>
    ${p.position ? `<p style="font-size:var(--text-sm);margin-top:var(--space-xs);"><strong>Health check position:</strong> ${_daiEsc(p.position)}</p>` : ''}
    <p style="font-size:var(--text-sm);margin-top:var(--space-xs);"><strong>Added to the QIP and shared with TLAM and staff:</strong> ${_daiEsc(p.qip || 'Not answered')}</p>
    ${_dplConfidence(areaCode)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-lg);">
      <div>${_dplH(4, 'What we already do well')}${_dplText(p.strengths)}</div>
      <div>${_dplH(4, 'Our biggest gaps')}${_dplText(p.gaps)}</div>
    </div>
    ${_dplH(4, 'Actions')}
    ${p.takingNext ? `<p style="font-size:var(--text-sm);margin-bottom:var(--space-sm);"><strong>Taking next:</strong> ${_daiEsc(p.takingNext)}</p>` : ''}
    ${actRows.length ? _daiTable(`${areaName} action plan`, ['Focus', 'Where we are now', 'What we will do', 'How we will know', 'Progress', 'Evidence'], actRows, 1040) : _dplText('', 'No actions completed on the form.')}
    ${_dplH(4, 'Milestones')}
    ${msRows.length ? _daiTable(`${areaName} milestones`, ['', 'Date', 'What will be true', 'The evidence (HoA)', 'Status', 'Your evidence'], msRows, 1000) : _dplText('', 'No milestones set.')}
    ${_dplH(4, `Resources the team has fixed (${p.fixed.length})`)}${fixed}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-lg);">
      <div>${_dplH(4, 'What is stopping us, and who could unblock it')}${_dplText(p.blockers)}</div>
      <div>${_dplH(4, 'Support that would help')}${_dplText(p.support)}</div>
    </div>
    ${typeof daiEvidenceSection === 'function' ? daiEvidenceSection(areaCode, p) : ''}
    <p id="dpl-status-msg" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-teal);min-height:1.5em;margin-top:var(--space-md);"></p>
    ${versions.length > 1 ? `<details style="margin-top:var(--space-md);"><summary style="cursor:pointer;font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);min-height:24px;">Earlier versions (${versions.length - 1})</summary>
      <ul style="margin:var(--space-xs) 0 0 var(--space-lg);font-size:var(--text-sm);">${versions.slice(1).map(v => `<li>${_daiFmtDate(v.when) || 'Undated'}${v.hoaInitials ? `, ${_daiEsc(v.hoaInitials)}` : ''}: taking next ${_daiEsc(v.takingNext || 'not given')}, ${v.fixed.length} resources fixed</li>`).join('')}</ul></details>` : ''}`;
  daiPlansWire(panel);
  if (typeof daiEvidenceWire === 'function') daiEvidenceWire(panel, areaCode, p, () => daiPlanRenderAreaTab(panel, areaCode));
}

// Staff confidence for the area, so the plan sits next to the people evidence.
function _dplConfidence(areaCode) {
  if (!_daiStore().responses.length) return '';
  const a = _daiCompute().areas.find(x => x.code === areaCode);
  if (!a) return `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-top:var(--space-sm);">No DA&amp;I responses from this area yet.</p>`;
  return `<div style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-top:var(--space-md);background:var(--color-light);font-size:var(--text-sm);">
    <strong>Staff confidence in this area:</strong> ${a.registered} registered, ${a.reflections} "How's it going" returns. Before ${_daiFmt(a.before)} of 5, after ${_daiFmt(a.after)} of 5.${a.weakest ? ` Weakest element: <strong>${_daiEsc(a.weakest)}</strong>.` : ''}
  </div>`;
}

function daiPlansWire(root) {
  root.querySelectorAll('[data-dpl-status]').forEach(sel => sel.addEventListener('change', () => {
    _dplSetStatus(sel.dataset.dplArea, sel.dataset.dplStatus, { status: sel.value });
    const msg = document.getElementById('dpl-status-msg'); if (msg) msg.textContent = 'Progress saved.';
  }));
  root.querySelectorAll('[data-dpl-note]').forEach(inp => inp.addEventListener('change', () => {
    _dplSetStatus(inp.dataset.dplArea, inp.dataset.dplNote, { note: inp.value.trim() });
    const msg = document.getElementById('dpl-status-msg'); if (msg) msg.textContent = 'Note saved.';
  }));
}

// ── College overview (DA&I progress tab) ─────────────────────
function daiPlansOverviewHTML() {
  const areas = _daiAreaList().slice().sort((a, b) => a.areaName.localeCompare(b.areaName));
  const rows = areas.map(a => ({ a, p: daiPlanLatest(a.areaCode) }));
  const got = rows.filter(x => x.p);
  const qipYes = got.filter(x => /^\s*yes/i.test(x.p.qip || '')).length;
  const fixedTotal = got.reduce((n, x) => n + x.p.fixed.length, 0);
  const upcoming = [], concerns = [];
  got.forEach(({ a, p }) => p.milestones.forEach(m => {
    const state = _dplMilestoneState(a.areaCode, m);
    const days = _dplDaysTo(m.date);
    if (days != null && days >= 0 && days <= 14 && state !== 'Met') upcoming.push({ a, m, days });
    if (state === 'At risk' || state === 'Missed' || state === 'Past date, not recorded') concerns.push({ a, m, state });
  }));

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-xl);">
    ${_daiKPI(`${got.length} of ${areas.length}`, 'Plans submitted', 'Latest version per area')}
    ${_daiKPI(qipYes, 'In the QIP and shared', 'Answered yes on the form')}
    ${_daiKPI(fixedTotal, 'Resources fixed', 'Listed by teams on their plans')}
    ${_daiKPI(upcoming.length, 'Milestones in the next 14 days', '')}
    ${_daiKPI(concerns.length, 'Milestones needing attention', 'At risk, missed, or past date with no status')}
  </div>`;

  const areaBtn = (a) => `<button type="button" data-dpl-open="${_daiEsc(a.areaCode)}" style="background:none;border:none;padding:0;color:var(--color-teal);text-decoration:underline;cursor:pointer;font:inherit;min-height:24px;text-align:left;"><strong>${_daiEsc(a.areaCode)}</strong> ${_daiEsc(a.areaName)}</button>`;
  const next = p => {
    const m = p.milestones.filter(x => x.date && _dplDaysTo(x.date) >= 0).sort((x, y) => x.date.localeCompare(y.date))[0];
    return m ? `${_daiFmtDate(m.date)}: ${_daiEsc(m.willBeTrue).slice(0, 80)}` : '–';
  };
  const evCount = code => typeof daiEvidenceFor === 'function' ? daiEvidenceFor(code).length : 0;
  const tRows = rows.map(({ a, p }) => p
    ? `<tr>${_daiTd(areaBtn(a))}${_daiTd(_daiFmtDate(p.dateCompleted) || _daiFmtDate(p.when))}${_daiTd(_daiEsc(p.takingNext || '–'))}${_daiTd(next(p))}${_daiTd(p.fixed.length)}${_daiTd(evCount(a.areaCode))}${_daiTd(_daiEsc(p.qip || '–'))}${_daiTd(_daiEsc(p.support || '–'), 'max-width:28ch;')}</tr>`
    : `<tr>${_daiTd(areaBtn(a))}${_daiTd('<strong>Not submitted</strong>')}${_daiTd('')}${_daiTd('')}${_daiTd('')}${_daiTd(evCount(a.areaCode) || '')}${_daiTd('')}${_daiTd('')}</tr>`);

  const list = (title, items, fmt) => items.length ? `${_dplH(3, title)}<ul style="margin:0 0 0 var(--space-lg);font-size:var(--text-sm);">${items.map(fmt).join('')}</ul>` : '';
  return kpis
    + list('Milestones needing attention', concerns, x => `<li>${areaBtn(x.a)}: milestone ${x.m.n}${x.m.date ? ` (${_daiFmtDate(x.m.date)})` : ''}, <strong>${_daiEsc(x.state)}</strong>. ${_daiEsc(x.m.willBeTrue)}</li>`)
    + list('Milestones in the next 14 days', upcoming.sort((x, y) => x.days - y.days), x => `<li>${areaBtn(x.a)}: milestone ${x.m.n}, ${_daiFmtDate(x.m.date)}. ${_daiEsc(x.m.willBeTrue)}</li>`)
    + _dplH(3, 'Every area')
    + _daiTable('Area Action Plans by area', ['Area', 'Submitted', 'Taking next', 'Next milestone', 'Resources fixed', 'Your evidence', 'QIP and shared', 'Support asked for'], tRows, 1080);
}
