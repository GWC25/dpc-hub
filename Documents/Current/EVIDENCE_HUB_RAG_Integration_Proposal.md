# DPC Evidence Hub: RAG Ratings & Action Tracking Integration

**Purpose:** Embed the Multi-Dimensional RAG Assessment Framework into the Evidence Hub as a living, updatable system with week-by-week tracking and flexible reporting.

**Created:** May 2026 | For: Graeme Wright, Digital Pedagogy Coach

---

## Current State

The **Evidence Hub v3.0** is a capture system for coaching activities (meetings, training, observations). It stores entries in localStorage and exports to JSON for OneDrive storage.

**What's missing:** A structured way to:
1. Record & update RAG ratings for each area across 6 dimensions
2. Capture Strengths & AFIs as evidence entries
3. Log action progress (week-by-week, fortnightly, monthly)
4. Filter and review progress with timelines
5. Generate reports showing RAG movement & impact

---

## Proposed Solution: RAG Tracking Module Within Hub

### **High-Level Architecture**

```
Evidence Hub v3.0
├── Dashboard (current)
├── Quick Capture (current)
├── Coaching Log (current)
├── Meetings (current)
├── Resources & Outputs (current)
│
├── [NEW] RAG TRACKER MODULE
│   ├── RAG Status Board (by area, by dimension)
│   ├── Area Progress View (6-dimension snapshot)
│   ├── Strengths & AFI Log (evidence-linked)
│   ├── Action Tracker (week/fortnight/month view)
│   ├── Progress Reports (filtered by timeline)
│   └── Update History (audit trail of changes)
│
└── Report Builder (existing)
```

---

## 1. RAG TRACKER MODULE STRUCTURE

### **1a. Data Model (Add to Hub's DB)**

```json
{
  "areaRags": [
    {
      "areaId": "BUS",
      "areaName": "Business & Tourism",
      "hoaName": "Ben Melhuish",
      "dlName": "TBC",
      "ratings": {
        "timestamp": "2026-05-11T14:30:00Z",
        "overallRag": 2,
        "dimensions": {
          "staffCapability": {"rating": 2, "lastUpdated": "2026-05-11"},
          "hoaLeadership": {"rating": 2, "lastUpdated": "2026-05-11"},
          "digitalSkillsAssessment": {"rating": 2, "lastUpdated": "2026-05-11"},
          "curriculumIntegration": {"rating": 2, "lastUpdated": "2026-05-11"},
          "accessibilityHealth": {"rating": 2, "lastUpdated": "2026-05-11"},
          "digitalLeadEngagement": {"rating": 1, "lastUpdated": "2026-05-11"}
        }
      },
      "strengths": [
        {
          "id": "str-1",
          "text": "Staff confident with AI, PM tools, dashboards",
          "source": "Audit",
          "date": "2026-05-11",
          "linkedDimensions": ["staffCapability"]
        },
        {
          "id": "str-2",
          "text": "Excellent Teams adoption across all class spaces",
          "source": "Audit",
          "date": "2026-05-11",
          "linkedDimensions": ["staffCapability", "curriculumIntegration"]
        }
      ],
      "afis": [
        {
          "id": "afi-1",
          "text": "Staff less confident with CRMs and Digital Booking Systems",
          "source": "Audit",
          "date": "2026-05-11",
          "linkedDimensions": ["staffCapability"],
          "priority": "high",
          "status": "in-progress"
        }
      ],
      "actionLog": [
        {
          "id": "act-1",
          "phase": "week-1",
          "startDate": "2026-05-11",
          "dueDate": "2026-05-17",
          "action": "Confirm Digital Lead identity with Ben. Schedule fortnightly check-ins.",
          "owner": "Graeme",
          "status": "completed",
          "completedDate": "2026-05-13",
          "evidence": "Email from Ben confirming DL",
          "notes": ""
        },
        {
          "id": "act-2",
          "phase": "week-2",
          "startDate": "2026-05-18",
          "dueDate": "2026-05-24",
          "action": "CRM training audit - talk to 2-3 staff using CRM. What's the barrier?",
          "owner": "DL",
          "status": "in-progress",
          "completedDate": null,
          "evidence": "Barrier analysis notes (to be captured)",
          "notes": "Spoke to 2 staff; common barrier is 'time to learn'"
        },
        {
          "id": "act-3",
          "phase": "fortnight-1",
          "startDate": "2026-05-18",
          "dueDate": "2026-05-31",
          "action": "AT showcase with Ben (15 mins). Demo Immersive Reader, Accessibility Checker.",
          "owner": "Graeme",
          "status": "scheduled",
          "completedDate": null,
          "evidence": "",
          "notes": "Scheduled for 2026-05-20"
        },
        {
          "id": "act-4",
          "phase": "month-1",
          "startDate": "2026-06-01",
          "dueDate": "2026-06-30",
          "action": "CRM training rollout begins",
          "owner": "DL",
          "status": "not-started",
          "completedDate": null,
          "evidence": "",
          "notes": ""
        }
      ],
      "ratingHistory": [
        {
          "date": "2026-05-11",
          "overallRag": 2,
          "dimensions": {...},
          "changedBy": "Graeme",
          "notes": "Initial audit-based rating"
        }
      ]
    },
    // ... repeat for other 4 areas
  ]
}
```

