-- Sprint 7 (v1.7) Migration
-- Health & Fitness OKR tracking, API usage v2, delta briefing support

-- 1. Health measurements (body fat, waist, BP, dead hang, etc.)
CREATE TABLE IF NOT EXISTS health_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  measurement_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, measurement_type, source)
);

ALTER TABLE health_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_measurements_all" ON health_measurements USING (true) WITH CHECK (true);

-- 2. Blood work (lab results with reference ranges)
CREATE TABLE IF NOT EXISTS blood_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_date DATE NOT NULL,
  marker_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  reference_low NUMERIC,
  reference_high NUMERIC,
  lab_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(test_date, marker_name)
);

ALTER TABLE blood_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blood_work_all" ON blood_work USING (true) WITH CHECK (true);

-- 3. OKR targets (Health & Fitness objectives and key results)
CREATE TABLE IF NOT EXISTS okr_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective TEXT NOT NULL,
  key_result TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  target_direction TEXT NOT NULL CHECK (target_direction IN ('lower_is_better', 'higher_is_better', 'range')),
  target_min NUMERIC,
  target_max NUMERIC,
  unit TEXT NOT NULL DEFAULT '',
  baseline_value NUMERIC,
  target_date DATE,
  source_table TEXT,
  source_column TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(objective, key_result)
);

ALTER TABLE okr_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "okr_targets_all" ON okr_targets USING (true) WITH CHECK (true);

-- Seed OKR targets
INSERT INTO okr_targets (objective, key_result, target_value, target_direction, target_min, target_max, unit, baseline_value, source_table, source_column) VALUES
  -- O1: Body Composition
  ('O1', 'weight', 87, 'lower_is_better', NULL, NULL, 'kg', 115.3, 'weight_log', 'weight_kg'),
  ('O1', 'body_fat', 15, 'lower_is_better', NULL, NULL, '%', 34.7, 'health_measurements', 'value'),
  ('O1', 'waist_cm', 88.5, 'lower_is_better', NULL, NULL, 'cm', NULL, 'health_measurements', 'value'),
  ('O1', 'lean_body_mass', 74, 'higher_is_better', NULL, NULL, 'kg', NULL, 'health_measurements', 'value'),
  -- O2: Cardiovascular
  ('O2', 'vo2_max', 44, 'higher_is_better', 44, 48.3, 'ml/kg/min', NULL, 'garmin_daily', 'vo2_max'),
  ('O2', 'run_10k_seconds', 3600, 'lower_is_better', NULL, NULL, 'seconds', NULL, 'health_measurements', 'value'),
  ('O2', 'fitness_age', 29, 'lower_is_better', NULL, NULL, 'years', NULL, 'garmin_daily', 'fitness_age'),
  ('O2', 'resting_hr', 50, 'lower_is_better', NULL, NULL, 'bpm', NULL, 'garmin_daily', 'resting_hr'),
  -- O3: Functional Durability
  ('O3', 'dead_hang_seconds', 60, 'higher_is_better', 60, 90, 'seconds', NULL, 'health_measurements', 'value'),
  ('O3', 'training_completion', 94, 'higher_is_better', NULL, NULL, '%', NULL, NULL, NULL),
  ('O3', 'daily_steps', 9000, 'higher_is_better', 9000, 12000, 'steps', NULL, 'garmin_daily', 'steps'),
  ('O3', 'overhead_squat_compensations', 0, 'lower_is_better', NULL, NULL, 'count', NULL, 'health_measurements', 'value'),
  -- O4: Metabolic & Hormonal
  ('O4', 'hba1c', 5.4, 'lower_is_better', NULL, NULL, '%', NULL, 'blood_work', 'value'),
  ('O4', 'fasting_glucose', 90, 'lower_is_better', NULL, NULL, 'mg/dL', NULL, 'blood_work', 'value'),
  ('O4', 'triglycerides', 150, 'lower_is_better', NULL, NULL, 'mg/dL', NULL, 'blood_work', 'value'),
  ('O4', 'hdl', 50, 'higher_is_better', NULL, NULL, 'mg/dL', NULL, 'blood_work', 'value'),
  ('O4', 'bp_systolic', 120, 'lower_is_better', NULL, NULL, 'mmHg', NULL, 'health_measurements', 'value'),
  ('O4', 'bp_diastolic', 80, 'lower_is_better', NULL, NULL, 'mmHg', NULL, 'health_measurements', 'value'),
  ('O4', 'testosterone', 450, 'higher_is_better', NULL, NULL, 'ng/dL', NULL, 'blood_work', 'value'),
  -- O5: Recovery Quality
  ('O5', 'sleep_hours', 7, 'higher_is_better', NULL, NULL, 'hours', NULL, 'garmin_daily', 'sleep_duration_seconds'),
  ('O5', 'hrv_decline_pct', 15, 'lower_is_better', NULL, NULL, '%', NULL, 'garmin_daily', 'hrv_7d_avg'),
  ('O5', 'body_battery_wake', 50, 'higher_is_better', NULL, NULL, 'level', NULL, 'garmin_daily', 'body_battery'),
  ('O5', 'stress_avg', 40, 'lower_is_better', NULL, NULL, '/100', NULL, 'garmin_daily', 'stress_level')
ON CONFLICT (objective, key_result) DO NOTHING;

-- 4. API usage v2 (per-service daily tracking)
CREATE TABLE IF NOT EXISTS api_usage_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  service TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  tokens_input INTEGER,
  tokens_output INTEGER,
  characters_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, service)
);

ALTER TABLE api_usage_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_usage_v2_all" ON api_usage_v2 USING (true) WITH CHECK (true);

-- 5. Delta briefing support
ALTER TABLE briefing_cache ADD COLUMN IF NOT EXISTS baseline_snapshot JSONB;

-- 6. Ensure sync_status has entries for all sync types
INSERT INTO sync_status (sync_type, last_synced_at, last_result)
VALUES
  ('garmin', '1970-01-01T00:00:00Z', 'pending'),
  ('fitness', '1970-01-01T00:00:00Z', 'pending'),
  ('garmin-tokens', '1970-01-01T00:00:00Z', 'pending')
ON CONFLICT (sync_type) DO NOTHING;
