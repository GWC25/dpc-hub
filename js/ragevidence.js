// DPC Hub · js/ragevidence.js · v1.2 · 02/10/26 · Session RAG-3 — reports the Copilot support priority as an "also note" flag
// v1.1 · 02/10/26 · Session RAG-2 — can be worked out as at a past date (asOf) for the milestone impact report
// v1.0 · 02/10/26 · Session RAG-1 — evidence-based area RAG suggestion
// Suggests an overall at-risk RAG for each area from the evidence the Hub
// already holds, with a plain-English rationale and a list of the records
// it was built from. It NEVER writes to the area: the recorded RAG Matrix
// scores stay exactly as Graeme set them. This is a suggestion to confirm,
// edit or overrule, in line with the honest-basis note above
// getHCBasisForArea() in data.js.
//
// Rules (same as the RAG Method tab in the Heads of Areas 26-27 workbook,
// so the Hub and the spreadsheet agree):
//   1. No Health Check evidence: Amber (evidence gap) if the area has
//      recorded RAG scores and a Digital Lead on the Hub, otherwise
//      Red (no evidence).
//   2. Red (practice risk): Health Check basis below 2.5, or half or more
//      of the observed indicator scores at 1 or 2.
//   3. Amber (watch): fewer than 3 staff reviewed, or basis below 3.5.
//   4. Green (on track): everything else.
// Other evidence (recorded RAG scores of 1 or 2, open Immediate AFIs,
// drift, Digital Lead, recent contact) is reported in the rationale as
// "also note" flags. It does not change the band, so the band always has
// one traceable reason.
//
// As at a date (v1.1): pass asOf ('YYYY-MM-DD') to use only evidence that
// existed by the end of that day. Health Checks by review date, loops
// open on that day, recorded RAG as it stood (from ragSnapshots), DL 1:1s
// and activity by date. Digital Leads have no start date in the Hub, so a
// DL on the Hub now is treated as present at any past date (stated in
// the report method).
//
// Exports: getAreaEvidenceRAG(areaCode, asOf), getAllAreaEvidenceRAG(asOf),
//          renderEvidenceRAGPanel(areaCode), renderEvidenceRAGDashboard(panel),
//          exportEvidenceRAGWorkbook()

const EV_RAG = Object.freeze({
  RULES_VERSION: '1.0',
  RED_BASIS: 2.5,          // below this = Challenged or Urgent on average
  RED_LOW_SHARE: 0.5,      // half or more of indicator scores at 1 or 2
  GREEN_BASIS: 3.5,        // at or above this, with enough coverage
  MIN_STAFF: 3,            // fewer reviewed staff = limited evidence
  RECENT_DAYS: 90,         // window for "recent contact"
  BANDS: {
    red:   { label: 'Red',   order: 0 },
    amber: { label: 'Amber', order: 1 },
    green: { label: 'Green', order: 2 },
  },
});

// ── Small helpers ─────────────────────────────────────────────
function _evEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _evFmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(String(iso).split('T')[0] + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(iso); }
}
function _evPct(x) { return Math.round(x * 100) + '%'; }
function _evNum(x) { return (Math.round(x * 100) / 100).toFixed(2); }
function _evDaysAgo(iso, asOf) {
  if (!iso) return null;
  const t = new Date(String(iso).split('T')[0] + 'T12:00:00').getTime();
  if (isNaN(t)) return null;
  const ref = asOf ? new Date(asOf + 'T12:00:00').getTime() : Date.now();
  return Math.floor((ref - t) / 86400000);
}
// True when a dated record existed by the end of asOf (no asOf = now).
function _evBy(iso, asOf) {
  if (!asOf) return true;
  if (!iso) return false;
  return String(iso).slice(0, 10) <= asOf;
}

