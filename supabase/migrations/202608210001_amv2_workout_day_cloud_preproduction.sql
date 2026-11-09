-- CP219: additive AMV2 WorkoutDay cloud model (pre-cutover only).
-- Generated deterministically by scripts/amv2/generate-cp219-migration.mjs.
-- Gate 0C canonical mapping SHA-256: 94dc6c256d407f89deb121aca18215e52ddb045288e50ebcd7f86464886917fa

create table if not exists public.amv2_artifact_registry (
  artifact_key text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  recorded_at timestamptz not null default now()
);

create table if not exists public.amv2_canonical_exercises (
  exercise_key text primary key,
  display_name text not null check (btrim(display_name) <> ''),
  category text not null check (btrim(category) <> ''),
  locations text[] not null check (cardinality(locations) between 1 and 2 and locations <@ array['home','gym']::text[]),
  metric_type text not null check (metric_type in ('repetitions_weight','repetitions_only','time_per_set','total_duration')),
  default_source text not null check (default_source = 'GENERIC_FALLBACK'),
  default_sets smallint,
  default_repetitions smallint,
  default_weight_kg numeric(6,2),
  default_time_per_set_seconds integer,
  default_total_duration_seconds integer,
  constraint amv2_canonical_zero_matrix check (
    (metric_type = 'repetitions_weight' and default_sets = 3 and default_repetitions = 0 and default_weight_kg = 0 and default_time_per_set_seconds is null and default_total_duration_seconds is null)
    or (metric_type = 'repetitions_only' and default_sets = 3 and default_repetitions = 0 and default_weight_kg is null and default_time_per_set_seconds is null and default_total_duration_seconds is null)
    or (metric_type = 'time_per_set' and default_sets = 3 and default_repetitions is null and default_weight_kg is null and default_time_per_set_seconds = 0 and default_total_duration_seconds is null)
    or (metric_type = 'total_duration' and default_sets is null and default_repetitions is null and default_weight_kg is null and default_time_per_set_seconds is null and default_total_duration_seconds = 0)
  )
);

