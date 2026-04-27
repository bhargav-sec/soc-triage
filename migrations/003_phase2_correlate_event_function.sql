-- Phase 2: Correlation function
-- Applied 2026-04-27 in Supabase SQL Editor
--
-- Bug fix history: initial version had ambiguous "investigation_id" column references
-- (Postgres error 42702). Fixed by renaming output columns to out_investigation_id /
-- out_correlated_count and aliasing the table as 'e' in all subqueries.

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
  v_existing_investigation_id uuid;
  v_match_count int;
  v_new_investigation_id uuid;
begin
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

  select e.investigation_id into v_existing_investigation_id
  from events e
  where e.parsed->>'source_ip' = v_source_ip
    and e.received_at >= v_received_at - interval '15 minutes'
    and e.received_at <= v_received_at
    and e.investigation_id is not null
  limit 1;

  select count(*) into v_match_count
  from events e
  where e.parsed->>'source_ip' = v_source_ip
    and e.received_at >= v_received_at - interval '15 minutes'
    and e.received_at <= v_received_at;

  if v_match_count < 3 then
    return query select null::uuid, v_match_count;
    return;
  end if;

  if v_existing_investigation_id is not null then
    v_new_investigation_id := v_existing_investigation_id;
  else
    v_new_investigation_id := gen_random_uuid();
  end if;

  update events e
  set investigation_id = v_new_investigation_id
  where e.parsed->>'source_ip' = v_source_ip
    and e.received_at >= v_received_at - interval '15 minutes'
    and e.received_at <= v_received_at
    and e.investigation_id is null;

  return query select v_new_investigation_id, v_match_count;
end;
$$;

comment on function correlate_event(uuid) is
  'Phase 2 correlation: groups events from same source_ip within 15min into a shared investigation_id when 3+ events match.';
