-- How many days after a test a student can still claim it (0 = only on the test night).
-- Run in Supabase → SQL Editor after 0006.
alter table settings add column if not exists test_claim_days int not null default 0 check (test_claim_days between 0 and 60);
