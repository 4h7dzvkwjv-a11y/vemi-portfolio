begin;

-- One owner-wide generation identifies a coherent history snapshot. All AMV2
-- writes pass through amv2_apply_operation, which advances this value in the
-- same transaction as the graph and receipt changes.
create table if not exists public.amv2_owner_sync_state (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  history_revision bigint not null default 0 check (history_revision >= 0),
  updated_at timestamptz not null default now()
);

insert into public.amv2_owner_sync_state(owner_user_id,history_revision,updated_at)
select owner_user_id,1,now()
from (
  select owner_user_id from public.amv2_workout_days
  union select owner_user_id from public.amv2_workout_day_tombstones
  union select owner_user_id from public.amv2_personal_exercises
  union select owner_user_id from public.amv2_import_batches
) owners
on conflict(owner_user_id) do nothing;

alter table public.amv2_operation_receipts
  add column if not exists request_hash text;

update public.amv2_operation_receipts
set request_hash=md5(request_payload::text)
where request_hash is null;

alter table public.amv2_operation_receipts
  drop constraint if exists amv2_operation_receipts_request_hash_format;
alter table public.amv2_operation_receipts
  add constraint amv2_operation_receipts_request_hash_format
  check (request_hash is null or request_hash ~ '^[0-9a-f]{32}$');

-- Keep source_identity for backwards compatibility, but stop treating a
-- reusable definition as a unique occurrence. The explicit columns and the
-- occurrence table below keep definition, occurrence, destination and cloud
-- operation identities independent.
alter table public.amv2_import_batches
  add column if not exists source_definition_identity text,
  add column if not exists source_occurrence_identity text;

update public.amv2_import_batches
set source_definition_identity=coalesce(source_definition_identity,source_identity),
    source_occurrence_identity=coalesce(source_occurrence_identity,source_identity)
where source_definition_identity is null or source_occurrence_identity is null;

alter table public.amv2_import_batches
  alter column source_definition_identity set not null,
  alter column source_occurrence_identity set not null;

do $$
declare v_constraint text;
begin
  for v_constraint in
    select constraint_name
    from information_schema.table_constraints
    where table_schema='public'
      and table_name='amv2_import_batches'
      and constraint_type='UNIQUE'
      and constraint_name in (
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid=con.conrelid
        join pg_namespace nsp on nsp.oid=rel.relnamespace
        where nsp.nspname='public'
          and rel.relname='amv2_import_batches'
          and pg_get_constraintdef(con.oid) ilike 'UNIQUE (owner_user_id, source, source_identity)%'
      )
  loop
    execute format('alter table public.amv2_import_batches drop constraint %I',v_constraint);
  end loop;
end $$;

create table if not exists public.amv2_import_occurrences (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('v1_local','v1_account')),
  source_definition_identity text not null check (btrim(source_definition_identity) <> ''),
  source_occurrence_identity text not null check (btrim(source_occurrence_identity) <> ''),
  destination_date date not null,
  destination_client_key text not null check (btrim(destination_client_key) <> ''),
  batch_key text not null,
  operation_key text not null check (btrim(operation_key) <> '' and char_length(operation_key) <= 160),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  resulting_canonical_keys text[] not null default '{}',
  resulting_personal_ids text[] not null default '{}',
  result_payload jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_user_id,source,source_occurrence_identity,destination_date),
  foreign key (owner_user_id,batch_key)
    references public.amv2_import_batches(owner_user_id,batch_key) on delete cascade
);

alter table public.amv2_import_occurrences
  add column if not exists result_payload jsonb;

-- Normalize pre-R2 import receipts to the stable occurrence-level confirmation
-- identity used by both first delivery and later replay.
update public.amv2_operation_receipts receipt
set response_payload=jsonb_set(
  receipt.response_payload,
  '{remoteIdentity}',
  to_jsonb(('import:'||batch.source_occurrence_identity)::text),
  true
)
from public.amv2_import_batches batch
where receipt.owner_user_id=batch.owner_user_id
  and receipt.operation_type='import_days'
  and receipt.request_payload->'payload'->>'batchKey'=batch.batch_key;

