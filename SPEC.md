# Gator Trade Rebuild Spec

Author: Francisco Rodriguez
Purpose: hand this file to Claude Code as the source of truth for the rebuild. Read it fully before writing code. Do not improvise the architecture.

---

## 1. What this is

A web platform where University of Florida students list and find football tickets. A previous version existed using React and Supabase. Most of that code was lost. This is a clean rebuild, not a restoration.

Two hard requirements drive every decision below.

- Written in TypeScript, not plain JavaScript
- Deployed live on AWS at a URL suitable for a resume

---

## 2. Scope boundaries

**In scope**
- Email and password auth restricted to ufl.edu addresses
- Users create, edit, and withdraw ticket listings
- Users browse and filter listings by game, price, and section
- Buyers send offers on a listing
- Sellers accept or decline offers
- A short message thread attached to an accepted offer
- Users report suspicious listings

**Out of scope, deliberately**
- Payment processing. No Stripe, no escrow, no wallet. Buyers and sellers settle privately through Venmo or Zelle. Handling money brings chargeback disputes and fraud liability that this project does not need.
- Actual ticket transfer. The platform does not touch the UF ticketing system. It is a place to find a counterparty.
- Native mobile apps. Responsive web only.
- Real time chat. Message threads poll or refetch on navigation. Websockets are not required.

Do not add features from the out of scope list even if they seem like natural extensions.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js, App Router |
| Language | TypeScript, strict mode on |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Authorization | Postgres row level security |
| Validation | Zod at every network boundary |
| Styling | Tailwind CSS |
| Image storage | S3 bucket fronted by CloudFront |
| Infrastructure as code | AWS CDK, TypeScript |
| Hosting | AWS Amplify Hosting |

### Why Supabase rather than RDS

Row level security is the most interesting engineering in this project and Supabase exposes it directly. Rebuilding auth on Cognito plus RDS costs weeks and produces a weaker story. The AWS requirement is satisfied by hosting, storage, CDN, and CDK.

### TypeScript rules

- `strict: true` in tsconfig, no exceptions
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- Database types are generated, never hand written. Run `supabase gen types typescript --linked > src/types/database.ts` and regenerate after every migration.
- Every API route and server action validates its input with a Zod schema before touching the database.

---

## 4. Data model

Seven tables. All in the `public` schema unless noted.

### profiles
Mirrors `auth.users`. Created by a trigger on user signup.

```
id              uuid primary key references auth.users(id) on delete cascade
display_name    text not null
ufl_email       text not null unique
venmo_handle    text
avatar_key      text
created_at      timestamptz not null default now()
```

### games
Reference data. Seeded by script. No user writes.

```
id              uuid primary key default gen_random_uuid()
season          integer not null
opponent        text not null
kickoff_at      timestamptz not null
is_home         boolean not null
venue           text
```

### listings

```
id              uuid primary key default gen_random_uuid()
seller_id       uuid not null references profiles(id) on delete cascade
game_id         uuid not null references games(id)
section         text not null
row_label       text
seat_count      integer not null check (seat_count between 1 and 8)
price_cents     integer not null check (price_cents >= 0)
status          listing_status not null default 'active'
notes           text
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

`listing_status` is an enum with values `active`, `pending`, `sold`, `withdrawn`.

`price_cents` is per seat, in cents. Never store money as a float.

### listing_images

```
id              uuid primary key default gen_random_uuid()
listing_id      uuid not null references listings(id) on delete cascade
s3_key          text not null
created_at      timestamptz not null default now()
```

### offers

```
id              uuid primary key default gen_random_uuid()
listing_id      uuid not null references listings(id) on delete cascade
buyer_id        uuid not null references profiles(id) on delete cascade
amount_cents    integer not null check (amount_cents >= 0)
status          offer_status not null default 'pending'
note            text
created_at      timestamptz not null default now()
```

`offer_status` is an enum with values `pending`, `accepted`, `declined`, `withdrawn`.

Add a partial unique index so a buyer cannot spam pending offers on one listing.

```sql
create unique index one_pending_offer_per_buyer
  on offers (listing_id, buyer_id)
  where status = 'pending';
```

### messages

```
id              uuid primary key default gen_random_uuid()
offer_id        uuid not null references offers(id) on delete cascade
sender_id       uuid not null references profiles(id) on delete cascade
body            text not null check (char_length(body) between 1 and 2000)
created_at      timestamptz not null default now()
```

### reports

```
id              uuid primary key default gen_random_uuid()
reporter_id     uuid not null references profiles(id) on delete cascade
listing_id      uuid not null references listings(id) on delete cascade
reason          text not null
created_at      timestamptz not null default now()
```

---

## 5. Row level security

Enable RLS on all seven tables. A table with RLS enabled and no policy denies everything, which is the correct default.

### Helper functions

Policies that need to check ownership across a join will recurse if written naively. Define security definer helpers first.

```sql
create or replace function public.owns_listing(l_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from listings
    where id = l_id and seller_id = (select auth.uid())
  );