---

### **1b. UI Components to Add to Hub**

#### **View 1: RAG Status Board (Dashboard-level)**

**Purpose:** At-a-glance view of all 5 areas, 6 dimensions each.

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ RAG STATUS BOARD                                       │
├────────────────────────────────────────────────────────┤
│ Filter by: [All] [Level 1] [Level 2] [Level 3] [Level 4] [Level 5]
│           Timeline: [All] [This Week] [This Fortnight] [This Month]
│
│ BUSINESS & TOURISM (Ben Melhuish)
│ Overall RAG: [2] ██████░░░░░░░░░░░░  Last Updated: 2026-05-13
│ ├─ Staff Capability:               [2] Updated 5/11
│ ├─ HoA Leadership & Planning:       [2] Updated 5/11
│ ├─ Digital Skills Assessment:       [2] Updated 5/11
│ ├─ Curriculum Integration:          [2] Updated 5/11
│ ├─ Accessibility & Inclusion:       [2] Updated 5/11
│ └─ Digital Lead Engagement:         [1] Updated 5/11 [TBC]
│ → 2 Strengths | 1 AFI | 4 Actions (2 this week, 2 due)
│
│ HAIR & BEAUTY / EDUCATION & EARLY YEARS (Jenna Ratcliffe)
│ Overall RAG: [2] ⚠️ CRITICAL: Accessibility = Level 4
│ [Details expand on click]
│
│ [... repeat for SIX, BUI/CON, MOT]
│
└────────────────────────────────────────────────────────┘
```

**Features:**
- Click area to expand full detail view
- Dimension color-coded (1=green, 2=green, 3=amber, 4=red, 5=dark red)
- Filter by RAG level
- Filter by timeline (This Week, This Fortnight, This Month)
- Show last updated date
- Quick link to "Update RAG" or "View Actions"

---

#### **View 2: Area Progress View (Detailed)**

**Purpose:** Drill into one area; see 6 dimensions, strengths, AFIs, and action progress.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ BUSINESS & TOURISM (BUS) | RAG Progress                │
│ HoA: Ben Melhuish | DL: TBC                            │
├─────────────────────────────────────────────────────────┤
│
│ OVERALL RAG: 2 (On Track)
│ Last Updated: 2026-05-13 | Next Review: 2026-05-24
│ Timeline: [Week 1] [Fortnight 1] [Month 1] [All Time]
│
│ ┌─────────────────────────────────────────────────────┐
│ │ 6 DIMENSIONS                                         │
│ ├─────────────────────────────────────────────────────┤
│ │ 1. Staff Digital Capability          [2] ██████     │
│ │    Last: 2026-05-11                                 │
│ │    Strengths:                                       │
│ │    • Staff confident with AI, PM tools, dashboards  │
│ │    • Excellent Teams adoption across all spaces     │
│ │    AFIs:                                            │
│ │    • Staff less confident with CRMs & Booking Sys   │
│ │                                                      │
│ │ 2. HoA Leadership & Planning         [2] ██████     │
│ │    [Click to expand]                                │
│ │                                                      │
│ │ 3. Digital Skills Assessment & Track [2] ██████     │
│ │    [Click to expand]                                │
│ │                                                      │
│ │ [... etc]                                            │
│ └─────────────────────────────────────────────────────┘
│
│ ┌─────────────────────────────────────────────────────┐
│ │ STRENGTHS (2 total)                                 │
│ ├─────────────────────────────────────────────────────┤
│ │ ✓ Staff confident with AI, PM tools, dashboards    │
│ │   Source: Audit | Date: 2026-05-11                  │
│ │   Linked to: Dim 1 | Evidence tags: [Audit]         │
│ │                                                      │
│ │ ✓ Excellent Teams adoption across all class spaces │
│ │   Source: Audit | Date: 2026-05-11                  │
│ │   Linked to: Dim 1, 4 | Evidence tags: [Audit]      │
│ │                                                      │
│ │ [+ Add Strength]                                    │
│ └─────────────────────────────────────────────────────┘
│
│ ┌─────────────────────────────────────────────────────┐
│ │ AREAS FOR IMPROVEMENT (AFIs) (1 total)              │
│ ├─────────────────────────────────────────────────────┤
│ │ ⚠ Staff less confident with CRMs & Digital Booking  │
│ │  Source: Audit | Date: 2026-05-11 | Priority: HIGH │
│ │  Linked to: Dim 1 (Staff Capability)                │
│ │  Status: [In Progress] | Evidence: [CRM training...] │
│ │  Actions linked: [act-1] [act-2] [act-3]            │
│ │                                                      │
│ │ [+ Add AFI]                                          │
│ └─────────────────────────────────────────────────────┘
│
│ ┌─────────────────────────────────────────────────────┐
│ │ ACTION TRACKER (by phase)                           │
│ ├─────────────────────────────────────────────────────┤
│ │ WEEK 1 (2026-05-11 to 2026-05-17)                   │
│ │ ✓ Confirm Digital Lead identity + schedule check-ins
│ │   Owner: Graeme | Status: COMPLETED (2026-05-13)    │
│ │   Evidence: Email confirmation                      │
│ │                                                      │
│ │ ⧖ CRM training audit - talk to 2-3 staff           │
│ │   Owner: DL | Status: IN PROGRESS                   │
│ │   Due: 2026-05-17 | Evidence: Barrier analysis...   │
│ │                                                      │
│ │ FORTNIGHT 1 (2026-05-18 to 2026-05-31)             │
│ │ ◦ AT showcase with Ben (15 mins)                    │
│ │   Owner: Graeme | Status: SCHEDULED (2026-05-20)    │
│ │   Evidence: [pending]                               │
│ │                                                      │
│ │ MONTH 1 (2026-06-01 to 2026-06-30)                  │
│ │ ○ CRM training rollout begins                       │
│ │   Owner: DL | Status: NOT STARTED                   │
│ │   Evidence: [pending]                               │
│ │                                                      │
│ │ [+ Add Action]                                      │
│ └─────────────────────────────────────────────────────┘
│
│ ┌─────────────────────────────────────────────────────┐
│ │ RATING HISTORY (audit trail)                        │
│ ├─────────────────────────────────────────────────────┤
│ │ 2026-05-11: Overall RAG = 2 (Initial audit-based)   │
│ │              Dimensions: 2,2,2,2,2,1                │
│ │              Updated by: Graeme                     │
│ └─────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- All 6 dimensions in one view (click to expand/collapse)
- Strengths & AFIs captured with evidence links
- Action Tracker organized by phase (Week, Fortnight, Month)
- Status badges: ✓ Completed | ⧖ In Progress | ◦ Scheduled | ○ Not Started
- Evidence links (e.g., "attached meeting notes," "Learning Walk observation")
- Rating history (audit trail of changes)
- Timeline filter (This Week / This Fortnight / This Month / All Time)

---

#### **View 3: Action Tracker (Weekly/Fortnightly/Monthly)**

**Purpose:** Filter and track actions by timeline; see what's due when.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ ACTION TRACKER                                           │
│ Filter by: [This Week] [This Fortnight] [This Month]    │
│ Group by: [Timeline] [Owner] [Status] [Area]            │
│ View: [List] [Calendar] [Kanban]                        │
├──────────────────────────────────────────────────────────┤
│
│ WEEK 1 (2026-05-11 to 2026-05-17) — 5 items
│
│ ✓ [BUS] Confirm DL + schedule check-ins
│   Owner: Graeme | Due: 2026-05-17 | COMPLETED 2026-05-13
│   Evidence: Email confirmation | Linked: Dim 6
│
│ ⧖ [BUS] CRM training audit
│   Owner: DL | Due: 2026-05-17 | IN PROGRESS
│   Evidence: Barrier analysis (2 staff spoken to) | Linked: Dim 1
│
│ ⧖ [HBH/EYE] Attend Accessibility Teach-Meet (URGENT)
│   Owner: Tracey, Sharon | Due: 2026-05-24 | IN PROGRESS
│   Evidence: [Pending: registration confirmation] | Linked: Dim 5
│
│ [... etc]
│
│ FORTNIGHT 1 (2026-05-18 to 2026-05-31) — 12 items
│
│ ◦ [BUS] Ensure 100% learner Century IA completion
│   Owner: Ben | Due: 2026-05-24 | SCHEDULED
│   Evidence: [Pending: Century dashboard check] | Linked: Dim 3
│
│ [... etc]
│
│ MONTH 1 (2026-06-01 to 2026-06-30) — 8 items
│ [collapsed]
│
└──────────────────────────────────────────────────────────┘
```

