# Quick Capture — Full Build Specification
## DPC Impact Hub · Phase 3b
**Prepared:** June 2026  
**Purpose:** Session handover document. Covers schema, files needed, files created, wiring, future knowledge requirements, and testing/validation expectations for all reporting levels.

---

## 1. Context & Architecture Decision

The Evidence Hub (`evidence-hub.html`) already has Quick Capture, DevObs, and LRA as separate tools with their own data store. The DPC Impact Hub (`hub.html`) is the primary system going forward — it holds the RAG matrix, health checks, area records, and the Report Builder.

**Decision:** Quick Capture, DevObs, and LRA are all ported into the Impact Hub. Data saves directly into `DPC.DB`. The Evidence Hub remains available as a parallel tool but is no longer the primary record-keeper.

This means one data store → one Report Builder → consistent output for all five audiences.

---

## 2. Schema (v3.1 additions to data.js)

### 2a. Quick Capture entry structure
Every Quick Capture save produces one entry appended to `area.activityLog[]` (if area-linked) or `DPC.DB.individualActivities[]` (if cross-college / no area).

```json
{
  "id": "uid",
  "dateLogged": "2026-06-05T09:00:00.000Z",
  "dateCompleted": null,
  "dateNextReview": null,
  "type": "teach-meet",
  "subtype": "Teams",
  "title": "Teams Environments — BUI Teach.Meet",
  "notes": "Free-text summary",
  "keyPoints": "Bullet points or structured notes",
  "actionPoints": [
    {
      "id": "uid",
      "text": "Book follow-up 1:1 with Christie Ross",
      "who": "Graeme Wright",
      "targetDate": "2026-06-20",
      "status": "not-started",
      "dateLogged": "2026-06-05T09:00:00.000Z",
      "dateCompleted": null
    }
  ],
  "tags": ["teams-environments", "staff-cpd", "foundations"],
  "pyramidLevel": "foundations",
  "qipRef": "",
  "areaCode": "BUI",
  "captureSource": "quick-capture",
  "normalised": "teams-environments|staff-cpd"
}
```

### 2b. DevObs entry structure
DevObs saves produce TWO records simultaneously:

**Record 1 — `area.activityLog[]`:**
```json
{
  "id": "uid",
  "dateLogged": "2026-06-05T09:00:00.000Z",
  "type": "devobs",
  "subtype": "Developmental Observation",
  "title": "Dev Obs — [Lecturer Name] ([Area])",
  "areaCode": "BUI",
  "lecturer": "Christie Ross",
  "coach": "Graeme Wright",
  "context": "Follow-up from Teams environments coaching",
  "session": "Session description",
  "obsRows": [
    { "time": "10:05", "evidence": "Evidence text", "reflect": "Reflection", "themes": ["teams-environments"] }
  ],
  "goals": "What we were working towards",
  "strategies": "Agreed next steps",
  "support": "Training/resources needed",
  "evidenceType": "Lesson plan / Teams post / screenshot",
  "outcome": "Outcome narrative",
  "isComplete": false,
  "tags": ["devobs", "learning-walk", "staff-cpd"],
  "pyramidLevel": "embedding",
  "qipRef": "",
  "captureSource": "devobs",
  "sharedId": "uid-linking-to-health-check",
  "copyForHyper": true,
  "normalised": "learning-walk|staff-cpd|teams-environments"
}
```

**Record 2 — `area.healthChecks.records[]`** (created simultaneously):
```json
{
  "id": "uid",
  "sharedId": "same-uid-as-activityLog-entry",
  "date": "2026-06-05",
  "type": "developmental-observation",
  "lecturer": "Christie Ross",
  "score": null,
  "notes": "Auto-populated from Dev Obs outcome field",
  "dimensions": {
    "staffCapability": null,
    "accessibilityHealth": null
  },
  "sourceEntryId": "activityLog-entry-uid"
}
```

The `sharedId` links them so the Report Builder can say "this health check came from a DevObs on [date]" without storing duplicates.

### 2c. LRA entry structure
LRA saves produce TWO records:

**Record 1 — `area.activityLog[]`:**
```json
{
  "id": "uid",
  "dateLogged": "2026-06-05T09:00:00.000Z",
  "type": "lra",
  "subtype": "Learning Review Activity",
  "title": "LRA — [Lecturer] ([Area])",
  "areaCode": "BUI",
  "academicYear": "2025/26",
  "lecturer": "Christie Ross",
  "observer": "Graeme Wright",
  "programme": "Construction",
  "sessionType": "Classroom",
  "level": "Level 3",
  "attendance": 85,
  "lraType": "Developmental",
  "findings": "Narrative findings",
  "positiveFindings": "What was strong",
  "areasForDevelopment": "What needs work",
  "hyperThemes": ["digital-tla", "teams-environments"],
  "ofstedThemes": ["behaviour-attitudes", "quality-education"],
  "actions": [
    { "theme": "Teams", "comment": "Action text", "when": "2026-07-01" }
  ],
  "referralAction": "",
  "referralNotes": "",
  "tags": ["lra", "learning-walk", "quality"],
  "pyramidLevel": "developing",
  "qipRef": "T&L 3.1",
  "captureSource": "lra",
  "sharedId": "uid-linking-to-intervention",
  "copyForHyper": true,
  "normalised": "learning-walk|curriculum-design"
}
```

**Record 2 — `area.interventions[]`** (created simultaneously):
```json
{
  "id": "uid",
  "sharedId": "same-uid-as-activityLog-entry",
  "dateLogged": "2026-06-05",
  "type": "learning-walk",
  "title": "LRA — Christie Ross",
  "notes": "Auto-populated from LRA findings",
  "expectedImpact": "",
  "actualOutcome": "",
  "status": "in-progress",
  "sourceEntryId": "activityLog-entry-uid"
}
```

### 2d. Migration additions to `migrateDB()` in data.js
No structural migration needed — new fields only appear on new records. Existing records are unaffected. The only addition is a check:

```javascript
// Ensure all activityLog entries have captureSource
area.activityLog.forEach(entry => {
  if (!entry.captureSource) entry.captureSource = 'legacy';
  if (!entry.tags)          entry.tags          = [];
  if (!entry.pyramidLevel)  entry.pyramidLevel  = null;
  if (!entry.qipRef)        entry.qipRef        = '';
  if (!entry.normalised)    entry.normalised     = DPC.normaliseAction(entry.type + ' ' + (entry.notes || ''));
});
```

---

## 3. Files Needed (pre-existing, must be present)

| File | Location | Status | Role |
|------|----------|--------|------|
| `data.js` | `js/data.js` | ✓ Built (v3.0) | DB, migration, helpers, report extractors |
| `rag.js` | `js/rag.js` | ✓ Existing | RAG matrix scoring |
| `areas.js` | `js/areas.js` | ✓ Existing | Area tabs and rendering |
| `reports.js` | `js/reports.js` | ✓ Built (v1.0) | Report Builder UI + data extraction |
| `app.js` | `js/app.js` | ✓ Updated | Init, navigation, dashboard |
| `hub.html` | `hub.html` | ✓ Updated | Main HTML shell |
| `design.css` | `css/design.css` | ✓ Updated | All styles |
| `data/areas-seed.json` | `data/areas-seed.json` | ✓ Existing | 35 area seed data |
| `data/rag-schema.json` | `data/rag-schema.json` | ✓ Existing | RAG dimension schema |
| `data/hc-schema.json` | `data/hc-schema.json` | ✓ Existing | Health check schema |

---

## 4. Files to Create (Phase 3b)

### File 1: `js/quickcapture.js` (~400 lines)

**What it does:**
- Renders the Quick Capture section UI
- Grouped activity type dropdown matching Evidence Hub categories
- Dynamic form updates per type (same UX as screenshots)
- Tags panel (Accessibility & Inclusion, Digital Skills, TLA Pedagogy, Systems)
- QIP reference field
- Pyramid level selector (Foundations / Inclusion / Innovation)
- Action points sub-form (action text, who, target date)
- Save → `DPC.DB` with full schema v3.1 entry
- "Log DevObs" and "Log LRA" buttons that open the respective modals
- Filter/search view of recent captures

**Key functions to implement:**
```javascript
DPC.QC = {
  renderUI(containerId),           // Renders the full Quick Capture section
  _buildActivityTypeGroups(),      // Returns grouped dropdown options
  _renderForm(typeId),             // Dynamic form per type
  _gatherEntry(),                  // Collects form values → schema entry
  save(),                          // Validates + saves to DPC.DB + auto-normalises
  _getTargetStore(areaCode),       // Returns area.activityLog or individualActivities
  renderRecentCaptures(containerId) // Last 20 entries across all areas
}
```

**Activity type groups (matching screenshots):**

