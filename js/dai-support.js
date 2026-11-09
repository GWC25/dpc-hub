// DPC Hub · js/dai-support.js · v1.3 · 09/11/26 · actions and resources carry a stable key; progress column and Still to do / Done filter (dai-actions.js)
// v1.2 · 09/11/26 · theme table: people count opens the list of names with their confidence
// v1.1 · 09/11/26 · split into tab panels; planning prompt on every action, resource and need (dai-prompts.js)
// v1.0 · 09/11/26 · DA&I support recommendations: themes, format, urgency, campus and area grouping; priorities from targets
//
// Turns each person's latest "How's it going" response into support needs,
// then recommends the format and where to run it.
//
// A need is one person and one theme. Themes are the 11 DA&I elements plus
// Immersive Reader. A person needs support on a theme when:
//   - they rated that element 1 or 2, or
//   - their support request text mentions it, or
//   - one of their targets mentions it and they rated that target 3 or below.
//
// Urgency (higher = sooner):
//   (6 - confidence) + 1 if they asked for support on it + 1 if it is one of
//   their targets. Confidence is the lowest of their element rating and the
//   target rating; 3 if neither was given. Bands: 6+ High, 4.5+ Medium, else Low.
//
// Format:
//   Coaching   theme is complex (3) and confidence 3 or below; or confidence
//              1 on a moderate or complex theme; or 5+ elements rated 1 or 2
//              (a broad need is better met by one coach than many videos)
//   How-To video   moderate theme (2), or confidence 2 or below
//   How-To guide sheet   everything else (simple theme, some confidence)
//   A format the person asked for ("video", "guide", "coaching", "1:1")
//   replaces the suggestion, and the reason says so.
//
// Grouping: the same theme for DSU_TEACHMEET or more people on one campus
// suggests a Teach Meet there; DSU_DROPIN or more, a drop-in. The same theme
// for DSU_AREA or more people in one area suggests a session with that team.
// Campus comes from the staff profile, else the area's campus.
//
// Public: daiSupportNeeds(), daiSupportForStaff(staffId), daiSupportParts(), daiPromptSpec(i),
//         daiFillPriorities(staffIds?), DSU_THEMES

const DSU_TEACHMEET = 5;
const DSU_DROPIN = 3;
const DSU_AREA = 3;
const DSU_RESOURCE = 5; // people needing the same video or guide before suggesting you make one

// complexity: 1 simple (a few clicks), 2 moderate (a process or tool to learn), 3 complex (changes how resources are designed)
const DSU_THEMES = Object.freeze([
  { id: 'altText',         label: 'Alt text',               complexity: 1, re: /alt[\s-]?text|alternative text|describ\w* (the )?images?|image descriptions?/ },
  { id: 'slideTitles',     label: 'Slide titles',           complexity: 1, re: /slide titles?|titles? (on|for) (each|every|all|my) slides?|unique titles?/ },
  { id: 'hyperlinks',      label: 'Clear hyperlinks',       complexity: 1, re: /hyper ?links?|link text|links? (that|which) make sense|click here/ },
  { id: 'checker',         label: 'Accessibility Checker',  complexity: 1, re: /accessibility checker|\bchecker\b|check(ing)? (for )?accessibility/ },
  { id: 'immersiveReader', label: 'Immersive Reader',       complexity: 1, re: /immersive reader|read aloud|reading aloud/ },
  { id: 'readingOrder',    label: 'PowerPoint reading order', complexity: 2, re: /reading order/ },
  { id: 'headings',        label: 'Heading styles',         complexity: 2, re: /headings?|heading styles?|built-?in styles?/ },
  { id: 'tableHeader',     label: 'Table headers',          complexity: 2, re: /table headers?|header rows?/ },
  { id: 'mergedCells',     label: 'Merged or split cells',  complexity: 2, re: /merged|split cells?/ },
  { id: 'contrast',        label: 'Colour contrast',        complexity: 2, re: /contrast|colou?r scheme|colou?rs? (of|on) (text|slides|backgrounds?)/ },
  { id: 'captions',        label: 'Captions',               complexity: 2, re: /captions?|subtitles?|transcripts?/ },
  { id: 'cognitiveLoad',   label: 'Cognitive Load Theory',  complexity: 3, re: /cognitive|overload|load theory|chunk(ing)?|too much on (a|the|each) slide/ },
]);
const DSU_FORMATS = Object.freeze({ coaching: 'Coaching', video: 'How-To video', guide: 'How-To guide sheet' });
const DSU_COMPLEXITY = Object.freeze({ 1: 'Simple', 2: 'Moderate', 3: 'Complex' });

