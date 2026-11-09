-- Faza 1 Modul video VEMI: catalog canonic și normalizarea sigură a exercise_key.
-- Se rulează după 202608040002_vemi_progress.sql.
-- Migrarea este tranzacțională: orice denumire istorică necunoscută oprește și anulează întreaga operațiune.

begin;

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  exercise_key text not null unique,
  canonical_name text not null,
  muscle_group text not null check (muscle_group in ('Piept', 'Spate', 'Picioare', 'Umeri', 'Biceps', 'Triceps', 'Abdomen', 'Cardio')),
  exercise_kind text not null check (exercise_kind in ('forta', 'cardio')),
  places text[] not null check (cardinality(places) > 0 and places <@ array['acasa', 'sala']::text[]),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exercises_key_format check (exercise_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index exercises_canonical_name_lower_unique
  on public.exercises (lower(canonical_name));

create table public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint exercise_aliases_name_not_empty check (char_length(trim(alias_name)) > 0),
  constraint exercise_aliases_normalized_not_empty check (char_length(trim(normalized_alias)) > 0)
);

create unique index exercise_aliases_name_lower_unique
  on public.exercise_aliases (lower(alias_name));
create index exercise_aliases_exercise_id_idx
  on public.exercise_aliases (exercise_id);

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute procedure public.set_vemi_updated_at();

