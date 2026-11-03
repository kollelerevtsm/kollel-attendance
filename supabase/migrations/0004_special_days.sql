-- Special day types (Chol Hamoed, Erev Yom Tov, …) and the date ranges they apply to.
-- Run in Supabase → SQL Editor after 0003.

create table day_types (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  clock_in_opens   time not null,
  clock_out_closes time not null,
  session_start    time not null,
  session_end      time not null,
  required_minutes int  not null check (required_minutes between 1 and 1440),
  base_rate        numeric(8,2),   -- null = use the regular rate
  test_rate        numeric(8,2),   -- null = use the regular rate
  color            text not null default 'purple',
  created_at       timestamptz not null default now()
);

create table special_periods (
  id          uuid primary key default gen_random_uuid(),
  day_type_id uuid not null references day_types (id) on delete cascade,
  start_date  date not null,
  end_date    date not null check (end_date >= start_date),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id)
);
create index special_periods_range_idx on special_periods (start_date, end_date);

alter table day_types       enable row level security;
alter table special_periods enable row level security;

create policy day_types_read  on day_types for select using (auth.uid() is not null);
create policy day_types_write on day_types for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

create policy periods_sp_read  on special_periods for select using (auth.uid() is not null);
create policy periods_sp_write on special_periods for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Starting examples; change them in Settings.
insert into day_types (name, clock_in_opens, clock_out_closes, session_start, session_end, required_minutes, color) values
  ('Chol Hamoed', '09:00', '13:30', '09:30', '12:30', 180, 'amber'),
  ('Erev Yom Tov', '19:00', '21:30', '19:30', '20:30', 45, 'purple');
