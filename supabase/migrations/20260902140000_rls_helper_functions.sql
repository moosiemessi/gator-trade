-- Security definer helpers for RLS policies. These must exist before any
-- policy that references them (step 4, SPEC.md section 6).

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

create or replace function public.can_view_proposal(pr_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from proposals
    where id = pr_id
      and (
        proposer_id = (select auth.uid())
        or owns_post(post_id)
      )
  );
$$;

create or replace function public.is_verified_student()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_verified from profiles where id = (select auth.uid())),
    false
  );
$$;
