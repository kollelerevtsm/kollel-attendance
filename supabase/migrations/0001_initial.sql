-- Kollel Erev attendance & payroll — initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- ─────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────
create type app_role as enum ('admin', 'principal', 'payroll', 'student');

-- ─────────────────────────────────────────────────────────────
-- Students
-- ─────────────────────────────────────────────────────────────
create table students (
  id                   uuid primary key default gen_random_uuid(),
  first_name           text not null,
  last_name            text not null,
  phone                text not null,
  email                text,
  address              text,
  father_name          text,
  father_in_law_name   text,
  pin                  text not null unique check (pin ~ '^[0-9]{4,10}$'),
  active               boolean not null default true,
  start_date           date not null default current_date,
  fingerprint_enrolled boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index students_email_unique on students (lower(email)) where email is not null;

-- ─────────────────────────────────────────────────────────────
-- Logins: one profile per signed-in user
-- ─────────────────────────────────────────────────────────────
create table staff_invites (
  email      text primary key,           -- always stored lower-case
  role       app_role not null check (role <> 'student'),
  full_name  text,
  created_at timestamptz not null default now()
);

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       app_role not null,
  student_id uuid references students (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Settings (one row)
-- ─────────────────────────────────────────────────────────────
create table settings (
  id               int primary key default 1 check (id = 1),
  session_start    time not null default '20:30',
  session_end      time not null default '21:30',
  clock_in_opens   time not null default '19:30',
  clock_out_closes time not null default '22:00',
  required_minutes int  not null default 60 check (required_minutes between 1 and 600),
  base_rate        numeric(8,2) not null default 15,
  test_rate        numeric(8,2) not null default 20,
  pay_period       text not null default 'monthly' check (pay_period in ('weekly', 'biweekly', 'monthly')),
  session_weekdays int[] not null default '{0,1,2,3,4}',   -- 0 = Sunday … 6 = Saturday
  timezone         text not null default 'America/New_York',
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id)
);
insert into settings (id) values (1);

-- ─────────────────────────────────────────────────────────────
-- Calendar: only nights that differ from the default are stored
-- ─────────────────────────────────────────────────────────────
create table calendar_days (
  day            date primary key,
  is_session     boolean,          -- null = use the default (weekday + holidays)
  learning_topic text,
  is_test_date   boolean not null default false,
  note           text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id)
);

-- Who took the test on each test date
create table test_takers (
  test_date  date not null,
  student_id uuid not null references students (id) on delete cascade,
  source     text not null default 'sheet' check (source in ('sheet', 'scanner')),
  created_at timestamptz not null default now(),
  primary key (test_date, student_id)
);

-- ─────────────────────────────────────────────────────────────
-- Scans from the Anviz W1 Pro (via CrossChex Cloud) — used from Phase 3
-- ─────────────────────────────────────────────────────────────
create table scans (
  id            uuid primary key default gen_random_uuid(),
  external_id   text unique,             -- CrossChex record id, prevents duplicates
  device_serial text,
  user_pin      text not null,
  student_id    uuid references students (id) on delete set null,
  scanned_at    timestamptz not null,
  verify_method text,                    -- fingerprint / pin / card, if CrossChex reports it
  source        text not null default 'webhook' check (source in ('webhook', 'api_sync', 'manual')),
  raw           jsonb,
  created_at    timestamptz not null default now()
);
create index scans_scanned_at_idx on scans (scanned_at);

-- One row per student per session night — filled from Phase 3
create table attendance_nights (
  student_id  uuid not null references students (id) on delete cascade,
  night       date not null,
  clock_in    timestamptz,
  clock_out   timestamptz,
  minutes     int,
  status      text not null check (status in ('paid', 'short', 'absent', 'missing_in', 'missing_out', 'test')),
  rate        numeric(8,2),
  amount      numeric(8,2) not null default 0,
  manual_note text,
  edited_by   uuid references auth.users (id),
  edited_at   timestamptz,
  primary key (student_id, night)
);

create table week_approvals (
  week_start  date primary key,          -- the Sunday
  approved_by uuid references auth.users (id),
  approved_at timestamptz not null default now()
);

create table pay_periods (
  id           uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end   date not null,
  status       text not null default 'ready' check (status in ('ready', 'paid')),
  paid_at      timestamptz,
  paid_by      uuid references auth.users (id),
  unique (period_start, period_end)
);

create table payments (
  pay_period_id uuid not null references pay_periods (id) on delete cascade,
  student_id    uuid not null references students (id) on delete cascade,
  base_nights   int not null default 0,
  test_nights   int not null default 0,
  amount        numeric(10,2) not null default 0,
  check_number  text,
  check_date    date,
  primary key (pay_period_id, student_id)
);

