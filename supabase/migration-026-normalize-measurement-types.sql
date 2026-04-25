-- migration-026-normalize-measurement-types.sql
-- Normalize legacy measurement_type aliases to canonical names enforced by
-- src/app/api/health/measurements/route.ts VALID_TYPES.
--
-- Drift originated when the POST route's allowed types were renamed; the
-- /api/health-fitness/okr canonicalization shim has been masking it. After
-- this migration the two legacy aliases are gone and the shim entries for
-- them can be removed.

UPDATE health_measurements
SET measurement_type = 'dead_hang_seconds'
WHERE measurement_type = 'dead_hang';

UPDATE health_measurements
SET measurement_type = 'overhead_squat_compensations'
WHERE measurement_type = 'ohs_major_compensations';
