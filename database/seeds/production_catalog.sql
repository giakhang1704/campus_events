-- Use scripts/seed-catalog.py for Unicode-safe input on Windows and Docker/native support.
-- The 12 department choices are synchronized separately by CatalogInitializer.
\set ON_ERROR_STOP on
\if :{?unit_name}
BEGIN;
CREATE TEMP TABLE catalog_input(name text NOT NULL CHECK(length(name) BETWEEN 1 AND 150 AND btrim(name) <> '')) ON COMMIT DROP;
INSERT INTO catalog_input(name) VALUES (btrim(:'unit_name'));
INSERT INTO campus.organization_units(name) SELECT name FROM catalog_input ON CONFLICT(name) DO NOTHING;
COMMIT;
\else
\echo 'Missing -v unit_name. No data was changed.'
\quit 1
\endif
