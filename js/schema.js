// DPC Hub · js/schema.js · v1.0 · July 2026
// All schema constants. Imports nothing. Exports constants only.
// Every other file that needs these values imports from here.
// Do not add UI logic or data operations to this file.

// ── LRA Taxonomy 26/27 ────────────────────────────────────────
// 7 categories, 30 themes. Hardcoded — does not change between sessions.
const LRA_TAXONOMY = Object.freeze([
  {
    id: 'CAT1',
    label: 'Planning and Sequencing of Learning',
    themes: [
      { id: 'LI',  label: 'Learning Intentions',        desc: 'Clear, limitless, aligned to curriculum knowledge, skills and behaviours.' },
      { id: 'BB',  label: 'Building Blocks',             desc: 'Step-by-step structure; each task builds on the last.' },
      { id: 'SP',  label: 'Starting Points',             desc: 'Initial assessment and vocational starting points inform pitch and planning.' },
      { id: 'LL',  label: 'Lasting Learning',            desc: 'Designed to help learners recall, repeat and gain deeper knowledge over time.' },
    ]
  },
  {
    id: 'CAT2',
    label: 'Inclusive TLA & SEND',
    themes: [
      { id: 'PL',  label: 'Personalised Learning',           desc: 'Staff know learners as individuals based on well-informed sources.' },
      { id: 'AR',  label: 'Accessible Resources',            desc: 'Materials clear, easy to use, inclusive in layout and language.' },
      { id: 'ARD', label: 'Accessible Resources (Digital)',  desc: 'Digital materials meet accessibility standards; AT coaching embedded.' },
      { id: 'LL2', label: 'Language & Literacy Skills',      desc: 'Natural opportunities for literacy and language development built in.' },
      { id: 'NS',  label: 'Numeracy Skills',                 desc: 'Natural opportunities for numeracy development built in.' },
    ]
  },
  {
    id: 'CAT3',
    label: 'Inclusive Learning Environment',
    themes: [
      { id: 'LE',  label: 'Learning Environment',                desc: 'Safe, structured spaces; learners focused, engaged, valued.' },
      { id: 'LED', label: 'Learning Environment (Digital nav)',   desc: 'Learners navigate digital spaces easily; fewest clicks; personalise independently.' },
      { id: 'RL',  label: 'Readiness to Learn',                  desc: 'R.E.A.D.Y framework; settled environment; learning routines.' },
      { id: 'PR',  label: 'Positive Relationships',              desc: 'Trust, motivation and belonging through positive staff-learner relationships.' },
      { id: 'BR',  label: 'Behaviour Regulation',                desc: 'Staff support emotion and behaviour management effectively.' },
      { id: 'EAS', label: 'Effective Use of Additional Staff',   desc: 'Learning support and technicians deployed effectively.' },
    ]
  },
  {
    id: 'CAT4',
    label: 'Modelling and Professional Language',
    themes: [
      { id: 'PC',  label: 'Professional Communication',        desc: 'Clear, structured, precise explanations; rephrased when needed.' },
      { id: 'LM',  label: 'Live Modelling and Guided Practice', desc: 'Staff show HOW (talk-alouds); technical concepts demonstrated accurately.' },
      { id: 'SSL', label: 'Subject Specific Language (CBL)',   desc: 'Technical language taught and reinforced; industry-ready vocabulary.' },
      { id: 'ISV', label: 'Industry & Sector Vocabulary (WBL)',desc: 'Learning linked to real-world or workplace scenarios.' },
    ]
  },
  {
    id: 'CAT5',
    label: 'Engagement, Collaboration and Independence',
    themes: [
      { id: 'AL',  label: 'Ambitious Learning',      desc: 'High expectations; challenge; success clearly defined as motivation.' },
      { id: 'AE',  label: 'Active Engagement',       desc: 'Learners actively do, think, apply; know more, can do more, remember more.' },
      { id: 'SS',  label: 'Scaffolding & Support',   desc: 'Support gradually removed; learners succeed and progress independently.' },
      { id: 'CL',  label: 'Collaborative Learning',  desc: 'Learners develop knowledge socially; interact positively with peers.' },
      { id: 'LI2', label: 'Learner Independence',    desc: 'Curriculum structures build confident, autonomous, self-regulating learners.' },
      { id: 'AT',  label: 'Assistive Technology',    desc: 'AT positively promoted; aligned to learning intentions and individual needs.' },
    ]
  },
  {
    id: 'CAT6',
    label: 'Assessment, Feedback and Progress',
    themes: [
      { id: 'CU',  label: 'Checks for Understanding', desc: 'Range of techniques; adapted in real time and future sessions.' },
      { id: 'EQ',  label: 'Effective Questioning',    desc: 'Deep thinking; reasoning; opportunities to say and do it better.' },
      { id: 'EF',  label: 'Effective Feedback',       desc: 'Timely, aligned to goals; focused on how learners progress and improve.' },
      { id: 'EA',  label: 'Effective Assessment',     desc: 'Variety of strategies; learners make rapid progress; awarding body met.' },
      { id: 'AP',  label: 'Adaptive Practice',        desc: 'Misconceptions addressed quickly; reasonable adjustments in place.' },
    ]
  },
  {
    id: 'CAT7',
    label: 'Personal Development and Wellbeing',
    themes: [
      { id: 'RTL', label: 'Ready to Learn', desc: 'R.E.A.D.Y expectations; IAG, tutorials, target setting; regular attendance.' },
      { id: 'RTW', label: 'Ready to Work',  desc: 'Employability skills; CEIAG, WEX, IP, WRA, competitive opportunities.' },
      { id: 'RFL', label: 'Ready for Life', desc: 'Tutorials: EDI, wellbeing, relationships, SG&P, current affairs, FBV.' },
      { id: 'FS',  label: 'Future Skills',  desc: 'SMART targets; Future Ready framework; Digital, Academic, Professional, Mindset.' },
    ]
  },
]);

