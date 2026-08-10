# DPC Hub & Learning Studio — Parked Items Overview
**Compiled:** 07/08/26 · Session 51
**Purpose:** Everything deferred across the whole build so far, tracked in one place so nothing gets lost just because it's old in the conversation. Grouped by system, each with current status and how it would actually wire into what's already built — not abstract ideas, concrete connection points to real functions/modules that exist right now.

---

## 1. The Learning Studio

### 1.1 Behaviour / moderation cards
**What:** Teams channel moderation (restricting posting, message moderation settings), professional-language/digital-communication norms, an "any questions" open Q&A space, a "debate" space where learners reply to a source/question/inspiration. Also: extending `using-engagement-data` (Digital Innovation) to cover Insights/Reflect for noticing behaviour patterns and wellbeing, not just "spotting learners falling behind."
**Status:** Scoped in discussion, genuinely not built. Two of the originally-identified gaps (retrieval practice, collaborative thinking) *were* built as real cards — this is the piece that wasn't.
**Wiring:** Same pattern as every other card — `content/digital-inclusion/` or a new layer, `HC_FOCUS_AREAS`-style glossary-gloss + digital fan-out. The Q&A/debate space would reuse `channel-discussion-thread` (the resource built for the collaboration card) rather than needing a new resource.

### 1.2 Menti / Canva / Genially resource additions
**What:** Confirmed by Graeme as real, in-use tools — not scoped or built at all.
**Status:** Flagged as legitimate, never actioned.
**Wiring:** New entries in `content/resources/`, category "Teams & Communication" or a new category. Genially in particular has no current equivalent anywhere in the library.

### 1.3 Card generator (parity with resources)
**What:** Resources got `generate-resources.js` (Session 30) so they're generated from JSON, never hand-edited. Cards still don't have this — same duplication risk exists, just less visible with only ~17 cards vs 44 resources.
**Status:** Known opportunity, never requested or built.
**Wiring:** Same shape as `generate-resources.js`, targeting `content/digital-foundations/`, `content/digital-inclusion/`, `content/digital-innovation/`.

---

## 2. DPC Hub — core, older parked items

### 2.1 Phase 7 Supabase sync — end-to-end test
**What:** The QuickCapture → Supabase → OneDrive sync. Code-complete, unit-tested, the RLS `42501` workaround (`mark_capture_synced` RPC) is live in Supabase — but the one real end-to-end approval pass was never completed. Parked because the debugging was too painful.
**Status:** Stable, not broken, genuinely just unfinished. Six debug SQL objects still sitting in Supabase, safe to drop, not yet done.
**Wiring:** Nothing else built since depends on this. Self-contained — picking it up doesn't require touching anything from later sessions.

### 2.2 Orphaned legacy `dpc-data.json` migration
**What:** Pre-Hub single-blob data file sitting in the parent OneDrive folder (real HoA meeting notes, RAG history, digital lead names) under an old, different area-code scheme.
**Status:** Confirmed Graeme wants it migrated eventually. Needs an area-code mapping table + field-by-field decisions on what's current vs retired history.
**Wiring:** Now that real areas exist with real codes (post Session 40/44/45), the mapping table is actually buildable for the first time — this was blocked on exactly the area-population work that's now done.

### 2.3 Dead code — `dpc-cpd-library` fetch
**What:** `fetchPublicResources()` in `data.js`, `CPD_RESOURCES_URL`/`CPD_CARDS_URL` in `config.js` — still trying to fetch from a repo (`gwc25/dpc-cpd-library`) that was never built and never will be, now that Resource Library exists and does that job properly.
**Status:** Confirmed dead, zero other code reads the result. Safe to remove, low priority, cosmetic.
**Wiring:** Pure deletion — no dependency risk.

### 2.4 Deeper DevObs → Instructional Coaching rename
**What:** Only display text was renamed (Session 34). The internal `activityType: 'devobs'` value, `devobs.js` filename, and every `_saveDevObs`/`openDevObsModal`-style function name are untouched deliberately — real historical OneDrive data already has `activityType: 'devobs'` baked in.
**Status:** Fully optional. Nothing forces this.
**Wiring:** Would need a genuine migration step for any staff/area with existing DevObs activity history, not just a find-and-replace.

---

## 3. DPC Hub — CPD & self-assessment

### 3.1 Digital Lead CPD self-assessment Form
**What:** The Form spec (`self-assessment-form-spec.json` + generator) is built and the send date is now flexible. The actual Microsoft Form itself still needs building in real M365 — that's on Graeme, not code.
**Status:** Spec ready, Form not yet built in M365.
**Wiring:** Once responses exist, the importer is the next piece (see 3.2).

