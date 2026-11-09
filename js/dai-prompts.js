// DPC Hub · js/dai-prompts.js · v1.0 · 09/11/26 · planning prompts for DA&I support (video, guide sheet, coaching, Teach Meet, drop-in, area session)
//
// Builds a prompt Graeme can paste into Claude or Copilot to plan the
// resource or session the Hub recommends. The prompt carries what the data
// shows (how many people, which areas or campus, their confidence, what
// they wrote in their targets and support requests) but never a name or an
// email: people are described by area only, and email addresses are removed
// from anything staff wrote.
//
// Public: daiPromptBuild(spec), daiPromptOpen(spec, triggerEl)
// spec = { kind: 'video'|'guide'|'coaching'|'coachgroup'|'teachmeet'|'dropin'|'area',
//          themes: [themeId], needs: [need from daiSupportNeeds()], campus?, areaCode?, staffId? }

// What a resource on each theme should cover. Menu locations are left to
// the AI to check against current Microsoft guidance, because they differ
// between the desktop apps and the browser versions and change over time.
const DAI_PROMPT_THEME_NOTES = Object.freeze({
  altText: 'Writing short, meaningful alt text that says what the image is for in this resource; marking decorative images as decorative; not starting with "image of"; describing charts by their key message; where to add alt text in Word and PowerPoint.',
  slideTitles: 'Giving every slide a unique title using the slide title placeholder; why screen reader users navigate by titles; hiding a title visually without deleting it if the design needs it; checking titles in Outline view.',
  hyperlinks: 'Link text that makes sense on its own instead of "click here" or a raw web address; editing the display text of a link; telling learners when a link opens a file or a new window.',
  checker: 'Opening the Accessibility Checker; what errors, warnings and tips mean; using the recommended fixes; keeping it running while working; what it cannot check (meaning of alt text, sense of reading order, plain language), so a human still checks.',
  immersiveReader: 'Opening Immersive Reader in Word, OneNote, Teams and Edge; read aloud, text spacing, line focus, syllables, picture dictionary and translate; how learners can use it independently; how teachers model it in class.',
  readingOrder: 'Why screen readers read objects in the order they were added, not the order they appear; checking and fixing order with the PowerPoint Reading Order pane; grouped objects and text boxes; testing with read aloud.',
  headings: 'Using built-in Heading styles instead of bold or bigger text; keeping heading levels in order; the Navigation Pane as a check; changing the look by modifying the style, not each heading.',
  tableHeader: 'Setting a header row so screen readers announce column headings; repeating the header row across pages; keeping tables for data, not layout; adding a short description of what the table shows.',
  mergedCells: 'Why merged and split cells confuse screen readers; restructuring a table with merged cells into a simple grid or separate tables; checking with the Accessibility Checker.',
  contrast: 'WCAG 2.2 AA contrast: at least 4.5 to 1 for normal text and 3 to 1 for large text; checking contrast with a contrast checker; text over images; never using colour as the only way to show meaning.',
  captions: 'Turning on and editing automatic captions for videos (for example in Stream and Teams recordings); checking caption accuracy for subject vocabulary; live subtitles in PowerPoint; providing a transcript for audio.',
  cognitiveLoad: 'Cognitive load theory for resource design: reducing extraneous load (clutter, decoration, split attention, redundant text read aloud), managing intrinsic load (chunking, worked examples, sequencing), and one idea per slide; linking to explicit instruction and checking for understanding.',
});

function _dpEsc(v) { return _daiEsc(v); }
function _dpClean(text) {
  return String(text || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]').replace(/\s+/g, ' ').trim();
}
function _dpList(items) { return items.map(x => `- ${x}`).join('\n'); }

function _dpFacts(spec) {
  const needs = spec.needs || [];
  const people = [...new Map(needs.map(n => [n.staffId, n])).values()];
  const themeIds = [...new Set(spec.themes || needs.map(n => n.theme))];
  const themeLabels = themeIds.map(id => (DSU_THEMES.find(t => t.id === id) || {}).label || id);
  const areas = [...new Set(people.map(p => p.areaCode).filter(Boolean))].map(c => `${c} (${_daiAreaName(c)})`);
  const conf = [1, 2, 3, 4, 5].map(v => ({ v, n: needs.filter(n => n.confidence === v).length })).filter(x => x.n);
  const bands = ['High', 'Medium', 'Low'].map(b => ({ b, n: needs.filter(n => n.band === b).length })).filter(x => x.n);
  const asked = needs.filter(n => n.asked).length;

  // What staff wrote, without names: their own targets and support requests that mention the theme.
  const refl = new Map(_daiLatest('reflection').map(r => [r.staffId, r]));
  const said = new Set(), targets = new Set();
  people.forEach(p => {
    const r = refl.get(p.staffId);
    if (!r) return;
    _daiTargets(r).forEach(t => { if (_dsuThemesIn(t.text).some(id => themeIds.includes(id))) targets.add(_dpClean(t.text)); });
    if (r.supportDetail && (_dsuThemesIn(r.supportDetail).some(id => themeIds.includes(id)) || people.length === 1)) said.add(_dpClean(r.supportDetail));
  });
  return { people, themeIds, themeLabels, areas, conf, bands, asked, said: [...said].slice(0, 10), targets: [...targets].slice(0, 10) };
}

