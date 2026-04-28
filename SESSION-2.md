# Session 2 — Phase 2 Shipped

**Date:** 2026-04-28
**Duration:** ~6 hours (across two days, with a sleep break)
**Status:** Phase 2 complete, deployed, end-to-end verified.

---

## What shipped

**All six Phase 2 success criteria from VISION.md met:**

1. Five colored severity counters in page header (critical / high / medium / low / unknown)
2. Real-time AI scoring on ingest (~500ms-1.5s with Groq)
3. Same-source-IP correlation visible via INV-XXXXXXXX badge + colored left border
4. AI reasoning shown in "Why suspicious" line
5. Clickable MITRE technique badges (purple, with inline technique name + tooltip)
6. Live AI scoring status indicator (Send sample event button shows live progress + result)

**Live URL:** soc-triage-bhargav-secs-projects.vercel.app
**Final commit:** c3480fa (inline MITRE name)

---

## Files added/modified this session

### New files
- `src/lib/ai-types.ts` (102 lines) — Severity/MitreTechnique types + validateVerdict()
- `src/lib/ai-scorer.ts` (204 lines) — scoreEvent() with Groq + tryFallback() hook
- `scripts/test-providers.mjs` (170 lines) — standalone provider verification
- `migrations/001_phase1_events_table.sql` — captured Phase 1 schema
- `migrations/002_phase2_mitre_and_provider.sql` — Phase 2 columns
- `migrations/003_phase2_correlate_event_function.sql` — correlation function

### Modified files
- `src/app/api/ingest/route.ts` — AI scoring + correlation hooks (161 → 183 lines)
- `src/app/page.tsx` — full Phase 2 UI (170 → 287 lines)
- `src/app/SendSampleButton.tsx` — live AI status indicator (115 → 159 lines)
- `VISION.md` — Phase 2 scope locked + small post-build update for status indicator

### Database changes (Supabase, captured in migrations/)
- `events.mitre_technique text not null default 'unknown'`
- `events.ai_provider text` (nullable)
- `correlate_event(uuid)` Postgres function with qualified column refs

---

## Architecture decisions made this session

**AI scoring:**
- Synchronous on ingest (sync chosen over async — Phase 5+ scaling concern)
- Groq primary, model `llama-3.3-70b-versatile`, response_format JSON
- Strict validation: severity must be in 5-bucket allowlist, mitre_technique must be in 7-value allowlist
- Console logging enabled for prompt debugging
- Worst-case latency ~3s; typical ~600ms

**Gemini fallback deferred:**
- Free-tier quota exhausted at setup, even with new key in new project
- `tryFallback()` hook is wired but returns null
- Swapping in any future provider (Claude Haiku, OpenAI, Cerebras) = editing one function

**Correlation:**
- Same source_ip + 15-min window + 3+ events threshold
- Postgres function `correlate_event(uuid)` runs atomically per-event
- Retroactively backfills investigation_id on previously-uncorrelated events
- Cross-IP same-user correlation deferred to Phase 3

**MITRE classification:**
- 6-technique allowlist + unknown fallback
- T1110.001, T1110.003, T1078, T1548.003, T1136, T1098
- AI returns technique alongside severity in same JSON call (single API call, both fields validated)
- Inline name display ("T1110.001 · Password Guessing") added post-build for discoverability

**UI grouping (Option A from VISION.md):**
- Cyan INV-XXXXXXXX (N) badge for correlated events
- Colored 4px left border on correlated cards (matches severity color)
- Decision log preserved in VISION.md decisions deferred section

**AI failure UX (post-build pivot):**
- VISION.md originally specified passive banner
- Shipped as live status indicator on Send sample event button instead
- Same signal, more visible moment (during user action, not after)
- VISION.md updated to reflect actually-shipped behavior

---

## Bugs hit and fixed

**1. Postgres column ambiguity (42702):** initial `correlate_event()` returned columns named the same as table columns. Fixed by renaming return columns to `out_investigation_id`, `out_correlated_count` and aliasing the table as `e` in all subqueries.

**2. Cloud Shell paste corruption (recurring, ~4 hours of pain):**
- Bash heredoc, even with quoted delimiters, intermittently stripped the `<a` opening tag and the `.` in `row.mitre_technique`
- 5 different paste methods failed identically: bash heredoc, chunked heredoc, `cat <<EOF`, Cloud Shell editor copy-paste, manual hand-typing into editor (auto-completed `<a` to `<a></a>`)
- **Eventually fixed by encoding the entire file as base64 and decoding at the destination.** Base64 only contains A-Z, a-z, 0-9, +, /, = — no characters that any clipboard, terminal, or shell can interpret.
- **Lesson: for any code file >100 lines containing JSX, use base64 in Cloud Shell.** Heredoc and direct paste are unreliable for non-trivial JSX in this environment.

**3. Cross-origin warning (carried over from Session 1):** still need to update `next.config.ts` allowedDevOrigins per Cloud Shell session if URL changes. Production unaffected.

---

## What's NOT in Phase 2 (deliberate per VISION.md)

- Investigations table (Phase 3)
- Playbooks / "Next step" content (Phase 3)
- Analyst manual override of AI verdicts (Phase 3)
- Cross-provider parallel scoring / dispute detection (Phase 3 candidate)
- Rescoring failed events (Phase 3)
- Cross-IP same-user correlation (Phase 3)
- Auth / multi-user (Phase 3)
- "What's normal here?" baselines (Phase 3 candidate)
- `/stats` dashboard page (Phase 3 candidate)
- Real-time websocket updates (out of scope through Phase 4)
- `severity_score` numeric column population (Phase 3+)
- Per-host endpoint timeline (Phase 4)
- Python forwarder agent + honeypot VM (Phase 4)
- AI-recommended remediation steps + L2 escalation (Phase 3, part of playbooks)
- MITRE Navigator-style coverage view (out of scope)

---

## Phase 3 entry point

Goal (directional, not contractual): make the triage flow complete — once an analyst sees an investigation, they should be able to do something with it.

Suggested first task: dedicated `investigations` table separate from `events`. Investigation has its own row with status (open/investigating/resolved/false_positive), notes, optional analyst-override severity. Events keep their `investigation_id` column to point at it. Migration is non-breaking.

Suggested second task: scaffolded Next step content. AI returns recommended_actions array as part of scoring (extend the JSON contract in ai-types.ts). Each card shows top action; clicking opens a fuller view with all actions and escalation criteria.

Suggested third task: severity override. Analyst can change severity on a card; we keep AI's original in `ai_severity_original` for accuracy tracking.

Open question parked for Phase 3: **AI verdict accuracy / dispute detection.** Three approaches considered (analyst override / cross-provider agreement / heuristic guardrails). Re-scope at Phase 3 start.

---

## Discipline carried over to Phase 3

- One feature, one commit, one test, one push
- Each phase ends demoable, never broken
- VISION.md is the source of truth — re-read before scoping Phase 3
- Push back on scope creep before code, not after
- For long JSX files in Cloud Shell: use base64 transfer, not heredoc