// ── Evidence gatherers ────────────────────────────────────────
// Health Check: latest review per staff member (the same set
// getHCBasisForArea uses), so the basis here matches the Hub's own
// Accessibility & Inclusion suggestion.
function _evHealthCheck(areaCode, asOf) {
  const all = (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [];
  const reviews = all.filter(r => r.areaCode === areaCode && _evBy(r.date, asOf));
  const byStaff = {};
  reviews.forEach(r => {
    const key = r.staffId || r.reviewId;
    if (!byStaff[key] || (r.date || '') > (byStaff[key].date || '')) byStaff[key] = r;
  });
  const latest = Object.values(byStaff);

  const staffAvgs = [];
  let scored = 0, low = 0, actions = 0, formal = 0, training = 0;
  const refs = [];
  const signals = [];
  latest.forEach(r => {
    const avgs = [];
    Object.values(r.domains || {}).forEach(d => {
      const sp = typeof hcSignalPriority === 'function' ? hcSignalPriority(d) : null;
      if (sp != null) signals.push(sp);
      Object.values(d.indicatorScores || {}).forEach(v => {
        if (typeof v === 'number') { scored++; if (v <= 2) low++; }
      });
      if (d.avgScore != null) avgs.push(d.avgScore);
      if (d.actionIdentified) actions++;
      const lvl = String(d.actionLevel || '');
      if (/formal/i.test(lvl)) formal++;
      if (/training/i.test(lvl)) training++;
    });
    if (avgs.length) staffAvgs.push(avgs.reduce((a, b) => a + b, 0) / avgs.length);
  });
  reviews.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).forEach(r => {
    refs.push({
      kind: 'Health Check',
      date: r.date || '',
      ref: r.baselineSourceRowId != null ? `Form response ${r.baselineSourceRowId}` : `Review ${String(r.reviewId || '').slice(0, 8)}`,
      reviewId: r.reviewId,
    });
  });

  const dates = reviews.map(r => r.date).filter(Boolean).sort();
  return {
    reviewCount: reviews.length,
    staffCount: staffAvgs.length,
    basis: staffAvgs.length ? staffAvgs.reduce((a, b) => a + b, 0) / staffAvgs.length : null,
    scoredItems: scored,
    lowShare: scored ? low / scored : null,
    actions, formal, training,
    // Copilot workbook support priority (support-priority.js), 1 to 7.
    supportPriority: signals.length ? signals.reduce((a, b) => a + b, 0) / signals.length : null,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
    refs,
  };
}

// Recorded scores as they stood at asOf. Each saved version of a
// dimension (current, plus every ragSnapshots entry) carries updatedAt;
// the version in force is the newest one updated by asOf. Versions with
// no updatedAt (early imports) count as in force from the start.
function _evDimsAsOf(area, asOf) {
  if (!asOf) return area.ragDimensions || {};
  const versions = {};
  const add = (dims) => Object.entries(dims || {}).forEach(([id, v]) => {
    if (v && typeof v.score === 'number') (versions[id] = versions[id] || []).push(v);
  });
  add(area.ragDimensions);
  (area.ragSnapshots || []).forEach(sn => add(sn.dimensions));
  const out = {};
  Object.entries(versions).forEach(([id, list]) => {
    const ok = list.filter(v => !v.updatedAt || String(v.updatedAt).slice(0, 10) <= asOf)
      .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
    if (ok.length) out[id] = ok[ok.length - 1];
  });
  return out;
}

function _evRecordedRAG(area, asOf) {
  const dims = _evDimsAsOf(area, asOf);
  const scored = (typeof RAG_DIMENSIONS !== 'undefined' ? RAG_DIMENSIONS : [])
    .map(d => ({ id: d.id, label: d.label, score: dims[d.id] && dims[d.id].score, updatedAt: dims[d.id] && dims[d.id].updatedAt }))
    .filter(d => typeof d.score === 'number');
  if (!scored.length) return null;
  const updated = scored.map(d => d.updatedAt).filter(Boolean).sort();
  return {
    mean: scored.reduce((a, d) => a + d.score, 0) / scored.length,
    count: scored.length,
    low: scored.filter(d => d.score <= 2),
    ai: scored.find(d => d.id === 'accessibilityInclusion') || null,
    updatedAt: updated[updated.length - 1] || null,
  };
}