**Key Features:**
- Filter by timeline (Week 1, Fortnight 1, Month 1, etc.)
- Group by Owner, Status, or Area
- View as List, Calendar, or Kanban board
- Status badges with completion tracking
- Quick evidence capture (link notes, meeting docs, etc.)
- Color-coded by area

---

## 2. DATA CAPTURE WORKFLOWS

### **Workflow A: Initial RAG Entry (One-time)**

**When:** Week 1 of coaching (after coaching conversation with HoA)

**Steps:**
1. Navigate to **RAG Tracker → New Area Evaluation**
2. Select area from dropdown
3. **Enter Overall RAG (1–5)** with rationale (text area, 500 chars)
4. **Rate each of 6 dimensions** (1–5 selector + rationale field)
5. **Add Strengths** (3–5 bullet points, link to dimension)
6. **Add AFIs** (3–5 items, link to dimension, set priority)
7. **Import Actions** from RECOMMENDED_RAG_RATINGS doc
   - Paste/import actions grouped by phase (Week/Fortnight/Month)
   - System auto-assigns to areas based on selection
   - Each action gets: text, owner, due date, phase, linked dimension
8. **Save entry** → Creates initial snapshot with timestamp

---

### **Workflow B: Weekly Progress Update**

**When:** Every Friday (end of week) or Monday (start of new week)

