-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add environment column if it doesn't exist
ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

-- 2. Create the RPC used by the send-push-notification Edge Function
--    target = 'all'  → returns every token
--    target = <uuid> → returns tokens for that specific user_id
CREATE OR REPLACE FUNCTION get_targeted_device_tokens(target text)
RETURNS TABLE(token text, environment text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF target = 'all' THEN
    RETURN QUERY
      SELECT dt.token, dt.environment
      FROM device_tokens dt;
  ELSE
    RETURN QUERY
      SELECT dt.token, dt.environment
      FROM device_tokens dt
      WHERE dt.user_id = target::uuid;
  END IF;
END;
$$;
