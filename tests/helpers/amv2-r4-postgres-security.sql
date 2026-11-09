\set ON_ERROR_STOP on

set role postgres;

delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
create temporary table r4_metric_probe (
  path text primary key,
  status text not null,
  sqlstate text not null,
  message text not null
);
insert into auth.users(id,raw_user_meta_data)
values (
  '44444444-4444-4444-8444-444444444444',
  '{"username":"r4_security_owner"}'
);

do $negative_paths$
begin
  begin
    insert into public.amv2_personal_exercises(
      owner_user_id,id,client_key,name,template_exercise_key,category,location,metric_type,
      default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,
      default_total_duration_seconds
    )
    select '44444444-4444-4444-8444-444444444444','r4-direct-total','r4-direct-total',
      'R4 direct total',exercise_key,category,locations[1],metric_type,default_sets,
      default_repetitions,default_weight_kg,default_time_per_set_seconds,
      default_total_duration_seconds
    from public.amv2_canonical_exercises
    where metric_type = 'total_duration'
    order by exercise_key
    limit 1;
    insert into r4_metric_probe values ('direct','unexpected_success','00000','');
  exception when others then
    insert into r4_metric_probe values ('direct','rejected',sqlstate,sqlerrm);
  end;

  perform set_config(
    'request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true
  );
  begin
    perform public.amv2_apply_operation(
      'r4-rpc-total','upsert_personal',0,
      '{"id":"r4-rpc-total","clientKey":"r4-rpc-total","name":"R4 RPC total","templateExerciseKey":"bicicleta-eliptica","category":"Cardio","location":"gym","metricType":"total_duration"}'::jsonb
    );
    insert into r4_metric_probe values ('rpc','unexpected_success','00000','');
  exception when others then
    insert into r4_metric_probe values ('rpc','rejected',sqlstate,sqlerrm);
  end;
end
$negative_paths$;

set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

select public.amv2_apply_operation(
  'r4-personal-create','upsert_personal',0,
  '{"id":"r4-personal","clientKey":"r4-personal","name":"R4 Personal","templateExerciseKey":"flotari","category":"Piept","location":"home","metricType":"repetitions_only"}'::jsonb
);

select public.amv2_apply_operation(
  'r4-personal-import','import_days',0,
  jsonb_build_object(
    'batchKey','r4-personal-batch',
    'source','v1_local',
    'sourceDefinitionIdentity','r4-personal-definition',
    'sourceOccurrenceIdentity','r4-personal-occurrence:2026-09-01',
    'destinationDate','2026-09-01',
    'days',jsonb_build_array(jsonb_build_object(
      'date','2026-09-01',
      'clientKey','r4-personal-day',
      'location','home',
      'exercises',jsonb_build_array(jsonb_build_object(
        'id','r4-personal-entry',
        'orderIndex',0,
        'reference',jsonb_build_object(
          'source','personal',
          'personalExerciseId','r4-personal',
          'templateExerciseKey','flotari'
        ),
        'displayName','R4 Personal',
        'category','Piept',
        'metricType','repetitions_only',
        'sets',jsonb_build_array(jsonb_build_object(
          'id','r4-personal-set','orderIndex',0,'targetRepetitions',10
        ))
      ))
    ))
  )
);

select public.amv2_apply_operation(
  'r4-canonical-total-import','import_days',0,
  jsonb_build_object(
    'batchKey','r4-canonical-total-batch',
    'source','v1_local',
    'sourceDefinitionIdentity','r4-canonical-total-definition',
    'sourceOccurrenceIdentity','r4-canonical-total-occurrence:2026-09-02',
    'destinationDate','2026-09-02',
    'days',jsonb_build_array(jsonb_build_object(
      'date','2026-09-02',
      'clientKey','r4-canonical-total-day',
      'location','gym',
      'exercises',jsonb_build_array(jsonb_build_object(
        'id','r4-canonical-total-entry',
        'orderIndex',0,
        'reference',jsonb_build_object(
          'source','canonical','exerciseKey',canonical.exercise_key
        ),
        'displayName',canonical.display_name,
        'category',canonical.category,
        'metricType',canonical.metric_type,
        'targetTotalDurationSeconds',120
      ))
    ))
  )
)
from public.amv2_canonical_exercises canonical
where canonical.exercise_key = 'bicicleta-eliptica';

select public.amv2_apply_operation(
  'r4-tombstone-upsert','upsert_day',0,
  '{"date":"2026-09-03","clientKey":"r4-tombstone-day","location":"home","exercises":[{"id":"r4-tombstone-entry","orderIndex":0,"reference":{"source":"canonical","exerciseKey":"flotari"},"displayName":"Flotări","category":"Piept","metricType":"repetitions_only","sets":[{"id":"r4-tombstone-set","orderIndex":0,"targetRepetitions":8}]}]}'::jsonb
);
select public.amv2_apply_operation(
  'r4-tombstone-delete','delete_day',1,'{"date":"2026-09-03"}'::jsonb
);

reset request.jwt.claim.sub;

do $verify_before_delete$
begin
  if (select count(*) from r4_metric_probe where status = 'rejected') <> 2 then
    raise exception 'R4 metric rejection probe failed';
  end if;
  if (select count(*) from public.amv2_personal_exercises
      where owner_user_id = '44444444-4444-4444-8444-444444444444') <> 1 then
    raise exception 'R4 allowed Personal definition did not persist';
  end if;
  if (select array_agg(metric_type order by workout_date)
      from public.amv2_workout_day_exercises
      where owner_user_id = '44444444-4444-4444-8444-444444444444')
      is distinct from array['repetitions_only','total_duration']::text[] then
    raise exception 'R4 Personal/canonical import metric preservation failed';
  end if;
  if not exists (
    select 1 from public.amv2_workout_day_tombstones
    where owner_user_id = '44444444-4444-4444-8444-444444444444'
      and workout_date = '2026-09-03'
  ) then
    raise exception 'R4 tombstone setup failed';
  end if;
end
$verify_before_delete$;

select json_build_object(
  'metric_rejections',(select json_agg(row_to_json(probe) order by path)
    from r4_metric_probe probe),
  'personal_rows',(select count(*) from public.amv2_personal_exercises
    where owner_user_id = '44444444-4444-4444-8444-444444444444'),
  'metric_types',(select json_agg(metric_type order by workout_date)
    from public.amv2_workout_day_exercises
    where owner_user_id = '44444444-4444-4444-8444-444444444444'),
  'canonical_total_types',(select count(*) from public.amv2_canonical_exercises
    where metric_type = 'total_duration')
)::text;

delete from auth.users where id = '44444444-4444-4444-8444-444444444444';

do $verify_cascade$
begin
  if exists (
    select 1 from public.amv2_personal_exercises
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_workout_days
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_workout_day_exercises
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_workout_day_sets
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_operation_receipts
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_import_batches
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_import_occurrences
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_owner_sync_state
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
    union all select 1 from public.amv2_workout_day_tombstones
      where owner_user_id = '44444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'R4 owner cascade left AMV2 rows behind';
  end if;
end
$verify_cascade$;

select json_build_object('account_delete_full_graph','PASS')::text;
