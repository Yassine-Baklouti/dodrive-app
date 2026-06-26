-- Add additional fields to contracts table for the rental contract form
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS additional_drivers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS departure_location TEXT,
  ADD COLUMN IF NOT EXISTS return_location TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS options TEXT;