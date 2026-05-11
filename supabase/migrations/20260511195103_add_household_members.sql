-- Household members table
-- Stores additional people attached to a contact (spouse, partner, child, etc.)
-- The contact row remains the primary record; this table is additive.
-- organization on contacts stays as the human-readable display name for letters.

create table if not exists household_members (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contacts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  first_name  text not null,
  last_name   text,          -- null = shares contact's last name
  role        text not null default 'spouse'
                check (role in ('spouse','partner','child','other')),
  created_at  timestamptz not null default now()
);

-- RLS
alter table household_members enable row level security;

create policy "Users can read their own household members"
  on household_members for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own household members"
  on household_members for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own household members"
  on household_members for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own household members"
  on household_members for delete
  using ((select auth.uid()) = user_id);

-- Index for the common lookup: all members for a given contact
create index household_members_contact_id_idx on household_members(contact_id);
-- Index for conflict detection: find all members by user + first name
create index household_members_user_first_name_idx on household_members(user_id, lower(first_name));
