-- Run once in Supabase > SQL Editor. This augments Bloom; it does not wipe local data.
create table if not exists public.bloom_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bloom_states enable row level security;
drop policy if exists "bloom_user_read" on public.bloom_states;
create policy "bloom_user_read" on public.bloom_states for select to authenticated using (auth.uid()=user_id);
drop policy if exists "bloom_user_insert" on public.bloom_states;
create policy "bloom_user_insert" on public.bloom_states for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "bloom_user_update" on public.bloom_states;
create policy "bloom_user_update" on public.bloom_states for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.bloom_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (now() at time zone 'UTC')::date,
  requests int not null default 0,
  primary key (user_id,usage_day)
);
alter table public.bloom_ai_usage enable row level security;
create or replace function public.bloom_charge_request(p_user uuid, p_limit integer default 60)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.bloom_ai_usage(user_id,usage_day,requests)
  values (p_user,(now() at time zone 'UTC')::date,1)
  on conflict (user_id,usage_day)
    do update set requests=public.bloom_ai_usage.requests+1
  returning requests into n;
  return n <= least(greatest(p_limit,1),100);
end $$;
revoke all on function public.bloom_charge_request(uuid,integer) from public, anon, authenticated;
grant execute on function public.bloom_charge_request(uuid,integer) to service_role;

create table if not exists public.bloom_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists bloom_push_subscriptions_user_idx on public.bloom_push_subscriptions(user_id);
alter table public.bloom_push_subscriptions enable row level security;
-- Push subscriptions are writable only through authenticated Netlify Functions using a service key.

create table if not exists public.bloom_reminders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  remind_at timestamptz not null,
  sent_at timestamptz
);
create index if not exists bloom_reminders_due_idx on public.bloom_reminders(remind_at) where sent_at is null;
create index if not exists bloom_reminders_user_idx on public.bloom_reminders(user_id);
alter table public.bloom_reminders enable row level security;
-- Reminders are managed by secured functions; no RLS policy grants direct client access.
