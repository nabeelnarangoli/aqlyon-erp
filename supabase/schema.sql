-- =====================================================================
--  AQLYON BRAND MANAGEMENT — Agency ERP
--  Supabase / PostgreSQL schema
--  Run once in Supabase → SQL Editor (safe to re-run: uses IF NOT EXISTS
--  and CREATE OR REPLACE where possible).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ROLES & PROFILES
-- ---------------------------------------------------------------------
do $$ begin
  create type app_role as enum ('admin','marketer','designer','finance');
exception when duplicate_object then null; end $$;

-- Custom roles: the admin builds roles from permissions in Team & Access → Roles.
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique,                  -- set only for the built-in starting roles
  name        text not null unique,
  description text,
  color       text not null default 'slate',
  permissions text[] not null default '{}', -- '*' = everything (Administrator)
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);
insert into public.roles (key, name, color, is_system, description, permissions) values
  ('admin', 'Administrator', 'dark', true, 'Full access to everything', '{*}'),
  ('marketer', 'Digital Marketer', 'green', false, 'Leads, clients, tasks, calendar and quotations',
   '{leads.view,leads.manage,clients.view,clients.manage,packages.view,packages.manage,projects.view,projects.manage,tasks.view,tasks.manage,tasks.review,calendar.view,calendar.manage,timesheet.all,quotations.view,quotations.manage,invoices.view,suppliers.view,suppliers.manage,reports.sales,reports.team,reports.content,reports.clients}'),
  ('designer', 'Graphic Designer', 'violet', false, 'Works on design tasks and uploads proofs',
   '{clients.view,projects.view,tasks.view,tasks.work,calendar.view}'),
  ('finance', 'Finance', 'amber', false, 'Invoices, payments, expenses and suppliers',
   '{money.view,clients.view,packages.view,quotations.view,quotations.manage,invoices.view,invoices.manage,payments.manage,expenses.manage,suppliers.view,suppliers.manage,suppliers.pay,reports.finance,reports.clients}')
on conflict (key) do nothing;

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text,
  phone         text,
  role          app_role not null default 'designer',
  designation   text,
  avatar_url    text,
  cost_per_hour numeric(10,2) not null default 0,   -- internal cost, for profitability
  weekly_hours  numeric(5,1)  not null default 48,  -- capacity, for utilisation
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.profiles add column if not exists role_id    uuid references public.roles(id) on delete restrict;
alter table public.profiles add column if not exists work_days  text[] not null default '{Mon,Tue,Wed,Thu,Fri,Sat}';
alter table public.profiles add column if not exists work_start time not null default '09:30';
alter table public.profiles add column if not exists work_end   time not null default '18:30';
alter table public.profiles add column if not exists joined_on  date;
-- move the old fixed role onto the new roles table (one-time, safe to re-run)
update public.profiles p set role_id = r.id from public.roles r where p.role_id is null and r.key = p.role::text;

-- Salary is private: kept apart from profiles (which everyone can read for names).
create table if not exists public.staff_pay (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  monthly_salary numeric(12,2) not null default 0,
  cost_per_hour  numeric(10,2) not null default 0,   -- salary ÷ monthly working hours (auto-calculated)
  updated_at     timestamptz not null default now()
);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='cost_per_hour') then
    insert into public.staff_pay(user_id, cost_per_hour) select id, cost_per_hour from public.profiles where cost_per_hour > 0
      on conflict (user_id) do nothing;
    alter table public.profiles drop column cost_per_hour;
  end if;
end $$;

create or replace function public.staff_pay_calc() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int; h numeric;
begin
  select coalesce(array_length(work_days,1),6), greatest(extract(epoch from (work_end - work_start))/3600, 1)
    into d, h from public.profiles where id = new.user_id;
  if coalesce(new.monthly_salary,0) > 0 then
    new.cost_per_hour := round(new.monthly_salary / (d * h * 52 / 12.0), 2);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_staff_pay_calc on public.staff_pay;
create trigger trg_staff_pay_calc before insert or update on public.staff_pay for each row execute function public.staff_pay_calc();

-- permissions of the signed-in user
create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select r.permissions from public.profiles p join public.roles r on r.id = p.role_id
                   where p.id = auth.uid() and p.active), '{}')
$$;
-- finance permissions only count together with money.view ("See prices & money")
create or replace function public.money_perms() returns text[] language sql immutable as $$
  select array['quotations.view','quotations.manage','invoices.view','invoices.manage','payments.manage','expenses.manage','suppliers.view','suppliers.manage','suppliers.pay','reports.finance','reports.clients']::text[]
$$;
create or replace function public.has_perm(variadic perms text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select '*' = any(m) or exists (
    select 1 from unnest(perms) w
    where w = any(m) and (not (w = any(public.money_perms())) or 'money.view' = any(m)))
  from (select public.my_perms() as m) x
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role_id is not null)
$$;
create or replace function public.my_role_id() returns uuid
language sql stable security definer set search_path = public as $$
  select role_id from public.profiles where id = auth.uid() and active
$$;

-- legacy helpers (fixed roles) kept for backwards compatibility
-- current user's role (security definer so RLS policies can call it)
create or replace function public.my_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select '*' = any(public.my_perms())
$$;

create or replace function public.has_role(roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = any(roles), false)
$$;

