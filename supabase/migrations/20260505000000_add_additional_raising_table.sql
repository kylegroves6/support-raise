create table if not exists additional_raising (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  amount numeric not null default 0,
  created_at timestamptz default now()
);

alter table additional_raising enable row level security;

create policy "Users manage own additional raising"
  on additional_raising for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
