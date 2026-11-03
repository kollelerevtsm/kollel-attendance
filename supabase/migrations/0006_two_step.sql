-- Two-step verification codes sent by email. Only the server (service key) reads or writes this table.
-- Run in Supabase → SQL Editor after 0005.

create table if not exists mfa_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash  text not null,
  expires_at timestamptz not null,
  sent_at    timestamptz not null default now(),
  attempts   int not null default 0
);
alter table mfa_codes enable row level security;
-- No policies: signed-in users can't read or change codes; the server uses the service key.