**Steps:**
1. Navigate to **RAG Tracker → [Area Name] → Action Tracker**
2. **Week In View:** Show all actions due this week + next week
3. **Update Status** on each action:
   - Mark as ✓ Completed (log evidence link)
   - Update ⧖ In Progress (add notes, attach meeting notes/photos)
   - ◦ Reschedule if needed (move to next week/fortnight)
4. **Log Evidence:** For any completed action, attach:
   - Meeting notes (copy-paste or upload)
   - Photos (learning walk, staff session)
   - Quote/testimonial
   - Document link (e.g., "Specialist Skills Rubric v1")
5. **Optional:** If RAG dimension has shifted, update rating
   - Dimension rating + rationale
   - System logs change with timestamp
6. **Save** → Creates weekly checkpoint

---

### **Workflow C: Fortnightly Check-In (Coaching Conversation)**

**When:** Every 2 weeks (fortnightly meeting with HoA)

**Steps:**
1. Navigate to **RAG Tracker → [Area Name]**
2. **Review last 2 weeks:**
   - Which actions completed?
   - Which are at risk (due soon, in progress)?
   - Any RAG dimension movement?
3. **Update Strengths & AFIs** if new evidence emerged
   - New strengths to celebrate
   - AFIs resolved (mark as "resolved")
   - New AFIs spotted (add with priority)