insert into public.exercises (exercise_key, canonical_name, muscle_group, exercise_kind, places) values
  ('flotari', 'Flotări', 'Piept', 'forta', array['acasa', 'sala']),
  ('flotari-genunchi', 'Flotări cu sprijin pe genunchi', 'Piept', 'forta', array['acasa']),
  ('impins-gantere', 'Împins cu gantere', 'Piept', 'forta', array['sala']),
  ('fluturari', 'Fluturări la cablu', 'Piept', 'forta', array['sala']),
  ('impins-banca-haltera', 'Împins la bancă cu haltera', 'Piept', 'forta', array['sala']),
  ('impins-inclinat-gantere', 'Împins înclinat cu gantere', 'Piept', 'forta', array['sala']),
  ('impins-inclinat-aparat', 'Împins înclinat la aparat', 'Piept', 'forta', array['sala']),
  ('impins-declinat-aparat', 'Împins declinat la aparat', 'Piept', 'forta', array['sala']),
  ('fluturari-gantere', 'Fluturări cu gantere', 'Piept', 'forta', array['acasa', 'sala']),
  ('flotari-largi', 'Flotări cu priză largă', 'Piept', 'forta', array['acasa']),
  ('flotari-declinate', 'Flotări declinate', 'Piept', 'forta', array['acasa']),
  ('flotari-perete', 'Flotări la perete', 'Piept', 'forta', array['acasa']),
  ('chest-press', 'Chest press la aparat', 'Piept', 'forta', array['sala']),
  ('ramat-banda', 'Ramat cu bandă elastică', 'Spate', 'forta', array['acasa']),
  ('ramat-rucsac', 'Ramat cu rucsacul', 'Spate', 'forta', array['acasa']),
  ('superman', 'Superman', 'Spate', 'forta', array['acasa']),
  ('helcometru', 'Tracțiuni la helcometru', 'Spate', 'forta', array['sala']),
  ('ramat-cablu', 'Ramat la cablu', 'Spate', 'forta', array['sala']),
  ('ramat-aparat', 'Ramat la aparat', 'Spate', 'forta', array['sala']),
  ('tractiuni-bara', 'Tracțiuni la bară', 'Spate', 'forta', array['acasa', 'sala']),
  ('tractiuni-asistate', 'Tracțiuni asistate', 'Spate', 'forta', array['sala']),
  ('ramat-gantera', 'Ramat cu gantera', 'Spate', 'forta', array['acasa', 'sala']),
  ('ramat-haltera', 'Ramat cu haltera', 'Spate', 'forta', array['sala']),
  ('pullover-cablu', 'Pullover la cablu', 'Spate', 'forta', array['sala']),
  ('face-pull', 'Face pull', 'Spate', 'forta', array['sala']),
  ('reverse-snow-angels', 'Reverse snow angels', 'Spate', 'forta', array['acasa']),
  ('genuflexiuni', 'Genuflexiuni', 'Picioare', 'forta', array['acasa', 'sala']),
  ('genuflexiuni-goblet', 'Genuflexiuni goblet', 'Picioare', 'forta', array['acasa', 'sala']),
  ('genuflexiuni-haltera', 'Genuflexiuni cu haltera', 'Picioare', 'forta', array['sala']),
  ('fandari', 'Fandări', 'Picioare', 'forta', array['acasa', 'sala']),
  ('fandari-pe-loc', 'Fandări pe loc', 'Picioare', 'forta', array['acasa', 'sala']),
  ('presa', 'Presă pentru picioare', 'Picioare', 'forta', array['sala']),
  ('podul', 'Podul fesier', 'Picioare', 'forta', array['acasa']),
  ('step-up', 'Urcări pe treaptă', 'Picioare', 'forta', array['acasa']),
  ('indreptari-romanesti', 'Îndreptări românești', 'Picioare', 'forta', array['sala']),
  ('genuflexiuni-sumo', 'Genuflexiuni sumo', 'Picioare', 'forta', array['acasa', 'sala']),
  ('fandari-bulgaresti', 'Fandări bulgărești', 'Picioare', 'forta', array['acasa', 'sala']),
  ('extensii-cvadriceps', 'Extensii pentru cvadriceps', 'Picioare', 'forta', array['sala']),
  ('flexii-femurali', 'Flexii pentru femurali', 'Picioare', 'forta', array['sala']),
  ('ridicari-varfuri', 'Ridicări pe vârfuri', 'Picioare', 'forta', array['acasa', 'sala']),
  ('wall-sit', 'Menținere la perete', 'Picioare', 'forta', array['acasa']),
  ('laterale', 'Ridicări laterale', 'Umeri', 'forta', array['acasa', 'sala']),
  ('presa-pike', 'Flotări Pike', 'Umeri', 'forta', array['acasa']),
  ('presa-militara', 'Presă militară cu haltera', 'Umeri', 'forta', array['sala']),
  ('presa-umeri', 'Presă pentru umeri', 'Umeri', 'forta', array['sala']),
  ('presa-arnold', 'Presă Arnold', 'Umeri', 'forta', array['sala']),
  ('ridicari-frontale', 'Ridicări frontale', 'Umeri', 'forta', array['acasa', 'sala']),
  ('fluturari-inverse', 'Fluturări inverse', 'Umeri', 'forta', array['sala']),
  ('tractiuni-verticale', 'Tracțiuni verticale', 'Umeri', 'forta', array['sala']),
  ('ytw-sol', 'Y-T-W la sol', 'Umeri', 'forta', array['acasa']),
  ('biceps', 'Flexii pentru biceps', 'Biceps', 'forta', array['acasa', 'sala']),
  ('flexii-gantere', 'Flexii cu gantere', 'Biceps', 'forta', array['acasa', 'sala']),
  ('flexii-hammer', 'Flexii hammer', 'Biceps', 'forta', array['acasa', 'sala']),
  ('flexii-cablu', 'Flexii la cablu', 'Biceps', 'forta', array['sala']),
  ('flexii-concentrate', 'Flexii concentrate', 'Biceps', 'forta', array['acasa', 'sala']),
  ('triceps', 'Extensii pentru triceps', 'Triceps', 'forta', array['acasa', 'sala']),
  ('triceps-cablu', 'Extensii triceps la cablu', 'Triceps', 'forta', array['sala']),
  ('triceps-deasupra-capului', 'Extensii deasupra capului', 'Triceps', 'forta', array['acasa', 'sala']),
  ('flotari-diamant', 'Flotări diamant', 'Triceps', 'forta', array['acasa']),
  ('dips-banca', 'Dips la bancă', 'Triceps', 'forta', array['acasa', 'sala']),
  ('dips-paralele', 'Dips la paralele', 'Triceps', 'forta', array['sala']),
  ('plank', 'Plank', 'Abdomen', 'forta', array['acasa', 'sala']),
  ('abdomene', 'Abdomene', 'Abdomen', 'forta', array['acasa', 'sala']),
  ('dead-bug', 'Dead bug', 'Abdomen', 'forta', array['acasa']),
  ('crunch-bicicleta', 'Crunch bicicletă', 'Abdomen', 'forta', array['acasa']),
  ('ridicari-picioare', 'Ridicări de picioare', 'Abdomen', 'forta', array['acasa', 'sala']),
  ('russian-twist', 'Russian twist', 'Abdomen', 'forta', array['acasa', 'sala']),
  ('bicicleta', 'Bicicletă', 'Cardio', 'cardio', array['acasa', 'sala']),
  ('banda', 'Bandă de alergare', 'Cardio', 'cardio', array['sala']),
  ('mers', 'Mers alert', 'Cardio', 'cardio', array['acasa']),
  ('mountain-climbers', 'Mountain climbers', 'Cardio', 'cardio', array['acasa']),
  ('sarit-coarda', 'Sărit coarda', 'Cardio', 'cardio', array['acasa', 'sala']),
  ('burpees', 'Burpees', 'Cardio', 'cardio', array['acasa', 'sala']);

