-- Phase 3, commit 1 fix: closed_at_check was masking status_check violations.
-- Original constraint failed for any status outside the four valid ones,
-- which stole violations from status_check. This rewrite passes silently
-- when status is invalid, so status_check fires correctly.

alter table investigations drop constraint investigations_closed_at_check;

alter table investigations add constraint investigations_closed_at_check
  check (
    (status in ('true_positive', 'false_positive') and closed_at is not null)
    or
    (status in ('open', 'investigating') and closed_at is null)
    or
    status not in ('true_positive', 'false_positive', 'open', 'investigating')
  );