4. **Plan next fortnight:**
   - Are next fortnight's actions still on track?
   - Any barriers/blockers to escalate?
   - Any new actions needed?
5. **Log coaching meeting** as an evidence entry
   - Template: "HoA Coaching Session (Fortnightly)"
   - Link to area RAG tracker
   - Capture: mood, confidence, key discussion points, action points
6. **Save** → Coaching conversation is timestamped and linked to RAG tracker

---

### **Workflow D: Monthly RAG Review**

**When:** End of month (e.g., 2026-05-31) or start of next month

**Steps:**
1. Navigate to **RAG Tracker → [Area Name] → Rating History**
2. **Review month in retrospect:**
   - How many actions completed? (%) 
   - What evidence was logged?
   - Any dimension ratings changed?
3. **Monthly RAG Update:**
   - Has any dimension moved? (e.g., Level 3 → Level 2)
   - Has overall RAG shifted?
   - Capture: rationale, evidence summary, changed by (user)
4. **Generate Progress Report** (see Section 3 below)
   - Export as PDF or HTML
   - Include: Actions completed, dimensions changed, next month priorities
5. **Archive month** (optional lock/snapshot)
   - Current monthly data becomes read-only
   - Easy to compare Month 1 vs Month 2 progress

---

## 3. REPORTING: FLEXIBLE VIEWS & EXPORTS

### **Report Type 1: Area Progress Summary (Weekly)**

**Purpose:** Quick snapshot of one area; share with HoA

**Contents:**
- Overall RAG + dimension ratings (color-coded)
- Strengths (top 3)
- AFIs (top 3 + priority)
- Actions completed this week (count + %)
- Actions due next week (list + owners)
- Evidence logged (count + types)
- Next steps (1–3 bullets)

**Export:** PDF, email-ready, 1 page

**Example:**
```
┌───────────────────────────────────────────────┐
│ BUSINESS & TOURISM (BUS)                      │
│ HoA: Ben Melhuish | DL: [TBC → Confirm W1]    │
│ Week ending: 2026-05-17                       │
├───────────────────────────────────────────────┤
│
│ OVERALL RAG: 2 (On Track)
│
│ Dimension Ratings:
│  1. Staff Capability:        [2] ──── On Track
│  2. HoA Leadership:          [2] ──── On Track
│  3. Digital Skills Assess:   [2] ──── On Track
│  4. Curriculum Integration:  [2] ──── On Track
│  5. Accessibility Health:    [2] ──── On Track
│  6. Digital Lead Engagement: [1] ⚠ Needs confirm
│
│ TOP STRENGTHS
│  ✓ Staff confident with AI, PM tools
│  ✓ Excellent Teams adoption
│  ✓ Strong device bank (417 PCs)
│
│ TOP AFIs
│  ⚠ CRM/Booking Systems staff gaps (HIGH)
│  ⚠ Device equity for non-bursary learners
│  ⚠ Accessibility training not systematic
│
│ PROGRESS THIS WEEK
│  Actions Completed: 1/4 (25%)
│   ✓ Confirmed DL identity (2026-05-13)
│  
│  Actions In Progress: 2/4
│   ⧖ CRM barrier audit (Due 2026-05-17)
│   ⧖ Century IA completion check (Due 2026-05-24)
│
│  Next Week's Due: 3 actions
│   • Ensure 100% Century IA
│   • Agree one CRM to pilot
│   • AT showcase demo
│
│ EVIDENCE LOGGED (This Week)
│  • 1 Meeting (HoA initial coaching, 2026-05-11)
│  • 2 Notes (CRM barrier audit, DL confirmation)
│
│ NEXT STEPS (Next Week)
│  1. Run CRM barrier analysis (DL)
│  2. Check Century dashboard (Ben M.)
│  3. Schedule AT showcase with Graeme (2026-05-20)
│
└───────────────────────────────────────────────┘
```

