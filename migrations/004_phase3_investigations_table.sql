-- Phase 3, Commit 1: investigations table
-- Creates a dedicated table for investigation-level state.
-- Events still link via events.investigation_id.
-- Migration is non-breaking: existing events keep their investigation_id values;
-- backfill happens in migration 005.

create table if not exists investigations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open',
  severity text,
  mitre_technique text,
  source_ip text,
  event_count int not null default 0,
  notes text,
  closed_at timestamptz,

  constraint investigations_status_check
    check (status in ('open', 'investigating', 'true_positive', 'false_positive')),

  constraint investigations_severity_check
    check (severity is null or severity in ('critical', 'high', 'medium', 'low', 'unknown')),

  constraint investigations_closed_at_check
    check (
      (status in ('true_positive', 'false_positive') and closed_at is not null)
      or
      (status in ('open', 'investigating') and closed_at is null)
    )
);

create index if not exists investigations_status_idx on investigations(status);
create index if not exists investigations_source_ip_idx on investigations(source_ip);
create index if not exists investigations_created_at_idx on investigations(created_at desc);

-- updated_at trigger
create or replace function update_investigations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists investigations_updated_at_trigger on investigations;
create trigger investigations_updated_at_trigger
  before update on investigations
  for each row
  execute function update_investigations_updated_at();
