-- Campus Events: PostgreSQL 15+; run once in an empty database.
-- Logical/physical design based on DacTa_UseCase_HeThongSuKien(1).docx.
-- Working schema aligned with user decisions on 2026-11-03. See docs/decisions/SCOPE.md.
-- Reference originals remain unchanged. This is NOT an upgrade script for an existing DB.
-- This schema DOES NOT implement application authorization or complete workflows.
BEGIN;
CREATE SCHEMA campus;
SET search_path TO campus, public;

CREATE TABLE departments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code varchar(30) NOT NULL UNIQUE,
 name varchar(150) NOT NULL
);
CREATE TABLE organization_units (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(150) NOT NULL UNIQUE
);
CREATE TABLE users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 full_name varchar(150) NOT NULL CHECK (btrim(full_name) <> ''),
 email varchar(254) NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
 password_hash text NOT NULL,
 role varchar(15) NOT NULL CHECK (role IN ('STUDENT','ORGANIZER','ADMIN')),
 status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED')),
 organization_unit_id bigint REFERENCES organization_units(id),
 must_change_password boolean NOT NULL DEFAULT false,
 auth_version integer NOT NULL DEFAULT 1 CHECK (auth_version > 0),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (email)
);
CREATE INDEX users_role_status_idx ON users(role,status);
CREATE TABLE student_profiles (
 user_id bigint PRIMARY KEY REFERENCES users(id),
 student_code varchar(30) NOT NULL UNIQUE CHECK (student_code = upper(btrim(student_code)) AND student_code <> ''),
 department_id bigint NOT NULL REFERENCES departments(id),
 study_year smallint NOT NULL CHECK (study_year > 0)
);
-- A student profile is retained when the user's current role changes.
CREATE TABLE auth_sessions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users(id),
 token_hash text NOT NULL UNIQUE,
 auth_version integer NOT NULL CHECK (auth_version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (expires_at > created_at),
 CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organizer_id bigint NOT NULL REFERENCES users(id),
 organization_unit_id bigint NOT NULL REFERENCES organization_units(id),
 title varchar(250) NOT NULL CHECK (btrim(title) <> ''),
 description text NOT NULL CHECK (btrim(description) <> ''),
 location varchar(250) NOT NULL CHECK (btrim(location) <> ''),
 registration_opens_at timestamptz NOT NULL,
 registration_closes_at timestamptz NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 capacity integer NOT NULL CHECK (capacity > 0), -- Positive integer required.
 status varchar(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
 published_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (registration_opens_at < registration_closes_at AND registration_closes_at <= starts_at AND starts_at < ends_at),
 CHECK ((status = 'DRAFT' AND published_at IS NULL) OR (status = 'PUBLISHED' AND published_at IS NOT NULL))
);
CREATE INDEX events_listing_idx ON events(status,starts_at);
CREATE INDEX events_organizer_idx ON events(organizer_id);
CREATE TABLE event_departments (
 event_id bigint NOT NULL REFERENCES events(id),
 department_id bigint NOT NULL REFERENCES departments(id),
 PRIMARY KEY(event_id,department_id)
);
CREATE INDEX event_departments_department_idx ON event_departments(department_id);
CREATE TABLE event_study_years (
 event_id bigint NOT NULL REFERENCES events(id),
 study_year smallint NOT NULL CHECK (study_year > 0),
 PRIMARY KEY(event_id,study_year)
);
-- Zero restriction rows = all departments / all study years, independently.
-- Eligibility = allowed department AND allowed study year.

CREATE TABLE registrations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL REFERENCES events(id),
 student_id bigint NOT NULL REFERENCES student_profiles(user_id),
 status varchar(12) NOT NULL CHECK (status IN ('REGISTERED','WAITLISTED','CANCELLED')),
 waitlisted_at timestamptz,
 registered_at timestamptz,
 cancelled_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,student_id),
 UNIQUE(id,event_id),
 CHECK (
   (status='WAITLISTED' AND waitlisted_at IS NOT NULL AND registered_at IS NULL AND cancelled_at IS NULL)
   OR (status='REGISTERED' AND registered_at IS NOT NULL AND cancelled_at IS NULL)
   OR (status='CANCELLED' AND cancelled_at IS NOT NULL)
 )
);
CREATE INDEX registrations_queue_idx ON registrations(event_id,waitlisted_at,id) WHERE status='WAITLISTED';
CREATE INDEX registrations_count_idx ON registrations(event_id,status);
CREATE INDEX registrations_student_idx ON registrations(student_id,status);
CREATE TABLE registration_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 registration_id bigint NOT NULL REFERENCES registrations(id),
 actor_id bigint REFERENCES users(id), -- NULL for automated promotion/skip.
 action varchar(20) NOT NULL CHECK (action IN ('REGISTER','JOIN_WAITLIST','CANCEL','PROMOTE','SKIP','REREGISTER')),
 old_status varchar(12) CHECK (old_status IN ('REGISTERED','WAITLISTED','CANCELLED')),
 new_status varchar(12) NOT NULL CHECK (new_status IN ('REGISTERED','WAITLISTED','CANCELLED')),
 reason text,
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (action <> 'SKIP' OR (reason IS NOT NULL AND btrim(reason) <> ''))
);
CREATE INDEX registration_history_lookup_idx ON registration_history(registration_id,changed_at);

