-- Daily learning schedule synced from torahscha.app
-- Run in Supabase → SQL Editor after 0002.

alter table calendar_days
  add column if not exists sync_type  text,         -- daf / chazara / test / yt / ycd / siyum
  add column if not exists sync_topic text,         -- e.g. "עירובין פ׳ · חזרת החודש: דף ס״ג"
  add column if not exists synced_at  timestamptz;
