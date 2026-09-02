# Gator Trade Rebuild Spec, version 2

Author: Francisco Rodriguez
Status: replaces version 1 entirely. Delete the old SPEC.md.
Purpose: source of truth for Claude Code. Read it fully before writing code. Do not improvise the architecture.

---

## 1. What this is

A trading platform for University of Florida football tickets, restricted to verified UF students.

The core insight is that most activity is not buying or selling. It is two students who already hold tickets to the same game swapping seats, with cash making up the difference in seat quality. Someone in a back corner pays to move down. Someone in a good seat takes cash to move back.

Everything else the platform does is a variation on that. A pure sale is a trade where one side wants nothing but cash. A cross game trade is the same object pointing at different games.

**Hard requirements**

- TypeScript, not JavaScript
- Deployed live on AWS at a resume-ready URL

**Already done**

Step 1 of the build order is complete. Next.js with TypeScript and Tailwind is scaffolded, pushed to github.com/moosiemessi/gator-trade, and deployed on AWS Amplify at https://main.d1ylz90b9t7gnv.amplifyapp.com

---

## 2. Scope boundaries

**In scope**

- Signup restricted to ufl.edu addresses with email confirmation as the student verification
- Posts describing what a user holds, what they want, and cash in either direction
- Same game seat upgrade as the primary browse experience
- Section quality tiers so better and worse seats are a real concept
- Proposals against a post, accept or decline
- A handoff checklist after both sides agree
- Messaging on an accepted proposal
- Reporting a post or a user

**Explicitly out of scope**

- Payment processing. No Stripe, no escrow. Cash is settled privately between the two students through Venmo or Zelle. The platform records the agreed amount and nothing more.
- Actual ticket transfer. UF student tickets live in the university ticketing system and there is no public API for a third party to move them. The platform coordinates the handoff and records that it happened. It does not perform it. Do not add anything that implies otherwise, in code or in UI copy.
- Native mobile apps. Responsive web only.
- Real time chat. Refetch on navigation is fine.

Do not add features from the out of scope list even if they appear to be natural extensions.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js, App Router |
| Language | TypeScript, strict mode |
| Database | Supabase Postgres |
| Auth | Supabase Auth, email confirmation required |
| Authorization | Postgres row level security |
| Validation | Zod at every network boundary |
| Styling | Tailwind CSS |
| Image storage | S3 behind CloudFront |
| Infrastructure as code | AWS CDK, TypeScript |
| Hosting | AWS Amplify Hosting, already connected |

### TypeScript rules

- `strict: true`, no exceptions
- No `any`. Use `unknown` and narrow.
- Database types are generated with `supabase gen types typescript --linked > src/types/database.ts` and regenerated after every migration. Never hand written.
- Every server action and route handler validates input with Zod before touching the database.

---

## 4. Domain model

### The central object is a post

A post has three parts.

1. **Offer side.** The tickets the author currently holds and is willing to give up. One or more items.
2. **Want side.** What the author will accept in return. Zero or more slots. Zero slots means they want cash only, which is a straight sale.
3. **Cash delta.** A single signed integer in cents, from the author's perspective. Positive means the counterparty pays the author. Negative means the author pays the counterparty. Zero means an even swap.

One signed column covers every direction. Do not add boolean flags for who pays.

### Worked examples

| Situation | Offer side | Want side | cash_delta_cents |
|---|---|---|---|
| Upgrade seats, same game | 1 ticket, Georgia, tier 4 section | 1 slot, Georgia, tier 1 or 2, quantity 1 | -8000, author pays 80 dollars |
| Take cash to move back | 1 ticket, Georgia, tier 1 | 1 slot, Georgia, any tier, quantity 1 | +8000, other side pays author 80 |
| Straight sale | 2 tickets, LSU, tier 3 | no slots | +12000 |
| Cross game bundle | 2 tickets Georgia | 1 slot LSU quantity 1, 1 slot Kentucky quantity 1 | -5000 |

### Want slots