insert into public.amv2_canonical_exercises (
  exercise_key,display_name,category,locations,metric_type,default_source,
  default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,default_total_duration_seconds
) values
  ('ab-wheel-din-genunchi','Ab Wheel din genunchi','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('abdomene','Crunch abdominal','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('alergare-pe-loc','Alergare pe loc','Cardio',array['home','gym']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('aplecari-laterale-din-picioare','Aplecări laterale din picioare','Abdomen',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('atingeri-alternative-ale-piciorului-din-picioare','Atingeri alternative ale piciorului din picioare','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('bicicleta-eliptica','Bicicletă eliptică','Cardio',array['gym']::text[],'total_duration','GENERIC_FALLBACK',null,null,null,null,0),
  ('bicicleta-stationara','Bicicletă staționară','Cardio',array['gym']::text[],'total_duration','GENERIC_FALLBACK',null,null,null,null,0),
  ('burpees','Burpees','Cardio',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('cobra-din-culcat','Cobra din culcat','Spate',array['home','gym']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('crunch-cu-gantera','Crunch cu ganteră','Abdomen',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('crunch-cu-minge','Crunch cu minge','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('crunch-lateral-din-picioare','Crunch lateral din picioare','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('dead-bug','Dead Bug','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('dips-intre-scaune','Dips între scaune','Triceps',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('dips-paralele','Flotări la paralele','Piept',array['gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('extensii-cvadriceps','Extensii pentru picioare la aparat','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-pentru-femurali-din-culcat','Extensii pentru femurali din culcat','Picioare',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('extensii-pentru-triceps-cu-bara-ez-din-culcat','Extensii pentru triceps cu bara EZ din culcat','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-pentru-triceps-la-cablu-cu-bara','Extensii pentru triceps la cablu cu bară','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-pentru-triceps-la-cablu-cu-franghia','Extensii pentru triceps la cablu cu frânghia','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-pentru-triceps-la-cablu-cu-priza-inversa','Extensii pentru triceps la cablu cu priză inversă','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-unilaterale-pentru-triceps-la-cablu','Extensii unilaterale pentru triceps la cablu','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('extensii-unilaterale-pentru-triceps-la-cablu-cu-sprijin','Extensii unilaterale pentru triceps la cablu cu sprijin','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('face-pull','Face Pull la cablu','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fandari-bulgaresti','Fandări bulgărești cu gantere','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fandari-inverse-alternative','Fandări inverse alternative','Picioare',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('fandari-inverse-cu-gantere','Fandări inverse cu gantere','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-cu-bara-dreapta','Flexii cu bara dreaptă','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-cu-gantere-pe-banca-inclinata','Flexii cu gantere pe bancă înclinată','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-gantere','Flexii cu gantere din picioare','Biceps',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-la-banca-scott-cu-bara-ez','Flexii la banca Scott cu bara EZ','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-la-cablu-cu-bara-ez','Flexii la cablu cu bara EZ','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-la-cablu-cu-bratele-in-spatele-corpului','Flexii la cablu cu brațele în spatele corpului','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-la-cablu-cu-franghia','Flexii la cablu cu frânghia','Biceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flexii-pentru-picioare-la-aparat','Flexii pentru picioare la aparat','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('flotari','Flotări','Piept',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('flotari-cu-atingerea-umarului','Flotări cu atingerea umărului','Piept',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('flotari-declinate','Flotări cu picioarele ridicate','Piept',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('flotari-diamant','Flotări cu mâinile apropiate','Triceps',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('flotari-hindu','Flotări Hindu','Piept',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('flotari-largi','Flotări cu mâinile depărtate','Piept',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('fluturari-ascendente-la-cablu','Fluturări ascendente la cablu','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fluturari-descendente-la-cablu','Fluturări descendente la cablu','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fluturari-gantere','Fluturări cu gantere','Piept',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fluturari-inverse','Reverse Fly la aparat','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fluturari-la-aparat','Fluturări la aparat','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('fluturari-la-cablu-pe-banca-declinata','Fluturări la cablu pe bancă declinată','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni','Genuflexiuni cu greutatea corpului','Picioare',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('genuflexiuni-cu-gantere-la-umeri','Genuflexiuni cu gantere la umeri','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-goblet','Genuflexiuni cu gantera la piept','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-haltera','Genuflexiuni cu bara','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-la-aparat-v-squat','Genuflexiuni la aparat V-Squat','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-la-bara-smith','Genuflexiuni la bara Smith','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-la-cablu','Genuflexiuni la cablu','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-la-hack-squat','Genuflexiuni la Hack Squat','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('genuflexiuni-sumo','Genuflexiuni sumo cu ganteră','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('hip-thrust-cu-gantera','Hip Thrust cu gantera','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('hiperextensii-lombare-la-banca','Hiperextensii lombare la bancă','Spate',array['gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('impins-banca-haltera','Împins cu bara','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-bara-pe-banca-declinata','Împins cu bara pe bancă declinată','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-bara-pe-banca-inclinata','Împins cu bara pe bancă înclinată','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-bara-smith','Împins cu bara Smith','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-bara-smith-cu-priza-ingusta','Împins cu bara Smith cu priză îngustă','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-gantere-apropiate','Împins cu gantere apropiate','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-gantere-pentru-umeri-din-picioare','Împins cu gantere pentru umeri din picioare','Umeri',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-cu-gantere-pentru-umeri-din-sezut','Împins cu gantere pentru umeri din șezut','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-gantere','Împins cu gantere','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-inclinat-gantere','Împins cu gantere pe bancă înclinată','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-la-aparat','Împins la aparat','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('impins-la-aparat-pentru-umeri','Împins la aparat pentru umeri','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('indreptari-pe-un-picior-fara-greutate','Îndreptări pe un picior fără greutate','Picioare',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('indreptari-romanesti','Îndreptări românești cu gantere','Spate',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('mers-rapid-pe-banda','Mers rapid pe bandă','Cardio',array['gym']::text[],'total_duration','GENERIC_FALLBACK',null,null,null,null,0),
  ('mountain-climbers','Mountain Climbers','Abdomen',array['home']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('pec-deck','Pec deck','Piept',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('plank','Plank','Abdomen',array['home','gym']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('plank-cu-greutate','Plank cu greutate','Abdomen',array['gym']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('plank-invers','Plank invers','Abdomen',array['home']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('presa-pentru-picioare-la-45','Presă pentru picioare la 45°','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('presa-pentru-picioare-la-aparat-din-sezut','Presă pentru picioare la aparat din șezut','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('pulldown-cu-bratele-drepte-la-cablu','Pulldown cu brațele drepte la cablu','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('pullover-cablu','Pullover la cablu din culcat','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ramat-aparat','Ramat la aparat cu sprijin pentru piept','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ramat-haltera','Ramat cu bara din aplecat','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ramat-la-cablu-cu-priza-ingusta','Ramat la cablu cu priză îngustă','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ramat-la-cablu-din-sezut','Ramat la cablu din șezut','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ramat-unilateral-la-cablu-din-sezut','Ramat unilateral la cablu din șezut','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-alternative-ale-genunchilor','Ridicări alternative ale genunchilor','Cardio',array['home','gym']::text[],'time_per_set','GENERIC_FALLBACK',3,null,null,0,null),
  ('ridicari-de-genunchi-cu-rotatie','Ridicări de genunchi cu rotație','Abdomen',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('ridicari-de-genunchi-la-aparat','Ridicări de genunchi la aparat','Abdomen',array['gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('ridicari-de-picioare-din-atarnat','Ridicări de picioare din atârnat','Abdomen',array['gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('ridicari-de-trunchi-cu-disc','Ridicări de trunchi cu disc','Abdomen',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-din-umeri-cu-bara','Ridicări din umeri cu bara','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-din-umeri-cu-gantere','Ridicări din umeri cu gantere','Spate',array['home']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-din-umeri-la-aparat','Ridicări din umeri la aparat','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-cu-gantere-cu-pieptul-sprijinit','Ridicări laterale cu gantere cu pieptul sprijinit','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-cu-gantere-din-picioare','Ridicări laterale cu gantere din picioare','Umeri',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-cu-gantere-din-sezut','Ridicări laterale cu gantere din șezut','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-cu-gantere-din-sezut-cu-spatele-sprijinit','Ridicări laterale cu gantere din șezut cu spatele sprijinit','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-la-cablu','Ridicări laterale la cablu','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-la-cablu-din-aplecat','Ridicări laterale la cablu din aplecat','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-laterale-unilaterale-la-cablu','Ridicări laterale unilaterale la cablu','Umeri',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-pe-varfuri-cu-gantere','Ridicări pe vârfuri cu gantere','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-pe-varfuri-la-aparat','Ridicări pe vârfuri la aparat','Picioare',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('ridicari-unilaterale-pe-varfuri-cu-gantera','Ridicări unilaterale pe vârfuri cu ganteră','Picioare',array['home','gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('russian-twist','Russian Twist fără greutate','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('russian-twist-cu-disc','Russian Twist cu disc','Abdomen',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('superman-alternativ','Superman alternativ','Spate',array['home']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('tractiuni-bara','Tracțiuni la bară cu priză largă','Spate',array['gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('tractiuni-la-helcometru-cu-priza-ingusta','Tracțiuni la helcometru cu priză îngustă','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('tractiuni-la-helcometru-cu-priza-larga','Tracțiuni la helcometru cu priză largă','Spate',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('triceps-deasupra-capului','Extensii pentru triceps deasupra capului la cablu','Triceps',array['gym']::text[],'repetitions_weight','GENERIC_FALLBACK',3,0,0,null,null),
  ('v-up','V-Up','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null),
  ('v-up-cu-minge','V-Up cu minge','Abdomen',array['home','gym']::text[],'repetitions_only','GENERIC_FALLBACK',3,0,null,null,null)
on conflict (exercise_key) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  locations = excluded.locations,
  metric_type = excluded.metric_type,
  default_source = excluded.default_source,
  default_sets = excluded.default_sets,
  default_repetitions = excluded.default_repetitions,
  default_weight_kg = excluded.default_weight_kg,
  default_time_per_set_seconds = excluded.default_time_per_set_seconds,
  default_total_duration_seconds = excluded.default_total_duration_seconds;

insert into public.amv2_artifact_registry (artifact_key,sha256,row_count)
values ('gate-0c-final-v1.4','94dc6c256d407f89deb121aca18215e52ddb045288e50ebcd7f86464886917fa',114)
on conflict (artifact_key) do update set sha256 = excluded.sha256, row_count = excluded.row_count;

do $$
declare v_distribution jsonb;
begin
  if (select count(*) from public.amv2_canonical_exercises) <> 114 then
    raise exception 'AMV2 canonical projection must contain exactly 114 rows';
  end if;
  select jsonb_object_agg(metric_type, amount) into v_distribution
  from (select metric_type, count(*) amount from public.amv2_canonical_exercises group by metric_type) counts;
  if v_distribution <> '{"repetitions_weight":75,"repetitions_only":29,"time_per_set":7,"total_duration":3}'::jsonb then
    raise exception 'AMV2 canonical metric distribution mismatch: %', v_distribution;
  end if;
end $$;

create table if not exists public.amv2_personal_exercises (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (btrim(id) <> ''),
  client_key text not null check (btrim(client_key) <> ''),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  template_exercise_key text not null references public.amv2_canonical_exercises(exercise_key) on delete restrict,
  category text not null,
  location text not null check (location in ('home','gym')),
  metric_type text not null check (metric_type in ('repetitions_weight','repetitions_only','time_per_set','total_duration')),
  default_sets smallint,
  default_repetitions smallint,
  default_weight_kg numeric(6,2),
  default_time_per_set_seconds integer,
  default_total_duration_seconds integer,
  revision bigint not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,id),
  unique (owner_user_id,client_key)
);

create table if not exists public.amv2_workout_days (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  client_key text not null check (btrim(client_key) <> ''),
  location text not null check (location in ('home','gym')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,workout_date),
  unique (owner_user_id,client_key)
);

create table if not exists public.amv2_workout_day_exercises (
  owner_user_id uuid not null,
  workout_date date not null,
  client_key text not null check (btrim(client_key) <> ''),
  order_index smallint not null check (order_index between 0 and 9),
  canonical_exercise_key text references public.amv2_canonical_exercises(exercise_key) on delete restrict,
  personal_exercise_id text,
  display_name text not null check (btrim(display_name) <> ''),
  category text not null check (btrim(category) <> ''),
  metric_type text not null check (metric_type in ('repetitions_weight','repetitions_only','time_per_set','total_duration')),
  total_duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,workout_date,client_key),
  unique (owner_user_id,workout_date,order_index),
  foreign key (owner_user_id,workout_date) references public.amv2_workout_days(owner_user_id,workout_date) on delete cascade,
  foreign key (owner_user_id,personal_exercise_id) references public.amv2_personal_exercises(owner_user_id,id) on delete restrict,
  constraint amv2_exercise_identity_xor check ((canonical_exercise_key is not null)::integer + (personal_exercise_id is not null)::integer = 1),
  constraint amv2_total_duration_shape check (
    (metric_type = 'total_duration' and total_duration_seconds between 0 and 18000)
    or (metric_type <> 'total_duration' and total_duration_seconds is null)
  )
);

create unique index if not exists amv2_workout_day_canonical_unique
  on public.amv2_workout_day_exercises(owner_user_id,workout_date,canonical_exercise_key)
  where canonical_exercise_key is not null;
create unique index if not exists amv2_workout_day_personal_unique
  on public.amv2_workout_day_exercises(owner_user_id,workout_date,personal_exercise_id)
  where personal_exercise_id is not null;
create index if not exists amv2_workout_day_exercises_parent_idx
  on public.amv2_workout_day_exercises(owner_user_id,workout_date);

create table if not exists public.amv2_workout_day_sets (
  owner_user_id uuid not null,
  workout_date date not null,
  exercise_client_key text not null,
  client_key text not null check (btrim(client_key) <> ''),
  order_index smallint not null check (order_index between 0 and 19),
  repetitions smallint,
  weight_kg numeric(6,2),
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,workout_date,exercise_client_key,client_key),
  unique (owner_user_id,workout_date,exercise_client_key,order_index),
  foreign key (owner_user_id,workout_date,exercise_client_key)
    references public.amv2_workout_day_exercises(owner_user_id,workout_date,client_key) on delete cascade,
  constraint amv2_set_ranges check (
    (repetitions is null or repetitions between 0 and 100)
    and (weight_kg is null or weight_kg between 0 and 500)
    and (duration_seconds is null or duration_seconds between 0 and 3600)
  )
);
create index if not exists amv2_workout_day_sets_parent_idx
  on public.amv2_workout_day_sets(owner_user_id,workout_date,exercise_client_key);

create table if not exists public.amv2_operation_receipts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  operation_key text not null check (btrim(operation_key) <> '' and char_length(operation_key) <= 160),
  operation_type text not null,
  request_payload jsonb not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id,operation_key)
);
create index if not exists amv2_operation_receipts_created_idx
  on public.amv2_operation_receipts(owner_user_id,created_at desc);

create table if not exists public.amv2_import_batches (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  batch_key text not null check (btrim(batch_key) <> ''),
  source text not null check (source in ('v1_local','v1_account')),
  source_identity text not null check (btrim(source_identity) <> ''),
  payload jsonb not null,
  imported_dates date[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (owner_user_id,batch_key),
  unique (owner_user_id,source,source_identity)
);

create or replace function public.amv2_validate_personal_exercise_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_template public.amv2_canonical_exercises%rowtype;
begin
  select * into strict v_template from public.amv2_canonical_exercises where exercise_key = new.template_exercise_key;
  if new.category <> v_template.category or new.metric_type <> v_template.metric_type
    or not (v_template.locations @> array[new.location]::text[])
    or new.default_sets is distinct from v_template.default_sets
    or new.default_repetitions is distinct from v_template.default_repetitions
    or new.default_weight_kg is distinct from v_template.default_weight_kg
    or new.default_time_per_set_seconds is distinct from v_template.default_time_per_set_seconds
    or new.default_total_duration_seconds is distinct from v_template.default_total_duration_seconds then
    raise exception using errcode = '23514', message = 'AMV2 personal exercise must inherit its canonical template metric/default matrix';
  end if;
  return new;
end $$;

drop trigger if exists amv2_personal_exercise_validate on public.amv2_personal_exercises;
create trigger amv2_personal_exercise_validate before insert or update on public.amv2_personal_exercises
for each row execute function public.amv2_validate_personal_exercise_row();

create or replace function public.amv2_validate_day_exercise_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_metric text; v_category text; v_name text;
begin
  if new.canonical_exercise_key is not null then
    select metric_type,category,display_name into strict v_metric,v_category,v_name
    from public.amv2_canonical_exercises where exercise_key = new.canonical_exercise_key;
    if new.display_name <> v_name then raise exception using errcode = '23514', message = 'AMV2 canonical display name override forbidden'; end if;
  else
    select metric_type,category into strict v_metric,v_category
    from public.amv2_personal_exercises
    where owner_user_id = new.owner_user_id and id = new.personal_exercise_id;
  end if;
  if new.metric_type <> v_metric or new.category <> v_category then
    raise exception using errcode = '23514', message = 'AMV2 exercise metric/category override forbidden';
  end if;
  return new;
end $$;

drop trigger if exists amv2_day_exercise_validate on public.amv2_workout_day_exercises;
create trigger amv2_day_exercise_validate before insert or update on public.amv2_workout_day_exercises
for each row execute function public.amv2_validate_day_exercise_row();

create or replace function public.amv2_validate_set_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_metric text;
begin
  select metric_type into strict v_metric from public.amv2_workout_day_exercises
  where owner_user_id = new.owner_user_id and workout_date = new.workout_date and client_key = new.exercise_client_key;
  if (v_metric = 'repetitions_weight' and (new.repetitions is null or new.weight_kg is null or new.duration_seconds is not null))
    or (v_metric = 'repetitions_only' and (new.repetitions is null or new.weight_kg is not null or new.duration_seconds is not null))
    or (v_metric = 'time_per_set' and (new.repetitions is not null or new.weight_kg is not null or new.duration_seconds is null))
    or v_metric = 'total_duration' then
    raise exception using errcode = '23514', message = 'AMV2 set shape does not match the canonical metric';
  end if;
  return new;
end $$;

drop trigger if exists amv2_set_validate on public.amv2_workout_day_sets;
create trigger amv2_set_validate before insert or update on public.amv2_workout_day_sets
for each row execute function public.amv2_validate_set_row();

create or replace function public.amv2_replace_workout_day_graph(p_owner uuid,p_expected_revision bigint,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_date date; v_location text; v_client_key text; v_current bigint; v_next bigint; v_created timestamptz;
  v_count integer; v_item record; v_set record; v_reference jsonb; v_source text;
  v_key text; v_personal_id text; v_metric text; v_name text; v_category text; v_set_count integer;
  v_archived_at timestamptz; v_existing_personal_ids text[] := '{}'; v_exists boolean;
  v_personal_template text;
begin
  v_date := (p_payload->>'date')::date;
  v_location := p_payload->>'location';
  v_client_key := p_payload->>'clientKey';
  if jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ?& array['date','clientKey','location','exercises'])
    or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('date','clientKey','location','exercises')) then
    raise exception using errcode='22023',message='AMV2_WORKOUT_DAY_FIELDS_INVALID';
  end if;
  if v_location not in ('home','gym') or nullif(btrim(v_client_key),'') is null then raise exception using errcode='22023',message='INVALID_WORKOUT_DAY'; end if;
  if jsonb_typeof(p_payload->'exercises') <> 'array' then raise exception using errcode='22023',message='INVALID_WORKOUT_DAY_EXERCISES'; end if;
  v_count := jsonb_array_length(p_payload->'exercises');
  if v_count not between 1 and 10 then raise exception using errcode='22023',message='WORKOUT_DAY_CAPACITY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || v_date::text,0));
  select revision,created_at into v_current,v_created from public.amv2_workout_days
  where owner_user_id=p_owner and workout_date=v_date for update;
  v_exists := found;
  select coalesce(array_agg(personal_exercise_id) filter (where personal_exercise_id is not null),'{}')
  into v_existing_personal_ids from public.amv2_workout_day_exercises where owner_user_id=p_owner and workout_date=v_date;
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
    v_reference := v_item.value->'reference'; v_source := v_reference->>'source';
    v_key := null; v_personal_id := null;
    if v_source='canonical' then
      if jsonb_typeof(v_reference) <> 'object' or not (v_reference ?& array['source','exerciseKey'])
        or exists(select 1 from jsonb_object_keys(v_reference) key where key not in ('source','exerciseKey')) then raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID'; end if;
      v_key := v_reference->>'exerciseKey';
      select metric_type,display_name,category into strict v_metric,v_name,v_category
      from public.amv2_canonical_exercises where exercise_key=v_key;
      if (v_item.value->>'displayName') is distinct from v_name or (v_item.value->>'category') is distinct from v_category then
        raise exception using errcode='22023',message='AMV2_CANONICAL_PRESENTATION_OVERRIDE_FORBIDDEN';
      end if;
    elsif v_source='personal' then
      if jsonb_typeof(v_reference) <> 'object' or not (v_reference ?& array['source','personalExerciseId','templateExerciseKey'])
        or exists(select 1 from jsonb_object_keys(v_reference) key where key not in ('source','personalExerciseId','templateExerciseKey')) then raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID'; end if;
      v_personal_id := v_reference->>'personalExerciseId';
      select metric_type,name,category,archived_at,template_exercise_key into strict v_metric,v_name,v_category,v_archived_at,v_personal_template
      from public.amv2_personal_exercises where owner_user_id=p_owner and id=v_personal_id;
      if (v_reference->>'templateExerciseKey') is distinct from v_personal_template
        or (v_item.value->>'category') is distinct from v_category
        or nullif(btrim(v_item.value->>'displayName'),'') is null then
        raise exception using errcode='22023',message='AMV2_PERSONAL_PRESENTATION_OVERRIDE_FORBIDDEN';
      end if;
      if v_archived_at is not null and not (v_personal_id = any(v_existing_personal_ids)) then raise exception using errcode='22023',message='AMV2_PERSONAL_EXERCISE_ARCHIVED'; end if;
      v_name := coalesce(nullif(btrim(v_item.value->>'displayName'),''),v_name);
    else raise exception using errcode='22023',message='AMV2_EXERCISE_IDENTITY_INVALID'; end if;
    if (v_item.value->>'metricType') is distinct from v_metric then raise exception using errcode='22023',message='AMV2_METRIC_OVERRIDE_FORBIDDEN'; end if;
    insert into public.amv2_workout_day_exercises(
      owner_user_id,workout_date,client_key,order_index,canonical_exercise_key,personal_exercise_id,
      display_name,category,metric_type,total_duration_seconds
    ) values (
      p_owner,v_date,v_item.value->>'id',v_item.idx,v_key,v_personal_id,v_name,v_category,v_metric,
      case when v_metric='total_duration' then (v_item.value->>'targetTotalDurationSeconds')::integer else null end
    );
    if v_metric='total_duration' then
      if not (v_item.value ? 'targetTotalDurationSeconds') or v_item.value ? 'sets' then raise exception using errcode='22023',message='AMV2_TOTAL_DURATION_SHAPE_INVALID'; end if;
    else
      if v_item.value ? 'targetTotalDurationSeconds' then raise exception using errcode='22023',message='AMV2_SET_METRIC_HAS_TOTAL_DURATION'; end if;
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

revoke all on function public.amv2_replace_workout_day_graph(uuid,bigint,jsonb) from public;

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
    'personalExercises',coalesce((select jsonb_agg(jsonb_build_object(
      'id',personal.id,'client_key',personal.client_key,'name',personal.name,
      'template_exercise_key',personal.template_exercise_key,'category',personal.category,
      'location',personal.location,'metric_type',personal.metric_type,'revision',personal.revision,
      'archived_at',personal.archived_at,'created_at',personal.created_at,'updated_at',personal.updated_at
    ) order by personal.created_at) from public.amv2_personal_exercises personal),'[]'::jsonb)
  );
end $$;

create or replace function public.amv2_apply_operation(
  p_operation_key text,p_operation_type text,p_expected_revision bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_request jsonb; v_previous record; v_response jsonb;
  v_template public.amv2_canonical_exercises%rowtype; v_current bigint; v_item jsonb; v_dates date[] := '{}';
  v_existing_template text; v_existing_client_key text; v_existing_archived_at timestamptz;
begin
  if v_owner is null then raise exception using errcode='28000',message='AMV2_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception using errcode='22023',message='AMV2_PAYLOAD_INVALID'; end if;
  if pg_column_size(p_payload) > 524288 then raise exception using errcode='54000',message='AMV2_PAYLOAD_TOO_LARGE'; end if;
  if nullif(btrim(p_operation_key),'') is null or char_length(p_operation_key) > 160 or p_expected_revision < 0 or p_operation_type not in ('upsert_day','delete_day','upsert_personal','archive_personal','import_days') then
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
    if not (p_payload ? 'date') or exists(select 1 from jsonb_object_keys(p_payload) key where key <> 'date') then raise exception using errcode='22023',message='AMV2_DELETE_DAY_PAYLOAD_INVALID'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||(p_payload->>'date'),0));
    select revision into v_current from public.amv2_workout_days where owner_user_id=v_owner and workout_date=(p_payload->>'date')::date for update;
    if not found or v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
    delete from public.amv2_workout_days where owner_user_id=v_owner and workout_date=(p_payload->>'date')::date;
    v_response := jsonb_build_object('remoteIdentity','day:'||(p_payload->>'date'),'revision',v_current+1,'deleted',true);
  elsif p_operation_type='upsert_personal' then
    if not (p_payload ?& array['id','clientKey','name','templateExerciseKey','location'])
      or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('id','clientKey','name','templateExerciseKey','location')) then
      raise exception using errcode='22023',message='AMV2_PERSONAL_PAYLOAD_INVALID';
    end if;
    select * into strict v_template from public.amv2_canonical_exercises where exercise_key=p_payload->>'templateExerciseKey';
    if not (v_template.locations @> array[p_payload->>'location']::text[]) then raise exception using errcode='22023',message='AMV2_PERSONAL_LOCATION_INCOMPATIBLE'; end if;
    select revision,template_exercise_key,client_key,archived_at into v_current,v_existing_template,v_existing_client_key,v_existing_archived_at from public.amv2_personal_exercises where owner_user_id=v_owner and id=p_payload->>'id' for update;
    if found then
      if v_current <> p_expected_revision then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
      if v_existing_archived_at is not null then raise exception using errcode='55000',message='AMV2_PERSONAL_ARCHIVED'; end if;
      if v_existing_template is distinct from v_template.exercise_key then raise exception using errcode='22023',message='AMV2_PERSONAL_TEMPLATE_OVERRIDE_FORBIDDEN'; end if;
      if v_existing_client_key is distinct from (p_payload->>'clientKey') then raise exception using errcode='22023',message='AMV2_PERSONAL_CLIENT_IDENTITY_OVERRIDE_FORBIDDEN'; end if;
      update public.amv2_personal_exercises set
        name=p_payload->>'name',location=p_payload->>'location',revision=v_current+1,updated_at=now()
      where owner_user_id=v_owner and id=p_payload->>'id';
      v_current := v_current+1;
    else
      if p_expected_revision <> 0 then raise exception using errcode='40001',message='AMV2_REVISION_CONFLICT'; end if;
      insert into public.amv2_personal_exercises(
        owner_user_id,id,client_key,name,template_exercise_key,category,location,metric_type,
        default_sets,default_repetitions,default_weight_kg,default_time_per_set_seconds,default_total_duration_seconds
      ) values (
        v_owner,p_payload->>'id',p_payload->>'clientKey',p_payload->>'name',v_template.exercise_key,v_template.category,p_payload->>'location',v_template.metric_type,
        v_template.default_sets,v_template.default_repetitions,v_template.default_weight_kg,v_template.default_time_per_set_seconds,v_template.default_total_duration_seconds
      ); v_current := 1;
    end if;
    v_response := jsonb_build_object('remoteIdentity','personal:'||(p_payload->>'id'),'revision',v_current);
  elsif p_operation_type='archive_personal' then
    if not (p_payload ? 'id') or exists(select 1 from jsonb_object_keys(p_payload) key where key <> 'id') then raise exception using errcode='22023',message='AMV2_ARCHIVE_PAYLOAD_INVALID'; end if;
    select revision,archived_at into v_current,v_existing_archived_at from public.amv2_personal_exercises where owner_user_id=v_owner and id=p_payload->>'id' for update;
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

alter table public.amv2_personal_exercises enable row level security;
alter table public.amv2_personal_exercises force row level security;
alter table public.amv2_workout_days enable row level security;
alter table public.amv2_workout_days force row level security;
alter table public.amv2_workout_day_exercises enable row level security;
alter table public.amv2_workout_day_exercises force row level security;
alter table public.amv2_workout_day_sets enable row level security;
alter table public.amv2_workout_day_sets force row level security;
alter table public.amv2_operation_receipts enable row level security;
alter table public.amv2_operation_receipts force row level security;
alter table public.amv2_import_batches enable row level security;
alter table public.amv2_import_batches force row level security;

drop policy if exists amv2_personal_owner_select on public.amv2_personal_exercises;
create policy amv2_personal_owner_select on public.amv2_personal_exercises for select to authenticated using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_days_owner_select on public.amv2_workout_days;
create policy amv2_days_owner_select on public.amv2_workout_days for select to authenticated using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_day_exercises_owner_select on public.amv2_workout_day_exercises;
create policy amv2_day_exercises_owner_select on public.amv2_workout_day_exercises for select to authenticated using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_sets_owner_select on public.amv2_workout_day_sets;
create policy amv2_sets_owner_select on public.amv2_workout_day_sets for select to authenticated using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_receipts_owner_select on public.amv2_operation_receipts;
create policy amv2_receipts_owner_select on public.amv2_operation_receipts for select to authenticated using ((select auth.uid())=owner_user_id);
drop policy if exists amv2_imports_owner_select on public.amv2_import_batches;
create policy amv2_imports_owner_select on public.amv2_import_batches for select to authenticated using ((select auth.uid())=owner_user_id);

revoke all on table public.amv2_artifact_registry,public.amv2_canonical_exercises,
  public.amv2_personal_exercises,public.amv2_workout_days,public.amv2_workout_day_exercises,
  public.amv2_workout_day_sets,public.amv2_operation_receipts,public.amv2_import_batches
  from public,anon,authenticated;
grant select on table public.amv2_artifact_registry,public.amv2_canonical_exercises to authenticated;
grant select on table public.amv2_personal_exercises,public.amv2_workout_days,
  public.amv2_workout_day_exercises,public.amv2_workout_day_sets,public.amv2_operation_receipts,
  public.amv2_import_batches to authenticated;
revoke all on function public.amv2_apply_operation(text,text,bigint,jsonb) from public,anon;
grant execute on function public.amv2_apply_operation(text,text,bigint,jsonb) to authenticated;
revoke all on function public.amv2_read_calendar(date,date) from public,anon;
grant execute on function public.amv2_read_calendar(date,date) to authenticated;
revoke all on function public.amv2_validate_personal_exercise_row(),public.amv2_validate_day_exercise_row(),public.amv2_validate_set_row() from public,anon,authenticated;
