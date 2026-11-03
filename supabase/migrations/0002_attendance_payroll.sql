-- Phase 3–4: manual fixes, test-rate tracking, manual scans
-- Run in Supabase → SQL Editor after 0001_initial.sql.

alter table attendance_nights
  add column if not exists manual_clock_in   timestamptz,
  add column if not exists manual_clock_out  timestamptz,
  add column if not exists test_rate_applied boolean not null default false,
  add column if not exists reason            text;

-- Admin and principal can add or remove scans entered by hand (for fixes and testing).
create policy scans_manual_insert on scans for insert
  with check (current_app_role() in ('admin', 'principal') and source = 'manual');
create policy scans_manual_delete on scans for delete
  using (current_app_role() in ('admin', 'principal') and source = 'manual');

create index if not exists attendance_night_idx on attendance_nights (night);
