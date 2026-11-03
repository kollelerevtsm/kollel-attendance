-- Holiday rules, daf auto-fill, review nights.
-- Run in Supabase → SQL Editor after 0004.

alter table settings
  add column if not exists off_holidays       text[] not null default '{yomtov}',
  add column if not exists daf_start_masechta text,
  add column if not exists daf_start_daf      int,
  add column if not exists daf_start_date     date;

alter table calendar_days
  add column if not exists is_review boolean not null default false;
