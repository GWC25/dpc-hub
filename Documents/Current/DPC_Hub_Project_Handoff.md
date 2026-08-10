# DPC Hub — Handoff Brief for New Project Manager
**Written:** 10/08/26 · By the Claude instance that built the majority of this system across an extended session.
**Purpose:** get a new PM instance operational fast, without re-litigating settled decisions or repeating mistakes already made and fixed once.

---

## 1. What this is

DPC Hub is Graeme Wright's internal coaching intelligence tool — his personal operating system as Digital Pedagogy Coach at Weston College Group. Vanilla JS, no framework, no build step. Deployed via GitHub Pages. Data lives on Graeme's OneDrive as JSON files, accessed via the File System Access API — this is not a server-backed app, everything runs in-browser.

Its sister project, **The Learning Studio**, is a separate public-facing resource hub for FE staff generally (not Graeme-specific). Different repo, different audience, same underlying build conventions. This handoff is DPC Hub-focused; ask if Learning Studio context is needed too.

**Read `Documents/MANIFEST.md` and everything in `Documents/Current` before assuming you need to ask Graeme for background** — that folder is the curated, current source of truth for planning documents, blueprints, and framework docs. It was migrated out of Project Knowledge on 10/08/26 because Project Knowledge search had become unreliable.

---

## 2. Access