const DAI_PROMPT_CONTEXT = `Context about me and my setting:
- I am a Digital Pedagogy Coach in a UK further education college. Staff use Microsoft 365 (Word, PowerPoint, Teams, Stream, OneNote), some in the desktop apps and some in the browser versions.
- Teaching, learning and assessment come first and digital second: always say why the skill helps learners, not only how to do it.
- Everything must meet WCAG 2.2 AA, including the resource itself.
- Where steps differ between the desktop apps and the browser versions, show both, and check menu names and locations against current Microsoft support guidance rather than guessing.
- Staff-facing PowerPoint body text about 24pt, Word 12pt, readable from the back of the room. If you suggest a set of resources, they must all carry the same steps and guidance.
- Write in British English and plain language. Do not use em dashes or en dashes.`;

function daiPromptBuild(spec) {
  const f = _dpFacts(spec);
  const theme = f.themeLabels.join(', ');
  const notes = f.themeIds.map(id => DAI_PROMPT_THEME_NOTES[id]).filter(Boolean);
  const who = f.people.length === 1
    ? `one member of staff${f.areas.length ? ` from ${f.areas[0]}` : ''}`
    : `${f.people.length} members of staff${f.areas.length ? ` from ${f.areas.length > 6 ? `${f.areas.length} curriculum areas` : f.areas.join(', ')}` : ''}`;

  const evidence = [
    `Who needs it: ${who}${spec.campus ? `, based at ${spec.campus} campus` : ''}.`,
    f.conf.length ? `Their confidence on ${theme} after the training (1 = not confident, 5 = very confident): ${f.conf.map(x => `${x.n} at ${x.v}`).join(', ')}.` : '',
    f.bands.length ? `Urgency: ${f.bands.map(x => `${x.n} ${x.b.toLowerCase()}`).join(', ')}.` : '',
    f.asked ? `${f.asked} of them asked for support with this directly.` : '',
  ].filter(Boolean);
  const words = [
    f.targets.length ? `Targets they set themselves:\n${_dpList(f.targets.map(t => `"${t}"`))}` : '',
    f.said.length ? `What they said they need support with:\n${_dpList(f.said.map(t => `"${t}"`))}` : '',
  ].filter(Boolean).join('\n\n');
  const cover = notes.length ? `It should cover:\n${_dpList(notes)}` : '';

  let task;
  switch (spec.kind) {
    case 'video':
      task = `Help me plan a short How-To video on ${theme} for college teaching staff.

Give me:
1. The learning outcome in one sentence.
2. A 15-second opening on why this matters for learners.
3. A script and shot list, step by step: what is on screen and what I say. Show the desktop app first, then the browser version where it differs.
4. The two or three most common mistakes, and how to show them on screen.
5. A 30-second recap and one quick check question staff can answer afterwards.
6. How to make the video itself accessible: captions checked for accuracy, zoomed and readable screen, no reliance on colour, a transcript.
7. A matching one-page guide sheet outline with the same steps, so the two resources carry the same information.
Keep the video to between 2 and 4 minutes.`;
      break;
    case 'guide':
      task = `Help me write a How-To guide sheet on ${theme} for college teaching staff: one page, two at most, as a Word document in 12pt.

Structure:
1. Title and one line on why it matters for learners.
2. Numbered steps for the desktop app, then the browser version where it differs.
3. Where a screenshot helps, describe the screenshot and give its alt text.
4. "Check it worked": how staff can confirm they got it right.
5. Common mistakes.
6. Where to get more help.
The guide must itself pass the Accessibility Checker: built-in headings, real lists, meaningful link text, good contrast.`;
      break;
    case 'coaching':
      task = `Help me plan a 30-minute instructional coaching session with one member of staff on ${theme}.

Give me:
1. One clear goal to agree with them, drawn from their own targets.
2. How I model the skill using one of their own teaching resources.
3. Guided practice, then independent practice on their resource.
4. Success criteria we can both see.
5. Three or four coaching questions to open and close the session.
6. A follow-up check in two weeks and the evidence that would show it is embedded in their practice (for example, a fixed resource or a learner's experience).`;
      break;
    case 'coachgroup':
      task = `Several staff need coaching on ${theme}. Help me design a repeatable 30-minute coaching session I can run with each of them.

Give me the shared structure (goal from their own targets, model on their own resource, guided then independent practice, success criteria, coaching questions, two-week follow-up and the evidence of impact), plus how to adapt it for someone starting at confidence 1 compared with someone at 3.`;
      break;
    case 'teachmeet':
      task = `Help me plan a 45-minute Teach Meet on ${theme}${spec.campus ? ` at ${spec.campus} campus` : ''}.

Give me:
1. A session outline with timings: a short hook on why it matters for learners, a live demonstration, hands-on practice on staff's own resources, sharing, and a commitment to one action.
2. A slide outline (PowerPoint body about 24pt, readable from the back of the room).
3. What staff need to bring or have open.
4. A short take-away resource with the same steps.
5. How I capture impact: confidence before and after, and how many resources were fixed.`;
      break;
    case 'dropin':
      task = `Help me plan a 30-minute informal drop-in on ${theme}${spec.campus ? ` at ${spec.campus} campus` : ''}, where staff come and go.

Give me a quick-start card staff can follow on their own, two or three short demos I can repeat as people arrive, a way to work on their own resources one to one, and a simple way to record who came and what they fixed.`;
      break;
    case 'area':
      task = `Help me plan a 45-minute session on ${theme} with the ${spec.areaCode ? `${spec.areaCode} (${_daiAreaName(spec.areaCode)})` : ''} curriculum team.

Use subject-specific examples from that area. Give me a session outline with timings, hands-on practice on the team's own resources, a slide outline (about 24pt body text), a take-away resource with the same steps, and how the team will show progress on their area action plan.`;
      break;
    default:
      task = `Help me plan support for staff on ${theme}.`;
  }

  return [task, cover, `What the data shows:\n${_dpList(evidence)}`, words, DAI_PROMPT_CONTEXT,
    'Ask me up to three questions first if you need more context, then produce the plan.'].filter(Boolean).join('\n\n');
}

