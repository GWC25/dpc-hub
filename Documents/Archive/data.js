/* ================================================================
   data.js — DPC Impact Hub  v3.0
   DB schema, load/save, migration, OneDrive sync

   Schema v3.0 additions (June 2026):
   - Activity dating: dateLogged, dateCompleted, dateNextReview
     on activityLog entries and individualActivities
   - Interventions: expectedImpact, actualOutcome fields
   - area.currentActions[] — structured editable action/AFI phases
   - area.staffDevelopment restructured with cpdLog + confidenceSnapshots
   - RAG snapshot function: DPC.takeRAGSnapshot(areaCode, reason)
   - Learning walk / health check linking via sharedId
   ================================================================ */

// ── ONEDRIVE URL ──────────────────────────────────────────────────
const ONEDRIVE_URL = '';

// ── SCHEMA VERSION ────────────────────────────────────────────────
const SCHEMA_VERSION = '3.0';
const STORAGE_KEY    = 'dpc-impact-hub-v2'; // keep same key — migration handles upgrade

// ── LIVE DATABASE REFERENCE ───────────────────────────────────────
window.DPC = window.DPC || {};
DPC.DB = null;

// ── DEFAULT DB SKELETON ───────────────────────────────────────────
function createEmptyDB() {
  return {
    meta: {
      version: SCHEMA_VERSION,
      created: new Date().toISOString(),
      lastSaved: new Date().toISOString(),
      savedBy: 'Graeme Wright'
    },
    areas: [],
    learningWithoutBarriers: { frameworkLink: '', activities: [] },
    individualActivities: [],
    myCPD: [],
    settings: {
      afiPhaseTypes: ['Foundations', 'Embedding', 'Developing', 'Innovating', 'Standalone'],
      customActivityTypes: [],
      theme: 'auto'
    }
  };
}

// ── SEED DATA LOADER ──────────────────────────────────────────────
async function loadSeedData() {
  try {
    const r = await fetch('./data/areas-seed.json');
    return await r.json();
  } catch(e) {
    console.warn('Seed data not available:', e);
    return [];
  }
}

// ── RAG SCHEMA LOADER ─────────────────────────────────────────────
DPC.ragSchema = null;
async function loadRAGSchema() {
  try {
    const r = await fetch('./data/rag-schema.json');
    DPC.ragSchema = await r.json();
  } catch(e) {
    console.warn('RAG schema not available:', e);
  }
}

// ── HEALTH CHECK SCHEMA LOADER ────────────────────────────────────
DPC.hcSchema = null;
async function loadHCSchema() {
  try {
    const r = await fetch('./data/hc-schema.json');
    DPC.hcSchema = await r.json();
  } catch(e) {
    console.warn('HC schema not available:', e);
  }
}

// ── LOCALSTORAGE ──────────────────────────────────────────────────
DPC.saveToLocalStorage = function() {
  try {
    DPC.DB.meta.lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DPC.DB));
    return true;
  } catch(e) {
    console.error('localStorage save failed:', e);
    return false;
  }
};

DPC.loadFromLocalStorage = function() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {
    console.warn('localStorage parse failed:', e);
    return null;
  }
};

