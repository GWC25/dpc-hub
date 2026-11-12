// DPC Hub · js/dai-tabs.js · v1.0 · 12/11/26 · By resource type, By theme and By area on the dashboard framework; record a share with many people across areas
//
// All three tabs use the shared filter and clickable tiles (dai-dash.js).
// End of Term 2 columns are in place and read "Awaiting form" until the
// December milestone form is imported.
//
// "Record share" saves to the Resource Library's share log (one share per
// area, as the library stores them), so it counts as evidence on each
// person's profile, and links the resource to the recommended action so it
// shows as made.
//
// Public: daiResourceTabHTML(d), daiThemeTabHTML(d, elementsHTML), daiAreaTabHTML(d, areaNeedsHTML), daiShareOpen(i, trigger)

const DAI_T2_PENDING = 'Awaiting form';
let _dtbShares = [];   // share specs for this render; buttons carry an index
function daiTabsReset() { _dtbShares = []; }

function _dtbPeople(d) { return daiDashFiltered(d.all.map(p => ({ ...p, campus: _ddCampus(p) }))); }
function _dtbNeeds(P) {
  const ids = new Set(P.map(p => p.staffId));
  return (typeof daiSupportNeeds === 'function' ? daiSupportNeeds() : []).filter(n => ids.has(n.staffId) && (!_ddFilter.element || n.theme === _ddFilter.element));
}
function _dtbElStats(P) {
  return DAI_ELEMENTS.map(e => {
    const v = P.map(p => p.elements[e.id]).filter(x => x != null);
    return { ...e, avg: _daiAvg(v), n: v.length, low: P.filter(p => p.elements[e.id] != null && p.elements[e.id] <= 2) };
  }).filter(e => e.n).sort((a, b) => a.avg - b.avg);
}
function _dtbPeopleOf(list) { return [...new Map(list.map(n => [n.staffId, n])).values()].sort((a, b) => a.name.localeCompare(b.name)); }
const _dtbP = t => `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);max-width:75ch;">${t}</p>`;
const _dtbH = t => `<h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-xs);">${t}</h2>`;
const _dtbBtn = 'min-height:32px;padding:2px 10px;border:2px solid var(--color-teal);border-radius:999px;background:var(--color-white);color:var(--color-teal);font:bold var(--text-xs) Arial,sans-serif;cursor:pointer;white-space:nowrap;';

// Resource made and reach for one format and theme.
function _dtbRes(fmt, theme, needers) {
  const key = fmt === 'coaching' ? `coachgroup|${theme}` : `res|${fmt}|${theme}`;
  const st = typeof _dacGet === 'function' ? _dacGet(key) : {};
  const entries = (st.resourceIds || []).map(id => _dacLibEntries().find(e => e.resourceId === id)).filter(Boolean);
  const made = st.status === 'Done' || entries.length > 0;
  const reach = entries.length ? _dacReach(entries.map(e => e.resourceId), needers) : 0;
  return { key, st, entries, made, reach };
}
function _dtbShareBtn(spec, label) {
  _dtbShares.push(spec);
  return `<button type="button" data-dtb-share="${_dtbShares.length - 1}" aria-label="Record a share: ${_daiEsc(label)}" style="${_dtbBtn}">Record share</button>`;
}
const _dtbWho = ps => ps.length ? `<details><summary style="cursor:pointer;min-height:24px;color:var(--color-teal);font-weight:bold;">${ps.length} <span class="sr-only">people, show who</span></summary>${ps.map(_daiPersonBtn).join(', ')}</details>` : '0';

