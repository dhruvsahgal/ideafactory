-- Add user preference columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS confirm_mode BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false;