function _evDigitalLead(area, asOf) {
  const dls = (window.DPC_DATA.digitalLeads && window.DPC_DATA.digitalLeads.digitalLeads) || [];
  let dl = area.digitalLeadId ? dls.find(d => d.dlId === area.digitalLeadId) : null;
  if (!dl) dl = dls.find(d => d.areaCode === area.areaCode) || null;
  if (!dl) return { present: false };
  const meetings = (dl.meetingHistory || []).map(m => m.date || m.createdAt).filter(d => d && _evBy(d, asOf)).sort();
  return { present: true, name: dl.name || '', dlId: dl.dlId, meetings: meetings.length, lastMeeting: meetings[meetings.length - 1] || null };
}

function _evActivity(area, asOf) {
  const log = (area.activityLog || []).filter(a => a && a.date && _evBy(a.date, asOf));
  const dates = log.map(a => a.date).sort();
  const recent = log.filter(a => { const d = _evDaysAgo(a.date, asOf); return d != null && d <= EV_RAG.RECENT_DAYS; });
  return { count: log.length, recent: recent.length, lastDate: dates[dates.length - 1] || null };
}

// Open at asOf: raised by then, and not closed by then.
function _evAFIOpenAt(a, asOf) {
  if (!asOf) return a.status !== 'closed';
  if (!_evBy(a.createdAt, asOf)) return false;
  if (a.status !== 'closed') return true;
  return !a.closedAt || String(a.closedAt).slice(0, 10) > asOf;
}
function _evAFIs(areaCode, asOf) {
  const afis = ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || [])
    .filter(a => a.areaCode === areaCode && _evAFIOpenAt(a, asOf) && (typeof isGapAFI !== 'function' || isGapAFI(a)));
  const immediate = afis.filter(a => typeof AFI_SEVERITY !== 'undefined' && a.severity === AFI_SEVERITY.IMMEDIATE);
  return { open: afis.length, immediate: immediate.length, immediateItems: immediate };
}

