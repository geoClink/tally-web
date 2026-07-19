-- Seed realistic demo sessions for the current week (week of July 13–18, 2026).
-- Run this in the Supabase SQL editor.
-- Replace 'demo@tally.app' with your actual VITE_DEMO_EMAIL value.

DO $$
DECLARE
  demo_id uuid;
BEGIN
  SELECT id INTO demo_id FROM auth.users WHERE email = 'demo@tally.app';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found — check the email address at the top of this script';
  END IF;

  -- ── This week ──────────────────────────────────────────────────────────────

  -- Monday July 13
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'Acme Corp',       '2026-07-13 09:00:00+00', '2026-07-13 12:30:00+00', 'Sprint planning and feature work'),
    (demo_id, 'River North Group','2026-07-13 13:30:00+00', '2026-07-13 17:30:00+00', 'Q3 reporting dashboard');

  -- Tuesday July 14
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'Acme Corp',       '2026-07-14 08:30:00+00', '2026-07-14 12:00:00+00', 'API integration work'),
    (demo_id, 'Blue Sky Studio', '2026-07-14 13:00:00+00', '2026-07-14 16:30:00+00', 'Brand refresh review');

  -- Wednesday July 15
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'River North Group','2026-07-15 09:00:00+00', '2026-07-15 12:00:00+00', 'Stakeholder presentation prep'),
    (demo_id, 'Acme Corp',       '2026-07-15 13:00:00+00', '2026-07-15 16:00:00+00', 'Code review and QA');

  -- Thursday July 16
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'Blue Sky Studio', '2026-07-16 09:00:00+00', '2026-07-16 11:30:00+00', 'Asset exports and print specs'),
    (demo_id, 'Acme Corp',       '2026-07-16 12:30:00+00', '2026-07-16 15:00:00+00', 'Bug fixes from QA pass');

  -- Friday July 17
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'Acme Corp',       '2026-07-17 09:00:00+00', '2026-07-17 12:30:00+00', 'Performance improvements'),
    (demo_id, 'River North Group','2026-07-17 13:30:00+00', '2026-07-17 15:30:00+00', 'End-of-week sync');

  -- Saturday July 18 (today)
  INSERT INTO sessions (user_id, client, start_time, end_time, note) VALUES
    (demo_id, 'Blue Sky Studio', '2026-07-18 10:00:00+00', '2026-07-18 12:00:00+00', 'Final deliverables review');

END $$;
