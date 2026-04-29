-- Phase 3, commit 6: event-level close flow.
-- Adds notes + closed_at columns to events. Aligns events.status with
-- investigations.status (open / investigating / true_positive / false_positive).
-- Backfills existing 'new' events to 'open'.

-- 1. Add notes column (nullable, no default).
alter table events add column if not exists notes text;

-- 2. Add closed_at column (nullable, no default).
alter table events add column if not exists closed_at timestamptz;

-- 3. Backfill 'new' to 'open' so existing rows match the new status enum.
update events set status = 'open' where status = 'new';

-- 4. Change default for new inserts.
alter table events alter column status set default 'open';

-- 5. Add status check constraint matching investigations.
-- Drop first if it somehow exists from a prior attempt.
alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check
  check (status in ('open', 'investigating', 'true_positive', 'false_positive'));

-- 6. Add closed_at check constraint mirroring investigations pattern.
-- Closed statuses must have closed_at; open statuses must not.
-- Third OR branch passes through if status is invalid (status_check handles that).
alter table events drop constraint if exists events_closed_at_check;
alter table events add constraint events_closed_at_check
  check (
    (status in ('true_positive', 'false_positive') and closed_at is not null)
    or
    (status in ('open', 'investigating') and closed_at is null)
    or
    status not in ('true_positive', 'false_positive', 'open', 'investigating')
  );
