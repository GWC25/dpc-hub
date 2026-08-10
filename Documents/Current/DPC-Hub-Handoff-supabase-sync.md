# DPC Hub — Handoff Briefing
**From session ending:** 28 July 2026
**Next task:** Build `js/supabase-sync.js`

---

## 1. Project context (essential, read first)

DPC Hub is Graeme Wright's personal operating system for his Digital Pedagogy Coach role
at Weston College Group. Vanilla JS, no frameworks, deployed on GitHub Pages at
`gwc25.github.io/dpc-hub`, repo at `github.com/GWC25/dpc-hub` (note: GitHub org is
`GWC25`, capitalised in the URL, but `gwc25` lowercase works fine for raw/API access).

**Critical lesson from this session — read before touching anything:** this Claude
Project's Project Knowledge contains **stale files** from an earlier "DPC Impact Hub"
generation (single `DPC.DB` blob, localStorage-based). The **live, current** app uses a
completely different architecture: `window.DPC_DATA` populated via the OneDrive File
System Access API (Tier 2), with no shared `DPC.*` utility namespace at all. Each module
is self-contained with its own private `_moduleEsc()`/`_moduleFmtDate()` helpers — there
is no `DPC.escHtml`, no `DPC.getArea()`, nothing shared.

**Do not trust Project Knowledge for current code shape.** Before writing anything,
fetch the real live files directly:
```
https://raw.githubusercontent.com/gwc25/dpc-hub/main/js/<filename>.js
```
If `raw.githubusercontent.com` / `api.github.com` return "Host not in allowlist" — this
happened for the entire second half of this session and never resolved — tell the user
immediately rather than silently working from stale assumptions, and ask them to paste
file contents directly if it persists.

---

## 2. Architecture facts, confirmed against live code this session

- **Data layer:** `window.DPC_DATA.<domain>.<array>` — e.g. `DPC_DATA.areas.areas`,
  `DPC_DATA.afi.afis`, `DPC_DATA.calendar.entries`, `DPC_DATA.staff.staff`.
- **Field naming:** `area.areaCode` (not `code`), `area.areaName` (not `name`),
  `area.hoaName`, `area.ragDimensions[dimId] = { score: N, history: [{score,date}] }`.
- **Schema constants** live in `js/schema.js`: `RAG_DIMENSIONS`, `RAG_LABELS` (1=
  "Immediate priority" ... 5="Embedded" — nothing like generic "Urgent/On Track"
  language), `AFI_STATUS` (open/actioned/impact-checked/closed/re-opened),
  `AFI_SEVERITY`, `PYRAMID_LEVEL`, plus global helpers `generateId()`, `nowISO()`,
  `todayISO()`.
- **Module convention:** each `js/<name>.js` file defines `init<Name>()`, renders into
  the single shared `document.getElementById('main-content')` (via `DOM.mainContent()`
  in `app.js`), and is registered in `app.js`'s `MODULES` table with a `data-module`
  nav link in `hub.html`.
- **`app.js` loads last.** Any placeholder stub function left in `app.js` for a module
  that's since been given a real implementation elsewhere will silently override it —
  no error, just a broken tab. Always check `app.js` for leftover stubs matching the
  module you're building, and remove them.
- **`hub.html` script load order matters** — new files go after their dependencies,
  before `app.js`.

---

## 3. What's been built and verified this session (Phase 7 progress)

✅ **`js/reports.js`** — five report templates (Neil fortnightly, Digital Lead area,
AP/HoA area — unified single template, Ben Manning monthly, Performance review),
real `.docx` generation via `lib/docx.min.js`, tested against actual LibreOffice
rendering, not just "code runs."

✅ **`js/ai-support.js`** — `DPC.AISupport.generateNarrative()` for the performance
review's AI narrative (Anthropic API, Sonnet, session-only key, never persisted),
plus `initAISupport()` module page. Uses the new
`anthropic-dangerous-direct-browser-access: true` header required for direct
browser calls to the Anthropic API — the earlier precedent code (`evidence-hub.html`)
didn't have this and was likely silently broken.

