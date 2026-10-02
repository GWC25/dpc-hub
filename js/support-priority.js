// DPC Hub · js/support-priority.js · v1.1 · 02/10/26 · Session RAG-3 — redesigned screen: tiles, ranked cards, phases; detail in expandable sections
// v1.0 · 02/10/26 · Session RAG-3 — Copilot's Health Check support analysis, rebuilt in the Hub
// Rebuilds the analysis in the Copilot workbook "Digital Health Checks"
// (sheets Signals, Area Detail, Dashboard, Support Plan, Design Session)
// so it runs on the Hub's own Health Check records, by Hub area code, and
// updates as soon as a check is imported. Formulas reproduced exactly:
//
//   Signal (one focus area of one check):
//     priority = (6 - average indicator score)
//              + 1 if an action point was identified
//              + 1 more if the action level mentions support or training
//     Range 1 to 7. Higher = greater support need.
//   Area / staff priority = average of their signals.
//   Main support need = focus area of the highest signal (last one wins
//     on a tie, as Copilot's XLOOKUP searches from the end).
//   Example / top recommendation = that signal's Priority Next Steps,
//     else its action description.
//   Priority band: 5+ Urgent, 4+ High, 3+ Moderate, else Lower.
//   Design session invite: area priority 4.5+, or any individual 4.5+.
//
// Differences from the workbook, on purpose:
//   - Areas are grouped by Hub area code (confirmed at import), not the
//     free-text "Area Name", so Carpentry, Construction and CON400 no
//     longer appear as separate areas.
//   - Each person counts once, from their latest check by the date used,
//     so a repeat check replaces the old picture rather than averaging
//     with it. On the baseline data (one check each) the figures match.
//   - Head of Area comes from the Hub's area record.
//
// Exports: hcSignalPriority(domain), hcReviewPriority(review),
//          hcSupportAnalysis(asOf), hcRefreshPriorityScores(),
//          renderSupportPriorities(panel), exportSupportWorkbook()

const HC_SUPPORT = Object.freeze({
  METHOD: 'copilot-v1',
  INVITE: 4.5,       // design-session threshold, area or individual
  HIGH_CASE: 4.5,    // assessor "high-priority cases"
  BANDS: [
    { min: 5, band: 'Urgent',   label: 'Urgent: direct intervention',   support: '1:1 coaching and resource review', emphasis: 'Start with core accessible-document basics' },
    { min: 4, band: 'High',     label: 'High: targeted coaching',       support: 'Targeted drop-in and action-point check', emphasis: 'Priority coaching on the Checker and structure' },
    { min: 3, band: 'Moderate', label: 'Moderate: monitor and support', support: 'Group workshop and follow-up', emphasis: 'Targeted practice on common design fixes' },
    { min: -Infinity, band: 'Lower', label: 'Lower: maintain and review', support: 'Light-touch review and share good practice', emphasis: 'Targeted practice on common design fixes' },
  ],
});

function _spBand(p) { return HC_SUPPORT.BANDS.find(b => p >= b.min); }
function _spAvg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function _spEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _sp2(x) { return x == null ? '' : (Math.round(x * 100) / 100).toFixed(2); }
function _spPct(x) { return x == null ? '' : Math.round(x * 100) + '%'; }
function _spDomainLabel(id) {
  const fa = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).find(f => f.id === id);
  return fa ? fa.label : id;
}
function _spUniq(a) { return [...new Set(a.filter(Boolean))]; }

// ── Scores ────────────────────────────────────────────────────
function hcSignalPriority(d) {
  if (!d || d.avgScore == null) return null;
  let p = 6 - d.avgScore;
  if (d.actionIdentified === true) {
    p += 1;
    if (/support|training/i.test(String(d.actionLevel || ''))) p += 1;
  }
  return p;
}

// One number per check: the average of its focus-area signals. Replaces
// the earlier first-draft formula in healthcheck.js.
function hcReviewPriority(review) {
  const s = Object.values((review && review.domains) || {}).map(hcSignalPriority).filter(v => v != null);
  return s.length ? _spAvg(s) : null;
}