-- auto-create a profile when an auth user is created
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
begin
  select not exists(select 1 from public.profiles) into first_user;
  -- The very first account becomes the admin. Every other account starts DISABLED
  -- with no special role; the admin-users server function (Team & Access page)
  -- then sets the real role and activates it. Sign-up metadata is never trusted.
  insert into public.profiles (id, email, full_name, role, role_id, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when first_user then 'admin'::app_role else 'designer'::app_role end,
    case when first_user then (select id from public.roles where key = 'admin') end,
    first_user
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. SETTINGS & MASTER DATA
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id             int primary key default 1 check (id = 1),
  company_name   text not null default 'Aqlyon Brand Management',
  address        text default 'First Floor, Muhyiddin Building, behind Municipal Shopping Complex, Koyilandy, Keralam 673305, India',
  phone          text default '+91 70341 42256',
  email          text,
  website        text default 'www.aqlyondm.com',
  currency       text not null default 'INR',
  invoice_prefix text not null default 'AQB-INV',
  quote_prefix   text not null default 'AQB-QT',
  task_prefix    text not null default 'DT',
  bank_details   text,
  upi_id         text,
  invoice_terms  text default 'Payment due within 7 days of invoice date. Thank you for your business!',
  default_max_revisions int not null default 3,
  updated_at     timestamptz default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Social Media',  -- Social Media, Design, Ads, SEO, Web, Video, Branding, Other
  unit        text not null default 'per item',       -- per item, per month, per project, per hour
  rate        numeric(12,2) not null default 0,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CRM — LEADS, CLIENTS, PACKAGES, INTERACTIONS
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  phone            text,
  whatsapp         text,
  email            text,
  city             text,
  industry         text,
  source           text default 'Walk-in',     -- Instagram, Facebook, Referral, Website, Walk-in, Google, WhatsApp, Cold call, Event
  services_interest text[] default '{}',
  estimated_value  numeric(12,2) default 0,
  stage            text not null default 'new'
                   check (stage in ('new','contacted','meeting','proposal','negotiation','won','lost')),
  temperature      text default 'warm' check (temperature in ('hot','warm','cold')),
  owner_id         uuid references public.profiles(id) on delete set null,
  next_follow_up   date,
  lost_reason      text,
  notes            text,
  converted_client_id uuid,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,
  name               text not null,             -- brand / business name
  contact_person     text,
  phone              text,
  whatsapp           text,
  email              text,
  address            text,
  city               text,
  industry           text,
  website            text,
  instagram          text,
  facebook           text,
  linkedin           text,
  youtube            text,
  other_links        text,
  account_manager_id uuid references public.profiles(id) on delete set null,
  status             text not null default 'active' check (status in ('onboarding','active','paused','churned')),
  brand_colors       text,
  brand_fonts        text,
  brand_tone         text,
  brand_assets_link  text,      -- Google Drive / Dropbox link to logos, guidelines
  target_audience    text,
  notes              text,
  lead_id            uuid references public.leads(id) on delete set null,
  onboarded_on       date default current_date,
  created_by         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.leads drop constraint if exists leads_converted_client_fk;
alter table public.leads add constraint leads_converted_client_fk
  foreign key (converted_client_id) references public.clients(id) on delete set null;

-- Retainer / package agreements (monthly deliverables + fee)
create table if not exists public.packages (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,                     -- e.g. "Social Media Growth – Monthly"
  billing_type    text not null default 'monthly' check (billing_type in ('monthly','quarterly','yearly','one_time')),
  fee             numeric(12,2) not null default 0,
  start_date      date not null default current_date,
  end_date        date,
  renewal_date    date,
  billing_day     int default 1 check (billing_day between 1 and 28),
  posts_per_month   int default 0,
  reels_per_month   int default 0,
  stories_per_month int default 0,
  carousels_per_month int default 0,
  ad_budget       numeric(12,2) default 0,           -- client's ad spend (pass-through)
  platforms       text[] default '{}',
  scope_notes     text,
  status          text not null default 'active' check (status in ('active','paused','ended')),
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

-- Interaction log (calls, meetings, WhatsApp, visits) for leads OR clients
create table if not exists public.interactions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  type          text not null default 'call' check (type in ('call','meeting','whatsapp','email','visit','video_call','note')),
  direction     text default 'outgoing' check (direction in ('incoming','outgoing')),
  summary       text not null,
  outcome       text,
  next_action   text,
  next_action_date date,
  done          boolean not null default false,       -- next action completed
  occurred_at   timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (client_id is not null or lead_id is not null)
);

-- Campaigns / projects (ad campaigns, launches, one-off projects)
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  type         text not null default 'Campaign',  -- Campaign, Branding, Website, Video Shoot, Event, Ads, SEO, Other
  platform     text,                               -- Meta, Google, YouTube, LinkedIn...
  objective    text,
  start_date   date,
  end_date     date,
  budget       numeric(12,2) default 0,           -- agency fee for project
  ad_spend     numeric(12,2) default 0,
  status       text not null default 'planning' check (status in ('planning','active','on_hold','completed','cancelled')),
  -- results (ads / campaign KPIs)
  reach        bigint default 0,
  impressions  bigint default 0,
  clicks       bigint default 0,
  leads_generated int default 0,
  conversions  int default 0,
  results_notes text,
  owner_id     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. DESIGN TASKS, PROOFS, COMMENTS, TIME LOGS
-- ---------------------------------------------------------------------
create sequence if not exists public.task_seq start 1001;

create table if not exists public.design_tasks (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  client_id      uuid references public.clients(id) on delete set null,
  project_id     uuid references public.projects(id) on delete set null,
  title          text not null,
  task_type      text not null default 'Social Post',  -- Social Post, Story, Reel, Carousel, Logo, Brochure, Flyer, Banner, Poster, Video, Motion Graphic, Ad Creative, Packaging, Thumbnail, Other
  platform       text,                                  -- Instagram, Facebook, YouTube, LinkedIn, Print, Website...
  size           text,                                  -- 1080x1080, 1080x1920, A4...
  quantity       int not null default 1,
  brief          text,
  copy_text      text,                                  -- text that must appear on the design
  reference_links text,
  priority       text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status         text not null default 'todo'
                 check (status in ('todo','in_progress','internal_review','client_review','revision','approved','delivered','cancelled')),
  assignee_id    uuid references public.profiles(id) on delete set null,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  due_date       date,
  start_date     date,
  estimated_hours numeric(6,2) default 0,
  revision_count int not null default 0,
  max_revisions  int not null default 3,
  billable       boolean not null default true,
  final_file_link text,                                 -- Drive link to source/final files
  approved_at    timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.task_proofs (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.design_tasks(id) on delete cascade,
  version       int not null default 1,
  file_path     text,          -- path in storage bucket "proofs"
  file_name     text,
  file_type     text,
  external_link text,          -- alternative: Drive / Canva link
  note          text,
  status        text not null default 'pending' check (status in ('pending','approved','changes_requested')),
  review_note   text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  client_decision text check (client_decision in ('approved','changes_requested')),
  client_note   text,
  client_decided_at timestamptz,
  uploaded_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.design_tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  body        text not null,
  kind        text not null default 'comment' check (kind in ('comment','system','client')),
  created_at  timestamptz not null default now()
);

create table if not exists public.time_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  task_id     uuid references public.design_tasks(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  log_date    date not null default current_date,
  minutes     int not null check (minutes > 0),
  billable    boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. TEAM QUERIES (cross-team questions / tickets)
-- ---------------------------------------------------------------------
create table if not exists public.queries (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  body         text,
  category     text default 'General',   -- General, Design, Client, Content, Finance, Access/Files
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'open' check (status in ('open','answered','resolved')),
  from_user    uuid references public.profiles(id) on delete set null default auth.uid(),
  to_user      uuid references public.profiles(id) on delete set null,
  to_role      app_role,                  -- legacy
  to_role_id   uuid references public.roles(id) on delete set null,
  client_id    uuid references public.clients(id) on delete set null,
  task_id      uuid references public.design_tasks(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.queries add column if not exists to_role_id uuid references public.roles(id) on delete set null;
update public.queries q set to_role_id = r.id from public.roles r where q.to_role_id is null and q.to_role is not null and r.key = q.to_role::text;

create table if not exists public.query_replies (
  id         uuid primary key default gen_random_uuid(),
  query_id   uuid not null references public.queries(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. CONTENT CALENDAR
-- ---------------------------------------------------------------------
create table if not exists public.content_posts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  publish_date   date not null,
  publish_time   time,
  platforms      text[] not null default '{Instagram}',
  post_type      text not null default 'Post',  -- Post, Reel, Story, Carousel, Video, Blog, Ad
  pillar         text,                           -- content pillar: Educational, Promotional, Engagement, Festival, Testimonial...
  title          text not null,
  caption        text,
  hashtags       text,
  cta            text,
  design_task_id uuid references public.design_tasks(id) on delete set null,
  media_link     text,
  status         text not null default 'idea'
                 check (status in ('idea','copywriting','in_design','internal_review','client_approval','approved','scheduled','published','cancelled')),
  client_note    text,
  client_decided_at timestamptz,
  published_url  text,
  -- post performance
  reach          int default 0,
  likes          int default 0,
  comments       int default 0,
  shares         int default 0,
  saves          int default 0,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Tokenised links clients use to approve content / proofs without logging in
create table if not exists public.approval_links (
  token       text primary key default encode(gen_random_bytes(18),'hex'),
  client_id   uuid not null references public.clients(id) on delete cascade,
  label       text,
  expires_at  timestamptz not null default now() + interval '30 days',
  revoked     boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. FINANCE — QUOTATIONS, INVOICES, PAYMENTS, EXPENSES
-- ---------------------------------------------------------------------
create sequence if not exists public.invoice_seq start 1;
create sequence if not exists public.quote_seq   start 1;

create table if not exists public.quotations (
  id           uuid primary key default gen_random_uuid(),
  number       text unique,
  client_id    uuid references public.clients(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete set null,
  bill_to      text,                       -- name/address shown when no client yet
  issue_date   date not null default current_date,
  valid_until  date default current_date + 15,
  items        jsonb not null default '[]',  -- [{description, qty, rate}]
  discount     numeric(12,2) not null default 0,
  subtotal     numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  status       text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  notes        text,
  terms        text,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text unique,
  client_id    uuid not null references public.clients(id) on delete restrict,
  package_id   uuid references public.packages(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  period_month date,                         -- for retainer invoices: first day of month billed
  issue_date   date not null default current_date,
  due_date     date not null default current_date + 7,
  items        jsonb not null default '[]',
  discount     numeric(12,2) not null default 0,
  subtotal     numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  amount_paid  numeric(12,2) not null default 0,
  status       text not null default 'draft' check (status in ('draft','sent','partial','paid','cancelled')),
  notes        text,
  terms        text,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (package_id, period_month)
);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid references public.invoices(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  paid_on      date not null default current_date,
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null default 'UPI' check (method in ('Cash','UPI','Bank Transfer','Cheque','Card','Other')),
  reference    text,
  note         text,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  spent_on     date not null default current_date,
  category     text not null default 'Office',  -- Salary, Rent, Utilities, Internet, Software/Subscriptions, Ad Spend (Client), Stock/Assets, Printing, Equipment, Travel, Marketing, Freelancer, Office, Tax/Fees, Other
  vendor       text,
  description  text,
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null default 'UPI' check (method in ('Cash','UPI','Bank Transfer','Cheque','Card','Other')),
  client_id    uuid references public.clients(id) on delete set null,   -- if spent for a client
  rebillable   boolean not null default false,
  receipt_path text,
  recurring    boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7b. SUPPLIERS — outsourced work (freelancers, printers, videographers)
--     A supplier work order can be assigned to one or many customers /
--     invoices, and is paid in advance + balance instalments.
-- ---------------------------------------------------------------------
create sequence if not exists public.po_seq start 1;

create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text default 'Freelance Designer',  -- outsourcing suppliers and expense payees (Landlord, Utility, Software, Staff…)
  contact_person text,
  phone        text,
  whatsapp     text,
  email        text,
  upi_id       text,
  bank_details text,
  notes        text,
  active       boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

create table if not exists public.supplier_bills (
  id            uuid primary key default gen_random_uuid(),
  number        text unique,
  supplier_id   uuid not null references public.suppliers(id) on delete restrict,
  order_date    date not null default current_date,
  due_date      date,
  title         text not null,              -- e.g. "Logo design – Kappad Beach Resort"
  items         jsonb not null default '[]',
  discount      numeric(12,2) not null default 0,
  subtotal      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,
  work_status   text not null default 'ordered' check (work_status in ('ordered','in_progress','received','cancelled')),
  status        text not null default 'unpaid' check (status in ('unpaid','partial','paid','cancelled')),
  supplier_ref  text,                       -- supplier's own bill / quote number
  notes         text,
  received_on   date,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

-- which customer(s) / invoice(s) / task a supplier cost belongs to
create table if not exists public.supplier_bill_allocations (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.supplier_bills(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  invoice_id  uuid references public.invoices(id) on delete set null,
  task_id     uuid references public.design_tasks(id) on delete set null,
  amount      numeric(12,2) not null check (amount >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  bill_id     uuid references public.supplier_bills(id) on delete cascade,
  paid_on     date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  kind        text not null default 'advance' check (kind in ('advance','part','final')),
  method      text not null default 'UPI' check (method in ('Cash','UPI','Bank Transfer','Cheque','Card','Other')),
  reference   text,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_sb_supplier on public.supplier_bills(supplier_id);
create index if not exists idx_sba_bill on public.supplier_bill_allocations(bill_id);
create index if not exists idx_sba_client on public.supplier_bill_allocations(client_id);
create index if not exists idx_sba_invoice on public.supplier_bill_allocations(invoice_id);
create index if not exists idx_sp_bill on public.supplier_payments(bill_id);

alter table public.settings add column if not exists po_prefix text not null default 'AQB-PO';

-- ---------------------------------------------------------------------
-- 8. NOTIFICATIONS & ACTIVITY
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  entity     text not null,
  entity_id  uuid,
  action     text not null,
  details    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. INDEXES
-- ---------------------------------------------------------------------
create index if not exists idx_leads_stage       on public.leads(stage);
create index if not exists idx_leads_owner       on public.leads(owner_id);
create index if not exists idx_leads_followup    on public.leads(next_follow_up);
create index if not exists idx_clients_status    on public.clients(status);
create index if not exists idx_inter_client      on public.interactions(client_id);
create index if not exists idx_inter_lead        on public.interactions(lead_id);
create index if not exists idx_inter_next        on public.interactions(next_action_date) where not done;
create index if not exists idx_tasks_status      on public.design_tasks(status);
create index if not exists idx_tasks_assignee    on public.design_tasks(assignee_id);
create index if not exists idx_tasks_client      on public.design_tasks(client_id);
create index if not exists idx_tasks_due         on public.design_tasks(due_date);
create index if not exists idx_proofs_task       on public.task_proofs(task_id);
create index if not exists idx_comments_task     on public.task_comments(task_id);
create index if not exists idx_time_user_date    on public.time_logs(user_id, log_date);
create index if not exists idx_posts_client_date on public.content_posts(client_id, publish_date);
create index if not exists idx_inv_client        on public.invoices(client_id);
create index if not exists idx_inv_status        on public.invoices(status);
create index if not exists idx_pay_invoice       on public.payments(invoice_id);
create index if not exists idx_exp_date          on public.expenses(spent_on);
create index if not exists idx_notif_user        on public.notifications(user_id, read);
create index if not exists idx_queries_to        on public.queries(to_user, status);

-- ---------------------------------------------------------------------
-- 10. TRIGGERS — numbering, totals, timestamps, notifications
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['leads','clients','design_tasks','queries','content_posts'] loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- line-item totals for quotations/invoices: items = [{description, qty, rate}]
create or replace function public.compute_doc_totals() returns trigger language plpgsql as $$
declare s numeric := 0;
begin
  select coalesce(sum( coalesce((i->>'qty')::numeric,1) * coalesce((i->>'rate')::numeric,0) ),0)
    into s from jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) i;
  new.subtotal := round(s,2);
  new.total    := greatest(round(s - coalesce(new.discount,0),2), 0);
  return new;
end $$;

drop trigger if exists trg_quote_totals on public.quotations;
create trigger trg_quote_totals before insert or update of items, discount on public.quotations
  for each row execute function public.compute_doc_totals();
drop trigger if exists trg_invoice_totals on public.invoices;
create trigger trg_invoice_totals before insert or update of items, discount on public.invoices
  for each row execute function public.compute_doc_totals();

-- document numbers: AQB-INV-2026-0001
create or replace function public.assign_numbers() returns trigger
language plpgsql security definer set search_path = public as $$
declare st public.settings;
begin
  select * into st from public.settings where id = 1;
  if tg_table_name = 'invoices' then
    if new.number is null then
      new.number := st.invoice_prefix || '-' || to_char(new.issue_date,'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 4, '0');
    end if;
  elsif tg_table_name = 'quotations' then
    if new.number is null then
      new.number := st.quote_prefix || '-' || to_char(new.issue_date,'YYYY') || '-' || lpad(nextval('public.quote_seq')::text, 4, '0');
    end if;
  elsif tg_table_name = 'design_tasks' then
    if new.code is null then
      new.code := st.task_prefix || '-' || nextval('public.task_seq')::text;
    end if;
  elsif tg_table_name = 'clients' then
    if new.code is null then
      new.code := 'CL-' || lpad((select coalesce(max(nullif(regexp_replace(code,'\D','','g'),'')::int),0)+1 from public.clients)::text, 3, '0');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_inv_number on public.invoices;
create trigger trg_inv_number before insert on public.invoices for each row execute function public.assign_numbers();
drop trigger if exists trg_quote_number on public.quotations;
create trigger trg_quote_number before insert on public.quotations for each row execute function public.assign_numbers();
drop trigger if exists trg_task_code on public.design_tasks;
create trigger trg_task_code before insert on public.design_tasks for each row execute function public.assign_numbers();
drop trigger if exists trg_client_code on public.clients;
create trigger trg_client_code before insert on public.clients for each row execute function public.assign_numbers();

-- keep invoice.amount_paid & status in sync with payments
create or replace function public.sync_invoice_paid() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv uuid := coalesce(new.invoice_id, old.invoice_id); paid numeric; tot numeric; cur text;
begin
  if inv is null then return null; end if;
  select coalesce(sum(amount),0) into paid from public.payments where invoice_id = inv;
  select total, status into tot, cur from public.invoices where id = inv;
  update public.invoices set amount_paid = paid,
    status = case
      when cur = 'cancelled' then cur
      when paid >= tot and tot > 0 then 'paid'
      when paid > 0 then 'partial'
      when cur in ('paid','partial') then 'sent'
      else cur end
  where id = inv;
  return null;
end $$;

drop trigger if exists trg_pay_sync on public.payments;
create trigger trg_pay_sync after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_paid();

-- payment inherits client from invoice
create or replace function public.payment_fill_client() returns trigger language plpgsql as $$
begin
  if new.client_id is null and new.invoice_id is not null then
    select client_id into new.client_id from public.invoices where id = new.invoice_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_pay_client on public.payments;
create trigger trg_pay_client before insert on public.payments for each row execute function public.payment_fill_client();

-- helper to notify a user
create or replace function public.notify(uid uuid, t text, b text, l text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, title, body, link)
  select uid, t, b, l where uid is not null and uid is distinct from auth.uid();
$$;

-- design task workflow side-effects
create or replace function public.task_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.max_revisions is null or new.max_revisions = 3 then
      new.max_revisions := coalesce((select default_max_revisions from public.settings where id=1), 3);
    end if;
    return new;
  end if;

  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(new.assignee_id, 'New design task assigned', new.code || ' · ' || new.title, '/tasks/' || new.id);
  end if;

  if new.status is distinct from old.status then
    if new.status = 'revision' then
      new.revision_count := old.revision_count + 1;
      perform public.notify(new.assignee_id, 'Revision requested', new.code || ' · ' || new.title, '/tasks/' || new.id);
    elsif new.status = 'approved' then
      new.approved_at := coalesce(new.approved_at, now());
      perform public.notify(new.assignee_id, 'Design approved 🎉', new.code || ' · ' || new.title, '/tasks/' || new.id);
    elsif new.status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    elsif new.status = 'in_progress' and new.start_date is null then
      new.start_date := current_date;
    end if;
    insert into public.task_comments(task_id, author_id, body, kind)
      values (new.id, auth.uid(), 'Status changed: ' || replace(old.status,'_',' ') || ' → ' || replace(new.status,'_',' '), 'system');
  end if;
  return new;
end $$;

drop trigger if exists trg_task_events on public.design_tasks;
create trigger trg_task_events before insert or update on public.design_tasks
  for each row execute function public.task_events();

-- designers may only move their own tasks through production statuses
create or replace function public.task_designer_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('tasks.manage') and current_setting('erp.internal', true) is distinct from 'on' then
    if new.status is distinct from old.status
       and new.status not in ('todo','in_progress','internal_review') then
      raise exception 'You can only set status to To do, In progress or Ready for review';
    end if;
    if new.title is distinct from old.title or new.client_id is distinct from old.client_id
       or new.due_date is distinct from old.due_date or new.priority is distinct from old.priority
       or new.brief is distinct from old.brief or new.max_revisions is distinct from old.max_revisions then
      raise exception 'You cannot edit the brief, client, due date or priority — raise a query instead';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_task_guard on public.design_tasks;
create trigger trg_task_guard before update on public.design_tasks
  for each row execute function public.task_designer_guard();

create or replace function public.proof_designer_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('tasks.review') and (
       new.status is distinct from old.status or new.review_note is distinct from old.review_note
    or new.client_decision is distinct from old.client_decision) then
    raise exception 'You do not have permission to review proofs';
  end if;
  return new;
end $$;
drop trigger if exists trg_proof_guard on public.task_proofs;
create trigger trg_proof_guard before update on public.task_proofs
  for each row execute function public.proof_designer_guard();

-- new assignment on insert → notify
create or replace function public.task_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.assignee_id, 'New design task assigned', new.code || ' · ' || new.title, '/tasks/' || new.id);
  return null;
end $$;
drop trigger if exists trg_task_after_insert on public.design_tasks;
create trigger trg_task_after_insert after insert on public.design_tasks
  for each row execute function public.task_after_insert();

-- proof versioning + notify reviewer
create or replace function public.proof_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.design_tasks;
begin
  select * into t from public.design_tasks where id = new.task_id;
  if tg_op = 'INSERT' then
    new.version := coalesce((select max(version) from public.task_proofs where task_id = new.task_id), 0) + 1;
  end if;
  return new;
end $$;
drop trigger if exists trg_proof_version on public.task_proofs;
create trigger trg_proof_version before insert on public.task_proofs
  for each row execute function public.proof_events();

create or replace function public.proof_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.design_tasks;
begin
  select * into t from public.design_tasks where id = new.task_id;
  if tg_op = 'INSERT' then
    update public.design_tasks set status = 'internal_review'
      where id = t.id and status in ('todo','in_progress','revision');
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      update public.design_tasks set status = 'client_review' where id = t.id and status = 'internal_review';
    elsif new.status = 'changes_requested' then
      update public.design_tasks set status = 'revision' where id = t.id and status not in ('delivered','cancelled');
    end if;
  end if;
  if tg_op = 'UPDATE' and new.client_decision is distinct from old.client_decision then
    if new.client_decision = 'approved' then
      update public.design_tasks set status = 'approved' where id = t.id and status not in ('delivered','cancelled');
    elsif new.client_decision = 'changes_requested' then
      update public.design_tasks set status = 'revision' where id = t.id and status not in ('delivered','cancelled');
    end if;
    perform public.notify(t.created_by, 'Client ' || replace(new.client_decision,'_',' '), t.code || ' · ' || t.title, '/tasks/' || t.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_proof_after on public.task_proofs;
create trigger trg_proof_after after insert or update on public.task_proofs
  for each row execute function public.proof_after();

-- queries: notify recipient(s); replies notify the other side
create or replace function public.query_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.to_user is not null then
    perform public.notify(new.to_user, 'New query: ' || new.subject, left(coalesce(new.body,''),140), '/queries/' || new.id);
  elsif new.to_role_id is not null then
    for r in select id from public.profiles where role_id = new.to_role_id and active loop
      perform public.notify(r.id, 'New query: ' || new.subject, left(coalesce(new.body,''),140), '/queries/' || new.id);
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists trg_query_events on public.queries;
create trigger trg_query_events after insert on public.queries
  for each row execute function public.query_events();

create or replace function public.reply_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare q public.queries;
begin
  select * into q from public.queries where id = new.query_id;
  if new.author_id = q.from_user then
    perform public.notify(q.to_user, 'Reply: ' || q.subject, left(new.body,140), '/queries/' || q.id);
  else
    perform public.notify(q.from_user, 'Reply: ' || q.subject, left(new.body,140), '/queries/' || q.id);
    update public.queries set status = 'answered' where id = q.id and status = 'open';
  end if;
  return null;
end $$;
drop trigger if exists trg_reply_events on public.query_replies;
create trigger trg_reply_events after insert on public.query_replies
  for each row execute function public.reply_events();

-- task comments notify the other party
create or replace function public.comment_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.design_tasks;
begin
  if new.kind <> 'comment' then return null; end if;
  select * into t from public.design_tasks where id = new.task_id;
  perform public.notify(t.assignee_id, 'Comment on ' || t.code, left(new.body,140), '/tasks/' || t.id);
  if t.created_by is distinct from t.assignee_id then
    perform public.notify(t.created_by, 'Comment on ' || t.code, left(new.body,140), '/tasks/' || t.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_comment_events on public.task_comments;
create trigger trg_comment_events after insert on public.task_comments
  for each row execute function public.comment_events();

-- lead converted to client
create or replace function public.convert_lead(p_lead uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l public.leads; cid uuid;
begin
  if not public.has_perm('leads.manage') then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead;
  if l.id is null then raise exception 'Lead not found'; end if;
  if l.converted_client_id is not null then return l.converted_client_id; end if;
  insert into public.clients(name, contact_person, phone, whatsapp, email, city, industry, account_manager_id, status, lead_id, notes, salesman_id)
  values (coalesce(nullif(l.company,''), l.name), l.name, l.phone, l.whatsapp, l.email, l.city, l.industry,
          coalesce(l.owner_id, auth.uid()), 'onboarding', l.id, l.notes, coalesce(l.owner_id, auth.uid()))
  returning id into cid;
  update public.leads set stage = 'won', converted_client_id = cid where id = p_lead;
  update public.interactions set client_id = cid where lead_id = p_lead and client_id is null;
  return cid;
end $$;

-- generate retainer invoices for a month (idempotent: one per package per month)
create or replace function public.generate_retainer_invoices(p_month date) returns int
language plpgsql security definer set search_path = public as $$
declare pk record; m date := date_trunc('month', p_month)::date; n int := 0; st public.settings;
begin
  if not public.has_perm('invoices.manage') then raise exception 'Not allowed'; end if;
  select * into st from public.settings where id = 1;
  for pk in
    select p.* from public.packages p
    where p.status = 'active' and p.billing_type <> 'one_time'
      and p.start_date <= (m + interval '1 month - 1 day')::date
      and (p.end_date is null or p.end_date >= m)
      and (p.billing_type = 'monthly'
        or (p.billing_type = 'quarterly' and ((extract(year from age(m, date_trunc('month',p.start_date)))*12 + extract(month from age(m, date_trunc('month',p.start_date))))::int % 3) = 0)
        or (p.billing_type = 'yearly'    and extract(month from m) = extract(month from p.start_date)))
      and not exists (select 1 from public.invoices i where i.package_id = p.id and i.period_month = m)
  loop
    insert into public.invoices(client_id, package_id, period_month, issue_date, due_date, items, status, terms)
    values (pk.client_id, pk.id, m,
            greatest(current_date, (m + (coalesce(pk.billing_day,1)-1))::date),
            greatest(current_date, (m + (coalesce(pk.billing_day,1)-1))::date) + 7,
            jsonb_build_array(jsonb_build_object(
              'description', pk.name || ' — ' || to_char(m,'Mon YYYY'),
              'qty', 1, 'rate', pk.fee)),
            'draft', st.invoice_terms);
    n := n + 1;
  end loop;
  return n;
end $$;


-- supplier work orders: number + totals; payments keep amount_paid / status in sync
drop trigger if exists trg_sb_totals on public.supplier_bills;
create trigger trg_sb_totals before insert or update of items, discount on public.supplier_bills
  for each row execute function public.compute_doc_totals();

create or replace function public.sb_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.number is null then
    new.number := (select po_prefix from public.settings where id = 1) || '-' || to_char(new.order_date,'YYYY') || '-' || lpad(nextval('public.po_seq')::text, 4, '0');
  end if;
  if new.work_status = 'received' and new.received_on is null then new.received_on := current_date; end if;
  return new;
end $$;
drop trigger if exists trg_sb_number on public.supplier_bills;
create trigger trg_sb_number before insert or update on public.supplier_bills for each row execute function public.sb_number();

create or replace function public.sync_supplier_bill() returns trigger
language plpgsql security definer set search_path = public as $$
declare b uuid := coalesce(new.bill_id, old.bill_id); paid numeric; tot numeric; cur text;
begin
  if b is null then return null; end if;
  select coalesce(sum(amount),0) into paid from public.supplier_payments where bill_id = b;
  select total, status into tot, cur from public.supplier_bills where id = b;
  update public.supplier_bills set amount_paid = paid,
    status = case when cur = 'cancelled' then cur when paid >= tot and tot > 0 then 'paid' when paid > 0 then 'partial' else 'unpaid' end
  where id = b;
  return null;
end $$;
drop trigger if exists trg_sp_sync on public.supplier_payments;
create trigger trg_sp_sync after insert or update or delete on public.supplier_payments
  for each row execute function public.sync_supplier_bill();

create or replace function public.sp_fill_supplier() returns trigger language plpgsql as $$
begin
  if new.bill_id is not null then select supplier_id into new.supplier_id from public.supplier_bills where id = new.bill_id; end if;
  return new;
end $$;
drop trigger if exists trg_sp_fill on public.supplier_payments;
create trigger trg_sp_fill before insert or update on public.supplier_payments for each row execute function public.sp_fill_supplier();

-- expenses are paid to a payee from the Suppliers & payees master.
-- Typing a new name (or importing old text) creates the payee automatically.
alter table public.expenses add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists idx_exp_supplier on public.expenses(supplier_id);

create or replace function public.expense_payee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.supplier_id is not null then
    select name into new.vendor from public.suppliers where id = new.supplier_id;
  elsif nullif(trim(new.vendor), '') is not null then
    select id into new.supplier_id from public.suppliers where lower(name) = lower(trim(new.vendor)) limit 1;
    if new.supplier_id is null then
      insert into public.suppliers(name, category) values (trim(new.vendor), 'Other') returning id into new.supplier_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_expense_payee on public.expenses;
create trigger trg_expense_payee before insert or update of supplier_id, vendor on public.expenses
  for each row execute function public.expense_payee();
-- link expenses entered before payees existed (safe to re-run)
update public.expenses set vendor = vendor where supplier_id is null and nullif(trim(vendor), '') is not null;

-- ---------------------------------------------------------------------
-- 10c. OUT-OF-POCKET PAYMENTS & REPAYMENTS
--   A founder / staff member pays a company cost from their own account
--   (expenses.paid_by = that person). It is a company expense straight away,
--   but stays "payable to <person>" until the company repays them
--   (a reimbursements row, linked from each expense it settles).
-- ---------------------------------------------------------------------
create table if not exists public.reimbursements (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.profiles(id) on delete restrict,
  paid_on     date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null default 'Bank Transfer' check (method in ('Cash','UPI','Bank Transfer','Cheque','Card','Other')),
  reference   text,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_reimb_person on public.reimbursements(person_id, paid_on);
alter table public.expenses add column if not exists paid_by uuid references public.profiles(id) on delete restrict;          -- null = company account
alter table public.expenses add column if not exists reimbursement_id uuid references public.reimbursements(id) on delete set null;
create index if not exists idx_exp_paid_by on public.expenses(paid_by) where paid_by is not null;
create index if not exists idx_exp_reimb on public.expenses(reimbursement_id);
-- supplier payments can be made from someone's own account too
alter table public.supplier_payments add column if not exists paid_by uuid references public.profiles(id) on delete restrict;
alter table public.supplier_payments add column if not exists reimbursement_id uuid references public.reimbursements(id) on delete set null;
create index if not exists idx_sp_paid_by on public.supplier_payments(paid_by) where paid_by is not null;
create index if not exists idx_sp_reimb on public.supplier_payments(reimbursement_id);

create or replace function public.expense_reimb_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.reimbursement_id is not null then raise exception 'This expense has already been repaid. Undo the repayment first.'; end if;
    return old;
  end if;
  if new.paid_by is null then new.reimbursement_id := null; end if;
  if tg_op = 'UPDATE' and old.reimbursement_id is not null and new.reimbursement_id is not distinct from old.reimbursement_id
     and (new.amount <> old.amount or new.paid_by is distinct from old.paid_by) then
    raise exception 'This expense has already been repaid. Undo the repayment first to change the amount or who paid.';
  end if;
  return new;
end $$;
drop trigger if exists trg_expense_reimb_guard on public.expenses;
create trigger trg_expense_reimb_guard before insert or update or delete on public.expenses
  for each row execute function public.expense_reimb_guard();
drop trigger if exists trg_sp_reimb_guard on public.supplier_payments;
create trigger trg_sp_reimb_guard before insert or update or delete on public.supplier_payments
  for each row execute function public.expense_reimb_guard();

-- repay selected out-of-pocket expenses / supplier payments to one person in a single payment
drop function if exists public.repay_expenses(uuid, uuid[], date, text, text, text);
create or replace function public.repay_expenses(p_person uuid, p_expense_ids uuid[], p_paid_on date default current_date,
  p_method text default 'Bank Transfer', p_reference text default null, p_note text default null,
  p_supplier_payment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare n int; n2 int; tot numeric; tot2 numeric; rid uuid;
begin
  if not public.has_perm('expenses.manage', 'payments.manage') then raise exception 'Not allowed'; end if;
  p_expense_ids := coalesce(p_expense_ids, '{}'); p_supplier_payment_ids := coalesce(p_supplier_payment_ids, '{}');
  select count(*), coalesce(sum(amount), 0) into n, tot from public.expenses
   where id = any(p_expense_ids) and paid_by = p_person and reimbursement_id is null;
  select count(*), coalesce(sum(amount), 0) into n2, tot2 from public.supplier_payments
   where id = any(p_supplier_payment_ids) and paid_by = p_person and reimbursement_id is null;
  if n + n2 = 0 or n <> coalesce(array_length(p_expense_ids, 1), 0) or n2 <> coalesce(array_length(p_supplier_payment_ids, 1), 0) then
    raise exception 'Some of the selected items are not payable to this person (already repaid or paid by someone else).';
  end if;
  tot := tot + tot2;
  insert into public.reimbursements(person_id, paid_on, amount, method, reference, note)
  values (p_person, coalesce(p_paid_on, current_date), tot, coalesce(p_method, 'Bank Transfer'), nullif(p_reference, ''), nullif(p_note, ''))
  returning id into rid;
  update public.expenses set reimbursement_id = rid where id = any(p_expense_ids);
  update public.supplier_payments set reimbursement_id = rid where id = any(p_supplier_payment_ids);
  return rid;
end $$;
grant execute on function public.repay_expenses(uuid, uuid[], date, text, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 10d. WALK-IN SALES (counter billing by any team member)
--   Walk-in customers are clients with customer_type = 'walkin'; a repeat
--   visitor is matched by phone. Every payment records who collected it.
-- ---------------------------------------------------------------------
alter table public.clients  add column if not exists customer_type text not null default 'regular';
do $$ begin
  alter table public.clients add constraint clients_customer_type_chk check (customer_type in ('regular','walkin'));
exception when duplicate_object then null; end $$;
alter table public.invoices add column if not exists sale_channel text not null default 'office';   -- 'walkin' = counter sale
-- who brought this customer: a team member, or someone outside the team (name only)
alter table public.clients add column if not exists salesman_id uuid references public.profiles(id) on delete set null;
alter table public.clients add column if not exists salesman_name text;
create index if not exists idx_clients_salesman on public.clients(salesman_id);
alter table public.payments add column if not exists collected_by uuid references public.profiles(id) on delete set null;
alter table public.payments alter column collected_by set default auth.uid();
update public.payments set collected_by = created_by where collected_by is null and created_by is not null;
create index if not exists idx_pay_collector on public.payments(collected_by, paid_on);
create index if not exists idx_inv_channel on public.invoices(sale_channel, created_by) where sale_channel = 'walkin';

create or replace function public.phone_key(t text) returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10), '')
$$;
create index if not exists idx_clients_phone_key on public.clients(public.phone_key(phone));

-- find a returning walk-in customer by phone or name (any team member)
create or replace function public.walkin_find(p_q text)
returns table(id uuid, code text, name text, phone text, visits bigint, last_visit date, balance numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if length(trim(coalesce(p_q, ''))) < 3 then return; end if;
  return query
    select c.id, c.code, c.name, c.phone,
           (select count(*) from public.invoices i where i.client_id = c.id and i.status <> 'cancelled'),
           (select max(i.issue_date) from public.invoices i where i.client_id = c.id),
           (select coalesce(sum(i.total - i.amount_paid), 0) from public.invoices i where i.client_id = c.id and i.status in ('sent','partial'))
    from public.clients c
    where c.customer_type = 'walkin'
      and (public.phone_key(c.phone) like '%' || regexp_replace(p_q, '\D', '', 'g') || '%' and regexp_replace(p_q, '\D', '', 'g') <> ''
           or c.name ilike '%' || trim(p_q) || '%')
    order by 6 desc nulls last
    limit 6;
end $$;

-- create a walk-in invoice and (optionally) collect payment in one step
drop function if exists public.walkin_sale(uuid, text, text, jsonb, numeric, numeric, text, text, text);
create or replace function public.walkin_sale(p_client_id uuid, p_name text, p_phone text, p_items jsonb,
  p_discount numeric default 0, p_paid numeric default 0, p_method text default 'Cash', p_reference text default null, p_notes text default null,
  p_whatsapp text default null, p_email text default null, p_city text default null, p_address text default null,
  p_salesman_id uuid default null, p_salesman_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := p_client_id; inv public.invoices; st public.settings;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) i where coalesce(nullif(trim(i->>'description'), ''), '') = ''
             or coalesce((i->>'qty')::numeric, 0) <= 0 or coalesce((i->>'rate')::numeric, -1) < 0) then
    raise exception 'Each item needs a description, quantity and rate';
  end if;
  if cid is not null then
    if not exists (select 1 from public.clients where id = cid and (customer_type = 'walkin' or public.has_perm('invoices.manage', 'clients.view', 'clients.manage'))) then
      raise exception 'Customer not found';
    end if;
  else
    if coalesce(trim(p_name), '') = '' then raise exception 'Enter the customer name'; end if;
    if public.phone_key(p_phone) is not null and length(public.phone_key(p_phone)) >= 10 then
      select id into cid from public.clients where customer_type = 'walkin' and public.phone_key(phone) = public.phone_key(p_phone) limit 1;
    end if;
    if cid is null then
      insert into public.clients(name, contact_person, phone, whatsapp, email, city, address, customer_type, status, account_manager_id, salesman_id, salesman_name)
      values (trim(p_name), trim(p_name), nullif(trim(p_phone), ''), coalesce(nullif(trim(p_whatsapp), ''), nullif(trim(p_phone), '')),
              nullif(trim(p_email), ''), nullif(trim(p_city), ''), nullif(trim(p_address), ''), 'walkin', 'active', auth.uid(), p_salesman_id, nullif(trim(p_salesman_name), ''))
      returning id into cid;
    else
      update public.clients set whatsapp = coalesce(whatsapp, nullif(trim(p_whatsapp), '')), email = coalesce(email, nullif(trim(p_email), '')),
        city = coalesce(city, nullif(trim(p_city), '')), address = coalesce(address, nullif(trim(p_address), '')),
        salesman_id = coalesce(salesman_id, p_salesman_id), salesman_name = coalesce(salesman_name, nullif(trim(p_salesman_name), ''))
      where id = cid;
    end if;
  end if;
  select * into st from public.settings where id = 1;
  insert into public.invoices(client_id, issue_date, due_date, items, discount, status, sale_channel, notes, terms)
  values (cid, current_date, current_date, p_items, greatest(coalesce(p_discount, 0), 0), 'sent', 'walkin', nullif(trim(p_notes), ''), st.invoice_terms)
  returning * into inv;
  if coalesce(p_paid, 0) > 0 then
    if p_paid > inv.total + 0.01 then raise exception 'Amount received (%) is more than the invoice total (%)', p_paid, inv.total; end if;
    insert into public.payments(invoice_id, client_id, amount, method, reference, note, collected_by)
    values (inv.id, cid, p_paid, coalesce(p_method, 'Cash'), nullif(trim(p_reference), ''), 'Walk-in counter', auth.uid());
  end if;
  select * into inv from public.invoices where id = inv.id;
  return jsonb_build_object('invoice_id', inv.id, 'number', inv.number, 'client_id', cid, 'total', inv.total, 'paid', inv.amount_paid);
end $$;

-- add (or find by mobile) a walk-in customer from any client picker (any team member)
drop function if exists public.walkin_customer(text, text);
drop function if exists public.walkin_customer(text, text, text, text, text, text);
create or replace function public.walkin_customer(p_name text, p_phone text default null, p_whatsapp text default null,
  p_email text default null, p_city text default null, p_address text default null, p_salesman_id uuid default null, p_salesman_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Enter the customer name'; end if;
  if length(coalesce(public.phone_key(p_phone), '')) >= 10 then
    select id into cid from public.clients where customer_type = 'walkin' and public.phone_key(phone) = public.phone_key(p_phone) limit 1;
  end if;
  if cid is null then
    insert into public.clients(name, contact_person, phone, whatsapp, email, city, address, customer_type, status, account_manager_id, salesman_id, salesman_name)
    values (trim(p_name), trim(p_name), nullif(trim(p_phone), ''), coalesce(nullif(trim(p_whatsapp), ''), nullif(trim(p_phone), '')),
            nullif(trim(p_email), ''), nullif(trim(p_city), ''), nullif(trim(p_address), ''), 'walkin', 'active', auth.uid(), p_salesman_id, nullif(trim(p_salesman_name), ''))
    returning id into cid;
  else
    -- returning customer: fill in details we didn't have before, never overwrite
    update public.clients set
      whatsapp = coalesce(whatsapp, nullif(trim(p_whatsapp), '')), email = coalesce(email, nullif(trim(p_email), '')),
      city = coalesce(city, nullif(trim(p_city), '')), address = coalesce(address, nullif(trim(p_address), '')),
      salesman_id = coalesce(salesman_id, p_salesman_id), salesman_name = coalesce(salesman_name, nullif(trim(p_salesman_name), ''))
    where id = cid;
  end if;
  return cid;
end $$;
grant execute on function public.walkin_customer(text, text, text, text, text, text, uuid, text) to authenticated;

-- collect the balance of a walk-in invoice later (any team member)
create or replace function public.walkin_collect(p_invoice uuid, p_amount numeric, p_method text default 'Cash', p_reference text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  select * into inv from public.invoices where id = p_invoice and sale_channel = 'walkin' and status in ('sent','partial');
  if inv.id is null then raise exception 'Invoice not found or already paid'; end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > inv.total - inv.amount_paid + 0.01 then raise exception 'Enter an amount up to the balance (%)', inv.total - inv.amount_paid; end if;
  insert into public.payments(invoice_id, client_id, amount, method, reference, note, collected_by)
  values (inv.id, inv.client_id, p_amount, coalesce(p_method, 'Cash'), nullif(trim(p_reference), ''), 'Walk-in counter', auth.uid());
  return (select total - amount_paid from public.invoices where id = inv.id);
end $$;
grant execute on function public.walkin_find(text) to authenticated;
grant execute on function public.walkin_sale(uuid, text, text, jsonb, numeric, numeric, text, text, text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.walkin_collect(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10e. CLIENT SOCIAL MEDIA REPORTS
--   Weekly account KPIs per client & platform (Week 1 = days 1–7 of the month,
--   Week 2 = 8–14, Week 3 = 15–21, Week 4 = 22–28, Week 5 = 29–end).
--   The content log itself comes from content_posts (the calendar).
-- ---------------------------------------------------------------------
alter table public.content_posts add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

-- per-platform results of a post: [{platform, url, reach, views, likes, comments, shares, saves}]
alter table public.content_posts add column if not exists results jsonb not null default '[]';
-- the single-value columns (published_url, reach, likes…) stay as totals so older reports keep working
create or replace function public.post_results_sync() returns trigger language plpgsql as $$
begin
  if jsonb_typeof(new.results) <> 'array' then new.results := '[]'; end if;
  if jsonb_array_length(new.results) > 0 then
    select (select r->>'url' from jsonb_array_elements(new.results) r where nullif(r->>'url', '') is not null limit 1),
           coalesce(sum((r->>'reach')::numeric), 0), coalesce(sum((r->>'likes')::numeric), 0), coalesce(sum((r->>'comments')::numeric), 0),
           coalesce(sum((r->>'shares')::numeric), 0), coalesce(sum((r->>'saves')::numeric), 0)
      into new.published_url, new.reach, new.likes, new.comments, new.shares, new.saves
      from jsonb_array_elements(new.results) r;
  end if;
  return new;
end $$;
drop trigger if exists trg_post_results on public.content_posts;
create trigger trg_post_results before insert or update of results on public.content_posts
  for each row execute function public.post_results_sync();
-- move existing single links into the new list (safe to re-run)
update public.content_posts
   set results = jsonb_build_array(jsonb_build_object('platform', coalesce(platforms[1], 'Instagram'), 'url', published_url,
                 'reach', reach, 'likes', likes, 'comments', comments, 'shares', shares, 'saves', saves))
 where results = '[]' and (nullif(published_url, '') is not null or coalesce(reach, 0) + coalesce(likes, 0) > 0);

create table if not exists public.social_kpis (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  platform         text not null default 'Instagram',
  month            date not null,                 -- first day of the month
  week_no          int  not null check (week_no between 1 and 5),
  reach            int,
  content_shared   int,
  new_followers    int,
  profile_visits   int,
  story_views      int,
  post_views       int,
  interactions     int,
  total_followers  int,
  followers_pct    numeric(5,2) check (followers_pct between 0 and 100),   -- share of views from followers; non-followers = 100 − this
  notes            text,
  updated_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at       timestamptz not null default now(),
  unique (client_id, platform, month, week_no)
);
create index if not exists idx_kpi_client_month on public.social_kpis(client_id, month);

-- ---------------------------------------------------------------------
-- 10f. APPROVAL & MENTION NOTIFICATIONS
--   kind: 'approval' (something waits for you to approve), 'mention' (@you),
--   'info'. Approval requests go to everyone who can approve, not only the creator.
-- ---------------------------------------------------------------------
alter table public.notifications add column if not exists kind text not null default 'info';
alter table public.notifications add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists ref_id uuid;   -- the task / post an approval request is about
create index if not exists idx_notif_ref on public.notifications(ref_id) where ref_id is not null;
create index if not exists idx_notif_user_unread on public.notifications(user_id, read, created_at desc);

drop function if exists public.notify_kind(uuid, text, text, text, text);
create or replace function public.notify_kind(uid uuid, t text, b text, l text, k text, ref uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, title, body, link, kind, actor_id, ref_id)
  select uid, t, b, l, coalesce(k, 'info'), auth.uid(), ref where uid is not null and uid is distinct from auth.uid();
$$;
-- once someone has decided, the approval request disappears for everyone
create or replace function public.clear_approval(ref uuid) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read = true where ref_id = ref and kind = 'approval' and not read;
$$;

-- everyone active whose role has one of these permissions (Administrator included)
create or replace function public.users_with_perm(variadic want text[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p join public.roles r on r.id = p.role_id
  where p.active and (r.permissions && array['*'] or r.permissions && want);
$$;

-- proof uploaded → creator + every reviewer
create or replace function public.notify_proof_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if new.status = 'internal_review' and old.status is distinct from 'internal_review' then
    for who in select new.created_by union select public.users_with_perm('tasks.review') loop
      perform public.notify_kind(who, 'Approval needed: design proof', new.code || ' · ' || new.title, '/approvals', 'approval', new.id);
    end loop;
  elsif old.status = 'internal_review' and new.status is distinct from 'internal_review' then
    perform public.clear_approval(new.id);
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_proof_review on public.design_tasks;
create trigger trg_notify_proof_review after update of status on public.design_tasks
  for each row execute function public.notify_proof_review();

-- post sent for internal approval → everyone who manages the calendar
create or replace function public.notify_post_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid; cname text;
begin
  if new.status = 'internal_review' and (tg_op = 'INSERT' or old.status is distinct from 'internal_review') then
    select name into cname from public.clients where id = new.client_id;
    for who in select public.users_with_perm('calendar.manage') loop
      perform public.notify_kind(who, 'Approval needed: post', coalesce(cname, '') || ' · ' || new.title || ' · ' || to_char(new.publish_date, 'DD Mon'), '/approvals', 'approval', new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'internal_review' then
    perform public.clear_approval(new.id);
    if new.status in ('copywriting', 'in_design', 'idea') then
      perform public.notify_kind(coalesce(new.assignee_id, new.created_by), 'Changes requested on a post', new.title, '/calendar', 'info');
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_post_review on public.content_posts;
create trigger trg_notify_post_review after insert or update of status on public.content_posts
  for each row execute function public.notify_post_review();

-- @mentions: "@Arjun" (first name) or "@ArjunDas" (full name without spaces), case-insensitive
create or replace function public.notify_mentions(p_body text, p_where text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare tok text; who uuid; me text;
begin
  if p_body is null or position('@' in p_body) = 0 then return; end if;
  select full_name into me from public.profiles where id = auth.uid();
  for tok in select distinct lower(m[1]) from regexp_matches(p_body, '@([A-Za-z][A-Za-z0-9_.]{1,40})', 'g') m loop
    for who in
      select id from public.profiles where active and (
        lower(regexp_replace(full_name, '[^A-Za-z0-9]', '', 'g')) = regexp_replace(tok, '[^a-z0-9]', '', 'g')
        or (lower(split_part(full_name, ' ', 1)) = tok
            and (select count(*) from public.profiles x where x.active and lower(split_part(x.full_name, ' ', 1)) = tok) = 1))
    loop
      perform public.notify_kind(who, coalesce(me, 'Someone') || ' mentioned you · ' || p_where, left(p_body, 160), p_link, 'mention');
    end loop;
  end loop;
end $$;

create or replace function public.comment_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.design_tasks;
begin
  if new.kind <> 'comment' then return null; end if;
  select * into t from public.design_tasks where id = new.task_id;
  perform public.notify_mentions(new.body, t.code, '/tasks/' || t.id);
  return null;
end $$;
drop trigger if exists trg_comment_mentions on public.task_comments;
create trigger trg_comment_mentions after insert on public.task_comments for each row execute function public.comment_mentions();

create or replace function public.reply_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare q public.queries;
begin
  select * into q from public.queries where id = new.query_id;
  perform public.notify_mentions(new.body, 'query: ' || q.subject, '/queries/' || q.id);
  return null;
end $$;
drop trigger if exists trg_reply_mentions on public.query_replies;
create trigger trg_reply_mentions after insert on public.query_replies for each row execute function public.reply_mentions();

create or replace function public.query_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_mentions(new.body, 'query: ' || new.subject, '/queries/' || new.id);
  return null;
end $$;
drop trigger if exists trg_query_mentions on public.queries;
create trigger trg_query_mentions after insert on public.queries for each row execute function public.query_mentions();

-- ---------------------------------------------------------------------
-- 10g. COMMERCIAL PROPOSAL (quotation) CONTENT — from the standard Aqlyon proposal
--   Text uses a light format: "## Heading", "- bullet", **bold**.
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'quote_terms') then
    alter table public.settings add column quote_terms text;
    -- first time only: the proposal says two revisions per creative are included
    update public.settings set default_max_revisions = 2 where id = 1 and default_max_revisions = 3;
  end if;
end $$;
alter table public.settings add column if not exists proposal_intro text;
alter table public.settings add column if not exists client_responsibilities text;
alter table public.settings add column if not exists proposal_exclusions text;
alter table public.settings add column if not exists proposal_acceptance text;
alter table public.settings add column if not exists approval_hours int not null default 24;
update public.settings set
  quote_terms = coalesce(quote_terms, '## Project Scope
- The scope of work is limited to the services mentioned in the selected package.
- Any additional work requested outside the agreed scope will be quoted separately and undertaken only after written approval.
## Campaign Duration
- The campaign will commence upon receipt of the advance payment and all required content from the client.
- The proposal is designed to support the brand until the agreed campaign period. Any extension beyond the agreed campaign period will be charged separately.
## Payment Terms
- **50% advance payment** is required to initiate the project.
- The remaining **50% must be paid before the completion of the campaign**.
- All payments are non-refundable once the campaign has commenced.
## Advertisement Budget
- The quoted package includes **advertisement management only**.
- The actual advertising budget for Meta (Facebook & Instagram) and/or Google Ads is **not included** in the package price and shall be paid directly by the client to the respective advertising platform.
## Approval Process
- All creatives, captions, and promotional materials will be shared for approval before publishing.
- The client is requested to provide feedback within **24 hours**.
- If no response is received within this period, Aqlyon Brand Management reserves the right to proceed with the scheduled publication to avoid campaign delays.
## Revisions
- Up to **two revisions** are included for each creative design.
- Additional revisions or major design changes after approval may incur additional charges.
## Photography & Videography
- Photography, videography, drone shoots, and event coverage are included only in packages where explicitly mentioned or when purchased as add-on services.
- Weather conditions, venue restrictions, or unforeseen circumstances may affect outdoor shoots.
## Performance Disclaimer
- Aqlyon Brand Management will use industry best practices to maximize campaign performance.
- However, specific business outcomes such as sales, revenue, customer footfall, or return on investment (ROI) cannot be guaranteed, as these depend on various external factors including market conditions, pricing, competition, customer behavior, and advertisement budget.
## Intellectual Property
- Upon full payment, all approved creative assets produced specifically for this campaign become the property of the client.
- Aqlyon Brand Management reserves the right to showcase completed work in its portfolio, website, and social media channels unless otherwise agreed in writing.
## Campaign Schedule
- Campaign timelines are based on the agreed project schedule.
- Any postponement by the client may require revisions to the campaign plan and may result in additional charges if the campaign duration is extended.
## Cancellation
- If the project is cancelled after work has commenced, the advance payment will not be refunded.
- Any completed work beyond the value of the advance payment will be invoiced separately.
## Communication
- All official project communications, approvals, and change requests should be made through email or WhatsApp to ensure proper documentation.
## Proposal Validity
- This proposal and pricing are valid for **15 days** from the date of issue.'),
  proposal_intro = coalesce(proposal_intro, '## Who are we?
At Aqlyon Brand Management, we transform bold ideas into powerful digital stories.
We''re a next-gen digital marketing and creative agency driven by innovation, strategy, and storytelling. From corporate and personal branding to explainer videos, social media content, and full-scale brand management, we help brands stand out in a world full of noise.
Whether you''re launching a startup, elevating a personal brand, or scaling a corporation, we create content that connects, campaigns that convert, and strategies that stick. With a team of passionate creatives and digital experts, Aqlyon is your all-in-one partner for building visibility, authority, and emotional impact in the digital age.
## Proposal Objective
Today''s customers discover products through Facebook, Instagram, Google Search, and WhatsApp before they visit a store. Our goal is to increase your brand''s visibility in the local market, attract more potential customers, and build a strong online presence for your business.
## Our Objectives
- Increasing local brand awareness in your locality and nearby areas
- Building trust through consistent online presence
- Showcasing new arrivals and attractive collections
- Driving more customer enquiries through WhatsApp and social media
- Encouraging more walk-in customers
- Creating a professional digital identity for the business
**Please note:** Digital marketing helps improve visibility, reach, engagement, and customer enquiries. However, sales depend on several factors including pricing, product selection, customer experience, competition, seasonality, and market demand. Therefore, we do not guarantee a specific number of sales or revenue.'),
  client_responsibilities = coalesce(client_responsibilities, '- Provide logo and branding materials
- Product photographs (or allow our team to capture them)
- Offer details (if any)
- Advertisement budget
- Design approvals within 24 hours
Delays in providing the above may affect the campaign schedule.'),
  proposal_exclusions = coalesce(proposal_exclusions, '- Photography / Videography
- Event Coverage
- Google Business Profile Optimization
- Advertisement budget (paid directly by the client)'),
  proposal_acceptance = coalesce(proposal_acceptance, 'By confirming this proposal and making the advance payment, the client acknowledges that they have read, understood, and agreed to all the terms and conditions stated above. Once signed below, this document can be considered as an official Purchase Order.')
where id = 1;
-- per quotation: print as a full commercial proposal (intro, responsibilities, T&C, signature) or a short quote
alter table public.quotations add column if not exists full_proposal boolean not null default true;
alter table public.quotations add column if not exists subject text;
alter table public.quotations add column if not exists responsibilities text;
alter table public.quotations add column if not exists exclusions text;

-- ---------------------------------------------------------------------
-- 10h. ONE-TIME DATA CHANGES (each runs once, even if this script is re-run)
-- ---------------------------------------------------------------------
create table if not exists public.schema_changes (id text primary key, applied_at timestamptz not null default now());
alter table public.schema_changes enable row level security;
do $$ begin
  if not exists (select 1 from public.schema_changes where id = 'money-view-2026-10') then
    -- money values are now visible only with "See prices & money": give it to the Finance role
    update public.roles set permissions = array_append(permissions, 'money.view') where key = 'finance' and not ('money.view' = any(permissions));
    insert into public.schema_changes(id) values ('money-view-2026-10');
  end if;
end $$;

-- every money movement in one place (in = client payments, out = supplier payments + expenses)
create or replace view public.v_money_movements with (security_invoker = true) as
select p.id, p.paid_on as on_date, 'in'::text as direction, 'Client payment'::text as kind, p.amount, p.method, p.reference, p.note,
       p.client_id, c.name as client_name, null::uuid as supplier_id, null::text as supplier_name, p.invoice_id, i.number as invoice_number,
       null::uuid as bill_id, null::text as bill_number
from public.payments p left join public.clients c on c.id = p.client_id left join public.invoices i on i.id = p.invoice_id
union all
select sp.id, sp.paid_on, 'out', 'Supplier payment (' || sp.kind || ')', sp.amount, sp.method, sp.reference, sp.note,
       null, null, sp.supplier_id, s.name, null, null, sp.bill_id, b.number
from public.supplier_payments sp join public.suppliers s on s.id = sp.supplier_id left join public.supplier_bills b on b.id = sp.bill_id
where sp.paid_by is null   -- paid from someone's own account: cash leaves when they are repaid
union all
select e.id, e.spent_on, 'out', 'Expense · ' || e.category, e.amount, e.method, e.vendor, e.description,
       e.client_id, c.name, null, null, null, null, null, null
from public.expenses e left join public.clients c on c.id = e.client_id
where e.paid_by is null   -- paid from a founder's / staff member's own account: cash leaves only when repaid
union all
select r.id, r.paid_on, 'out', 'Repaid to ' || coalesce(pr.full_name, 'team member'), r.amount, r.method, r.reference, r.note,
       null, null, null, null, null, null, null, null
from public.reimbursements r left join public.profiles pr on pr.id = r.person_id;

-- ---------------------------------------------------------------------
-- 11. CLIENT APPROVAL PORTAL (public, token based, no login)
-- ---------------------------------------------------------------------
create or replace function public.portal_get(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lnk public.approval_links; c public.clients; res jsonb;
begin
  select * into lnk from public.approval_links where token = p_token and not revoked and expires_at > now();
  if lnk.token is null then return jsonb_build_object('error','This link is invalid or has expired.'); end if;
  select * into c from public.clients where id = lnk.client_id;
  select jsonb_build_object(
    'client', jsonb_build_object('name', c.name, 'contact', c.contact_person),
    'company', (select jsonb_build_object('name', company_name, 'phone', phone, 'website', website, 'approval_hours', approval_hours) from public.settings where id=1),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) - 'created_by' order by p.publish_date)
              from (select id, publish_date, publish_time, platforms, post_type, title, caption, hashtags, cta, media_link, status, client_note, design_task_id
                    from public.content_posts
                    where client_id = c.id and status in ('client_approval','approved','scheduled','published')
                      and publish_date >= current_date - 7) p), '[]'),
    'proofs', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
              select jsonb_build_object('id', pr.id, 'task_code', t.code, 'task_title', t.title, 'task_type', t.task_type,
                     'version', pr.version, 'file_path', pr.file_path, 'file_type', pr.file_type, 'external_link', pr.external_link,
                     'note', pr.note, 'client_decision', pr.client_decision, 'client_note', pr.client_note, 'created_at', pr.created_at) x
              from public.task_proofs pr join public.design_tasks t on t.id = pr.task_id
              where t.client_id = c.id and pr.status = 'approved'
                and (pr.client_decision is null or pr.client_decided_at > now() - interval '14 days')
                and pr.version = (select max(version) from public.task_proofs where task_id = t.id)) s), '[]')
  ) into res;
  return res;
end $$;

create or replace function public.portal_decide(p_token text, p_kind text, p_id uuid, p_decision text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare lnk public.approval_links; ok boolean := false; t public.design_tasks; p public.content_posts;
begin
  select * into lnk from public.approval_links where token = p_token and not revoked and expires_at > now();
  if lnk.token is null then return jsonb_build_object('error','Link invalid or expired'); end if;
  if p_decision not in ('approved','changes_requested') then return jsonb_build_object('error','Bad decision'); end if;

  if p_kind = 'post' then
    update public.content_posts set
      status = case when p_decision = 'approved' then 'approved' else 'copywriting' end,
      client_note = nullif(p_note,''), client_decided_at = now()
    where id = p_id and client_id = lnk.client_id and status = 'client_approval'
    returning * into p;
    ok := p.id is not null;
    if ok then
      perform public.notify(p.created_by, 'Client ' || replace(p_decision,'_',' ') || ' a post', p.title || coalesce(' — ' || p_note,''), '/calendar');
    end if;
  elsif p_kind = 'proof' then
    update public.task_proofs pr set client_decision = p_decision, client_note = nullif(p_note,''), client_decided_at = now()
    from public.design_tasks dt
    where pr.id = p_id and dt.id = pr.task_id and dt.client_id = lnk.client_id and pr.client_decision is null;
    get diagnostics ok = row_count;
    if ok and nullif(p_note,'') is not null then
      insert into public.task_comments(task_id, author_id, body, kind)
      select task_id, null, 'Client feedback: ' || p_note, 'client' from public.task_proofs where id = p_id;
    end if;
  end if;
  return jsonb_build_object('ok', ok);
end $$;

grant execute on function public.portal_get(text) to anon, authenticated;
grant execute on function public.portal_decide(text, text, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. REPORTING VIEWS (security_invoker → respect RLS of caller)
-- ---------------------------------------------------------------------
drop view if exists public.v_invoice_status;   -- rebuilt: invoices gains columns over time
create or replace view public.v_invoice_status with (security_invoker = true) as
select i.*, c.name as client_name,
       (i.total - i.amount_paid) as balance,
       case when i.status in ('sent','partial') and i.due_date < current_date then true else false end as overdue,
       greatest(current_date - i.due_date, 0) as days_overdue
from public.invoices i join public.clients c on c.id = i.client_id;

create or replace view public.v_monthly_finance with (security_invoker = true) as
with m as (
  select date_trunc('month', issue_date)::date as month, sum(total) as invoiced
  from public.invoices where status <> 'cancelled' group by 1),
p as (select date_trunc('month', paid_on)::date as month, sum(amount) as collected from public.payments group by 1),
e as (select date_trunc('month', spent_on)::date as month, sum(amount) as expenses from public.expenses group by 1),
months as (select month from m union select month from p union select month from e)
select months.month,
       coalesce(m.invoiced,0) as invoiced,
       coalesce(p.collected,0) as collected,
       coalesce(e.expenses,0) as expenses,
       coalesce(p.collected,0) - coalesce(e.expenses,0) as net_cash
from months left join m using(month) left join p using(month) left join e using(month)
order by month;

-- ---------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY — every rule checks a permission from the user's role
--   (roles and their permissions are edited in the app: Team & Access → Roles)
-- ---------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['roles','staff_pay','profiles','settings','services','leads','clients','packages','interactions','projects',
    'design_tasks','task_proofs','task_comments','time_logs','queries','query_replies','content_posts','approval_links',
    'quotations','invoices','payments','expenses','notifications','activity_log',
    'suppliers','supplier_bills','supplier_bill_allocations','supplier_payments','reimbursements','social_kpis'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- drop existing policies so this script can be re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- roles: staff read; team managers edit (the built-in Administrator role is protected by trigger)
create policy p_roles_read  on public.roles for select to authenticated using (public.is_staff());
create policy p_roles_write on public.roles for all to authenticated using (public.has_perm('team.manage')) with check (public.has_perm('team.manage'));

-- profiles
create policy p_profiles_read  on public.profiles for select to authenticated using (true);
create policy p_profiles_self  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role_id is not distinct from public.my_role_id() and active);
create policy p_profiles_admin on public.profiles for all to authenticated using (public.has_perm('team.manage')) with check (public.has_perm('team.manage'));

-- salary: only the person themself and team managers (reports get cost rates via staff_cost_rates())
create policy p_pay_read  on public.staff_pay for select to authenticated
  using (user_id = auth.uid() or public.has_perm('team.manage'));
create policy p_pay_write on public.staff_pay for all to authenticated using (public.has_perm('team.manage')) with check (public.has_perm('team.manage'));

-- settings / services
create policy p_settings_read  on public.settings for select to authenticated using (true);
create policy p_settings_admin on public.settings for update to authenticated using (public.has_perm('settings.manage'));
create policy p_services_read  on public.services for select to authenticated using (true);
create policy p_services_write on public.services for all to authenticated
  using (public.has_perm('settings.manage', 'quotations.manage', 'invoices.manage')) with check (public.has_perm('settings.manage', 'quotations.manage', 'invoices.manage'));

-- leads & conversation log
create policy p_leads_read on public.leads for select to authenticated using (public.has_perm('leads.view', 'leads.manage'));
create policy p_leads_rw   on public.leads for all to authenticated using (public.has_perm('leads.manage')) with check (public.has_perm('leads.manage'));
create policy p_inter_read on public.interactions for select to authenticated
  using (public.has_perm('leads.view', 'leads.manage') or (client_id is not null and public.has_perm('clients.manage')));
create policy p_inter_rw   on public.interactions for all to authenticated
  using (public.has_perm('leads.manage', 'clients.manage')) with check (public.has_perm('leads.manage', 'clients.manage'));

-- clients (staff with any working permission can see names; full list needs clients.view)
create policy p_clients_read  on public.clients for select to authenticated
  using (public.has_perm('clients.view', 'clients.manage', 'tasks.view', 'tasks.work', 'invoices.view', 'quotations.view', 'calendar.view', 'suppliers.view', 'leads.manage')
         or (customer_type = 'walkin' and public.is_staff()));
create policy p_clients_write on public.clients for insert to authenticated with check (public.has_perm('clients.manage', 'leads.manage'));
create policy p_clients_upd   on public.clients for update to authenticated using (public.has_perm('clients.manage'));
create policy p_clients_del   on public.clients for delete to authenticated using (public.is_admin());

create policy p_pk_read  on public.packages for select to authenticated using (public.has_perm('packages.view', 'packages.manage', 'invoices.manage'));
create policy p_pk_write on public.packages for all to authenticated using (public.has_perm('packages.manage')) with check (public.has_perm('packages.manage'));

create policy p_proj_read  on public.projects for select to authenticated using (public.has_perm('projects.view', 'projects.manage', 'tasks.view', 'tasks.work', 'tasks.manage'));
create policy p_proj_write on public.projects for all to authenticated using (public.has_perm('projects.manage')) with check (public.has_perm('projects.manage'));

-- design tasks: tasks.view sees all; tasks.work sees own + unassigned
create policy p_task_read on public.design_tasks for select to authenticated
  using (public.has_perm('tasks.view', 'tasks.manage', 'tasks.review') or (public.has_perm('tasks.work') and (assignee_id = auth.uid() or assignee_id is null)));
create policy p_task_ins on public.design_tasks for insert to authenticated with check (public.has_perm('tasks.manage'));
create policy p_task_upd_mgr on public.design_tasks for update to authenticated using (public.has_perm('tasks.manage', 'tasks.review'));
create policy p_task_upd_worker on public.design_tasks for update to authenticated
  using (public.has_perm('tasks.work') and (assignee_id = auth.uid() or assignee_id is null))
  with check (assignee_id = auth.uid());
create policy p_task_del on public.design_tasks for delete to authenticated using (public.has_perm('tasks.manage'));

create policy p_proof_read on public.task_proofs for select to authenticated
  using (exists (select 1 from public.design_tasks t where t.id = task_id));
create policy p_proof_ins  on public.task_proofs for insert to authenticated with check (public.has_perm('tasks.work', 'tasks.manage', 'tasks.review'));
create policy p_proof_upd  on public.task_proofs for update to authenticated
  using (public.has_perm('tasks.review', 'tasks.manage') or uploaded_by = auth.uid());
create policy p_proof_del  on public.task_proofs for delete to authenticated
  using (public.is_admin() or (uploaded_by = auth.uid() and status = 'pending'));

create policy p_cmt_read on public.task_comments for select to authenticated
  using (exists (select 1 from public.design_tasks t where t.id = task_id));
create policy p_cmt_ins  on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.design_tasks t where t.id = task_id));
create policy p_cmt_del  on public.task_comments for delete to authenticated using (public.is_admin() or author_id = auth.uid());

-- time logs: own rows; timesheet.all sees everyone's
create policy p_time_read on public.time_logs for select to authenticated using (user_id = auth.uid() or public.has_perm('timesheet.all', 'reports.team', 'reports.clients'));
create policy p_time_ins on public.time_logs for insert to authenticated with check ((user_id = auth.uid() and public.is_staff()) or public.has_perm('team.manage'));
create policy p_time_upd on public.time_logs for update to authenticated using (user_id = auth.uid() or public.has_perm('team.manage'));
create policy p_time_del on public.time_logs for delete to authenticated using (user_id = auth.uid() or public.has_perm('team.manage'));

-- team queries: sender, recipient, recipient role, admin
create policy p_q_read on public.queries for select to authenticated
  using (public.is_admin() or from_user = auth.uid() or to_user = auth.uid() or to_role_id = public.my_role_id());
create policy p_q_ins  on public.queries for insert to authenticated with check (from_user = auth.uid() and public.is_staff());
create policy p_q_upd  on public.queries for update to authenticated
  using (public.is_admin() or from_user = auth.uid() or to_user = auth.uid() or to_role_id = public.my_role_id());
create policy p_q_del  on public.queries for delete to authenticated using (public.is_admin() or from_user = auth.uid());
create policy p_qr_read on public.query_replies for select to authenticated
  using (exists (select 1 from public.queries q where q.id = query_id));
create policy p_qr_ins on public.query_replies for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.queries q where q.id = query_id));

-- content calendar & client approval links
create policy p_kpi_read  on public.social_kpis for select to authenticated using (public.has_perm('calendar.view', 'calendar.manage', 'clients.view', 'clients.manage', 'reports.content'));
create policy p_kpi_write on public.social_kpis for all to authenticated using (public.has_perm('calendar.manage', 'clients.manage')) with check (public.has_perm('calendar.manage', 'clients.manage'));
create policy p_post_read  on public.content_posts for select to authenticated using (public.has_perm('calendar.view', 'calendar.manage'));
create policy p_post_write on public.content_posts for all to authenticated using (public.has_perm('calendar.manage')) with check (public.has_perm('calendar.manage'));
create policy p_links on public.approval_links for all to authenticated
  using (public.has_perm('calendar.manage', 'clients.manage')) with check (public.has_perm('calendar.manage', 'clients.manage'));

-- finance
create policy p_quote_read on public.quotations for select to authenticated using (public.has_perm('quotations.view', 'quotations.manage'));
create policy p_quote_rw   on public.quotations for all to authenticated using (public.has_perm('quotations.manage')) with check (public.has_perm('quotations.manage'));
create policy p_inv_read on public.invoices for select to authenticated using (public.has_perm('invoices.view', 'invoices.manage', 'payments.manage')
  or (sale_channel = 'walkin' and created_by = auth.uid())
  or exists (select 1 from public.payments p where p.invoice_id = invoices.id and p.collected_by = auth.uid()));
create policy p_inv_rw   on public.invoices for all to authenticated using (public.has_perm('invoices.manage')) with check (public.has_perm('invoices.manage'));
create policy p_inv_paid on public.invoices for update to authenticated using (public.has_perm('payments.manage'));  -- mark sent when recording a payment
create policy p_pay_read on public.payments for select to authenticated using (public.has_perm('payments.manage', 'invoices.view', 'invoices.manage', 'reports.finance') or collected_by = auth.uid());
create policy p_pay_rw   on public.payments for all to authenticated using (public.has_perm('payments.manage')) with check (public.has_perm('payments.manage'));
create policy p_exp_read on public.expenses for select to authenticated using (public.has_perm('expenses.manage', 'payments.manage', 'reports.finance', 'reports.clients') or paid_by = auth.uid());
create policy p_reimb_read on public.reimbursements for select to authenticated using (public.has_perm('expenses.manage', 'payments.manage', 'reports.finance') or person_id = auth.uid());
create policy p_reimb_rw   on public.reimbursements for all to authenticated using (public.has_perm('expenses.manage', 'payments.manage')) with check (public.has_perm('expenses.manage', 'payments.manage'));
create policy p_exp_rw   on public.expenses for all to authenticated using (public.has_perm('expenses.manage')) with check (public.has_perm('expenses.manage'));

-- suppliers & work orders
create policy p_sup_read on public.suppliers for select to authenticated using (public.has_perm('suppliers.view', 'suppliers.manage', 'suppliers.pay', 'expenses.manage', 'payments.manage', 'reports.finance'));
create policy p_sup_rw   on public.suppliers for all to authenticated using (public.has_perm('suppliers.manage', 'expenses.manage')) with check (public.has_perm('suppliers.manage', 'expenses.manage'));
create policy p_sb_read  on public.supplier_bills for select to authenticated using (public.has_perm('suppliers.view', 'suppliers.manage', 'suppliers.pay', 'reports.finance', 'reports.clients'));
create policy p_sb_rw    on public.supplier_bills for all to authenticated using (public.has_perm('suppliers.manage')) with check (public.has_perm('suppliers.manage'));
create policy p_sba_read on public.supplier_bill_allocations for select to authenticated using (public.has_perm('suppliers.view', 'suppliers.manage', 'suppliers.pay', 'reports.clients', 'invoices.view'));
create policy p_sba_rw   on public.supplier_bill_allocations for all to authenticated using (public.has_perm('suppliers.manage')) with check (public.has_perm('suppliers.manage'));
create policy p_sp_read  on public.supplier_payments for select to authenticated using (public.has_perm('suppliers.view', 'suppliers.pay', 'payments.manage', 'reports.finance', 'invoices.view', 'expenses.manage') or paid_by = auth.uid());
create policy p_sp_rw    on public.supplier_payments for all to authenticated using (public.has_perm('suppliers.pay')) with check (public.has_perm('suppliers.pay'));

-- notifications: own only
create policy p_notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy p_notif_upd  on public.notifications for update to authenticated using (user_id = auth.uid());
create policy p_notif_del  on public.notifications for delete to authenticated using (user_id = auth.uid());

-- activity log
create policy p_act_read on public.activity_log for select to authenticated using (public.is_admin());
create policy p_act_ins  on public.activity_log for insert to authenticated with check (actor_id = auth.uid());

-- protect the built-in Administrator role and keep at least one active administrator
create or replace function public.protect_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.key = 'admin' then
    if tg_op = 'DELETE' then raise exception 'The Administrator role cannot be deleted'; end if;
    new.permissions := '{*}'; new.is_system := true; new.key := 'admin';
  end if;
  if tg_op = 'DELETE' and exists (select 1 from public.profiles where role_id = old.id) then
    raise exception 'Move the users on this role to another role before deleting it';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_protect_roles on public.roles;
create trigger trg_protect_roles before update or delete on public.roles for each row execute function public.protect_roles();

create or replace function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p join public.roles r on r.id = p.role_id where r.key = 'admin' and p.active) then
    raise exception 'At least one active Administrator is required';
  end if;
  return null;
end $$;
drop trigger if exists trg_keep_one_admin on public.profiles;
create trigger trg_keep_one_admin after update of role_id, active on public.profiles
  for each row execute function public.keep_one_admin();

-- internal cost per hour for profitability reports — never exposes the salary itself
create or replace function public.staff_cost_rates() returns table (user_id uuid, cost_per_hour numeric)
language sql stable security definer set search_path = public as $$
  select sp.user_id, sp.cost_per_hour from public.staff_pay sp
  where public.has_perm('team.manage', 'reports.clients', 'reports.team')
$$;
grant execute on function public.staff_cost_rates() to authenticated;

-- ---------------------------------------------------------------------
-- 14. STORAGE BUCKETS (proofs, receipts, files)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('proofs','proofs', false), ('receipts','receipts', false), ('files','files', false)
on conflict (id) do nothing;

drop policy if exists "erp read proofs" on storage.objects;
drop policy if exists "erp write proofs" on storage.objects;
drop policy if exists "erp delete proofs" on storage.objects;
drop policy if exists "erp receipts" on storage.objects;
drop policy if exists "erp files" on storage.objects;

create policy "erp read proofs" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.has_perm('tasks.view', 'tasks.work', 'tasks.manage', 'tasks.review'));
create policy "erp write proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.has_perm('tasks.work', 'tasks.manage', 'tasks.review'));
create policy "erp delete proofs" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (public.is_admin() or owner = auth.uid()));
create policy "erp receipts" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and public.has_perm('expenses.manage'))
  with check (bucket_id = 'receipts' and public.has_perm('expenses.manage'));
create policy "erp files" on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_staff())
  with check (bucket_id = 'files' and public.is_staff());

-- client portal needs to show proof images: signed URLs are generated by a
-- security-definer-free path, so we expose a tiny function returning the path
-- and let the portal request a signed URL via the Netlify function.

-- ---------------------------------------------------------------------
-- 15. REALTIME (live updates for tasks, comments, queries, notifications)
-- ---------------------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.notifications;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.task_comments;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.query_replies;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.design_tasks;   exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- 16. STARTER SERVICE CATALOGUE (edit prices in Settings → Services)
-- ---------------------------------------------------------------------
insert into public.services (name, category, unit, rate)
select * from (values
  ('Social Media Management – Starter (12 posts)', 'Social Media', 'per month', 8000),
  ('Social Media Management – Growth (20 posts + 4 reels)', 'Social Media', 'per month', 15000),
  ('Social Media Management – Premium (30 posts + 8 reels)', 'Social Media', 'per month', 25000),
  ('Static Post Design', 'Design', 'per item', 500),
  ('Carousel Design (up to 5 slides)', 'Design', 'per item', 1200),
  ('Story Design', 'Design', 'per item', 300),
  ('Reel Editing (up to 30 sec)', 'Video', 'per item', 1500),
  ('Logo Design', 'Branding', 'per project', 5000),
  ('Brand Identity Kit', 'Branding', 'per project', 15000),
  ('Brochure / Flyer Design', 'Design', 'per item', 2000),
  ('Meta Ads Management', 'Ads', 'per month', 6000),
  ('Google Ads Management', 'Ads', 'per month', 7000),
  ('SEO – Local / Google Business Profile', 'SEO', 'per month', 5000),
  ('Website Design – Landing Page', 'Web', 'per project', 15000),
  ('Product / Promo Shoot', 'Video', 'per project', 8000)
) v(name, category, unit, rate)
where not exists (select 1 from public.services);

-- services from the standard commercial proposal (added once each; rates of 0 are filled in per quote)
insert into public.services (name, category, unit, rate, description)
select v.name, v.category, v.unit, v.rate, v.description from (values
  ('Starter Package – Social Media & Brand Management', 'Social Media', 'per month', 14999, 'Facebook, Instagram & Google Business Profile management · 12 creative posts + 8 promotional stories per month · locally-tailored, search-optimised content · product showcase, festival, offer & WhatsApp status designs · captions with hashtags, local keywords & CTA · Google Business updates · WhatsApp marketing creatives · Facebook & Instagram ads management (ad budget paid by client) · marketing ideas'),
  ('Facebook Page Management', 'Social Media', 'per month', 0, 'Posting, page upkeep and audience engagement'),
  ('Instagram Management', 'Social Media', 'per month', 0, 'Posting, profile upkeep and audience engagement'),
  ('Google Business Profile Management', 'SEO', 'per month', 0, 'Publishing business updates, uploading promotional creatives, optimising profile visibility, encouraging customer engagement'),
  ('Google Business Profile Optimization', 'SEO', 'per project', 0, 'One-time profile set-up and optimisation'),
  ('Creative Post Design', 'Design', 'per item', 0, 'Brand-matched social media post'),
  ('Promotional Story Design', 'Design', 'per item', 0, 'Instagram / Facebook story'),
  ('Product Showcase Design', 'Design', 'per item', 0, NULL),
  ('Product Poster Design', 'Design', 'per item', 0, NULL),
  ('Festival & Special Occasion Creative', 'Design', 'per item', 0, 'Festival greetings and occasion posts'),
  ('Offer Poster Design', 'Design', 'per item', 0, NULL),
  ('Promotional Banner Design', 'Design', 'per item', 0, NULL),
  ('WhatsApp Status Design', 'Design', 'per item', 0, NULL),
  ('Customer Engagement Post', 'Design', 'per item', 0, 'Polls, questions and interactive posts'),
  ('Content Writing – Locally-tailored & Search Optimised', 'Content', 'per month', 0, NULL),
  ('Caption Writing', 'Content', 'per item', 0, 'Attractive caption, relevant hashtags, local targeting keywords and a clear call-to-action'),
  ('Marketing Ideas & Campaign Planning', 'Content', 'per month', 0, NULL),
  ('Influencer Collaboration', 'Social Media', 'per project', 0, 'Coordination with local influencers (influencer fee extra)'),
  ('Reel Creation', 'Video', 'per item', 0, 'Concept, shoot and edit of a short reel'),
  ('WhatsApp Marketing Creatives', 'Design', 'per month', 0, 'Ready-to-share promotional posters, festival greetings, offer creatives and product highlights'),
  ('Bulk WhatsApp Messaging', 'Other', 'per 1,000 contacts', 0, 'Charge depends on the number of contacts'),
  ('Paid Ads Management – Facebook & Instagram', 'Ads', 'per month', 0, 'Audience targeting within the customer''s location and nearby areas, campaign optimisation. Ad budget paid directly by the client.'),
  ('Photography / Videography', 'Photography', 'per project', 0, NULL),
  ('Drone Shoot', 'Photography', 'per project', 0, NULL),
  ('Event Coverage', 'Photography', 'per event', 0, NULL)
) v(name, category, unit, rate, description)
where not exists (select 1 from public.services s where lower(s.name) = lower(v.name));

-- ---------------------------------------------------------------------
-- 17. GRANTS (Supabase sets these by default; repeated here for safety)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.convert_lead(uuid) to authenticated;
grant execute on function public.generate_retainer_invoices(date) to authenticated;