```javascript
const ACTIVITY_GROUPS = [
  {
    group: 'Meetings',
    types: [
      { id: 'meeting-quality-team',   label: 'Quality Team Meeting' },
      { id: 'meeting-line-manager',   label: 'Line Manager 1:1' },
      { id: 'meeting-digital-leads',  label: 'Digital Leads Coaching' },
      { id: 'meeting-hoa',            label: 'Head of Area Meeting' },
      { id: 'meeting-exec',           label: 'Executive Team' },
      { id: 'meeting-digital-dev',    label: 'Digital Development Team' },
      { id: 'meeting-external',       label: 'External / BETT / Conferences' },
    ]
  },
  {
    group: 'Teach.Meets',
    types: [
      { id: 'teachmeet-ai-learning',  label: 'AI for Learning' },
      { id: 'teachmeet-ai-efficiency',label: 'AI for Efficiency' },
      { id: 'teachmeet-live-model',   label: 'Live Modeling' },
      { id: 'teachmeet-qa',           label: 'Q+A' },
      { id: 'teachmeet-teams',        label: 'Teams' },
      { id: 'teachmeet-accessibility',label: 'Accessibility & Inclusion' },
      { id: 'teachmeet-capturing',    label: 'Capturing Learning' },
      { id: 'teachmeet-feedback',     label: 'Feedback + Assessment' },
      { id: 'teachmeet-monitoring',   label: 'Monitoring' },
      { id: 'teachmeet-clarification',label: 'Clarification' },
      { id: 'teachmeet-engagement',   label: 'Engagement' },
      { id: 'teachmeet-21c',          label: '21st Century Learning Design' },
      { id: 'teachmeet-udl',          label: 'UDL' },
      { id: 'teachmeet-impact',       label: 'Impact' },
    ]
  },
  {
    group: 'Coaching',
    types: [
      { id: 'coaching-group',         label: 'Group Coaching' },
      { id: 'coaching-1to1',          label: '1:1 Coaching' },
    ]
  },
  {
    group: 'COGs',
    types: [
      { id: 'cog-overview',           label: 'Overview Planning' },
      { id: 'cog-session-1',         label: 'Session 1' },
      { id: 'cog-session-2',         label: 'Session 2' },
      { id: 'cog-session-3',         label: 'Session 3' },
      { id: 'cog-session-4',         label: 'Session 4' },
    ]
  },
  {
    group: 'CPD & Professional',
    types: [
      { id: 'cpd-own',               label: 'Own Professional Development' },
      { id: 'cpd-external',          label: 'External Events & Networking' },
    ]
  },
  {
    group: 'Observations',
    types: [
      { id: 'obs-devobs',            label: 'Developmental Observation (DevObs)' },
      { id: 'obs-lra',              label: 'Learning Review Activity (LRA)' },
    ]
  }
];
```

**Wiring into hub.html:**
- Add `<section id="section-quick-capture">` after the Dashboard section
- Add nav button in sidebar (before Areas)
- Add `<script src="js/quickcapture.js"></script>` before `reports.js`
- Add `DPC.QC.renderUI('quick-capture-container')` to `DPC.App.init()`

---

### File 2: `js/devobs.js` (port from Evidence Hub, ~500 lines)

