-- Step 10.5: post editing. SPEC.md sections 4, 5, 6, 11.
--
-- Three changes:
--   1. A generic updated_at trigger for posts.
--   2. Tightens posts_update_own (step 4) to posts_update_open_author: an
--      author may only update a post while it is 'open', and may only ever
--      move status to 'open' (unchanged) or 'withdrawn' through the client
--      — 'pending', 'completed', and 'expired' stay trigger/system-only.
--      This is also what makes the edit route's "author only, only while
--      open" rule a database guarantee rather than a UI convention.
--   3. update_post(), the edit counterpart to create_post (step 6):
--      wholesale-replaces offer items and want slots in one transaction,
--      same security-invoker shape so it still runs through the RLS
--      policies and column grants a direct client write would. Declining
--      pending proposals on a structural change happens in the same
--      transaction when the caller says so (p_decline_pending) — the
--      caller (the edit form) is the one that knows whether cash delta,
--      offer items, or want slots actually changed vs. a notes-only save.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.set_updated_at();

drop policy "posts_update_own" on public.posts;

create policy "posts_update_open_author"
  on public.posts
  for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and status = 'open'
  )
  with check (
    author_id = (select auth.uid())
    and status in ('open', 'withdrawn')
  );

create or replace function public.update_post(
  p_post_id uuid,
  p_cash_delta_cents integer,
  p_notes text default null,
  p_offer_items jsonb default '[]'::jsonb,
  p_want_slots jsonb default '[]'::jsonb,
  p_decline_pending boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  -- posts_update_open_author silently filters this to zero rows for a
  -- non-author or a non-open post, same as any other RLS-guarded update —
  -- the exception below turns that into a clear error instead of a
  -- quiet no-op.
  update posts
  set cash_delta_cents = p_cash_delta_cents,
      notes = p_notes
  where id = p_post_id
  returning id into v_post_id;

  if v_post_id is null then
    raise exception 'post % is not editable', p_post_id;
  end if;

  delete from post_offer_items where post_id = v_post_id;
  delete from post_want_items where post_id = v_post_id;

  insert into post_offer_items (
    post_id, game_id, ticket_type, section_code, row_label, seat_labels, quantity
  )
  select
    v_post_id,
    (item ->> 'game_id')::uuid,
    (item ->> 'ticket_type')::ticket_type,
    item ->> 'section_code',
    item ->> 'row_label',
    case
      when item -> 'seat_labels' is null or jsonb_typeof(item -> 'seat_labels') = 'null'
        then null
      else array(select jsonb_array_elements_text(item -> 'seat_labels'))
    end,
    (item ->> 'quantity')::integer
  from jsonb_array_elements(p_offer_items) as item;

  insert into post_want_items (
    post_id, acceptable_game_ids, min_tier, max_tier, quantity, require_together
  )
  select
    v_post_id,
    array(select jsonb_array_elements_text(slot -> 'acceptable_game_ids'))::uuid[],
    (slot ->> 'min_tier')::integer,
    (slot ->> 'max_tier')::integer,
    (slot ->> 'quantity')::integer,
    coalesce((slot ->> 'require_together')::boolean, false)
  from jsonb_array_elements(p_want_slots) as slot;

  if p_decline_pending then
    update proposals
    set status = 'declined'
    where post_id = v_post_id and status = 'pending';
  end if;

  return v_post_id;
end;
$$;

grant execute on function public.update_post(uuid, integer, text, jsonb, jsonb, boolean) to authenticated;