// ── Engine ────────────────────────────────────────────────────
function getAreaEvidenceRAG(areaCode, asOf) {
  const area = typeof _getArea === 'function' ? _getArea(areaCode) : null;
  if (!area) return null;

  const hc  = _evHealthCheck(areaCode, asOf);
  const rec = _evRecordedRAG(area, asOf);
  const dl  = _evDigitalLead(area, asOf);
  const act = _evActivity(area, asOf);
  const afi = _evAFIs(areaCode, asOf);
  // Drift compares against now, so it only makes sense for a live view.
  const drift = !asOf && typeof getRAGDrift === 'function' ? getRAGDrift(areaCode) : null;

  let band, label, reason;
  if (hc.staffCount === 0) {
    if (rec && dl.present) {
      band = 'amber'; label = 'Amber: evidence gap';
      reason = 'No Health Checks yet, but the area has recorded RAG scores and a Digital Lead on the Hub.';
    } else {
      band = 'red'; label = 'Red: no evidence';
      const missing = [!rec ? 'no recorded RAG scores' : null, !dl.present ? 'no Digital Lead on the Hub' : null].filter(Boolean);
      reason = `No Health Checks and ${missing.join(' and ')}, so there is nothing to judge practice by.`;
    }
  } else if (hc.basis < EV_RAG.RED_BASIS || (hc.lowShare != null && hc.lowShare >= EV_RAG.RED_LOW_SHARE)) {
    band = 'red'; label = 'Red: practice risk';
    reason = hc.basis < EV_RAG.RED_BASIS
      ? `Observed accessibility practice averages ${_evNum(hc.basis)} out of 5, below Developing.`
      : `${_evPct(hc.lowShare)} of observed indicator scores are 1 or 2.`;
  } else if (hc.staffCount < EV_RAG.MIN_STAFF || hc.basis < EV_RAG.GREEN_BASIS) {
    band = 'amber'; label = 'Amber: watch';
    reason = hc.staffCount < EV_RAG.MIN_STAFF
      ? `Only ${hc.staffCount} staff reviewed, too few to judge the area.`
      : `Observed practice averages ${_evNum(hc.basis)} out of 5: Developing, not yet On Track.`;
  } else {
    band = 'green'; label = 'Green: on track';
    reason = `${hc.staffCount} staff reviewed, averaging ${_evNum(hc.basis)} out of 5.`;
  }

  // Rationale: the deciding reason first, then supporting evidence.
  const rationale = [reason];
  if (hc.staffCount > 0) {
    rationale.push(`Health Checks: ${hc.reviewCount} check${hc.reviewCount === 1 ? '' : 's'} covering ${hc.staffCount} staff, ${_evFmtDate(hc.firstDate)}${hc.lastDate !== hc.firstDate ? ' to ' + _evFmtDate(hc.lastDate) : ''}. ${hc.lowShare != null ? _evPct(hc.lowShare) + ' of indicator scores at 1 or 2.' : ''}${hc.formal ? ` ${hc.formal} formal follow-up${hc.formal === 1 ? '' : 's'} raised.` : ''}`.trim());
  }
  if (rec) {
    const aiNote = rec.ai ? ` Accessibility & Inclusion recorded as ${rec.ai.score}${hc.basis != null ? `, observed ${_evNum(hc.basis)}` : ''}.` : '';
    rationale.push(`Recorded RAG: ${rec.count} of ${RAG_DIMENSIONS.length} dimensions scored, average ${(Math.round(rec.mean * 10) / 10).toFixed(1)}${rec.updatedAt ? ', last updated ' + _evFmtDate(rec.updatedAt) : ''}.${aiNote}`);
  } else {
    rationale.push('Recorded RAG: no dimension scores saved for this area yet.');
  }
  rationale.push(dl.present ? `Digital Lead: ${dl.name || 'on the Hub'}${dl.lastMeeting ? ', last 1:1 ' + _evFmtDate(dl.lastMeeting) : ''}.` : 'Digital Lead: none on the Hub.');

  const flags = [];
  if (hc.supportPriority != null && hc.supportPriority >= 4) {
    flags.push(`Support priority ${_evNum(hc.supportPriority)} out of 7 (${hc.supportPriority >= 5 ? 'Urgent: direct intervention' : 'High: targeted coaching'}).`);
  }
  if (rec && rec.low.length) flags.push(`Recorded as 1 or 2 on ${rec.low.map(d => d.label).join(', ')}.`);
  if (afi.immediate) flags.push(`${afi.immediate} open Immediate improvement loop${afi.immediate === 1 ? '' : 's'}.`);
  if (rec && rec.ai && hc.basis != null && Math.abs(hc.basis - rec.ai.score) >= 1) {
    flags.push(`Observed accessibility (${_evNum(hc.basis)}) differs from the recorded score (${rec.ai.score}) by a full point or more. Worth reviewing the RAG Matrix.`);
  }
  if (drift && drift.state === 'ok' && drift.tier !== 'quiet') {
    flags.push(`Health Check basis has moved ${drift.delta > 0 ? 'up' : 'down'} ${_evNum(Math.abs(drift.delta))} since the RAG was last saved.`);
  }
  if (act.recent === 0) flags.push(act.lastDate ? `No logged activity in the last ${EV_RAG.RECENT_DAYS} days (last ${_evFmtDate(act.lastDate)}).` : 'No activity logged for this area.');

  // Confidence reflects coverage, not the band.
  let confidence;
  if (hc.staffCount >= EV_RAG.MIN_STAFF && rec) confidence = 'High';
  else if (hc.staffCount >= EV_RAG.MIN_STAFF || (hc.staffCount > 0 && rec)) confidence = 'Medium';
  else if (hc.staffCount > 0 || rec) confidence = 'Low';
  else confidence = 'None';

  // Evidence list, newest first.
  const evidence = hc.refs.slice();
  if (rec) evidence.push({ kind: 'RAG Matrix', date: rec.updatedAt || '', ref: `${rec.count} recorded dimension score${rec.count === 1 ? '' : 's'}` });
  afi.immediateItems.forEach(a => evidence.push({ kind: 'Loop (Immediate)', date: a.createdAt || '', ref: String(a.description || '').slice(0, 80) }));
  if (act.lastDate) evidence.push({ kind: 'Activity log', date: act.lastDate, ref: `${act.count} entr${act.count === 1 ? 'y' : 'ies'}, ${act.recent} in the last ${EV_RAG.RECENT_DAYS} days` });
  if (dl.lastMeeting) evidence.push({ kind: 'Digital Lead 1:1', date: dl.lastMeeting, ref: dl.name || '' });
  evidence.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    areaCode: area.areaCode, areaName: area.areaName, hoaName: area.hoaName || '',
    band, label, reason, rationale, flags, confidence, evidence,
    hc, recorded: rec, dl, activity: act, afi,
    rulesVersion: EV_RAG.RULES_VERSION, computedAt: nowISO(), asOf: asOf || null,
  };
}