**What it does:**
- Full DevObs form mirroring Weston Hyper platform structure
- Sections: Observation Details, Observation Record (timestamped rows), The Plan, Outcome
- "Copy for Hyper" clipboard function (preserve this — it's valuable)
- Save → simultaneously to `area.activityLog[]` AND `area.healthChecks.records[]`
- Linked by `sharedId`

**Key differences from Evidence Hub version:**
- Replace `DB.areas` → `DPC.DB.areas`
- Remove `DB.threads`, `DB.referrals`, `DB.tasks` (not in Impact Hub)
- Remove `linkEntryToThread()`, `createTaskFromReferral()`, `updateReferralBadge()`
- Replace `markDirty()` → `DPC.saveToLocalStorage()`
- Replace `renderDashboard()` → `DPC.App.renderDashboard()`
- Replace `toast()` → `DPC.App.toast()`
- Replace `genId()` → `DPC.uid()`
- Replace `esc()` → `DPC.escHtml()`
- Add health check record creation on save (new)
- Add `pyramidLevel`, `qipRef`, `tags[]`, `normalised` fields on save (new)
- Rendered as a modal triggered from Quick Capture (not a full page section)

**Functions to implement:**
```javascript
DPC.DevObs = {
  open(ctx),          // Opens modal, inits form. ctx = { areaCode, editId }
  _renderForm(ctx),   // Builds the HTML form
  _addObsRow(),       // Adds a timestamped observation row
  _gatherEntry(),     // Collects all fields → schema entry
  save(),             // Validates, saves to activityLog + healthChecks, closes modal
  copyForHyper(),     // Formats plain text → clipboard
  clear()             // Confirms + resets form
}
```

**Wiring:**
- No new section in hub.html needed — renders into the global modal (`modal-backdrop`)
- Triggered by `DPC.DevObs.open({ areaCode: 'BUI' })` from Quick Capture
- `<script src="js/devobs.js"></script>` added to hub.html after quickcapture.js

---

### File 3: `js/lra.js` (port from Evidence Hub, ~550 lines)

**What it does:**
- Full LRA form mirroring Weston Hyper platform structure
- Five sections: Observation Details, Findings, Themes (Hyper + Ofsted), Actions, Referral
- "Copy for Hyper" clipboard function (preserve)
- Save → simultaneously to `area.activityLog[]` AND `area.interventions[]`
- Linked by `sharedId`

**Key differences from Evidence Hub version:**
- Same substitutions as DevObs above
- Remove referral creation system (DB.referrals not present)
- Add `pyramidLevel`, `qipRef`, `tags[]`, `normalised` on save
- Rendered as modal from Quick Capture

**Functions to implement:**
```javascript
DPC.LRA = {
  open(ctx),          // Opens modal. ctx = { areaCode, editId }
  _renderForm(ctx),   // Builds 5-section form
  _addActionRow(),    // Adds themed action row
  _gatherEntry(),     // Collects all fields → schema entry
  save(),             // Validates, saves to activityLog + interventions, closes modal
  copyForHyper(),     // Formats plain text → clipboard
  clear()             // Confirms + resets
}
```

**Wiring:**
- Modal trigger from Quick Capture: `DPC.LRA.open({ areaCode: 'BUI' })`
- `<script src="js/lra.js"></script>` added after devobs.js

---

## 5. hub.html Changes Required

```html
<!-- Add to sidebar nav (after Dashboard, before All Areas) -->
<span class="nav-section-label">Capture</span>
<button class="nav-item" data-nav="quick-capture"
  onclick="DPC.App.navigateTo('quick-capture')"
  type="button">
  <span class="nav-icon" aria-hidden="true">⊕</span>
  Quick Capture
</button>

<!-- Add new section (after section-dashboard) -->
<section class="page-section" id="section-quick-capture"
  aria-labelledby="heading-qc" aria-hidden="true">
  <div class="page-inner">
    <h2 class="section-heading" id="heading-qc">Quick Capture</h2>
    <p class="section-sub">Log any activity — meetings, teach meets, observations, CPD</p>
    <div id="quick-capture-container"></div>
  </div>
</section>

<!-- Add script tags (load order: data → rag → areas → quickcapture → devobs → lra → reports → app) -->
<script src="js/quickcapture.js"></script>
<script src="js/devobs.js"></script>
<script src="js/lra.js"></script>
```

---

## 6. app.js Changes Required

```javascript
// In DPC.App.init(), after existing render calls:
if (DPC.QC) DPC.QC.renderUI('quick-capture-container');

// data.js migrateDB() — add captureSource backfill:
area.activityLog.forEach(entry => {
  if (!entry.captureSource) entry.captureSource = 'legacy';
  if (!entry.tags)          entry.tags          = [];
  if (!entry.pyramidLevel)  entry.pyramidLevel  = null;
  if (!entry.qipRef)        entry.qipRef        = '';
  if (!entry.normalised)    entry.normalised     = DPC.normaliseAction(
    entry.type + ' ' + (entry.notes || '')
  );
});
```

---

## 7. design.css Changes Required

One new block appended — Quick Capture section styles:

```css
/* Quick Capture section */
.qc-type-select { /* grouped dropdown styling */ }
.qc-form-panel  { /* dynamic form container */ }
.qc-tag-grid    { /* tag chip grid */ }
.qc-tag-chip    { /* individual tag chip — toggleable */ }
.qc-tag-chip.selected { background: var(--col-accent); color: #fff; }
.qc-recent-log  { /* recent captures list */ }
.qc-recent-entry { /* single entry in recent log */ }
/* DevObs / LRA modal specifics */
.obs-row        { /* timestamped observation row */ }
.section-panel  { /* collapsible section panel */ }
.section-panel-header { /* panel header / trigger */ }
.section-panel-body   { /* panel body */ }
```

Most of these already exist in Evidence Hub CSS — they need porting into `design.css`.

---

## 8. Future Knowledge: Report Builder Integration

When all three files exist and are wired, the Report Builder (`reports.js`) already knows how to use the data — `DPC.getAreaReportData()` pulls from `area.activityLog[]` filtered by date. No changes to `reports.js` needed.

However, three enhancements to `reports.js` become possible once Quick Capture is live:

### 8a. Tag-based filtering
```javascript
// In getAreaReportData(), add:
const activitiesByTag = {};
(area.activityLog || []).forEach(entry => {
  (entry.tags || []).forEach(tag => {
    if (!activitiesByTag[tag]) activitiesByTag[tag] = [];
    activitiesByTag[tag].push(entry);
  });
});
```
This lets the Neil weekly report say "3 Teams Environments activities this week across BUI, CON, HBH" as a grouped statement rather than a flat list.

### 8b. QIP cross-reference
```javascript
// In getCollegeReportData(), add:
const qipEvidence = {};
DPC.DB.areas.forEach(area => {
  (area.activityLog || []).forEach(entry => {
    if (entry.qipRef) {
      if (!qipEvidence[entry.qipRef]) qipEvidence[entry.qipRef] = [];
      qipEvidence[entry.qipRef].push({ areaCode: area.code, ...entry });
    }
  });
});
```
This feeds the Ben Manning report's "evidence against QIP priorities" section and the AP report's "what to look for in observation" section.

### 8c. Pyramid level aggregation
```javascript
// Cross-college: how many activities at each pyramid level
const pyramidActivity = { foundations: 0, inclusion: 0, innovation: 0 };
DPC.DB.areas.forEach(area => {
  (area.activityLog || []).forEach(entry => {
    if (entry.pyramidLevel) pyramidActivity[entry.pyramidLevel]++;
  });
});
```
Feeds the Ben Manning monthly strategic picture and governance review comparisons.

---

## 9. Testing Expectations — What You Should See

### 9a. Quick Capture shell only (File 1 complete, Files 2 & 3 pending)

| Test | Expected result |
|------|----------------|
| Navigate to Quick Capture | Section loads, grouped dropdown visible |
| Select "Head of Area Meeting" | Form shows: Date (pre-filled today), Area selector, Title, Key Points / Notes, Action Points sub-form, Tags panel, QIP Ref, Pyramid Level |
| Select area (e.g. BUI), fill notes, save | Toast "Saved ✓", entry appears in Recent Captures list |
| Open BUI area → Overview tab | New entry visible in activity log with correct date and type |
| Open Report Builder → Neil Weekly | Activity appears in "this week" section grouped by normalised cluster |
| Open Report Builder → select BUI Digital Lead | Activity appears in Recent Activity section |
| Select "Developmental Observation" from dropdown | Button appears: "Open Dev Obs form" (modal trigger) — modal not yet functional if File 2 not built |

### 9b. DevObs (File 2 complete)

| Test | Expected result |
|------|----------------|
| Trigger DevObs from Quick Capture (area BUI pre-filled) | Modal opens with Observation Details section expanded, Area pre-selected |
| Fill lecturer, date, 2 obs rows, goals, strategies | All fields populate correctly |
| Click Save | Modal closes, toast "Dev Obs saved ✓" |
| Open BUI area → Activity Log tab | Entry present: type "devobs", title "Dev Obs — [name] (BUI)", with obs rows visible |
| Open BUI area → Health Checks tab | New health check record present with sharedId matching activityLog entry |
| Click "Copy for Hyper" | Clipboard contains formatted plain text matching Hyper platform layout |
| Open Report Builder → BUI Digital Lead | DevObs appears in Recent Activity AND Accessibility & Inclusion Health Checks section |
| Open Report Builder → BUI AP Report | DevObs outcome appears in "what to look for" section if apObs field populated |

### 9c. LRA (File 3 complete)

| Test | Expected result |
|------|----------------|
| Trigger LRA from Quick Capture | Modal opens with 5 sections, date pre-filled |
| Fill all 5 sections including Ofsted themes | Form saves without error |
| Click Save | Toast "LRA saved ✓", modal closes |
| Open BUI area → Activity Log | LRA entry present with all structured fields |
| Open BUI area → Interventions tab | New intervention record present with sharedId linking to LRA |
| QIP Ref populated on LRA | Appears in Ben Manning report under QIP evidence |
| Click "Copy for Hyper" | Formatted text matches Hyper LRA layout |

### 9d. Cross-cutting — reports work for all 5 audiences

| Audience | Report | What proves it works |
|----------|--------|---------------------|
| **Neil Davies** | Weekly | Activity count matches logs; groups by normalised cluster (e.g. "Teams Environments: 3 activities — BUI, CON, HBH"); open actions listed with area codes |
| **Digital Lead** | Area report | DevObs entries appear in health check section with named lecturer; current actions from `area.currentActions[]` appear in Now/Next/Future; staff confidence scores visible if logged |
| **AP / HoA** | Area report | Trajectory narrative auto-generated from RAG snapshot history; staff CPD table populated; expected impact statements from interventions present; "suggested observation focus" field available |
| **Ben Manning** | Monthly | RAG distribution table shows all 35 areas; RAG movers table shows areas that changed; activity volume figure correct; QIP evidence section populated if qipRef used; pyramid level breakdown visible |
| **Governance review** | Performance | RAG snapshot history charts movement over time (requires at least 2 snapshots per area); narrative shows "from X to Y between date1 and date2" |

### 9e. Data integrity checks

Run these manually after building:

1. **Save a Quick Capture for BUI** → download JSON → open in text editor → confirm entry is in `areas[code=BUI].activityLog[]` with `captureSource: "quick-capture"`, `dateLogged`, `tags[]`, and `normalised` fields present
2. **Save a DevObs for BUI** → confirm JSON has: one entry in `activityLog` with `type: "devobs"` AND one entry in `healthChecks.records[]` with matching `sharedId`
3. **Save an LRA for BUI** → confirm JSON has: one entry in `activityLog` with `type: "lra"` AND one entry in `interventions[]` with matching `sharedId`
4. **Reload the page** → confirm all three entries are still present (localStorage persistence working)
5. **Download JSON, re-upload** → confirm all entries survive round-trip

---

## 10. Build Sequence for Next Session

Start the next session by pasting this document and saying:

> "Build Phase 3b. Start with `js/quickcapture.js`. The spec is in QUICKCAPTURE_BUILD_SPEC.md."

The assistant should:
1. Read `/mnt/project/js_data.js` (current data.js) before touching anything
2. Read `/mnt/project/hub.html` (current hub.html) for nav and section structure
3. Read `/mnt/project/app.js` for init pattern
4. Read `/mnt/project/design.css` for CSS variable names and existing component classes
5. Build `quickcapture.js` first — standalone, testable immediately
6. Update `hub.html` with nav item and section
7. Update `app.js` with init call
8. Append Quick Capture CSS to `design.css`
9. Test mentally against Section 9a before outputting
10. Then ask: "Ready for DevObs (File 2)?"

Files 2 (devobs.js) and 3 (lra.js) follow the same pattern — read the original Evidence Hub versions first (`/mnt/project/devobs.js` and `/mnt/project/ira.js`), adapt using the substitution list in Section 4, test against Section 9b / 9c.

---

## 11. Open Decisions (confirm with Graeme before building)

1. **DevObs Health Check scoring:** Should saving a DevObs automatically prompt for a quick dimension score (staffCapability, accessibilityHealth) — or just create the health check record with score=null for manual completion later?
   - *Recommendation: null on save, prompt shown in health check tab with "Complete from DevObs" link*

2. **LRA Ofsted themes list:** The Evidence Hub version references `DB.tags.ofsted` from config. For the Impact Hub port, should these be hardcoded in lra.js or pulled from a new `data/tags.json` file?
   - *Recommendation: hardcode in lra.js for now — move to tags.json in Phase 4*

3. **Quick Capture recent log:** Show last 20 entries across all areas, or only entries for the currently selected area?
   - *Recommendation: cross-college recent log (last 20), with area code badge on each entry*

4. **Modal vs full section for DevObs/LRA:** Current spec says modal (uses existing global modal). If the forms feel cramped in a modal, they can become full sections with their own nav items. Check after File 2 is built.
   - *Recommendation: try modal first; if the DevObs form feels too long, promote to section*

5. **`captureSource: "legacy"` on migration:** This tag on all pre-existing activityLog entries means the Report Builder could filter "only show Quick Capture entries" vs "all entries". Worth adding a toggle to the Report Builder options panel?
   - *Recommendation: yes, add as a checkbox: "Include legacy entries (pre Quick Capture)"*

