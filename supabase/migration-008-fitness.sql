-- Sprint 6: Health integration (ported from recursing-borg) + Fitness context

-- Garmin daily health summary
CREATE TABLE IF NOT EXISTS garmin_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  steps INTEGER,
  steps_goal INTEGER,
  resting_hr INTEGER,
  stress_level INTEGER,
  hrv_status TEXT,
  hrv_7d_avg NUMERIC,
  sleep_score INTEGER,
  sleep_duration_seconds INTEGER,
  body_battery INTEGER,
  body_battery_charged INTEGER,
  body_battery_drained INTEGER,
  training_readiness INTEGER,
  training_status TEXT,
  vo2_max NUMERIC,
  calories_active INTEGER,
  calories_resting INTEGER,
  calories_total INTEGER,
  fitness_age INTEGER,
  endurance_score NUMERIC,
  training_load_acute NUMERIC,
  training_load_chronic NUMERIC,
  raw_json JSONB,
  last_synced TIMESTAMPTZ DEFAULT now()
);

-- Garmin activities (workouts, runs, walks, etc.)
CREATE TABLE IF NOT EXISTS garmin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT UNIQUE,
  activity_type TEXT,
  distance_meters NUMERIC,
  duration_seconds INTEGER,
  avg_pace TEXT,
  avg_hr INTEGER,
  calories INTEGER,
  started_at TIMESTAMPTZ,
  raw_json JSONB,
  last_synced TIMESTAMPTZ DEFAULT now()
);

-- Weight tracking (from Apple Health via iOS Shortcuts webhook)
CREATE TABLE IF NOT EXISTS weight_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  source TEXT DEFAULT 'apple-health',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, source)
);

-- Fitness program context (synced from Notion transformation program)
CREATE TABLE IF NOT EXISTS fitness_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_week INTEGER NOT NULL,
  current_phase TEXT NOT NULL,
  phase_end_week INTEGER,
  phase_tone TEXT,
  training_day_map JSONB NOT NULL,
  cardio_schedule JSONB NOT NULL,
  macro_training JSONB NOT NULL,
  macro_rest JSONB NOT NULL,
  eating_window JSONB,
  milestones JSONB,
  next_deload_week INTEGER,
  daily_habits JSONB,
  special_notes TEXT,
  active_subpages TEXT[],
  notion_page_id TEXT,
  notion_last_edited TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE garmin_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON garmin_daily FOR ALL USING (true);
CREATE POLICY "Allow all" ON garmin_activities FOR ALL USING (true);
CREATE POLICY "Allow all" ON weight_log FOR ALL USING (true);
CREATE POLICY "Allow all" ON fitness_context FOR ALL USING (true);