insert into public.amv2_import_occurrences(
  owner_user_id,source,source_definition_identity,source_occurrence_identity,
  destination_date,destination_client_key,batch_key,operation_key,request_hash,
  resulting_canonical_keys,resulting_personal_ids,created_at
)
select batch.owner_user_id,batch.source,batch.source_definition_identity,
  batch.source_occurrence_identity,imported_date,
  coalesce(nullif(day.payload->>'clientKey',''),'legacy:'||imported_date::text),
  batch.batch_key,'legacy-batch:'||md5(batch.batch_key),
  md5(jsonb_build_object(
    'sourceDefinitionIdentity',batch.source_definition_identity,
    'sourceOccurrenceIdentity',batch.source_occurrence_identity,
    'destinationDate',imported_date,
    'day',coalesce(day.payload,'{}'::jsonb)
  )::text),
  coalesce((select array_agg(item->'reference'->>'exerciseKey' order by item->>'orderIndex')
    from jsonb_array_elements(coalesce(day.payload->'exercises','[]'::jsonb)) item
    where item->'reference'->>'source'='canonical'),'{}'::text[]),
  coalesce((select array_agg(item->'reference'->>'personalExerciseId' order by item->>'orderIndex')
    from jsonb_array_elements(coalesce(day.payload->'exercises','[]'::jsonb)) item
    where item->'reference'->>'source'='personal'),'{}'::text[]),
  batch.created_at
from public.amv2_import_batches batch
cross join lateral unnest(batch.imported_dates) imported_date
left join lateral (
  select candidate payload
  from jsonb_array_elements(coalesce(batch.payload->'days','[]'::jsonb)) candidate
  where candidate->>'date'=imported_date::text
  limit 1
) day on true
on conflict(owner_user_id,source,source_occurrence_identity,destination_date) do nothing;

update public.amv2_import_occurrences occurrence
set result_payload=coalesce(
  (select receipt.response_payload
    from public.amv2_operation_receipts receipt
    where receipt.owner_user_id=occurrence.owner_user_id
      and receipt.operation_type='import_days'
      and receipt.request_payload->'payload'->>'batchKey'=occurrence.batch_key
    order by receipt.created_at
    limit 1),
  jsonb_build_object(
    'remoteIdentity','import:'||occurrence.source_occurrence_identity,
    'revision',1,
    'dates',to_jsonb(batch.imported_dates),
    'appliedDates',to_jsonb(batch.imported_dates)
  )
)
from public.amv2_import_batches batch
where occurrence.owner_user_id=batch.owner_user_id
  and occurrence.batch_key=batch.batch_key
  and occurrence.result_payload is null;

-- These two partial indexes are the only missing exercise-history paths. The
-- owner/date primary keys already cover owner pagination and tombstone merge;
-- receipt lookup is already covered by its primary key.
create index if not exists amv2_day_exercises_canonical_history_idx
  on public.amv2_workout_day_exercises(owner_user_id,canonical_exercise_key,workout_date desc)
  where canonical_exercise_key is not null;
create index if not exists amv2_day_exercises_personal_history_idx
  on public.amv2_workout_day_exercises(owner_user_id,personal_exercise_id,workout_date desc)
  where personal_exercise_id is not null;
create index if not exists amv2_import_occurrences_definition_history_idx
  on public.amv2_import_occurrences(owner_user_id,source,source_definition_identity,destination_date desc);

alter table public.amv2_owner_sync_state enable row level security;
alter table public.amv2_owner_sync_state force row level security;
alter table public.amv2_import_occurrences enable row level security;
alter table public.amv2_import_occurrences force row level security;

drop policy if exists amv2_owner_sync_state_owner_select on public.amv2_owner_sync_state;
create policy amv2_owner_sync_state_owner_select
  on public.amv2_owner_sync_state for select to authenticated
  using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_import_occurrences_owner_select on public.amv2_import_occurrences;
