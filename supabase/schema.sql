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

create table if not exists sd_programs (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sd_campaigns (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references sd_programs(id) on delete cascade,
  name text not null,
  status text not null check (status in ('draft', 'live', 'paused')),
  start_at timestamptz not null,
  end_at timestamptz,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sd_campaign_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references sd_campaigns(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists sd_campaign_versions_unique
  on sd_campaign_versions (campaign_id, version);

create table if not exists sd_program_counters (
  program_id text primary key references sd_programs(id) on delete cascade,
  counter_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists sd_non_reward_counters (
  campaign_version_id uuid primary key references sd_campaign_versions(id) on delete cascade,
  counter_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists sd_decisions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  program_id text not null references sd_programs(id) on delete cascade,
  campaign_id uuid references sd_campaigns(id) on delete set null,
  campaign_version_id uuid references sd_campaign_versions(id) on delete set null,
  campaign_version_number integer,
  store_id text,
  amount integer,
  channel text,
  mcc text,
  occurred_at timestamptz,
  counter_value bigint not null,
  matched_rule_id text,
  matched_rule_n integer,
  matched_rule_priority integer,
  reward_template_id uuid references reward_templates(id) on delete set null,
  reward_template_name text,
  outcome_type text not null check (outcome_type in ('reward', 'no_reward')),
  status text not null check (status in ('pending', 'issuing', 'issued', 'no_reward', 'issue_failed')),
  voucher_code text,
  cvs_reference text,
  competition_entry boolean not null default false,
  message_template_id uuid references message_templates(id) on delete set null,
  entry_message_template_id uuid references message_templates(id) on delete set null,
  decision_trace jsonb,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sd_decisions_program_idx
  on sd_decisions (program_id, created_at desc);
create index if not exists sd_decisions_rule_idx
  on sd_decisions (campaign_version_id, matched_rule_id, created_at desc);

create or replace function sd_reserve_decision(
  p_transaction_id text,
  p_program_id text,
  p_campaign_id uuid,
  p_campaign_version_id uuid,
  p_campaign_version_number integer,
  p_store_id text,
  p_amount integer,
  p_channel text,
  p_mcc text,
  p_occurred_at timestamptz,
  p_event jsonb
) returns table (
  id uuid,
  transaction_id text,
  program_id text,
  campaign_id uuid,
  campaign_version_id uuid,
  campaign_version_number integer,
  counter_value bigint,
  status text,
  outcome_type text,
  reward_template_id uuid,
  matched_rule_id text,
  competition_entry boolean,
  voucher_code text,
  is_duplicate boolean
) language plpgsql as $$
declare
  existing sd_decisions%rowtype;
  new_counter bigint;
  inserted sd_decisions%rowtype;
begin
  select * into existing from sd_decisions where transaction_id = p_transaction_id;
  if found then
    return query
    select
      existing.id,
      existing.transaction_id,
      existing.program_id,
      existing.campaign_id,
      existing.campaign_version_id,
      existing.campaign_version_number,
      existing.counter_value,
      existing.status,
      existing.outcome_type,
      existing.reward_template_id,
      existing.matched_rule_id,
      existing.competition_entry,
      existing.voucher_code,
      true;
    return;
  end if;

  insert into sd_program_counters (program_id, counter_value)
  values (p_program_id, 1)
  on conflict (program_id)
  do update set counter_value = sd_program_counters.counter_value + 1, updated_at = now()
  returning counter_value into new_counter;

  insert into sd_decisions (
    transaction_id,
    program_id,
    campaign_id,
    campaign_version_id,
    campaign_version_number,
    store_id,
    amount,
    channel,
    mcc,
    occurred_at,
    counter_value,
    status,
    outcome_type,
    event_payload
  ) values (
    p_transaction_id,
    p_program_id,
    p_campaign_id,
    p_campaign_version_id,
    p_campaign_version_number,
    p_store_id,
    p_amount,
    p_channel,
    p_mcc,
    p_occurred_at,
    new_counter,
    'pending',
    'no_reward',
    coalesce(p_event, '{}'::jsonb)
  )
  returning * into inserted;

  return query
  select
    inserted.id,
    inserted.transaction_id,
    inserted.program_id,
    inserted.campaign_id,
    inserted.campaign_version_id,
    inserted.campaign_version_number,
    inserted.counter_value,
    inserted.status,
    inserted.outcome_type,
    inserted.reward_template_id,
    inserted.matched_rule_id,
    inserted.competition_entry,
    inserted.voucher_code,
    false;
end;
$$;

create or replace function sd_increment_non_reward_counter(
  p_campaign_version_id uuid
) returns table (
  counter_value bigint
) language plpgsql as $$
declare
  new_counter bigint;
begin
  insert into sd_non_reward_counters (campaign_version_id, counter_value)
  values (p_campaign_version_id, 1)
  on conflict (campaign_version_id)
  do update set counter_value = sd_non_reward_counters.counter_value + 1, updated_at = now()
  returning counter_value into new_counter;

  return query select new_counter;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
grant execute on function sd_reserve_decision to anon, authenticated;
grant execute on function sd_increment_non_reward_counter to anon, authenticated;

do $$
declare
  program_id text := 'kfc';
  burger_id uuid;
  meal_id uuid;
  big_id uuid;
  entry_message_id uuid;
  campaign_uuid uuid;
  version_uuid uuid;
begin
  if not exists (select 1 from sd_programs where id = program_id) then
    insert into sd_programs (id, name) values (program_id, 'KFC');
  end if;

  if not exists (select 1 from reward_templates where name = 'Free Burger') then
    insert into reward_templates (name, type, cvs_campaign_id, weight)
    values ('Free Burger', 'free_item', 'CVS-KFC-BURGER', 0)
    returning id into burger_id;
  else
    select id into burger_id from reward_templates where name = 'Free Burger' limit 1;
  end if;

  if not exists (select 1 from reward_templates where name = 'Free Meal') then
    insert into reward_templates (name, type, cvs_campaign_id, weight)
    values ('Free Meal', 'free_item', 'CVS-KFC-MEAL', 0)
    returning id into meal_id;
  else
    select id into meal_id from reward_templates where name = 'Free Meal' limit 1;
  end if;

  if not exists (select 1 from reward_templates where name = 'Big Reward') then
    insert into reward_templates (name, type, cvs_campaign_id, weight)
    values ('Big Reward', 'voucher', 'CVS-KFC-BIG', 0)
    returning id into big_id;
  else
    select id into big_id from reward_templates where name = 'Big Reward' limit 1;
  end if;

  if not exists (select 1 from message_templates where name = 'Entry Confirmation') then
    insert into message_templates (name, channel, body, fallback_body)
    values (
      'Entry Confirmation',
      'whatsapp',
      'You have been entered into the draw. Good luck!',
      'You have been entered into the draw.'
    )
    returning id into entry_message_id;
  else
    select id into entry_message_id from message_templates where name = 'Entry Confirmation' limit 1;
  end if;

  if not exists (select 1 from sd_campaigns where name = 'KFC Surprise & Delight') then
    insert into sd_campaigns (program_id, name, status, start_at, end_at)
    values (program_id, 'KFC Surprise & Delight', 'live', now(), null)
    returning id into campaign_uuid;
  else
    select id into campaign_uuid from sd_campaigns where name = 'KFC Surprise & Delight' limit 1;
  end if;

  if not exists (select 1 from sd_campaign_versions where campaign_id = campaign_uuid and version = 1) then
    insert into sd_campaign_versions (campaign_id, version, status, config)
    values (
      campaign_uuid,
      1,
      'published',
      jsonb_build_object(
        'eligibility', jsonb_build_object(
          'minSpend', 0,
          'stores', jsonb_build_array(),
          'channels', jsonb_build_array(),
          'daysOfWeek', jsonb_build_array(),
          'timeWindows', jsonb_build_array(),
          'mccs', jsonb_build_array()
        ),
        'rewardRules', jsonb_build_array(
          jsonb_build_object(
            'id', 'rule-100',
            'name', 'Every 100th',
            'nth', 100,
            'rewardTemplateId', big_id,
            'priority', 100,
            'enabled', true,
            'dailyCap', null,
            'totalCap', null
          ),
          jsonb_build_object(
            'id', 'rule-20',
            'name', 'Every 20th',
            'nth', 20,
            'rewardTemplateId', meal_id,
            'priority', 20,
            'enabled', true,
            'dailyCap', null,
            'totalCap', null
          ),
          jsonb_build_object(
            'id', 'rule-5',
            'name', 'Every 5th',
            'nth', 5,
            'rewardTemplateId', burger_id,
            'priority', 5,
            'enabled', true,
            'dailyCap', null,
            'totalCap', null
          )
        ),
        'competitionRule', jsonb_build_object(
          'type', 'all_non_reward',
          'messageTemplateId', entry_message_id
        )
      )
    )
    returning id into version_uuid;
  else
    select id into version_uuid
      from sd_campaign_versions
      where campaign_id = campaign_uuid and version = 1
      limit 1;
  end if;

  update sd_campaigns
  set current_version_id = version_uuid
  where id = campaign_uuid;
end $$;
