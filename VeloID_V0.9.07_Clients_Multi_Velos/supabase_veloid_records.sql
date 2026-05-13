-- V0.9.06 — Table générique par record (inchangé par rapport V0.9.05)
create extension if not exists pgcrypto;

create table if not exists public.veloid_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  device_id text null,
  created_at timestamptz not null default now()
);

create unique index if not exists veloid_records_unique_record
on public.veloid_records (user_id, record_type, record_id);

alter table public.veloid_records enable row level security;

drop policy if exists "Users can read their own records" on public.veloid_records;
drop policy if exists "Users can insert their own records" on public.veloid_records;
drop policy if exists "Users can update their own records" on public.veloid_records;
drop policy if exists "Users can delete their own records" on public.veloid_records;

create policy "Users can read their own records"
on public.veloid_records for select
using (auth.uid() = user_id);

create policy "Users can insert their own records"
on public.veloid_records for insert
with check (auth.uid() = user_id);

create policy "Users can update their own records"
on public.veloid_records for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own records"
on public.veloid_records for delete
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
