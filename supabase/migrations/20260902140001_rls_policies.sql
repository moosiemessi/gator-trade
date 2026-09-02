-- Enables RLS on all twelve tables and adds the policies described in
-- SPEC.md section 6. Helper functions come from the prior migration.

-- profiles ----------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column grants, not the policy above, are what stop a user from setting
-- is_verified on their own row: WITH CHECK only sees the new row, so it
-- has no way to compare against the value already stored.
revoke update on public.profiles from authenticated;
grant update (display_name, venmo_handle, avatar_key) on public.profiles to authenticated;

-- Public fields only. A view is how section 6 exposes
-- id/display_name/avatar_key/is_verified to any authenticated user while
-- keeping ufl_email and venmo_handle private: as an ordinary (non
-- security-invoker) view it runs with the owning role's privileges, so
-- it isn't limited by the profiles_select_own policy above.
create view public.profiles_public
  with (security_invoker = false)
  as
  select id, display_name, avatar_key, is_verified
  from public.profiles;

grant select on public.profiles_public to authenticated;

-- games ---------------------------------------------------------------

alter table public.games enable row level security;

create policy "games_select_authenticated"
  on public.games
  for select
  to authenticated
  using (true);

-- sections ------------------------------------------------------------

alter table public.sections enable row level security;

create policy "sections_select_authenticated"
  on public.sections
  for select
  to authenticated
  using (true);

-- posts -----------------------------------------------------------------

alter table public.posts enable row level security;

create policy "posts_select_open_or_own"
  on public.posts
  for select
  to authenticated
  using (
    (status = 'open' and is_verified_student())
    or author_id = (select auth.uid())
  );

create policy "posts_insert_verified_author"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and is_verified_student()
  );

create policy "posts_update_own"
  on public.posts
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "posts_delete_own"
  on public.posts
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- post_offer_items, post_want_items, post_images ------------------------
-- Same shape for all three: select follows the parent post's visibility,
-- write is owner-only.

alter table public.post_offer_items enable row level security;

create policy "post_offer_items_select_visible_post"
  on public.post_offer_items
  for select
  to authenticated
  using (
    owns_post(post_id)
    or (
      is_verified_student()
      and exists (
        select 1 from public.posts p
        where p.id = post_id and p.status = 'open'
      )
    )
  );

create policy "post_offer_items_write_owner"
  on public.post_offer_items
  for all
  to authenticated
  using (owns_post(post_id))
  with check (owns_post(post_id));

alter table public.post_want_items enable row level security;

create policy "post_want_items_select_visible_post"
  on public.post_want_items
  for select
  to authenticated
  using (
    owns_post(post_id)
    or (
      is_verified_student()
      and exists (
        select 1 from public.posts p
        where p.id = post_id and p.status = 'open'
      )
    )
  );

create policy "post_want_items_write_owner"
  on public.post_want_items
  for all
  to authenticated
  using (owns_post(post_id))
  with check (owns_post(post_id));

alter table public.post_images enable row level security;

create policy "post_images_select_visible_post"
  on public.post_images
  for select
  to authenticated
  using (
    owns_post(post_id)
    or (
      is_verified_student()
      and exists (
        select 1 from public.posts p
        where p.id = post_id and p.status = 'open'
      )
    )
  );

create policy "post_images_write_owner"
  on public.post_images
  for all
  to authenticated
  using (owns_post(post_id))
  with check (owns_post(post_id));

-- proposals ---------------------------------------------------------------

alter table public.proposals enable row level security;

create policy "proposals_select_participant"
  on public.proposals
  for select
  to authenticated
  using (can_view_proposal(id));

create policy "proposals_insert_verified_non_author"
  on public.proposals
  for insert
  to authenticated
  with check (
    proposer_id = (select auth.uid())
    and is_verified_student()
    and not owns_post(post_id)
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'open'
    )
  );

create policy "proposals_update_proposer_withdraw"
  on public.proposals
  for update
  to authenticated
  using (proposer_id = (select auth.uid()) and status = 'pending')
  with check (proposer_id = (select auth.uid()) and status = 'withdrawn');

create policy "proposals_update_author_decide"
  on public.proposals
  for update
  to authenticated
  using (owns_post(post_id) and status = 'pending')
  with check (owns_post(post_id) and status in ('accepted', 'declined'));

-- The two update policies above only ever move status; the column grant
-- keeps every other column immutable through the client regardless of
-- which policy's WITH CHECK a given request satisfies. Full state-machine
-- enforcement and handoff-row creation on accept are step 8's trigger.
revoke update on public.proposals from authenticated;
grant update (status) on public.proposals to authenticated;

-- proposal_items ----------------------------------------------------------

alter table public.proposal_items enable row level security;

create policy "proposal_items_select_visible_proposal"
  on public.proposal_items
  for select
  to authenticated
  using (can_view_proposal(proposal_id));

create policy "proposal_items_write_proposer"
  on public.proposal_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.proposals pr
      where pr.id = proposal_id and pr.proposer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.proposals pr
      where pr.id = proposal_id and pr.proposer_id = (select auth.uid())
    )
  );

-- handoffs ------------------------------------------------------------

alter table public.handoffs enable row level security;

create policy "handoffs_select_participant"
  on public.handoffs
  for select
  to authenticated
  using (can_view_proposal(proposal_id));

create policy "handoffs_update_participant"
  on public.handoffs
  for update
  to authenticated
  using (can_view_proposal(proposal_id))
  with check (can_view_proposal(proposal_id));

-- Which specific column a participant may touch, and the null-to-value-only
-- rule, need OLD vs NEW comparison that a declarative policy can't express;
-- see the enforce_handoff_update trigger in the next migration.
revoke update on public.handoffs from authenticated;
grant update (
  author_marked_sent_at,
  proposer_marked_sent_at,
  author_confirmed_at,
  proposer_confirmed_at,
  cash_settled_at
) on public.handoffs to authenticated;

-- messages ------------------------------------------------------------

alter table public.messages enable row level security;

create policy "messages_select_accepted_participant"
  on public.messages
  for select
  to authenticated
  using (
    can_view_proposal(proposal_id)
    and exists (
      select 1 from public.proposals pr
      where pr.id = proposal_id and pr.status = 'accepted'
    )
  );

create policy "messages_insert_accepted_participant"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and can_view_proposal(proposal_id)
    and exists (
      select 1 from public.proposals pr
      where pr.id = proposal_id and pr.status = 'accepted'
    )
  );

-- reports -----------------------------------------------------------------

alter table public.reports enable row level security;

create policy "reports_insert_reporter"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));