Each want slot is one requirement and all slots must be satisfied for a proposal to match. Within a slot, `acceptable_game_ids` is an array, so a slot can mean "LSU or Kentucky, either works."

---

## 5. Schema

Eleven tables in `public`.

### profiles

```
id                uuid primary key references auth.users(id) on delete cascade
display_name      text not null
ufl_email         text not null unique
venmo_handle      text
avatar_key        text
is_verified       boolean not null default false
created_at        timestamptz not null default now()
```

`is_verified` is set true by a trigger when `auth.users.email_confirmed_at` becomes non null and the address ends in `@ufl.edu`. Never settable from the client.

Enforce the domain at the database level with a check constraint on `ufl_email`. Client side validation is a convenience, not a control.

### games

Reference data, seeded by script, no user writes.

```
id                uuid primary key default gen_random_uuid()
season            integer not null
opponent          text not null
kickoff_at        timestamptz not null
is_home           boolean not null
venue             text
```

### sections

Reference data. This table is what makes "better seats" meaningful.

```
code              text primary key
tier              integer not null check (tier between 1 and 5)
level             text not null
is_student        boolean not null default false
```

Tier 1 is the best. Seed this from the Ben Hill Griffin Stadium seating chart. Francisco supplies the tier assignments. Do not guess at them.

### posts

```
id                uuid primary key default gen_random_uuid()
author_id         uuid not null references profiles(id) on delete cascade
cash_delta_cents  integer not null default 0
status            post_status not null default 'open'
notes             text
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

`post_status` enum with values `open`, `pending`, `completed`, `withdrawn`, `expired`.

A post auto-expires when the last game it references has kicked off. Handle this with a scheduled function or a filter on read, not a client side check.

### post_offer_items

```
id                uuid primary key default gen_random_uuid()
post_id           uuid not null references posts(id) on delete cascade
game_id           uuid not null references games(id)
ticket_type       ticket_type not null
section_code      text references sections(code)
row_label         text
seat_labels       text[]
quantity          integer not null check (quantity between 1 and 8)
```

`ticket_type` enum with values `assigned` and `general_admission`. Section, row, and seats are null for general admission, so the UI must handle a valid item with no section rather than treating it as incomplete data.

Derive whether seats are adjacent from `seat_labels` rather than asking the user to assert it.

### post_want_items

```
id                  uuid primary key default gen_random_uuid()
post_id             uuid not null references posts(id) on delete cascade
acceptable_game_ids uuid[] not null
min_tier            integer check (min_tier between 1 and 5)
max_tier            integer check (max_tier between 1 and 5)
quantity            integer not null check (quantity between 1 and 8)
require_together    boolean not null default false
```

A post with no rows here is a cash-only sale.

### proposals

```
id                uuid primary key default gen_random_uuid()
post_id           uuid not null references posts(id) on delete cascade
proposer_id       uuid not null references profiles(id) on delete cascade
cash_delta_cents  integer not null
message           text
status            proposal_status not null default 'pending'
created_at        timestamptz not null default now()
```

`proposal_status` enum with values `pending`, `accepted`, `declined`, `withdrawn`.

`cash_delta_cents` here is from the post author's perspective, same convention as the post, so a proposer can counter on price without a second field.

```sql
create unique index one_pending_proposal_per_user
  on proposals (post_id, proposer_id)
  where status = 'pending';
