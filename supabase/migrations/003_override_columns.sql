-- Phase 3.5 commit 3: override + recommended_actions columns

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ai_severity_original text,
  ADD COLUMN IF NOT EXISTS ai_mitre_original text,
  ADD COLUMN IF NOT EXISTS recommended_actions text[],
  ADD COLUMN IF NOT EXISTS last_scored_at timestamptz;

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS ai_severity_original text,
  ADD COLUMN IF NOT EXISTS ai_mitre_original text,
  ADD COLUMN IF NOT EXISTS recommended_actions text[],
  ADD COLUMN IF NOT EXISTS last_scored_at timestamptz;