// ── Hyper focus areas (college-wide priority 2025-26) ─────────
// These three are surfaced prominently in Instructional Coaching and Learning Walk.
const HYPER_FOCUS = Object.freeze([
  { id: 'ARD', label: 'Accessible by Design',         categoryId: 'CAT2' },
  { id: 'LED', label: 'Digital Learning Environment', categoryId: 'CAT3' },
  { id: 'AT',  label: 'Assistive Technology',         categoryId: 'CAT5' },
]);

// ── AFI severity (use exact labels from LRA file) ─────────────
const AFI_SEVERITY = Object.freeze({
  STRENGTH:   'Strength',
  STRENGTHEN: 'Areas to Strengthen',
  IMMEDIATE:  'Areas for Immediate Improvement',
});

// ── AFI status lifecycle ──────────────────────────────────────
const AFI_STATUS = Object.freeze({
  OPEN:           'open',
  ACTIONED:       'actioned',
  IMPACT_CHECKED: 'impact-checked',
  CLOSED:         'closed',
  REOPENED:       're-opened',
});

// ── Pyramid levels ────────────────────────────────────────────
const PYRAMID_LEVEL = Object.freeze({
  FOUNDATIONS: 'foundations',
  INCLUSION:   'inclusion',
  INNOVATION:  'innovation',
});

// ── Activity types ────────────────────────────────────────────
const ACTIVITY_TYPE = Object.freeze({
  DEVOBS:             'devobs',
  LEARNING_WALK:      'learning-walk',
  COACHING:           'coaching',
  TEACH_MEET:         'teach-meet',
  HEALTH_CHECK_VISIT: 'health-check-visit',
  REFERRAL:           'referral',
  RESOURCE_CREATED:   'resource-created',
  MEETING:            'meeting',
  CPD_DELIVERED:      'cpd-delivered',
  WORK_REVIEW:        'work-review',
  HOA_MEETING:        'hoa-meeting',
  DL_MEETING:         'digital-lead-meeting',
  TLAM_MEETING:       'tlam-meeting',
});

// ── Touch types ───────────────────────────────────────────────
const TOUCH_TYPE = Object.freeze({
  DEVOBS:            'devobs',
  LEARNING_WALK:     'learning-walk',
  COACHING:          'coaching',
  TEACH_MEET:        'teach-meet',
  REFERRAL:          'referral',
  RESOURCE_ASSIGNED: 'resource-assigned',
  LINKEDIN_PATHWAY:  'linkedin-pathway',
  HEALTH_CHECK:      'health-check',
  REFLECTION:        'reflection',
  WORK_REVIEW:       'work-review',
});

// ── Digital Health Check (Session 36 rebuild) ───────────────────
// Replaces the Session-1-era area-level, 5-broad-dimension model
// (HC_DIMENSIONS in healthcheck.js, area.healthChecks[]) with the real
// instrument actually in use: a staff-level observation across 5 focus
// areas, each with specific scored indicator statements, evidence,
// context, and an action point with an escalation level. Source: the
// "Digital Health Checks 25-26" Microsoft Form, confirmed by Graeme as
// the genuine Year 1 accessibility/inclusion instrument, cross-checked
// against a real baseline round (48 staff, 19 areas, June 2026) already
// run before this rebuild.
//
// One review record can cover 1-5 focus areas in a single sitting,
// matching the Form's own "select an area to review, then choose another
// or submit" flow — not every review necessarily scores all 5.
//
// Cycle-tagged (HC_CYCLES) the same way the self-assessment form is
// cycle-tagged, so baseline / Nov / Feb-Mar / Jun rounds stay comparable
// but distinct, rather than overwriting each other.
const HC_CYCLES = Object.freeze({
  BASELINE:  'baseline-2026',
  NOVEMBER:  'nov-2026',
  FEB_MARCH: 'feb-mar-2027',
  JUNE:      'jun-2027',
});