---

### **Report Type 2: Portfolio Overview (Fortnightly)**

**Purpose:** All 5 areas at a glance; share with Neil Davies / Ben Manning

**Contents:**
- Table: Area, HoA, Overall RAG, Key Focus, Actions This Fortnight (completed/due)
- Summary: % of actions on track, % completed, any blockers
- Critical flags (Level 4–5 dimensions, missed deadlines)
- Next fortnight priorities

**Export:** PDF, 2–3 pages, can be printed for Quality Team

---

### **Report Type 3: Dimension Deep-Dive (Monthly)**

**Purpose:** Track movement in one dimension across all 5 areas

**Example: Accessibility & Inclusion Health (Dimension 5)**

**Contents:**
- Title: "Accessibility & Inclusion: Month 1 Review"
- Table: Area, HoA, Dimension 5 Rating, Change from baseline, Evidence, Next Action
- Narrative: "This month, 3 areas attended Accessibility Teach-Meet. HBH/EYE (was Level 4) now moving to Level 3. Key gap: staff still not offering AT proactively. Next month: 1:1 coaching on AT promotion."
- Chart: Accessibility rating by area (visual)

**Export:** PDF or presentation

---

### **Report Type 4: Action Completion Dashboard (End of Month)**

**Purpose:** Accountability tracking; measure coaching effort

**Contents:**
- KPIs: 
  - Total actions planned: 24
  - Total actions completed: 18 (75%)
  - On-track %: 85%
  - At-risk actions: 2 (CRM training delayed)
- Actions by area (bar chart)
- Actions by owner (pie chart)
- Actions by status (Gantt or Kanban view)
- Completion rate trend (month-on-month)

**Export:** PDF, dashboard screenshot, email-ready

---

## 4. TECHNICAL IMPLEMENTATION NOTES

### **Database Structure (Add to Hub's config.json)**

```json
{
  "ragTracking": {
    "enabled": true,
    "areaRagsPath": "data/area-rags.json",
    "phases": ["week-1", "week-2", "week-3", "fortnight-1", "fortnight-2", "month-1"],
    "dimensions": [
      "staffCapability",
      "hoaLeadership",
      "digitalSkillsAssessment",
      "curriculumIntegration",
      "accessibilityHealth",
      "digitalLeadEngagement"
    ],
    "actionStatuses": ["not-started", "scheduled", "in-progress", "completed", "at-risk"],
    "strengthPriorities": ["foundational", "emerging", "developed"],
    "afiPriorities": ["low", "medium", "high", "critical"]
  }
}
```

### **New Hub Sections Required**

1. **RAG Tracker (Main module)**
   - RAG Status Board (overview)
   - Area Progress View (detailed)
   - Action Tracker (filtered by timeline)
   - Rating History (audit trail)

2. **Evidence Linking**
   - Each action, strength, AFI can link to:
     - Coaching meeting notes
     - Learning walk observations
     - Photo evidence
     - Testimonials/quotes
     - Resource documents

3. **Reports Section** (integrates with existing Report Builder)
   - Weekly Summary (by area)
   - Fortnightly Portfolio (all areas)
   - Monthly Dimension Deep-Dive
   - Action Completion Dashboard

---

## 5. WEEKLY/FORTNIGHTLY/MONTHLY WORKFLOWS AT A GLANCE

### **Weekly (Every Friday or Monday)**

