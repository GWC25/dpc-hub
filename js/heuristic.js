// DPC Hub · js/heuristic.js · v1.0 · July 2026
// Heuristic rule engine. Imports nothing — uses globals from schema.js.
// Exports: getHeuristicRules(), getQuestionsForTheme(), draftAFI()
// No API calls. No UI logic. Pure rule-based logic only.

// ── Complete rule table ───────────────────────────────────────
// Each rule: { id, lraThemeId, etfStage (null=all), context, condition,
//              followUpQuestions[], afiDraftSeverity, afiDraftDescription,
//              digitalOpportunity (null if not applicable),
//              digitalApplicable (bool), resourceTags[] }

const HEURISTIC_RULES = [

  // ── Effective Questioning (EQ) ────────────────────────────
  { id:'R-EQ-001', lraThemeId:'EQ', etfStage:null, context:'any',
    condition:'Questions posed but no thinking time given',
    followUpQuestions:['How long after asking did you wait before taking an answer?','What did you notice about which learners responded?','What could you do to give all learners thinking time?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Questioning — questions are posed but insufficient thinking time is given before answers are taken. Some learners are not able to engage.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['questioning','thinking-time','wait-time','CAT6'] },

  { id:'R-EQ-002', lraThemeId:'EQ', etfStage:null, context:'any',
    condition:'Only hands-up volunteering — not all learners engaged',
    followUpQuestions:['How many learners engaged with that question?','How do you know what the others were thinking?','What technique could reach all learners simultaneously?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Questioning — only volunteering learners answer questions. The majority of the group are not required to think or respond.',
    digitalOpportunity:'A poll or Mentimeter used as a cold-call equivalent could surface all learners\' initial thinking simultaneously before discussion.',
    digitalApplicable: true,
    resourceTags:['questioning','cold-call','no-hands','CAT6'] },

  { id:'R-EQ-003', lraThemeId:'EQ', etfStage:null, context:'digital-present-superficial',
    condition:'Poll used but results not discussed or acted on',
    followUpQuestions:['The poll gave you the numbers — what did you do differently because of what you saw?','Did the results change what happened next in the session?','How could you build the poll results into your explanation?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Questioning — digital tool used for questioning but results are not used to adapt teaching. The data is collected but not acted on.',
    digitalOpportunity:'Use poll results as a teaching tool — display responses, discuss patterns, address misconceptions in real time.',
    digitalApplicable: true,
    resourceTags:['questioning','poll','mentimeter','formative','CAT6'] },

  { id:'R-EQ-004', lraThemeId:'EQ', etfStage:null, context:'any',
    condition:'Questions only recall-level — no why/how/explain',
    followUpQuestions:['What would a learner need to understand — not just remember — to answer that well?','Could you rephrase one of those questions to require reasoning rather than recall?','When did learners have to explain their thinking today?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Effective Questioning — questions require recall only. Learners are not asked to explain, reason, or apply knowledge. Deep thinking is absent.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['questioning','bloom','higher-order','CAT6'] },

  { id:'R-EQ-005', lraThemeId:'EQ', etfStage:null, context:'digital-absent',
    condition:'No mechanism to check all learners mid-session',
    followUpQuestions:['At what point in this session could you see what every learner was thinking?','What would you do differently if you could?','Is there a tool that could help you reach all learners at once?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Questioning — no mechanism exists to check understanding across all learners simultaneously. Teacher relies on individual responses.',
    digitalOpportunity:'A hinge question via Forms, poll, or Mentimeter could show the teacher the thinking of every learner at the same point in the session.',
    digitalApplicable: true,
    resourceTags:['questioning','hinge','formative','CAT6'] },

  { id:'R-EQ-006', lraThemeId:'EQ', etfStage:null, context:'any',
    condition:'STRENGTH — questions probe reasoning and build on responses',
    followUpQuestions:['What technique are you using here?','How do you ensure all learners are reached by your questioning?','Could this approach be shared with colleagues as a model?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Effective Questioning — questioning is purposeful, probing, and builds on learner responses. Deep thinking is evident across the group.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['questioning','strength','CAT6'] },

  // ── Checks for Understanding (CU) ─────────────────────────
  { id:'R-CU-001', lraThemeId:'CU', etfStage:null, context:'any',
    condition:'No hinge point before moving on',
    followUpQuestions:['How did you know learners were ready to move on?','What would you have done if they weren\'t?','At what point could you have checked before proceeding?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Checks for Understanding — no hinge point is used before moving to new content. Teacher moves on without checking whether learners are ready.',
    digitalOpportunity:'A Forms quiz, poll, or Mentimeter hinge question could show readiness of all learners before the teacher moves on.',
    digitalApplicable: true,
    resourceTags:['checks-for-understanding','hinge','formative','CAT6'] },

  { id:'R-CU-002', lraThemeId:'CU', etfStage:null, context:'digital-present-superficial',
    condition:'Exit ticket used but not acted on',
    followUpQuestions:['What did the exit ticket tell you?','Did that change what you planned to do next time?','How long between seeing the results and your next session with this group?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Checks for Understanding — exit ticket used but evidence of it informing next session is absent. Data collected but not acted on.',
    digitalOpportunity:'Use exit ticket data to adapt the next session opening — address the most common misconception as the first activity.',
    digitalApplicable: true,
    resourceTags:['checks-for-understanding','exit-ticket','adaptive','CAT6'] },

  { id:'R-CU-003', lraThemeId:'CU', etfStage:null, context:'any',
    condition:'Teacher asks "does everyone understand?" and accepts nods',
    followUpQuestions:['What does a nod tell you about understanding?','What alternative could give you more reliable evidence?','How do you catch the learner who nods but hasn\'t understood?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Checks for Understanding — teacher relies on visual cues (nods, thumbs) which are unreliable indicators of understanding. Misconceptions go undetected.',
    digitalOpportunity:'An anonymous digital check removes social pressure and gives more honest responses — learners who don\'t understand are more likely to show it.',
    digitalApplicable: true,
    resourceTags:['checks-for-understanding','formative','CAT6'] },

  { id:'R-CU-004', lraThemeId:'CU', etfStage:null, context:'any',
    condition:'STRENGTH — checks used and teaching adapted in real time',
    followUpQuestions:['What did you notice and what did you change because of it?','How do you decide which misconceptions to address immediately versus later?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Checks for Understanding — effective checks used throughout the session and teaching adapted in real time based on what is observed.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['checks-for-understanding','strength','CAT6'] },

  // ── Effective Feedback (EF) ────────────────────────────────
  { id:'R-EF-001', lraThemeId:'EF', etfStage:null, context:'any',
    condition:'Feedback given verbally with no record',
    followUpQuestions:['If a learner wanted to act on your feedback tonight, could they?','What would they refer to?','How do you know feedback has been received and understood?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Feedback — feedback is verbal and ephemeral. Learners cannot access or act on feedback after the session ends.',
    digitalOpportunity:'Audio comments in the Grades tab or typed annotations on a shared document give learners a permanent record they can act on in their own time.',
    digitalApplicable: true,
    resourceTags:['feedback','audio-feedback','grades-tab','CAT6'] },

  { id:'R-EF-002', lraThemeId:'EF', etfStage:null, context:'any',
    condition:'Written feedback given but learners do not act on it',
    followUpQuestions:['What happens after you return marked work?','Do learners respond to the feedback or move on?','What structure exists to ensure feedback is used?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Effective Feedback — written feedback is provided but there is no evidence of learners acting on it. Feedback is not closing the learning gap.',
    digitalOpportunity:'A Teams assignment resubmission workflow enables learners to respond to feedback directly, creating a visible feedback-response cycle.',
    digitalApplicable: true,
    resourceTags:['feedback','DIRT','response-to-feedback','CAT6'] },

  { id:'R-EF-003', lraThemeId:'EF', etfStage:null, context:'digital-present-superficial',
    condition:'Grades tab used for marks only — no comments',
    followUpQuestions:['What does this mark tell a learner about how to improve?','What would a comment add that the mark doesn\'t?','How much time would an audio comment take versus a typed one?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Feedback — digital assessment tool used for summative marking only. Developmental feedback is absent from the digital record.',
    digitalOpportunity:'Grades tab supports audio comments (record directly in browser), typed comments with rubric alignment, and annotation on submitted work.',
    digitalApplicable: true,
    resourceTags:['feedback','grades-tab','audio-feedback','CAT6'] },

  { id:'R-EF-004', lraThemeId:'EF', etfStage:null, context:'any',
    condition:'Feedback delayed more than two weeks',
    followUpQuestions:['When learners receive this feedback, will they remember the work?','What is the impact of the delay on the learning?','What is preventing faster turnaround?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Effective Feedback — feedback is significantly delayed. By the time learners receive it, the learning moment has passed.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['feedback','timeliness','CAT6'] },

  { id:'R-EF-005', lraThemeId:'EF', etfStage:null, context:'any',
    condition:'STRENGTH — feedback timely, specific, and acted upon',
    followUpQuestions:['How do you know learners have used this feedback?','What evidence do you have that it changed their work?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Effective Feedback — feedback is timely, specific, and there is evidence of learners responding and improving as a result.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['feedback','strength','CAT6'] },

  // ── Live Modelling and Guided Practice (LM) ───────────────
  { id:'R-LM-001', lraThemeId:'LM', etfStage:null, context:'any',
    condition:'Teacher tells learners what to do but does not show',
    followUpQuestions:['Could a learner who was absent today follow your explanation alone?','What would they be missing?','When did learners see your thinking, not just the finished product?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Live Modelling — teacher explains tasks verbally but does not demonstrate the process. Learners see the destination but not the route.',
    digitalOpportunity:'Screen recording of live modelling with narration gives learners permanent access to expert thinking — replayable, pauseable, accessible.',
    digitalApplicable: true,
    resourceTags:['modelling','worked-example','screen-recording','CAT4'] },

  { id:'R-LM-002', lraThemeId:'LM', etfStage:null, context:'digital-absent',
    condition:'Modelling done on physical board or paper only — not replayable',
    followUpQuestions:['Is this session recordable?','Could learners replay your thinking tonight?','What would it take to make your modelling persistent?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Live Modelling — modelling is live and ephemeral. Learners cannot access the teacher\'s thinking or worked examples after the session.',
    digitalOpportunity:'Digital pen on a whiteboard or document, with screen recording, captures teacher thinking permanently and embeds it in the Teams resource.',
    digitalApplicable: true,
    resourceTags:['modelling','digital-pen','screen-recording','CAT4'] },

  { id:'R-LM-003', lraThemeId:'LM', etfStage:null, context:'digital-present-superficial',
    condition:'Screen shared but not annotated or narrated',
    followUpQuestions:['Learners can see your screen — can they hear your thinking?','Are you narrating your decisions as you make them?','What does a learner watching your screen actually learn about how you think?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Live Modelling — screen is shared but teacher thinking is not made explicit through narration or annotation. Visual without cognitive modelling.',
    digitalOpportunity:'Talk-aloud while annotating — narrate every decision as you make it. This is the digital equivalent of a worked example with full expert commentary.',
    digitalApplicable: true,
    resourceTags:['modelling','talk-aloud','annotation','CAT4'] },

  { id:'R-LM-004', lraThemeId:'LM', etfStage:null, context:'any',
    condition:'STRENGTH — modelling explicit, narrated, and embedded in resources',
    followUpQuestions:['Have learners told you they\'ve used the recording?','When and how do they access it?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Live Modelling — teacher thinking is made explicit through narrated, annotated modelling. Resources are replayable and embedded in Teams.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['modelling','strength','CAT4'] },

  // ── Lasting Learning (LL) ─────────────────────────────────
  { id:'R-LL-001', lraThemeId:'LL', etfStage:null, context:'any',
    condition:'No retrieval practice — session is input only',
    followUpQuestions:['How do learners encounter content they have already seen?','What happens when it turns out they haven\'t retained it?','Where does recall appear in your session structure?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Lasting Learning — sessions are input-focused with no retrieval practice. Learners receive content but are not required to recall or apply prior learning.',
    digitalOpportunity:'A low-stakes Forms quiz at session start — testing last session\'s content — builds retrieval practice into every lesson with minimal preparation.',
    digitalApplicable: true,
    resourceTags:['retrieval-practice','spaced-practice','lasting-learning','CAT1'] },

  { id:'R-LL-002', lraThemeId:'LL', etfStage:null, context:'digital-absent',
    condition:'Resources not accessible after session',
    followUpQuestions:['If a learner missed this session, what would they find when they opened Teams tonight?','Could they catch up independently?','What exists for them after you leave the room?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Lasting Learning — session content is not accessible to learners after the session ends. Independent revision and catch-up are not supported.',
    digitalOpportunity:'Resources posted to an organised Teams channel before the session — accessible, named clearly, with AT tools available — support independent learning.',
    digitalApplicable: true,
    resourceTags:['lasting-learning','Teams','resources','CAT1'] },

  { id:'R-LL-003', lraThemeId:'LL', etfStage:null, context:'digital-present-superficial',
    condition:'Resources posted but channel disorganised',
    followUpQuestions:['Could a learner find last week\'s resource in under 30 seconds without asking you?','Walk me through what they would see when they open Teams.','What naming convention would make navigation easier?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Lasting Learning — resources exist digitally but the channel structure is disorganised. Learners cannot navigate independently.',
    digitalOpportunity:'Channel structure that mirrors the curriculum sequence — with consistent file naming and pinned resources — enables learner independence.',
    digitalApplicable: true,
    resourceTags:['lasting-learning','Teams','channel-structure','LED','CAT1'] },

  { id:'R-LL-004', lraThemeId:'LL', etfStage:null, context:'any',
    condition:'STRENGTH — retrieval built in, resources organised, recordings available',
    followUpQuestions:['How do you know learners are accessing and using these resources independently?','What tells you the design is working for them?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Lasting Learning — retrieval practice is built into the session structure. Resources are organised for independent access. Recordings are replayable.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['lasting-learning','strength','CAT1'] },

  // ── Accessible Resources Digital (ARD) ────────────────────
  { id:'R-ARD-001', lraThemeId:'ARD', etfStage:null, context:'any',
    condition:'Resources shared but accessibility not checked',
    followUpQuestions:['If a learner with dyslexia opened this resource, what would they find?','Have you checked the colour contrast and font size?','Is the reading order logical for a screen reader user?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Accessible Resources (Digital) — resources are shared with learners but have not been checked for accessibility. WCAG 2.2 AA compliance is not confirmed.',
    digitalOpportunity:'Accessible by Design resource covers alt text, heading structure, colour contrast, and font guidance for all common formats.',
    digitalApplicable: true,
    resourceTags:['accessibility','WCAG','ARD','CAT2'] },

  { id:'R-ARD-002', lraThemeId:'ARD', etfStage:null, context:'any',
    condition:'Images in resources have no alt text',
    followUpQuestions:['A learner using a screen reader opened your PowerPoint — what did they hear when they reached that image?','What information does the image convey that the alt text should capture?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Accessible Resources (Digital) — images in shared resources have no alternative text. Screen reader users receive no information from these images.',
    digitalOpportunity:'Alt text can be added in PowerPoint, Word, and Teams files directly. The Accessible by Design guide covers the process for each format.',
    digitalApplicable: true,
    resourceTags:['accessibility','alt-text','ARD','WCAG','CAT2'] },

  { id:'R-ARD-003', lraThemeId:'ARD', etfStage:null, context:'any',
    condition:'Colour contrast below WCAG AA standard',
    followUpQuestions:['Can learners with colour vision differences read this text?','Have you tested the contrast ratio?','What tool have you used to check?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Accessible Resources (Digital) — colour contrast in shared resources does not meet WCAG 2.2 AA minimum (4.5:1 normal text, 3:1 large text).',
    digitalOpportunity:'WebAIM Contrast Checker is free and takes seconds. The Accessible by Design resource includes a colour palette that meets AA standard.',
    digitalApplicable: true,
    resourceTags:['accessibility','contrast','WCAG','ARD','CAT2'] },

  { id:'R-ARD-004', lraThemeId:'ARD', etfStage:null, context:'any',
    condition:'STRENGTH — all resources meet WCAG AA, heading structure used, alt text present',
    followUpQuestions:['Could you share your process with a colleague?','How long does accessibility checking add to your resource creation?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Accessible Resources (Digital) — all shared resources meet WCAG 2.2 AA. Heading structure, alt text, and colour contrast are consistently applied.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['accessibility','strength','ARD','CAT2'] },

  // ── Digital Learning Environment (LED) ────────────────────
  { id:'R-LED-001', lraThemeId:'LED', etfStage:null, context:'any',
    condition:'All files in General channel — no organisation',
    followUpQuestions:['Could a learner find last week\'s session resource in under 30 seconds?','What would they see when they open Teams?','How does the current structure reflect the curriculum?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Digital Learning Environment — Teams channel is not organised. All files in the General channel. Learners cannot navigate independently.',
    digitalOpportunity:'Channel structure that mirrors the curriculum sequence, with consistent naming and pinned resources, enables learner independence with minimal effort.',
    digitalApplicable: true,
    resourceTags:['LED','Teams','channel-structure','CAT3'] },

  { id:'R-LED-002', lraThemeId:'LED', etfStage:null, context:'any',
    condition:'Files named generically — PowerPoint(1), PowerPoint(2)',
    followUpQuestions:['If a learner searched for "week 3" in Teams, would they find it?','What naming convention would help learners navigate?','How long does it take you to find a resource from three weeks ago?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Digital Learning Environment — files are not named to support learner navigation. Generic names prevent independent retrieval.',
    digitalOpportunity:'Consistent file naming (week number, topic, date) takes seconds and transforms learner independence. The LED resource covers naming conventions.',
    digitalApplicable: true,
    resourceTags:['LED','Teams','file-naming','CAT3'] },

  { id:'R-LED-003', lraThemeId:'LED', etfStage:null, context:'any',
    condition:'Resources posted during or after session — not before',
    followUpQuestions:['When learners arrived today, were the resources already there?','How does this affect learners who prepare in advance?','What would it take to post resources the evening before?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Digital Learning Environment — resources are posted during or after the session rather than in advance. Learners who prepare ahead or who need preview time are disadvantaged.',
    digitalOpportunity:'Pre-posting resources to Teams the evening before the session is a one-step habit that significantly improves inclusion and learner readiness.',
    digitalApplicable: true,
    resourceTags:['LED','Teams','pre-posting','CAT3'] },

  { id:'R-LED-004', lraThemeId:'LED', etfStage:null, context:'any',
    condition:'STRENGTH — channel organised, files named clearly, resources pre-posted',
    followUpQuestions:['How do learners tell you the environment is working for them?','What feedback have you had?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Digital Learning Environment — Teams channel is well-organised, files clearly named, and resources available before sessions. Learner navigation is independent.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['LED','strength','CAT3'] },

  // ── Assistive Technology (AT) ─────────────────────────────
  { id:'R-AT-001', lraThemeId:'AT', etfStage:null, context:'any',
    condition:'AT available on request only — not proactively offered',
    followUpQuestions:['How do learners know these tools are available?','How might a learner who doesn\'t know they need them find out?','When in the year are AT tools introduced to learners?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Assistive Technology — AT tools are available on request only. Learners who would benefit are not proactively offered access.',
    digitalOpportunity:'Learning Without Barriers guide covers proactive AT introduction. Immersive Reader, Read&Write, and Live Captions can be offered as standard to all.',
    digitalApplicable: true,
    resourceTags:['AT','assistive-technology','inclusion','CAT5'] },

  { id:'R-AT-002', lraThemeId:'AT', etfStage:null, context:'any',
    condition:'AT tools present but learners not using them',
    followUpQuestions:['Do learners know how to use these tools?','Have they been shown, or is the expectation they will work it out?','When did you last model using an AT tool yourself?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Assistive Technology — AT tools are available but learners are not using them. Coaching on tool use has not been provided.',
    digitalOpportunity:'A short in-session demonstration of Immersive Reader or Read&Write — by the teacher, for all learners — normalises AT use and builds independence.',
    digitalApplicable: true,
    resourceTags:['AT','assistive-technology','coaching','CAT5'] },

  { id:'R-AT-003', lraThemeId:'AT', etfStage:null, context:'any',
    condition:'Immersive Reader available but not opened during session',
    followUpQuestions:['Is Immersive Reader part of your standard session setup?','When did you last show learners how to use it?','Which learners would benefit most and do they know it exists?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Assistive Technology — Immersive Reader is available but not embedded in session routine. Opportunity to support reading accessibility is missed.',
    digitalOpportunity:'Opening Immersive Reader at the start of the session and showing learners how to personalise it takes under two minutes and benefits all learners.',
    digitalApplicable: true,
    resourceTags:['AT','immersive-reader','inclusion','CAT5'] },

  { id:'R-AT-004', lraThemeId:'AT', etfStage:null, context:'any',
    condition:'STRENGTH — AT embedded, learners use independently',
    followUpQuestions:['Can you describe what independent AT use looks like in your sessions?','Could you demonstrate this for colleagues as a model?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Assistive Technology — AT tools are embedded as standard. Learners use them independently and confidently without prompting.',
    digitalOpportunity: null, digitalApplicable: false,
    resourceTags:['AT','strength','CAT5'] },

  // ── Remaining LRA themes — starter rules ──────────────────
  { id:'R-LI-001', lraThemeId:'LI', etfStage:null, context:'any',
    condition:'No learning intention shared at session start',
    followUpQuestions:['What did learners know they were working towards today?','How did you communicate the purpose of the session?','When would a learner know if they had been successful?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Learning Intentions — no clear learning intention was shared with learners at the start of the session.',
    digitalOpportunity:'Learning intention posted in Teams before the session and displayed on screen throughout gives learners a persistent reference point.',
    digitalApplicable: true, resourceTags:['learning-intentions','CAT1'] },

  { id:'R-LI-002', lraThemeId:'LI', etfStage:null, context:'any',
    condition:'STRENGTH — intention clear, revisited, connected to assessment',
    followUpQuestions:['How did the session end in relation to the intention?','Could learners articulate what they had learned?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Learning Intentions — clear, limitless learning intention shared, revisited during the session, and connected to assessment criteria.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['learning-intentions','strength','CAT1'] },

  { id:'R-BB-001', lraThemeId:'BB', etfStage:null, context:'any',
    condition:'Session does not build on prior learning',
    followUpQuestions:['What did learners already know that this session built on?','How did the session connect to what came before?','What would a learner who missed last week have struggled with today?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Building Blocks — the session does not build on prior learning. Content is isolated rather than sequenced within a curriculum narrative.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['building-blocks','sequencing','CAT1'] },

  { id:'R-BB-002', lraThemeId:'BB', etfStage:null, context:'any',
    condition:'STRENGTH — deliberate sequence, clear connection to prior learning',
    followUpQuestions:['How do learners know where this session sits in the bigger picture?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Building Blocks — session builds deliberately on prior learning. Sequence is clear and learners can see how today connects to what came before.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['building-blocks','strength','CAT1'] },

  { id:'R-SP-001', lraThemeId:'SP', etfStage:null, context:'any',
    condition:'No evidence that starting points inform delivery',
    followUpQuestions:['What do you know about where each learner is starting from?','How has that information changed what you planned for today?','What diagnostic data have you used to inform the pitch of this session?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Starting Points — no evidence that learner starting point data has informed session design or delivery.',
    digitalOpportunity:'A Century diagnostic or Forms baseline quiz can establish starting points quickly and generate data that directly informs planning.',
    digitalApplicable: true, resourceTags:['starting-points','diagnostic','baseline','CAT1'] },

  { id:'R-PL-001', lraThemeId:'PL', etfStage:null, context:'any',
    condition:'EHCP or SEND information not evident in planning or delivery',
    followUpQuestions:['What adjustments are in place for learners with identified needs?','How did you know what each learner needed today?','Where is SEND information informing your session design?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Personalised Learning — EHCP and SEND information is not evident in session planning or delivery. Reasonable adjustments are absent.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['personalised-learning','SEND','EHCP','CAT2'] },

  { id:'R-AR-001', lraThemeId:'AR', etfStage:null, context:'any',
    condition:'Resources not inclusive in layout or language',
    followUpQuestions:['Could all learners access this resource independently?','Is the language appropriate for the reading level of the group?','What adjustments would a learner with dyslexia need?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Accessible Resources — materials are not consistently inclusive in layout or language. Some learners cannot access the content independently.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['accessible-resources','inclusion','CAT2'] },

  { id:'R-LE-001', lraThemeId:'LE', etfStage:null, context:'any',
    condition:'Learning space not structured or settled — learners unfocused',
    followUpQuestions:['What routines are in place to settle the group at the start?','How long before the group was ready to learn?','What signals to learners that learning is beginning?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Learning Environment — the learning space is not structured or settled. Learners are unfocused and the session start is ineffective.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['learning-environment','routines','CAT3'] },

  { id:'R-RL-001', lraThemeId:'RL', etfStage:null, context:'any',
    condition:'No established routine at session start',
    followUpQuestions:['What do learners do when they arrive?','Is that consistent every session?','What is the first thing that happens that signals learning is starting?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Readiness to Learn — no consistent routine at session start. Learners do not have a clear signal that learning is beginning.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['readiness','routines','CAT3'] },

  { id:'R-PC-001', lraThemeId:'PC', etfStage:null, context:'any',
    condition:'Explanations unclear or repeated without rephrasing',
    followUpQuestions:['When a learner didn\'t understand, what did you do?','Did you rephrase, or repeat the same explanation?','What alternative approach could you try next time?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Professional Communication — explanations are unclear and when repeated are not rephrased. Learners who didn\'t understand the first time are not better served.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['explanation','communication','CAT4'] },

  { id:'R-SSL-001', lraThemeId:'SSL', etfStage:null, context:'any',
    condition:'Technical vocabulary not taught or reinforced',
    followUpQuestions:['What subject-specific language did learners use today?','When did you explicitly teach or reinforce technical vocabulary?','How do learners encounter new vocabulary before they are expected to use it?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Subject Specific Language — technical and industry vocabulary is not being explicitly taught or reinforced. Learners are not developing subject language.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['vocabulary','subject-language','CAT4'] },

  { id:'R-AL-001', lraThemeId:'AL', etfStage:null, context:'any',
    condition:'Tasks do not stretch or challenge — low ceiling',
    followUpQuestions:['What would the most able learner have been stretched by today?','Is there a ceiling on what learners can achieve in this session?','How do you ensure high expectations are felt by all learners?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Ambitious Learning — tasks do not stretch or challenge learners. The ceiling is too low and high expectations are not consistently communicated.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['ambitious-learning','challenge','expectations','CAT5'] },

  { id:'R-AE-001', lraThemeId:'AE', etfStage:null, context:'any',
    condition:'Learners passive for extended periods — teacher-led throughout',
    followUpQuestions:['How long were learners listening without doing anything?','When did learners have to think, decide, or produce something?','What is the ratio of teacher talk to learner activity in this session?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Active Engagement — learners are passive for extended periods. The session is teacher-led throughout with insufficient learner activity.',
    digitalOpportunity:'Collaborative documents, shared whiteboards, or polls can shift learners from passive recipients to active participants with low preparation cost.',
    digitalApplicable: true, resourceTags:['active-engagement','participation','CAT5'] },

  { id:'R-SS-001', lraThemeId:'SS', etfStage:null, context:'any',
    condition:'Over-helping — learners not developing independence',
    followUpQuestions:['At what point does your support prevent learners from having to think?','What would happen if you waited a little longer before helping?','How do you know when a learner genuinely needs help versus when they are choosing not to try?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Scaffolding and Support — support is over-provided. Learners are not being required to struggle productively and independence is not developing.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['scaffolding','independence','CAT5'] },

  { id:'R-CL-001', lraThemeId:'CL', etfStage:null, context:'any',
    condition:'STRENGTH — structured peer learning evident',
    followUpQuestions:['How do you structure collaboration so all learners contribute?','What do you do when one learner dominates?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTH,
    afiDraftDescription:'Collaborative Learning — structured peer learning is evident. Learners are developing knowledge through purposeful interaction with each other.',
    digitalOpportunity:'Collaborative documents or shared whiteboards make peer thinking visible and create a permanent record of collaborative work.',
    digitalApplicable: true, resourceTags:['collaborative-learning','strength','CAT5'] },

  { id:'R-LI2-001', lraThemeId:'LI2', etfStage:null, context:'any',
    condition:'Learners reliant on teacher for all decisions and next steps',
    followUpQuestions:['What would a learner do if they finished early and you were busy?','How do learners know what to do next without asking you?','What structures exist to support independent decision-making?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Learner Independence — learners are reliant on the teacher for all decisions and next steps. Self-regulation and autonomy are not developing.',
    digitalOpportunity:'A clearly structured Teams channel with extension tasks, revision resources, and catch-up materials enables learner independence when teacher is unavailable.',
    digitalApplicable: true, resourceTags:['independence','autonomy','CAT5'] },

  { id:'R-EA-001', lraThemeId:'EA', etfStage:null, context:'any',
    condition:'Single assessment method — no variety',
    followUpQuestions:['What does a written response tell you that a verbal one wouldn\'t?','Are all learners able to demonstrate their understanding through this method?','What alternative formats have you tried?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Assessment — a single assessment method is used consistently. Some learners may not be able to demonstrate understanding through this format.',
    digitalOpportunity:'Multiple response formats — video, audio, annotated image, written — via Teams assignments allow learners to choose how they demonstrate understanding.',
    digitalApplicable: true, resourceTags:['assessment','variety','formats','CAT6'] },

  { id:'R-AP-001', lraThemeId:'AP', etfStage:null, context:'any',
    condition:'Misconceptions identified but not addressed in session',
    followUpQuestions:['When did you notice the misconception?','What did you do in that moment?','What will you do in the next session to address it?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Adaptive Practice — misconceptions are identified but not addressed within the session. Learners leave with incorrect understanding embedded.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['adaptive-practice','misconceptions','CAT6'] },

  { id:'R-BR-001', lraThemeId:'BR', etfStage:null, context:'any',
    condition:'Emotional or behavioural disruption not effectively managed',
    followUpQuestions:['What strategies did you use?','What support is available to you for this learner?','Is there a pattern to when this occurs?'],
    afiDraftSeverity: AFI_SEVERITY.IMMEDIATE,
    afiDraftDescription:'Behaviour Regulation — emotional or behavioural disruption is not being effectively managed. Other learners\' experience is affected.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['behaviour','regulation','CAT3'] },

  { id:'R-EAS-001', lraThemeId:'EAS', etfStage:null, context:'any',
    condition:'Support staff present but not effectively deployed',
    followUpQuestions:['What did the support staff do during the session?','Was their role planned in advance?','How do you brief support staff before the session?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Effective Use of Additional Staff — support staff are present but their role is not planned or deployed effectively.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['additional-staff','deployment','CAT3'] },

  { id:'R-RTL-001', lraThemeId:'RTL', etfStage:null, context:'any',
    condition:'Learners not punctual or not engaged from session start',
    followUpQuestions:['What is the pattern of punctuality for this group?','What is in place to address it?','What does the learner experience in the first five minutes?'],
    afiDraftSeverity: AFI_SEVERITY.STRENGTHEN,
    afiDraftDescription:'Ready to Learn — learners are not consistently punctual or engaged from the session start. The opening routine is not effective.',
    digitalOpportunity: null, digitalApplicable: false, resourceTags:['readiness','punctuality','CAT7'] },
];

// ── Public API ────────────────────────────────────────────────

// Get all rules for a given LRA theme ID
function getQuestionsForTheme(themeId) {
  return HEURISTIC_RULES.filter(r => r.lraThemeId === themeId);
}

// Get rules matching theme + context
function getContextualRules(themeId, context='any') {
  return HEURISTIC_RULES.filter(r =>
    r.lraThemeId === themeId &&
    (r.context === 'any' || r.context === context)
  );
}

// Auto-draft an AFI from a theme selection + severity choice
function draftAFI(themeId, severity, areaCode, staffId=null) {
  const theme = getLRATheme(themeId);
  if (!theme) return null;

  // Find the rule matching the severity
  const rule = HEURISTIC_RULES.find(r =>
    r.lraThemeId === themeId && r.afiDraftSeverity === severity
  ) || HEURISTIC_RULES.find(r => r.lraThemeId === themeId);

  if (!rule) return null;

  return {
    afiId:            generateId(),
    areaCode,
    staffId,
    lraCategoryId:    theme.categoryId,
    lraThemeId:       themeId,
    lraThemeLabel:    theme.label,
    description:      rule.afiDraftDescription,
    digitalOpportunity: rule.digitalOpportunity,
    digitalApplicable:  rule.digitalApplicable,
    rationaleTest:    null,
    status:           AFI_STATUS.OPEN,
    severity,
    closeWindow:      severity === AFI_SEVERITY.IMMEDIATE ? '2-weeks' : '6-weeks',
    linkedActions:    [],
    evidenceChain:    [],
    parentObservationId: null,
    hyperThemeMatch:  HYPER_FOCUS.find(h => h.id === themeId) ? themeId : null,
    qipRef:           null,
    createdAt:        nowISO(),
    closedAt:         null,
    lastUpdated:      nowISO(),
  };
}

// Get all rules (for admin / debugging)
function getHeuristicRules() { return HEURISTIC_RULES; }
