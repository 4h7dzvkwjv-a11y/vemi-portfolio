begin;

-- CP219R4 intentionally hardens only the complete, known AMV2 object set.
-- Abort instead of silently leaving a newly introduced object with inherited
-- privileges or an unreviewed ownership policy.
do $guard$
declare
  v_missing text[];
  v_unexpected text[];
begin
  if not exists (select 1 from pg_roles where rolname = 'postgres')
    or not exists (select 1 from pg_roles where rolname = 'anon')
    or not exists (select 1 from pg_roles where rolname = 'authenticated')
    or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception using errcode = '55000', message = 'AMV2_R4_REQUIRED_ROLE_MISSING';
  end if;

  select array_agg(required.name order by required.name) into v_missing
  from (values
    ('amv2_artifact_registry'),
    ('amv2_canonical_exercises'),
    ('amv2_import_batches'),
    ('amv2_import_occurrences'),
    ('amv2_operation_receipts'),
    ('amv2_owner_sync_state'),
    ('amv2_personal_exercises'),
    ('amv2_workout_day_exercises'),
    ('amv2_workout_day_sets'),
    ('amv2_workout_day_tombstones'),
    ('amv2_workout_days')
  ) required(name)
  where not exists (
    select 1
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = required.name
      and class.relkind in ('r','p')
  );
  if v_missing is not null then
    raise exception using errcode = '55000',
      message = 'AMV2_R4_REQUIRED_TABLE_MISSING', detail = array_to_string(v_missing, ',');
  end if;

  select array_agg(class.relname order by class.relname) into v_unexpected
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relkind in ('r','p','v','m','f')
    and class.relname like 'amv2\_%' escape '\'
    and not (
      class.relkind in ('r','p')
      and class.relname in (
        'amv2_artifact_registry','amv2_canonical_exercises','amv2_import_batches',
        'amv2_import_occurrences','amv2_operation_receipts','amv2_owner_sync_state',
        'amv2_personal_exercises','amv2_workout_day_exercises','amv2_workout_day_sets',
        'amv2_workout_day_tombstones','amv2_workout_days'
      )
    );
  if v_unexpected is not null then
    raise exception using errcode = '55000',
      message = 'AMV2_R4_UNREVIEWED_RELATION', detail = array_to_string(v_unexpected, ',');
  end if;

  select array_agg(class.relname order by class.relname) into v_unexpected
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relkind = 'S'
    and class.relname like 'amv2\_%' escape '\';
  if v_unexpected is not null then
    raise exception using errcode = '55000',
      message = 'AMV2_R4_UNREVIEWED_SEQUENCE', detail = array_to_string(v_unexpected, ',');
  end if;

  select array_agg(function.oid::regprocedure::text order by function.oid::regprocedure::text)
    into v_unexpected
  from pg_proc function
  join pg_namespace namespace on namespace.oid = function.pronamespace
  where namespace.nspname = 'public'
    and function.proname like 'amv2\_%' escape '\'
    and function.oid not in (
      'public.amv2_apply_operation(text,text,bigint,jsonb)'::regprocedure,
      'public.amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)'::regprocedure,
      'public.amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)'::regprocedure,
      'public.amv2_read_calendar(date,date)'::regprocedure,
      'public.amv2_read_history_page(date,integer,bigint)'::regprocedure,
      'public.amv2_replace_workout_day_graph(uuid,bigint,jsonb)'::regprocedure,
      'public.amv2_replace_workout_day_graph_cp219r1_base(uuid,bigint,jsonb)'::regprocedure,
      'public.amv2_validate_day_exercise_row()'::regprocedure,
      'public.amv2_validate_personal_exercise_row()'::regprocedure,
      'public.amv2_validate_set_row()'::regprocedure
    );
  if v_unexpected is not null then
    raise exception using errcode = '55000',
      message = 'AMV2_R4_UNREVIEWED_FUNCTION', detail = array_to_string(v_unexpected, ',');
  end if;

  if not exists (
    select 1
    from pg_proc function
    where function.oid = to_regprocedure('public.rls_auto_enable()')
      and function.proowner = 'postgres'::regrole
      and function.prosecdef
      and function.proconfig = array['search_path=pg_catalog']::text[]
  ) then
    raise exception using errcode = '55000', message = 'AMV2_R4_RLS_AUTOMATION_CONTRACT_INVALID';
  end if;
  if not exists (
    select 1 from pg_event_trigger
    where evtname = 'ensure_rls' and evtfoid = 'public.rls_auto_enable()'::regprocedure
      and evtenabled in ('O','A')
      and evtevent = 'ddl_command_end'
      and evttags @> array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
      and array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[] @> evttags
  ) then
    raise exception using errcode = '55000', message = 'AMV2_R4_RLS_EVENT_TRIGGER_INVALID';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.amv2_workout_day_exercises'::regclass
      and constraint_row.conname = 'amv2_workout_day_exercises_owner_user_id_personal_exercise_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.amv2_personal_exercises'::regclass
      and pg_get_constraintdef(constraint_row.oid)
        like 'FOREIGN KEY (owner_user_id, personal_exercise_id) REFERENCES amv2_personal_exercises(owner_user_id, id)%'
  ) then
    raise exception using errcode = '55000', message = 'AMV2_R4_PERSONAL_HISTORY_FK_UNEXPECTED';
  end if;
  if to_regclass('public.amv2_day_exercises_personal_history_idx') is null then
    raise exception using errcode = '55000', message = 'AMV2_R4_PERSONAL_HISTORY_INDEX_MISSING';
  end if;

  if exists (
    select 1 from public.amv2_personal_exercises
    where metric_type not in ('repetitions_weight','repetitions_only','time_per_set')
  ) then
    raise exception using errcode = '23514', message = 'AMV2_R4_INCOMPATIBLE_PERSONAL_METRIC_ROWS';
  end if;
