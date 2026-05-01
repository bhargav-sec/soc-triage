-- Phase 3.6 commit 1: add source_label to events
-- Stores which uploaded file an event came from.
-- Null for events ingested via Send Sample or API directly.
alter table events add column if not exists source_label text;
create index if not exists events_source_label_idx on events(source_label);
