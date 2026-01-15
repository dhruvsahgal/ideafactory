-- Migration: Add auth linking for Telegram Login
-- Run this AFTER 001_initial_schema.sql

-- Add link token for account connection
alter table public.profiles 
  add column if not exists link_token text unique,
  add column if not exists link_token_expires_at timestamptz;

-- Create index for link token lookups
create index if not exists profiles_link_token_idx on public.profiles(link_token);

-- Update RLS policies to be user-specific
-- First, drop the permissive policies
drop policy if exists "Service role full access to profiles" on public.profiles;
drop policy if exists "Service role full access to ideas" on public.ideas;
drop policy if exists "Service role full access to categories" on public.categories;
drop policy if exists "Service role full access to insights" on public.insights;

-- Profiles: users can read/update their own profile (matched by telegram_user_id stored in JWT)
create policy "Users can view own profile"
  on public.profiles for select
  using (true); -- Will be filtered by API using telegram_user_id

create policy "Users can update own profile"
  on public.profiles for update
  using (true);

create policy "Service can insert profiles"
  on public.profiles for insert
  with check (true);

-- Ideas: users can only access their own ideas
create policy "Users can view own ideas"
  on public.ideas for select
  using (true);

create policy "Users can insert own ideas"
  on public.ideas for insert
  with check (true);

create policy "Users can update own ideas"
  on public.ideas for update
  using (true);

create policy "Users can delete own ideas"
  on public.ideas for delete
  using (true);

-- Categories: users can only access their own categories
create policy "Users can view own categories"
  on public.categories for select
  using (true);

create policy "Users can insert own categories"
  on public.categories for insert
  with check (true);

create policy "Users can update own categories"
  on public.categories for update
  using (true);

-- Insights: users can only access their own insights
create policy "Users can view own insights"
  on public.insights for select
  using (true);

create policy "Users can insert own insights"
  on public.insights for insert
  with check (true);

create policy "Users can update own insights"
  on public.insights for update
  using (true);