CREATE TABLE attendance_sessions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL REFERENCES events(id),
 opened_by bigint NOT NULL REFERENCES users(id),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 closed_at timestamptz,
 closed_by bigint REFERENCES users(id),
 token_hash text NOT NULL UNIQUE,
 token_ciphertext text NOT NULL, -- Encrypted QR token, to redisplay same session; key is outside DB.
 UNIQUE(id,event_id),
 CHECK (expires_at > opened_at),
 CHECK (closed_at IS NULL OR closed_at >= opened_at),
 CHECK (closed_at IS NOT NULL OR closed_by IS NULL)
);
-- Expired but not closed sessions must be closed transactionally before opening another.
CREATE UNIQUE INDEX attendance_one_open_idx ON attendance_sessions(event_id) WHERE closed_at IS NULL;
CREATE TABLE attendance (
 registration_id bigint PRIMARY KEY,
 event_id bigint NOT NULL,
 result varchar(15) NOT NULL CHECK (result IN ('PRESENT','NOT_RECORDED')),
 method varchar(10) NOT NULL CHECK (method IN ('QR','MANUAL','SYSTEM')),
 session_id bigint,
 recorded_by bigint NOT NULL REFERENCES users(id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason text,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 FOREIGN KEY(registration_id,event_id) REFERENCES registrations(id,event_id),
 FOREIGN KEY(session_id,event_id) REFERENCES attendance_sessions(id,event_id),
 CHECK ((method='QR' AND session_id IS NOT NULL AND result='PRESENT') OR
        (method='MANUAL' AND session_id IS NULL AND reason IS NOT NULL AND btrim(reason) <> '') OR
        (method='SYSTEM' AND result='NOT_RECORDED' AND session_id IS NULL AND reason IS NOT NULL AND btrim(reason) <> ''))
);
CREATE INDEX attendance_event_idx ON attendance(event_id);
CREATE INDEX attendance_session_idx ON attendance(session_id,event_id);
CREATE TABLE attendance_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 registration_id bigint NOT NULL REFERENCES attendance(registration_id),
 actor_id bigint NOT NULL REFERENCES users(id),
 old_result varchar(15) CHECK (old_result IN ('PRESENT','NOT_RECORDED')),
 new_result varchar(15) NOT NULL CHECK (new_result IN ('PRESENT','NOT_RECORDED')),
 before_data jsonb,
 after_data jsonb NOT NULL,
 reason text NOT NULL CHECK (btrim(reason) <> ''),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX attendance_history_lookup_idx ON attendance_history(registration_id,changed_at);

CREATE TABLE email_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL REFERENCES events(id),
 registration_id bigint,
 recipient_user_id bigint NOT NULL REFERENCES users(id),
 recipient_email varchar(254) NOT NULL,
 kind varchar(25) NOT NULL CHECK (kind IN ('REGISTRATION_CONFIRMED','WAITLIST_PROMOTED','EVENT_CHANGED')),
 dedupe_key varchar(200) NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(registration_id,event_id) REFERENCES registrations(id,event_id),
 CHECK ((status='SENT' AND sent_at IS NOT NULL) OR (status<>'SENT' AND sent_at IS NULL)),
 CHECK (status<>'PROCESSING' OR locked_until IS NOT NULL)
);
CREATE INDEX email_outbox_dispatch_idx ON email_outbox(status,next_attempt_at);
CREATE INDEX email_outbox_recipient_idx ON email_outbox(recipient_user_id);
CREATE INDEX email_outbox_event_idx ON email_outbox(event_id);
CREATE INDEX email_outbox_registration_idx ON email_outbox(registration_id,event_id);
CREATE TABLE account_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 target_user_id bigint NOT NULL REFERENCES users(id),
 actor_id bigint NOT NULL REFERENCES users(id),
 action varchar(20) NOT NULL CHECK (action IN ('CREATE_ORGANIZER','LOCK','UNLOCK','CHANGE_ROLE')),
 before_data jsonb,
 after_data jsonb NOT NULL,
 reason text NOT NULL CHECK (btrim(reason) <> ''),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX account_history_target_idx ON account_history(target_user_id,changed_at);

