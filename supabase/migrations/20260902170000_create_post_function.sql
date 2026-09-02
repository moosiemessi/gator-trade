-- Wraps post creation in one transaction so a bad offer/want item (e.g. an
-- invalid game_id slipping past client-side validation) can't leave behind
-- a post with zero offer items, which would violate the "one or more
-- items" invariant from SPEC.md section 4. security invoker (the
-- default, stated explicitly) so every insert still goes through the same
-- RLS policies and column grants a client-issued insert would — this
-- doesn't bypass authorization, it just makes the three inserts atomic.

create or replace function public.create_post(
  p_cash_delta_cents integer,
  p_notes text,
  p_offer_items jsonb,
  p_want_slots jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  insert into posts (author_id, cash_delta_cents, notes)
  values ((select auth.uid()), p_cash_delta_cents, p_notes)
  returning id into v_post_id;

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

  return v_post_id;
end;
$$;

grant execute on function public.create_post(integer, text, jsonb, jsonb) to authenticated;
