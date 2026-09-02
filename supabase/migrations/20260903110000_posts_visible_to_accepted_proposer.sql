-- Bug found while building step 9: once a proposal is accepted, the step-8
-- trigger moves the parent post out of 'open' (to 'pending'), and
-- posts_select_open_or_own (step 4) only ever allowed "open" or "the
-- author" — so the proposer on their own accepted proposal lost all
-- visibility into the post, 404ing on both /posts/[id] and the new
-- /handoffs/[id] (which embeds posts through proposals to show the
-- author's name). Confirmed live before this fix, and confirmed fixed
-- after. Additive permissive policy, not a replacement — the author's
-- existing visibility is untouched.

create policy "posts_select_accepted_proposer"
  on public.posts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.proposals
      where proposals.post_id = posts.id
        and proposals.status = 'accepted'
        and proposals.proposer_id = (select auth.uid())
    )
  );
