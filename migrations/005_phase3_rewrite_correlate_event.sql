-- Phase 3, Commit 2: rewrite correlate_event to use investigations table.
-- Builds on Phase 2's correlate_event (migrations/003).
-- Old behavior: stamped a free-floating UUID into events.investigation_id when
--   3+ events from the same source_ip occurred within 15 minutes.
-- New behavior: same trigger condition, but the UUID now points at a real row
--   in the investigations table. Reuses an existing open/investigating one for
--   the same source_ip if present; otherwise creates a new one.
-- Investigation severity = highest severity in the correlated group at creation time.
-- Investigation mitre_technique = most common technique in the group at creation time.
-- event_count kept in sync after stamping.
-- Matches Phase 2 conventions: parameter is p_event_id, time field is received_at,
-- window upper bound is the new event's received_at (not now()).

drop function if exists correlate_event(uuid);

create or replace function correlate_event(p_event_id uuid)
returns table (
  out_investigation_id uuid,
  out_correlated_count int
)
language plpgsql
security definer
as $$
declare
  v_source_ip text;
  v_received_at timestamptz;
  v_match_count int;
  v_existing_inv_id uuid;
  v_inv_id uuid;
  v_top_severity text;
  v_top_mitre text;
begin
  -- Get source_ip and received_at of the new event
  select
    e.parsed->>'source_ip',
    e.received_at
  into v_source_ip, v_received_at
  from events e
  where e.id = p_event_id;

  if v_source_ip is null or v_source_ip = '' then
    return query select null::uuid, 0;
    return;
  end if;

  -- Count matching events in 15-min window ending at this event's received_at
  select count(*) into v_match_count
  from events e
  where e.parsed->>'source_ip' = v_source_ip
    and e.received_at >= v_received_at - interval '15 minutes'
    and e.received_at <= v_received_at;

  if v_match_count < 3 then
    return query select null::uuid, v_match_count;
    return;
  end if;

  -- Threshold met. Look for an existing open or investigating investigation for this source_ip.
  select i.id into v_existing_inv_id
  from investigations i
  where i.source_ip = v_source_ip
    and i.status in ('open', 'investigating')
  order by i.created_at desc
  limit 1;

  if v_existing_inv_id is not null then
    v_inv_id := v_existing_inv_id;
  else
    -- Compute top severity (lowest priority number wins) from matched group
    select e.severity into v_top_severity
    from events e
    where e.parsed->>'source_ip' = v_source_ip
      and e.received_at >= v_received_at - interval '15 minutes'
      and e.received_at <= v_received_at
    order by case e.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      when 'low' then 4
      when 'unknown' then 5
      else 6
    end
    limit 1;

    -- Most common MITRE in matched group
    select e.mitre_technique into v_top_mitre
    from events e
    where e.parsed->>'source_ip' = v_source_ip
      and e.received_at >= v_received_at - interval '15 minutes'
      and e.received_at <= v_received_at
    group by e.mitre_technique
    order by count(*) desc, e.mitre_technique
    limit 1;

    insert into investigations (status, severity, mitre_technique, source_ip, event_count)
    values (
      'open',
      coalesce(v_top_severity, 'unknown'),
      coalesce(v_top_mitre, 'unknown'),
      v_source_ip,
      v_match_count
    )
    returning id into v_inv_id;
  end if;

  -- Stamp matching events that aren't already stamped with this investigation_id
  update events e
  set investigation_id = v_inv_id
  where e.parsed->>'source_ip' = v_source_ip
    and e.received_at >= v_received_at - interval '15 minutes'
    and e.received_at <= v_received_at
    and (e.investigation_id is null or e.investigation_id <> v_inv_id);

  -- Sync event_count on the investigation
  update investigations i
  set event_count = (
        select count(*) from events e where e.investigation_id = v_inv_id
      ),
      updated_at = now()
  where i.id = v_inv_id;

  return query select v_inv_id, v_match_count;
end;
$$;

comment on function correlate_event(uuid) is
  'Phase 3: groups events from same source_ip within 15min into a real investigations row when 3+ events match.';