function _dsuThemesIn(text) {
  const t = String(text || '').toLowerCase();
  return t ? DSU_THEMES.filter(th => th.re.test(t)).map(th => th.id) : [];
}
function _dsuAsked(text) {
  const t = String(text || '').toLowerCase();
  if (/coach|1:1|1-1|one[\s-]to[\s-]one|someone to (show|sit)|in person/.test(t)) return 'coaching';
  if (/video/.test(t)) return 'video';
  if (/guide|sheet|written|step[\s-]by[\s-]step|instructions?/.test(t)) return 'guide';
  return null;
}
function _dsuCampus(staffId, areaCode) {
  const s = _daiStaffList().find(x => x.staffId === staffId);
  if (s && s.campus) return s.campus;
  const a = _daiAreaList().find(x => x.areaCode === areaCode);
  return (a && a.campus) || 'Unassigned';
}

// ── Needs ─────────────────────────────────────────────────────
function daiSupportNeeds() {
  const out = [];
  _daiLatest('reflection').forEach(r => {
    const staff = _daiStaffList().find(s => s.staffId === r.staffId);
    const name = staff ? staff.name : (r.name || 'Unknown');
    const areaCode = r.areaCode || (staff && staff.areaCode) || '';
    const els = _daiElements(r);
    const lowCount = Object.values(els).filter(v => v <= 2).length;
    const askedText = [r.supportWanted, r.supportDetail].filter(Boolean).join(' ');
    const askedThemes = new Set(_dsuThemesIn(r.supportDetail));
    const askedFormat = _dsuAsked(askedText);
    const targets = _daiTargets(r);
    const byTheme = new Map();
    const get = id => { if (!byTheme.has(id)) byTheme.set(id, { element: null, target: null, targetText: '', asked: false }); return byTheme.get(id); };
    Object.entries(els).forEach(([id, v]) => { if (DSU_THEMES.some(t => t.id === id)) get(id).element = v; });
    targets.forEach(t => _dsuThemesIn(t.text).forEach(id => {
      const g = get(id);
      if (g.target == null || (t.confidence != null && t.confidence < g.target)) { g.target = t.confidence; g.targetText = t.text; }
      if (!g.targetText) g.targetText = t.text;
    }));
    askedThemes.forEach(id => { get(id).asked = true; });

    byTheme.forEach((g, id) => {
      const theme = DSU_THEMES.find(t => t.id === id);
      const inTarget = !!g.targetText;
      const known = [g.element, g.target].filter(v => v != null);
      const conf = known.length ? Math.min(...known) : 3;
      const needed = (g.element != null && g.element <= 2) || g.asked || (inTarget && conf <= 3);
      if (!needed) return;
      const urgency = (6 - conf) + (g.asked ? 1 : 0) + (inTarget ? 1 : 0);
      let format, why;
      if (theme.complexity === 3 && conf <= 3) { format = 'coaching'; why = 'complex theme, low confidence'; }
      else if (conf <= 1 && theme.complexity >= 2) { format = 'coaching'; why = 'no confidence on a theme with several steps'; }
      else if (lowCount >= 5) { format = 'coaching'; why = `${lowCount} elements rated 1 or 2, a broad need`; }
      else if (theme.complexity === 2 || conf <= 2) { format = 'video'; why = theme.complexity === 2 ? 'a process best seen step by step' : 'low confidence'; }
      else { format = 'guide'; why = 'simple theme, some confidence'; }
      if (askedFormat && askedFormat !== format) { why = `they asked for ${DSU_FORMATS[askedFormat].toLowerCase()} (suggested ${DSU_FORMATS[format].toLowerCase()})`; format = askedFormat; }
      out.push({
        staffId: r.staffId, name, areaCode, campus: _dsuCampus(r.staffId, areaCode),
        theme: id, themeLabel: theme.label, complexity: theme.complexity,
        confidence: known.length ? conf : null, element: g.element, target: g.target, targetText: g.targetText,
        asked: g.asked, inTarget, urgency, band: urgency >= 6 ? 'High' : urgency >= 4.5 ? 'Medium' : 'Low',
        format, why,
      });
    });
  });
  return out.sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name));
}

