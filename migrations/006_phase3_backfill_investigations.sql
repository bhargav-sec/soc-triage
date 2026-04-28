-- Phase 3, Commit 2: backfill investigations table from existing events.
-- Existing events have free-floating investigation_id UUIDs (stamped by Phase 2's
-- correlate_event) that don't point at investigations rows. This script creates
-- one investigations row per distinct existing investigation_id, populated from
-- the events themselves.
-- Idempotent: only inserts rows that don't already exist.
-- source_ip is read from parsed->>'source_ip' (not a column on events).

insert into investigations (id, status, severity, mitre_technique, source_ip, event_count, created_at, updated_at)
select
  e.investigation_id as id,
  'open' as status,
  -- Top severity by priority within the group
  (
    select e2.severity
    from events e2
    where e2.investigation_id = e.investigation_id
    order by case e2.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      when 'low' then 4
      when 'unknown' then 5
      else 6
    end
    limit 1
  ) as severity,
  -- Most common MITRE in group
  (
    select e2.mitre_technique
    from events e2
    where e2.investigation_id = e.investigation_id
    group by e2.mitre_technique
    order by count(*) desc, e2.mitre_technique
    limit 1
  ) as mitre_technique,
  -- Source IP (should be uniform within an investigation given Phase 2 logic)
  (
    select e2.parsed->>'source_ip'
    from events e2
    where e2.investigation_id = e.investigation_id
      and e2.parsed->>'source_ip' is not null
    limit 1
  ) as source_ip,
  count(*) as event_count,
  min(e.received_at) as created_at,
  max(e.received_at) as updated_at
from events e
where e.investigation_id is not null
  and not exists (
    select 1 from investigations i where i.id = e.investigation_id
  )
group by e.investigation_id;
