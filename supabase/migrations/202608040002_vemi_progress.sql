-- Modulul 2 VEMI: planuri gratuite, antrenamente proprii și jurnal de progres.
-- Se rulează după 202608040001_vemi_auth_profiles.sql.

create table public.user_free_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_key text not null,
  gender text,
  age_group text,
  goal text,
  program_level text,
  place text not null check (place in ('acasa', 'sala')),
  current_week smallint not null default 1 check (current_week between 1 and 4),
  current_day smallint not null default 1 check (current_day between 1 and 5),
  completed_workouts smallint not null default 0 check (completed_workouts >= 0),
  total_workouts smallint not null default 12 check (total_workouts > 0),
  started_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table public.custom_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_key text not null,
  name text not null check (char_length(name) between 1 and 100),
  place text not null check (place in ('acasa', 'sala')),
  completions integer not null default 0 check (completions >= 0),
  last_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_key),
  unique (id, user_id)
);

create table public.custom_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  client_key text not null,
  exercise_key text not null,
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null,
  exercise_kind text not null check (exercise_kind in ('forta', 'cardio')),
  places text[] not null default '{}',
  order_index smallint not null check (order_index >= 0),
  target_sets smallint not null default 0 check (target_sets >= 0),
  target_reps smallint not null default 0 check (target_reps >= 0),
  target_weight_kg numeric(7,2) not null default 0 check (target_weight_kg >= 0),
  target_duration_seconds integer not null default 0 check (target_duration_seconds >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workout_id, client_key),
  foreign key (workout_id, user_id)
    references public.custom_workouts(id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('free_plan', 'custom')),
  free_plan_id uuid,
  custom_workout_id uuid,
  workout_key text not null,
  workout_name text not null check (char_length(workout_name) between 1 and 120),
  week_number smallint check (week_number between 1 and 4),
  day_number smallint check (day_number between 1 and 7),
  place text not null check (place in ('acasa', 'sala')),
  status text not null default 'completed' check (status in ('planned', 'in_progress', 'completed')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (source = 'free_plan' and free_plan_id is not null and custom_workout_id is null)
    or (source = 'custom' and custom_workout_id is not null and free_plan_id is null)
  ),
  foreign key (free_plan_id, user_id)
    references public.user_free_plans(id, user_id) on delete cascade,
  foreign key (custom_workout_id, user_id)
    references public.custom_workouts(id, user_id) on delete cascade,
  unique (id, user_id)
);

create unique index workout_sessions_free_plan_unique
  on public.workout_sessions (user_id, free_plan_id, week_number, day_number)
  where source = 'free_plan';

create table public.workout_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  exercise_key text not null,
  exercise_name text not null check (char_length(exercise_name) between 1 and 120),
  muscle_group text,
  order_index smallint not null check (order_index >= 0),
  completed boolean not null default false,
  actual_sets smallint not null default 0 check (actual_sets >= 0),
  actual_reps smallint not null default 0 check (actual_reps >= 0),
  actual_weight_kg numeric(7,2) not null default 0 check (actual_weight_kg >= 0),
  actual_duration_seconds integer not null default 0 check (actual_duration_seconds >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (session_id, user_id)
    references public.workout_sessions(id, user_id) on delete cascade
);

create or replace function public.set_vemi_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger user_free_plans_set_updated_at
  before update on public.user_free_plans
  for each row execute procedure public.set_vemi_updated_at();
create trigger custom_workouts_set_updated_at
  before update on public.custom_workouts
  for each row execute procedure public.set_vemi_updated_at();
create trigger custom_workout_exercises_set_updated_at
  before update on public.custom_workout_exercises
  for each row execute procedure public.set_vemi_updated_at();
create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute procedure public.set_vemi_updated_at();
create trigger workout_exercise_logs_set_updated_at
  before update on public.workout_exercise_logs
  for each row execute procedure public.set_vemi_updated_at();

alter table public.user_free_plans enable row level security;
alter table public.custom_workouts enable row level security;
alter table public.custom_workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercise_logs enable row level security;

create policy "user_free_plans_own_all" on public.user_free_plans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "custom_workouts_own_all" on public.custom_workouts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "custom_workout_exercises_own_all" on public.custom_workout_exercises
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "workout_sessions_own_all" on public.workout_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "workout_exercise_logs_own_all" on public.workout_exercise_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.user_free_plans from anon;
revoke all on table public.custom_workouts from anon;
revoke all on table public.custom_workout_exercises from anon;
revoke all on table public.workout_sessions from anon;
revoke all on table public.workout_exercise_logs from anon;

grant select, insert, update, delete on table public.user_free_plans to authenticated;
grant select, insert, update, delete on table public.custom_workouts to authenticated;
grant select, insert, update, delete on table public.custom_workout_exercises to authenticated;
grant select, insert, update, delete on table public.workout_sessions to authenticated;
grant select, insert, update, delete on table public.workout_exercise_logs to authenticated;

comment on table public.user_free_plans is 'Planul gratuit activ și poziția curentă a utilizatorului VEMI.';
comment on table public.custom_workouts is 'Antrenamente create de utilizator; accesibile exclusiv proprietarului prin RLS.';
comment on table public.custom_workout_exercises is 'Exercițiile și țintele planurilor proprii VEMI.';
comment on table public.workout_sessions is 'Sesiuni gratuite sau proprii, inclusiv durată și stare.';
comment on table public.workout_exercise_logs is 'Serii, repetări, greutate, durată și finalizare per exercițiu.';