end
$guard$;

-- Prove the reviewed event-trigger/function pair still performs its only
-- required behavior. The empty probe and its DROP are transaction-local to
-- this migration; a no-op or miswired SECURITY DEFINER function fails closed.
create table public.cp219r4_rls_contract_probe (probe boolean);
do $rls_behavior_guard$
begin
  if not exists (
    select 1
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'cp219r4_rls_contract_probe'
      and class.relrowsecurity
  ) then
    raise exception using errcode = '55000', message = 'AMV2_R4_RLS_AUTOMATION_BEHAVIOR_INVALID';
  end if;
end
$rls_behavior_guard$;
drop table public.cp219r4_rls_contract_probe;

-- Neutralize inherited/default privileges on every current AMV2 table. Do not
-- change public-schema default ACLs here: they also govern unrelated products.
revoke all on table public.amv2_artifact_registry from public, anon, authenticated, service_role;
revoke all on table public.amv2_canonical_exercises from public, anon, authenticated, service_role;
revoke all on table public.amv2_import_batches from public, anon, authenticated, service_role;
revoke all on table public.amv2_import_occurrences from public, anon, authenticated, service_role;
revoke all on table public.amv2_operation_receipts from public, anon, authenticated, service_role;
revoke all on table public.amv2_owner_sync_state from public, anon, authenticated, service_role;
revoke all on table public.amv2_personal_exercises from public, anon, authenticated, service_role;
revoke all on table public.amv2_workout_day_exercises from public, anon, authenticated, service_role;
revoke all on table public.amv2_workout_day_sets from public, anon, authenticated, service_role;
revoke all on table public.amv2_workout_day_tombstones from public, anon, authenticated, service_role;
revoke all on table public.amv2_workout_days from public, anon, authenticated, service_role;

grant select on table public.amv2_artifact_registry to authenticated;
grant select on table public.amv2_canonical_exercises to authenticated;
grant select on table public.amv2_owner_sync_state to authenticated;
grant select on table public.amv2_personal_exercises to authenticated;
grant select on table public.amv2_workout_day_exercises to authenticated;
grant select on table public.amv2_workout_day_sets to authenticated;
grant select on table public.amv2_workout_day_tombstones to authenticated;
grant select on table public.amv2_workout_days to authenticated;

-- Reference data is non-user-specific, but remains visible only to the role
-- already used by AMV2. Explicit policies make RLS behavior independent of
-- the event-trigger side effect that enabled RLS at table creation time.
alter table public.amv2_artifact_registry enable row level security;
alter table public.amv2_canonical_exercises enable row level security;
drop policy if exists amv2_artifact_authenticated_select on public.amv2_artifact_registry;
create policy amv2_artifact_authenticated_select
  on public.amv2_artifact_registry for select to authenticated using (true);
drop policy if exists amv2_canonical_authenticated_select on public.amv2_canonical_exercises;
create policy amv2_canonical_authenticated_select
  on public.amv2_canonical_exercises for select to authenticated using (true);

-- Event-trigger execution does not require clients to invoke its function.
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

revoke all on function public.amv2_apply_operation(text,text,bigint,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_read_calendar(date,date)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_read_history_page(date,integer,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.amv2_apply_operation(text,text,bigint,jsonb) to authenticated;
grant execute on function public.amv2_read_calendar(date,date) to authenticated;
grant execute on function public.amv2_read_history_page(date,integer,bigint) to authenticated;

revoke all on function public.amv2_apply_operation_cp219r1_base(text,text,bigint,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_apply_operation_cp219r2_base(text,text,bigint,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_replace_workout_day_graph(uuid,bigint,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_replace_workout_day_graph_cp219r1_base(uuid,bigint,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_validate_day_exercise_row()
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_validate_personal_exercise_row()
  from public, anon, authenticated, service_role;
revoke all on function public.amv2_validate_set_row()
  from public, anon, authenticated, service_role;

-- Preserve Personal history during auth.users cascading deletion by deferring
-- the cross-owner graph check until all owner-scoped cascades have completed.
alter table public.amv2_workout_day_exercises
  drop constraint amv2_workout_day_exercises_owner_user_id_personal_exercise_fkey;
alter table public.amv2_workout_day_exercises
  add constraint amv2_workout_day_exercises_owner_user_id_personal_exercise_fkey
  foreign key (owner_user_id, personal_exercise_id)
  references public.amv2_personal_exercises(owner_user_id, id)
  on delete no action
  deferrable initially deferred
  not valid;
alter table public.amv2_workout_day_exercises
  validate constraint amv2_workout_day_exercises_owner_user_id_personal_exercise_fkey;

-- Personal definitions intentionally map to only the three set-based editors.
-- Canonical VEMI exercises retain their existing fourth total_duration type.
alter table public.amv2_personal_exercises
  drop constraint if exists amv2_personal_exercises_metric_type_v1_check;
alter table public.amv2_personal_exercises
  add constraint amv2_personal_exercises_metric_type_v1_check
  check (metric_type in ('repetitions_weight','repetitions_only','time_per_set'))
  not valid;
alter table public.amv2_personal_exercises
  validate constraint amv2_personal_exercises_metric_type_v1_check;

commit;