| Task | Where | Who | Time |
|---|---|---|---|
| Update action status (Week actions) | RAG Tracker → Action List | DL / Graeme | 20 mins |
| Log evidence for completed actions | Link to action entry | DL / Graeme | 15 mins |
| Update in-progress notes | Action tracker | DL / Graeme | 10 mins |
| Generate weekly summary | Report Builder → Weekly | Graeme | 10 mins |
| **Total** | | | **55 mins** |

### **Fortnightly (Every 2 weeks, timing: coaching conversation)**

| Task | Where | Who | Time |
|---|---|---|---|
| Review & update Strengths/AFIs | Area Progress View | Graeme + HoA | 15 mins |
| Log coaching meeting | Coaching Log template | Graeme | 15 mins |
| Link coaching notes to RAG tracker | Evidence linking | Graeme | 10 mins |
| Plan next fortnight actions | Action Tracker → Add New | Graeme + DL | 20 mins |
| Generate fortnightly portfolio report | Report Builder → Portfolio | Graeme | 15 mins |
| **Total** | | | **75 mins** |

### **Monthly (End of month)**

| Task | Where | Who | Time |
|---|---|---|---|
| Review all actions completed (month) | RAG Tracker → Rating History | Graeme | 15 mins |
| Update RAG dimension ratings if shifted | Area Progress View | Graeme + HoA | 20 mins |
| Generate monthly action completion report | Report Builder → Completion | Graeme | 15 mins |
| Generate dimension deep-dive report | Report Builder → Dimension | Graeme | 15 mins |
| Archive month (optional) | RAG Tracker → Settings | Graeme | 5 mins |
| Share reports with Neil Davies & Ben Manning | Email export | Graeme | 10 mins |
| **Total** | | | **80 mins** |

---

## 6. SAMPLE FILTERING & VIEWS

### **Filter Combinations Users Will Want**

1. **"Show me all actions due THIS WEEK across all areas"**
   - Timeline: This Week | Group by: Area | Status: All
   
2. **"Which actions are AT RISK (due soon, not started)?"**
   - Status: At Risk | Timeline: This Fortnight | Group by: Owner

3. **"How many actions has the DL COMPLETED this month?"**
   - Owner: Digital Leads | Status: Completed | Timeline: Month 1 | Group by: Area

4. **"Show me ACCESSIBILITY actions across all areas"**
   - Linked Dimension: Accessibility & Inclusion Health | Timeline: All | Group by: Area

5. **"What STRENGTHS have we logged for BUS in the last month?"**
   - Area: BUS | Evidence Type: Strengths | Timeline: Month 1

6. **"Which areas are NOT on track (Level 3+) for Dim 2 (HoA Leadership)?"**
   - Dimension: HoA Leadership | Rating: [3, 4, 5] | Timeline: Current

---

## 7. REPORTING SCHEDULE FOR LEADERSHIP

### **For Neil Davies (Weekly)**
- Fortnightly portfolio summary (every 2 weeks)
- Any escalations (Level 4+ dimensions, missed deadlines)

### **For Ben Manning (Monthly)**
- Monthly portfolio overview
- Action completion rate (%)
- Dimension movement (which areas are progressing)
- Any blockers requiring senior intervention

### **For Quality Team (Quarterly)**
- Pilot governance review (Oct 2026, Apr 2027, Jul 2027)
- Evidence portfolio (all activities logged)
- RAG progression dashboard (showing movement over 3 months)
- Impact narrative (staff testimonials, learning walk observations, outcome data)

---

## 8. MIGRATION PLAN

### **Phase 1: Setup (Week 1)**
- [ ] Add RAG tracking data model to Hub config
- [ ] Build RAG Status Board UI
- [ ] Build Area Progress View UI
- [ ] Build Action Tracker UI
- [ ] Test with BUS area

### **Phase 2: Data Entry (Week 2)**
- [ ] Manually enter initial RAG ratings for all 5 areas (from RECOMMENDED_RAG_RATINGS doc)
- [ ] Enter all Strengths & AFIs
- [ ] Enter all Actions (24 total across 5 areas)
- [ ] Link evidence documents

