-- Migration 026: Bump Health & Fitness OKR targets to Oct 2026 endpoint
-- Raises five KRs to the new annual-cycle targets.
-- Resting HR / BP / fasting glucose unchanged (numeric thresholds already match new spec).

UPDATE okr_targets SET target_value = 50  WHERE key_result = 'vo2_max';
UPDATE okr_targets SET target_value = 26  WHERE key_result = 'fitness_age';
UPDATE okr_targets SET target_value = 90  WHERE key_result = 'dead_hang_seconds';
UPDATE okr_targets SET target_value = 5.0 WHERE key_result = 'hba1c';
UPDATE okr_targets SET target_value = 100 WHERE key_result = 'triglycerides';