- **Repo:** `github.com/gwc25/dpc-hub` (GitHub reports the canonical casing as `GWC25/dpc-hub` — same repo, don't be thrown by this)
- **Live site:** `gwc25.github.io/dpc-hub/hub.html`
- **Learning Studio repo:** `github.com/GWC25/The-Learning-Studio`, live at `gwc25.github.io/The-Learning-Studio/`
- **GitHub token:** stored in Project Knowledge as `DPC_Hub_Token_1`. Fine-grained PAT with full admin/push access to both repos. **Expires 2026-09-09** — check this hasn't lapsed, and if it has, ask Graeme for a fresh one rather than trying to work around it.
  - **This token must never be committed to any repo, public or private.** Read it, use it in memory for git operations, never write it to a file that gets pushed.
  - As of this handoff, direct authenticated push is a new capability (first used 10/08/26) — every session before that delivered files for Graeme to manually upload via GitHub's web UI. You can now push directly, but **confirm with Graeme before your first push in a new conversation** — don't assume permission carries over silently.

---

## 3. Non-negotiable working conventions

These aren't preferences — they're things that caused real problems when skipped, or things Graeme has stated directly and repeatedly.

- **Never trust Project Knowledge or your own memory for current code shape.** Clone the repo fresh at the start of every session and work from what's actually live. Files described in a past summary may be stale.
- **Test before claiming something works.** Every function that matters has been tested with `node -e` / a `vm` context before being called correct — not just written and assumed. Several real bugs (see §6) were only caught this way, not by re-reading the code.
- **Everything must be editable at the point where it's found.** This has been said multiple times, in different words, across the whole build. If a piece of data displays somewhere, the person looking at it should be able to fix it right there — not be sent to a different screen. This is the single most repeated piece of feedback in this project's history.
- **WCAG 2.2 AA is real, computed contrast math, not eyeballed hex values.** Use the actual relative-luminance formula. This has come up explicitly and been checked programmatically more than once.
- **No governance-review language, ever** — no "3-month review," "6-month review," "governance checkpoint," anything like it. This programme is explicitly organic, not phased/reviewed. This is a hard rule, not a style note.
- **"TLA first, digital second."** Digital practice is framed as an amplifier of teaching outcomes, never a parallel track.
- **File delivery discipline, if delivering files for manual upload rather than pushing directly:** small edits inline with a header line above the fenced code block (never baked into the file itself); larger sessions as separate downloadable files, one per file, not zipped.
- **Before building anything nontrivial, verify real data rather than guess.** Several sessions in this project's history involved reading actual uploaded spreadsheets/documents and cross-validating computed values against the source before trusting an import or calculation — this is the standard, not an exception.

---

## 4. Current state — what's actually built and verified working

All of this has been tested, not just written. Treat it as a stable foundation.

**Core data:**
- Areas, Staff, Digital Leads are populated with real data (HoA names, Digital Lead names, training bookings) — imported via two review-before-commit screens in the Digital Leads module.
- Real area-code reconciliation happened across several sessions — some mergers (EFE/EHE → AMT) were confirmed correct by matching HoA/DL names; others (the SEND areas) were un-merged from a single SEL code back into FAU/FCO/FEH/FPL based on real evidence of different leadership, then Graeme asked for SEL back — a `mergeAreaInto()` function exists for exactly this kind of consolidation, tested, sitting in Settings → Area Management.

**Health Checks:** fully rebuilt from an earlier, wrong 5-broad-dimension model to match the real instrument — 5 focus areas, 25 real indicator statements, staff-level, cycle-tagged (baseline/Nov/Feb-Mar/Jun). Baseline import tooling exists and was validated against the source spreadsheet's own independently-computed averages (exact match).

**RAG Matrix:** 8 real dimensions (not invented — these pre-existed with a full manual scoring/rationale/snapshot-history system). Advisory suggestions exist for "Accessibility & Inclusion" (computed live from Health Check data) and, where entered, a manual "historical RAG" fallback for other dimensions — **this is explicitly not what Graeme actually wants long-term.** He wants a genuine AI-generated multi-dimension analysis with rationale, similar to a worked example already produced in conversation for one area (Construction Trades) from three real source documents. That's designed but not yet built into the app — see §5.

**Action Plans:** real schema with per-item role (Me/Digital Lead/HoA/Staff), accountable person, timeframe, done-status, and a closure report requirement before a plan can be marked complete. Auto-generates from Health Check data — a flagged domain with a real action description becomes a real action item automatically. A shared `renderActionPlanCard()` function in `data.js` is used everywhere a plan is displayed (Staff, Areas, Digital Leads) — **use this function, don't build a fourth copy of plan-rendering.** It was built specifically because three separate copies had already drifted out of sync once.

**Tasks:** real module now (was a placeholder). Deliberately built as a filtered view over Calendar entries (`entryType: 'task'`), not a separate data store — a task genuinely is a calendar entry, which is what makes "tasks show on the calendar" true without a sync step.

**Cross-navigation:** `openStaffProfile(staffId)` and `openAreaProfile(areaCode, tab)` exist as the standard pattern for jumping from one module to a specific record in another — use these rather than inventing new navigation each time a name or area code appears somewhere.

**Sidebar:** grouped (Organisation / Evidence / Quality / CPD), collapsible campus grouping in Digital Leads.

---

## 5. What's explicitly NOT built — read this before assuming a gap needs designing from scratch

A full, categorised list of every deferred item exists at **`Documents/Current/DPC-Hub-Parked-Items-Overview.md`** — read that in full before scoping new work, it's more detailed than this section. Headline items as of this handoff:

- **Meetings and Notes are still bare placeholders.** No real data model. This blocks a specific feature Graeme wants (Quality-team meetings that also feed into general Meetings).
- **The AI-generated RAG analysis** (real multi-source document analysis → score + rationale + honest "not enough data" per dimension, live in AI Support) is designed and proven in conversation but not built into the app. `ai-support.js` already has a working Anthropic API connection to extend.
- **Digital Lead ↔ Area relationship is too rigid.** One DL profile = one area. A person who supports multiple areas currently needs duplicate profiles. Also: nothing recognises that a Health Check's "Assessor" is often the area's Digital Lead — that connection isn't wired anywhere. Flagged directly by Graeme, not yet solved.
- **Register-upload automation** (upload a training attendance sheet → named people's files, Loops, Areas, Digital Leads, and Dashboard all update) — not built. Depends on Meetings/Notes existing and on richer fields on Templates (aims/outcomes/summary) that don't exist yet.
- **A completed Teach Meet or Coaching session's outcomes feeding forward** into what the next Health Check or Learning Walk should specifically look for — a real, designed idea, not yet built.
- **Academic-year archiving** — "current year visible, previous years archived" as a first-class concept — doesn't exist anywhere in the data model yet. This would touch many modules; treat as needing its own design pass before any code.
- **Reports (the downloadable Neil/Ben/DL docx exports)** don't yet reflect the newer live numbers that Dashboard shows (Health Check completion, Action Plan counts). The Dashboard is correct; the exports are stale.
- Phase 7 Supabase sync end-to-end test, orphaned legacy `dpc-data.json` migration, dead `dpc-cpd-library` fetch code cleanup — all old, all still genuinely open, all low-risk to leave open.

---

## 6. Hard-won lessons — things that went wrong once, worth not repeating

- **A save function existed that silently did nothing.** `_saveDL()` in Digital Leads set an unused flag and never actually persisted data — every Digital Lead profile and meeting log was being lost on refresh, for an unknown period, until caught by inspection. Lesson: when told "I can't see the data I entered," check whether the save function actually saves before assuming it's a display bug.
- **A genuine fix silently didn't survive an upload once.** The "show area name, not just code" fix on Digital Lead cards was built, believed shipped, then found missing two sessions later during unrelated work. Cause unclear — possibly an upload that didn't include that specific file. Lesson: don't assume a past fix is live just because it was built; a quick `grep` against the fresh clone at the start of a session catches this cheaply.
- **GitHub Pages deployment can silently queue/fail behind a stuck run**, independent of whether the code itself is correct. If Graeme reports "I pushed/uploaded and nothing's changing," check `github.com/GWC25/dpc-hub/actions` for a failed or stuck `pages-build-deployment` run before assuming a code bug. The specific failure seen once was a missing `id-token: write` workflow permission — fixed via repo Settings → Actions → Workflow permissions → Read and write.
- **The RAG suggestion system's first version would have silently overwritten real, human-written rationale text.** Caught during building, before shipping, by re-reading what already existed on the page rather than assuming a blank slate. Lesson: before adding "smart" computed defaults to any existing manual-entry system, check what's already there and whether it has content worth protecting.
- **A usability walkthrough from Graeme (8 numbered screens, S1–S8) surfaced that real underlying data existed but wasn't being surfaced consistently** — Action Plans had real, specific action items in the data model, but three different display locations showed only generic boilerplate text because each had its own copy of the rendering logic that had drifted apart. This is why `renderActionPlanCard()` now exists as a single shared function. **General lesson for this project specifically: when the same kind of record is displayed in more than one module, build one shared renderer from the start, not per-module copies.**

---

## 7. Data model quick reference

Data lives in `data-*.json` files in Graeme's OneDrive, loaded into `window.DPC_DATA` at runtime. Key stores and their save functions (all in `data.js`):

| Store | Save function | Notes |
|---|---|---|
| `areas` | `saveArea()`, `renameAreaCode()`, `mergeAreaInto()`, `archiveArea()` | `renameAreaCode` = one area changes its own code, cascades everywhere. `mergeAreaInto` = absorb source into an existing target, archives the source. |
| `staff` | `saveStaff()` | |
| `digitalLeads` | `saveDigitalLead()` | Was broken (see §6) — confirmed fixed and tested. |
| `healthChecks` | `saveHealthCheckReview()` | Reviews keyed by `staffId` + `cycleId`. `HC_FOCUS_AREAS` in `schema.js` is the canonical 25-indicator structure — don't reword these, they must match the real Form. |
| `actionPlans` | `saveActionPlan()`, `addActionItem()`, `toggleActionItemDone()`, `closeActionPlan()`, `generateActionPlanFromHealthCheck()` | |
| `afi` (displayed as "Loops") | `saveAFI()` | |
| `resourceLibrary` | `saveLibraryEntry()`, `saveLibraryShare()` | |
| `calendar` (Tasks lives here too) | `saveCalendarEntry()`, `createTaskFromSource()` | A task is `entryType: CALENDAR_TYPE.TASK` — not a separate store. |

Cross-module navigation: `openStaffProfile(staffId)`, `openAreaProfile(areaCode, tab)` — both use a `window._pending*Open` deep-link pattern, checked at the top of the target module's `init` function.

---

## 8. Suggested starting point

Not a decision — just what seems highest-value given real dependencies:

1. **Verify the token still works** (it expires 2026-09-09; check the date against today).
2. **Ask Graeme what he actually wants to tackle first** — likely candidates based on recent conversation: the AI-generated RAG analysis in AI Support (designed, proven, not built), or Meetings/Notes as real modules (blocks other things).
3. Whatever it is, **read `Documents/Current/DPC-Hub-Parked-Items-Overview.md` in full first** — it has real dependency notes on what blocks what.