function getAllAreaEvidenceRAG(asOf) {
  const areas = (typeof _getAreas === 'function' ? _getAreas() : []) || [];
  // Practice risk before no evidence: an area with evidence of weak
  // practice is more urgent than one we simply have not seen yet.
  const rank = { 'Red: practice risk': 0, 'Red: no evidence': 1, 'Amber: watch': 2, 'Amber: evidence gap': 3, 'Green: on track': 4 };
  return areas.map(a => getAreaEvidenceRAG(a.areaCode, asOf)).filter(Boolean).sort((x, y) =>
    (rank[x.label] ?? 9) - (rank[y.label] ?? 9) ||
    (x.hc.basis == null ? -1 : x.hc.basis) - (y.hc.basis == null ? -1 : y.hc.basis) ||
    x.areaCode.localeCompare(y.areaCode));
}

// ── Rendering ─────────────────────────────────────────────────
function _evBadge(r) {
  return `<span class="ev-rag ev-rag--${r.band}">${_evEsc(r.label)}</span>`;
}

function _evRationaleHTML(r) {
  return `
    <ul class="ev-rag-list">${r.rationale.map(t => `<li>${_evEsc(t)}</li>`).join('')}</ul>
    ${r.flags.length ? `<p class="ev-rag-subhead">Also note</p><ul class="ev-rag-list">${r.flags.map(t => `<li>${_evEsc(t)}</li>`).join('')}</ul>` : ''}`;
}

function _evEvidenceHTML(r) {
  if (!r.evidence.length) return '<p class="ev-rag-muted">No evidence records for this area yet.</p>';
  return `<table class="ev-rag-table">
    <caption class="sr-only">Evidence used for ${_evEsc(r.areaCode)}</caption>
    <thead><tr><th scope="col">Date</th><th scope="col">Source</th><th scope="col">Record</th></tr></thead>
    <tbody>${r.evidence.map(e => `<tr><td>${_evEsc(_evFmtDate(e.date)) || 'Undated'}</td><td>${_evEsc(e.kind)}</td><td>${_evEsc(e.ref)}</td></tr>`).join('')}</tbody>
  </table>`;
}

// Panel for the area RAG Matrix tab. Returns an HTML string.
function renderEvidenceRAGPanel(areaCode) {
  const r = getAreaEvidenceRAG(areaCode);
  if (!r) return '';
  return `
    <section class="ev-rag-card" aria-labelledby="ev-rag-title-${_evEsc(areaCode)}">
      <div class="ev-rag-head">
        <h4 id="ev-rag-title-${_evEsc(areaCode)}" class="ev-rag-title">Evidence-based suggestion</h4>
        ${_evBadge(r)}
        <span class="ev-rag-muted">Confidence: ${_evEsc(r.confidence)}</span>
      </div>
      ${_evRationaleHTML(r)}
      <details class="ev-rag-details">
        <summary>Evidence used (${r.evidence.length})</summary>
        ${_evEvidenceHTML(r)}
      </details>
      <p class="ev-rag-muted">A suggestion only. Your recorded scores below are not changed. Rules v${EV_RAG.RULES_VERSION}: see the Areas at Risk dashboard for how bands are worked out.</p>
    </section>`;
}

