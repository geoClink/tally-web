-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add environment column if it doesn't exist
ALTER TABLE device_tokens
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';

-- 2. Drop old version so we can change the return type
DROP FUNCTION IF EXISTS get_targeted_device_tokens(text);

-- 3. Create the RPC used by the send-push-notification Edge Function
--    target = 'all'  → returns every token
--    target = <uuid> → returns tokens for that specific user_id
--    Returns platform ('ios' | 'android') so the function can route APNs vs FCM
CREATE OR REPLACE FUNCTION get_targeted_device_tokens(target text)
RETURNS TABLE(token text, environment text, platform text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF target = 'all' THEN
    RETURN QUERY
      SELECT dt.token, dt.environment, dt.platform
      FROM device_tokens dt;
  ELSE
    RETURN QUERY
      SELECT dt.token, dt.environment, dt.platform
      FROM device_tokens dt
      WHERE dt.user_id = target::uuid;
  END IF;
END;
$$;
