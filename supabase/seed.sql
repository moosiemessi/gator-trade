-- Reference data: student ticket sections and the 2026 home schedule.
-- Step 5 of SPEC.md's build order. Re-run only via `supabase db push
-- --include-seed` against a fresh project; these tables have no unique
-- constraint beyond primary key, so re-seeding an already-seeded project
-- would duplicate rows.

-- sections ------------------------------------------------------------
-- Only 26-45: the only student ticket sections, per Francisco. Tier
-- assignments and levels are his input, not derived. Even sections are
-- lower bowl, odd are upper deck; 36/38 flank the 50 yard line.

insert into public.sections (code, tier, level, is_student) values
  ('26', 3, 'Lower Bowl', true),
  ('27', 5, 'Upper Deck', true),
  ('28', 3, 'Lower Bowl', true),
  ('29', 5, 'Upper Deck', true),
  ('30', 3, 'Lower Bowl', true),
  ('31', 4, 'Upper Deck', true),
  ('32', 2, 'Lower Bowl', true),
  ('33', 4, 'Upper Deck', true),
  ('34', 2, 'Lower Bowl', true),
  ('35', 3, 'Upper Deck', true),
  ('36', 1, 'Lower Bowl', true),
  ('37', 3, 'Upper Deck', true),
  ('38', 1, 'Lower Bowl', true),
  ('39', 4, 'Upper Deck', true),
  ('40', 2, 'Lower Bowl', true),
  ('41', 4, 'Upper Deck', true),
  ('42', 2, 'Lower Bowl', true),
  ('43', 5, 'Upper Deck', true),
  ('44', 3, 'Lower Bowl', true),
  ('45', 5, 'Upper Deck', true);

-- games -----------------------------------------------------------------
-- 2026 Ben Hill Griffin Stadium home schedule (floridagators.com, ESPN,
-- confirmed with Francisco). Excludes the Oct 31 Georgia game, which is
-- Florida's designated "home" game in the series but is played at a
-- neutral site (Mercedes-Benz Stadium, Atlanta), not The Swamp.
-- Kickoff times for Ole Miss, South Carolina, Oklahoma, and Vanderbilt
-- were not yet announced as of seeding (SEC games are usually set 6-12
-- days out) — those four use a 12:00 PM ET placeholder; update them once
-- announced.

insert into public.games (season, opponent, kickoff_at, is_home, venue) values
  (2026, 'Florida Atlantic', '2026-09-05 19:45:00-04', true, 'Ben Hill Griffin Stadium'),
  (2026, 'Campbell',          '2026-09-12 17:30:00-04', true, 'Ben Hill Griffin Stadium'),
  (2026, 'Ole Miss',          '2026-09-26 12:00:00-04', true, 'Ben Hill Griffin Stadium'),
  (2026, 'South Carolina',    '2026-10-10 12:00:00-04', true, 'Ben Hill Griffin Stadium'),
  (2026, 'Oklahoma',          '2026-11-07 12:00:00-05', true, 'Ben Hill Griffin Stadium'),
  (2026, 'Vanderbilt',        '2026-11-21 12:00:00-05', true, 'Ben Hill Griffin Stadium');
