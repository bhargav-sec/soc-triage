# VISION.md

**Project:** SOC Triage Platform (working name)
**Author:** Bhargav
**Created:** 2026-04-27
**Last updated:** 2026-04-27 (Phase 2 scope locked)
**Status:** v1 scope, Phase 2 in progress

---

## Who this is for

**Optimized for junior SOC analysts in their first 0–18 months.** People who can read a log line but freeze when 200 alerts hit the queue. They know the vocabulary (SSH, brute force, lateral movement) but don't yet have the pattern recognition to triage confidently or the experience to know what's normal vs. what matters.

The tool is **usable** by senior SOC analysts, threat hunters, detection engineers, and technical non-SOC users — but their advanced needs (custom dashboards, full rule editing, MITRE Navigator integration, free-form analysis, multi-tenant access, automation/SOAR integrations) are explicitly out of scope. With significant SOC experience, this tool will likely feel slow or redundant — that's expected; you are not the target user.

## The one moment of pain this removes

A junior analyst opens their SIEM. They see 47 alerts. Each alert is technically accurate but structurally inconsistent — different fields, different severity scales, no clear "what do I do next." They spend 20 minutes deciding what to look at first, then panic-click the highest severity number and copy-paste the log into Google.

This product replaces that moment with: a queue of investigations (not alerts), each with a one-line summary of what happened, why it's suspicious, the MITRE technique it maps to, and a scaffolded checklist of what to check next — in the same shape, every time.

## Voice and structure

Every alert and investigation in the UI follows the same three-part shape:

1. **Observed** — what happened, in technical terms
2. **Why suspicious** — the technical reason it warranted an investigation, including AI reasoning and the MITRE technique
3. **Next step** — the next concrete action (Phase 3+)

Technical terminology stays. No softening. No dumbing down. Plain English where it adds clarity, jargon where jargon is the right word.

## What this is

A workflow prototype demonstrating a junior-analyst-first triage interface for SSH/auth-log security events. Built on Next.js + Vercel + Supabase + Groq/Gemini.

## What this is not

- **Not a production SIEM.** Will not scale to real SOC volumes (millions of events/day). Built on Postgres + serverless functions. This is deliberate.
- **Not multi-source.** Linux auth logs only in v1. CloudTrail, Windows Events, etc. are explicitly out of scope.
- **Not multi-tenant.** Single user, single workspace, no org/team logic.
- **Not a detection engineering platform.** Detections are simple, hardcoded, and few.
- **Not a real-time streaming dashboard.** Triage queue, not live tail. Refresh-driven.
- **Not compliance-ready.** No audit trail, no retention guarantees, no SOC2.
- **Not an automated response platform.** Does not block IPs, push to firewalls, auto-escalate, or take any action. Detection and triage only.

## v1 success criteria

A junior analyst can:

1. See a queue of investigations on the home page
2. Click into an investigation and see Observed / Why suspicious / Next step
3. See the underlying correlated events and the MITRE technique
4. Mark an investigation as resolved with a short note

If those four work end-to-end on a deployed URL with realistic-enough Linux auth log data, **v1 is done.**

---

## Phase 1 scope (shipped 2026-04-27)

Foundations only. No AI yet. No correlation yet. No playbooks yet.

- Fresh Next.js + Tailwind repo, pushed to GitHub
- Fresh Vercel project, deployed
- Fresh Supabase project with an `events` table
- `POST /api/ingest` endpoint that accepts a JSON log event and writes to Supabase
- `/` page that reads from Supabase and renders events in a list
- Sample-event button on the page that POSTs hardcoded auth.log lines to the ingest endpoint

End state: button click → event in Supabase → event visible on deployed URL. **Done.**

See `SESSION-1.md` for shipped details.

---

## Phase 2 scope (current session)

**Goal:** Add AI scoring + MITRE classification + event correlation + severity counters. The triage queue stops looking like a flat event list and starts behaving like an investigation queue.

### What ships

