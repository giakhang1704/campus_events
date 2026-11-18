-- Forward-only, repeatable function update for an existing campus schema.
-- No tables, rows or credentials are changed.
BEGIN;
CREATE OR REPLACE FUNCTION campus.guard_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r campus.registrations%ROWTYPE; s campus.attendance_sessions%ROWTYPE;
 e campus.events%ROWTYPE; checked_at timestamptz;
BEGIN
 SELECT * INTO e FROM campus.events WHERE id=NEW.event_id FOR UPDATE;
 SELECT * INTO r FROM campus.registrations WHERE id=NEW.registration_id FOR UPDATE;
 IF NOT FOUND OR r.event_id <> NEW.event_id THEN
  RAISE EXCEPTION 'Attendance requires a registration for the same event';
 END IF;
 IF NEW.method='SYSTEM' THEN
  IF TG_OP <> 'UPDATE' OR pg_trigger_depth() < 2 OR r.status <> 'CANCELLED'
     OR NEW.recorded_by <> r.student_id THEN
   RAISE EXCEPTION 'SYSTEM reset is only allowed during registration reactivation';
  END IF;
 ELSIF r.status <> 'REGISTERED' THEN
  RAISE EXCEPTION 'Attendance requires REGISTERED for the same event';
 END IF;
 IF NEW.method='QR' THEN
  SELECT * INTO s FROM campus.attendance_sessions WHERE id=NEW.session_id FOR UPDATE;
  checked_at=clock_timestamp();
  IF NOT FOUND OR s.event_id <> NEW.event_id OR s.closed_at IS NOT NULL
     OR checked_at < s.opened_at OR checked_at >= s.expires_at
     OR e.status <> 'PUBLISHED' OR checked_at < e.starts_at-interval '30 minutes' OR checked_at >= e.ends_at THEN
   RAISE EXCEPTION 'QR session is not valid' USING ERRCODE='PQR01';
  END IF;
  IF NEW.recorded_by <> r.student_id THEN RAISE EXCEPTION 'QR actor must be the registered student'; END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
