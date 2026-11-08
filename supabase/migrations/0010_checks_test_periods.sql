-- Pay period from one בחינה to the next, and business-check printing.

alter table settings drop constraint if exists settings_pay_period_check;
alter table settings add constraint settings_pay_period_check
  check (pay_period in ('weekly', 'biweekly', 'monthly', 'test'));

-- Bank and check details. Only the admin and payroll can see or change them.
create table if not exists check_settings (
  id                 int primary key default 1 check (id = 1),
  payer_name         text not null default '',
  payer_address      text not null default '',
  bank_name          text not null default '',
  bank_address       text not null default '',
  fractional_routing text not null default '',
  routing_number     text not null default '' check (routing_number = '' or routing_number ~ '^[0-9]{9}$'),
  account_number     text not null default '' check (account_number = '' or account_number ~ '^[0-9]{4,17}$'),
  next_check_number  int  not null default 1001 check (next_check_number > 0),
  memo               text not null default '',
  stock              text not null default 'blank' check (stock in ('blank', 'preprinted')),
  offset_x           numeric(4,2) not null default 0,
  offset_y           numeric(4,2) not null default 0,
  updated_at         timestamptz not null default now()
);
insert into check_settings (id) values (1) on conflict do nothing;

alter table check_settings enable row level security;
drop policy if exists check_settings_rw on check_settings;
create policy check_settings_rw on check_settings for all
  using (current_app_role() in ('admin', 'payroll'))
  with check (current_app_role() in ('admin', 'payroll'));
