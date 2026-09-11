// DPC Hub · js/incl-issues.js · v1.0 · 09/09/26
// Cross-source issue clustering for accessibility and inclusion.
//
// The v1.0 dashboard read the AFI store only and bucketed by LRA theme,
// which is a category, not an issue. "Inclusive TLA & SEND" is not
// something you can run a training session on. "Alt text on images" is.
//
// The canonical issue list is the Health Check indicator set — those
// statements already exist, are already scored 1-5 per staff member, and
// are already worded the way the college talks about this work. Every
// other store is mapped onto the same list so one issue shows its full
// evidence base:
//
//   Health Checks  → indicator scores (the only staff-level signal)
//   Loops / AFIs   → description text + LRA theme mapping
//   Action Plans   → item descriptions + sourceDomain focus area
//   Learning Walks → summary text + LRA theme ids
//   RAG ratings    → area-level accessibility position, as context
//
// Pure computation. No DOM. Returns data for inclusion.js to render.

// ── Issue taxonomy ────────────────────────────────────────────
// id matches the Health Check indicator id so scores join directly.
// `kw` are lowercase substrings matched against free text from the other
// stores. `lra` are LRA theme ids that imply this issue.
const INCL_ISSUES = Object.freeze([
  { id: 'altTextOnImages', label: 'Alt text on images', focus: 'Accessibility by Design',
    kw: ['alt text', 'alt-text', 'alternative text', 'image description', 'describe the image', 'decorative image'],
    lra: ['ARD'] },
  { id: 'colourContrastChecked', label: 'Colour contrast', focus: 'Accessibility by Design',
    kw: ['colour contrast', 'color contrast', 'contrast ratio', 'contrast check', 'low contrast', 'wcag contrast'],
    lra: ['ARD'] },
  { id: 'usesAccessibilityChecker', label: 'Accessibility Checker before sharing', focus: 'Accessibility by Design',
    kw: ['accessibility checker', 'check accessibility', 'accessibility check', 'run the checker'],
    lra: ['ARD'] },
  { id: 'captionsTranscripts', label: 'Captions and transcripts on video', focus: 'Accessibility by Design',
    kw: ['caption', 'transcript', 'subtitle', 'live captions', 'closed caption'],
    lra: ['ARD'] },
  { id: 'accessibleAssignmentBriefs', label: 'Accessible assignment briefs', focus: 'Accessibility by Design',
    kw: ['assignment brief', 'accessible brief', 'heading structure', 'readable font', 'document structure', 'styles and headings'],
    lra: ['ARD', 'AR'] },
  { id: 'offersImmersiveReader', label: 'Immersive Reader offered', focus: 'Promoting Accessible Practice',
    kw: ['immersive reader', 'read aloud', 'read-aloud', 'text to speech', 'text-to-speech'],
    lra: ['AT'] },
  { id: 'mentionsATTools', label: 'Assistive technology tools in lessons', focus: 'Promoting Accessible Practice',
    kw: ['assistive technology', 'read&write', 'read and write', 'dictate', 'speech to text', 'at tool', 'at tools', 'screen reader'],
    lra: ['AT'] },
  { id: 'accessibilityUniversal', label: 'Accessibility offered to all, not SEND-only', focus: 'Promoting Accessible Practice',
    kw: ['send only', 'send-only', 'universally', 'all learners', 'not just send', 'universal offer'],
    lra: ['AT', 'PL'] },
  { id: 'learnersPersonalise', label: 'Learners personalise their digital environment', focus: 'Promoting Accessible Practice',
    kw: ['personalise', 'personalize', 'adjust their settings', 'own settings', 'learner autonomy', 'independently adjust'],
    lra: ['LED', 'LI2'] },
  { id: 'atEmbeddedRoutine', label: 'AT planned in, not added reactively', focus: 'Promoting Accessible Practice',
    kw: ['embedded into', 'planned into', 'reactive', 'retrofit', 'added afterwards', 'built in from the start'],
    lra: ['AT'] },
  { id: 'awareOfSENDNeeds', label: 'Digital adjustments for SEND needs', focus: 'Inclusive Knowledge and Practice',
    kw: ['send need', 'ehcp', 'reasonable adjustment', 'learning support', 'cohort need', 'send learner'],
    lra: ['PL', 'AP', 'EAS'] },
  { id: 'appliesUDL', label: 'Multiple means of engagement (UDL)', focus: 'Inclusive Knowledge and Practice',
    kw: ['udl', 'universal design', 'multiple means', 'multiple format', 'different format'],
    lra: ['AP', 'SS'] },
  { id: 'digitalAlternatives', label: 'Genuine choice in how learners engage and submit', focus: 'Inclusive Knowledge and Practice',
    kw: ['alternative format', 'choice in how', 'different way to submit', 'submission format', 'offer a choice'],
    lra: ['AP', 'SS'] },
  { id: 'equitableResources', label: 'Plain language and clear layout in resources', focus: 'Inclusive Knowledge and Practice',
    kw: ['plain language', 'plain english', 'clear layout', 'readability', 'jargon', 'simplify the wording', 'easy read'],
    lra: ['AR', 'LL2'] },
  { id: 'inclusionVsSkills', label: 'Digital inclusion vs digital skills understood', focus: 'Inclusive Knowledge and Practice',
    kw: ['digital inclusion', 'digital poverty', 'device access', 'connectivity', 'digital divide'],
    lra: ['LE'] },
  { id: 'communicationAccessible', label: 'Accessible and inclusive communication', focus: 'Effective Digital Communication',
    kw: ['accessible communication', 'inclusive language', 'tone of posts', 'clear communication'],
    lra: ['LED', 'PR'] },
  { id: 'digitalNavigation', label: 'Digital navigation and Teams structure', focus: 'Inclusive Learning Environment',
    kw: ['navigat', 'find resources', 'fewest clicks', 'teams structure', 'folder structure', 'channel structure', 'hard to find', 'signpost'],
    lra: ['LED', 'LE'] },
]);

