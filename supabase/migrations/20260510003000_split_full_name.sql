-- Split full_name into first_name + last_name + optional organization.
-- letter_address_name is removed (salutation and org replace its use cases).

alter table contacts
  add column if not exists first_name  text not null default '',
  add column if not exists last_name   text not null default '',
  add column if not exists organization text;

-- Backfill: everything before the first space → first_name, rest → last_name.
update contacts
set
  first_name = split_part(full_name, ' ', 1),
  last_name  = case
    when position(' ' in full_name) > 0
      then trim(substring(full_name from position(' ' in full_name) + 1))
    else ''
  end
where full_name is not null and full_name <> '';

-- Also auto-populate salutation from first_name where salutation is blank.
update contacts
set salutation = split_part(full_name, ' ', 1)
where (salutation is null or salutation = '')
  and full_name is not null and full_name <> '';

alter table contacts drop column if exists letter_address_name;
