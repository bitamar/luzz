-- users table for Google OIDC identities
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text,
  name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- studio_owners mapping
create table if not exists public.studio_owners (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager')),
  created_at timestamptz not null default now(),
  constraint studio_owners_pkey primary key (studio_id, user_id)
);

-- helpful index for lookups by user
create index if not exists studio_owners_user_idx on public.studio_owners(user_id);