### **Phase 3: Reporting (Week 3)**
- [ ] Build Weekly Summary report
- [ ] Build Fortnightly Portfolio report
- [ ] Build Monthly reports (completion, dimension deep-dive)
- [ ] Test exports (PDF, email)

### **Phase 4: Training & Launch (Week 4)**
- [ ] Train DLs on action logging + evidence capture
- [ ] Train HoAs on reviewing progress in Hub
- [ ] Go live with live coaching
- [ ] Weekly check-ins using Hub

---

## 9. TECHNICAL NOTES & RECOMMENDATIONS

### **Storage & Persistence**

**Option A (Current):** localStorage + manual export to JSON
- Pros: No backend needed, works offline
- Cons: Data lost if browser cache cleared
- **Recommendation:** Add weekly auto-backup reminder to Hub UI

**Option B (Recommended for Production):** localStorage + OneDrive sync
- Persist area RAGs to OneDrive weekly
- File structure: `/Digital-Coach-Evidence/area-rags/[area-code]-rags.json`
- Each area is its own file (easier to share/track)
- Graeme can version-control (append date to filename: `BUS-rags-2026-05-17.json`)

**Option C (Future):** Backend database (Node.js + MongoDB)
- Required if: Evidence Hub is shared with multiple users
- For now: Not needed; Graeme is primary user

### **Evidence Linking**

- Each action/strength/AFI can have 1+ evidence links:
  - Text link (copy URL or paste text)
  - File link (to OneDrive document)
  - Meeting notes (copy-paste from Coaching Log entry)
  - Photo/screenshot (upload)
- System should track: who added evidence, when, what type

### **RAG Rating Audit Trail**

- Every time a RAG dimension rating is updated, system logs:
  - Old rating → New rating
  - Timestamp
  - Changed by (user)
  - Rationale (text field)
- Creates "Rating History" timeline
- Allows monthly/quarterly trend analysis

---

## 10. QUICK-START CHECKLIST FOR GRAEME

**Week 1:**
- [ ] Add RAG data model to Hub (config.json)
- [ ] Build RAG Status Board UI section
- [ ] Build Area Progress View UI section
- [ ] Populate initial RAG ratings for all 5 areas (from RECOMMENDED_RAG_RATINGS doc)
- [ ] Enter Strengths & AFIs for all areas

**Week 2:**
- [ ] Enter Actions for all 5 areas (from coaching guides)
- [ ] Link actions to dimensions & owners
- [ ] Test weekly update workflow with BUS area
- [ ] Build Weekly Summary report template

**Week 3:**
- [ ] Build Fortnightly Portfolio report
- [ ] Build Monthly action completion report
- [ ] Train DLs on action status updates + evidence capture
- [ ] Plan weekly & fortnightly reporting schedule

**Week 4:**
- [ ] Go live with coaching
- [ ] Weekly check-ins using Hub (Friday updates)
- [ ] Fortnightly coaching conversations with HoAs (update RAG/Strengths/AFIs)
- [ ] Monthly governance review (generate & share reports)

---

## Conclusion

The **RAG Ratings & Action Tracking Module** transforms the Evidence Hub from a capture tool into a **living coaching system**. With flexible filtering, timeline views, and automated reporting, you'll be able to:

✅ **Track RAG movement** (see which areas are progressing)  
✅ **Monitor action completion** (hold DLs & HoAs accountable)  
✅ **Evidence outcomes** (link activities to RAG shifts)  
✅ **Report to leadership** (weekly/monthly summaries with confidence)  
✅ **Adjust strategy** (evidence-based decisions about next month's focus)

**Most importantly:** It moves you from assessment ("We've rated the areas") to **improvement** ("We're tracking progress weekly and seeing movement").

The system is designed for **your workflow** — weekly updates (20 mins), fortnightly coaching conversations (75 mins), monthly reviews (80 mins). Everything filters by timeline so you can answer: "What's due THIS WEEK?" and "What progress did we make THIS MONTH?"
