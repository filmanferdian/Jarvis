-- Add LTHR (Lactate Threshold Heart Rate) column to garmin_daily.
-- Pulled daily from Garmin Connect `getUserSettings().userData.lactateThresholdHeartRate`.
-- Used by /api/cardio/hr-zones to drive the HR Zone 2 calculator on /cardio-analysis
-- (replaces the hardcoded 164 bpm). LTHR changes rarely but piggybacks on the daily
-- snapshot so we retain history and match the existing per-day pattern.

ALTER TABLE garmin_daily
  ADD COLUMN IF NOT EXISTS lthr INTEGER;