$$;
```

Write a matching `can_view_offer(o_id uuid)` that returns true when the caller is either the buyer on the offer or the seller on the parent listing.

### Policy intent

**profiles**
- Any authenticated user may read `id`, `display_name`, and `avatar_key`. Expose this through a view rather than opening the whole table, since `ufl_email` and `venmo_handle` should not be broadly readable.
- A user may update only their own row.
- No client side insert. The signup trigger creates the row.

**games**
- Any authenticated user may select. No insert, update, or delete policy at all.

**listings**
- Select is allowed when `status = 'active'` or when the caller is the seller. A seller must be able to see their own withdrawn and sold listings.
- Insert is allowed only when `seller_id = (select auth.uid())`.
- Update and delete only by the seller.

**listing_images**
- Select when the parent listing is visible to the caller.
- Insert, update, delete only when `owns_listing(listing_id)`.

**offers**
- Select when the caller is the buyer or owns the parent listing.
- Insert when `buyer_id = (select auth.uid())`, the parent listing is active, and the buyer is not the seller. Blocking self offers in the policy matters, since client side checks are not authorization.
- Update by the buyer to withdraw, or by the listing owner to accept or decline. Consider enforcing legal status transitions in a trigger rather than the policy.

**messages**
- Select and insert only when `can_view_offer(offer_id)` and the offer status is `accepted`.
- No update or delete. Messages are immutable.

**reports**
- Insert when `reporter_id = (select auth.uid())`.
- No select policy for regular users. Reports are write only from the client side.

### Two details worth getting right

Wrap `auth.uid()` as `(select auth.uid())` inside policies. Postgres then caches it per statement instead of evaluating it per row, which is a large difference on a table scan.

Add indexes matching every column a policy filters on, specifically `listings(seller_id)`, `listings(status)`, `offers(buyer_id)`, and `offers(listing_id)`. An unindexed policy predicate turns every query into a sequential scan.

### Proving it works

Write a test file that creates two users through the Supabase client and asserts that user B cannot select, update, or delete user A's withdrawn listing, and cannot read offers on a listing they do not own. This test file is the artifact worth talking about in an interview. Do not skip it.

---

## 6. Application structure

```
src/
  app/
    (auth)/login/
    (auth)/signup/
    listings/
    listings/[id]/
    listings/new/
    offers/
    profile/
    api/
  components/
  lib/
    supabase/server.ts
    supabase/client.ts
    validation/
  types/
    database.ts        generated, do not edit
```

Server components read data directly through the server side Supabase client. Mutations go through server actions with Zod validation at the top of each one. Client components are used only where interactivity requires them.

Never use the Supabase service role key in anything that reaches the browser. It bypasses RLS entirely and would undo the entire authorization model.

---

## 7. AWS and deployment

### CDK stack

One stack, `GatorTradeStack`, in `infra/`.

- S3 bucket for listing images, all public access blocked
- CloudFront distribution with an origin access control pointing at the bucket
- Bucket policy allowing only that distribution to read
- Lifecycle rule expiring images after 400 days
- Stack outputs for the bucket name and distribution domain

Uploads go through a presigned PUT URL generated server side after checking that the caller owns the listing. The browser never receives long lived AWS credentials.

### Hosting

Connect the GitHub repo to Amplify Hosting through the console. Amplify builds on push to `main` and gives a live URL immediately. Buy a domain in Route 53, roughly twelve dollars a year, and point it at the Amplify app. A custom domain reads better on a resume than a generated subdomain.

Defining Amplify itself in CDK is possible but adds friction to the GitHub connection. Console for hosting, CDK for storage and CDN, is the honest split.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      server only, never prefixed NEXT_PUBLIC
AWS_REGION
S3_BUCKET_NAME
CLOUDFRONT_DOMAIN
```

Set these in Amplify environment variables. Commit a `.env.example` with empty values and never commit real ones.

---

## 8. Build order

Ship something live early, then improve it. Do not build the whole app locally and deploy at the end.

1. Scaffold Next.js with TypeScript and Tailwind. Push to GitHub. Connect Amplify. Confirm a live URL before writing features.
2. Supabase project, migrations for all seven tables, enums, indexes, and the signup trigger. Generate database types.
3. Auth flow with the ufl.edu restriction. Signup, login, logout, protected routes.
4. RLS policies plus the helper functions. Then the multi user policy test file. Do not defer this.
5. Listings. Create, browse, filter, detail page, edit, withdraw.
6. CDK stack deployed. Presigned upload flow. Images on listing pages.
7. Offers and the accepted offer message thread.
8. Reports, empty states, loading states, and a seed script with realistic sample data so the live site is not empty when someone opens it.

---

## 9. Conventions

- Conventional commit messages
- No secrets in the repo, ever
- Every migration is a file in `supabase/migrations`, never a change made by hand in the dashboard
- Prefer server components. Reach for `"use client"` only when an interaction requires it.
- Money is always an integer count of cents

---

## 10. Open questions for Francisco

Ask before assuming.

1. Should sellers be able to run an auction with a deadline, or is the offer model enough?
2. Should there be an admin view for reviewing reports, or is reading the table in the Supabase dashboard acceptable?
3. Is student verification beyond a ufl.edu email address wanted, for example a manual verified badge?

---

## 11. Note on the previous version

Auth, REST APIs, dynamic listings, and RLS policies existed in the lost version. That work is the reason the design above assumes familiarity with the RLS model. Do not treat it as available code. Nothing is being ported. Everything here is written fresh.