function daiSupportForStaff(staffId) { return daiSupportNeeds().filter(n => n.staffId === staffId); }

// ── Group recommendations ─────────────────────────────────────
function _dsuGroup(needs, keyFn) {
  const m = new Map();
  needs.forEach(n => { const k = keyFn(n); if (!m.has(k)) m.set(k, []); m.get(k).push(n); });
  return m;
}
function _dsuActions(needs) {
  const acts = [];
  const sum = list => list.reduce((a, n) => a + n.urgency, 0);
  const people = list => [...new Map(list.map(n => [n.staffId, n])).values()].sort((a, b) => a.name.localeCompare(b.name));
  _dsuGroup(needs, n => n.campus + '|' + n.theme).forEach((list, k) => {
    const ps = people(list); const [campus] = k.split('|');
    if (campus === 'Unassigned' || ps.length < DSU_DROPIN) return;
    const tm = ps.length >= DSU_TEACHMEET;
    acts.push({ key: `campus|${campus}|${list[0].theme}`, themeIds: [list[0].theme], kind: tm ? 'Teach Meet' : 'Drop-in', where: campus, theme: list[0].themeLabel, people: ps, score: sum(list),
      text: `${tm ? 'Run a Teach Meet' : 'Hold a drop-in'} at ${campus} on ${list[0].themeLabel}`,
      prompt: { kind: tm ? 'teachmeet' : 'dropin', themes: [list[0].theme], needs: list, campus } });
  });
  _dsuGroup(needs, n => n.areaCode + '|' + n.theme).forEach((list, k) => {
    const ps = people(list); const [area] = k.split('|');
    if (!area || ps.length < DSU_AREA) return;
    // Already covered by a campus Teach Meet or drop-in on the same theme.
    const ids = new Set(ps.map(p => p.staffId));
    if (acts.some(a => (a.kind === 'Teach Meet' || a.kind === 'Drop-in') && a.theme === list[0].themeLabel && [...ids].every(id => a.people.some(p => p.staffId === id)))) return;
    acts.push({ key: `area|${area}|${list[0].theme}`, themeIds: [list[0].theme], kind: 'Area session', where: area, theme: list[0].themeLabel, people: ps, score: sum(list),
      text: `Session with the ${area} team on ${list[0].themeLabel}`,
      prompt: { kind: 'area', themes: [list[0].theme], needs: list, areaCode: area } });
  });
  _dsuGroup(needs.filter(n => n.format !== 'coaching'), n => n.format + '|' + n.theme).forEach((list, k) => {
    const ps = people(list); const [fmt] = k.split('|');
    if (ps.length < DSU_RESOURCE) return;
    acts.push({ key: `res|${fmt}|${list[0].theme}`, themeIds: [list[0].theme], kind: DSU_FORMATS[fmt], where: 'College-wide', theme: list[0].themeLabel, people: ps, score: sum(list),
      text: `Make or share a ${DSU_FORMATS[fmt].toLowerCase()} on ${list[0].themeLabel}`,
      prompt: { kind: fmt, themes: [list[0].theme], needs: list } });
  });
  _dsuGroup(needs.filter(n => n.format === 'coaching'), n => n.staffId).forEach(list => {
    acts.push({ key: `coach|${list[0].staffId}`, themeIds: list.map(n => n.theme), kind: 'Coaching', where: list[0].areaCode || 'No area', theme: list.map(n => n.themeLabel).join(', '), people: [list[0]], score: sum(list),
      text: `Coach ${list[0].name}`,
      prompt: { kind: 'coaching', themes: list.map(n => n.theme), needs: list, staffId: list[0].staffId } });
  });
  return acts.sort((a, b) => b.score - a.score);
}

