begin;

create table if not exists public.amv2_workout_day_tombstones (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  revision bigint not null check (revision > 0),
  deleted_at timestamptz not null default now(),
  primary key (owner_user_id,workout_date)
);

comment on table public.amv2_workout_day_tombstones is
  'One compact lifetime deletion marker per owner/date. Reused by repeated deletes and removed only by revision-aware recreation; retained until recreation or owner deletion to prevent stale-device resurrection.';

insert into public.amv2_workout_day_tombstones(owner_user_id,workout_date,revision,deleted_at)
select receipt.owner_user_id,
  (receipt.request_payload->'payload'->>'date')::date,
  (receipt.response_payload->>'revision')::bigint,
  receipt.created_at
from public.amv2_operation_receipts receipt
where receipt.operation_type='delete_day'
  and receipt.request_payload->'payload'->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
  and receipt.response_payload->>'revision' ~ '^\d+$'
  and receipt.response_payload->>'deleted'='true'
  and not exists (
    select 1 from public.amv2_workout_days day
    where day.owner_user_id=receipt.owner_user_id
      and day.workout_date=(receipt.request_payload->'payload'->>'date')::date
  )
on conflict(owner_user_id,workout_date) do update
set revision=greatest(public.amv2_workout_day_tombstones.revision,excluded.revision),
    deleted_at=greatest(public.amv2_workout_day_tombstones.deleted_at,excluded.deleted_at);

create index if not exists amv2_workout_day_tombstones_owner_deleted_idx
  on public.amv2_workout_day_tombstones(owner_user_id,deleted_at desc);

alter table public.amv2_workout_day_tombstones enable row level security;
alter table public.amv2_workout_day_tombstones force row level security;

drop policy if exists amv2_day_tombstones_owner_select on public.amv2_workout_day_tombstones;
create policy amv2_day_tombstones_owner_select
  on public.amv2_workout_day_tombstones for select to authenticated
  using ((select auth.uid())=owner_user_id);

revoke all on table public.amv2_workout_day_tombstones from public,anon,authenticated;
grant select on table public.amv2_workout_day_tombstones to authenticated;

do $$
begin
  if to_regprocedure('public.amv2_replace_workout_day_graph_cp219r1_base(uuid,bigint,jsonb)') is null then
    alter function public.amv2_replace_workout_day_graph(uuid,bigint,jsonb)
      rename to amv2_replace_workout_day_graph_cp219r1_base;
  end if;
  if to_regprocedure('public.amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)') is null then
    alter function public.amv2_apply_operation(text,text,bigint,jsonb)
      rename to amv2_apply_operation_cp219r1_base;
  end if;
end $$;

revoke all on function public.amv2_replace_workout_day_graph_cp219r1_base(uuid,bigint,jsonb)
  from public,anon,authenticated;
revoke all on function public.amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)
  from public,anon,authenticated;

create or replace function public.amv2_replace_workout_day_graph(
  p_owner uuid,p_expected_revision bigint,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_date date;
  v_active_revision bigint;
  v_deleted_revision bigint;
  v_next_revision bigint;
  v_response jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' or not (p_payload ? 'date') then
    raise exception using errcode='22023',message='AMV2_WORKOUT_DAY_FIELDS_INVALID';
  end if;
  v_date := (p_payload->>'date')::date;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || v_date::text,0));

  select revision into v_active_revision
  from public.amv2_workout_days
  where owner_user_id=p_owner and workout_date=v_date
  for update;
  if found then
    return public.amv2_replace_workout_day_graph_cp219r1_base(p_owner,p_expected_revision,p_payload);
  end if;

  select revision into v_deleted_revision
  from public.amv2_workout_day_tombstones
  where owner_user_id=p_owner and workout_date=v_date
  for update;
  if found then
    if p_expected_revision <> v_deleted_revision then
      raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
    end if;
    v_response := public.amv2_replace_workout_day_graph_cp219r1_base(p_owner,0,p_payload);
    v_next_revision := v_deleted_revision+1;
    update public.amv2_workout_days
      set revision=v_next_revision,updated_at=now()
      where owner_user_id=p_owner and workout_date=v_date;
    delete from public.amv2_workout_day_tombstones
      where owner_user_id=p_owner and workout_date=v_date;
    return jsonb_set(v_response,'{revision}',to_jsonb(v_next_revision),true);
  end if;

  return public.amv2_replace_workout_day_graph_cp219r1_base(p_owner,p_expected_revision,p_payload);
end $$;

