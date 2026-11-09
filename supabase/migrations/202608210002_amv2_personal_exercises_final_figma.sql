begin;

alter table public.amv2_workout_day_exercises
  add column if not exists personal_template_exercise_key text
  references public.amv2_canonical_exercises(exercise_key) on delete restrict;

update public.amv2_workout_day_exercises day_exercise
set personal_template_exercise_key = personal.template_exercise_key
from public.amv2_personal_exercises personal
where day_exercise.personal_exercise_id is not null
  and day_exercise.personal_template_exercise_key is null
  and personal.owner_user_id = day_exercise.owner_user_id
  and personal.id = day_exercise.personal_exercise_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'amv2_personal_category_allowed'
  ) then
    alter table public.amv2_personal_exercises
      add constraint amv2_personal_category_allowed
      check (category in ('Piept','Spate','Umeri','Biceps','Triceps','Picioare','Abdomen','Cardio','Acasă'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'amv2_personal_snapshot_template_shape'
  ) then
    alter table public.amv2_workout_day_exercises
      add constraint amv2_personal_snapshot_template_shape check (
        (personal_exercise_id is null and personal_template_exercise_key is null)
        or (personal_exercise_id is not null and personal_template_exercise_key is not null)
      );
  end if;
end $$;

create or replace function public.amv2_validate_personal_exercise_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_template public.amv2_canonical_exercises%rowtype;
begin
  select * into strict v_template from public.amv2_canonical_exercises
  where exercise_key = new.template_exercise_key;
  if new.category not in ('Piept','Spate','Umeri','Biceps','Triceps','Picioare','Abdomen','Cardio','Acasă')
    or new.metric_type <> v_template.metric_type
    or not (v_template.locations @> array[new.location]::text[])
    or new.default_sets is distinct from v_template.default_sets
    or new.default_repetitions is distinct from v_template.default_repetitions
    or new.default_weight_kg is distinct from v_template.default_weight_kg
    or new.default_time_per_set_seconds is distinct from v_template.default_time_per_set_seconds
    or new.default_total_duration_seconds is distinct from v_template.default_total_duration_seconds then
    raise exception using errcode = '23514', message = 'AMV2 personal exercise category or canonical metric/default matrix is invalid';
  end if;
  return new;
end $$;

create or replace function public.amv2_validate_day_exercise_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_metric text; v_category text; v_name text; v_exists boolean;
begin
  if new.canonical_exercise_key is not null then
    select metric_type,category,display_name into strict v_metric,v_category,v_name
    from public.amv2_canonical_exercises where exercise_key = new.canonical_exercise_key;
    if new.display_name <> v_name or new.category <> v_category or new.metric_type <> v_metric
      or new.personal_template_exercise_key is not null then
      raise exception using errcode = '23514', message = 'AMV2 canonical exercise presentation override forbidden';
    end if;
  else
    select exists(select 1 from public.amv2_personal_exercises
      where owner_user_id = new.owner_user_id and id = new.personal_exercise_id) into v_exists;
    if not v_exists then
      raise exception using errcode = '23503', message = 'AMV2 personal exercise owner relationship is invalid';
    end if;
    select metric_type into strict v_metric from public.amv2_canonical_exercises
    where exercise_key = new.personal_template_exercise_key;
    if new.metric_type <> v_metric
      or new.category not in ('Piept','Spate','Umeri','Biceps','Triceps','Picioare','Abdomen','Cardio','Acasă')
      or nullif(btrim(new.display_name),'') is null then
      raise exception using errcode = '23514', message = 'AMV2 personal snapshot metric/category is invalid';
    end if;
  end if;
  return new;
end $$;

create or replace function public.amv2_replace_workout_day_graph(p_owner uuid,p_expected_revision bigint,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_date date; v_location text; v_client_key text; v_current bigint; v_next bigint; v_created timestamptz;
  v_count integer; v_item record; v_set record; v_reference jsonb; v_source text;
  v_key text; v_personal_id text; v_metric text; v_name text; v_category text; v_set_count integer;
  v_archived_at timestamptz; v_exists boolean; v_personal_template text;
  v_existing_personal_ids text[] := '{}'; v_existing_personal_snapshots jsonb := '{}'::jsonb; v_snapshot jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ?& array['date','clientKey','location','exercises'])
    or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('date','clientKey','location','exercises')) then
    raise exception using errcode='22023',message='AMV2_WORKOUT_DAY_FIELDS_INVALID';
  end if;
  v_date := (p_payload->>'date')::date;
  v_location := p_payload->>'location';
  v_client_key := p_payload->>'clientKey';
  if v_location not in ('home','gym') or nullif(btrim(v_client_key),'') is null then
    raise exception using errcode='22023',message='INVALID_WORKOUT_DAY';
  end if;
  if jsonb_typeof(p_payload->'exercises') <> 'array' then
    raise exception using errcode='22023',message='INVALID_WORKOUT_DAY_EXERCISES';
  end if;
  v_count := jsonb_array_length(p_payload->'exercises');
  if v_count not between 1 and 10 then raise exception using errcode='22023',message='WORKOUT_DAY_CAPACITY'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || v_date::text,0));
  select revision,created_at into v_current,v_created from public.amv2_workout_days
  where owner_user_id=p_owner and workout_date=v_date for update;
  v_exists := found;
  select
    coalesce(array_agg(personal_exercise_id) filter (where personal_exercise_id is not null),'{}'),
    coalesce(jsonb_object_agg(personal_exercise_id,jsonb_build_object(
      'templateExerciseKey',personal_template_exercise_key,
      'displayName',display_name,
      'category',category,
      'metricType',metric_type
    )) filter (where personal_exercise_id is not null),'{}'::jsonb)
  into v_existing_personal_ids,v_existing_personal_snapshots
  from public.amv2_workout_day_exercises where owner_user_id=p_owner and workout_date=v_date;

  if v_exists then
    if v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
    v_next := v_current + 1;
    update public.amv2_workout_days set location=v_location,revision=v_next,updated_at=now()
    where owner_user_id=p_owner and workout_date=v_date;
    delete from public.amv2_workout_day_exercises where owner_user_id=p_owner and workout_date=v_date;
  else
    if p_expected_revision <> 0 then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
    v_next := 1;
    insert into public.amv2_workout_days(owner_user_id,workout_date,client_key,location,revision)
    values(p_owner,v_date,v_client_key,v_location,v_next);
  end if;

  for v_item in select value,ordinality-1 as idx from jsonb_array_elements(p_payload->'exercises') with ordinality loop
    if jsonb_typeof(v_item.value) <> 'object'
      or not (v_item.value ?& array['id','orderIndex','reference','displayName','category','metricType'])
      or nullif(btrim(v_item.value->>'id'),'') is null
      or exists(select 1 from jsonb_object_keys(v_item.value) key where key not in ('id','orderIndex','reference','displayName','category','metricType','sets','targetTotalDurationSeconds'))
      or (v_item.value->>'orderIndex')::integer <> v_item.idx then
      raise exception using errcode='22023',message='AMV2_EXERCISE_FIELDS_INVALID';
    end if;
    v_reference := v_item.value->'reference';
    v_source := v_reference->>'source';
    v_key := null;
    v_personal_id := null;
    v_personal_template := null;

    if v_source='canonical' then
      if jsonb_typeof(v_reference) <> 'object' or not (v_reference ?& array['source','exerciseKey'])
        or exists(select 1 from jsonb_object_keys(v_reference) key where key not in ('source','exerciseKey')) then
        raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID';
      end if;
      v_key := v_reference->>'exerciseKey';
      select metric_type,display_name,category into strict v_metric,v_name,v_category
      from public.amv2_canonical_exercises where exercise_key=v_key;
      if (v_item.value->>'displayName') is distinct from v_name
        or (v_item.value->>'category') is distinct from v_category then
        raise exception using errcode='22023',message='AMV2_CANONICAL_PRESENTATION_OVERRIDE_FORBIDDEN';
      end if;
    elsif v_source='personal' then
      if jsonb_typeof(v_reference) <> 'object' or not (v_reference ?& array['source','personalExerciseId','templateExerciseKey'])
        or exists(select 1 from jsonb_object_keys(v_reference) key where key not in ('source','personalExerciseId','templateExerciseKey')) then
        raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID';
      end if;
      v_personal_id := v_reference->>'personalExerciseId';
      select metric_type,name,category,archived_at,template_exercise_key
      into strict v_metric,v_name,v_category,v_archived_at,v_personal_template
      from public.amv2_personal_exercises where owner_user_id=p_owner and id=v_personal_id;
      v_snapshot := v_existing_personal_snapshots->v_personal_id;
      if v_snapshot is not null then
        v_personal_template := v_snapshot->>'templateExerciseKey';
        v_name := v_snapshot->>'displayName';
        v_category := v_snapshot->>'category';
        v_metric := v_snapshot->>'metricType';
      elsif v_archived_at is not null then
        raise exception using errcode='22023',message='AMV2_PERSONAL_EXERCISE_ARCHIVED';
      end if;
      if (v_reference->>'templateExerciseKey') is distinct from v_personal_template
        or (v_item.value->>'displayName') is distinct from v_name
        or (v_item.value->>'category') is distinct from v_category
        or (v_item.value->>'metricType') is distinct from v_metric then
        raise exception using errcode='22023',message='AMV2_PERSONAL_SNAPSHOT_OVERRIDE_FORBIDDEN';
      end if;
    else
      raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID';
    end if;

    if (v_item.value->>'metricType') is distinct from v_metric then
      raise exception using errcode='22023',message='AMV2_METRIC_OVERRIDE_FORBIDDEN';
    end if;
    insert into public.amv2_workout_day_exercises(
      owner_user_id,workout_date,client_key,order_index,canonical_exercise_key,personal_exercise_id,
      personal_template_exercise_key,display_name,category,metric_type,total_duration_seconds
    ) values (
      p_owner,v_date,v_item.value->>'id',v_item.idx,v_key,v_personal_id,v_personal_template,
      v_name,v_category,v_metric,
      case when v_metric='total_duration' then (v_item.value->>'targetTotalDurationSeconds')::integer else null end
    );

    if v_metric='total_duration' then
      if not (v_item.value ? 'targetTotalDurationSeconds') or v_item.value ? 'sets' then
        raise exception using errcode='22023',message='AMV2_TOTAL_DURATION_SHAPE_INVALID';
      end if;
    else
      if v_item.value ? 'targetTotalDurationSeconds' then
        raise exception using errcode='22023',message='AMV2_SET_METRIC_HAS_TOTAL_DURATION';
      end if;
      if jsonb_typeof(v_item.value->'sets') <> 'array' then raise exception using errcode='22023',message='AMV2_SETS_REQUIRED'; end if;
      v_set_count := jsonb_array_length(v_item.value->'sets');
      if v_set_count not between 1 and 20 then raise exception using errcode='22023',message='AMV2_SET_CAPACITY'; end if;
      for v_set in select value,ordinality-1 as idx from jsonb_array_elements(v_item.value->'sets') with ordinality loop
        if jsonb_typeof(v_set.value) <> 'object'
          or not (v_set.value ?& array['id','orderIndex'])
          or nullif(btrim(v_set.value->>'id'),'') is null
          or exists(select 1 from jsonb_object_keys(v_set.value) key where key not in ('id','orderIndex','targetRepetitions','targetWeightKg','targetDurationSeconds'))
          or (v_set.value->>'orderIndex')::integer <> v_set.idx then
          raise exception using errcode='22023',message='AMV2_SET_FIELDS_INVALID';
        end if;
        if (v_metric='repetitions_weight' and not (v_set.value ?& array['targetRepetitions','targetWeightKg']))
          or (v_metric='repetitions_only' and not (v_set.value ? 'targetRepetitions'))
          or (v_metric='time_per_set' and not (v_set.value ? 'targetDurationSeconds')) then
          raise exception using errcode='22023',message='AMV2_SET_REQUIRED_VALUES_MISSING';
        end if;
        if (v_metric='repetitions_weight' and coalesce(jsonb_typeof(v_set.value->'targetDurationSeconds'),'null') <> 'null')
          or (v_metric='repetitions_only' and (coalesce(jsonb_typeof(v_set.value->'targetWeightKg'),'null') <> 'null' or coalesce(jsonb_typeof(v_set.value->'targetDurationSeconds'),'null') <> 'null'))
          or (v_metric='time_per_set' and (coalesce(jsonb_typeof(v_set.value->'targetRepetitions'),'null') <> 'null' or coalesce(jsonb_typeof(v_set.value->'targetWeightKg'),'null') <> 'null')) then
          raise exception using errcode='22023',message='AMV2_SET_INCOMPATIBLE_VALUE';
        end if;
        insert into public.amv2_workout_day_sets(
          owner_user_id,workout_date,exercise_client_key,client_key,order_index,repetitions,weight_kg,duration_seconds
        ) values (
          p_owner,v_date,v_item.value->>'id',v_set.value->>'id',v_set.idx,
          case when v_metric in ('repetitions_weight','repetitions_only') then (v_set.value->>'targetRepetitions')::smallint else null end,
          case when v_metric='repetitions_weight' then (v_set.value->>'targetWeightKg')::numeric else null end,
          case when v_metric='time_per_set' then (v_set.value->>'targetDurationSeconds')::integer else null end
        );
      end loop;
    end if;
  end loop;
  return jsonb_build_object('remoteIdentity','day:'||v_date::text,'revision',v_next,'date',v_date);
