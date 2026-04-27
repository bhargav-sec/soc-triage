-- Phase 2: Add columns for AI MITRE classification and provider tracking
-- Applied 2026-04-27 in Supabase SQL Editor

alter table events
  add column if not exists mitre_technique text not null default 'unknown';

alter table events
  add column if not exists ai_provider text;

create index if not exists events_mitre_technique_idx on events (mitre_technique);

comment on column events.mitre_technique is 'MITRE ATT&CK technique ID assigned by AI. Phase 2 allowlist: T1110.001, T1110.003, T1078, T1548.003, T1136, T1098, unknown.';
comment on column events.ai_provider is 'Which AI provider scored this event: groq, gemini, or failed. Null for events scored before Phase 2.';