// Health Check score at or below this counts as a development need.
const INCL_HC_THRESHOLD = 3;

// ── Engine ────────────────────────────────────────────────────
function inclBuildIssues() {
  const issues = {};
  for (const def of INCL_ISSUES) {
    issues[def.id] = {
      ...def,
      areas: new Set(),
      signals: [],                       // every matched record, with its origin
      bySource: {},                      // source key → count
      hcScores: [],                      // numeric scores for this indicator
      hcBelow: 0,                        // staff scoring at or below threshold
    };
  }

  const add = (issueId, source, signal, areaCode) => {
    const it = issues[issueId];
    if (!it) return;
    it.signals.push({ ...signal, source });
    it.bySource[source] = (it.bySource[source] || 0) + 1;
    if (areaCode) it.areas.add(areaCode);
  };

  const norm = (...parts) => parts.filter(Boolean).join(' ').toLowerCase();
  const matchText = text => INCL_ISSUES.filter(d => d.kw.some(k => text.includes(k))).map(d => d.id);
  const matchThemes = themeIds => {
    if (!themeIds || !themeIds.length) return [];
    return INCL_ISSUES.filter(d => d.lra.some(t => themeIds.includes(t))).map(d => d.id);
  };

  // Precision first. An LRA theme like ARD maps to five different issues,
  // so using theme and keyword together made a single record about alt text
  // fire as evidence for colour contrast, captions and the Accessibility
  // Checker as well — inflating every area count. If the text names the
  // issue, trust the text. Fall back to the theme only when nothing in the
  // wording identifies which issue it is, and label that match weaker so an
  // inferred cluster is never presented as a specific finding.
  const resolve = (text, themeIds) => {
    const byText = matchText(text);
    if (byText.length) return byText.map(id => ({ id, match: 'keyword' }));
    return matchThemes(themeIds).map(id => ({ id, match: 'theme' }));
  };

  // ── 1. Health Checks — the only staff-level signal ──────────
  const reviews = (window.DPC_DATA.healthChecks && window.DPC_DATA.healthChecks.reviews) || [];
  for (const r of reviews) {
    const domains = r.domains || {};
    for (const focusId of Object.keys(domains)) {
      const scores = (domains[focusId] || {}).indicatorScores || {};
      for (const [indId, score] of Object.entries(scores)) {
        const it = issues[indId];
        if (!it || score == null) continue;
        it.hcScores.push(score);
        if (score <= INCL_HC_THRESHOLD) {
          it.hcBelow++;
          add(indId, 'health-check', {
            title: `Scored ${score} of 5`,
            detail: r.staffName || r.staffId || 'Staff member',
            date: r.date || r.createdAt || null,
            areaCode: r.areaCode || null,
            score,
          }, r.areaCode);
        } else if (r.areaCode) {
          // A strong score still tells us the area has been assessed.
          it.areas.add(r.areaCode);
        }
      }
    }
  }

  // ── 2. Loops / AFIs — gaps only ─────────────────────────────
  const gaps = (typeof getGapAFIs === 'function')
    ? getGapAFIs()
    : ((window.DPC_DATA.afi && window.DPC_DATA.afi.afis) || []).filter(a => a.severity !== 'Strength');
  for (const a of gaps) {
    const text = norm(a.description, a.digitalOpportunity, a.lraThemeLabel);
    for (const m of resolve(text, [a.lraThemeId])) {
      add(m.id, 'loop', {
        title: a.description || a.lraThemeLabel || 'Loop',
        detail: `${a.severity || 'Unrated'} · ${a.status || 'open'}`,
        date: a.createdAt || null,
        areaCode: a.areaCode || null,
        refId: a.afiId,
        match: m.match,
      }, a.areaCode);
    }
  }

  // ── 3. Action Plans ─────────────────────────────────────────
  const plans = (window.DPC_DATA.actionPlans && window.DPC_DATA.actionPlans.plans) || [];
  for (const p of plans) {
    for (const item of (p.items || [])) {
      const text = norm(item.description, item.sourceDomain, p.focus, p.aim);
      let matches = matchText(text).map(id => ({ id, match: 'keyword' }));
      // sourceDomain carries the Health Check focus area label. Use it only
      // when the wording itself identifies nothing, for the same reason as
      // the LRA themes above — otherwise one action attaches to all five
      // issues in its focus area.
      if (!matches.length && item.sourceDomain) {
        matches = INCL_ISSUES
          .filter(d => d.focus.toLowerCase() === String(item.sourceDomain).toLowerCase())
          .map(d => ({ id: d.id, match: 'theme' }));
      }
      for (const m of matches) {
        add(m.id, 'action-plan', {
          title: item.description || 'Action',
          detail: item.done ? 'Complete' : (item.accountableName || 'Open action'),
          date: item.timeframe || p.createdAt || null,
          areaCode: p.areaCode || null,
          refId: p.planId,
          match: m.match,
        }, p.areaCode);
      }
    }
  }

  // ── 4. Learning Walks (from the area activity log) ──────────
  const areas = ((window.DPC_DATA.areas && window.DPC_DATA.areas.areas) || []).filter(a => !a.archived);
  for (const area of areas) {
    for (const act of (area.activityLog || [])) {
      if (act.type !== 'learning-walk') continue;
      const text = norm(act.summary, act.notes, act.title);
      const themeIds = [...(act.lraThemeIds || []), ...(act.hyperThemes || [])];
      for (const m of resolve(text, themeIds)) {
        add(m.id, 'learning-walk', {
          title: act.summary || act.title || 'Learning Walk',
          detail: m.match === 'theme' ? 'Learning Walk — matched on theme, not wording' : 'Learning Walk',
          date: act.date || act.createdAt || null,
          areaCode: area.areaCode,
          refId: act.activityId || act.id,
          match: m.match,
        }, area.areaCode);
      }
    }
  }

  // ── 5. RAG ratings — area-level context, not an issue signal ─
  const ragWeak = [];
  for (const area of areas) {
    const cur = (area.ragRatings && area.ragRatings.current) || {};
    const acc = cur.accessibilityHealth;
    if (acc != null && acc <= 2) {
      ragWeak.push({ areaCode: area.areaCode, areaName: area.areaName, score: acc });
    }
  }

  // ── Shape the output ────────────────────────────────────────
  const rows = Object.values(issues).map(it => {
    const areaList = [...it.areas].sort();
    const hcAvg = it.hcScores.length
      ? it.hcScores.reduce((a, b) => a + b, 0) / it.hcScores.length
      : null;
    return {
      id: it.id, label: it.label, focus: it.focus,
      areaCount: areaList.length, areaList,
      signalCount: it.signals.length,
      signals: it.signals,
      exactCount: it.signals.filter(s => s.match !== 'theme').length,
      inferredCount: it.signals.filter(s => s.match === 'theme').length,
      bySource: it.bySource,
      sourceCount: Object.keys(it.bySource).length,
      hcAvg, hcCount: it.hcScores.length, hcBelow: it.hcBelow,
    };
  }).filter(r => r.signalCount > 0 || r.hcCount > 0);

  rows.sort((a, b) =>
    (b.areaCount - a.areaCount) ||
    (b.signalCount - a.signalCount) ||
    ((a.hcAvg ?? 9) - (b.hcAvg ?? 9)));

  // Which stores are actually contributing anything at all
  const coverage = {
    'health-check':  reviews.length,
    'loop':          gaps.length,
    'action-plan':   plans.reduce((n, p) => n + (p.items || []).length, 0),
    'learning-walk': areas.reduce((n, a) => n + (a.activityLog || []).filter(x => x.type === 'learning-walk').length, 0),
  };

  return {
    rows,
    ragWeak,
    coverage,
    activeAreas: areas.length,
    totalSignals: rows.reduce((n, r) => n + r.signalCount, 0),
    areasTouched: new Set(rows.flatMap(r => r.areaList)).size,
  };
}

const INCL_SOURCE_LABEL = Object.freeze({
  'health-check':  'Health Check',
  'loop':          'Loop',
  'action-plan':   'Action Plan',
  'learning-walk': 'Learning Walk',
});
