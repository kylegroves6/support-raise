-- Replace household_members table with flat couple fields on contacts.
-- is_couple flags the contact as a couple/family.
-- spouse_first_name stores the partner's first name for salutation generation.

drop table if exists household_members;

alter table contacts
  add column if not exists is_couple boolean not null default false,
  add column if not exists spouse_first_name text;
