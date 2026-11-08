-- On test night a test taker clocks in, scans his test finger, and clocks out: In, Test, Out.
alter table settings add column if not exists test_night_attendance boolean not null default true;
