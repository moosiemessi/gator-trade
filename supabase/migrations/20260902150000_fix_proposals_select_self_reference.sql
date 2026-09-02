-- proposals_select_participant called can_view_proposal(id), which
-- re-queries proposals from within a policy on proposals itself. That
-- self-reference can miss the row still being written when a client does
-- insert().select() (PostgREST's RETURNING re-checks the SELECT policy),
-- confirmed live: a bare insert succeeds, the same insert with .select()
-- fails with "new row violates row-level security policy for table
-- proposals". can_view_proposal is unaffected everywhere else it's used
-- (handoffs, messages, proposal_items) since those queries hit a
-- different, already-committed table. Fixed by inlining the same check
-- against the row's own columns instead of looking the row up again.

drop policy "proposals_select_participant" on public.proposals;

create policy "proposals_select_participant"
  on public.proposals
  for select
  to authenticated
  using (
    proposer_id = (select auth.uid())
    or owns_post(post_id)
  );