// Full dashboard view: summary counts, filters, one row per area.
function renderEvidenceRAGDashboard(panel) {
  if (!panel) return;
  const all = getAllAreaEvidenceRAG();
  const count = b => all.filter(r => r.band === b).length;

  panel.innerHTML = `
    <p style="font-size:var(--text-sm);color:var(--color-slate);margin-bottom:var(--space-md);max-width:70ch;">
      A suggested RAG for every area, worked out from Health Checks, recorded RAG scores, Digital Leads, loops and activity.
      Nothing here is saved to the areas. Use it to decide where to go next, then update the RAG Matrix yourself.
    </p>
    <div class="ev-rag-summary" role="group" aria-label="Areas by suggested RAG">
      <div class="ev-rag-stat ev-rag--red"><span class="ev-rag-stat__n">${count('red')}</span> Red</div>
      <div class="ev-rag-stat ev-rag--amber"><span class="ev-rag-stat__n">${count('amber')}</span> Amber</div>
      <div class="ev-rag-stat ev-rag--green"><span class="ev-rag-stat__n">${count('green')}</span> Green</div>
    </div>
    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:center;margin:var(--space-md) 0;">
      <label for="ev-rag-filter" style="font-size:var(--text-sm);font-weight:bold;">Show</label>
      <select id="ev-rag-filter" class="form-select" style="width:auto;min-height:40px;font-size:var(--text-sm);">
        <option value="">All areas</option>
        <option value="red">Red only</option>
        <option value="amber">Amber only</option>
        <option value="green">Green only</option>
        <option value="practice">Practice risk only</option>
        <option value="gap">Evidence gaps only</option>
      </select>
      <button type="button" id="ev-rag-export" class="btn btn--ghost btn--sm">Download as spreadsheet</button>
    </div>
    <div id="ev-rag-rows" style="overflow-x:auto;"></div>
    <details class="ev-rag-details" style="margin-top:var(--space-lg);">
      <summary>How the suggested RAG is worked out</summary>
      <ol class="ev-rag-list">
        <li>No Health Check evidence: Amber (evidence gap) if the area has recorded RAG scores and a Digital Lead on the Hub. Otherwise Red (no evidence).</li>
        <li>Red (practice risk): observed accessibility practice averages below ${EV_RAG.RED_BASIS}, or ${_evPct(EV_RAG.RED_LOW_SHARE)} or more of indicator scores are 1 or 2.</li>
        <li>Amber (watch): fewer than ${EV_RAG.MIN_STAFF} staff reviewed, or an average below ${EV_RAG.GREEN_BASIS}.</li>
        <li>Green (on track): ${EV_RAG.MIN_STAFF} or more staff reviewed and an average of ${EV_RAG.GREEN_BASIS} or above.</li>
      </ol>
      <p class="ev-rag-muted">The average uses the latest Health Check for each staff member, the same figure the RAG Matrix suggests for Accessibility & Inclusion. Recorded scores of 1 or 2, open Immediate loops, drift and recent contact are listed under "Also note" but do not change the band. Confidence shows how much evidence sits behind the suggestion. Scale: 1 Urgent to 5 Confident.</p>
    </details>`;

  const draw = () => {
    const f = document.getElementById('ev-rag-filter')?.value || '';
    const rows = all.filter(r => !f ||
      (f === 'practice' ? r.label === 'Red: practice risk' :
       f === 'gap' ? /evidence/.test(r.label) : r.band === f));
    document.getElementById('ev-rag-rows').innerHTML = rows.length ? `
      <table class="ev-rag-table ev-rag-table--wide">
        <caption class="sr-only">Suggested RAG by area, Red first</caption>
        <thead><tr>
          <th scope="col">Area</th><th scope="col">Suggested RAG</th><th scope="col">Why</th>
          <th scope="col">Staff reviewed</th><th scope="col">Practice average</th><th scope="col">Confidence</th>
        </tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <th scope="row"><button type="button" class="ev-rag-link" data-area-code="${_evEsc(r.areaCode)}">${_evEsc(r.areaCode)}</button><span class="ev-rag-muted"> ${_evEsc(r.areaName)}</span></th>
            <td>${_evBadge(r)}</td>
            <td>
              <p style="margin:0 0 4px;">${_evEsc(r.reason)}</p>
              <details class="ev-rag-details"><summary>Rationale and evidence</summary>${_evRationaleHTML(r)}${_evEvidenceHTML(r)}</details>
            </td>
            <td style="text-align:center;">${r.hc.staffCount}</td>
            <td style="text-align:center;">${r.hc.basis != null ? _evNum(r.hc.basis) : 'None'}</td>
            <td>${_evEsc(r.confidence)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<p class="ev-rag-muted">No areas match this filter.</p>';
  };
  draw();
  document.getElementById('ev-rag-filter')?.addEventListener('change', draw);
  document.getElementById('ev-rag-export')?.addEventListener('click', exportEvidenceRAGWorkbook);
  const rowsEl = document.getElementById('ev-rag-rows');
  if (rowsEl && !rowsEl._evWired) {
    rowsEl._evWired = true;
    rowsEl.addEventListener('click', e => {
      const btn = e.target.closest('.ev-rag-link');
      if (btn && typeof openAreaProfile === 'function') openAreaProfile(btn.dataset.areaCode, 'rag');
    });
  }
}

// Spreadsheet with the same columns as the dashboard, plus the full
// rationale and evidence, for sharing or for the HoA workbook.
function exportEvidenceRAGWorkbook() {
  if (typeof XLSX === 'undefined') {
    if (typeof UI !== 'undefined') UI.showToast('error', 'Spreadsheet library did not load. Refresh and try again.');
    return;
  }
  const all = getAllAreaEvidenceRAG();
  const rows = [['Area code', 'Area', 'Head of Area', 'Suggested RAG', 'Deciding reason', 'Confidence',
    'Staff reviewed', 'Checks', 'Practice average (1 to 5)', 'Indicator scores at 1 or 2',
    'Recorded RAG average', 'Recorded A&I score', 'Digital Lead', 'Rationale', 'Also note', 'Evidence']];
  all.forEach(r => rows.push([
    r.areaCode, r.areaName, r.hoaName, r.label, r.reason, r.confidence,
    r.hc.staffCount, r.hc.reviewCount,
    r.hc.basis != null ? Math.round(r.hc.basis * 100) / 100 : '',
    r.hc.lowShare != null ? Math.round(r.hc.lowShare * 100) / 100 : '',
    r.recorded ? Math.round(r.recorded.mean * 10) / 10 : '',
    r.recorded && r.recorded.ai ? r.recorded.ai.score : '',
    r.dl.present ? (r.dl.name || 'Yes') : 'None',
    r.rationale.join(' '), r.flags.join(' '),
    r.evidence.map(e => `${_evFmtDate(e.date) || 'Undated'}: ${e.kind}, ${e.ref}`).join('; '),
  ]));
  const method = [
    ['How the suggested RAG is worked out (rules v' + EV_RAG.RULES_VERSION + ')'],
    ['1. No Health Check evidence: Amber (evidence gap) if the area has recorded RAG scores and a Digital Lead on the Hub. Otherwise Red (no evidence).'],
    [`2. Red (practice risk): practice average below ${EV_RAG.RED_BASIS}, or ${EV_RAG.RED_LOW_SHARE * 100}% or more of indicator scores at 1 or 2.`],
    [`3. Amber (watch): fewer than ${EV_RAG.MIN_STAFF} staff reviewed, or an average below ${EV_RAG.GREEN_BASIS}.`],
    [`4. Green (on track): ${EV_RAG.MIN_STAFF} or more staff reviewed and an average of ${EV_RAG.GREEN_BASIS} or above.`],
    ['Practice average uses the latest Health Check per staff member. Scale: 1 Urgent, 2 Challenged, 3 Developing, 4 On Track, 5 Confident.'],
    ['Generated from the DPC Hub on ' + _evFmtDate(todayISO()) + '. Suggestions only; recorded RAG scores were not changed.'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [8, 28, 14, 20, 50, 11, 9, 8, 12, 12, 12, 12, 18, 80, 60, 80].map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, ws, 'Suggested RAG');
  const ms = XLSX.utils.aoa_to_sheet(method);
  ms['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ms, 'Method');
  XLSX.writeFile(wb, `suggested-rag-${todayISO()}.xlsx`);
}