// ── By resource type ──────────────────────────────────────────
function daiResourceTabHTML(d) {
  const P = _dtbPeople(d), needs = _dtbNeeds(P), els = _dtbElStats(P);
  const low5 = els.slice(0, 5);
  const rowsFor = fmt => DAI_ELEMENTS.map(e => {
    const list = needs.filter(n => n.format === fmt && n.theme === e.id);
    const ps = _dtbPeopleOf(list);
    return { e, fmt, list, ps, ...(_dtbRes(fmt, e.id, ps)) };
  });
  const types = ['video', 'guide', 'coaching'].map(fmt => {
    const rows = rowsFor(fmt), needed = rows.filter(r => r.ps.length);
    const staff = new Set(needed.flatMap(r => r.ps.map(p => p.staffId)));
    const reached = new Set(needed.flatMap(r => r.entries.length ? r.ps.filter(p => _dacReach(r.entries.map(x => x.resourceId), [p])).map(p => p.staffId) : []));
    return { fmt, rows, needed, made: needed.filter(r => r.made).length, staff: staff.size, reached: reached.size };
  });
  const table = rows => {
    const sorted = rows.slice().sort((a, b) => b.ps.length - a.ps.length || a.e.label.localeCompare(b.e.label));
    return _daiTable('Resources needed by element', ['Resource needed?', 'What is needed', 'In the Resource Library', 'Staff who need it', 'Staff shared with', 'Actions'],
      sorted.map(r => {
        const what = `${DSU_FORMATS[r.fmt]} on ${r.e.label}`;
        return `<tr>${_daiTd(r.ps.length ? '<strong>Yes</strong>' : 'No')}${_daiTd(_daiEsc(what))}
          ${_daiTd(r.entries.length ? `Yes: ${r.entries.map(x => _daiEsc(x.title)).join(', ')}` : r.made ? 'Marked done' : 'No')}
          ${_daiTd(_dtbWho(r.ps))}${_daiTd(r.entries.length ? `${r.reach} of ${r.ps.length}` : '–')}
          ${_daiTd(r.ps.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${_dtbShareBtn({ title: what, actionKey: r.key, themeIds: [r.e.id], people: r.ps }, what)}${typeof _dsuPromptBtn === 'function' ? _dsuPromptBtn(r.fmt === 'coaching' ? { kind: 'coachgroup', themes: [r.e.id], needs: r.list } : { kind: r.fmt, themes: [r.e.id], needs: r.list }, what) : ''}</div>` : '')}</tr>`;
      }), 980);
  };
  const tiles = [
    { id: 'low5', value: low5.length ? low5.map(e => _daiEsc(e.label)).join('<br>') : '–', label: '5 lowest elements', sub: `Combined score, from ${P.filter(p => p.after != null).length} survey returns`,
      detail: () => _daiTable('Lowest elements', ['Element', 'Average of 5', 'People who answered', 'Rated 1 or 2'], low5.map(e => `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(_daiFmt(e.avg))}${_daiTd(e.n)}${_daiTd(_dtbWho(e.low))}</tr>`), 560) },
    ...types.map(t => ({ id: t.fmt, value: `${t.made} of ${t.needed.length}`, label: t.fmt === 'coaching' ? 'Coaching themes covered' : `${DSU_FORMATS[t.fmt]}s made`,
      sub: `${t.needed.length} needed for ${t.staff} staff; shared with ${t.reached} of them`, detail: () => table(t.rows) })),
  ];
  return daiDashFilterHTML(d.all.map(p => ({ ...p, campus: _ddCampus(p) })))
    + daiDashTilesHTML('resources', tiles)
    + _dtbH('Every resource') + _dtbP('A resource counts as made when it is linked from the Resource Library (Record share or Mark done) or marked done. Staff shared with counts only the people who needed it.')
    + table(types.filter(t => t.fmt !== 'coaching').flatMap(t => t.rows));
}

// ── By theme ──────────────────────────────────────────────────
function daiThemeTabHTML(d, elementsHTML) {
  const P = _dtbPeople(d), needs = _dtbNeeds(P), els = _dtbElStats(P);
  const low3 = els.slice(0, 3);
  const made = DAI_ELEMENTS.filter(e => ['video', 'guide'].some(f => _dtbRes(f, e.id, []).made)).length;
  const rows = els.map(e => {
    const list = needs.filter(n => n.theme === e.id), ps = _dtbPeopleOf(list);
    const byArea = new Map(); ps.forEach(p => { const k = p.areaCode || ''; if (!byArea.has(k)) byArea.set(k, []); byArea.get(k).push(p); });
    const res = ['video', 'guide'].map(f => _dtbRes(f, e.id, ps));
    const entries = res.flatMap(r => r.entries);
    const reach = entries.length ? _dacReach(entries.map(x => x.resourceId), ps) : 0;
    const areasCell = byArea.size ? `<details><summary style="cursor:pointer;min-height:24px;color:var(--color-teal);font-weight:bold;">${byArea.size} <span class="sr-only">areas, show which</span></summary><ul style="list-style:none;margin-top:4px;">${[...byArea.entries()].sort((a, b) => b[1].length - a[1].length).map(([code, list2]) =>
      `<li style="padding:2px 0;"><button type="button" data-dtb-area="${_daiEsc(code)}" style="background:none;border:none;padding:0;color:var(--color-teal);text-decoration:underline;cursor:pointer;font:inherit;min-height:24px;">${_daiEsc(code || 'No area')}</button>: ${list2.length} ${list2.length === 1 ? 'person' : 'people'}</li>`).join('')}</ul></details>` : '0';
    return `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(areasCell)}${_daiTd(`${_daiFmt(e.avg)} <span style="color:var(--color-muted);">(${e.n})</span>`)}${_daiTd(DAI_T2_PENDING)}${_daiTd(_dtbWho(ps))}
      ${_daiTd(entries.length ? `Yes: ${entries.map(x => _daiEsc(x.title)).join(', ')}` : res.some(r => r.made) ? 'Marked done' : 'No')}${_daiTd(entries.length ? `${reach} of ${ps.length}` : '–')}
      ${_daiTd(ps.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${_dtbShareBtn({ title: `Resource on ${e.label}`, actionKey: `res|video|${e.id}`, themeIds: [e.id], people: ps }, e.label)}${typeof _dsuPromptBtn === 'function' ? _dsuPromptBtn({ kind: e.id === 'cognitiveLoad' ? 'coachgroup' : 'video', themes: [e.id], needs: list }, e.label) : ''}</div>` : '')}</tr>`;
  });
  const tiles = [
    { id: 'low3', value: low3.length ? low3.map(e => _daiEsc(e.label)).join('<br>') : '–', label: '3 lowest confidence themes', sub: 'Baseline average',
      detail: () => _daiTable('Lowest themes', ['Theme', 'Average of 5', 'People who answered', 'Rated 1 or 2'], low3.map(e => `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(_daiFmt(e.avg))}${_daiTd(e.n)}${_daiTd(_dtbWho(e.low))}</tr>`), 560) },
    { id: 'change', value: DAI_T2_PENDING, label: 'Change since the baseline', sub: 'Baseline against the end of Term 2 reflection',
      detail: () => _dtbP('This fills in when the December milestone form is imported. For a true comparison the form needs the same 11 element questions, word for word, with the same answer scale.') },
    { id: 'made', value: `${made} of ${DAI_ELEMENTS.length}`, label: 'Themes with a resource made', sub: 'Video or guide linked or marked done',
      detail: () => _daiTable('Themes and resources', ['Theme', 'Video', 'Guide'], DAI_ELEMENTS.map(e => { const v = _dtbRes('video', e.id, []), g = _dtbRes('guide', e.id, []); return `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(v.made ? 'Made' : 'Not yet')}${_daiTd(g.made ? 'Made' : 'Not yet')}</tr>`; }), 480) },
  ];
  return daiDashFilterHTML(d.all.map(p => ({ ...p, campus: _ddCampus(p) })))
    + daiDashTilesHTML('theme', tiles)
    + _dtbH('By theme') + _dtbP('Lowest confidence first. Open Areas and select an area to filter the whole tab to it. Record share logs a resource shared with the people who need it, or with whole areas.')
    + _daiTable('Themes, lowest confidence first', ['Theme', 'Areas', 'Baseline average (answers)', 'End of Term 2', 'People needing support', 'In the Resource Library', 'Shared with', 'Actions'], rows, 1100)
    + (elementsHTML || '');
}

