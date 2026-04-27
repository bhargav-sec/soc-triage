-- Phase 1: Initial events table
-- Applied 2026-04-27 in Supabase SQL Editor
-- Schema designed for Phases 1-4 (severity/AI/correlation columns reserved from start)

create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  received_at     timestamptz not null default now(),
  event_time      timestamptz not null,
  source_type     text not null,
  source_host     text,
  raw_payload     text not null,
  parsed          jsonb not null default '{}'::jsonb,
  severity        text not null default 'unknown',
  severity_score  numeric,
  ai_summary      text,
  ai_reasoning    text,
  investigation_id uuid,
  status          text not null default 'new',
  created_at      timestamptz not null default now()
);

create index if not exists events_received_at_idx on events (received_at desc);
create index if not exists events_source_type_idx on events (source_type);
create index if not exists events_investigation_id_idx on events (investigation_id);
create index if not exists events_status_idx on events (status);

comment on table events is 'Raw security events. Designed for Phases 1-4. Phase 1 fills basic cols; Phases 2+ fill severity/AI/correlation cols.';
comment on column events.parsed is 'Flexible parsed fields per source_type. JSONB so we can add fields without migrations.';
comment on column events.investigation_id is 'Phase 2+: links related events into a single investigation. Null in Phase 1.';
comment on column events.severity_score is 'Phase 2+: AI-assigned numeric score 0-100. Null in Phase 1.';