// ── Tab panels (called from dai.js) ───────────────────────────
// Every prompt button carries an index into this list, rebuilt on each render.
let _dsuCampusFilter = '';
let _dsuPrompts = [];
function daiPromptSpec(i) { return _dsuPrompts[i] || null; }
function _dsuPromptBtn(spec, what) {
  _dsuPrompts.push(spec);
  return `<button type="button" class="btn btn--ghost btn--sm" data-dsu-prompt="${_dsuPrompts.length - 1}" aria-label="Planning prompt: ${_daiEsc(what)}" style="min-height:32px;white-space:nowrap;">Planning prompt</button>`;
}
const _dsuH3 = (t, top) => `<h2 style="font-size:var(--text-lg);font-weight:var(--font-bold);color:var(--color-navy);margin:${top ? 'var(--space-lg)' : '0'} 0 var(--space-xs);">${t}</h2>`;
const _dsuP = t => `<p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-sm);max-width:70ch;">${t}</p>`;
const _dsuNames = ps => ps.slice().sort((a, b) => a.name.localeCompare(b.name)).map(_daiPersonBtn).join(', ');
const _dsuWho = ps => ps.length > 1 ? `<details><summary style="cursor:pointer;min-height:24px;">${ps.length} people</summary>${_dsuNames(ps)}</details>` : _dsuNames(ps);
const _dsuPeople = list => [...new Map(list.map(n => [n.staffId, n])).values()];

