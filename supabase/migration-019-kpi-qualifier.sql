-- Migration 019: KPI qualifier column + rename Daily Steps
-- Add qualifier column (idempotent — already exists in prod)
ALTER TABLE domain_kpis ADD COLUMN IF NOT EXISTS qualifier TEXT;

-- Rename misleading KPI name
UPDATE domain_kpis SET kpi_name = 'Avg Steps (7d)' WHERE kpi_name = 'Daily Steps';
