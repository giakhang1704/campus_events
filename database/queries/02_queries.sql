-- PostgreSQL examples. $1/$2 are bound API parameters; not literal psql variables.
SET search_path TO campus, public;

-- UC-04: published events; pagination parameters are offset, page size.
PREPARE list_events(integer, integer) AS
 SELECT id,title,starts_at,ends_at,location,capacity
 FROM events WHERE status='PUBLISHED'
 ORDER BY starts_at,id OFFSET $1 LIMIT $2;

-- UC-10: user's registrations and current attendance.
PREPARE my_events(bigint) AS
 SELECT e.id,e.title,e.starts_at,r.status AS registration_status,
 CASE WHEN r.status <> 'REGISTERED' THEN 'NOT_APPLICABLE'
      WHEN a.result='PRESENT' THEN 'PRESENT'
      WHEN r.status='REGISTERED' AND now()>=e.ends_at THEN 'ABSENT'
      ELSE 'NOT_RECORDED' END AS attendance_status
 FROM registrations r JOIN events e ON e.id=r.event_id
 LEFT JOIN attendance a ON a.registration_id=r.id
 WHERE r.student_id=$1 ORDER BY e.starts_at DESC;

-- UC-15: displayed queue positions are calculated, never stored.
-- These are raw queue positions; promotion must still recheck eligibility.
PREPARE waitlist(bigint) AS
 SELECT r.id,u.full_name,p.student_code,r.waitlisted_at,
 row_number() OVER (ORDER BY r.waitlisted_at,r.id) AS queue_position
 FROM registrations r JOIN users u ON u.id=r.student_id
 JOIN student_profiles p ON p.user_id=r.student_id
 WHERE r.event_id=$1 AND r.status='WAITLISTED'
 ORDER BY r.waitlisted_at,r.id;

-- Eligibility for an event and a user. Availability/time checks are separate.
PREPARE eligible(bigint,bigint) AS
 SELECT u.status='ACTIVE' AND u.role='STUDENT'
 AND (NOT EXISTS(SELECT 1 FROM event_departments WHERE event_id=e.id)
      OR EXISTS(SELECT 1 FROM event_departments WHERE event_id=e.id AND department_id=p.department_id))
 AND (NOT EXISTS(SELECT 1 FROM event_study_years WHERE event_id=e.id)
      OR EXISTS(SELECT 1 FROM event_study_years WHERE event_id=e.id AND study_year=p.study_year)) AS is_eligible
 FROM events e CROSS JOIN users u JOIN student_profiles p ON p.user_id=u.id
 WHERE e.id=$1 AND u.id=$2;

-- UC-19: backend must check organizer_id before returning this report.
PREPARE report_for_organizer(bigint,bigint) AS
 SELECT v.* FROM event_report v JOIN events e ON e.id=v.event_id
 JOIN users u ON u.id=e.organizer_id
 WHERE e.id=$1 AND e.organizer_id=$2 AND u.role='ORGANIZER' AND u.status='ACTIVE';

-- Example calls after loading real data: EXECUTE my_events(123);
-- Exports: use one read-only REPEATABLE READ transaction for list + totals;
-- format CSV/XLSX in the backend. Never create a reports table for these totals.
