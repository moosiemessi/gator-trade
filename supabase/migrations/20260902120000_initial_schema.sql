-- Initial schema: extensions, enums, all twelve tables, constraints, and
-- the indexes step 4's RLS policies will scan against.

create extension if not exists pgcrypto;

create type ticket_type as enum ('assigned', 'general_admission');
create type post_status as enum ('open', 'pending', 'completed', 'withdrawn', 'expired');
create type proposal_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null,
  ufl_email         text not null unique,
  venmo_handle      text,
  avatar_key        text,
  is_verified       boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint ufl_email_domain check (ufl_email ~* '^[^@[:space:]]+@ufl\.edu$')
);

create table public.games (
  id                uuid primary key default gen_random_uuid(),
  season            integer not null,
  opponent          text not null,
  kickoff_at        timestamptz not null,
  is_home           boolean not null,
  venue             text
);

create table public.sections (
  code              text primary key,
  tier              integer not null check (tier between 1 and 5),
  level             text not null,
  is_student        boolean not null default false
);

create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references public.profiles(id) on delete cascade,
  cash_delta_cents  integer not null default 0,
  status            post_status not null default 'open',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.post_offer_items (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  game_id           uuid not null references public.games(id),
  ticket_type       ticket_type not null,
  section_code      text references public.sections(code),
  row_label         text,
  seat_labels       text[],
  quantity          integer not null check (quantity between 1 and 8)
);

create table public.post_want_items (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.posts(id) on delete cascade,
  acceptable_game_ids uuid[] not null,
  min_tier            integer check (min_tier between 1 and 5),
  max_tier            integer check (max_tier between 1 and 5),
  quantity            integer not null check (quantity between 1 and 8),
  require_together    boolean not null default false
);

create table public.proposals (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  proposer_id       uuid not null references public.profiles(id) on delete cascade,
  cash_delta_cents  integer not null,
  message           text,
  status            proposal_status not null default 'pending',
  created_at        timestamptz not null default now()
);

create unique index one_pending_proposal_per_user
  on public.proposals (post_id, proposer_id)
  where status = 'pending';

create unique index one_accepted_proposal_per_post
  on public.proposals (post_id)
  where status = 'accepted';

create table public.proposal_items (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references public.proposals(id) on delete cascade,
  game_id           uuid not null references public.games(id),
  ticket_type       ticket_type not null,
  section_code      text references public.sections(code),
  row_label         text,
  seat_labels       text[],
  quantity          integer not null check (quantity between 1 and 8)
);

create table public.handoffs (
  id                        uuid primary key default gen_random_uuid(),
  proposal_id               uuid not null unique references public.proposals(id) on delete cascade,
  author_marked_sent_at     timestamptz,
  proposer_marked_sent_at   timestamptz,
  author_confirmed_at       timestamptz,
  proposer_confirmed_at     timestamptz,
  cash_settled_at           timestamptz,
  created_at                timestamptz not null default now()
);

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references public.proposals(id) on delete cascade,
  sender_id         uuid not null references public.profiles(id) on delete cascade,
  body              text not null check (char_length(body) between 1 and 2000),
  created_at        timestamptz not null default now()
);

create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references public.profiles(id) on delete cascade,
  post_id           uuid references public.posts(id) on delete cascade,
  reported_user_id  uuid references public.profiles(id) on delete cascade,
  reason            text not null,
  created_at        timestamptz not null default now(),
  constraint reports_target_present check (post_id is not null or reported_user_id is not null)
);

create table public.post_images (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  s3_key            text not null,
  created_at        timestamptz not null default now()
);

create index posts_author_id_idx on public.posts (author_id);
create index posts_status_idx on public.posts (status);
create index proposals_post_id_idx on public.proposals (post_id);
create index proposals_proposer_id_idx on public.proposals (proposer_id);
create index post_offer_items_post_id_idx on public.post_offer_items (post_id);
create index post_offer_items_game_id_idx on public.post_offer_items (game_id);
