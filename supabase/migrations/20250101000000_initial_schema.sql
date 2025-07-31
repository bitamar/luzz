-- ---------- Extensions ----------
create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- ---------- Custom types ----------
create type payment_method as enum ('cash', 'bit', 'paybox', 'transfer');

-- ---------- Tables ----------
create table studios (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  timezone  text not null default 'Asia/Jerusalem',
  currency  char(3) not null default 'ILS'              -- ISO-4217
);

create table customers (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null references studios(id) on delete cascade,
  first_name    text not null,
  avatar_key    text,
  contact_phone text,
  contact_email text,
  created_at    timestamptz default now()
);

create table slots (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references studios(id) on delete cascade,
  title            text not null,
  starts_at        timestamptz not null,
  duration_min     int  not null,
  recurrence_rule  text,                             -- NULL ⇒ one-time
  price            numeric(10,2) not null,
  min_participants int  not null,
  max_participants int  not null,
  for_children     boolean not null default false,
  active           boolean not null default true
);

create table invites (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references studios(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  short_hash  text not null unique,
  created_at  timestamptz default now(),
  expires_at  timestamptz
);

create table children (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  first_name  text not null,
  avatar_key  text not null,
  created_at  timestamptz default now()
);

create table bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references slots(id) on delete cascade,
  customer_id  uuid references customers(id) on delete cascade,
  child_id     uuid references children(id)  on delete cascade,
  status       text not null default 'CONFIRMED',
  created_at   timestamptz default now(),
  paid         boolean not null default false,
  paid_at      timestamptz,
  paid_method  payment_method,
  -- exactly one of customer_id or child_id must be present
  constraint one_party check (
    (customer_id is not null)::int + (child_id is not null)::int = 1
  )
); 