set lock_timeout = '5s';
set statement_timeout = '60s';

do $baseline$
begin
  if (select count(*) from public.exercises) <> 157 then
    raise exception 'VEMI baseline mismatch: expected 157 exercises';
  end if;
  if (select count(*) from public.exercises where is_active) <> 114 then
    raise exception 'VEMI baseline mismatch: expected 114 active exercises';
  end if;
  if (select count(*) from public.exercises where not is_active) <> 43 then
    raise exception 'VEMI baseline mismatch: expected 43 inactive exercises';
  end if;
  if (select count(*) from public.exercise_collection_memberships) <> 149 then
    raise exception 'VEMI baseline mismatch: expected 149 memberships';
  end if;
  if (select count(*) from public.exercise_aliases) <> 11 then
    raise exception 'VEMI baseline mismatch: expected 11 aliases';
  end if;
  if (select count(*) from public.exercise_videos) <> 5 then
    raise exception 'VEMI baseline mismatch: expected 5 video rows';
  end if;
  if (select count(*) from public.exercises) <> (select count(distinct exercise_key) from public.exercises) then
    raise exception 'VEMI baseline mismatch: duplicate exercise_key detected';
  end if;
end
$baseline$;

alter table public.exercises
  add column if not exists recommended_display text,
  add column if not exists instruction_1 text,
  add column if not exists instruction_2 text;