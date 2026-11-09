-- Drepturi VEMI pentru categoriile incluse în abonamente.
-- Se rulează după migrarea 202608040002_vemi_progress.sql.

begin;

create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null
    constraint user_subscriptions_plan_code_check
    check (plan_code in ('go', 'assisted')),
  billing_period text not null
    constraint user_subscriptions_billing_period_check
    check (billing_period in ('one_month', 'three_months')),
  status text not null default 'active'
    constraint user_subscriptions_status_check
    check (status in ('active', 'expired', 'canceled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  canceled_at timestamptz,
  source_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_subscriptions_valid_interval
    check (expires_at > starts_at),
  constraint user_subscriptions_canceled_at_check
    check (status <> 'canceled' or canceled_at is not null),
  constraint user_subscriptions_source_reference_not_empty
    check (char_length(trim(source_reference)) between 1 and 160),
  constraint user_subscriptions_source_reference_unique
    unique (source_reference)
);

create unique index user_subscriptions_one_active_per_user
  on public.user_subscriptions (user_id)
  where status = 'active';

create index user_subscriptions_user_history_idx
  on public.user_subscriptions (user_id, created_at desc);

create index user_subscriptions_entitlement_idx
  on public.user_subscriptions (user_id, status, starts_at, expires_at);

create trigger user_subscriptions_set_updated_at
  before update on public.user_subscriptions
  for each row execute procedure public.set_vemi_updated_at();

alter table public.user_subscriptions enable row level security;
alter table public.user_subscriptions force row level security;

create policy "user_subscriptions_select_own"
on public.user_subscriptions
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.user_subscriptions from public;
revoke all on table public.user_subscriptions from anon;
revoke all on table public.user_subscriptions from authenticated;

grant select (
  id,
  user_id,
  plan_code,
  billing_period,
  status,
  starts_at,
  expires_at,
  canceled_at,
  created_at,
  updated_at
) on table public.user_subscriptions to authenticated;

comment on table public.user_subscriptions is
  'Abonamentele VEMI. Utilizatorii își pot citi exclusiv propriile abonamente și nu le pot crea sau modifica.';

comment on column public.user_subscriptions.source_reference is
  'Identificator administrativ unic și idempotent. Nu este expus utilizatorului.';

comment on column public.user_subscriptions.expires_at is
  'Moment exclusiv: dreptul nu mai este activ când timpul curent este egal sau ulterior acestei valori.';

commit;

-- Revenire controlată, numai înainte ca alte funcții să depindă de tabel:
-- begin;
-- drop trigger if exists user_subscriptions_set_updated_at on public.user_subscriptions;
-- drop table if exists public.user_subscriptions;
-- commit;