create policy amv2_import_occurrences_owner_select
  on public.amv2_import_occurrences for select to authenticated
  using ((select auth.uid())=owner_user_id);

revoke all on table public.amv2_owner_sync_state,public.amv2_import_occurrences
  from public,anon,authenticated;
grant select on table public.amv2_owner_sync_state,public.amv2_import_occurrences
  to authenticated;

do $$
begin
  if to_regprocedure('public.amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)') is null then
    alter function public.amv2_apply_operation(text,text,bigint,jsonb)
      rename to amv2_apply_operation_cp219r2_base;
  end if;
end $$;

-- CP219/R1 base functions performed a rolling 90-day receipt purge. Durable
-- operation IDs must remain replayable for the lifetime of retained AMV2 data,
-- so remove only that legacy cleanup statement from both renamed implementations.
do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_without_expiry text;
begin
  foreach v_signature in array array[
    'public.amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)'::regprocedure,
    'public.amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_without_expiry := regexp_replace(
      v_definition,
      $pattern$\s*delete\s+from\s+public\.amv2_operation_receipts\s+where\s+owner_user_id\s*=\s*v_owner\s+and\s+created_at\s*<\s*now\(\)\s*-\s*interval\s*'90 days'\s*;$pattern$,
      E'\n',
      'gi'
    );
    if v_without_expiry <> v_definition then
      execute v_without_expiry;
    end if;
    if pg_get_functiondef(v_signature) ~* $pattern$created_at\s*<\s*now\(\)\s*-\s*interval\s*'90 days'$pattern$ then
      raise exception 'AMV2_RECEIPT_RETENTION_REWRITE_FAILED: %',v_signature;
    end if;
  end loop;
end $$;

revoke all on function public.amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)
  from public,anon,authenticated;

