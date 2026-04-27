# Session 1 — Phase 1 Shipped

**Date:** 2026-04-27
**Duration:** ~3.5 hours
**Status:** Phase 1 complete, deployed, end-to-end verified.

---

## What shipped

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind on Vercel, Supabase Postgres + Data API, no AI yet.

**Live URL:** stable Vercel production URL for `soc-triage` project (auto-deploys from `main`).
**Repo:** github.com/bhargav-sec/soc-triage

### Files created
- `src/lib/supabase.ts` — server-side Supabase client using `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. Server-only.
- `src/app/api/ingest/route.ts` — `POST /api/ingest`. Validates `source_type`, `event_time`, `raw_payload` (required) and `source_host`, `parsed` (optional). Returns 201 with `{id, received_at, status}` or 400 with `{error, field}`.
- `src/app/page.tsx` — Server Component. Fetches up to 100 events newest-first, renders Observed/Why/Next structure per VISION.md. Stubs "Why suspicious" and "Next step" as pending Phase 2/3.
- `src/app/SendSampleButton.tsx` — Client Component. POSTs one of three randomized samples (failed SSH, successful SSH, failed sudo) with current timestamp, then `router.refresh()`.
- `src/app/RefreshButton.tsx` — Client Component. `router.refresh()` with brief "Refreshed" feedback.
- `next.config.ts` — `allowedDevOrigins` set to Cloud Shell preview origin. Dev-only, no production impact.

### Schema (Supabase `events` table)

Designed for Phases 1–4. Phase 1 fills basic columns; later phases fill `severity`, `severity_score`, `ai_summary`, `ai_reasoning`, `investigation_id` without migration.

Indexes: `received_at desc`, `source_type`, `investigation_id`, `status`.

### Env vars (Vercel + .env.local)
- `NEXT_PUBLIC_SUPABASE_URL` — public
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public
- `SUPABASE_SERVICE_ROLE_KEY` — secret, server-only, marked Sensitive on Vercel

---

## Verified end-to-end

- Local: curl POST → 201 → row in Supabase → row visible on `/`
- Local: invalid body → 400 with structured error
- Local: button click → router.refresh() → new card appears
- Live: browser button on Vercel deploy → ingest succeeds → page updates
- Live: curl POST against stable URL → 201 with UUID
- Live: curl POST with empty body → 400

---

## What's NOT in Phase 1 (deliberately)

- AI scoring — Phase 2
- Event correlation / `investigation_id` population — Phase 2
- Severity counters / dashboard — Phase 2
- Investigations table, playbooks, analyst notes, close flow — Phase 3
- Per-host endpoint timeline, Python forwarder agent, honeypot VM — Phase 4
- Auth / multi-user — deferred (Phase 3 or later)
- Real-time updates (websockets) — deferred (Phase 2 nice-to-have)
- "What's normal here?" baseline panel — deferred

---

## Known issues / gotchas for next session

- **Cloud Shell preview origin** in `next.config.ts` is hardcoded. If a new Cloud Shell session generates a different preview URL, dev mode will show the cross-origin warning again. Update the line in `next.config.ts` to the new origin shown in the warning. Production unaffected.
- **Vercel deployment URLs change** per deployment (e.g. `soc-triage-1d8qkkb9t-...`). Always test against the stable production URL (`soc-triage-bhargav-secs-projects.vercel.app` or similar from Vercel Domains). Per-deployment URLs 308-redirect.
- **Region split:** Vercel functions in `iad1` (US East), Supabase in EU (Ireland). ~700ms ingest latency on production. Acceptable for Phase 1; revisit only if it becomes a real problem.
- **Cloud Shell heredoc paste:** long files (>100 lines) can truncate. Verify with `wc -l` after every `cat > <<EOF` write.

---

## Phase 2 entry point

Goal: AI scoring on ingest + auto-correlation + severity-based UI.

Recommended first task: extend `POST /api/ingest` to call Groq (primary) / Gemini (fallback) after the Supabase insert and update the row's `severity`, `severity_score`, `ai_summary`, `ai_reasoning`. This pattern matches the existing log-analyzer; keep AI synchronous in Phase 2 (no queues yet).

Second task: correlation. When N events from the same `source_ip` within M minutes have `auth_result=failure`, group them under one `investigation_id`. Investigations table comes in Phase 3, so for Phase 2 just stamp the same UUID onto related events.

Third task: severity counters in the page header (5 critical / 12 high / ... / 47 unknown). Cheap query, big visual win.

Groq API key already exists from log-analyzer project. Add as `GROQ_API_KEY` env var in Vercel + `.env.local` when starting Phase 2.

---

## Discipline carried over to Phase 2

- One feature, one commit, one push.
- Each phase ends demoable, never broken.
- VISION.md is the source of truth. Re-read it before scoping Phase 2.
- Push back on scope creep before code, not after.
