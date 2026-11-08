-- A second scanner ID per student, used with a different finger to mark "took the test".
-- Run in Supabase → SQL Editor after 0007.
alter table students add column if not exists test_pin text unique check (test_pin ~ '^[0-9]{4,12}$');
update students set test_pin = '9' || pin where test_pin is null;