### 3.2 Self-assessment response importer
**What:** Explicitly deferred by design in the spec's own comments — "built later, once responses come back." Would follow the exact same pattern as the Health Check baseline importer (Session 36–37): deterministic column parsing, cross-validated, human-reviewed matching against real staff before anything saves.
**Status:** Not started, correctly sequenced behind real Form responses existing.
**Wiring:** `saveHealthCheckReview`-style pattern isn't quite right here (different data shape) — would need its own `data-self-assessment.json` store, but the *import UI pattern* (review row, guess-match, confirm before commit) is directly reusable from `_hcOpenBaselineImport`.

---

## 4. DPC Hub — Areas & Digital Leads data integrity (verify, not build)

These aren't missing features — they're **open questions about whether already-built tools have actually been run**, worth a direct check rather than assuming either way.

### 4.1 Baseline Health Check import (48 real staff)
Built and tested (Session 36–37). Unclear from this conversation whether it was actually run against the real 48-person dataset yet.

### 4.2 HoA/Digital Lead data imports
Two import screens exist (Session 44–45: the RAG Summary tracker import, and the "confirmed" June 2026 table import). Real names are visible in Digital Leads screenshots, so at least one clearly ran — worth confirming both did, and whether historical RAG values were set for areas beyond the ones covered by that one optional dropdown.

### 4.3 SEND consolidation button
Built and tested (Session 46) — merges FAU/FCO/FEH/FPL into SEL. Sits in Settings → Area Management, only appears if those areas still exist. Unclear if it's been clicked.

### 4.4 Naming ambiguities flagged, not resolved
- **PRA** — Graeme flagged "Professional Apprenticeships" as possibly the wrong label; kept as-is pending review, editable in Area Management any time.
- **AMT** — code is a best guess for the merged EFE/EHE unit, never explicitly confirmed by Graeme, just accepted so far.
- **EXT** — noted as retiring next year, never added, no formal decision recorded either way.

---

## 5. DPC Hub — Organisation (real gaps, not just parked ideas)

### 5.1 Meetings module
**What:** Still `renderPlaceholder('Meetings', '💬')` — no real data model, same situation Tasks was in before Session 48.
**Status:** Blocking item — the "Quality-specific meetings that also feed into general Meetings" idea (5.2) can't exist until this is real.
**Wiring:** Same approach as Tasks — check whether `CALENDAR_TYPE.MEETING` (already exists in the enum) is enough to reuse the Calendar store the way Tasks did, rather than a new file.

### 5.2 Quality-specific Meetings, feeding into general Meetings
**What:** A way to tag/filter meetings as Quality-team-specific while they still show in the main Meetings view.
**Status:** Not started — genuinely blocked on 5.1 existing first.
**Wiring:** Likely a tag/category field on whatever the real Meetings entry shape turns out to be, plus a filter view — same shape as the Health Check cycle-tagging concept.

### 5.3 Notes module
**What:** Also still a placeholder.
**Status:** Not started.
**Wiring:** `saveNote()` already exists in `data.js` (used elsewhere for meeting shells) — worth checking whether it's already fit for purpose or needs its own real module the way Tasks got one.

---

## 6. DPC Hub — Reporting

### 6.1 Reports (Neil/Ben/DL/AP-HoA docx) — stale numbers
**What:** The downloadable Word reports don't yet reflect Health Check completion counts, area coverage, or Action Plan counts — the Dashboard's live Numerical Impact tab (Session 41) has these, the exportable reports don't.
**Status:** Partially done — the mechanism exists, the newer numbers haven't been plumbed through to `reports.js`.
**Wiring:** `_renderDashImpact()`'s computation logic in `dashboard.js` is the source of truth to port into the relevant `_repBuildXDoc()` functions in `reports.js`.

### 6.2 Downloadable numerical impact + Action Plan Excel export
**What:** An Excel document with Action Plans for all areas, filterable to specific areas/staff.
**Status:** Not started.
**Wiring:** Real data now exists to export (`data-action-plans.json`, the Numerical Impact computations) — this was blocked on the data existing, which it now does.

### 6.3 Cross-college / PLS-Executive-facing reporting
**What:** A version of the same reporting aimed at people outside Curriculum — PLS and the Executive Team — demonstrating intent, activity, and impact (numeric and anecdotal).
**Status:** Not started, explicitly downstream of 6.1/6.2.

---

## 7. DPC Hub — AI Support & automation (the big one)

This is the largest single piece of remaining work, and the one most recently committed to. Breaking it into its real sub-parts rather than one undifferentiated blob:

### 7.1 AI-generated RAG Matrix analysis
**What:** Proven as a real, working concept in this chat — a full 8-dimension RAG analysis for CON, with score + rationale + "not enough data" honesty, generated from three real documents (HoA Tracker, Skills & Infrastructure Audit, Digital Hours & Equipment Survey). Not yet built as a live Hub feature.
**Status:** Spec proven, not implemented. Most recently agreed next step before this overview was requested.
**Wiring:** `ai-support.js` already has a real, working Anthropic API call — this is a genuine extension of existing code, not new capability from nothing. Output needs to land as *suggestions* on the RAG Matrix page (same advisory pattern as `getSuggestedRAGScore`, never auto-overwriting), with "add to Action Plan/Tasks" buttons using `addActionItem()`/`createTaskFromSource()`, both of which already exist and are tested.

### 7.2 Upload pipeline — training event registers
**What:** Upload a register → each named person gets pulled into their file, wired to that training event.
**Status:** Not started.
**Wiring:** Would create/update `dl.trainingHistory` entries (Session 47) and could link to `Templates` instances if the event maps to an existing Teach Meet template.

### 7.3 Upload pipeline — Digital Health Check exports
**What:** Upload the latest Health Check export → matched staff each get a new Health Check review, and (per Session 50) a new auto-generated Action Plan.
**Status:** The *manual* baseline import version of this exists and is tested (Session 36–37) and the auto-Action-Plan-generation piece is proven (Session 50). The *AI-assisted, ongoing* version — not a one-off baseline but a repeatable "upload this term's export" flow — is not built.
**Wiring:** `generateActionPlanFromHealthCheck()` already exists and is tested — this pipeline mostly needs the *ingestion* half (parsing a new export, matching against real staff), reusing the same human-reviewed pattern as the baseline importer.

### 7.4 Upload pipeline — Learning Walk documents/reports
**Status:** Not started, not scoped.

### 7.5 Upload pipeline — CPD reflection Forms downloads
**Status:** Not started, not scoped.

### 7.6 Upload pipeline — notes and meetings
**Status:** Not started. Also blocked on Meetings/Notes (5.1/5.3) being real modules first.

### 7.7 Upload pipeline — digital resources
**Status:** Not started, not scoped. Presumably feeds Resource Library.

### 7.8 Generate and download reports, on demand
**Status:** Not started — related to but distinct from 6.1–6.3 (this is "AI Support produces a report on request" vs "Reports module has correct numbers").

---

## 8. A genuinely new concept — academic-year archiving

**What:** "Everything is dated and now archived or hidden — it's all visible (current and past for that academic year, plus an archived previous years)."
**Status:** Not designed, not scoped, not built. This is a real, structural concept that doesn't exist anywhere in the Hub yet — nothing currently distinguishes "this academic year" from "last academic year" as a first-class idea. Health Check cycles (`baseline-2026`, `nov-2026`, etc.) are the closest existing analogue, but that's a DPC-specific termly cycle, not a general academic-year archiving layer across every module.
**Wiring:** This would likely need to be a genuinely new cross-cutting concept — an `academicYear` field on the relevant record types, plus view-level filtering ("current year" vs "browse archive") — worth its own dedicated design session before touching code, given how many modules it would eventually touch (Health Checks, Action Plans, CPD, Digital Leads, Resource shares).

---

## 9. Long-term Dashboard trends

**What:** The Dashboard should reflect long-term data, not just current snapshots — implied by the academic-year archiving idea above.
**Status:** Numerical Impact (Session 41) shows live current totals and a by-cycle breakdown, which is a start, but genuine multi-year trending isn't built.
**Wiring:** Depends partly on section 8 existing first — hard to show meaningful multi-year trends without a real concept of "year" in the data.

---

## 10. Older, further back — still technically open

### 10.1 Founder Skills Audit → team extension
Mentioned once, very early in this whole programme, never revisited. Separate from the DPC Hub/Learning Studio work entirely — Build New Habits Ltd context.

### 10.2 CMI knowledge-management architecture
A private GitHub repo as a shared canonical source across two Claude Projects (professional work + CMI assignment support) — mentioned as something Graeme was exploring, never actioned within this conversation.

---

## Suggested sequencing, if useful

Not a decision, just a reasonable read of dependencies:

1. **Meetings/Notes as real modules** (5.1, 5.3) — unblocks 5.2 and part of 7.6, and closes the last "placeholder" gap in Organisation.
2. **AI RAG Matrix analysis in AI Support** (7.1) — proven concept, clearest path to build, highest visible value.
3. **Reports numbers refresh** (6.1) — small, mechanical, closes a real gap between what Dashboard shows and what gets sent to Neil/Ben.
4. **Verify the data-integrity items** (section 4) — five minutes of checking, not building, but worth doing before trusting RAG suggestions or reports built on top of that data.
5. Everything else in section 7 (the remaining upload pipelines), section 8 (academic-year archiving), and section 6.2/6.3 (Excel export, cross-college reporting) are each genuinely their own session.
