// DPC Hub · js/ap-college-pack.js · v1.0 · 20/10/26 · AP College Pack: a college-wide DA&I workbook for Assistant Principals, plus quick AP assignment per area
// One Excel workbook for the whole college, or for one Assistant Principal:
//   - "College overview": at a glance, 23 October bookings by session and
//     by AP (counts only, no names), Health Check averages for each focus
//     area by campus, by area within each campus and by AP, and the
//     college's key concerns and strengths.
//   - One tab per area group, the same Overview sheet as the DA&I Day area
//     pack (area-packs.js _apWriteUnitOverview), including who is booked on
//     23 October and in which sessions and groups.
// Areas are assigned to APs here, not by campus, because some APs cover
// areas on more than one campus. The AP is stored on the area (area.apName,
// initials) in data-areas.json in the Data folder, never in the repo.
//
// Depends on area-packs.js (loaded first). Exports: apcRenderPanel(body)

// ── Helpers ───────────────────────────────────────────────────
function _apcFAs() { return typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []; }
function _apcAvgOf(rs) { return _apAvg(rs.map(r => _apAvg(Object.values(r.domains || {}).map(d => d.avgScore).filter(v => v != null))).filter(v => v != null)); }
function _apcFAAvg(rs, faId) { const v = rs.map(r => r.domains && r.domains[faId] && r.domains[faId].avgScore).filter(x => x != null); return v.length ? _ap2(_apAvg(v)) : ''; }
// One row of averages: staff reviewed, overall, then each focus area.
function _apcAvgRow(rs) { return [rs.length, rs.length ? _ap2(_apcAvgOf(rs)) : '', ..._apcFAs().map(fa => _apcFAAvg(rs, fa.id))]; }
function _apcAvgHead() { return ['Staff reviewed', 'Overall average', ..._apcFAs().map(fa => fa.label)]; }
const APC_NOT_SET = 'Not assigned';
function _apcAllAPs() { return _apUniq(_apAreas().flatMap(a => apSplitAPs(a.apName))).sort(); }
function _apcCampusOf(code) { const a = _apAreas().find(x => x.areaCode === code); return (a && a.campus) || 'Campus not set'; }
function _apcAreaLabel(code) { const a = _apAreas().find(x => x.areaCode === code); return `${code} ${(a && a.areaName) || ''}`.trim(); }

