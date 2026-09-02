-- Same reasoning as create_post (step 6): wraps proposal + proposal_items
-- inserts in one transaction so a bad item can't leave an orphaned
-- proposal. security invoker so it still goes through the same RLS
-- policies and column grants a direct client insert would. p_items may be
-- empty — a proposer offering nothing but cash against a want-slot-free
-- post is the normal case for buying a straight sale.

create or replace function public.create_proposal(
  p_post_id uuid,
  p_cash_delta_cents integer,
  p_message text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proposal_id uuid;
begin
  insert into proposals (post_id, proposer_id, cash_delta_cents, message)
  values (p_post_id, (select auth.uid()), p_cash_delta_cents, p_message)
  returning id into v_proposal_id;

  insert into proposal_items (
    proposal_id, game_id, ticket_type, section_code, row_label, seat_labels, quantity
  )
  select
    v_proposal_id,
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
  from jsonb_array_elements(p_items) as item;

  return v_proposal_id;
end;
$$;

grant execute on function public.create_proposal(uuid, integer, text, jsonb) to authenticated;