-- Cross-table attendance eligibility; event lock serializes cooperating workflows.
CREATE FUNCTION guard_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r campus.registrations%ROWTYPE; s campus.attendance_sessions%ROWTYPE;
BEGIN
 PERFORM 1 FROM campus.events WHERE id=NEW.event_id FOR UPDATE;
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
  IF NOT FOUND OR s.event_id <> NEW.event_id OR s.closed_at IS NOT NULL
     OR clock_timestamp() < s.opened_at OR clock_timestamp() >= s.expires_at THEN
   RAISE EXCEPTION 'QR session is not valid';
  END IF;
  IF NEW.recorded_by <> r.student_id THEN RAISE EXCEPTION 'QR actor must be the registered student'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_guard BEFORE INSERT OR UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION guard_attendance();

-- Preserve attendance as historical evidence when a registration is cancelled.
-- Counts use only current REGISTERED rows, so cancelled attendance is excluded.
CREATE FUNCTION guard_registration_with_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_start timestamptz; previous campus.attendance%ROWTYPE; reset_data jsonb;
BEGIN
 SELECT starts_at INTO event_start FROM campus.events WHERE id=OLD.event_id FOR UPDATE;
 IF NEW.event_id <> OLD.event_id OR NEW.student_id <> OLD.student_id THEN
  RAISE EXCEPTION 'Registration identity is immutable';
 END IF;
 IF NEW.status='CANCELLED' AND OLD.status <> 'CANCELLED' AND clock_timestamp() >= event_start THEN
  RAISE EXCEPTION 'Cancellation is allowed only before event starts';
 END IF;
 IF OLD.status='CANCELLED' AND NEW.status IN ('REGISTERED','WAITLISTED') THEN
  SELECT * INTO previous FROM campus.attendance WHERE registration_id=OLD.id FOR UPDATE;
  IF FOUND THEN
   UPDATE campus.attendance SET result='NOT_RECORDED', method='SYSTEM', session_id=NULL,
    recorded_by=OLD.student_id, recorded_at=clock_timestamp(),
    reason='Reset on re-registration', version=version+1 WHERE registration_id=OLD.id
    RETURNING to_jsonb(attendance.*) INTO reset_data;
   INSERT INTO campus.attendance_history(registration_id,actor_id,old_result,new_result,before_data,after_data,reason)
    VALUES(OLD.id,OLD.student_id,previous.result,'NOT_RECORDED',to_jsonb(previous),reset_data,'Reset on re-registration');
  END IF;
  -- New admission/queue timestamps; never reuse the old waitlist priority.
  NEW.cancelled_at=NULL;
  NEW.registered_at=CASE WHEN NEW.status='REGISTERED' THEN clock_timestamp() ELSE NULL END;
  NEW.waitlisted_at=CASE WHEN NEW.status='WAITLISTED' THEN clock_timestamp() ELSE NULL END;
  NEW.updated_at=clock_timestamp(); NEW.version=OLD.version+1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER registration_attendance_guard BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION guard_registration_with_attendance();

-- Reset history is written above. Service MUST NOT duplicate the REREGISTER entry below.
CREATE FUNCTION log_reregistration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='CANCELLED' AND NEW.status IN ('REGISTERED','WAITLISTED') THEN
  INSERT INTO campus.registration_history(registration_id,actor_id,action,old_status,new_status,reason)
   VALUES(NEW.id,NEW.student_id,'REREGISTER',OLD.status,NEW.status,'Reused registration; new admission attempt');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reregistration_history AFTER UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION log_reregistration();

-- Report is computed; no duplicated totals or mutable ABSENT attendance state.
CREATE VIEW event_report AS
WITH totals AS (
 SELECT e.id AS event_id,e.title,e.ends_at,
 count(r.id) FILTER (WHERE r.status='REGISTERED') AS registered_count,
 count(r.id) FILTER (WHERE r.status='WAITLISTED') AS waitlisted_count,
 count(r.id) FILTER (WHERE r.status='CANCELLED') AS cancelled_count,
 count(a.registration_id) FILTER (WHERE r.status='REGISTERED' AND a.result='PRESENT') AS present_count
 FROM events e LEFT JOIN registrations r ON r.event_id=e.id
 LEFT JOIN attendance a ON a.registration_id=r.id
 GROUP BY e.id,e.title,e.ends_at
)
SELECT *, now() AS generated_at, now() >= ends_at AS has_ended,
 CASE WHEN now() >= ends_at THEN registered_count-present_count ELSE NULL END AS absent_count,
 round(100.0*present_count/NULLIF(registered_count,0),1) AS attendance_rate
FROM totals;

COMMENT ON TABLE attendance IS 'Current attendance; absence is derived after event end. No row also means not recorded.';
COMMENT ON TABLE registrations IS 'One current row per event/student; reuse after cancel with new queue time; history is separate.';
COMMENT ON COLUMN events.capacity IS 'Positive integer required; increase and FIFO promotion require one service transaction under event lock.';
COMMENT ON COLUMN users.auth_version IS 'Increment on lock/role change; compare with session version on every request.';
COMMIT;