✅ **`lib/docx.min.js`** — vendored, minified (~400KB) browser build of the `docx` npm
package. Verified working via LibreOffice-rendered visual inspection, not just "no
errors thrown."

✅ **`hub.html` / `js/app.js`** — updated and verified correct by the user (pasted
actual file contents back for confirmation): three new script tags in the right
order, both `initReports`/`initAISupport` stubs removed from `app.js`.

✅ **`hub-lite.html`** — standalone mobile capture page. Deliberately does **not**
use the OneDrive File System Access API (doesn't work on mobile browsers at all) —
instead fetches the public `data/areas-seed.json` directly for the area dropdown,
and writes straight to Supabase. **Live and tested end-to-end** — user confirmed a
real capture round-tripped from phone → Supabase `dpc_captures` table successfully.

✅ **Supabase project live**: "DPC Hub Project", Europe region, connected to GitHub.
Uses the new Publishable-key format (`sb_publishable_...`), not the legacy anon JWT.

✅ **`dpc_captures` table created and confirmed working**, exact schema below.

**Not yet built:**
- **`js/supabase-sync.js`** ← this session's task
- `js/notes.js` (still a stub in `app.js`)
- Strengths synthesis / AFI risk surfacing (ai-support.js's fuller intended scope —
  only the narrative-generation piece was built)
- Self-assessment Form data pipeline (`data-selfassessment.json`, staff confidence
  `history[]`, area rollup, import screen, manual conversation-log UI) — fully
  designed and agreed this session, not yet built. See section 5.

---

## 4. `js/supabase-sync.js` — the task for this chat

**Purpose:** desktop Hub reads pending (`synced = false`) captures from Supabase on
load, shows them to Graeme for review, he approves each one, approved captures get
committed into the right Tier 2 OneDrive location and marked `synced = true` in
Supabase.

**Confirmed Supabase config:**
```
Project URL: https://gygngjifcmyjslsqpkmb.supabase.co
Publishable key: sb_publishable_3iVEEIuwPL9ldyltSV5r8g_WazUfZSX
```
(Both safe to hardcode client-side — RLS is the actual protection, not key secrecy.)

**Confirmed `dpc_captures` table schema:**
```sql
create table public.dpc_captures (
  id uuid primary key default gen_random_uuid(),
  capture_type text not null check (capture_type in ('meeting_shell','quick_note','calendar_entry')),
  area_code text,
  content text not null,
  captured_at timestamptz not null default now(),
  synced boolean not null default false,
  synced_at timestamptz
);
```

**Confirmed RLS policies (already live):**
- `anon` can `insert` (Hub Lite writes)
- `anon` can `select` where `synced = false` (desktop Hub reads pending only)
- `anon` can `update` from `synced = false` to `synced = true` only (desktop Hub
  marks reviewed; can't do anything else)

**Routing decision (confirm with user first, proposed in last message of prior
session, not yet explicitly confirmed):**
- `capture_type = 'calendar_entry'` → commit into `data-calendar.json` /
  `DPC_DATA.calendar.entries`
- `capture_type = 'meeting_shell'` or `'quick_note'` → commit into a **new**
  `data-notes.json` file (just the data file — Notes UI module itself isn't built
  yet, but this gives sync.js a real, correctly-shaped home instead of forcing
  wrong-shaped data into Calendar or leaving captures stuck in Supabase
  indefinitely). When Notes eventually gets built, real data is already waiting.

**`data-notes.json` — starter file included in this handoff, not yet in the repo.**
Empty skeleton:
```json
{
  "notes": []
}
```
Structure mirrors the `afi.js`/`reflections.js`/`staff.js` convention (domain
object containing a same-named array) rather than `calendar.js`'s `entries`
naming. Each record `supabase-sync.js` writes on approval should look like:
```json
{
  "noteId": "<generateId()>",
  "type": "meeting_shell",
  "areaCode": "BUI",
  "content": "...",
  "capturedAt": "<original captured_at from Supabase — preserve, don't overwrite>",
  "reviewedAt": "<nowISO() at approval time>",
  "source": "hub-lite"
}
```
`source: 'hub-lite'` is there deliberately even though it's the only source right
now — useful once/if notes can ever be added directly from the desktop Hub too.

**✅ Confirmed and done, not just planned:** live `js/config.js` was pasted by the
user this session. `data-notes.json` has been added to `OPTIONAL_FILES` (won't
block Hub startup if missing — correct, matches every other non-critical data
file). `SUPABASE_URL`/`SUPABASE_ANON_KEY` placeholders already existed in
`config.js` and are now filled in with the real live values — **and
`hub-lite.html` was updated to read `DPC_CONFIG.SUPABASE_URL`/`SUPABASE_ANON_KEY`
instead of duplicating them locally**, so there's now a single source of truth
for these credentials. Both updated files are included in this handoff. The user
still needs to commit both to the repo (`js/config.js` and `hub-lite.html`) —
confirm this has happened before assuming `DPC_DATA.notes` will populate.

**Suggested UI pattern:** reuse the existing `restore-banner` visual convention
already in `hub.html` (banner, not a full-page interrupt) — "3 captures pending
review" with a way to review/approve each, rather than a new modal pattern.

**Build discipline expected by the user (established this session — follow this):**
- Fetch live files before assuming their shape — don't trust Project Knowledge.
- Test against realistic sample data before presenting as done — this session used a
  Node harness with mocked `window`/`document`/`DPC_DATA` globals to actually run
  `reports.js`'s doc-generation functions and catch real bugs (a stray default
  parameter referencing an undefined variable) before delivery. Same rigour
  expected here — don't just write code and hand it over untested.
- **Do not build ahead of explicit confirmation.** Earlier this session, acting on
  inferred next-steps rather than waiting for the user's go-ahead drew a direct,
  fair complaint about wasted credits. Ask, then build — not the reverse.
- File placement: new files go in `js/` unless clearly a planning/design artifact
  (those go in `planning/<topic>/`, established this session for the self-assessment
  Form spec). Never put non-runtime files in `data/` — that's reserved for genuine
  seed/runtime data the app fetches.

---

## 5. Other open work (context only, not this chat's task unless redirected)

**Self-assessment Form** — fully designed, spec file exists at
`planning/self-assessment/self-assessment-form-spec.json` (10 fields, confirmed
order, plain-language 5-point confidence scale designed to later relabel as ETF
DTPF stages without a data change). Form not yet built in MS Forms by the user.
Sends 17 Aug 2026. Import pipeline (`data-selfassessment.json`, staff confidence
`history[]`, area rollup, AI Support upload-and-draft screen) all designed in
conversation but not built — needs real Form responses to test against properly,
so likely not worth building until September.

**Ben Manning tracker "digest" tool** — concept only, discussed but not designed in
detail. Ben wants weekly updates to `HoA_Digital_Tracker.xlsx` (currently a live
SharePoint-linked file). Agreed approach: Hub-side digest that reads live
`DPC_DATA` and produces a **text summary** Graeme manually applies — not automated
file editing, to avoid corrupting the live doc's formatting/conditional formatting.
Not started.

**Area code corrections** — still outstanding from Neil Davies: `COU` (FE
Counselling, Tasha Thorne) and `PRA*` (near-duplicate of `PRA`, Mark Barnett).
Blocks the `data/areas-seed.json` correction, which is otherwise ready to apply
mechanically (area records already keyed stably by `code`/`areaCode` — correcting
names is a data-only change, no code impact).

---

## 6. Standing constraints (apply to everything)

- **WCAG 2.2 & 2.1 AA** on all new content/UI — user preference, always applies.
- **No governance-review language** — no "18-month pilot," no October/3/6/9/12-month
  review framing anywhere. The DPC programme is organic and ongoing.
- **"TLA first, Digital second"** — don't let digital tooling framing overtake TLA
  practice framing in any user-facing copy.