insert into public.exercise_aliases (exercise_id, alias_name, normalized_alias)
select e.id, source.alias_name, source.normalized_alias
from (values
  ('impins-gantere', 'Împins cu gantere la bancă', 'impins cu gantere la banca'),
  ('impins-gantere', 'Împins la piept cu gantere', 'impins la piept cu gantere'),
  ('flexii-femurali', 'Flexii femurali', 'flexii femurali'),
  ('flotari-genunchi', 'Flotări cu sprijin', 'flotari cu sprijin'),
  ('dips-banca', 'Extensii triceps la scaun', 'extensii triceps la scaun'),
  ('biceps', 'Flexii biceps', 'flexii biceps'),
  ('impins-banca-haltera', 'Împins la bancă', 'impins la banca'),
  ('tractiuni-bara', 'Tracțiuni', 'tractiuni'),
  ('presa-militara', 'Presă militară', 'presa militara'),
  ('dips-paralele', 'Dips', 'dips'),
  ('ridicari-varfuri', 'Ridicări pentru gambe', 'ridicari pentru gambe')
) as source(exercise_key, alias_name, normalized_alias)
join public.exercises e on e.exercise_key = source.exercise_key;

-- Oprire sigură: nu schimbăm nimic în istoricul utilizatorilor dacă există o denumire
-- care nu poate fi asociată nici prin cheia existentă, nici prin numele canonic, nici prin alias.
do $$
declare
  unknown_names text;
begin
  select string_agg(distinct c.name, ', ' order by c.name)
  into unknown_names
    from public.custom_workout_exercises c
    left join public.exercises by_key on by_key.exercise_key = c.exercise_key
    left join public.exercises by_name on lower(by_name.canonical_name) = lower(trim(c.name))
    left join public.exercise_aliases a on lower(a.alias_name) = lower(trim(c.name))
    where by_key.id is null and by_name.id is null and a.id is null;

  if unknown_names is not null then
    raise exception 'VEMI catalog migration stopped: custom_workout_exercises contains unmapped exercises: %', unknown_names;
  end if;

  select string_agg(distinct l.exercise_name, ', ' order by l.exercise_name)
  into unknown_names
    from public.workout_exercise_logs l
    left join public.exercises by_key on by_key.exercise_key = l.exercise_key
    left join public.exercises by_name on lower(by_name.canonical_name) = lower(trim(l.exercise_name))
    left join public.exercise_aliases a on lower(a.alias_name) = lower(trim(l.exercise_name))
    where by_key.id is null and by_name.id is null and a.id is null;

  if unknown_names is not null then
    raise exception 'VEMI catalog migration stopped: workout_exercise_logs contains unmapped exercises: %', unknown_names;
  end if;
end;
$$;