// Re-scores every stored check with the current method. Run once after
// data loads; only writes when something actually changes.
function hcRefreshPriorityScores() {
  const reviews = (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [];
  let changed = 0;
  reviews.forEach(r => {
    const p = hcReviewPriority(r);
    if (r.priorityMethod !== HC_SUPPORT.METHOD || r.supportPriorityScore !== p) {
      r.supportPriorityScore = p; r.priorityMethod = HC_SUPPORT.METHOD; changed++;
    }
  });
  if (changed && typeof markHealthChecksDirty === 'function') markHealthChecksDirty();
  return changed;
}

// ── Analysis ──────────────────────────────────────────────────
function hcSupportAnalysis(asOf) {
  const day = asOf || (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
  const all = ((window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || []).filter(r => String(r.date || '').slice(0, 10) <= day);
  const areas = (typeof _getAreas === 'function' ? _getAreas(true) : ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || [])) || [];
  const staffList = (window.DPC_DATA.staff && window.DPC_DATA.staff.staff) || [];
  const areaOf = c => areas.find(a => a.areaCode === c) || null;
  const staffOf = id => staffList.find(s => s.staffId === id) || null;

  // Latest check per person.
  const byStaff = {};
  all.forEach(r => { const k = r.staffId || r.reviewId; if (!byStaff[k] || String(r.date) > String(byStaff[k].date)) byStaff[k] = r; });
  const reviews = Object.values(byStaff).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Assessor names are typed into the Form, so "Chrystal" and "Chrystal
  // Bliss" are the same person. A first-name-only entry is merged into the
  // one full name that starts with it; anything ambiguous is left alone.
  const rawAssessors = _spUniq(reviews.map(r => (r.assessorName || '').trim()));
  const assessorName = n => {
    n = (n || '').trim();
    if (!n || n.includes(' ')) return n;
    const full = rawAssessors.filter(x => x.toLowerCase().startsWith(n.toLowerCase() + ' '));
    return full.length === 1 ? full[0] : n;
  };

  // Signals, in review order then focus-area order (matters for ties).
  const order = (typeof HC_FOCUS_AREAS !== 'undefined' ? HC_FOCUS_AREAS : []).map(f => f.id);
  const signals = [];
  reviews.forEach(r => {
    order.forEach(did => {
      const d = (r.domains || {})[did];
      if (!d || d.avgScore == null) return;
      signals.push({
        review: r, areaCode: r.areaCode, staffId: r.staffId, domain: did,
        avg: d.avgScore, lowest: d.lowestScore, action: d.actionIdentified === true,
        level: d.actionLevel || '', priority: hcSignalPriority(d),
        rec: r.priorityNextSteps || d.actionDescription || '',
        assessor: assessorName(r.assessorName),
      });
    });
  });

  const summarise = list => {
    const top = list.reduce((m, s) => (m == null || s.priority >= m.priority ? s : m), null);
    const pr = _spAvg(list.map(s => s.priority));
    return {
      signals: list.length,
      avg: _spAvg(list.map(s => s.avg)),
      lowest: list.length ? Math.min(...list.map(s => s.lowest).filter(v => v != null)) : null,
      actions: list.filter(s => s.action).length,
      actionRate: list.length ? list.filter(s => s.action).length / list.length : null,
      priority: pr,
      band: pr != null ? _spBand(pr) : null,
      mainNeed: top ? _spDomainLabel(top.domain) : '',
      recommendation: top ? top.rec : '',
      assessors: _spUniq(list.map(s => s.assessor)),
    };
  };

  const areaRows = _spUniq(signals.map(s => s.areaCode)).map(code => {
    const list = signals.filter(s => s.areaCode === code);
    const a = areaOf(code);
    return { areaCode: code, areaName: a ? a.areaName : code, hoa: a ? (a.hoaName || '') : '',
      staffReviewed: _spUniq(list.map(s => s.staffId)).length, ...summarise(list) };
  }).sort((x, y) => y.priority - x.priority || x.areaCode.localeCompare(y.areaCode));

  const staffRows = _spUniq(signals.map(s => s.staffId)).map(id => {
    const list = signals.filter(s => s.staffId === id);
    const st = staffOf(id); const r = list[0].review; const a = areaOf(r.areaCode);
    return { staffId: id, name: st ? st.name : 'Unknown', areaCode: r.areaCode, provision: r.provision || '',
      hoa: a ? (a.hoaName || '') : '', date: r.date, reviewId: r.reviewId, ...summarise(list) };
  }).sort((x, y) => y.priority - x.priority || x.name.localeCompare(y.name));

  const assessorRows = _spUniq(signals.map(s => s.assessor)).map(name => {
    const list = signals.filter(s => s.assessor === name);
    const ap = _spAvg(list.map(s => s.priority));
    const high = list.filter(s => s.priority >= HC_SUPPORT.HIGH_CASE).length;
    const codes = _spUniq(list.map(s => s.areaCode));
    return {
      name, signals: list.length, areas: codes, high, avgPriority: ap,
      avg: _spAvg(list.map(s => s.avg)), actionRate: list.filter(s => s.action).length / list.length,
      role: high >= 3 ? 'Lead urgent follow-up for high-priority reviews'
        : ap >= 4 ? 'Prioritise coaching and evidence checks'
        : ap >= 3 ? 'Join calibration with an experienced assessor' : 'Maintain consistency and share examples',
      hoas: _spUniq(codes.map(c => (areaOf(c) || {}).hoaName)),
    };
  }).sort((x, y) => y.avgPriority - x.avgPriority);

  // Design session: areas at 4.5+, or containing anyone at 4.5+.
  const maxStaff = code => Math.max(0, ...staffRows.filter(s => s.areaCode === code).map(s => s.priority));
  const sessionAreas = areaRows.filter(a => a.priority >= HC_SUPPORT.INVITE || maxStaff(a.areaCode) >= HC_SUPPORT.INVITE)
    .map(a => ({ ...a, sortKey: Math.max(a.priority, maxStaff(a.areaCode)),
      why: a.priority >= HC_SUPPORT.INVITE ? 'Area-level support priority' : 'High-priority individual(s) in the area',
      invitees: staffRows.filter(s => s.areaCode === a.areaCode && s.priority >= HC_SUPPORT.INVITE).length,
      emphasis: a.priority >= 5 ? HC_SUPPORT.BANDS[0].emphasis : a.priority >= 4.5 ? HC_SUPPORT.BANDS[1].emphasis : HC_SUPPORT.BANDS[2].emphasis }))
    .sort((x, y) => y.sortKey - x.sortKey);
  const practise = t => {
    t = String(t || '').toLowerCase();
    if (t.includes('colour') || t.includes('color')) return 'Colour contrast and visual design';
    if (t.includes('alt text')) return 'Meaningful alt text and image accessibility';
    if (t.includes('heading')) return 'Headings, structure and readability';
    if (t.includes('checker')) return 'Run and interpret the Accessibility Checker';
    return 'Accessible resource design and checking';
  };
  const sessionPeople = staffRows.filter(s => s.priority >= HC_SUPPORT.INVITE).map(s => ({ ...s,
    why: s.priority >= 5.5 ? 'Urgent: highest individual priority' : 'High individual priority',
    practise: practise(s.recommendation) }));

  const kpis = {
    staff: staffRows.length, areas: areaRows.length, signals: signals.length,
    avg: _spAvg(signals.map(s => s.avg)),
    actionRate: signals.length ? signals.filter(s => s.action).length / signals.length : null,
  };
  const topA = areaRows[0], topS = staffRows[0];
  const finding = !signals.length ? 'No scored Health Checks yet.'
    : `The clearest support need is where practice scores sit below the college average of ${_sp2(kpis.avg)} and action points are identified. `
      + `${topA.areaCode} ${topA.areaName} is the highest-priority area (${_sp2(topA.priority)}), while ${topS.name} has the highest individual priority (${_sp2(topS.priority)}). `
      + `Across ${kpis.signals} scored focus-area reviews, ${_spPct(kpis.actionRate)} include an action point, so support should focus on turning those into checked improvements.`;

  // Implementation sequence (Support Plan), names filled live.
  const sequence = [
    { phase: 1, when: 'Immediate, next 2 weeks', focus: 'Urgent intervention',
      who: [topA && `${topA.areaCode}`, topS && topS.name].filter(Boolean).join('; '),
      action: 'Book 1:1 coaching, review live resources, and fix critical accessibility gaps before further sharing.',
      measure: 'Evidence updated and priority score reduces at next review.' },
    { phase: 2, when: 'Weeks 2 to 4', focus: 'High-priority coaching',
      who: areaRows.slice(1, 5).map(a => a.areaCode).join(', '),
      action: 'Run practical workshops on the Accessibility Checker, alt text, colour contrast, accessible briefs, and Teams and resource structure.',
      measure: 'Each action point has a named owner, deadline, and reviewed evidence.' },
    { phase: 3, when: 'Weeks 4 to 6', focus: 'Individual follow-up',
      who: staffRows.filter(s => s.priority >= 5).slice(1).map(s => s.name).join(', '),
      action: 'Short 30-minute support sessions focused on the AFIs and recommendations already recorded.',
      measure: 'Staff can demonstrate corrected resources and explain inclusive design choices.' },
    { phase: 4, when: 'Ongoing', focus: 'Assessor calibration',
      // Assessors whose reviews carry the most high-priority cases.
      who: assessorRows.filter(a => a.high >= 3 || a.avgPriority >= 4).map(a => a.name).join(', '),
      action: 'Moderate sample reviews, agree thresholds for scores 1 to 5, and standardise action-point wording.',
      measure: 'Greater consistency in scoring and clearer support actions across reviewers.' },
  ];

  return { asOf: day, kpis, finding, areas: areaRows, staff: staffRows, assessors: assessorRows, sessionAreas, sessionPeople, sequence };
}

// ── Screen ────────────────────────────────────────────────────
const SP_AGENDA = Object.freeze([
  ['0 to 5', 'Why this session and expectations', 'Accessibility by Design is a baseline quality standard. Every shared resource should be checked before learners receive it. Each person works on one real resource.'],
  ['5 to 15', 'Run the Accessibility Checker', 'Open Word or PowerPoint, run the Accessibility Checker, tell errors from warnings, fix the highest-impact issues first, and save evidence of the check.'],
  ['15 to 25', 'Structure and readability', 'Use proper headings, avoid text-heavy slides, chunk long instructions, use a readable font size, and make assignment briefs easy to navigate.'],
  ['25 to 33', 'Images and media', 'Add meaningful alt text to images and diagrams, mark decorative images, check captions and transcripts for video, and do not rely on colour alone.'],
  ['33 to 40', 'Colour contrast and visual design', 'Check text and background contrast, avoid text over busy images, use symbols or labels as well as colour, and test on a projector or large screen.'],
  ['40 to 45', 'Commitment and follow-up', 'Each person records one corrected resource, one remaining action, an owner and date, and who will re-check the evidence.'],
]);

function _spTable(caption, head, rows) {
  return `<div class="ms-scroll"><table class="ms-table"><caption class="sr-only">${_spEsc(caption)}</caption>
    <thead><tr>${head.map(h => `<th scope="col">${_spEsc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function _spBadge(b) { return b ? `<span class="sp-band sp-band--${b.band.toLowerCase()}">${_spEsc(b.label)}</span>` : ''; }

// Layout (v1.1): summary tiles, then side-by-side cards with short ranked
// lists (bar + number + band in words, so colour is never the only cue),
// then the next-steps phases. Full plans sit in expandable sections, so
// the page stays short and everything still updates from the import.
function _spBar(p, b) {
  const pct = Math.max(0, Math.min(100, (p / 7) * 100));
  return `<span class="sp-bar" aria-hidden="true"><span class="sp-bar__fill sp-bar__fill--${b.band.toLowerCase()}" style="width:${pct.toFixed(0)}%"></span></span>`;
}
function _spRankList(items, label) {
  if (!items.length) return '<p class="ms-muted">None yet.</p>';
  return `<ol class="sp-rank" aria-label="${_spEsc(label)}">${items.map(it => `
    <li class="sp-rank__row">
      <span class="sp-rank__name">${it.name}</span>
      ${_spBar(it.priority, it.band)}
      <span class="sp-rank__num">${_sp2(it.priority)}</span>
      <span class="sp-band sp-band--${it.band.band.toLowerCase()}">${_spEsc(it.band.band)}</span>
      ${it.sub ? `<span class="sp-rank__sub">${_spEsc(it.sub)}</span>` : ''}
    </li>`).join('')}</ol>`;
}

function renderSupportPriorities(panel) {
  if (!panel) return;
  const an = hcSupportAnalysis();
  const k = an.kpis;
  const link = code => `<button type="button" class="ev-rag-link sp-area" data-area-code="${_spEsc(code)}">${_spEsc(code)}</button>`;
  const bandCount = name => an.areas.filter(a => a.band.band === name).length;
  const staffBand = name => an.staff.filter(s => s.band.band === name).length;

  if (!an.staff.length) {
    panel.innerHTML = '<div class="card"><p>No scored Health Checks yet. Use Health Checks, Import Health Checks to bring in the Forms export from the Data folder.</p></div>';
    return;
  }

  panel.innerHTML = `
    <div class="sp-head">
      <p class="ms-muted">Support need per area and person, 1 to 7: higher means more support needed. Updates with every Health Check import.</p>
      <button type="button" class="btn btn--ghost btn--sm" id="sp-export">Download spreadsheet</button>
    </div>
    <p id="sp-status" role="status" class="ms-muted"></p>

    <div class="sp-tiles" role="group" aria-label="Summary">
      <div class="sp-tile"><span class="sp-tile__n">${k.staff}</span>Staff reviewed</div>
      <div class="sp-tile"><span class="sp-tile__n">${k.areas}</span>Areas reviewed</div>
      <div class="sp-tile"><span class="sp-tile__n">${_sp2(k.avg)}</span>Avg practice score (of 5)</div>
      <div class="sp-tile"><span class="sp-tile__n">${_spPct(k.actionRate)}</span>Reviews with an action point</div>
      <div class="sp-tile sp-tile--urgent"><span class="sp-tile__n">${bandCount('Urgent')}</span>Areas urgent <span class="ms-muted">(${staffBand('Urgent')} staff)</span></div>
      <div class="sp-tile sp-tile--high"><span class="sp-tile__n">${bandCount('High')}</span>Areas high <span class="ms-muted">(${staffBand('High')} staff)</span></div>
    </div>

    <div class="sp-grid">
      <section class="card sp-card" aria-labelledby="sp-areas-h">
        <h3 id="sp-areas-h" class="sp-card__h">Areas needing most support</h3>
        ${_spRankList(an.areas.slice(0, 8).map(a => ({ name: `${link(a.areaCode)} <span class="ms-muted">${_spEsc(a.areaName)}</span>`, priority: a.priority, band: a.band, sub: `${a.staffReviewed} staff · ${a.mainNeed}` })), 'Areas, highest priority first')}
      </section>
      <section class="card sp-card" aria-labelledby="sp-staff-h">
        <h3 id="sp-staff-h" class="sp-card__h">Staff needing most support</h3>
        ${_spRankList(an.staff.slice(0, 8).map(st => ({ name: `${_spEsc(st.name)} <span class="ms-muted">${_spEsc(st.areaCode)}</span>`, priority: st.priority, band: st.band, sub: st.mainNeed })), 'Staff, highest priority first')}
      </section>
    </div>

    <h3 class="sp-section-h">Next steps</h3>
    <div class="sp-phases">
      ${an.sequence.map(sq => `
        <section class="card sp-phase" aria-label="Phase ${sq.phase}: ${_spEsc(sq.focus)}">
          <p class="sp-phase__when">Phase ${sq.phase} · ${_spEsc(sq.when)}</p>
          <p class="sp-phase__focus">${_spEsc(sq.focus)}</p>
          <p class="sp-phase__who">${_spEsc(sq.who || 'None yet')}</p>
          <p class="ms-muted">${_spEsc(sq.action)}</p>
        </section>`).join('')}
    </div>

    <h3 class="sp-section-h">Accessible Design session</h3>
    <div class="sp-tiles sp-tiles--3" role="group" aria-label="Design session invite list">
      <div class="sp-tile"><span class="sp-tile__n">${an.sessionAreas.length}</span>Areas to invite</div>
      <div class="sp-tile"><span class="sp-tile__n">${an.sessionPeople.length}</span>Individuals to invite</div>
      <div class="sp-tile"><span class="sp-tile__n">45</span>Minutes, one live resource each</div>
    </div>

    <div class="sp-more">
      <details class="ev-rag-details"><summary>Area support plan (${an.areas.length})</summary>
        ${_spTable('Area support plan, highest priority first', ['Area', 'Priority', 'Band', 'Avg score', 'Staff', 'Main need', 'Support', 'First action', 'Head of Area'],
          an.areas.map(a => [`${link(a.areaCode)} <span class="ms-muted">${_spEsc(a.areaName)}</span>`, _sp2(a.priority), _spBadge(a.band), _sp2(a.avg), String(a.staffReviewed), _spEsc(a.mainNeed), _spEsc(a.band.support), _spEsc(a.recommendation), _spEsc(a.hoa)]))}
      </details>
      <details class="ev-rag-details"><summary>Individual support plan (${an.staff.length})</summary>
        ${_spTable('Individual support plan', ['Staff member', 'Area', 'Priority', 'Band', 'Avg score', 'Main need', 'Support', 'First action', 'Assessors'],
          an.staff.map(st => [_spEsc(st.name), link(st.areaCode), _sp2(st.priority), _spBadge(st.band), _sp2(st.avg), _spEsc(st.mainNeed), _spEsc(st.band.support), _spEsc(st.recommendation), _spEsc(st.assessors.join('; '))]))}
      </details>
      <details class="ev-rag-details"><summary>Assessor calibration (${an.assessors.length})</summary>
        ${_spTable('Assessor calibration plan', ['Assessor', 'Reviews', 'Areas', 'High-priority cases', 'Avg priority', 'Role'],
          an.assessors.map(x => [_spEsc(x.name), String(x.signals), _spEsc(x.areas.join(', ')), String(x.high), _sp2(x.avgPriority), _spEsc(x.role)]))}
      </details>
      <details class="ev-rag-details"><summary>Design session invite list and agenda</summary>
        ${an.sessionAreas.length ? _spTable('Areas to invite', ['Area', 'Why', 'Priority', 'Individuals', 'Emphasis', 'Head of Area'],
          an.sessionAreas.map(x => [`${link(x.areaCode)} <span class="ms-muted">${_spEsc(x.areaName)}</span>`, _spEsc(x.why), _sp2(x.priority), String(x.invitees), _spEsc(x.emphasis), _spEsc(x.hoa)])) : ''}
        ${an.sessionPeople.length ? _spTable('Individuals to invite', ['Staff member', 'Area', 'Priority', 'Why', 'Practise', 'Follow-up'],
          an.sessionPeople.map(x => [_spEsc(x.name), link(x.areaCode), _sp2(x.priority), _spEsc(x.why), _spEsc(x.practise), _spEsc(x.recommendation)])) : ''}
        ${_spTable('Session agenda', ['Minutes', 'Segment', 'What to include'], SP_AGENDA.map(r => r.map(_spEsc)))}
      </details>
      <details class="ev-rag-details"><summary>How the score is worked out</summary>
        <p class="ms-muted" style="max-width:75ch;">Each focus area of each Health Check scores 6 minus its average, plus 1 if an action point was raised, plus 1 more if the action needs support or training. Areas and staff average their scores, using each person's latest check. Bands: 5 or more Urgent, 4 High, 3 Moderate, below 3 Lower. Same method as the Copilot workbook.</p>
      </details>
    </div>`;

  document.getElementById('sp-export')?.addEventListener('click', () => {
    try { exportSupportWorkbook(); document.getElementById('sp-status').textContent = 'Spreadsheet downloaded.'; }
    catch (e) { console.error(e); document.getElementById('sp-status').textContent = 'Could not build the spreadsheet: ' + e.message; }
  });
  if (!panel._spWired) {
    panel._spWired = true;
    panel.addEventListener('click', e => {
      const btn = e.target.closest('.sp-area');
      if (btn && typeof openAreaProfile === 'function') openAreaProfile(btn.dataset.areaCode, 'healthchecks');
    });
  }
}

// ── Spreadsheet (same sheets as the Copilot workbook) ─────────
function exportSupportWorkbook() {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet library did not load. Refresh and try again.');
  const an = hcSupportAnalysis();
  const r2 = x => (x == null ? '' : Math.round(x * 100) / 100);
  const wb = XLSX.utils.book_new();
  const add = (rows, name, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add([['Accessibility and Inclusion Support Priorities'], [`Generated from the DPC Hub on ${an.asOf}.`], [],
    ['Staff reviewed', an.kpis.staff], ['Areas reviewed', an.kpis.areas], ['Average practice score', r2(an.kpis.avg)], ['Action-point rate', r2(an.kpis.actionRate)], [],
    ['Key finding'], [an.finding], [], ['Phase', 'When', 'Focus', 'Who', 'Action', 'Success measure'],
    ...an.sequence.map(s => [s.phase, s.when, s.focus, s.who, s.action, s.measure])], 'Dashboard', [22, 22, 24, 40, 70, 50]);
  add([['Area code', 'Area', 'Priority', 'Band', 'Avg practice score', 'Lowest seen score', 'Staff reviewed', 'Focus-area reviews', 'Action points', 'Action rate', 'Main support need', 'Recommended support', 'First action', 'Head of Area', 'Assessors'],
    ...an.areas.map(a => [a.areaCode, a.areaName, r2(a.priority), a.band.label, r2(a.avg), a.lowest, a.staffReviewed, a.signals, a.actions, r2(a.actionRate), a.mainNeed, a.band.support, a.recommendation, a.hoa, a.assessors.join('; ')])], 'Area Support Plan', [9, 30, 9, 28, 10, 10, 9, 10, 9, 9, 30, 36, 60, 14, 24]);
  add([['Staff member', 'Area code', 'Provision', 'Priority', 'Band', 'Avg practice score', 'Lowest seen score', 'Action rate', 'Main support need', 'Recommended support', 'First action', 'Head of Area', 'Assessors', 'Check date'],
    ...an.staff.map(s => [s.name, s.areaCode, s.provision, r2(s.priority), s.band.label, r2(s.avg), s.lowest, r2(s.actionRate), s.mainNeed, s.band.support, s.recommendation, s.hoa, s.assessors.join('; '), s.date])], 'Individual Support Plan', [24, 9, 18, 9, 28, 10, 10, 9, 30, 36, 60, 14, 24, 12]);
  add([['Assessor', 'Focus-area reviews', 'Areas covered', 'High-priority cases', 'Avg priority', 'Avg practice score', 'Action-point rate', 'Recommended role', 'Heads of Area covered'],
    ...an.assessors.map(a => [a.name, a.signals, a.areas.join(', '), a.high, r2(a.avgPriority), r2(a.avg), r2(a.actionRate), a.role, a.hoas.join('; ')])], 'Assessor Calibration', [22, 10, 30, 10, 10, 10, 10, 44, 24]);
  add([['Target areas (priority 4.5+, or anyone in the area at 4.5+)'], ['Area code', 'Area', 'Why', 'Area priority', 'Avg score', 'Staff reviewed', 'Individuals to invite', 'Session emphasis', 'Head of Area'],
    ...an.sessionAreas.map(a => [a.areaCode, a.areaName, a.why, r2(a.priority), r2(a.avg), a.staffReviewed, a.invitees, a.emphasis, a.hoa]), [],
    ['Individuals to invite (priority 4.5+)'], ['Staff member', 'Area code', 'Priority', 'Why invite', 'What to practise', 'Follow-up action', 'Attend?'],
    ...an.sessionPeople.map(s => [s.name, s.areaCode, r2(s.priority), s.why, s.practise, s.recommendation, '']), [],
    ['Minutes', 'Segment', 'What to include'], ...SP_AGENDA], 'Design Session', [24, 30, 36, 12, 34, 50, 10, 40, 14]);
  add([['How the support priority is worked out'],
    ['Each focus area of each Health Check: (6 minus the average indicator score), plus 1 if an action point was identified, plus 1 more if the action level mentions support or training. Range 1 to 7.'],
    ['Area and staff priority: the average of their focus-area scores, using each person\'s latest check.'],
    ['Bands: 5 or more Urgent, 4 or more High, 3 or more Moderate, otherwise Lower.'],
    ['Main support need: the focus area with the highest score. First action: that check\'s priority next steps, or its action description.'],
    ['Same method as the Copilot workbook; areas use Hub area codes rather than the free-text area name.']], 'Method', [140]);
  XLSX.writeFile(wb, `support-priorities-${an.asOf}.xlsx`);
}
