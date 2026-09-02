-- Creates a profiles row for every new auth user. ufl_email inherits the
-- domain check constraint on profiles, so a non-ufl.edu signup is rejected
-- at the database level even before step 3 adds application-level validation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, ufl_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Flips is_verified once Supabase Auth confirms the email address, per SPEC.md section 5.
create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and old.email_confirmed_at is null
     and new.email ilike '%@ufl.edu' then
    update public.profiles
    set is_verified = true
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute function public.handle_email_confirmed();