create or replace function public.amv2_apply_operation(
  p_operation_key text,p_operation_type text,p_expected_revision bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_request jsonb;
  v_previous record;
  v_response jsonb;
  v_date date;
  v_current bigint;
  v_deleted_revision bigint;
  v_next bigint;
begin
  if p_operation_type <> 'delete_day' then
    return public.amv2_apply_operation_cp219r1_base(
      p_operation_key,p_operation_type,p_expected_revision,p_payload
    );
  end if;
  if v_owner is null then raise exception using errcode='28000',message='AMV2_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_payload) <> 'object'
    or pg_column_size(p_payload) > 524288
    or nullif(btrim(p_operation_key),'') is null
    or char_length(p_operation_key) > 160
    or p_expected_revision < 0 then
    raise exception using errcode='22023',message='AMV2_OPERATION_INVALID';
  end if;
  if not (p_payload ? 'date')
    or exists(select 1 from jsonb_object_keys(p_payload) key where key <> 'date') then
    raise exception using errcode='22023',message='AMV2_DELETE_DAY_PAYLOAD_INVALID';
  end if;

  v_request := jsonb_build_object(
    'type',p_operation_type,'expectedRevision',p_expected_revision,'payload',p_payload
  );
  select request_payload,response_payload into v_previous
  from public.amv2_operation_receipts
  where owner_user_id=v_owner and operation_key=p_operation_key;
  if found then
    if v_previous.request_payload <> v_request then
      raise exception using errcode='23505',message='AMV2_IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_previous.response_payload;
  end if;

  v_date := (p_payload->>'date')::date;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_date::text,0));
  select revision into v_current
  from public.amv2_workout_days
  where owner_user_id=v_owner and workout_date=v_date
  for update;

  if found then
    if v_current <> p_expected_revision then
      raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
    end if;
    v_next := v_current+1;
    delete from public.amv2_workout_days
      where owner_user_id=v_owner and workout_date=v_date;
    insert into public.amv2_workout_day_tombstones(owner_user_id,workout_date,revision,deleted_at)
      values(v_owner,v_date,v_next,now())
      on conflict(owner_user_id,workout_date) do update
      set revision=greatest(public.amv2_workout_day_tombstones.revision,excluded.revision),
          deleted_at=excluded.deleted_at;
  else
    select revision into v_deleted_revision
    from public.amv2_workout_day_tombstones
    where owner_user_id=v_owner and workout_date=v_date
    for update;
    if not found or v_deleted_revision <> p_expected_revision then
      raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
    end if;
    v_next := v_deleted_revision;
  end if;

  v_response := jsonb_build_object(
    'remoteIdentity','day:'||v_date::text,
    'revision',v_next,
    'date',v_date,
    'deleted',true
  );
  delete from public.amv2_operation_receipts
    where owner_user_id=v_owner and created_at < now()-interval '90 days';
  insert into public.amv2_operation_receipts(
    owner_user_id,operation_key,operation_type,request_payload,response_payload
  ) values(v_owner,p_operation_key,p_operation_type,v_request,v_response);
  return v_response;
end $$;

create or replace function public.amv2_read_calendar(p_from date,p_to date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_from > p_to or p_to-p_from > 366 then
    raise exception using errcode='22023',message='AMV2_DATE_RANGE_INVALID';
  end if;
  return jsonb_build_object(
    'days',coalesce((select jsonb_agg(to_jsonb(day)-'owner_user_id' order by day.workout_date)
      from public.amv2_workout_days day where day.workout_date between p_from and p_to),'[]'::jsonb),
    'exercises',coalesce((select jsonb_agg(to_jsonb(exercise)-'owner_user_id' order by exercise.workout_date,exercise.order_index)
      from public.amv2_workout_day_exercises exercise where exercise.workout_date between p_from and p_to),'[]'::jsonb),
    'sets',coalesce((select jsonb_agg(to_jsonb(item)-'owner_user_id' order by item.workout_date,item.exercise_client_key,item.order_index)
      from public.amv2_workout_day_sets item where item.workout_date between p_from and p_to),'[]'::jsonb),
    'tombstones',coalesce((select jsonb_agg(to_jsonb(marker)-'owner_user_id' order by marker.workout_date)
      from public.amv2_workout_day_tombstones marker where marker.workout_date between p_from and p_to),'[]'::jsonb),
    'personalExercises',coalesce((select jsonb_agg(jsonb_build_object(
      'id',personal.id,'client_key',personal.client_key,'name',personal.name,
      'template_exercise_key',personal.template_exercise_key,'category',personal.category,
      'location',personal.location,'metric_type',personal.metric_type,'revision',personal.revision,
      'archived_at',personal.archived_at,'created_at',personal.created_at,'updated_at',personal.updated_at
    ) order by personal.created_at) from public.amv2_personal_exercises personal),'[]'::jsonb)
  );
end $$;

revoke all on function public.amv2_replace_workout_day_graph(uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.amv2_apply_operation(text,text,bigint,jsonb) from public,anon;
grant execute on function public.amv2_apply_operation(text,text,bigint,jsonb) to authenticated;
revoke all on function public.amv2_read_calendar(date,date) from public,anon;
grant execute on function public.amv2_read_calendar(date,date) to authenticated;

commit;