```

Only one proposal per post may be `accepted`. Enforce with a partial unique index on `post_id where status = 'accepted'`.

### proposal_items

What the proposer is putting up. Same shape as `post_offer_items` but keyed to a proposal.

```
id                uuid primary key default gen_random_uuid()
proposal_id       uuid not null references proposals(id) on delete cascade
game_id           uuid not null references games(id)
ticket_type       ticket_type not null
section_code      text references sections(code)
row_label         text
seat_labels       text[]
quantity          integer not null check (quantity between 1 and 8)
```

### handoffs

Created by trigger when a proposal is accepted. One row per accepted proposal.

```
id                        uuid primary key default gen_random_uuid()
proposal_id               uuid not null unique references proposals(id) on delete cascade
author_marked_sent_at     timestamptz
proposer_marked_sent_at   timestamptz
author_confirmed_at       timestamptz
proposer_confirmed_at     timestamptz
cash_settled_at           timestamptz
created_at                timestamptz not null default now()
```

A handoff is complete when all four transfer timestamps are set, plus `cash_settled_at` if `cash_delta_cents` is non zero. Each side marks only their own columns. This is the coordination record described in section 2, not a transfer mechanism.

### messages

```
id                uuid primary key default gen_random_uuid()
proposal_id       uuid not null references proposals(id) on delete cascade
sender_id         uuid not null references profiles(id) on delete cascade
body              text not null check (char_length(body) between 1 and 2000)
created_at        timestamptz not null default now()
```

Immutable. No update or delete.

### reports

```
id                uuid primary key default gen_random_uuid()
reporter_id       uuid not null references profiles(id) on delete cascade
post_id           uuid references posts(id) on delete cascade
reported_user_id  uuid references profiles(id) on delete cascade
reason            text not null
created_at        timestamptz not null default now()
```

At least one of `post_id` or `reported_user_id` must be present. Enforce with a check constraint.

### post_images

```
id                uuid primary key default gen_random_uuid()
post_id           uuid not null references posts(id) on delete cascade
s3_key            text not null
created_at        timestamptz not null default now()
```

---

## 6. Row level security

Enable RLS on all eleven tables. A table with RLS on and no policy denies everything, which is the correct starting point.

### Helper functions

Cross table ownership checks recurse if written inline. Define security definer helpers first.

```sql
create or replace function public.owns_post(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from posts
    where id = p_id and author_id = (select auth.uid())
  );
$$;
```

Write matching helpers for `can_view_proposal(uuid)`, true when the caller is the proposer or owns the parent post, and `is_verified_student()`, true when the caller's profile has `is_verified`.

### Policy intent

**profiles**
Public fields are `id`, `display_name`, `avatar_key`, and `is_verified`. Expose those through a view rather than opening the table, since `ufl_email` and `venmo_handle` must not be broadly readable. A user updates only their own row and cannot set `is_verified`. No client insert, the signup trigger creates the row.

**games and sections**
Select for any authenticated user. No insert, update, or delete policy at all.

**posts**
Select when `status = 'open'` and the caller is a verified student, or when the caller is the author regardless of status. Insert only when `author_id = (select auth.uid())` and `is_verified_student()`. Update and delete only by the author.

**post_offer_items, post_want_items, post_images**
Select when the parent post is visible. Write only when `owns_post(post_id)`.

**proposals**
Select when `can_view_proposal(id)`. Insert when `proposer_id = (select auth.uid())`, the caller is verified, the parent post is open, and the proposer is not the post author. Blocking self proposals belongs in the policy, not in the UI. Update by the proposer to withdraw, or by the post author to accept or decline. Enforce legal status transitions in a trigger.

**proposal_items**
Follows the parent proposal.

**handoffs**
Select when `can_view_proposal(proposal_id)`. No insert from the client, the accept trigger creates the row. Update restricted so each party can set only their own timestamp columns, and only forward from null to a value. A user must not be able to mark the other side's confirmation.

**messages**
Select and insert when `can_view_proposal(proposal_id)` and the proposal status is `accepted`. No update, no delete.

**reports**
Insert when `reporter_id = (select auth.uid())`. No select policy for regular users.

### Two details that matter

Write `(select auth.uid())` rather than bare `auth.uid()` inside policies. Postgres caches the former once per statement instead of evaluating it per row, which is a large difference on any table scan.

Index every column a policy filters on. At minimum `posts(author_id)`, `posts(status)`, `proposals(post_id)`, `proposals(proposer_id)`, `post_offer_items(post_id)`, and `post_offer_items(game_id)`. An unindexed policy predicate turns every read into a sequential scan.

### Proving it works

Write a test file that creates two verified users through the Supabase client and asserts that user B cannot read user A's withdrawn post, cannot insert a proposal with A's id as proposer, cannot read proposals on a post they are not party to, cannot set A's handoff timestamps, and cannot set `is_verified` on their own profile.

This test file is the single most valuable artifact in the project for interviews. Do not skip it and do not defer it.

---

## 7. The primary view

The default browse page is game-scoped, not a global feed. Pick a game, then see posts for it.

The headline feature is the seat upgrade finder. Given the section the user holds, show open posts at that game whose offer side is in a better tier, sorted by cash delta ascending. The user is answering one question, what does it cost me to move down, and the interface should answer it in one screen.

Secondary filters are tier range, quantity, seats together, and cash direction.

A cash-only sale filter shows posts with no want slots, which is the plain marketplace view for people who do not want to trade at all.

---

## 8. Application structure

```
src/
  app/
    (auth)/login/
    (auth)/signup/
    (auth)/verify/
    games/
    games/[id]/
    posts/new/
    posts/[id]/
    proposals/
    handoffs/[id]/
    profile/
  components/
  lib/
    supabase/server.ts
    supabase/client.ts
    matching/
    validation/
  types/
    database.ts        generated, do not edit
