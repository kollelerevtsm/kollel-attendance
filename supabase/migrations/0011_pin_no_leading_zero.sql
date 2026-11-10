-- CrossChex drops leading zeros from employee IDs (0243 becomes 243), so PINs never start with 0.

alter table students drop constraint if exists students_pin_check;
alter table students drop constraint if exists students_test_pin_check;

-- Fix existing PINs that start with 0 (skipped if the shorter number is already taken).
update students s
   set pin = ltrim(s.pin, '0'),
       test_pin = case when s.test_pin = '9' || s.pin then '9' || ltrim(s.pin, '0') else s.test_pin end
 where s.pin like '0%'
   and length(ltrim(s.pin, '0')) >= 3
   and not exists (select 1 from students o where o.id <> s.id and (o.pin = ltrim(s.pin, '0') or o.test_pin = ltrim(s.pin, '0') or o.test_pin = '9' || ltrim(s.pin, '0')));

alter table students add constraint students_pin_check check (pin ~ '^[0-9]{3,10}$');
alter table students add constraint students_test_pin_check check (test_pin ~ '^[0-9]{3,12}$');