const HC_ACTION_LEVEL = Object.freeze({
  INFORM_ONLY:    'inform-only',
  SUPPORT:        'support-coaching',
  TRAINING:       'training-development',
  FORMAL_FOLLOWUP:'formal-follow-up',
});

const HC_SCORE_LABELS = Object.freeze({
  1: 'Urgent', 2: 'Challenged', 3: 'Developing', 4: 'On Track', 5: 'Confident',
});

// Faithfully reproduced from the real Form — do not reword indicator
// statements without updating the Form to match, or historical and new
// responses stop being comparable.
const HC_FOCUS_AREAS = Object.freeze([
  {
    id: 'accessibilityByDesign',
    label: 'Accessibility by Design',
    indicators: [
      { id: 'usesAccessibilityChecker', label: 'Uses Accessibility Checker', desc: 'Runs Accessibility Checker before sharing resources in Teams' },
      { id: 'altTextOnImages',          label: 'Alt text on images', desc: 'Adds meaningful alt text to images in shared documents and slides' },
      { id: 'colourContrastChecked',    label: 'Colour contrast checked', desc: 'Verifies text/background contrast meets WCAG 2.2 AA standards' },
      { id: 'captionsTranscripts',      label: 'Captions/transcripts on video', desc: 'Provides captions or transcripts for all shared video content' },
      { id: 'accessibleAssignmentBriefs', label: 'Accessible assignment briefs', desc: 'Assignment briefs use clear headings, readable fonts, and accessible structure' },
    ],
  },
  {
    id: 'promotingAccessiblePractice',
    label: 'Promoting Accessible Practice',
    indicators: [
      { id: 'offersImmersiveReader', label: 'Proactively offers Immersive Reader', desc: 'Demonstrates and encourages Immersive Reader use for all learners' },
      { id: 'mentionsATTools',       label: 'Mentions AT tools in lessons', desc: 'References assistive technology tools (Read&Write, Dictate, Live Captions) in lessons' },
      { id: 'accessibilityUniversal', label: 'Accessibility offered universally', desc: 'Frames accessibility tools as useful for all learners, not SEND-only' },
      { id: 'learnersPersonalise',   label: 'Learners personalise their digital environment', desc: 'Teaches and encourages learners to adjust their digital settings' },
      { id: 'atEmbeddedRoutine',     label: 'AT embedded into routine delivery', desc: 'Assistive technology is planned into lesson design, not added reactively' },
    ],
  },
  {
    id: 'inclusiveKnowledgeAndPractice',
    label: 'Inclusive Knowledge and Practice',
    indicators: [
      { id: 'awareOfSENDNeeds', label: 'Aware of SEND needs and adjusts digitally', desc: 'Makes digital adjustments based on cohort SEND needs' },
      { id: 'appliesUDL',       label: 'Applies UDL — multiple means of engagement', desc: 'Provides multiple formats for content representation and learner response' },
      { id: 'digitalAlternatives', label: 'Provides digital alternatives or choices', desc: 'Offers genuine choice in how learners engage with and submit work' },
      { id: 'equitableResources', label: 'Resources designed for equitable access', desc: 'Resources use plain language, clear layout, and accessible design' },
      { id: 'inclusionVsSkills', label: 'Understands digital inclusion vs digital skills', desc: 'Can distinguish access barriers from skill gaps and respond differently' },
    ],
  },
  {
    id: 'digitalOrganisationAndHygiene',
    label: 'Digital Organisation and Hygiene',
    indicators: [
      { id: 'folderStructureLogical', label: 'Teams/SharePoint folder structure is logical', desc: 'Folder hierarchy is clear, labelled, and navigable by learners' },
      { id: 'gdprCompliantSharing',   label: 'GDPR-compliant sharing', desc: 'Personal learner data is not shared in open files or links' },
      { id: 'versionControl',         label: 'Version control — no "final_v3" files', desc: 'Uses consistent version naming or OneDrive version history' },
      { id: 'namingConventions',      label: 'Naming conventions are consistent', desc: 'Files and folders use clear, descriptive, consistent naming' },
      { id: 'resourcesReviewedRegularly', label: 'Digital resources reviewed and updated regularly', desc: 'Resources are reviewed before delivery and outdated materials removed' },
    ],
  },
  {
    id: 'effectiveDigitalCommunication',
    label: 'Effective Digital Communication',
    indicators: [
      { id: 'teamsSpaceOrganised', label: 'Teams channel/class space is organised', desc: 'Teams space has clear channels, pinned resources, and is actively used' },
      { id: 'postsClearProfessional', label: 'Posts and messages are clear and professional', desc: 'Teams posts are well-written, timely, and easy to understand' },
      { id: 'appropriateFeatures', label: 'Appropriate Teams features used', desc: 'Uses Assignments, channels, tabs, and announcements purposefully' },
      { id: 'resourcesProactivelyShared', label: 'Resources proactively shared', desc: 'Resources are shared in advance or alongside lessons, not retrospectively' },
      { id: 'communicationAccessible', label: 'Communication is accessible and inclusive', desc: 'Posts use plain language, alt text, and inclusive formatting' },
    ],
  },
]);