-- Record of every manual change
create table audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid references auth.users (id),
  action     text not null,
  details    jsonb
);

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function current_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from profiles where id = auth.uid()
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_app_role() in ('admin', 'principal', 'payroll'), false)
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger students_touch before update on students for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();
create trigger calendar_touch before update on calendar_days for each row execute function touch_updated_at();

-- When someone signs in for the first time, give them a role:
-- staff invite → that role; email matches a student → student; otherwise no access.
create or replace function link_profile(uid uuid, user_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  inv staff_invites%rowtype;
  stu students%rowtype;
begin
  if exists (select 1 from profiles where id = uid) then
    return;
  end if;
  select * into inv from staff_invites where email = lower(user_email);
  if found then
    insert into profiles (id, email, full_name, role) values (uid, lower(user_email), inv.full_name, inv.role);
    return;
  end if;
  select * into stu from students where lower(email) = lower(user_email) and active;
  if found then
    insert into profiles (id, email, full_name, role, student_id)
    values (uid, lower(user_email), stu.first_name || ' ' || stu.last_name, 'student', stu.id);
  end if;
end $$;
revoke execute on function link_profile(uuid, text) from public, anon, authenticated;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform link_profile(new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Called by the app after sign-in, for people invited after their first sign-in.
create or replace function claim_profile() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform link_profile(auth.uid(), (select email from auth.users where id = auth.uid()));
end $$;
grant execute on function claim_profile() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row-level security: who can see and change what
-- ─────────────────────────────────────────────────────────────
alter table students          enable row level security;
alter table staff_invites     enable row level security;
alter table profiles          enable row level security;
alter table settings          enable row level security;
alter table calendar_days     enable row level security;
alter table test_takers       enable row level security;
alter table scans             enable row level security;
alter table attendance_nights enable row level security;
alter table week_approvals    enable row level security;
alter table pay_periods       enable row level security;
alter table payments          enable row level security;
alter table audit_log         enable row level security;

-- Students: staff read; admin + principal write; a student reads only their own row
create policy students_staff_read on students for select using (is_staff());
create policy students_self_read  on students for select using (id = current_student_id());
create policy students_write on students for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Staff invites & profiles: admin manages; everyone reads their own profile
create policy invites_admin on staff_invites for all
  using (current_app_role() = 'admin') with check (current_app_role() = 'admin');
create policy profiles_self_read  on profiles for select using (id = auth.uid());
create policy profiles_admin_read on profiles for select using (current_app_role() = 'admin');
create policy profiles_admin_write on profiles for update
  using (current_app_role() = 'admin') with check (current_app_role() = 'admin');
create policy profiles_admin_delete on profiles for delete using (current_app_role() = 'admin');

-- Settings: everyone signed in reads; admin + principal change
create policy settings_read  on settings for select using (auth.uid() is not null);
create policy settings_write on settings for update
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Calendar: everyone signed in reads; admin + principal change
create policy calendar_read  on calendar_days for select using (auth.uid() is not null);
create policy calendar_write on calendar_days for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Test takers: staff read, student reads own, admin + principal write
create policy tests_staff_read on test_takers for select using (is_staff());
create policy tests_self_read  on test_takers for select using (student_id = current_student_id());
create policy tests_write on test_takers for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Scans: staff read (writes come from the server only)
create policy scans_staff_read on scans for select using (is_staff());

-- Attendance: staff read, student reads own, admin + principal write
create policy att_staff_read on attendance_nights for select using (is_staff());
create policy att_self_read  on attendance_nights for select using (student_id = current_student_id());
create policy att_write on attendance_nights for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Week approvals: staff read, admin + principal write
create policy weeks_read  on week_approvals for select using (is_staff());
create policy weeks_write on week_approvals for all
  using (current_app_role() in ('admin', 'principal'))
  with check (current_app_role() in ('admin', 'principal'));

-- Pay periods & payments: staff read, student reads own payments, admin + payroll write
create policy periods_read  on pay_periods for select using (is_staff() or current_app_role() = 'student');
create policy periods_write on pay_periods for all
  using (current_app_role() in ('admin', 'payroll'))
  with check (current_app_role() in ('admin', 'payroll'));
create policy payments_staff_read on payments for select using (is_staff());
create policy payments_self_read  on payments for select using (student_id = current_student_id());
create policy payments_write on payments for all
  using (current_app_role() in ('admin', 'payroll'))
  with check (current_app_role() in ('admin', 'payroll'));

-- Audit log: admin reads; any staff member can add entries
create policy audit_admin_read on audit_log for select using (current_app_role() = 'admin');
create policy audit_staff_insert on audit_log for insert with check (is_staff() and user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- First admin: replace the email below with the admin's login email, then run.
-- ─────────────────────────────────────────────────────────────
-- insert into staff_invites (email, role, full_name) values ('you@example.com', 'admin', 'Zev');
