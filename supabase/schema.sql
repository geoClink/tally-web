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

create policy "Users can insert own subscriptions"
  on subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on subscriptions for update
  using (auth.uid() = user_id);

-- Index for fast per-user lookups
create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

-- NOTE: In production, subscription writes after Stripe payment should be done
-- via a Supabase Edge Function triggered by a Stripe webhook — not from the client.
-- The client-side write on the success page is acceptable for an MVP but not secure.