function daiSupportParts() {
  _dsuPrompts = [];
  if (typeof daiActionResetRows === 'function') daiActionResetRows();
  const hasAct = typeof daiActionStatusCell === 'function';
  const passes = key => !hasAct || daiActionPasses(key);
  const progress = (key, label, themeIds, people) => hasAct ? daiActionStatusCell(key, label, themeIds, people) : '';
  const needs = daiSupportNeeds();
  const none = _dsuP('No support needs found in the "How\'s it going" responses yet.');
  if (!needs.length) return { actions: none, resources: none, themes: none, areaNeeds: none, campus: none, person: none };
  const acts = _dsuActions(needs);

  const shownActs = acts.filter(a => passes(a.key));
  const actRows = shownActs.map(a => `<tr>${_daiTd(`<strong>${_daiEsc(a.text)}</strong>`)}${_daiTd(_daiEsc(a.kind))}${_daiTd(Math.round(a.score))}${_daiTd(_dsuWho(a.people))}${_daiTd(_dsuPromptBtn(a.prompt, a.text))}${_daiTd(progress(a.key, a.text, a.themeIds, a.people), 'min-width:180px;')}</tr>`);
  const actions = _dsuH3('What to do next') + _dsuP(`Highest total urgency first. A Teach Meet is suggested when ${DSU_TEACHMEET} or more people on one campus share a need, a drop-in for ${DSU_DROPIN} or 4, an area session for ${DSU_AREA} or more in one area, and a resource when ${DSU_RESOURCE} or more people need the same one. Planning prompt gives you text to paste into Claude or Copilot.`)
    + (hasAct ? daiActionFilterHTML('dac-filter-actions') : '')
    + (actRows.length ? _daiTable('Recommended support actions, most urgent first', ['Action', 'Type', 'Urgency', 'Who', 'Plan it', 'Progress'], actRows, 1000) : _dsuP(daiActionFilter() === 'done' ? 'No actions marked done yet.' : 'Every recommended action is marked done.'));

  // Resources: every format and theme, however few people, so nothing is hidden by a threshold.
  const resGroups = [..._dsuGroup(needs, n => n.format + '|' + n.theme).entries()].map(([k, list]) => ({ fmt: k.split('|')[0], list, ps: _dsuPeople(list), score: list.reduce((x, n) => x + n.urgency, 0) }))
    .sort((a, b) => b.ps.length - a.ps.length || b.score - a.score);
  const fmtBlock = fmt => {
    const keyOf = x => fmt === 'coaching' ? `coachgroup|${x.list[0].theme}` : `res|${fmt}|${x.list[0].theme}`;
    const g = resGroups.filter(x => x.fmt === fmt && passes(keyOf(x)));
    if (!g.length) return '';
    const rows = g.map(x => `<tr>${_daiTd(_daiEsc(x.list[0].themeLabel))}${_daiTd(x.ps.length)}${_daiTd(x.list.filter(n => n.band === 'High').length)}${_daiTd(_daiFmt(_daiAvg(x.list.map(n => n.confidence))))}${_daiTd(_dsuWho(x.ps))}${_daiTd(fmt === 'coaching'
      ? _dsuPromptBtn({ kind: 'coachgroup', themes: [x.list[0].theme], needs: x.list }, `coaching on ${x.list[0].themeLabel}`)
      : _dsuPromptBtn({ kind: fmt, themes: [x.list[0].theme], needs: x.list }, `${DSU_FORMATS[fmt]} on ${x.list[0].themeLabel}`))}${_daiTd(progress(keyOf(x), `${DSU_FORMATS[fmt]} on ${x.list[0].themeLabel}`, [x.list[0].theme], x.ps), 'min-width:180px;')}</tr>`);
    return _dsuH3(DSU_FORMATS[fmt] + (fmt === 'coaching' ? '' : 's'), true) + _daiTable(`${DSU_FORMATS[fmt]} needs by theme`, ['Theme', 'People', 'High urgency', 'Average confidence', 'Who', 'Plan it', 'Progress'], rows, 940);
  };
  const resBlocks = fmtBlock('video') + fmtBlock('guide') + fmtBlock('coaching');
  const resources = _dsuP('Every recommended resource and coaching need, grouped by type and theme, however few people need it. Mark one done when you have made or shared it; a video or guide marked done here is also done in "What to do next".')
    + (hasAct ? daiActionFilterHTML('dac-filter-resources') : '')
    + (resBlocks || _dsuP(daiActionFilter() === 'done' ? 'Nothing marked done yet.' : 'Everything here is marked done.'));

  const themeRows = [..._dsuGroup(needs, n => n.theme).entries()].map(([id, list]) => ({ th: DSU_THEMES.find(t => t.id === id), list }))
    .sort((a, b) => b.list.length - a.list.length).map(({ th, list }) => {
      const c = f => list.filter(n => n.format === f).length;
      const top = ['video', 'guide', 'coaching'].sort((a, b) => c(b) - c(a))[0];
      const spec = { kind: top === 'coaching' ? 'coachgroup' : top, themes: [th.id], needs: list };
      const who = list.slice().sort((a, b) => (a.confidence ?? 9) - (b.confidence ?? 9) || a.name.localeCompare(b.name))
        .map(n => `<li style="padding:2px 0;">${_daiPersonBtn(n)} <span style="color:var(--color-muted);">${_daiEsc(n.areaCode || '')}${n.confidence != null ? `, confidence ${n.confidence}` : ''}</span></li>`).join('');
      return `<tr>${_daiTd(_daiEsc(th.label))}${_daiTd(`<details><summary style="cursor:pointer;min-height:24px;color:var(--color-teal);font-weight:bold;">${list.length} <span class="sr-only">people, show who</span></summary><ul style="list-style:none;margin-top:var(--space-xs);">${who}</ul></details>`)}${_daiTd(list.filter(n => n.band === 'High').length)}${_daiTd(_daiFmt(_daiAvg(list.map(n => n.confidence))))}${_daiTd(DSU_COMPLEXITY[th.complexity])}${_daiTd(`${c('coaching')} coaching, ${c('video')} video, ${c('guide')} guide`)}${_daiTd(_dsuPromptBtn(spec, `${DSU_FORMATS[top]} on ${th.label}`))}</tr>`;
    });
  const themes = _dsuH3('Support needs by theme') + _dsuP('Planning prompt uses the format most of these people need.') + _daiTable('Support needs grouped by theme', ['Theme', 'People', 'High urgency', 'Average confidence', 'Complexity', 'Recommended formats', 'Plan it'], themeRows, 860);

  const arRows = [..._dsuGroup(needs, n => (n.areaCode || '') + '|' + n.theme).entries()].map(([k, list]) => ({ code: k.split('|')[0], list, ps: _dsuPeople(list) }))
    .sort((a, b) => a.code.localeCompare(b.code) || b.ps.length - a.ps.length)
    .map(x => `<tr>${_daiTd(x.code ? `<strong>${_daiEsc(x.code)}</strong> ${_daiEsc(_daiAreaName(x.code))}` : 'No area')}${_daiTd(_daiEsc(x.list[0].themeLabel))}${_daiTd(x.ps.length)}${_daiTd(_dsuWho(x.ps))}${_daiTd(x.code && x.ps.length >= 2 ? _dsuPromptBtn({ kind: 'area', themes: [x.list[0].theme], needs: x.list, areaCode: x.code }, `${x.code} session on ${x.list[0].themeLabel}`) : '')}</tr>`);
  const areaNeeds = _dsuH3('Support needs by area', true) + _daiTable('Support needs by area and theme', ['Area', 'Theme', 'People', 'Who', 'Plan it'], arRows, 760);

  const campuses = [...new Set(needs.map(n => n.campus))].sort();
  const filtered = _dsuCampusFilter ? needs.filter(n => n.campus === _dsuCampusFilter) : needs;
  const camRows = [..._dsuGroup(filtered, n => n.campus + '|' + n.theme).entries()].map(([k, list]) => ({ campus: k.split('|')[0], list, ps: _dsuPeople(list) }))
    .sort((a, b) => a.campus.localeCompare(b.campus) || b.ps.length - a.ps.length)
    .map(x => {
      const un = x.campus === 'Unassigned';
      const kind = x.ps.length >= DSU_TEACHMEET ? 'teachmeet' : 'dropin';
      const rec = un ? 'Set a campus on the profile or area' : x.ps.length >= DSU_TEACHMEET ? 'Teach Meet' : x.ps.length >= DSU_DROPIN ? 'Drop-in' : 'Individual support';
      return `<tr>${_daiTd(_daiEsc(x.campus))}${_daiTd(_daiEsc(x.list[0].themeLabel))}${_daiTd(x.ps.length)}${_daiTd(_daiEsc(rec))}${_daiTd(_dsuWho(x.ps))}${_daiTd(!un && x.ps.length >= DSU_DROPIN ? _dsuPromptBtn({ kind, themes: [x.list[0].theme], needs: x.list, campus: x.campus }, `${rec} at ${x.campus} on ${x.list[0].themeLabel}`) : '')}</tr>`;
    });
  const campus = `<div class="form-group" style="max-width:320px;"><label class="form-label" for="dsu-campus">Show campus</label>
      <select id="dsu-campus" class="form-select"><option value="">All campuses</option>${campuses.map(c => `<option value="${_daiEsc(c)}"${c === _dsuCampusFilter ? ' selected' : ''}>${_daiEsc(c)}</option>`).join('')}</select></div>
    ${_daiTable('Support needs by campus and theme', ['Campus', 'Theme', 'People', 'Suggested', 'Who', 'Plan it'], camRows, 820)}`;

  const perRows = needs.map(n => `<tr>${_daiTd(_daiPersonBtn(n))}${_daiTd(_daiEsc(n.areaCode))}${_daiTd(_daiEsc(n.themeLabel))}${_daiTd(n.confidence == null ? '–' : n.confidence)}${_daiTd(_daiEsc(n.band))}${_daiTd(`<strong>${_daiEsc(DSU_FORMATS[n.format])}</strong><br><span style="color:var(--color-muted);">${_daiEsc(n.why)}</span>`)}${_daiTd(_dsuPromptBtn(n.format === 'coaching' ? { kind: 'coaching', themes: [n.theme], needs: [n], staffId: n.staffId } : { kind: n.format, themes: [n.theme], needs: [n] }, `${DSU_FORMATS[n.format]} on ${n.themeLabel} for ${n.name}`))}</tr>`);
  const person = _dsuH3(`Every need, by person (${needs.length})`, true) + _daiTable('Each person\'s support needs, most urgent first', ['Name', 'Area', 'Theme', 'Confidence', 'Urgency', 'Recommended', 'Plan it'], perRows, 900);

  return { actions, resources, themes, areaNeeds, campus, person };
}