// ── Action Plans (Session 41) ────────────────────────────────────
// One per area, per initiative — the container that ties together what
// the plan is for, who it's for, and what's actually been assigned to
// deliver it. A Teach Meet assigned to a plan creates two linked things
// automatically: a real Template instance (js/templates.js already has
// this mechanism, including a reflection-form URL and attendeeIds for
// later) and a Loop (AFI) that stays open until the plan's work is done —
// so an Action Plan is never just a paragraph of intent with nothing
// tracking whether it actually happened.
const ACTION_PLAN_STATUS = Object.freeze({
  ACTIVE:   'active',
  COMPLETE: 'complete',
});

// ── Resource Library types (Session 32) ────────────────────────
// 'learning-studio' entries are never stored in data-resource-library.json —
// they're computed at render time from data/resource-tag-map.json (the same
// file getResourcesForTags() in heuristic.js already uses). Only their
// shares get persisted, keyed by resourceId = the Learning Studio URL.
// 'linkedin-pathway' and 'dpc-created' entries are hand-created and are
// the only entries actually stored in data-resource-library.json.
const LIBRARY_TYPE = Object.freeze({
  LEARNING_STUDIO:  'learning-studio',
  LINKEDIN_PATHWAY: 'linkedin-pathway',
  DPC_CREATED:      'dpc-created',
});

// ── Action types (within an AFI) ──────────────────────────────
const ACTION_TYPE = Object.freeze({
  COACHING:           'coaching',
  TEACH_MEET:         'teach-meet',
  LINKEDIN_PATHWAY:   'linkedin-pathway',
  RESOURCE:           'resource',
  TRAINING_PROGRAMME: 'training-programme',
  REFERRAL_OUT:       'referral-out',
});

// ── Evidence types (within an AFI evidence chain) ─────────────
const EVIDENCE_TYPE = Object.freeze({
  DEVOBS:              'devobs',
  LEARNING_WALK:       'learning-walk',
  REFLECTION_IMMEDIATE:'reflection-immediate',
  REFLECTION_FOLLOWUP: 'reflection-follow-up',
  HEALTH_CHECK_SCORE:  'health-check-score',
  DATA_POINT:          'data-point',
  STAFF_VOICE:         'staff-voice',
  COACHING_NOTE:       'coaching-note',
});

// ── Loop movement (what evidence does to an AFI) ──────────────
const LOOP_MOVEMENT = Object.freeze({
  OPENS:    'opens',
  PROGRESSES:'progresses',
  CLOSES:   'closes',
  REOPENS:  're-opens',
});

// ── Template types ────────────────────────────────────────────
const TEMPLATE_TYPE = Object.freeze({
  TEACH_MEET:          'teach-meet',
  COACHING_QUESTIONS:  'coaching-questions',
  MEETING_AGENDA:      'meeting-agenda',
  OBSERVATION_FRAMEWORK:'observation-framework',
});

// ── ETF DTPF stages ───────────────────────────────────────────
const ETF_STAGES = Object.freeze([1, 2, 3, 4, 5]);

// ── Calendar entry types ──────────────────────────────────────
const CALENDAR_TYPE = Object.freeze({
  MEETING:    'meeting',
  TASK:       'task',
  WORK_BLOCK: 'work-block',
  DEADLINE:   'deadline',
  MICRO_TASK: 'micro-task',
});

// ── Meeting types (Session 60, 11/08/26) ─────────────────────────
// Named directly from Graeme's real meeting categories, not invented —
// grouping in the Meetings module list uses these.
const MEETING_TYPE = Object.freeze({
  QUALITY_TEAM:   'quality-team',
  DIGITAL_LEAD:   'digital-lead',
  HOA:            'hoa',
  DIGITAL_PROJECTS_TEAM: 'digital-projects-team',
  AP_JOE:         'ap-joe',       // Joe Abulgani, AP Digital Lead
  AP_NEIL:        'ap-neil',      // Neil Davies, AP Quality
  VP_BEN:         'vp-ben',       // Ben Manning, VP Quality
  EXTERNAL_PARTNER: 'external-partner',
  OTHER_STAFF:    'other-staff',  // other staff/professionals, within or external to the college
});