**1. AI scoring on ingest (synchronous).**
- Every event passing through `POST /api/ingest` is scored by AI before the endpoint returns.
- Primary provider: Groq, model `llama-3.3-70b-versatile`.
- Fallback provider: **deferred**. Gemini was the planned fallback but free-tier quota was exhausted at setup; integration architecture leaves a clean hook (`tryFallback()`) for any future provider. If Groq fails, severity stays `unknown` and the AI failure UI banner activates.
- Strict JSON output: AI returns `{severity, mitre_technique, summary, reasoning}`.
- `severity` ∈ `{critical, high, medium, low, unknown}`.
- `mitre_technique` ∈ `{T1110.001, T1110.003, T1078, T1548.003, T1136, T1098, unknown}`.
- Inside the JSON, `summary` and `reasoning` are plain English sentences.
- Fallback triggers: Groq returns 5xx/timeout/rate-limit, OR response doesn't parse as JSON, OR severity/mitre_technique field isn't in the allowed set. Any of these → fall to Gemini. If Gemini also fails any of the three, severity stays `unknown`, mitre_technique stays `unknown`, ingest still returns 201.
- No retries, no parallel calls, no queues. Worst-case ingest latency ~3 seconds.
- The provider that succeeded (`groq` / `gemini` / `failed`) is recorded on the event row in a new `ai_provider` column.

**2. MITRE ATT&CK technique classification.**
- 6-technique allowlist (Linux auth log scope) plus `unknown` fallback:

| ID | Name | When AI assigns it |
|---|---|---|
| `T1110.001` | Password Guessing | Repeated failed auth attempts to one or more accounts |
| `T1110.003` | Password Spraying | Same password tried across many usernames |
| `T1078` | Valid Accounts | Successful login from suspicious context |
| `T1548.003` | Sudo Abuse | Failed/anomalous sudo activity |
| `T1136` | Create Account | New user account creation |
| `T1098` | Account Manipulation | Group/permission/password changes |
| `unknown` | (fallback) | AI couldn't confidently classify, or scoring failed |

- Stored in a new column `mitre_technique` on the `events` table.
- Rendered on each event card as a clickable badge linking to the corresponding `attack.mitre.org` page in a new tab.

**3. Event correlation (on ingest).**
- After scoring, every new event runs a correlation check: are there other events from the same `source_ip` in the last 15 minutes?
- If 3+ events match (counting the new one), all matching events get stamped with a shared `investigation_id` (UUID). New `investigation_id` if none of the matches have one yet; existing one if any of them do.
- If fewer than 3 matches, `investigation_id` stays null.
- Same `source_ip` is the only correlation key in Phase 2. Cross-IP same-user correlation is Phase 3+.
- Implementation: extra query in the ingest path, ~50ms additional latency.

**4. Severity counters in page header.**
- Five colored counters: `critical` (red), `high` (orange), `medium` (yellow), `low` (blue), `unknown` (gray).
- Counts come from a single aggregate query over the events table.
- The `unknown` counter is the AI health signal: if it's growing fast, scoring is broken.

**5. UI updates flowing from the above.**
- Severity badge on each event card shows the real AI-assigned severity (Phase 1 stub goes away).
- "Why suspicious" line on each card shows AI reasoning + MITRE technique badge (Phase 1 stub goes away).
- Events with the same `investigation_id` are visually grouped — exact treatment decided during build.
- "Next step" line stays as a Phase 3 stub.
- **AI failure messaging:** when both providers fail (event ingested with `severity = 'unknown'` and `ai_provider = 'failed'`), a non-blocking banner or toast on the page surfaces "AI scoring is currently unavailable — events are being stored but not scored." The banner clears once a successful scoring is observed.

**6. Developer hygiene.**
- Server-side `console.log` statements record AI request and response payloads (never the API keys). Visible in `npm run dev` output and Vercel Logs in production.

### What is explicitly NOT in Phase 2

- **No investigations table.** `investigation_id` is just a column on `events` for now. The dedicated table comes in Phase 3 with notes, status, and close flow.
- **No playbooks, no "Next step" content, no escalation logic, no L2 routing, no auto-response.** "Next step" stays a stub.
- **No cross-provider parallel scoring / dispute detection.** Gemini stays a silent fallback only.
- **No analyst override flow.** Adding a "this AI verdict is wrong, change it" button is Phase 3.
- **No baselines.** "What's normal here?" panel still deferred.
- **No auth.** Single user.
- **No rescoring of failed events.** Once `severity = 'unknown'` after both providers fail, it stays unknown unless manually re-ingested. Rescore flow deferred to Phase 3.
- **No async ingest, no queue, no background workers.**
- **No real-time updates.** Refresh button still drives data updates.
- **No `severity_score` numeric field population.** Column exists; stays null in Phase 2.
- **No filtering, sorting, or bulk actions on the queue.** Phase 3 candidate.

