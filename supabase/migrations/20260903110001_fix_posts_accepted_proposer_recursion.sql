-- The previous migration's posts_select_accepted_proposer used a plain
-- inline subquery into proposals. Confirmed live: "infinite recursion
-- detected in policy for relation proposals" — Postgres's RLS recursion
-- check is structural, not logical, so even though owns_post (security
-- definer) would break the cycle at runtime on every path, a policy on
-- posts with a bare subquery into proposals (whose own policies query
-- posts) still gets flagged. Same reasoning section 6 already gives for
-- owns_post/can_view_proposal: cross-table RLS checks need a security
-- definer helper, never an inline subquery.

drop policy "posts_select_accepted_proposer" on public.posts;

create or replace function public.has_accepted_proposal(p_post_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from proposals
    where post_id = p_post_id
      and status = 'accepted'
      and proposer_id = (select auth.uid())
  );
$$;

create policy "posts_select_accepted_proposer"
  on public.posts
  for select
  to authenticated
  using (has_accepted_proposal(id));
