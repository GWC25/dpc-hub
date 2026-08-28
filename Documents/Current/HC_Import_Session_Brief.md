# Session Brief — Health Check Baseline Import Refresh

**Purpose:** Take the latest Digital Health Checks Forms export (xlsx), parse it into the
Hub's import format, validate it, and push it to the repo so Graeme can import the new
reviews through the Hub's existing Health Checks import flow.

**Last run:** 28/08/26 — 50 → 57 records (sourceRowIds 2042–2048 added), commit `9b15960c`.

---

## Source of Truth

Fetch these live from the repo before doing anything. Do not work from Project
Knowledge copies of code or data — they go stale.

- Repo: `GWC25/dpc-hub`, branch `main`
- Token: `/mnt/project/DPC_Hub_Token_1` — read with `tr -d '\n'`, pass as
  `Authorization: Bearer`, raw content via `Accept: application/vnd.github.raw`
- Files to fetch:
  - `planning/health-check-import/baseline-2026-parsed.json` — the live import file;
    validation target
  - `js/healthcheck.js` — import flow (`_hcOpenBaselineImport`, `_hcGuessMatch`,
    `_hcCommitSelectedImports`); confirm nothing has changed since this brief
  - `js/schema.js` — `HC_FOCUS_AREAS` (5 domains × 5 indicators, canonical ids),
    `HC_CYCLES`

**Input from Graeme:** the latest Forms export, e.g.
`Digital_Health_Checks_25_26_DDMMYY.xlsx`. The **Review Responses** sheet is the source
data. All other sheets (Support Dashboard, Area Detail, Support Signals, Support Plan)
are derived — ignore them for parsing.

---

## Process

1. **ID check.** Compare `Id` values in Review Responses against `sourceRowId` in the
   live parsed file. The export must be a strict superset. Any live ID missing from the
   export means a deleted/changed Forms response — stop and raise it before parsing.

2. **Parse** every row into the record shape below. Canonical rules (each one earned by
   diffing against the live file — do not "improve" them):
   - Text fields: raw string, **not** stripped of whitespace; empty/NaN → omitted for
     top-level fields, `null` where the shape says so
   - Scores: leading digit of cells like `"4 = On Track"` → int
   - `avgScore`: full float precision, no rounding
   - Every opened domain writes the full action key set — `actionIdentified` (bool or
     null), `actionLevel` (trailing `;` stripped, null if empty), `actionDescription`
     (null if empty) — regardless of Yes/No
   - A domain is included if it has any content (scores, context, whatWasSeen, or an
     action answer)
   - `inclusiveKnowledgeAndPractice` has **no** "What was seen?" column in the form —
     the numbered `What was seen?` columns map ABD=0, PAP=1, DOH=2, EDC=3
   - `sourceRowId` = Forms `Id` (stable across exports; this is the dedup key)

3. **Validate.** Output for IDs already in the live file must be **value-identical** to
   the live file. Deep-diff and explain every difference. Source-data changes (a cell
   edited/emptied in Forms since the last export) are acceptable and should be reported;
   parser drift is not. Do not proceed with unexplained diffs.

4. **Report the new rows** to Graeme: sourceRowId, staff, area name/code, assessor,
   date, and flag any messy codes (blank codes, spaced codes like "HAC 200",
   name/code contradictions). These get resolved in the Hub's review UI, never
   auto-matched.

5. **Push on explicit sign-off only.** GitHub Contents API: GET current file SHA → PUT
   base64 content + message + SHA to
   `planning/health-check-import/baseline-2026-parsed.json` on `main`.
   Commit message pattern:
   `Health Check baseline import: refresh from DD/MM/YY Forms export (N -> M records; adds sourceRowIds X-Y)`

6. **Verify.** Fetch the file back from `main` and confirm SHA-256 byte-identity with
   the delivered file. Confirm the `pages build and deployment` Actions run for that
   commit completed with `success` (deploys can silently queue behind stuck runs —
   check, don't assume). The container cannot reach `github.io`; Graeme's browser is
   the final live check.

7. **Graeme's side:** hard refresh the Hub (Ctrl+F5) → Health Checks → *Import baseline
   data (2026)* → previously imported rows are skipped by `baselineSourceRowId` dedup →
   confirm area and staff per new row → Import selected. Saves go to the OneDrive data
   files; all Hub sections update from there.

---

## Record shape (reference)

```json
{
  "sourceRowId": 2045,
  "assessorName": "…", "date": "YYYY-MM-DD",
  "areaName": "…", "areaCode": "…", "headOfArea": "…",
  "staffMemberName": "…", "provision": "…", "levelOfLearning": "…",
  "domains": {
    "accessibilityByDesign": {
      "context": "… or null",
      "indicatorScores": { "usesAccessibilityChecker": 4, "…": 3 },
      "avgScore": 3.4, "lowestScore": 3,
      "whatWasSeen": "… or null",
      "actionIdentified": false, "actionLevel": "… or null",
      "actionDescription": "… or null"
    }
  },
  "overallReflection": "…", "keyStrengths": "…",
  "areasForImprovement": "…", "priorityNextSteps": "…"
}
```

Domain ids: `accessibilityByDesign`, `promotingAccessiblePractice`,
`inclusiveKnowledgeAndPractice`, `digitalOrganisationAndHygiene`,
`effectiveDigitalCommunication`. Indicator ids: see `HC_FOCUS_AREAS` in `js/schema.js`.

---

## Open decisions / planned changes

- **Cycle is hardcoded.** `_hcCommitSelectedImports` tags every import
  `HC_CYCLES.BASELINE`. Fine for first reviews; **must be resolved before the November
  round** (add a cycle selector to the import flow, or a per-file cycle field).
- **AI Support wiring (planned).** `ai-support.js` lists Health Checks as an import type
  but only Tasks is wired (`isn't wired up to apply yet`). Planned build: extract the
  review panel in `healthcheck.js` to accept a records array from either the repo fetch
  or pasted JSON, then wire the AI Support health-checks branch to it. Once done, the
  repo-push-and-deploy steps above become optional — Graeme pastes the validated JSON
  directly.

## Standing rules that apply here

- Push-confirmation required before any deployment. Explicit instruction is sufficient
  authorisation for everything else; state assumptions aloud and proceed.
- Test before claim — show real output, not summaries.
- Never trust Project Knowledge for current code shape; fetch live.
- Pause only for genuinely destructive or irreversible actions.