// ── Dialog ────────────────────────────────────────────────────
let _dpLastTrigger = null;
function daiPromptOpen(spec, trigger) {
  _dpLastTrigger = trigger || document.activeElement;
  const text = daiPromptBuild(spec);
  let host = document.getElementById('dai-prompt-dialog');
  if (host) host.remove();
  host = document.createElement('div');
  host.id = 'dai-prompt-dialog';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-labelledby', 'dai-prompt-title');
  host.setAttribute('aria-describedby', 'dai-prompt-hint');
  host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:700;display:flex;align-items:center;justify-content:center;padding:var(--space-lg);';
  host.innerHTML = `
    <div style="background:var(--color-white);color:var(--color-slate);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:760px;max-height:90vh;overflow-y:auto;padding:var(--space-xl);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-md);margin-bottom:var(--space-sm);">
        <h2 id="dai-prompt-title" style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-navy);">Planning prompt</h2>
        <button type="button" id="dai-prompt-close" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--color-muted);min-width:44px;min-height:44px;">×</button>
      </div>
      <p id="dai-prompt-hint" style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-md);">Copy this into Claude or Copilot. It describes staff by area only, with no names or emails. You can edit it here before copying.</p>
      <label for="dai-prompt-text" class="form-label">Prompt</label>
      <textarea id="dai-prompt-text" class="form-textarea" rows="18" style="width:100%;font:var(--text-sm)/1.5 Arial,sans-serif;">${_dpEsc(text)}</textarea>
      <p id="dai-prompt-status" role="status" aria-live="polite" style="font-size:var(--text-sm);color:var(--color-teal);min-height:1.5em;margin-top:var(--space-xs);"></p>
      <div class="btn-row" style="margin-top:var(--space-sm);">
        <button type="button" id="dai-prompt-copy" class="btn btn--primary">Copy prompt</button>
        <button type="button" id="dai-prompt-done" class="btn btn--secondary">Close</button>
      </div>
    </div>`;
  document.body.appendChild(host);

  const close = () => { host.remove(); if (_dpLastTrigger && document.body.contains(_dpLastTrigger)) _dpLastTrigger.focus(); };
  host.querySelector('#dai-prompt-close').addEventListener('click', close);
  host.querySelector('#dai-prompt-done').addEventListener('click', close);
  host.addEventListener('click', e => { if (e.target === host) close(); });
  host.querySelector('#dai-prompt-copy').addEventListener('click', async () => {
    const ta = host.querySelector('#dai-prompt-text');
    const status = host.querySelector('#dai-prompt-status');
    try {
      await navigator.clipboard.writeText(ta.value);
      status.textContent = 'Copied. Paste it into Claude or Copilot.';
    } catch {
      ta.focus(); ta.select();
      status.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected prompt.';
    }
  });
  host.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...host.querySelectorAll('button, textarea')].filter(el => !el.disabled);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  host.querySelector('#dai-prompt-copy').focus();
}