```

Server components read through the server side Supabase client. Mutations go through server actions with Zod validation at the top. Client components only where interactivity requires them.

The service role key must never reach the browser. It bypasses RLS entirely and would defeat the whole authorization model. It belongs only in server-only code paths and only where a trigger or policy genuinely cannot do the job.

---

## 9. AWS

### CDK stack

One stack, `GatorTradeStack`, in `infra/`.

- S3 bucket for post images, all public access blocked
- CloudFront distribution with origin access control
- Bucket policy allowing only that distribution
- Lifecycle rule expiring objects after 400 days
- Outputs for bucket name and distribution domain

Uploads use a presigned PUT URL generated server side after confirming the caller owns the post. The browser never holds AWS credentials.

### Hosting

Already live on Amplify at https://main.d1ylz90b9t7gnv.amplifyapp.com and rebuilding on every push to main. A custom domain through Route 53 is planned.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      server only, never NEXT_PUBLIC
AWS_REGION                     us-east-2
S3_BUCKET_NAME
CLOUDFRONT_DOMAIN
```

Set these in Amplify environment variables. Commit `.env.example` with empty values. Never commit real values.

---

## 10. Build order

Step 1 is done. Continue from step 2. Complete one step, verify it, commit, then move to the next. Do not run several steps together.

2. Supabase project. Migrations for all eleven tables, enums, constraints, and indexes. Signup trigger for profiles. Verification trigger for `is_verified`. Generate database types.
3. Auth. Signup with the ufl.edu constraint, email confirmation, login, logout, protected routes, a clear pending-verification state.
4. RLS policies and helper functions, then the multi user policy test file. Do not defer the tests.
5. Seed scripts. Games for the current season and the sections table with tier assignments. Without these nothing else is testable.
6. Post creation. Offer items, want slots, cash delta, with the same-game upgrade as the default flow and cross game as an expansion of the same form.
7. Browse and the seat upgrade finder from section 7.
8. Proposals. Create, accept, decline, withdraw, with the status transition trigger.
9. Handoff checklist and messaging on accepted proposals.
10. CDK stack, presigned uploads, images on posts.
11. Reports, empty states, loading states, and enough seed data that the live site looks real to someone opening it cold.

---

## 11. Conventions

- Conventional commit messages
- No secrets in the repo, ever
- Every schema change is a migration file in `supabase/migrations`, never a manual dashboard edit
- Money is always an integer count of cents, never a float
- Prefer server components, use `"use client"` only when an interaction requires it
- Cash direction is always expressed from the post author's perspective, everywhere in the codebase and the UI

---

## 12. Open questions for Francisco

Ask rather than assume.

1. Section tier assignments for Ben Hill Griffin Stadium. This needs his input, do not invent it.
2. Should posts expire on a timer as well as at kickoff, for example after fourteen days of no activity?
3. Should a user's completed trade count be shown publicly as a lightweight reputation signal?
