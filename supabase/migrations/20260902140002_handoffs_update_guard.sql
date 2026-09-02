-- Enforces the parts of the handoffs update policy that RLS can't express:
-- which columns each participant may set, and that a timestamp can only
-- move from null to a value, never change once set.

create or replace function public.enforce_handoff_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_proposer_id uuid;
  v_author_id uuid;
begin
  select p.proposer_id, po.author_id
    into v_proposer_id, v_author_id
    from proposals p
    join posts po on po.id = p.post_id
    where p.id = old.proposal_id;

  if old.author_marked_sent_at is not null
     and new.author_marked_sent_at is distinct from old.author_marked_sent_at then
    raise exception 'author_marked_sent_at is already set';
  end if;

  if old.proposer_marked_sent_at is not null
     and new.proposer_marked_sent_at is distinct from old.proposer_marked_sent_at then
    raise exception 'proposer_marked_sent_at is already set';
  end if;

  if old.author_confirmed_at is not null
     and new.author_confirmed_at is distinct from old.author_confirmed_at then
    raise exception 'author_confirmed_at is already set';
  end if;

  if old.proposer_confirmed_at is not null
     and new.proposer_confirmed_at is distinct from old.proposer_confirmed_at then
    raise exception 'proposer_confirmed_at is already set';
  end if;

  if old.cash_settled_at is not null
     and new.cash_settled_at is distinct from old.cash_settled_at then
    raise exception 'cash_settled_at is already set';
  end if;

  if v_uid = v_author_id then
    if new.proposer_marked_sent_at is distinct from old.proposer_marked_sent_at then
      raise exception 'cannot set the other participant''s marked-sent timestamp';
    end if;
    if new.proposer_confirmed_at is distinct from old.proposer_confirmed_at then
      raise exception 'cannot set the other participant''s confirmation';
    end if;
  elsif v_uid = v_proposer_id then
    if new.author_marked_sent_at is distinct from old.author_marked_sent_at then
      raise exception 'cannot set the other participant''s marked-sent timestamp';
    end if;
    if new.author_confirmed_at is distinct from old.author_confirmed_at then
      raise exception 'cannot set the other participant''s confirmation';
    end if;
  else
    raise exception 'not a participant in this handoff';
  end if;

  return new;
end;
$$;

create trigger handoffs_enforce_update
  before update on public.handoffs
  for each row execute function public.enforce_handoff_update();