### Phase 2 success criteria

A junior analyst opening the deployed app sees:
1. Five severity counters in the header reflecting the real distribution.
2. Events arriving via `Send sample event` getting real severity badges and MITRE technique badges within ~1.5 seconds.
3. Multiple failed-SSH samples from the same IP within 15 minutes grouped under a shared `investigation_id` (visible somehow on the cards).
4. AI reasoning text visible on each card's "Why suspicious" line.
5. Clickable MITRE badges that open the correct `attack.mitre.org` page in a new tab.
6. If both providers fail, a clear UI message rather than silent unknowns.

If those six work end-to-end on the live URL, **Phase 2 is done.**

### New env vars (this session)

- `GROQ_API_KEY` — added to `.env.local` and Vercel (Sensitive).
- `GEMINI_API_KEY` — same.

### Schema changes (Phase 2)

Two new columns on the `events` table:

- `mitre_technique text not null default 'unknown'`
- `ai_provider text` (nullable; values: `'groq'`, `'gemini'`, `'failed'`)

No data migration needed. Both default to safe values for existing rows.

---

## Phases 3 and 4 (future sessions, directional only)

- **Phase 3:** Scaffolded triage playbooks (`Next step` content), AI-recommended remediation actions and L2 escalation criteria, analyst notes, investigation close flow, dedicated `investigations` table, severity rescore + manual analyst override of AI verdicts, optional auth.
- **Phase 4:** Per-host endpoint timeline view. Python forwarder agent that tails `/var/log/auth.log` and POSTs to `/api/ingest`. Honeypot VM (Oracle Cloud free tier or cheap droplet) as a live data source.

These phases are directional, not contractual. Each one gets re-scoped at the start of its session.

---

## Decisions deferred (revisit later)

- **AI verdict accuracy / dispute detection** — Phase 3 candidate. Three approaches considered: analyst override flow (most realistic, leverages Phase 3 work), cross-provider agreement check (Groq + Gemini in parallel, flag disagreements), hardcoded heuristic guardrails (rule-based sanity checks on top of AI verdicts). To be re-evaluated when Phase 3 scope is locked.
- **AI-recommended remediation steps and L2 escalation criteria** — Phase 3 (part of playbooks).
- **"What's normal here?" baseline panel** — Phase 3 candidate.
- **Auth (Supabase Auth)** — Phase 3 candidate.
- **Rescoring failed events** — Phase 3 candidate.
- **Analyst manual override of AI severity / MITRE technique** — Phase 3.
- **Cross-IP same-user correlation** — Phase 3 candidate.
- **Investigations table separate from events** — Phase 3.
- **`severity_score` numeric column population** — Phase 3+.
- **Per-host endpoint timeline** — Phase 4.
- **Python forwarder agent + honeypot VM** — Phase 4.
- **Real-time updates (websockets / Supabase Realtime)** — out of scope through Phase 4.
- **Custom domain and product name** — when there's something worth branding.
- **Honeypot VM provider (Oracle Cloud free vs. cheap droplet)** — Phase 4.
- **Filtering / sorting / bulk actions on the queue** — Phase 3 candidate.
- **MITRE Navigator-style coverage view** — out of scope for v1.
- **Optional `/stats` (dashboard) page** — Phase 3 candidate. Charts and aggregated views (events over time, top source IPs, MITRE technique distribution, severity breakdown) for users who want traditional SIEM-style visualization. Lives on a separate route — never the home page. Home page stays the triage queue. Adds to Phase 3 if time allows; not core scope.

---

## Discipline rules (carried across all phases)

- One feature, one commit, one test, one push.
- Each phase ends demoable, never broken.
- Push back on scope creep before code, not after.
- VISION.md is the source of truth. Re-read before scoping each phase.
- Confirm scope before writing code.
- Never overwrite raw input with derived output (`raw_payload` and `parsed` are immutable; AI fields are separate columns).
- Free tier first. Pay only when free tier blocks something real.

