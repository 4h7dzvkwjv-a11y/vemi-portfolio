-- Faza 2 Modul video VEMI: metadate pentru videoclipuri păstrate în bucketul R2 privat.
-- Se rulează după 202608040003_vemi_exercise_catalog.sql.
-- Migrarea nu încarcă fișiere, nu activează acces public R2 și nu creează date demonstrative.

begin;

create table public.exercise_videos (
  exercise_key text primary key
    references public.exercises(exercise_key)
    on update cascade
    on delete restrict,
  video_object_key text not null unique,
  poster_object_key text unique,
  mime_type text not null default 'video/mp4'
    check (mime_type in ('video/mp4', 'video/webm')),
  duration_seconds numeric(7,3)
    check (duration_seconds is null or duration_seconds > 0),
  width_pixels integer
    check (width_pixels is null or width_pixels > 0),
  height_pixels integer
    check (height_pixels is null or height_pixels > 0),
  file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exercise_videos_video_key_safe
    check (video_object_key <> '' and video_object_key !~ '(^/|\.\.)'),
  constraint exercise_videos_poster_key_safe
    check (poster_object_key is null or (poster_object_key <> '' and poster_object_key !~ '(^/|\.\.)'))
);

create index exercise_videos_active_idx
  on public.exercise_videos (is_active, exercise_key);

create trigger exercise_videos_set_updated_at
  before update on public.exercise_videos
  for each row execute procedure public.set_vemi_updated_at();

alter table public.exercise_videos enable row level security;

create policy "exercise_videos_read_active"
on public.exercise_videos
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.exercises e
    where e.exercise_key = exercise_videos.exercise_key
      and e.is_active = true
  )
);

create policy "exercise_videos_admin_read"
on public.exercise_videos
for select
to authenticated
using (public.is_admin());

create policy "exercise_videos_admin_insert"
on public.exercise_videos
for insert
to authenticated
with check (public.is_admin());

create policy "exercise_videos_admin_update"
on public.exercise_videos
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "exercise_videos_admin_delete"
on public.exercise_videos
for delete
to authenticated
using (public.is_admin());

revoke all on table public.exercise_videos from anon, authenticated;
grant select on table public.exercise_videos to anon, authenticated;
grant insert, update, delete on table public.exercise_videos to authenticated;

comment on table public.exercise_videos is
  'Metadate VEMI pentru câte un videoclip canonic per exercise_key; fișierele rămân în R2 privat.';
comment on column public.exercise_videos.video_object_key is
  'Cheia obiectului R2, nu un URL public. URL-ul temporar se generează exclusiv server-side.';
comment on column public.exercise_videos.poster_object_key is
  'Cheia opțională a posterului R2 privat, semnată separat server-side.';
comment on column public.exercise_videos.is_active is
  'Devine true numai după ce videoclipul și posterul au fost încărcate și verificate.';

commit;
