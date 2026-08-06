# Self-Assessment Form — Build Sheet
**Cycle:** 2026-27  
**Focus:** accessibility, digital-learning-environments, digital-skills-capability  
**Send date:** TBC — planned for week 4 of term (after the Quality team's Learning Walks in weeks 1-3)  
**Reminder:** mid-September 2026 — Digital Leads to chase non-completers

Build these questions into Microsoft Forms in this exact order. Field ids are for the Hub importer later — they don't appear in the Form itself, just keep this sheet as the reference.

---

### 1. Full name
- **Field id:** `fullName`
- **Type:** text
- **Required:** Yes

### 2. Which curriculum area do you work in?
- **Field id:** `areaCode`
- **Type:** single-select
- **Required:** Yes
- **Options:** AREA_CODES — populate with area names (not codes), sorted alphabetically
- **Note:** HoA name deliberately not asked — derived from area on import via data-areas.json, to avoid typo/mismatch against data already trusted more.

### 3. Jisc Discovery Tool — Goal 1
- **Field id:** `jiscGoal1`
- **Type:** text
- **Required:** Yes

### 4. Jisc Discovery Tool — Goal 2
- **Field id:** `jiscGoal2`
- **Type:** text
- **Required:** Yes

### 5. Jisc Discovery Tool — Goal 3
- **Field id:** `jiscGoal3`
- **Type:** text
- **Required:** Yes

### 6. How confident do you feel about achieving these three goals by the end of the year?
- **Field id:** `confidenceGoals`
- **Type:** scale-1to5
- **Required:** Yes
- **Scale:**
  1 — Not at all confident — haven't started with this yet
  2 — A little confident — basic awareness, need a lot of support
  3 — Somewhat confident — can do this with support
  4 — Confident — can do this independently
  5 — Very confident — could support others with this

### 7. How might I be able to support you?
- **Field id:** `supportNeeded`
- **Type:** text-long
- **Required:** Yes
- **Note:** Deliberately open-ended, no predefined categories — Graeme will judge delivery type (coaching / teach-meet / resource / etc) after reading responses, rather than staff self-selecting from a fixed list.

### 8. How confident do you feel with Digital Accessibility?
- **Field id:** `confidenceAccessibility`
- **Type:** scale-1to5
- **Required:** Yes
- **Scale:**
  1 — Not at all confident — haven't started with this yet
  2 — A little confident — basic awareness, need a lot of support
  3 — Somewhat confident — can do this with support
  4 — Confident — can do this independently
  5 — Very confident — could support others with this

### 9. How confident do you feel using Digital Learning Environments (e.g. Teams) inclusively?
- **Field id:** `confidenceDLE`
- **Type:** scale-1to5
- **Required:** Yes
- **Scale:**
  1 — Not at all confident — haven't started with this yet
  2 — A little confident — basic awareness, need a lot of support
  3 — Somewhat confident — can do this with support
  4 — Confident — can do this independently
  5 — Very confident — could support others with this

### 10. How confident do you feel in your overall Digital Skills Capability?
- **Field id:** `confidenceDigitalSkills`
- **Type:** scale-1to5
- **Required:** Yes
- **Scale:**
  1 — Not at all confident — haven't started with this yet
  2 — A little confident — basic awareness, need a lot of support
  3 — Somewhat confident — can do this with support
  4 — Confident — can do this independently
  5 — Very confident — could support others with this

---

_Regenerated from `self-assessment-form-spec.json` — edit the JSON, not this file._
