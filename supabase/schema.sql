create extension if not exists "pgcrypto";

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retailer text not null,
  status text not null check (status in ('draft', 'live', 'paused')),
  start_at timestamptz not null,
  end_at timestamptz,
  probability numeric not null,
  cap_window text not null check (cap_window in ('day', 'week')),
  cap_max integer not null,
  reward_template_ids uuid[] not null,
  message_template_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists reward_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('voucher', 'free_item', 'percent_off')),
  cvs_campaign_id text,
  weight integer not null,
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
  event_id uuid references events(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  reward_template_id uuid references reward_templates(id) on delete set null,
  customer_ref text not null,
  voucher_code text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists message_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  reward_issue_id uuid references reward_issues(id) on delete set null,
  channel text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