with resolved as (
  select
    c.id,
    coalesce(by_key.exercise_key, by_name.exercise_key, alias_exercise.exercise_key) as canonical_key
  from public.custom_workout_exercises c
  left join public.exercises by_key on by_key.exercise_key = c.exercise_key
  left join public.exercises by_name on lower(by_name.canonical_name) = lower(trim(c.name))
  left join public.exercise_aliases a on lower(a.alias_name) = lower(trim(c.name))
  left join public.exercises alias_exercise on alias_exercise.id = a.exercise_id
)
update public.custom_workout_exercises c
set exercise_key = resolved.canonical_key
from resolved
where c.id = resolved.id
  and c.exercise_key is distinct from resolved.canonical_key;

with resolved as (
  select
    l.id,
    coalesce(by_key.exercise_key, by_name.exercise_key, alias_exercise.exercise_key) as canonical_key
  from public.workout_exercise_logs l
  left join public.exercises by_key on by_key.exercise_key = l.exercise_key
  left join public.exercises by_name on lower(by_name.canonical_name) = lower(trim(l.exercise_name))
  left join public.exercise_aliases a on lower(a.alias_name) = lower(trim(l.exercise_name))
  left join public.exercises alias_exercise on alias_exercise.id = a.exercise_id
)
update public.workout_exercise_logs l
set exercise_key = resolved.canonical_key
from resolved
where l.id = resolved.id
  and l.exercise_key is distinct from resolved.canonical_key;

alter table public.custom_workout_exercises
  add constraint custom_workout_exercises_exercise_key_fkey
  foreign key (exercise_key) references public.exercises(exercise_key)
  on update cascade on delete restrict not valid;

alter table public.workout_exercise_logs
  add constraint workout_exercise_logs_exercise_key_fkey
  foreign key (exercise_key) references public.exercises(exercise_key)
  on update cascade on delete restrict not valid;

alter table public.custom_workout_exercises
  validate constraint custom_workout_exercises_exercise_key_fkey;
alter table public.workout_exercise_logs
  validate constraint workout_exercise_logs_exercise_key_fkey;

alter table public.exercises enable row level security;
alter table public.exercise_aliases enable row level security;

create policy "exercises_read_active"
on public.exercises
for select
to anon, authenticated
using (is_active = true);

create policy "exercises_admin_read"
on public.exercises
for select
to authenticated
using (public.is_admin());

create policy "exercises_admin_insert"
on public.exercises
for insert
to authenticated
with check (public.is_admin());

create policy "exercises_admin_update"
on public.exercises
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "exercises_admin_delete"
on public.exercises
for delete
to authenticated
using (public.is_admin());

create policy "exercise_aliases_read"
on public.exercise_aliases
for select
to anon, authenticated
using (
  exists (
    select 1 from public.exercises e
    where e.id = exercise_aliases.exercise_id
      and e.is_active = true
  )
);

create policy "exercise_aliases_admin_read"
on public.exercise_aliases
for select
to authenticated
using (public.is_admin());

create policy "exercise_aliases_admin_insert"
on public.exercise_aliases
for insert
to authenticated
with check (public.is_admin());

create policy "exercise_aliases_admin_update"
on public.exercise_aliases
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "exercise_aliases_admin_delete"
on public.exercise_aliases
for delete
to authenticated
using (public.is_admin());

revoke all on table public.exercises from anon, authenticated;
revoke all on table public.exercise_aliases from anon, authenticated;
grant select on table public.exercises to anon, authenticated;
grant select on table public.exercise_aliases to anon, authenticated;
grant insert, update, delete on table public.exercises to authenticated;
grant insert, update, delete on table public.exercise_aliases to authenticated;

comment on table public.exercises is 'Catalogul canonic VEMI. exercise_key este stabil și comun tuturor modulelor.';
comment on table public.exercise_aliases is 'Denumiri istorice sau alternative mapate către un singur exercițiu canonic.';
comment on column public.exercises.exercise_key is 'Identificator stabil fără diacritice; nu se schimbă odată cu denumirea afișată.';

commit;
