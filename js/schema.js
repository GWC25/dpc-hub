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
// These three are surfaced prominently in DevObs and Learning Walk.
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