// ── By area ───────────────────────────────────────────────────
function daiAreaTabHTML(d, areaNeedsHTML) {
  const P = _dtbPeople(d);
  const byArea = new Map(); P.forEach(p => { const k = p.areaCode || ''; if (!byArea.has(k)) byArea.set(k, []); byArea.get(k).push(p); });
  const areas = [...byArea.entries()].map(([code, ps]) => {
    const els = _dtbElStats(ps);
    return { code, ps, reg: ps.filter(p => p.reg).length, ret: ps.filter(p => p.refl).length, before: _daiAvg(ps.map(p => p.before)), after: _daiAvg(ps.map(p => p.after)), weakest: els[0] ? els[0].label : '', plan: typeof daiPlanLatest === 'function' && code ? !!daiPlanLatest(code) : false };
  }).sort((a, b) => (a.before == null) - (b.before == null) || (a.before || 0) - (b.before || 0));
  const areaBtn = code => `<button type="button" data-dtb-area="${_daiEsc(code)}" style="background:none;border:none;padding:0;color:var(--color-teal);text-decoration:underline;cursor:pointer;font:inherit;min-height:24px;text-align:left;"><strong>${_daiEsc(code || 'No area')}</strong> ${code ? _daiEsc(_daiAreaName(code)) : ''}</button>`;
  const rows = areas.map(a => `<tr>${_daiTd(areaBtn(a.code))}${_daiTd(a.reg)}${_daiTd(a.ret)}${_daiTd(_daiFmt(a.before))}${_daiTd(_daiFmt(a.after))}${_daiTd(DAI_T2_PENDING)}${_daiTd(_daiEsc(a.weakest))}${_daiTd(a.plan ? 'Yes' : 'No')}</tr>`);
  const withB = areas.filter(a => a.before != null);
  const tiles = [
    { id: 'areas', value: areas.filter(a => a.code).length, label: 'Areas with responses', sub: `${areas.filter(a => a.plan).length} with an Area Action Plan`,
      detail: () => _daiTable('Areas', ['Area', 'Registered', 'Survey returns', 'Plan'], areas.map(a => `<tr>${_daiTd(areaBtn(a.code))}${_daiTd(a.reg)}${_daiTd(a.ret)}${_daiTd(a.plan ? 'Yes' : 'No')}</tr>`), 560) },
    { id: 'lowest', value: withB.length ? _daiEsc(withB[0].code || 'No area') : '–', label: 'Lowest initial confidence', sub: withB.length ? `${_daiFmt(withB[0].before)} of 5 before training` : '',
      detail: () => _daiTable('Areas by initial confidence', ['Area', 'Initial confidence pre-training', 'People'], withB.map(a => `<tr>${_daiTd(areaBtn(a.code))}${_daiTd(_daiFmt(a.before))}${_daiTd(a.reg)}</tr>`), 520) },
    { id: 't2', value: DAI_T2_PENDING, label: 'End of Term 2 confidence', sub: 'From the December milestone form', detail: () => _dtbP('This fills in when the December milestone form is imported.') },
  ];
  // One area chosen in the filter: that area's element report.
  let report = '';
  if (_ddFilter.area) {
    const ps = byArea.get(_ddFilter.area) || [];
    const els = _dtbElStats(ps);
    report = _dtbH(`${_daiEsc(_ddFilter.area)} ${_daiEsc(_daiAreaName(_ddFilter.area))}: confidence by element`)
      + _dtbP(`${ps.filter(p => p.refl).length} survey returns. Initial confidence pre-training ${_daiFmt(_daiAvg(ps.map(p => p.before)))} of 5; elements combined ${_daiFmt(_daiAvg(ps.map(p => p.after)))} of 5.`)
      + (els.length ? _daiTable(`Element confidence in ${_ddFilter.area}`, ['Element', 'Area average', 'College average', 'Answers', 'End of Term 2', 'Rated 1 or 2'],
        els.map(e => { const col = _dtbElStats(d.all).find(x => x.id === e.id); return `<tr>${_daiTd(_daiEsc(e.label))}${_daiTd(_daiFmt(e.avg))}${_daiTd(col ? _daiFmt(col.avg) : '–')}${_daiTd(e.n)}${_daiTd(DAI_T2_PENDING)}${_daiTd(_dtbWho(e.low))}</tr>`; }), 760) : _dtbP('No element ratings from this area yet.'));
  }
  return daiDashFilterHTML(d.all.map(p => ({ ...p, campus: _ddCampus(p) })))
    + daiDashTilesHTML('area', tiles) + report
    + _dtbH('By area') + _dtbP('Lowest initial confidence first. Select an area to see its element report.')
    + _daiTable('Confidence by curriculum area, out of 5', ['Area', 'Registered', 'Survey returns', 'Initial confidence pre-training', 'Element baseline', 'End of Term 2', 'Weakest element', 'Area plan'], rows, 960)
    + (areaNeedsHTML || '');
}

