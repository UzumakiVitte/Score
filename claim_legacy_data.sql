-- One-time migration for games created before private accounts.
-- Run this AFTER creating your username account and AFTER running schema.sql.
-- Replace YOUR_USERNAME with the username you created.
-- This only claims rows that currently have NULL owner_id.

DO $$
DECLARE
  target_user uuid;
BEGIN
  SELECT id INTO target_user
  FROM public.profiles
  WHERE username = lower('YOUR_USERNAME')
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Username not found. Create the account first.';
  END IF;

  UPDATE public.games
  SET owner_id = target_user
  WHERE owner_id IS NULL;

  UPDATE public.players
  SET owner_id = target_user
  WHERE owner_id IS NULL;

  UPDATE public.game_players gp
  SET owner_id = target_user
  WHERE gp.owner_id IS NULL;

  UPDATE public.score_changes sc
  SET owner_id = target_user
  WHERE sc.owner_id IS NULL;
END $$;

-- Verify the migration:
-- SELECT id, name, owner_id, status FROM public.games ORDER BY updated_at DESC;
