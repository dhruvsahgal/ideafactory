-- IdeaFactory Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table public.profiles (
  id uuid primary key default uuid_generate_v4(),
  telegram_user_id bigint unique not null,
  telegram_username text,
  display_name text,
  ideas_this_month integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ideas table
create table public.ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  original_input_type text not null check (original_input_type in ('voice', 'text')),
  transcript text not null,
  transcript_edited text,
  category text not null,
  category_edited text,
  confidence_score numeric(3,2),
  tags text[] default '{}',
  source_context text,
  is_archived boolean default false,
  is_starred boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories table
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  color text,
  idea_count integer default 0,
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- Insights table (cached insights)
create table public.insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  insight_type text not null check (insight_type in ('pattern', 'trend', 'suggestion')),
  content jsonb not null,
  generated_at timestamptz default now(),
  expires_at timestamptz
);

-- Indexes for query performance
create index ideas_user_id_idx on public.ideas(user_id);
create index ideas_category_idx on public.ideas(category);
create index ideas_created_at_idx on public.ideas(created_at);
create index ideas_tags_idx on public.ideas using gin(tags);
create index ideas_user_archived_idx on public.ideas(user_id, is_archived);
create index profiles_telegram_user_id_idx on public.profiles(telegram_user_id);
create index categories_user_id_idx on public.categories(user_id);
create index insights_user_id_idx on public.insights(user_id);

-- Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.categories enable row level security;
alter table public.insights enable row level security;

-- RLS Policies for service role (full access)
-- Note: For web dashboard, you'll add user-specific policies with auth.uid()

create policy "Service role full access to profiles"
  on public.profiles for all
  using (true)
  with check (true);

create policy "Service role full access to ideas"
  on public.ideas for all
  using (true)
  with check (true);

create policy "Service role full access to categories"
  on public.categories for all
  using (true)
  with check (true);

create policy "Service role full access to insights"
  on public.insights for all
  using (true)
  with check (true);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at_column();

create trigger update_ideas_updated_at
  before update on public.ideas
  for each row execute function update_updated_at_column();

-- Function to reset monthly idea counts (run via cron)
create or replace function reset_monthly_idea_counts()
returns void as $$
begin
  update public.profiles set ideas_this_month = 0;
end;
$$ language plpgsql;