const MEETING_TYPE_LABELS = Object.freeze({
  [MEETING_TYPE.QUALITY_TEAM]: 'Quality Team',
  [MEETING_TYPE.DIGITAL_LEAD]: 'Digital Lead',
  [MEETING_TYPE.HOA]: 'HoA',
  [MEETING_TYPE.DIGITAL_PROJECTS_TEAM]: 'Digital Projects Team',
  [MEETING_TYPE.AP_JOE]: 'AP — Joe Abulgani',
  [MEETING_TYPE.AP_NEIL]: 'AP — Neil Davies',
  [MEETING_TYPE.VP_BEN]: 'VP — Ben Manning',
  [MEETING_TYPE.EXTERNAL_PARTNER]: 'External Partner',
  [MEETING_TYPE.OTHER_STAFF]: 'Other Staff/Professional',
});

// ── Task status ───────────────────────────────────────────────
const TASK_STATUS = Object.freeze({
  UPCOMING:    'upcoming',
  IN_PROGRESS: 'in-progress',
  COMPLETE:    'complete',
  OVERDUE:     'overdue',
});

// ── RAG dimensions (all 8) ────────────────────────────────────
const RAG_DIMENSIONS = Object.freeze([
  { id: 'staffCapability',       label: 'Staff Capability' },
  { id: 'hoaLeadership',         label: 'HoA Leadership' },
  { id: 'infrastructure',        label: 'Infrastructure & Devices' },
  { id: 'digitalSkillsAssessment',label: 'Digital Skills Assessment' },
  { id: 'curriculumIntegration', label: 'Curriculum Integration' },
  { id: 'learnerReadiness',      label: 'Learner Readiness' },
  { id: 'accessibilityInclusion',label: 'Accessibility & Inclusion' },
  { id: 'digitalLeadEngagement', label: 'Digital Lead Engagement' },
]);

// ── RAG score labels (always paired with colour — never colour alone) ──
const RAG_LABELS = Object.freeze({
  1: 'Immediate priority',
  2: 'Significant development needed',
  3: 'Developing',
  4: 'Establishing',
  5: 'Embedded',
});

// ── Area codes (35 areas — join key across all systems) ──────
const AREA_CODES = Object.freeze([
  'ACA', 'AHC', 'ART', 'BEA', 'BUI', 'CAR', 'CHI', 'COG',
  'CON', 'CRE', 'CRI', 'DIG', 'EAR', 'ELE', 'ENG', 'ENT',
  'FLO', 'HAI', 'HBH', 'HOS', 'INC', 'LAW', 'MAT', 'MED',
  'MUS', 'NUR', 'OUT', 'PER', 'PHO', 'PLA', 'PUB', 'SCH',
  'SCI', 'SPO', 'TRA',
]);

// ── Default empty data structures ────────────────────────────
// Used when optional files are missing — Hub starts with safe defaults.
const DEFAULT_DATA = Object.freeze({
  'data-staff.json':        { staff: [] },
  'data-afi.json':          { afis: [] },
  'data-reflections.json':  { reflections: [] },
  'data-templates.json':    { templates: [] },
  'data-cpd.json':          { cpd: { entries: [], plannedTraining: [], deliveredCPD: [] } },
  'data-digital-leads.json':{ digitalLeads: [] },
  'data-current-focus.json':{ focuses: [] },
  'data-notes.json':        { notes: [] },
  'data-resource-library.json': { entries: [], shares: [] },
  'data-health-checks.json': { reviews: [] },
  'data-action-plans.json': { plans: [] },
});

// ── Helper: get LRA theme by ID ───────────────────────────────
function getLRATheme(themeId) {
  for (const cat of LRA_TAXONOMY) {
    const theme = cat.themes.find(t => t.id === themeId);
    if (theme) return { ...theme, categoryId: cat.id, categoryLabel: cat.label };
  }
  return null;
}

// ── Helper: get all themes as flat array ──────────────────────
function getAllLRAThemes() {
  return LRA_TAXONOMY.flatMap(cat =>
    cat.themes.map(t => ({ ...t, categoryId: cat.id, categoryLabel: cat.label }))
  );
}

// ── Helper: generate UUID v4 ──────────────────────────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Helper: ISO timestamp now ─────────────────────────────────
function nowISO() { return new Date().toISOString(); }