create or replace function public.amv2_apply_operation(
  p_operation_key text,p_operation_type text,p_expected_revision bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_request jsonb;
  v_request_hash text;
  v_previous record;
  v_response jsonb;
  v_snapshot_revision bigint;
  v_domain_changed boolean := true;
  v_batch record;
  v_item jsonb;
  v_day jsonb;
  v_source text;
  v_definition_identity text;
  v_occurrence_identity text;
  v_declared_destination date;
  v_destination date;
  v_occurrence_hash text;
  v_existing_occurrence record;
  v_reused_response jsonb;
  v_dates date[] := '{}';
  v_applied_dates date[] := '{}';
  v_canonical_keys text[];
  v_personal_ids text[];
  v_expected_revision_checked boolean := false;
begin
  if v_owner is null then
    raise exception using errcode='28000',message='AMV2_AUTH_REQUIRED';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 524288
    or nullif(btrim(p_operation_key),'') is null or char_length(p_operation_key) > 160
    or p_expected_revision < 0
    or p_operation_type not in ('upsert_day','delete_day','upsert_personal','archive_personal','import_days') then
    raise exception using errcode='22023',message='AMV2_OPERATION_INVALID';
  end if;

  v_request := jsonb_build_object(
    'type',p_operation_type,'expectedRevision',p_expected_revision,'payload',p_payload
  );

  -- The deterministic owner+operation lock is deliberately acquired before
  -- the authoritative receipt read. Concurrent retries therefore reuse one
  -- committed receipt instead of racing on its unique constraint.
  perform pg_advisory_xact_lock(
    hashtextextended('amv2-operation:'||v_owner::text||':'||p_operation_key,0)
  );
  select request_payload,response_payload,request_hash into v_previous
  from public.amv2_operation_receipts
  where owner_user_id=v_owner and operation_key=p_operation_key;
  v_request_hash := md5(v_request::text);
  if found then
    if coalesce(v_previous.request_hash,md5(v_previous.request_payload::text)) <> v_request_hash
      or v_previous.request_payload <> v_request then
      raise exception using errcode='22023',message='AMV2_IDEMPOTENCY_PAYLOAD_CONFLICT';
    end if;
    return v_previous.response_payload;
  end if;

  -- Serializing owner mutations with the same key used by history reads makes
  -- the revision and graph one coherent transaction-visible generation.
  perform pg_advisory_xact_lock(
    hashtextextended('amv2-owner-history:'||v_owner::text,0)
  );

  if p_operation_type <> 'import_days' then
    v_response := public.amv2_apply_operation_cp219r2_base(
      p_operation_key,p_operation_type,p_expected_revision,p_payload
    );
  else
    if not (p_payload ?& array['batchKey','source','days'])
      or jsonb_typeof(p_payload->'days') <> 'array'
      or jsonb_array_length(p_payload->'days') not between 1 and 31
      or exists(select 1 from jsonb_object_keys(p_payload) key
        where key not in ('batchKey','source','sourceIdentity','sourceDefinitionIdentity','sourceOccurrenceIdentity','destinationDate','days')) then
      raise exception using errcode='22023',message='AMV2_IMPORT_INVALID';
    end if;
    v_source := p_payload->>'source';
    v_definition_identity := coalesce(
      nullif(btrim(p_payload->>'sourceDefinitionIdentity'),''),
      nullif(btrim(p_payload->>'sourceIdentity'),'')
    );
    v_occurrence_identity := coalesce(
      nullif(btrim(p_payload->>'sourceOccurrenceIdentity'),''),
      nullif(btrim(p_payload->>'sourceIdentity'),'')
    );
    if v_source not in ('v1_local','v1_account')
      or nullif(btrim(p_payload->>'batchKey'),'') is null
      or char_length(p_payload->>'batchKey') > 160
      or v_definition_identity is null or char_length(v_definition_identity) > 200
      or v_occurrence_identity is null or char_length(v_occurrence_identity) > 200 then
      raise exception using errcode='22023',message='AMV2_IMPORT_IDENTITY_INVALID';
    end if;
    if p_payload ? 'sourceDefinitionIdentity' then
      if not (p_payload ?& array['sourceOccurrenceIdentity','destinationDate'])
        or (p_payload->>'destinationDate') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception using errcode='22023',message='AMV2_IMPORT_IDENTITY_INVALID';
      end if;
      v_declared_destination := (p_payload->>'destinationDate')::date;
    elsif p_payload ? 'destinationDate' then
      raise exception using errcode='22023',message='AMV2_IMPORT_IDENTITY_INVALID';
    end if;

    select payload,imported_dates,source,source_definition_identity,source_occurrence_identity
      into v_batch
    from public.amv2_import_batches
    where owner_user_id=v_owner and batch_key=p_payload->>'batchKey'
    for update;
    if found then
      if v_batch.payload <> p_payload or v_batch.source <> v_source
        or v_batch.source_definition_identity <> v_definition_identity
        or v_batch.source_occurrence_identity <> v_occurrence_identity then
        raise exception using errcode='22023',message='AMV2_IMPORT_BATCH_CONFLICT';
      end if;
      v_dates := v_batch.imported_dates;
      v_domain_changed := false;
      select occurrence.result_payload into v_reused_response
      from public.amv2_import_occurrences occurrence
      where occurrence.owner_user_id=v_owner
        and occurrence.batch_key=p_payload->>'batchKey'
        and occurrence.result_payload is not null
      order by occurrence.destination_date
      limit 1;
      if v_reused_response is null
        or p_expected_revision not in (0,coalesce((v_reused_response->>'revision')::bigint,1)) then
        raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
      end if;
      v_expected_revision_checked := true;
    else
      insert into public.amv2_import_batches(
        owner_user_id,batch_key,source,source_identity,source_definition_identity,
        source_occurrence_identity,payload,imported_dates
      ) values (
        v_owner,p_payload->>'batchKey',v_source,v_occurrence_identity,v_definition_identity,
        v_occurrence_identity,p_payload,'{}'
      );

      for v_item in select value from jsonb_array_elements(p_payload->'days') loop
        v_day := v_item;
        if jsonb_typeof(v_day) <> 'object' or not (v_day ? 'date')
          or (v_day->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception using errcode='22023',message='AMV2_IMPORT_DESTINATION_INVALID';
        end if;
        v_destination := (v_day->>'date')::date;
        if v_declared_destination is not null and v_destination <> v_declared_destination then
          raise exception using errcode='22023',message='AMV2_IMPORT_DESTINATION_INVALID';
        end if;
        if v_destination = any(v_dates) then
          raise exception using errcode='22023',message='AMV2_IMPORT_DESTINATION_DUPLICATE';
        end if;
        v_dates := array_append(v_dates,v_destination);
        v_occurrence_hash := md5(jsonb_build_object(
          'sourceDefinitionIdentity',v_definition_identity,
          'sourceOccurrenceIdentity',v_occurrence_identity,
          'destinationDate',v_destination,
          'day',v_day
        )::text);

        select request_hash,destination_client_key,result_payload into v_existing_occurrence
        from public.amv2_import_occurrences
        where owner_user_id=v_owner and source=v_source
          and source_occurrence_identity=v_occurrence_identity
          and destination_date=v_destination
        for update;
        if found then
          if v_existing_occurrence.request_hash <> v_occurrence_hash then
            raise exception using errcode='22023',message='AMV2_IMPORT_OCCURRENCE_CONFLICT';
          end if;
          if v_existing_occurrence.result_payload is null then
            raise exception using errcode='55000',message='AMV2_IMPORT_RESULT_UNAVAILABLE';
          end if;
          if v_reused_response is not null
            and v_reused_response <> v_existing_occurrence.result_payload then
            raise exception using errcode='22023',message='AMV2_IMPORT_RESULT_CONFLICT';
          end if;
          if p_expected_revision not in (
            0,coalesce((v_existing_occurrence.result_payload->>'revision')::bigint,1)
          ) then
            raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
          end if;
          v_expected_revision_checked := true;
          v_reused_response := v_existing_occurrence.result_payload;
          continue;
        end if;

        if p_expected_revision <> 0 then
          raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
        end if;
        v_expected_revision_checked := true;

        if exists(select 1 from public.amv2_workout_days
          where owner_user_id=v_owner and workout_date=v_destination) then
          raise exception using errcode='22023',message='AMV2_IMPORT_DESTINATION_EXISTS';
        end if;

        perform public.amv2_replace_workout_day_graph(v_owner,0,v_day);
        v_applied_dates := array_append(v_applied_dates,v_destination);
        select coalesce(array_agg(value->'reference'->>'exerciseKey' order by value->>'orderIndex'),'{}')
          into v_canonical_keys
        from jsonb_array_elements(coalesce(v_day->'exercises','[]'::jsonb))
        where value->'reference'->>'source'='canonical';
        select coalesce(array_agg(value->'reference'->>'personalExerciseId' order by value->>'orderIndex'),'{}')
          into v_personal_ids
        from jsonb_array_elements(coalesce(v_day->'exercises','[]'::jsonb))
        where value->'reference'->>'source'='personal';
        insert into public.amv2_import_occurrences(
          owner_user_id,source,source_definition_identity,source_occurrence_identity,
          destination_date,destination_client_key,batch_key,operation_key,request_hash,
          resulting_canonical_keys,resulting_personal_ids
        ) values (
          v_owner,v_source,v_definition_identity,v_occurrence_identity,v_destination,
          v_day->>'clientKey',p_payload->>'batchKey',p_operation_key,v_occurrence_hash,
          v_canonical_keys,v_personal_ids
        );
      end loop;
      update public.amv2_import_batches set imported_dates=v_dates
      where owner_user_id=v_owner and batch_key=p_payload->>'batchKey';
      v_domain_changed := cardinality(v_applied_dates) > 0;
    end if;

    if not v_expected_revision_checked then
      raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT';
    end if;

    if not v_domain_changed and v_reused_response is not null then
      -- A new batch key is merely a new delivery attempt for an already
      -- imported occurrence. Do not retain an empty duplicate batch; persist a
      -- receipt for the new operation that reuses the exact prior result.
      delete from public.amv2_import_batches
      where owner_user_id=v_owner and batch_key=p_payload->>'batchKey'
        and not exists (
          select 1 from public.amv2_import_occurrences occurrence
          where occurrence.owner_user_id=v_owner
            and occurrence.batch_key=p_payload->>'batchKey'
        );
      insert into public.amv2_operation_receipts(
        owner_user_id,operation_key,operation_type,request_payload,response_payload,request_hash
      ) values(v_owner,p_operation_key,p_operation_type,v_request,v_reused_response,v_request_hash);
      return v_reused_response;
    end if;

    v_response := jsonb_build_object(
      'remoteIdentity','import:'||v_occurrence_identity,
      'revision',1,
      'dates',to_jsonb(v_dates),
      'appliedDates',to_jsonb(v_applied_dates)
    );
    insert into public.amv2_operation_receipts(
      owner_user_id,operation_key,operation_type,request_payload,response_payload,request_hash
    ) values(v_owner,p_operation_key,p_operation_type,v_request,v_response,v_request_hash);
  end if;

  insert into public.amv2_owner_sync_state(owner_user_id,history_revision,updated_at)
  values(v_owner,case when v_domain_changed then 1 else 0 end,now())
  on conflict(owner_user_id) do update
  set history_revision=public.amv2_owner_sync_state.history_revision
      + case when v_domain_changed then 1 else 0 end,
      updated_at=case when v_domain_changed then now() else public.amv2_owner_sync_state.updated_at end
  returning history_revision into v_snapshot_revision;

  v_response := jsonb_set(v_response,'{snapshotRevision}',to_jsonb(v_snapshot_revision),true);
  update public.amv2_operation_receipts
  set request_hash=v_request_hash,response_payload=v_response
  where owner_user_id=v_owner and operation_key=p_operation_key;
  if p_operation_type='import_days' then
    update public.amv2_import_occurrences
    set result_payload=v_response
    where owner_user_id=v_owner and batch_key=p_payload->>'batchKey'
      and operation_key=p_operation_key;
  end if;
  return v_response;
end $$;

create or replace function public.amv2_read_calendar(p_from date,p_to date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_from > p_to or p_to-p_from > 366 then
    raise exception using errcode='22023',message='AMV2_DATE_RANGE_INVALID';
  end if;
  return jsonb_build_object(
    'snapshotRevision',coalesce((select state.history_revision
      from public.amv2_owner_sync_state state),0),
    'days',coalesce((select jsonb_agg(to_jsonb(day)-'owner_user_id' order by day.workout_date)
      from public.amv2_workout_days day where day.workout_date between p_from and p_to),'[]'::jsonb),
    'exercises',coalesce((select jsonb_agg(to_jsonb(exercise)-'owner_user_id'
      order by exercise.workout_date,exercise.order_index)
      from public.amv2_workout_day_exercises exercise
      where exercise.workout_date between p_from and p_to),'[]'::jsonb),
    'sets',coalesce((select jsonb_agg(to_jsonb(item)-'owner_user_id'
      order by item.workout_date,item.exercise_client_key,item.order_index)
      from public.amv2_workout_day_sets item
      where item.workout_date between p_from and p_to),'[]'::jsonb),
    'tombstones',coalesce((select jsonb_agg(to_jsonb(marker)-'owner_user_id' order by marker.workout_date)
      from public.amv2_workout_day_tombstones marker
      where marker.workout_date between p_from and p_to),'[]'::jsonb),
    'personalExercises',coalesce((select jsonb_agg(jsonb_build_object(
      'id',personal.id,'client_key',personal.client_key,'name',personal.name,
      'template_exercise_key',personal.template_exercise_key,'category',personal.category,
      'location',personal.location,'metric_type',personal.metric_type,'revision',personal.revision,
      'archived_at',personal.archived_at,'created_at',personal.created_at,'updated_at',personal.updated_at
    ) order by personal.created_at) from public.amv2_personal_exercises personal),'[]'::jsonb)
  );
end $$;

create or replace function public.amv2_read_history_page(
  p_before date default null,
  p_limit integer default 3,
  p_snapshot_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_snapshot_revision bigint;
  v_candidates date[];
  v_dates date[];
  v_has_more boolean;
  v_next_cursor date;
begin
  if v_owner is null then
    raise exception using errcode='28000',message='AMV2_AUTH_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 3
    or (p_snapshot_revision is not null and p_snapshot_revision < 0) then
    raise exception using errcode='22023',message='AMV2_HISTORY_CURSOR_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('amv2-owner-history:'||v_owner::text,0)
  );
  select history_revision into v_snapshot_revision
  from public.amv2_owner_sync_state
  where owner_user_id=v_owner;
  v_snapshot_revision := coalesce(v_snapshot_revision,0);
  if p_snapshot_revision is not null and p_snapshot_revision <> v_snapshot_revision then
    raise exception using errcode='40001',message='AMV2_SNAPSHOT_REVISION_CHANGED';
  end if;

  select coalesce(array_agg(candidate.workout_date order by candidate.workout_date desc),'{}')
    into v_candidates
  from (
    select dates.workout_date
    from (
      select workout_date from public.amv2_workout_days
      where owner_user_id=v_owner and (p_before is null or workout_date < p_before)
      union
      select workout_date from public.amv2_workout_day_tombstones
      where owner_user_id=v_owner and (p_before is null or workout_date < p_before)
    ) dates
    order by dates.workout_date desc
    limit p_limit+1
  ) candidate;

  v_has_more := cardinality(v_candidates) > p_limit;
  v_dates := coalesce(v_candidates[1:least(cardinality(v_candidates),p_limit)],'{}'::date[]);
  if v_has_more and cardinality(v_dates) > 0 then
    v_next_cursor := v_dates[cardinality(v_dates)];
  end if;

  return jsonb_build_object(
    'snapshotRevision',v_snapshot_revision,
    'hasMore',v_has_more,
    'nextCursor',v_next_cursor,
    'pageNewest',case when cardinality(v_dates)>0 then v_dates[1] else null end,
    'pageOldest',case when cardinality(v_dates)>0 then v_dates[cardinality(v_dates)] else null end,
    'days',coalesce((select jsonb_agg(to_jsonb(day)-'owner_user_id' order by day.workout_date desc)
      from public.amv2_workout_days day
      where day.owner_user_id=v_owner and day.workout_date=any(v_dates)),'[]'::jsonb),
    'exercises',coalesce((select jsonb_agg(to_jsonb(exercise)-'owner_user_id'
      order by exercise.workout_date desc,exercise.order_index)
      from public.amv2_workout_day_exercises exercise
      where exercise.owner_user_id=v_owner and exercise.workout_date=any(v_dates)),'[]'::jsonb),
    'sets',coalesce((select jsonb_agg(to_jsonb(item)-'owner_user_id'
      order by item.workout_date desc,item.exercise_client_key,item.order_index)
      from public.amv2_workout_day_sets item
      where item.owner_user_id=v_owner and item.workout_date=any(v_dates)),'[]'::jsonb),
    'tombstones',coalesce((select jsonb_agg(to_jsonb(marker)-'owner_user_id' order by marker.workout_date desc)
      from public.amv2_workout_day_tombstones marker
      where marker.owner_user_id=v_owner and marker.workout_date=any(v_dates)),'[]'::jsonb),
    -- The selected-month calendar read already hydrates the complete owner
    -- definition catalog. Repeating definitions in every history page would
    -- consume the bounded graph payload without improving historical fidelity.
    'personalExercises','[]'::jsonb
  );
end $$;

revoke all on function public.amv2_apply_operation(text,text,bigint,jsonb) from public,anon;
grant execute on function public.amv2_apply_operation(text,text,bigint,jsonb) to authenticated;
revoke all on function public.amv2_read_calendar(date,date) from public,anon;
grant execute on function public.amv2_read_calendar(date,date) to authenticated;
revoke all on function public.amv2_read_history_page(date,integer,bigint) from public,anon;
grant execute on function public.amv2_read_history_page(date,integer,bigint) to authenticated;

commit;