// ── MANUAL DOWNLOAD ───────────────────────────────────────────────
DPC.downloadJSON = function() {
  DPC.DB.meta.lastSaved = new Date().toISOString();
  const blob = new Blob([JSON.stringify(DPC.DB, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dpc-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  DPC.saveToLocalStorage();
};

// ── ONEDRIVE FETCH ────────────────────────────────────────────────
async function fetchFromOneDrive() {
  if (!ONEDRIVE_URL) return null;
  try {
    const directUrl = ONEDRIVE_URL.replace('redir?', 'download?');
    const r = await fetch(directUrl, {cache: 'no-store'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch(e) {
    console.warn('OneDrive fetch failed (using localStorage):', e.message);
    return null;
  }
}

// ── MIGRATION ─────────────────────────────────────────────────────
function migrateDB(db) {
  // ── v2 → v3: new fields on all areas ────────────────────────────
  if (!db.areas) db.areas = [];

  db.areas.forEach(area => {

    // Existing v2 fields — ensure present
    if (!area.afiPhases)    area.afiPhases    = [];
    if (!area.activityLog)  area.activityLog  = [];
    if (!area.interventions) area.interventions = [];
    if (!area.strengths)    area.strengths    = '';
    if (!area.context)      area.context      = '';
    if (!area.m1Summary)    area.m1Summary    = '';
    if (!area.m2KDP)        area.m2KDP        = '';
    if (!area.m2Strengths)  area.m2Strengths  = '';
    if (!area.m2AFIs)       area.m2AFIs       = '';
    if (!area.nextPlannedAction) area.nextPlannedAction = '';

    if (!area.generalDigitalSkills) {
      area.generalDigitalSkills = {
        curriculumSkillsList:'', curriculumPlanningScore:null,
        centuryAverageData:'', currentGaps:'',
        gapNarrowingPlan:'', progressTrackingPlan:'', progressData:''
      };
    }
    if (!area.industryDigitalSkills) {
      area.industryDigitalSkills = {
        curriculumSkillsList:'', curriculumPlanningScore:null,
        learnerBaselineData:'', currentGaps:'',
        gapNarrowingPlan:'', progressTrackingPlan:'', progressData:''
      };
    }
    if (!area.healthChecks) area.healthChecks = { records:[], aggregateScore:null };
    if (!area.ragRatings) {
      area.ragRatings = {
        history:[],
        current:{
          staffCapability:null, hoaLeadership:null, infrastructureDevices:null,
          digitalSkillsAssessment:null, curriculumIntegration:null,
          learnerReadiness:null, accessibilityHealth:null,
          digitalLeadEngagement:null, overall:null
        }
      };
    }
    if (!area.ragRatings.current) {
      area.ragRatings.current = {
        staffCapability:null, hoaLeadership:null, infrastructureDevices:null,
        digitalSkillsAssessment:null, curriculumIntegration:null,
        learnerReadiness:null, accessibilityHealth:null,
        digitalLeadEngagement:null, overall:null
      };
    }
    if (area.ragRatings.current.overall === undefined) area.ragRatings.current.overall = null;

    // ── v3 NEW: Activity dating ──────────────────────────────────
    // Add dateLogged to any activityLog entries that lack it
    area.activityLog.forEach(entry => {
      if (!entry.dateLogged)    entry.dateLogged    = entry.date || null;
      if (!entry.dateCompleted) entry.dateCompleted = null;
      if (!entry.dateNextReview) entry.dateNextReview = null;
      // Add dating to nested actions
      if (entry.actions) {
        entry.actions.forEach(action => {
          if (!action.dateLogged)    action.dateLogged    = entry.date || null;
          if (!action.dateCompleted) action.dateCompleted = action.completedDate || null;
        });
      }
    });

    // ── v3 NEW: Intervention expectedImpact / actualOutcome ──────
    area.interventions.forEach(iv => {
      if (!iv.hasOwnProperty('expectedImpact')) iv.expectedImpact = '';
      if (!iv.hasOwnProperty('actualOutcome'))  iv.actualOutcome  = '';
      if (!iv.dateLogged)    iv.dateLogged    = iv.date || null;
      if (!iv.dateCompleted) iv.dateCompleted = null;
    });

    // ── v3 NEW: currentActions[] ─────────────────────────────────
    // Structured AFI/action phase records (replaces free-text nextPlannedAction)
    if (!area.currentActions) {
      // Seed from nextPlannedAction if it has content
      area.currentActions = area.nextPlannedAction
        ? [{
            id: DPC.uid(),
            phase: area.nextPlannedAction,
            startDate: null,
            targetDate: null,
            expectedOutcome: '',
            notes: '',
            status: 'in-progress',
            normalised: DPC.normaliseAction(area.nextPlannedAction)
          }]
        : [];
    }

    // ── v3 NEW: staffDevelopment restructure ─────────────────────
    // Old schema: { staffMembers: [] }
    // New schema: { staffMembers: [{ id, name, role, cpdLog:[], confidenceSnapshots:[], currentConfidence:null }] }
    if (!area.staffDevelopment) {
      area.staffDevelopment = { staffMembers: [] };
    }
    if (!area.staffDevelopment.staffMembers) {
      area.staffDevelopment.staffMembers = [];
    }
    area.staffDevelopment.staffMembers.forEach(sm => {
      if (!sm.id)   sm.id   = DPC.uid();
      if (!sm.role) sm.role = '';
      if (!sm.cpdLog)                sm.cpdLog                = [];
      if (!sm.confidenceSnapshots)   sm.confidenceSnapshots   = [];
      if (!sm.hasOwnProperty('currentConfidence')) sm.currentConfidence = null;
    });

    // Recalculate aggregate staff confidence from snapshots
    const staffWithConf = area.staffDevelopment.staffMembers
      .map(sm => sm.currentConfidence)
      .filter(c => c !== null && c !== undefined);
    area.aggregateStaffConfidence = staffWithConf.length
      ? Math.round((staffWithConf.reduce((a,b) => a+b, 0) / staffWithConf.length) * 10) / 10
      : null;

  });

  // ── v3 NEW: individualActivities dating ─────────────────────────
  if (!db.individualActivities) db.individualActivities = [];
  db.individualActivities.forEach(ia => {
    if (!ia.dateLogged)     ia.dateLogged     = ia.date || null;
    if (!ia.dateCompleted)  ia.dateCompleted  = null;
    if (!ia.dateNextReview) ia.dateNextReview = null;
  });

  if (!db.learningWithoutBarriers) db.learningWithoutBarriers = { frameworkLink:'', activities:[] };
  if (!db.myCPD) db.myCPD = [];
  if (!db.settings) {
    db.settings = {
      afiPhaseTypes: ['Foundations', 'Embedding', 'Developing', 'Innovating', 'Standalone'],
      customActivityTypes: [],
      theme: 'auto'
    };
  }

  db.meta.version = SCHEMA_VERSION;
  return db;
}

// ── MERGE SEED INTO DB ────────────────────────────────────────────
function mergeSeedAreas(db, seedAreas) {
  const existingCodes = new Set(db.areas.map(a => a.code));
  seedAreas.forEach(seedArea => {
    if (!existingCodes.has(seedArea.code)) {
      db.areas.push(seedArea);
    }
  });
  db.areas.sort((a,b) => a.code.localeCompare(b.code));
  return db;
}

// ── MAIN INIT ─────────────────────────────────────────────────────
DPC.initDB = async function() {
  await loadRAGSchema();
  await loadHCSchema();
  const seedAreas = await loadSeedData();

  let db = await fetchFromOneDrive();
  const localDB = DPC.loadFromLocalStorage();

  if (!db) {
    db = localDB;
  } else if (localDB && localDB.meta?.lastSaved > db.meta?.lastSaved) {
    console.info('Using localStorage (newer than OneDrive)');
    db = localDB;
  }

  if (!db) {
    db = createEmptyDB();
    console.info('No existing data — starting fresh from seed');
  }

  db = migrateDB(db);
  db = mergeSeedAreas(db, seedAreas);
  DPC.DB = db;
  DPC.saveToLocalStorage();
  return db;
};

// ── HELPERS ───────────────────────────────────────────────────────
DPC.getArea = function(code) {
  return DPC.DB.areas.find(a => a.code === code) || null;
};

DPC.uid = function() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
};

DPC.ragLabel = function(score) {
  if (!score) return {label:'Not rated', cls:'', n: null};
  const labels = {1:'Urgent',2:'Challenged',3:'Developing',4:'On Track',5:'Confident'};
  const classes = {1:'rag-1',2:'rag-2',3:'rag-3',4:'rag-4',5:'rag-5'};
  return {label: labels[score] || '—', cls: classes[score] || '', n: score};
};

DPC.statusBadge = function(status) {
  const map = {
    'not-started': ['Not Started','ns'],
    'in-progress':  ['In Progress','ip'],
    'completed':    ['Completed','done'],
    'planned':      ['Planned','ns'],
    'cancelled':    ['Cancelled','ns'],
  };
  const [label, cls] = map[status] || ['Unknown','ns'];
  return `<span class="status-pill ${cls}" aria-label="Status: ${label}">${label}</span>`;
};

DPC.ragBadge = function(score) {
  if (!score) return `<span class="badge badge-ns" aria-label="Not rated">—</span>`;
  const {label, cls} = DPC.ragLabel(score);
  return `<span class="badge badge-${cls}" aria-label="RAG: ${label}">${score} · ${label}</span>`;
};

DPC.escHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

DPC.formatDate = function(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  catch(e){ return d; }
};

// ── AREA RAG WEIGHTED SCORE ───────────────────────────────────────
DPC.calcWeightedRAG = function(dims) {
  if (!DPC.ragSchema) return null;
  const weights = DPC.ragSchema.weights;
  let total = 0, totalWeight = 0;
  Object.keys(weights).forEach(k => {
    const val = dims[k];
    if (val !== null && val !== undefined) {
      total += val * weights[k];
      totalWeight += weights[k];
    }
  });
  if (totalWeight === 0) return null;
  return Math.round(total / totalWeight);
};

// ── RAG SNAPSHOT ─────────────────────────────────────────────────
// Captures a point-in-time RAG snapshot for an area.
// Called automatically before any RAG change, or manually via the UI.
// reason: string describing why the snapshot was taken.
DPC.takeRAGSnapshot = function(areaCode, reason) {
  const area = DPC.getArea(areaCode);
  if (!area) return null;

  // Deep-copy current RAG ratings
  const snapshot = {
    id:        DPC.uid(),
    date:      new Date().toISOString(),
    reason:    reason || 'Manual snapshot',
    overall:   area.ragRatings?.current?.overall || null,
    dimensions: {}
  };

  // Capture dimension averages (from sub-criterion objects or legacy integers)
  const dims = ['staffCapability','hoaLeadership','infrastructureDevices',
    'digitalSkillsAssessment','curriculumIntegration','learnerReadiness',
    'accessibilityHealth','digitalLeadEngagement'];

  dims.forEach(d => {
    const raw = area.ragRatings?.current?.[d];
    if (raw === null || raw === undefined) {
      snapshot.dimensions[d] = null;
    } else if (typeof raw === 'number') {
      snapshot.dimensions[d] = raw;
    } else {
      snapshot.dimensions[d] = raw.avg || null;
    }
  });

  if (!area.ragRatings.history) area.ragRatings.history = [];
  area.ragRatings.history.push(snapshot);
  DPC.saveToLocalStorage();
  return snapshot;
};

// ── ACTION NORMALISER ─────────────────────────────────────────────
// Converts free-text action descriptions into a normalised cluster key
// for grouping in reports. Strips filler words, extracts meaningful tokens.
// E.g. "Training staff on Teams environments" → "teams-environments|staff-cpd"
DPC.normaliseAction = function(text) {
  if (!text) return '';

  // Platform/topic clusters
  const clusters = [
    { key: 'teams-environments',   patterns: ['teams','microsoft teams','teams environment'] },
    { key: 'digital-marking',      patterns: ['marking','feedback','digital marking','mark'] },
    { key: 'accessibility',        patterns: ['accessibility','accessible','wcag','send','inclusion'] },
    { key: 'century-tech',         patterns: ['century','century tech'] },
    { key: 'learning-walk',        patterns: ['learning walk','observation','obs','devobs'] },
    { key: 'health-check',         patterns: ['health check','hc'] },
    { key: 'digital-skills',       patterns: ['digital skills','framework','dsf'] },
    { key: 'ai-tools',             patterns: ['ai','artificial intelligence','copilot','chatgpt'] },
    { key: 'curriculum-design',    patterns: ['curriculum','scheme of work','sow','sow design'] },
    { key: 'teach-meet',           patterns: ['teach meet','teachmeet','teach-meet'] },
    { key: 'rag-review',           patterns: ['rag','review','assessment','self-assess'] },
    { key: 'staff-cpd',            patterns: ['cpd','training','workshop','session','upskill','develop'] },
    { key: 'digital-lead',         patterns: ['digital lead','dl','lead'] },
    { key: 'hoa-meeting',          patterns: ['hoa','head of area','meeting'] },
    { key: 'online-resources',     patterns: ['resource','resources','online','moodle','sharepoint'] },
  ];

  const lower = text.toLowerCase();
  const matched = clusters
    .filter(c => c.patterns.some(p => lower.includes(p)))
    .map(c => c.key);

  // Deduplicate and join
  return [...new Set(matched)].join('|') || 'general';
};

// ── REPORT DATA EXTRACTOR ────────────────────────────────────────
// Central function used by the Report Builder to pull structured
// data for any area, ready for template population.
DPC.getAreaReportData = function(areaCode, options = {}) {
  const area = DPC.getArea(areaCode);
  if (!area) return null;

  const {
    weekStart = null,   // ISO date string — filter activities to this week
    weekEnd   = null,
  } = options;

  // ── Recent activities (last 30 days or within week window) ──
  const cutoff = weekStart
    ? new Date(weekStart)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoffEnd = weekEnd ? new Date(weekEnd) : new Date();

  const recentActivities = (area.activityLog || []).filter(a => {
    const d = new Date(a.dateLogged || a.date || 0);
    return d >= cutoff && d <= cutoffEnd;
  });

  // ── Open actions (across all activity log entries) ───────────
  const openActions = [];
  (area.activityLog || []).forEach(entry => {
    (entry.actions || []).forEach(action => {
      if (action.status !== 'completed' && action.status !== 'cancelled') {
        openActions.push({ ...action, sourceDate: entry.dateLogged || entry.date });
      }
    });
  });

  // ── RAG summary ─────────────────────────────────────────────
  const current = area.ragRatings?.current || {};
  const dims = ['staffCapability','hoaLeadership','infrastructureDevices',
    'digitalSkillsAssessment','curriculumIntegration','learnerReadiness',
    'accessibilityHealth','digitalLeadEngagement'];
  const ragSummary = {};
  dims.forEach(d => {
    const raw = current[d];
    ragSummary[d] = (typeof raw === 'number') ? raw : (raw?.avg || null);
  });
  ragSummary.overall = current.overall;

  // ── RAG history (for trajectory) ─────────────────────────────
  const ragHistory = (area.ragRatings?.history || [])
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  // ── Health checks ────────────────────────────────────────────
  const healthChecks = (area.healthChecks?.records || [])
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  // ── Interventions ────────────────────────────────────────────
  const recentInterventions = (area.interventions || []).filter(iv => {
    const d = new Date(iv.dateLogged || iv.date || 0);
    return d >= cutoff && d <= cutoffEnd;
  });
  const openInterventions = (area.interventions || []).filter(
    iv => iv.status !== 'completed' && iv.status !== 'cancelled'
  );

  // ── Staff development ────────────────────────────────────────
  const staffMembers = area.staffDevelopment?.staffMembers || [];
  const recentCPD = [];
  staffMembers.forEach(sm => {
    (sm.cpdLog || []).forEach(c => {
      const d = new Date(c.date || 0);
      if (d >= cutoff && d <= cutoffEnd) {
        recentCPD.push({ staffName: sm.name, ...c });
      }
    });
  });

  // ── Current actions ──────────────────────────────────────────
  const currentActions = (area.currentActions || [])
    .filter(a => a.status !== 'cancelled');

  return {
    code:               area.code,
    name:               area.name,
    group:              area.group,
    campus:             area.campus,
    hoaName:            area.hoaName,
    dlName:             area.dlName,
    context:            area.context,
    strengths:          area.strengths,
    m1Summary:          area.m1Summary,
    m2KDP:              area.m2KDP,
    m2Strengths:        area.m2Strengths,
    m2AFIs:             area.m2AFIs,
    ragSummary,
    ragHistory,
    recentActivities,
    openActions,
    recentInterventions,
    openInterventions,
    currentActions,
    healthChecks,
    recentCPD,
    staffMembers,
    aggregateStaffConfidence: area.aggregateStaffConfidence,
    aggregateHealthCheckScore: area.aggregateHealthCheckScore,
  };
};

// ── COLLEGE-WIDE REPORT DATA ──────────────────────────────────────
// Pulls headline data across all areas for Ben Manning / governance reports
DPC.getCollegeReportData = function(options = {}) {
  const areas = DPC.DB.areas;
  const { weekStart = null, weekEnd = null } = options;

  const ragDistribution = { 1:0, 2:0, 3:0, 4:0, 5:0, null:0 };
  const movers = []; // areas where overall RAG changed in last snapshot
  const allRecentActivities = [];
  const allOpenActions = [];

  areas.forEach(area => {
    // RAG distribution
    const overall = area.ragRatings?.current?.overall || null;
    ragDistribution[overall] = (ragDistribution[overall] || 0) + 1;

    // RAG movement (compare last two snapshots)
    const history = (area.ragRatings?.history || [])
      .sort((a,b) => new Date(a.date) - new Date(b.date));
    if (history.length >= 2) {
      const prev = history[history.length - 2].overall;
      const curr = history[history.length - 1].overall;
      if (prev !== curr) {
        movers.push({ code: area.code, name: area.name, prev, curr,
          date: history[history.length - 1].date });
      }
    }

    // Activities
    const areaData = DPC.getAreaReportData(area.code, options);
    areaData.recentActivities.forEach(a => allRecentActivities.push({ ...a, areaCode: area.code, areaName: area.name }));
    areaData.openActions.forEach(a => allOpenActions.push({ ...a, areaCode: area.code, areaName: area.name }));
  });

  // Individual activities (cross-area)
  const cutoff = weekStart
    ? new Date(weekStart)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoffEnd = weekEnd ? new Date(weekEnd) : new Date();
  const recentIndividual = (DPC.DB.individualActivities || []).filter(ia => {
    const d = new Date(ia.dateLogged || ia.date || 0);
    return d >= cutoff && d <= cutoffEnd;
  });

  return {
    generatedAt: new Date().toISOString(),
    totalAreas: areas.length,
    ragDistribution,
    movers,
    allRecentActivities,
    allOpenActions,
    recentIndividual,
    myCPD: DPC.DB.myCPD || [],
    lwbActivities: DPC.DB.learningWithoutBarriers?.activities || [],
  };
};
