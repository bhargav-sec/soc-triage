# Session 3 — Phase 3 Shipped

**Date:** 2026-04-29
**Duration:** ~5 hours across two days (with sleep break)
**Status:** Phase 3 complete, deployed, end-to-end verified.

---

## What shipped

**Goal:** Close the workflow loop. An analyst can now open an investigation or single event, work it, and close it.

All Phase 3 success criteria met (the original four plus three added mid-session):

1. Dedicated `investigations` table separate from events
2. Read-only investigation detail page at `/investigations/[id]`
3. Notes textarea (auto-save on blur) + four-status control + close-requires-note validation
4. Home queue restructured: investigations as one row each, uncorrelated events as their own rows
5. Three-tab view (Active / Investigating / Closed) instead of original two-tab plan
6. Event-level close flow (added mid-session, swapped in for bulk upload)
7. `false_positive` status as the AI-disagreement escape hatch

**Live URL:** soc-triage-bhargav-secs-projects.vercel.app
**Final commit:** bd8f548

---

## Commits

1. `9810786` — investigations table
2. `ebfb190` — fix closed_at_check (initial constraint masked status_check violations)
3. `cd1ee15` — rewrite correlate_event + backfill investigations rows from existing events
4. `86d87a5` — read-only investigation detail page
5. `cdde18d` — notes + status + close-requires-note (investigations)
6. `8489029` — home queue restructure (investigations as rows)
7. `988ed08` — replace closed-toggle with Active/Closed tab strip
8. `34a0c6b` — events close flow migration (notes, closed_at, status alignment)
9. `a923d63` — event-level close flow (detail page, API, client controls)
10. `bd8f548` — three-tab view (Active / Investigating / Closed)

---

## Files added/modified

### New files

- `migrations/004_phase3_investigations_table.sql`
- `migrations/004a_fix_closed_at_check.sql`
- `migrations/005_phase3_rewrite_correlate_event.sql`
- `migrations/006_phase3_backfill_investigations.sql`
- `migrations/007_phase3_events_close_flow.sql`
- `src/app/investigations/[id]/page.tsx` — investigation detail (server)
- `src/app/investigations/[id]/InvestigationControls.tsx` — notes + status (client)
- `src/app/api/investigations/[id]/route.ts` — PATCH endpoint
- `src/app/events/[id]/page.tsx` — event detail (server)
- `src/app/events/[id]/EventControls.tsx` — notes + status (client)
- `src/app/api/events/[id]/route.ts` — PATCH endpoint
- `src/app/HiddenClosedToggle.tsx` — three-tab view component (filename retained from earlier two-tab version; component is now exported as `ViewTabs`)

### Modified files

- `src/app/page.tsx` — full rewrite for investigations-as-rows + three-tab filtering

### Database changes

- New `investigations` table with status / severity / mitre / source_ip / event_count / notes / closed_at
- Two check constraints on `investigations` (status enum + closed_at-status pairing)
- `correlate_event(uuid)` rewritten to insert into `investigations` instead of stamping a free-floating UUID
- `events.notes` and `events.closed_at` columns added
- `events.status` aligned with investigations enum (`open` / `investigating` / `true_positive` / `false_positive`)
- 28 existing events migrated from `'new'` to `'open'`

---

## Architecture decisions made this session

**Investigations vs events as parallel concepts.**
Investigations are the workflow-level entity. Events are the raw data points. Both got the same status enum, the same notes field, the same close flow, the same detail-page pattern. This kept the mental model clean and let the UI reuse components by analogy.

**`false_positive` as the AI-disagreement escape hatch.**
Rather than build a verdict-override system in Phase 3, the analyst expresses disagreement by closing as `false_positive`. Keeps the surface area small. Real AI override (replacing severity / MITRE) deferred to Phase 3.5.

**Auto-save notes on blur.**
Chosen over an explicit Save button per the user's preference — they didn't want to "start over" if a save was forgotten. Trade-off: no confirmation point. Mitigated with a "Saving..." → "Saved" indicator.

**Close-requires-note enforced server-side.**
Client-side validation is a UX nicety; server validation is the real gate. The PATCH endpoint refuses any close transition without a non-empty note, even if the client tries to bypass.

**Three tabs, not severity filters.**
The user asked for severity filtering ("clicking high should filter") mid-session. Pushed back — it was scope creep, deferred to Phase 3.5. Three-tab status filter (Active / Investigating / Closed) was added because it was a real workflow need, not a noise filter.

**Event-level close flow swapped in for bulk upload.**
Phase 3 originally planned bulk log file upload as commit 6. User decided mid-session that single events also needed close flow. After explicit confirmation that this was a feature swap (not addition), bulk upload moved to Phase 3.5.

