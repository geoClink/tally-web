-- Run this in the Supabase SQL editor to create the subscriptions table.
-- Do NOT modify the existing tables (sessions, client_rates, config, workspaces, workspace_members).

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tier text not null check (tier in ('free', 'pro', 'business')) default 'free',
  source text not null check (source in ('ios', 'stripe')),
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Insert and update are intentionally blocked for regular users.
-- Only the service role (Stripe webhook Edge Function) can write to this table.

-- Index for fast per-user lookups
create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

-- ── Subscribers (landing page email capture) ──────────────────────────────────
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

alter table subscribers enable row level security;

-- Allow anonymous visitors to subscribe; no select/update/delete from client
create policy "Anyone can subscribe"
  on subscribers for insert
  with check (true);