// ── Workbook ──────────────────────────────────────────────────
// ap: '' for the whole college, or one AP's initials.
async function apcBuildWorkbook(attendance, ap) {
  const ExcelJS = await _apLoadExcelJS();
  const areas = _apAreas();
  const today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
  const allUnits = apUnits(attendance);
  const units = (ap ? allUnits.filter(u => apUnitAPs(u).includes(ap)) : allUnits)
    .map(u => ({ u, aps: apUnitAPs(u) }))
    .sort((a, b) => (!a.aps.length - !b.aps.length) || (a.aps[0] || '').localeCompare(b.aps[0] || '') || a.u.label.localeCompare(b.u.label));
  const latest = Object.values(_apLatestByStaff(null));
  const scopeCodes = ap ? areas.filter(a => apSplitAPs(a.apName).includes(ap)).map(a => a.areaCode) : areas.map(a => a.areaCode);
  const scopeReviews = latest.filter(r => scopeCodes.includes(r.areaCode));
  const collegeStats = _apIndicatorStats(latest);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DPC Hub'; wb.created = new Date();
  wb.title = ap ? `DA&I AP pack: ${ap}` : 'DA&I AP College Pack';

  const ws = wb.addWorksheet('College overview', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const nFA = _apcFAs().length;
  ws.columns = [{ width: 30 }, { width: 34 }, { width: 14 }, { width: 14 }, ...Array.from({ length: Math.max(nFA, 4) }, () => ({ width: 20 }))];
  const span = 4 + Math.max(nFA, 4);
  const o = _apSheetHelpers(ws, 4);
  o.title(ap ? `Digital Accessibility and Inclusion: ${ap}'s areas and the college` : 'Digital Accessibility and Inclusion: college overview',
    `For Assistant Principals. Health Checks (latest check per person) and the DA&I Day, 23 October 2026. Prepared ${_apFmt(today)} from the DPC Hub.`);

  // Who is on the attendance list, de-duplicated across tabs.
  const unitPeople = allUnits.map(u => ({ u, aps: apUnitAPs(u), people: apUnitPeople(u) }));
  const onListAll = unitPeople.flatMap(x => x.people.filter(p => p.attend).map(p => ({ ...p, aps: x.aps, unit: x.u })));
  const onList = ap ? onListAll.filter(p => p.aps.includes(ap)) : onListAll;
  const count = list => [list.filter(p => p.attend.attending === true).length, list.filter(p => p.attend.attending === false).length, list.filter(p => p.attend.attending == null).length];
  const [yes, no, unk] = count(onList);
  const sup = _apSupport(scopeReviews);
  const unassigned = areas.filter(a => !apSplitAPs(a.apName).length).length;

  o.section('At a glance', span);
  o.pairs([
    ['Scope', ap ? `Areas assigned to ${ap}: ${scopeCodes.map(_apcAreaLabel).join('; ') || 'none'}` : `Whole college: ${areas.length} areas`],
    ['Staff reviewed (Health Check)', scopeReviews.length],
    ['Average practice score', scopeReviews.length ? `${_ap2(_apcAvgOf(scopeReviews))} of 5${ap ? ` (college ${_ap2(_apcAvgOf(latest))})` : ''}` : 'No Health Checks yet'],
    ['Support priority', sup ? `${_ap2(sup.priority)} of 7${sup.band ? ` (${sup.band.label})` : ''}` : 'None yet'],
    ['Main support need', sup ? sup.mainNeed : ''],
    ['Booked for 23 October', attendance ? `${yes} attending, ${no} not attending, ${unk} not answered (${onList.length} on the attendance list)` : 'Attendance list not found in the Data folder'],
    ['Learning walk trained, attending', onList.filter(p => p.attend.attending !== false && p.attend.lwTrained).length],
    ...(!ap && unassigned ? [['Areas with no AP assigned', unassigned]] : []),
  ]);

  // 23 October by session (counts only)
  o.section('23 October: staff booked in each session', span);
  const sessLabels = _apUniq([...((attendance && attendance.sheets) || []).flatMap(sh => sh.sessions), ...onList.flatMap(p => p.attend.sessions)].map(s => `${s.label}${s.time ? ' ' + s.time : ''}`)).sort();
  const groups = _apUniq(onList.flatMap(p => p.attend.sessions.map(s => s.group))).sort();
  o.table(['Session', 'Staff booked', ...groups.map(g => `Group ${g}`)], sessLabels.map(lbl => {
    const inS = onList.filter(p => p.attend.attending !== false).map(p => p.attend.sessions.find(s => `${s.label}${s.time ? ' ' + s.time : ''}` === lbl)).filter(Boolean);
    return [lbl, inS.length, ...groups.map(g => inS.filter(x => x.group === g).length)];
  }), { empty: 'No sessions booked yet.' });

  // 23 October by AP and area (counts only)
  o.section('23 October: who is going, by Assistant Principal and area', span);
  o.table(['Assistant Principal', 'Area group', 'On the list', 'Attending', 'Not attending', 'Not answered'],
    units.map(({ u, aps }) => {
      const l = onListAll.filter(p => p.unit === u);
      return [aps.join(', ') || APC_NOT_SET, u.label, u.sheet ? l.length : 'No tab', ...count(l)];
    }), { empty: 'No areas in scope.' });

  // Averages by campus
  o.section('Health Check averages by campus (1 to 5)', span);
  const campuses = _apUniq(scopeCodes.map(_apcCampusOf)).sort();
  o.table(['Campus', 'Areas', ..._apcAvgHead()], [
    ...campuses.map(c => {
      const codes = scopeCodes.filter(code => _apcCampusOf(code) === c);
      return [c, codes.length, ..._apcAvgRow(scopeReviews.filter(r => codes.includes(r.areaCode)))];
    }),
    [ap ? `All ${ap}'s areas` : 'College', scopeCodes.length, ..._apcAvgRow(scopeReviews)],
    ...(ap ? [['College', areas.length, ..._apcAvgRow(latest)]] : []),
  ]);

  // Area averages within each campus
  o.section('Health Check averages by area, within each campus (1 to 5)', span);
  o.table(['Campus', 'Area', 'Assistant Principal', ..._apcAvgHead()],
    campuses.flatMap(c => scopeCodes.filter(code => _apcCampusOf(code) === c).sort().map(code => {
      const rs = scopeReviews.filter(r => r.areaCode === code);
      return rs.length ? [c, _apcAreaLabel(code), apAreaAPs(code).join(', ') || APC_NOT_SET, ..._apcAvgRow(rs)] : null;
    }).filter(Boolean)), { empty: 'No Health Checks in these areas yet.' });
  const noChecks = scopeCodes.filter(code => !scopeReviews.some(r => r.areaCode === code));
  if (noChecks.length) o.para(`No Health Checks yet: ${noChecks.map(_apcAreaLabel).join('; ')}.`, { italic: true, color: 'FF475569', span });
  o.gap();

  // By AP
  o.section('Health Check averages by Assistant Principal (1 to 5)', span);
  const aps = ap ? [ap] : [..._apcAllAPs(), ...(unassigned ? [APC_NOT_SET] : [])];
  o.table(['Assistant Principal', 'Areas', ..._apcAvgHead()], aps.map(x => {
    const codes = areas.filter(a => x === APC_NOT_SET ? !apSplitAPs(a.apName).length : apSplitAPs(a.apName).includes(x)).map(a => a.areaCode);
    return [x, codes.length, ..._apcAvgRow(latest.filter(r => codes.includes(r.areaCode)))];
  }));

  // Concerns and strengths
  const stats = _apIndicatorStats(scopeReviews);
  o.section(ap ? `Key concerns and strengths across ${ap}'s areas` : 'Key concerns and strengths across the college', span);
  o.table(['Key concerns: indicators most often scored 1 or 2', 'Staff scoring 1 or 2', 'Average', 'College average', 'First action for teams'],
    stats.filter(s => s.n && s.low).sort((a, b) => b.lowShare - a.lowShare || a.avg - b.avg).slice(0, 8)
      .map(s => { const c = collegeStats.find(x => x.id === s.id); return [s.label, `${s.low} of ${s.n}`, _ap2(s.avg), c && c.avg != null ? _ap2(c.avg) : '', AP_FIRST_ACTIONS[s.id] || '']; }),
    { empty: 'No indicator was scored 1 or 2.' });
  o.table(['Strengths: indicators averaging 4 or more', 'Staff reviewed', 'Average'],
    stats.filter(s => s.n && s.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 6).map(s => [s.label, s.n, _ap2(s.avg)]),
    { empty: 'No indicator averages 4 or more yet.' });
  o.para('Scores: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident. This page shows areas and counts only, never ranked individuals. Each area tab follows.', { italic: true, color: 'FF475569', span });

  // One tab per area group: the DA&I Day area Overview
  const used = new Set(['college overview']);
  units.forEach(({ u, aps }) => {
    _apWriteUnitOverview(wb, u, attendance, {
      sheetName: _apSheetName(u.fileKey || u.label, used),
      subtitle: `Assistant Principal: ${aps.join(', ') || APC_NOT_SET}. DA&I Day, 23 October 2026. Prepared ${_apFmt(today)} from the DPC Hub.`,
      note: 'Scores: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident. Individual Health Check results are in the area pack for the Head of Area, not here.',
    });
  });
  return wb;
}

function _apcFileName(ap) {
  const key = ap ? String(ap).replace(/[^A-Za-z0-9]+/g, '-') : 'College';
  return `DAI-AP-pack-${key}-${typeof todayISO === 'function' ? todayISO() : ''}.xlsx`;
}

// ── Reports panel ─────────────────────────────────────────────
async function apcRenderPanel(body) {
  if (!body) return;
  body.innerHTML = '<p role="status" class="ms-muted">Reading the attendance list from the Data folder…</p>';
  let attendance = null, attErr = '';
  try { attendance = await apFindAttendance(); } catch (e) { attErr = e.message || String(e); }
  const areas = _apAreas().slice().sort((a, b) => a.areaCode.localeCompare(b.areaCode));
  const aps = _apcAllAPs();
  const unassigned = areas.filter(a => !apSplitAPs(a.apName).length).length;
  const campuses = typeof AREA_CAMPUSES !== 'undefined' ? AREA_CAMPUSES : ['SWSC', 'Loxton', 'Knightstone', 'Winter Gardens', 'CTC', 'Puxton Park', 'AMTEC', 'AROSFA'];

  body.innerHTML = `
    <div class="ms-report">
      <p>${attendance ? `Attendance list: <strong>${_apEsc(attendance.name)}</strong>, ${attendance.people.length} people on ${attendance.sheets.length} area tabs.` : `<strong>No attendance list found.</strong> The pack will show Health Checks only. ${_apEsc(attErr)}`}</p>

      <h3 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-md) 0 var(--space-sm);">Download</h3>
      <div class="ms-actions" style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:flex-end;">
        <div>
          <label class="form-label" for="apc-scope">Pack for</label>
          <select id="apc-scope" class="form-select" style="width:auto;min-height:40px;">
            <option value="">Whole college (all areas)</option>
            ${aps.map(x => `<option value="${_apEsc(x)}">${_apEsc(x)}'s areas</option>`).join('')}
          </select>
        </div>
        <button type="button" class="btn btn--primary btn--sm" id="apc-download">Download Excel</button>
        <button type="button" class="btn btn--ghost btn--sm" id="apc-save-all">Save college and every AP's pack to Data folder (AP packs)</button>
        <button type="button" class="btn btn--ghost btn--sm" id="apc-reread">Re-read attendance list</button>
      </div>
      <p id="apc-status" role="status" class="ms-muted"></p>

      <h3 style="font-size:var(--text-base);font-weight:var(--font-bold);color:var(--color-navy);margin:var(--space-lg) 0 var(--space-sm);">Assign Assistant Principals to areas</h3>
      <p class="ms-muted">${unassigned ? `<strong>${unassigned} of ${areas.length} areas have no AP.</strong> ` : `All ${areas.length} areas have an AP. `}Use initials. For two APs, separate them with a comma. Tick areas and use "Assign to ticked" to do several at once, or type in the box on each row. Nothing is saved until you press Save assignments.</p>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:flex-end;margin-bottom:var(--space-sm);">
        <div>
          <label class="form-label" for="apc-bulk">AP initials</label>
          <input id="apc-bulk" class="form-input" type="text" list="apc-ap-list" style="width:10rem;min-height:40px;" autocomplete="off">
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="apc-bulk-apply">Assign to ticked</button>
        <button type="button" class="btn btn--ghost btn--sm" id="apc-tick-unassigned">Tick areas with no AP</button>
        <button type="button" class="btn btn--ghost btn--sm" id="apc-tick-none">Clear ticks</button>
        <button type="button" class="btn btn--primary btn--sm" id="apc-save">Save assignments</button>
      </div>
      <datalist id="apc-ap-list">${aps.map(x => `<option value="${_apEsc(x)}">`).join('')}</datalist>
      <p id="apc-assign-status" role="status" class="ms-muted"></p>
      <div class="ms-scroll"><table class="ms-table"><caption class="sr-only">Areas, their campus and Assistant Principal</caption>
        <thead><tr><th scope="col">Tick</th><th scope="col">Area</th><th scope="col">Campus</th><th scope="col">Assistant Principal</th></tr></thead>
        <tbody>${areas.map((a, i) => `<tr>
          <td><input type="checkbox" class="apc-tick" data-i="${i}" aria-label="Tick ${_apEsc(a.areaCode)} ${_apEsc(a.areaName)}"></td>
          <th scope="row">${_apEsc(a.areaCode)} ${_apEsc(a.areaName)}</th>
          <td><label class="sr-only" for="apc-campus-${i}">Campus for ${_apEsc(a.areaCode)}</label>
            <select id="apc-campus-${i}" class="form-select apc-campus" data-i="${i}" style="min-height:36px;font-size:var(--text-sm);">
              <option value="">Not set</option>
              ${_apUniq([...campuses, a.campus]).map(c => `<option value="${_apEsc(c)}" ${a.campus === c ? 'selected' : ''}>${_apEsc(c)}</option>`).join('')}
            </select></td>
          <td><label class="sr-only" for="apc-ap-${i}">Assistant Principal for ${_apEsc(a.areaCode)}</label>
            <input id="apc-ap-${i}" class="form-input apc-ap" data-i="${i}" type="text" list="apc-ap-list" value="${_apEsc(a.apName || '')}" style="width:10rem;min-height:36px;font-size:var(--text-sm);" autocomplete="off"></td>
        </tr>`).join('')}</tbody></table></div>
    </div>`;

  const status = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  const scope = () => document.getElementById('apc-scope').value;
  document.getElementById('apc-reread')?.addEventListener('click', () => apcRenderPanel(body));
  document.getElementById('apc-download')?.addEventListener('click', async () => {
    const ap = scope();
    status('apc-status', 'Building the pack…');
    try {
      const wb = await apcBuildWorkbook(attendance, ap);
      _apDownload(new Uint8Array(await wb.xlsx.writeBuffer()), _apcFileName(ap));
      status('apc-status', `${ap ? ap + "'s pack" : 'College pack'} downloaded.`);
    } catch (e) { console.error(e); status('apc-status', 'Could not build the pack: ' + e.message); }
  });
  document.getElementById('apc-save-all')?.addEventListener('click', async () => {
    if (typeof hasFolderAccess === 'function' && !hasFolderAccess()) { status('apc-status', 'No folder connected. Use Download instead.'); return; }
    const list = ['', ..._apcAllAPs()];
    let done = 0;
    for (const ap of list) {
      status('apc-status', `Building ${ap || 'college'} pack (${done + 1} of ${list.length})…`);
      try { const wb = await apcBuildWorkbook(attendance, ap); await saveBytesToFolder(_apcFileName(ap), new Uint8Array(await wb.xlsx.writeBuffer()), 'AP packs'); done++; }
      catch (e) { console.error(e); status('apc-status', `Stopped at ${ap || 'college'}: ${e.message}`); return; }
    }
    status('apc-status', `${done} pack${done === 1 ? '' : 's'} saved to the Data folder, in "AP packs".`);
  });

  // Assignment
  const ticks = () => [...body.querySelectorAll('.apc-tick:checked')].map(cb => +cb.dataset.i);
  document.getElementById('apc-bulk-apply')?.addEventListener('click', () => {
    const v = document.getElementById('apc-bulk').value.trim();
    const t = ticks();
    if (!v) { status('apc-assign-status', 'Type the AP initials first.'); return; }
    if (!t.length) { status('apc-assign-status', 'Tick at least one area.'); return; }
    t.forEach(i => { const el = document.getElementById('apc-ap-' + i); if (el) el.value = v; });
    status('apc-assign-status', `${v} put against ${t.length} area${t.length === 1 ? '' : 's'}. Press Save assignments to keep it.`);
  });
  document.getElementById('apc-tick-unassigned')?.addEventListener('click', () => body.querySelectorAll('.apc-tick').forEach(cb => { cb.checked = !document.getElementById('apc-ap-' + cb.dataset.i).value.trim(); }));
  document.getElementById('apc-tick-none')?.addEventListener('click', () => body.querySelectorAll('.apc-tick').forEach(cb => { cb.checked = false; }));
  document.getElementById('apc-save')?.addEventListener('click', () => {
    let changed = 0;
    areas.forEach((a, i) => {
      const apv = apSplitAPs(document.getElementById('apc-ap-' + i).value).join(', ');
      const cv = document.getElementById('apc-campus-' + i).value;
      if (apv !== (a.apName || '') || cv !== (a.campus || '')) {
        const area = (typeof _getArea === 'function' && _getArea(a.areaCode)) || a;
        saveArea({ ...area, apName: apv, campus: cv });
        changed++;
      }
    });
    if (typeof UI !== 'undefined') UI.showToast('success', changed ? `${changed} area${changed === 1 ? '' : 's'} updated.` : 'No changes to save.');
    apcRenderPanel(body);
  });
}