function daiWireSupportSection() {
  const sel = document.getElementById('dsu-campus');
  if (sel) sel.addEventListener('change', () => { _dsuCampusFilter = sel.value; if (typeof _daiRenderBody === 'function') _daiRenderBody(); document.getElementById('dsu-campus')?.focus(); });
}

// Staff profile: recommended support list (inside the DA&I card).
function daiSupportStaffHTML(staffId) {
  const list = daiSupportForStaff(staffId);
  if (!list.length) return '';
  return `<h4 style="font-size:var(--text-sm);font-weight:var(--font-bold);color:var(--color-navy);margin-top:var(--space-md);">Recommended support</h4>
    <ul style="margin:var(--space-xs) 0 0 var(--space-lg);font-size:var(--text-sm);">${list.map(n => `<li style="margin-bottom:var(--space-xs);"><strong>${_daiEsc(DSU_FORMATS[n.format])}</strong> on ${_daiEsc(n.themeLabel)} <span style="color:var(--color-muted);">(${_daiEsc(n.band.toLowerCase())} urgency; ${_daiEsc(n.why)})</span></li>`).join('')}</ul>`;
}

// ── Development priorities from DA&I targets ─────────────────
// Fills only empty priority slots and never repeats a target already
// there. Uses each person's latest "How's it going" targets.
function daiFillPriorities(staffIds) {
  const only = staffIds ? new Set(staffIds) : null;
  const staff = _daiStaffList();
  let people = 0, filled = 0;
  _daiLatest('reflection').forEach(r => {
    if (only && !only.has(r.staffId)) return;
    const s = staff.find(x => x.staffId === r.staffId);
    if (!s) return;
    const pr = Array.isArray(s.developmentPriorities) ? s.developmentPriorities.slice(0, 3) : [];
    while (pr.length < 3) pr.push('');
    const have = new Set(pr.filter(Boolean).map(x => x.trim().toLowerCase()));
    let changed = false;
    _daiTargets(r).forEach(t => {
      const text = t.text.trim();
      if (!text || have.has(text.toLowerCase())) return;
      const slot = pr.findIndex(x => !x || !x.trim());
      if (slot < 0) return;
      pr[slot] = text; have.add(text.toLowerCase()); changed = true; filled++;
    });
    if (changed) { s.developmentPriorities = pr; s.lastUpdated = nowISO(); people++; }
  });
  if (people && typeof saveStaffBulk === 'function') saveStaffBulk();
  return { people, filled };
}