// ── Record a share ────────────────────────────────────────────
function daiShareOpen(i, trigger) {
  const spec = _dtbShares[i];
  if (!spec || typeof saveLibraryShare !== 'function') return;
  const back = trigger || document.activeElement;
  const entries = _dacLibEntries();
  const match = new Set(_dacMatches(spec.themeIds).map(e => e.resourceId));
  const sorted = entries.slice().sort((a, b) => (match.has(b.resourceId) - match.has(a.resourceId)) || String(a.title).localeCompare(String(b.title)));
  const groups = new Map();
  const add = (p, on) => { const k = p.areaCode || ''; if (!groups.has(k)) groups.set(k, new Map()); if (!groups.get(k).has(p.staffId)) groups.get(k).set(p.staffId, { p, on }); };
  spec.people.forEach(p => add(p, true));
  const staffAreas = [...new Set(_daiStaffList().map(s => s.areaCode).filter(Boolean))].sort();

  document.getElementById('dtb-share-dialog')?.remove();
  const host = document.createElement('div');
  host.id = 'dtb-share-dialog';
  host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-labelledby', 'dtb-s-title');
  host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:700;display:flex;align-items:center;justify-content:center;padding:var(--space-lg);';
  const peopleHTML = () => [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, m], gi) => {
    const list = [...m.values()].sort((a, b) => a.p.name.localeCompare(b.p.name));
    const on = list.filter(x => x.on).length;
    return `<div style="border-top:1px solid var(--color-border);padding:var(--space-xs) 0;">
      <div style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="dtb-g-${gi}" data-dtb-group="${_daiEsc(code)}" ${on === list.length ? 'checked' : ''} style="width:20px;height:20px;">
        <label for="dtb-g-${gi}" style="font-size:var(--text-sm);font-weight:bold;">${_daiEsc(code || 'No area')} (${on} of ${list.length})</label></div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin:4px 0 0 26px;">${list.map(x => `<span style="display:inline-flex;gap:4px;align-items:center;"><input type="checkbox" id="dtb-p-${_daiEsc(x.p.staffId)}" data-dtb-person="${_daiEsc(x.p.staffId)}" data-dtb-in="${_daiEsc(code)}" ${x.on ? 'checked' : ''} style="width:18px;height:18px;"><label for="dtb-p-${_daiEsc(x.p.staffId)}" style="font-size:var(--text-sm);">${_daiEsc(x.p.name)}</label></span>`).join('')}</div></div>`;
  }).join('');
  host.innerHTML = `<form novalidate style="background:var(--color-white);color:var(--color-slate);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:720px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
    <div style="display:flex;justify-content:space-between;gap:var(--space-md);"><h2 id="dtb-s-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Record a share</h2>
      <button type="button" data-dtb-close aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;">×</button></div>
    <p style="font-size:var(--text-sm);margin-bottom:var(--space-md);">${_daiEsc(spec.title)}. This records the share as evidence; it does not send anything.</p>
    <div class="form-group"><label class="form-label" for="dtb-res">Resource from the Resource Library</label>
      ${sorted.length ? `<select id="dtb-res" class="form-select">${sorted.map(e => `<option value="${_daiEsc(e.resourceId)}">${_daiEsc(e.title)}${match.has(e.resourceId) ? ' (matches this theme)' : ''}</option>`).join('')}</select>` : '<p style="font-size:var(--text-sm);color:var(--color-red);">Add the resource to the Resource Library first.</p>'}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);">
      <div class="form-group"><label class="form-label" for="dtb-date">Date shared</label><input id="dtb-date" type="date" class="form-input" value="${todayISO()}"></div>
      <div class="form-group"><label class="form-label" for="dtb-add">Add a whole area</label><select id="dtb-add" class="form-select"><option value="">Choose an area to add</option>${staffAreas.map(a => `<option value="${_daiEsc(a)}">${_daiEsc(a)}, ${_daiEsc(_daiAreaName(a))}</option>`).join('')}</select></div>
    </div>
    <fieldset style="border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);"><legend style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);padding:0 4px;">Shared with (<span id="dtb-count"></span> selected)</legend>
      <div id="dtb-people" style="max-height:300px;overflow-y:auto;">${peopleHTML()}</div></fieldset>
    <div class="form-group"><label class="form-label form-label--optional" for="dtb-note">Note</label><input id="dtb-note" type="text" class="form-input" placeholder="For example: sent by email to the team, shown at the Teach Meet"></div>
    <p id="dtb-err" role="alert" style="font-size:var(--text-sm);color:var(--color-red);min-height:1.2em;"></p>
    <div class="btn-row"><button type="submit" class="btn btn--primary">Record share</button><button type="button" class="btn btn--secondary" data-dtb-close>Cancel</button></div>
  </form>`;
  document.body.appendChild(host);
  const sync = () => {
    host.querySelectorAll('[data-dtb-person]').forEach(c => { const g = groups.get(c.dataset.dtbIn); if (g && g.get(c.dataset.dtbPerson)) g.get(c.dataset.dtbPerson).on = c.checked; });
    host.querySelector('#dtb-count').textContent = [...groups.values()].reduce((n, m) => n + [...m.values()].filter(x => x.on).length, 0);
  };
  const redraw = () => { sync(); host.querySelector('#dtb-people').innerHTML = peopleHTML(); bind(); sync(); };
  const bind = () => {
    host.querySelectorAll('[data-dtb-group]').forEach(cb => cb.addEventListener('change', () => { groups.get(cb.dataset.dtbGroup).forEach(x => { x.on = cb.checked; }); host.querySelector('#dtb-people').innerHTML = peopleHTML(); bind(); sync(); host.querySelector(`[data-dtb-group="${cb.dataset.dtbGroup.replace(/"/g, '\\"')}"]`)?.focus(); }));
    host.querySelectorAll('[data-dtb-person]').forEach(cb => cb.addEventListener('change', () => { sync(); const g = groups.get(cb.dataset.dtbIn); const head = host.querySelector(`[data-dtb-group="${cb.dataset.dtbIn.replace(/"/g, '\\"')}"]`); const vals = [...g.values()]; if (head) { head.checked = vals.every(x => x.on); head.indeterminate = vals.some(x => x.on) && !head.checked; } }));
  };
  bind(); sync();
  host.querySelector('#dtb-add').addEventListener('change', e => {
    const code = e.target.value; if (!code) return;
    sync();
    _daiStaffList().filter(s => s.areaCode === code && !(s.tracker && s.tracker.onLatest === false)).forEach(s => add({ staffId: s.staffId, name: s.name, areaCode: code }, true));
    groups.get(code)?.forEach(x => { x.on = true; });
    e.target.value = ''; redraw();
  });
  const close = () => { host.remove(); if (back && document.body.contains(back)) back.focus(); };
  host.querySelectorAll('[data-dtb-close]').forEach(b => b.addEventListener('click', close));
  host.addEventListener('click', e => { if (e.target === host) close(); });
  host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  host.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); sync();
    const resSel = host.querySelector('#dtb-res'), err = host.querySelector('#dtb-err');
    if (!resSel) { err.textContent = 'Add the resource to the Resource Library first.'; return; }
    const entry = entries.find(x => x.resourceId === resSel.value);
    const date = host.querySelector('#dtb-date').value || todayISO(), note = host.querySelector('#dtb-note').value.trim();
    let n = 0, areasN = 0;
    groups.forEach((m, code) => {
      const ids = [...m.values()].filter(x => x.on).map(x => x.p.staffId);
      if (!ids.length) return;
      saveLibraryShare({ resourceId: entry.resourceId, resourceType: entry.type, resourceTitle: entry.title, resourceUrl: entry.url, date, areaCode: code, staffIds: ids, contextNotes: note || `DA&I: ${spec.title}` });
      n += ids.length; areasN++;
    });
    if (!n) { err.textContent = 'Select at least one person.'; return; }
    // Link the resource to the recommended action, so it shows as made.
    if (spec.actionKey) {
      const st = _dacStore(), cur = st[spec.actionKey] || {};
      const ids = new Set(cur.resourceIds || []); ids.add(entry.resourceId);
      st[spec.actionKey] = { ...cur, resourceIds: [...ids], status: cur.status && cur.status !== 'To do' ? cur.status : 'Done', date: cur.date || date, label: cur.label || spec.title, updated: nowISO() };
      if (typeof saveDAIData === 'function') saveDAIData();
    }
    if (typeof saveStaffBulk === 'function') saveStaffBulk();
    host.remove();
    _daiRenderBody();
    const m = document.getElementById('dai-status');
    if (m) m.textContent = `Recorded "${entry.title}" shared with ${n} ${n === 1 ? 'person' : 'people'} in ${areasN} ${areasN === 1 ? 'area' : 'areas'}.`;
    document.getElementById('dai-panel')?.focus();
  });
  (host.querySelector('#dtb-res') || host.querySelector('[data-dtb-close]')).focus();
}