// ── Helper: ISO date today ────────────────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Industry-Specific Digital Skills — default menu per area ──────────
// Session (11/08/26): seeded from the researched Industry-Specific
// Digital Skills Baselining Framework (IfATE/Skills England standards,
// sector bodies, awarding-body specs — see Documents/Current for the
// full sourced research). This is a DEFAULT MENU, not a fixed list —
// each area's actual agreed set lives on the area record itself
// (industrySkills[]), seeded from these defaults, then select/deselect/
// add-your-own per area. Editing this array does not retroactively
// change any area that's already been seeded — see initIndustrySkillsForArea().
//
// Tier A areas (named industry tools, evidenced against a real
// standard) get real defaults below. Tier B areas (academic/generic —
// AHE, CED, COU, EGL, ESO, MAT, NEE, PRA, PRE, PRS, PSF, SEL, SKB, SMS)
// deliberately have none: per the research, they don't map to a single
// industry tool, and should be baselined against the DfE Essential
// Digital Skills Framework instead, not a fabricated tool list.
const INDUSTRY_SKILLS_DEFAULTS = Object.freeze({
  AGF: [
    { name: 'Adobe Photoshop (image editing)', stage1: 'Guided use on set briefs with templates', stage2: 'Independently produces artwork across print and digital, manages files and brand guidelines', stage3: 'Adapts artwork for novel platforms/outputs; integrates generative AI (Firefly) into a professional workflow', source: 'Adobe Certified Professional in Visual Design (certifiedprofessional.adobe.com); UK Creative Digital Design Professional (L6) and Graphic Designer degree apprenticeship postings naming Photoshop/Illustrator/InDesign/Canva' },
    { name: 'Adobe Illustrator (vector)', stage1: 'Guided use on set briefs with templates', stage2: 'Independently produces vector artwork to a brief', stage3: 'Adapts vector work for novel outputs and complex briefs', source: 'Adobe Certified Professional in Visual Design (certifiedprofessional.adobe.com)' },
    { name: 'Adobe InDesign (layout)', stage1: 'Guided use on set layout tasks', stage2: 'Independently produces print/digital layouts to brand guidelines', stage3: 'Designs complex multi-page/multi-format layouts independently', source: 'Adobe Certified Professional in Visual Design (certifiedprofessional.adobe.com)' },
  ],
  AMT: [
    { name: 'SolidWorks (mechanical 3D CAD)', stage1: 'Guided basic 3D parts and 2D drawings', stage2: 'Independent modelling of assemblies and production-ready drawings', stage3: 'Designs and validates components for novel manufacturing problems, moving between CAD and CAM', source: 'IfATE/Skills England "Engineering technician" standard ST0457 (skillsengland.education.gov.uk); Engineering manufacturing technician (L4) vacancy naming SolidWorks' },
    { name: 'AutoCAD / Autodesk Inventor or Fusion (CAD/CAM)', stage1: 'Guided 2D/3D CAD on set exercises', stage2: 'Independent CAD modelling and drawing production', stage3: 'Applies CAD/CAM to solve novel design/manufacture problems', source: 'IfATE/Skills England "Engineering technician" standard ST0457 (skillsengland.education.gov.uk)' },
  ],
  ANM: [
    { name: 'Digital husbandry/welfare record systems', stage1: 'Guided digital record-keeping of husbandry/welfare data', stage2: 'Independent maintenance of animal records, environmental logs and medicines tracking', stage3: 'Interprets welfare/environmental data to improve practice and compliance', source: 'IfATE "Animal technologist" standard (instituteforapprenticeships.org); Institute of Animal Technology (iateducation.co.uk) — no single named UK animal-management software brand was evidenced; verify locally which PMS placements use' },
  ],
  BUI: [
    { name: 'Building Management System (BMS) monitoring', stage1: 'Guided reading of BMS set-points and manufacturer digital manuals', stage2: 'Independent use of BMS to size/commission systems', stage3: 'Diagnoses and optimises building services using digital monitoring data for complex/novel installations', source: 'IfATE "Building services engineering service and maintenance engineer" (L3) standard KSB (verbatim): "digital systems to monitor and manage the operation of plant and equipment" (findapprenticeshiptraining.apprenticeships.education.gov.uk); CIBSE (cibse.org)' },
    { name: 'CIBSE-verified design/calculation software (e.g. H2X)', stage1: 'Guided use for simple sizing calculations', stage2: 'Independent use of calculation tools to size/commission systems', stage3: 'Uses calculation software to solve complex/novel design problems', source: 'CIBSE-verified software, e.g. H2X (h2xengineering.com)' },
  ],
  BUS: [
    { name: 'Sage / Xero / QuickBooks (accounting)', stage1: 'Guided record-keeping', stage2: 'Independent bookkeeping, reconciliations and reporting', stage3: 'Selects the most appropriate digital solution for a business problem and analyses data', source: 'IfATE "Accounts or finance assistant" (L2) standard; AAT (aat.org.uk) — "digital proficiency includes industry applications such as Sage, QuickBooks, or Xero, as well as advanced Excel"' },
    { name: 'GDS booking systems (Amadeus / Sabre / Travelport) — Travel & Tourism strand', stage1: 'Guided booking-system use', stage2: 'Independent transactions across booking systems', stage3: 'Optimises bookings against complex customer needs', source: 'IfATE "Travel consultant" ST0340 (L3, skillsengland.education.gov.uk), Skill S1 verbatim: "a range of reservation and booking systems, according to standard industry practices" — the standard itself does not name specific GDS brands; Amadeus/Sabre/Travelport are sourced from travel-technology industry references, not the standard' },
  ],
  CON: [
    { name: 'Digital drawing/specification interpretation', stage1: 'Guided reading of digital drawings/specifications', stage2: 'Independently extracts information from digital drawings and estimates resources', stage3: 'Engages with modern methods of construction and digital modelling concepts on complex/refurbishment projects', source: 'IfATE "Bricklayer" (L2) standard (instituteforapprenticeships.org), K11 verbatim: "Basic principles of digital design and modelling systems"; K10 on interpreting drawings/specifications' },
    { name: 'E-portfolio evidencing (e.g. OneFile, Smart Assessor)', stage1: 'Guided upload of evidence with support', stage2: 'Independently evidences own work against unit criteria', stage3: 'Curates a coherent evidence portfolio demonstrating progression', source: 'CSCS card scheme and standard FE e-portfolio practice (OneFile/Smart Assessor) — not tool-mandated by the standard itself' },
  ],
  CTC: [
    { name: 'Digital tachograph operation', stage1: 'Guided use of the digital tachograph (card insertion, mode selection)', stage2: 'Independent daily operation of tachograph and telematics with compliant records', stage3: 'Interprets tachograph/telematics data to manage drivers\u2019 hours and resolve compliance issues', source: 'IfATE "Large goods vehicle (LGV) driver" ST0257 (findapprenticeshiptraining.apprenticeships.education.gov.uk) verbatim: "adaptive braking, hand-held scanners, on-board telematics and tachographs"; Highfield EPA kit' },
    { name: 'On-board telematics / hand-held scanners', stage1: 'Guided use under supervision', stage2: 'Independent operation as part of normal duties', stage3: 'Uses telematics data to inform operational decisions', source: 'IfATE "Large goods vehicle (LGV) driver" ST0257, same verbatim KSB as above' },
  ],
  DCI: [
    { name: 'Cloud platforms (AWS / Azure / GCP)', stage1: 'Guided use of one cloud console', stage2: 'Independently provisions/configures infrastructure', stage3: 'Automates provisioning/monitoring and solves novel infrastructure problems', source: 'IfATE "Information communications technician" ST0973 (instituteforapprenticeships.org), K27 verbatim: "Awareness of Cloud platforms, such as AWS, Azure, or GCP" — created with Microsoft, BT, Vodafone' },
    { name: 'Version control (Git) and DevOps tooling', stage1: 'Guided use of basic commit/push workflow', stage2: 'Independent use of version control in a real project', stage3: 'Uses DevOps tooling (CI/CD, containers) to solve novel deployment problems', source: 'IfATE ST0973, K36 verbatim: "Awareness of DevOps methodology and tools, such as Puppet, Chef, Git, Docker"' },
    { name: 'Scripting (PowerShell / Linux)', stage1: 'Guided use of basic scripts', stage2: 'Independently writes scripts to automate routine tasks', stage3: 'Writes and debugs scripts for novel/complex problems', source: 'IfATE ST0973, S16 verbatim: "Use basic scripting… for example PowerShell, Linux"' },
  ],
  EEY: [
    { name: 'Tapestry (EYFS online learning journal)', stage1: 'Guided recording of photo/video/text observations', stage2: 'Independent tagging of observations to EYFS areas and sharing with families', stage3: 'Uses assessment data to plan for individual needs and evaluate provision', source: 'IfATE "Early years educator" (L3) standard (findapprenticeship.service.gov.uk); Tapestry (tapestry.info) — "fully aligned with the EYFS… includes Development Matters and Birth to 5 Matters frameworks"' },
  ],
  EMV: [
    { name: 'Manufacturer diagnostic software', stage1: 'Guided use of diagnostic equipment under supervision', stage2: 'Independent methodical fault-finding using scopes and manufacturer diagnostic software', stage3: 'Diagnoses complex/novel faults including EV high-voltage and integrated control systems', source: 'IfATE "Motor vehicle service and maintenance technician (light vehicle)" (L3) standard; IMI Accreditation Light Vehicle Diagnostic Technician (gtg.co.uk), naming "computer based test equipment - diagnostics"' },
    { name: 'EV/hybrid high-voltage diagnostics (IMI-aligned)', stage1: 'Guided awareness of EV safety and basic checks', stage2: 'Independent EV diagnostic tasks under IMI-aligned protocols', stage3: 'Diagnoses complex EV/hybrid faults independently', source: 'IMI (theimi.org.uk) — IMI Level 4 Award in Diagnosis, Testing and Repair of Electric/Hybrid Vehicles; IMI TechSafe register' },
  ],
  ENG: [
    { name: 'CAD (SolidWorks / AutoCAD / Inventor / Fusion)', stage1: 'Guided 2D/3D CAD on set exercises', stage2: 'Independent CAD modelling and drawing production', stage3: 'Applies CAD/CAM to solve novel design/manufacture problems', source: 'IfATE/Skills England "Engineering technician" standard ST0457 (skillsengland.education.gov.uk)' },
  ],
  GMA: [
    { name: 'Unity or Unreal Engine (game engine)', stage1: 'Guided use of the editor and basic asset creation', stage2: 'Independently builds interactive scenes/gameplay with scripting and 3D assets', stage3: 'Designs and optimises novel game systems across the production pipeline', source: 'Unity Certifications (unity.com); Epic Games Unreal certification — no single IfATE-mandated engine; verify the specific games/media standard locally' },
    { name: 'Maya / Blender / Substance 3D (DCC tools)', stage1: 'Guided modelling on set exercises', stage2: 'Independently produces game-ready 3D assets', stage3: 'Produces and optimises complex assets for novel production pipelines', source: 'Industry DCC tool overviews naming Maya, Blender, Substance 3D as standard in games/animation pipelines' },
  ],
  HAC: [
    { name: 'Clinical/EPR systems awareness (EMIS / SystmOne / Vision)', stage1: 'Guided navigation of a clinical record system (simulated/awareness)', stage2: 'Independent, accurate data entry and record management within role scope', stage3: 'Uses clinical systems and coding to support safe, coordinated care and e-referrals', source: 'NHS England "Digital education and training" (england.nhs.uk/long-read) verbatim: "skills are developed on clinical systems such as EMIS, TPP (SystmOne), Vision and several other approved framework platforms"; IfATE "Healthcare support worker" standard; TPP (tpp-uk.com)' },
  ],
  HBH: [
    { name: 'Salon/booking management software (e.g. Phorest)', stage1: 'Guided use of the booking system and digital consultation/consent forms', stage2: 'Independent management of appointments, client records and POS', stage3: 'Uses reporting/marketing analytics and retention tools to grow the client base', source: 'Phorest (phorest.com) — GDPR-compliant digital consultation forms, e-signatures linked to client records, patch-test/consent storage. No IfATE-mandated salon software; Phorest evidenced as a leading UK product, not a required standard — verify against Timely/Fresha locally if different' },
  ],
  PAP: [
    { name: 'DAW (Pro Tools / Logic Pro / Ableton Live)', stage1: 'Guided recording/editing on set projects', stage2: 'Independent multitrack recording, MIDI and mixing', stage3: 'Produces and masters original work and solves novel production/signal-flow problems', source: 'Industry DAW overviews (MusicRadar, LANDR, iZotope); UK technical-operations role listing (itjobswatch.co.uk) — "proficiency in industry-standard DAWs (Logic Pro essential; others desirable)". No single IfATE-mandated DAW; verify the specific music/production standard locally' },
  ],
  PM: [
    { name: 'Microsoft Project (scheduling)', stage1: 'Guided creation of a schedule/Gantt', stage2: 'Independent scheduling, resource allocation and progress tracking', stage3: 'Manages complex multi-workstream projects with critical-path analysis and reporting', source: 'Microsoft Project documentation (microsoft.com); IfATE "Associate project manager" standard — PM apprenticeship standards are methodology-focused (APM/PRINCE2) rather than tool-mandating; MS Project is the enterprise-standard tool, not a required one' },
  ],
  SPO: [
    { name: 'Video/performance analysis (Hudl / Veo / Dartfish)', stage1: 'Guided video capture and basic tagging', stage2: 'Independent match/technique analysis and GPS-data review', stage3: 'Integrates video + GPS/wearable data to inform coaching decisions for novel performance problems', source: 'Hudl (hudl.com) — Sportscode "industry-leading performance analysis software"; Veo AI capture; industry overviews naming Catapult/Dartfish. Verify the specific sport/coaching standard (e.g. Community activator coach / Sports coach) locally for mandated wording' },
  ],
});
