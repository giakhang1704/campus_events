-- Read-only checks after creating the working schema.
SELECT version(), current_database(), current_user;
SHOW search_path;
SELECT table_name FROM information_schema.tables
WHERE table_schema='campus' AND table_type='BASE TABLE' ORDER BY table_name;
-- Expected: 15 base tables.
SELECT table_name FROM information_schema.views WHERE table_schema='campus';
-- Expected: event_report.
SELECT is_nullable, data_type FROM information_schema.columns
WHERE table_schema='campus' AND table_name='events' AND column_name='capacity';
-- Expected: NO / integer.
SELECT * FROM campus.event_report;
-- Empty is expected before inserting approved test data.