---

## Bugs hit and fixed

**1. `closed_at_check` masked `status_check` violations (commit 1, fixed in commit 1a).**
Initial constraint `(status in ('true_positive','false_positive') AND closed_at IS NOT NULL) OR (status in ('open','investigating') AND closed_at IS NULL)` rejected any row where `status` was outside the four valid values, which meant the constraint *fired first* on bad-status inserts and stole the violation from `status_check`. Fix: added a third OR branch that passes silently when status is invalid, letting `status_check` do its job.

**2. `correlate_event` rewrite assumed `events.source_ip` was a column (it isn't).**
`source_ip` lives inside the `parsed` jsonb column as `parsed->>'source_ip'`. Caught when migration 005 errored on first run. Fix: matched the access pattern from Phase 2's `migrations/003`.

**3. Cloud Shell editor strips `<a` tags on paste (recurring, every JSX file).**
Phase 2's lesson confirmed every single time. Workaround used: paste full file → grep for missing `<a` → restore with a targeted `sed -i` command. Faster than base64 chunking but still adds an extra step per file.

**4. Stale Vercel deployment URL confusion.**
After commit 5b pushed, the user opened a deployment-specific URL (`...-ta2ckny10-...vercel.app`) instead of the production URL. Old code rendered, looked like a deploy failure. Real fix was just hard-refreshing the production URL.

---

## Discipline observations

**Scope creep happened five times.**
Original lock was four items. By session end Phase 3 had seven (plus the bulk upload swap). Each addition got pushed back; user confirmed each one explicitly before it landed. The discipline rules worked — the addition was always paid for by deferring something else, not stacked on top.

**Vague answers caught on average twice per major decision.**
"Looks fine" / "pretty much good" / "for safer approach" all got pushback. User was responsive to specificity demands.

**One feature per commit held cleanly.**
Ten commits, each shipping one demoable thing. Easy to revert any single commit without breaking the chain.

**For the next session: base64 transfer is mandatory for any JSX file >100 lines, period.**
Repeated proof in Phase 2 and Phase 3. The "paste plain into editor" approach saves time only if you remember to grep for missing `<a` tags after every paste — and we forgot once or twice this session.

---

## What's NOT in Phase 3 (deliberate)

- Bulk log file upload (swapped out for event-level close flow → Phase 3.5)
- AI-recommended remediation actions (Phase 3.5)
- L2 escalation criteria (Phase 3.5)
- Severity filtering on the queue (Phase 3.5 candidate)
- AI verdict override on severity / MITRE (Phase 3.5)
- Rescore-failed-events button (Phase 3.5)
- Auth / multi-user (deferred per Phase 3 lock)
- `severity_score` numeric column population
- Cross-IP same-user correlation
- Per-host endpoint timeline view (Phase 4)
- Python forwarder agent + honeypot VM (Phase 4)
- Real-time updates (out of scope through Phase 4)

---

## Phase 3.5 entry point

**Goal (directional, not contractual):** Add the AI guidance and bulk-upload features deferred from Phase 3.

Suggested first task: **bulk log file upload.** New `/upload` page with file picker. Splits on newlines, loops through `/api/ingest` with a delay to respect Groq rate limits. Progress indicator. Was the original commit 6 — already designed, just not built.

Suggested second task: **AI-recommended actions on closed/active investigations.** Extend the AI scoring JSON contract to return a `recommended_actions: string[]`. Render as a checklist on detail pages. Per-MITRE-technique prompts so the steps are actually relevant.

Suggested third task: **AI verdict override.** Analyst can change severity / MITRE on an event or investigation. Original AI verdict preserved in `ai_severity_original` / `ai_mitre_original` for accuracy tracking. Pairs naturally with a rescore button.

Open question for Phase 3.5 start: severity filtering on the home queue. User asked for it mid-Phase-3, deferred. Should it be a fourth tab? A click-counter-to-filter behavior? A separate filter bar? Re-scope at Phase 3.5 start.

---

## Discipline carried over to Phase 3.5

- One feature, one commit, one test, one push
- Each phase ends demoable, never broken
- VISION.md is the source of truth — re-read before scoping Phase 3.5
- Push back on scope creep before code, not after
- For long JSX files in Cloud Shell: assume `<a` tags will be stripped on paste, grep for them after every save, fix with sed
- Don't paste shell prompts (`bhargavchowdaryr1@cloudshell:~/soc-triage$`) or `cat` commands into Supabase SQL Editor
- After every Vercel push, hard-refresh the production URL (no deployment hash) to verify