end $$;

create or replace function public.amv2_apply_operation(
  p_operation_key text,p_operation_type text,p_expected_revision bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_request jsonb; v_previous record; v_response jsonb;
  v_template public.amv2_canonical_exercises%rowtype; v_current bigint; v_item jsonb; v_dates date[] := '{}';
  v_existing_client_key text; v_existing_archived_at timestamptz;
begin
  if v_owner is null then raise exception using errcode='28000',message='AMV2_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception using errcode='22023',message='AMV2_PAYLOAD_INVALID'; end if;
  if pg_column_size(p_payload) > 524288 then raise exception using errcode='54000',message='AMV2_PAYLOAD_TOO_LARGE'; end if;
  if nullif(btrim(p_operation_key),'') is null or char_length(p_operation_key) > 160 or p_expected_revision < 0
    or p_operation_type not in ('upsert_day','delete_day','upsert_personal','archive_personal','import_days') then
    raise exception using errcode='22023',message='AMV2_OPERATION_INVALID';
  end if;
  v_request := jsonb_build_object('type',p_operation_type,'expectedRevision',p_expected_revision,'payload',p_payload);
  select request_payload,response_payload into v_previous from public.amv2_operation_receipts
  where owner_user_id=v_owner and operation_key=p_operation_key;
  if found then
    if v_previous.request_payload <> v_request then raise exception using errcode='23505',message='AMV2_IDEMPOTENCY_KEY_REUSED'; end if;
    return v_previous.response_payload;
  end if;

  if p_operation_type='upsert_day' then
    v_response := public.amv2_replace_workout_day_graph(v_owner,p_expected_revision,p_payload);
  elsif p_operation_type='delete_day' then
    if not (p_payload ? 'date') or exists(select 1 from jsonb_object_keys(p_payload) key where key <> 'date') then
      raise exception using errcode='22023',message='AMV2_DELETE_DAY_PAYLOAD_INVALID';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||(p_payload->>'date'),0));
    select revision into v_current from public.amv2_workout_days
    where owner_user_id=v_owner and workout_date=(p_payload->>'date')::date for update;
    if not found or v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
    delete from public.amv2_workout_days where owner_user_id=v_owner and workout_date=(p_payload->>'date')::date;
    v_response := jsonb_build_object('remoteIdentity','day:'||(p_payload->>'date'),'revision',v_current+1,'deleted',true);
  elsif p_operation_type='upsert_personal' then
    if not (p_payload ?& array['id','clientKey','name','templateExerciseKey','category','location','metricType'])
      or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('id','clientKey','name','templateExerciseKey','category','location','metricType')) then
      raise exception using errcode='22023',message='AMV2_PERSONAL_PAYLOAD_INVALID';
    end if;
    if p_payload->>'category' not in ('Piept','Spate','Umeri','Biceps','Triceps','Picioare','Abdomen','Cardio','Acasă')
      or p_payload->>'metricType' not in ('repetitions_weight','repetitions_only','time_per_set') then
      raise exception using errcode='22023',message='AMV2_PERSONAL_SELECTION_INVALID';
    end if;
    select * into strict v_template from public.amv2_canonical_exercises
    where exercise_key=p_payload->>'templateExerciseKey';
    if v_template.metric_type is distinct from (p_payload->>'metricType')
      or not (v_template.locations @> array[p_payload->>'location']::text[]) then
      raise exception using errcode='22023',message='AMV2_PERSONAL_TEMPLATE_INCOMPATIBLE';
    end if;
    select revision,client_key,archived_at into v_current,v_existing_client_key,v_existing_archived_at
    from public.amv2_personal_exercises where owner_user_id=v_owner and id=p_payload->>'id' for update;
    if found then
      if v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
      if v_existing_archived_at is not null then raise exception using errcode='55000',message='AMV2_PERSONAL_ARCHIVED'; end if;
      if v_existing_client_key is distinct from (p_payload->>'clientKey') then
        raise exception using errcode='22023',message='AMV2_PERSONAL_CLIENT_IDENTITY_OVERRIDE_FORBIDDEN';
      end if;
      update public.amv2_personal_exercises set
        name=p_payload->>'name',template_exercise_key=v_template.exercise_key,
        category=p_payload->>'category',location=p_payload->>'location',metric_type=v_template.metric_type,
        default_sets=v_template.default_sets,default_repetitions=v_template.default_repetitions,
        default_weight_kg=v_template.default_weight_kg,default_time_per_set_seconds=v_template.default_time_per_set_seconds,
        default_total_duration_seconds=v_template.default_total_duration_seconds,
        revision=v_current+1,updated_at=now()
      where owner_user_id=v_owner and id=p_payload->>'id';
      v_current := v_current+1;
    else
      if p_expected_revision <> 0 then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
      insert into public.amv2_personal_exercises(
        owner_user_id,id,client_key,name,template_exercise_key,category,location,metric_type,
        default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,default_total_duration_seconds
      ) values (
        v_owner,p_payload->>'id',p_payload->>'clientKey',p_payload->>'name',v_template.exercise_key,
        p_payload->>'category',p_payload->>'location',v_template.metric_type,
        v_template.default_sets,v_template.default_repetitions,v_template.default_weight_kg,
        v_template.default_time_per_set_seconds,v_template.default_total_duration_seconds
      );
      v_current := 1;
    end if;
    v_response := jsonb_build_object('remoteIdentity','personal:'||(p_payload->>'id'),'revision',v_current);
  elsif p_operation_type='archive_personal' then
    if not (p_payload ? 'id') or exists(select 1 from jsonb_object_keys(p_payload) key where key <> 'id') then
      raise exception using errcode='22023',message='AMV2_ARCHIVE_PAYLOAD_INVALID';
    end if;
    select revision,archived_at into v_current,v_existing_archived_at from public.amv2_personal_exercises
    where owner_user_id=v_owner and id=p_payload->>'id' for update;
    if not found or v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
    if v_existing_archived_at is not null then raise exception using errcode='55000',message='AMV2_PERSONAL_ARCHIVED'; end if;
    update public.amv2_personal_exercises set archived_at=now(),revision=v_current+1,updated_at=now()
    where owner_user_id=v_owner and id=p_payload->>'id';
    v_response := jsonb_build_object('remoteIdentity','personal:'||(p_payload->>'id'),'revision',v_current+1,'archived',true);
  else
    if not (p_payload ?& array['batchKey','source','sourceIdentity','days'])
      or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('batchKey','source','sourceIdentity','days'))
      or p_expected_revision <> 0 or jsonb_typeof(p_payload->'days') <> 'array' or jsonb_array_length(p_payload->'days')=0 then
      raise exception using errcode='22023',message='AMV2_IMPORT_INVALID';
    end if;
    if exists(select 1 from public.amv2_import_batches where owner_user_id=v_owner and batch_key=p_payload->>'batchKey') then
      raise exception using errcode='23505',message='AMV2_IMPORT_BATCH_REUSED';
    end if;
    for v_item in select value from jsonb_array_elements(p_payload->'days') loop
      if exists(select 1 from public.amv2_workout_days where owner_user_id=v_owner and workout_date=(v_item->>'date')::date) then
        raise exception using errcode='23505',message='AMV2_IMPORT_DESTINATION_EXISTS';
      end if;
      perform public.amv2_replace_workout_day_graph(v_owner,0,v_item);
      v_dates := array_append(v_dates,(v_item->>'date')::date);
    end loop;
    insert into public.amv2_import_batches(owner_user_id,batch_key,source,source_identity,payload,imported_dates)
    values(v_owner,p_payload->>'batchKey',p_payload->>'source',p_payload->>'sourceIdentity',p_payload,v_dates);
    v_response := jsonb_build_object('remoteIdentity','import:'||(p_payload->>'batchKey'),'revision',1,'dates',to_jsonb(v_dates));
  end if;
  delete from public.amv2_operation_receipts where owner_user_id=v_owner and created_at < now()-interval '90 days';
  insert into public.amv2_operation_receipts(owner_user_id,operation_key,operation_type,request_payload,response_payload)
  values(v_owner,p_operation_key,p_operation_type,v_request,v_response);
  return v_response;
end $$;

revoke all on function public.amv2_apply_operation(text,text,bigint,jsonb) from public,anon;
grant execute on function public.amv2_apply_operation(text,text,bigint,jsonb) to authenticated;
revoke all on function public.amv2_validate_personal_exercise_row(),public.amv2_validate_day_exercise_row() from public,anon,authenticated;
revoke all on function public.amv2_replace_workout_day_graph(uuid,bigint,jsonb) from public;

commit;
