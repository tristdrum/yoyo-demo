create extension if not exists "pgcrypto";

create table if not exists reward_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('voucher', 'free_item', 'percent_off')),
  cvs_campaign_id text,
  weight integer not null check (weight >= 0),
  created_at timestamptz not null default now()
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  body text not null,
  fallback_body text,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retailer text not null,
  status text not null check (status in ('draft', 'live', 'paused')),
  start_at timestamptz not null,
  end_at timestamptz,
  probability numeric not null check (probability >= 0 and probability <= 1),
  cap_window text not null check (cap_window in ('day', 'week')),
  cap_max integer not null check (cap_max >= 1),
  reward_template_ids uuid[] not null default '{}',
  message_template_id uuid references message_templates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  amount integer not null,
  store_ref text not null,
  customer_ref text not null,
  msisdn text,
  created_at timestamptz not null default now()
);

create table if not exists reward_issues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete restrict,
  reward_template_id uuid not null references reward_templates(id) on delete restrict,
  customer_ref text not null,
  voucher_code text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists message_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  reward_issue_id uuid references reward_issues(id) on delete cascade,
  channel text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

do $$
declare
  reward_id uuid;
  message_id uuid;
begin
  if not exists (select 1 from reward_templates) then
    insert into reward_templates (name, type, cvs_campaign_id, weight)
    values ('Free pastry', 'free_item', '52441', 100)
    returning id into reward_id;
  else
    select id into reward_id from reward_templates order by created_at limit 1;
  end if;

  if not exists (select 1 from message_templates) then
    insert into message_templates (name, channel, body, fallback_body)
    values (
      'Default WhatsApp',
      'whatsapp',
      'You just unlocked {{reward}}. Show this code: {{voucher}}',
      'You unlocked {{reward}}. Code: {{voucher}}'
    )
    returning id into message_id;
  else
    select id into message_id from message_templates order by created_at limit 1;
  end if;

  if not exists (select 1 from campaigns) then
    insert into campaigns (
      name,
      retailer,
      status,
      start_at,
      end_at,
      probability,
      cap_window,
      cap_max,
      reward_template_ids,
      message_template_id
    )
    values (
      'Surprise & Delight - Morning Rush',
      'YoYo Demo Retailer',
      'live',
      now(),
      null,
      0.02,
      'week',
      1,
      array[reward_id],
      message_id
    );
  end if;
end $$;
