-- The status-transition trigger step 4 deferred to this step. RLS
-- (proposals_update_proposer_withdraw / proposals_update_author_decide)
-- already restricts who can move which status to which, but this is the
-- primary, explicit authority SPEC.md section 6 asks for — belt and
-- suspenders against RLS ever being bypassed or loosened later — plus the
-- side effects RLS can't do at all: creating the handoff row and moving
-- the parent post out of 'open' once a proposal is accepted.

create or replace function public.enforce_proposal_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'proposal % is no longer pending', old.id;
  end if;

  if new.status not in ('accepted', 'declined', 'withdrawn') then
    raise exception 'illegal proposal status %', new.status;
  end if;

  if new.status = 'accepted' then
    insert into handoffs (proposal_id) values (new.id);
    update posts set status = 'pending' where id = new.post_id;
  end if;

  return new;
end;
$$;

create trigger proposals_enforce_status_transition
  after update on public.proposals
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_proposal_status_transition();
