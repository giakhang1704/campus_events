-- Fixtures are rolled back. Run on a development database after schema setup.
BEGIN;
SET LOCAL search_path=public;
DO $$
DECLARE dep bigint; unit_id bigint; student bigint; organizer bigint; ev bigint; reg bigint;
BEGIN
 INSERT INTO campus.departments(code,name) VALUES('TEST-'||txid_current(),'Test') RETURNING id INTO dep;
 INSERT INTO campus.organization_units(name) VALUES('Test '||txid_current()) RETURNING id INTO unit_id;
 INSERT INTO campus.users(full_name,email,password_hash,role) VALUES('Student','s-'||txid_current()||'@example.invalid','TEST-ONLY','STUDENT') RETURNING id INTO student;
 INSERT INTO campus.users(full_name,email,password_hash,role) VALUES('Organizer','o-'||txid_current()||'@example.invalid','TEST-ONLY','ORGANIZER') RETURNING id INTO organizer;
 INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year) VALUES(student,'TEST-'||txid_current(),dep,2);
 INSERT INTO campus.events(organizer_id,organization_unit_id,title,description,location,registration_opens_at,registration_closes_at,starts_at,ends_at,capacity)
 VALUES(organizer,unit_id,'Test','Test','Test',now()-interval '1 day',now()+interval '1 hour',now()+interval '2 hours',now()+interval '3 hours',1) RETURNING id INTO ev;
 BEGIN
  UPDATE campus.events SET capacity=0 WHERE id=ev;
  RAISE EXCEPTION 'FAIL: zero capacity';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE campus.events SET capacity=NULL WHERE id=ev;
  RAISE EXCEPTION 'FAIL: null capacity';
 EXCEPTION WHEN not_null_violation THEN NULL; END;
 INSERT INTO campus.registrations(event_id,student_id,status,registered_at) VALUES(ev,student,'REGISTERED',now()) RETURNING id INTO reg;
 INSERT INTO campus.attendance(registration_id,event_id,result,method,recorded_by,reason) VALUES(reg,ev,'PRESENT','MANUAL',organizer,'Test check-in');
 UPDATE campus.registrations SET status='CANCELLED',cancelled_at=now() WHERE id=reg;
 IF (SELECT present_count FROM campus.event_report WHERE event_id=ev)<>0 THEN RAISE EXCEPTION 'FAIL: cancelled counted'; END IF;
 BEGIN
  UPDATE campus.registrations SET status='REGISTERED' WHERE id=reg;
  RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Test rollback';
 EXCEPTION WHEN no_data_found THEN NULL; END;
 IF (SELECT result FROM campus.attendance WHERE registration_id=reg)<>'PRESENT' THEN RAISE EXCEPTION 'FAIL: reset rollback'; END IF;
 IF EXISTS(SELECT 1 FROM campus.attendance_history WHERE registration_id=reg) THEN RAISE EXCEPTION 'FAIL: audit rollback'; END IF;
 UPDATE campus.registrations SET status='WAITLISTED' WHERE id=reg;
 IF (SELECT result FROM campus.attendance WHERE registration_id=reg)<>'NOT_RECORDED' THEN RAISE EXCEPTION 'FAIL: stale attendance'; END IF;
 IF (SELECT count(*) FROM campus.registrations WHERE student_id=student AND event_id=ev)<>1 THEN RAISE EXCEPTION 'FAIL: duplicate registration'; END IF;
 IF NOT EXISTS(SELECT 1 FROM campus.attendance_history WHERE registration_id=reg AND old_result='PRESENT' AND before_data->>'result'='PRESENT') THEN RAISE EXCEPTION 'FAIL: audit missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM campus.registration_history WHERE registration_id=reg AND action='REREGISTER') THEN RAISE EXCEPTION 'FAIL: reregistration history'; END IF;
 BEGIN
  UPDATE campus.attendance SET result='PRESENT',method='MANUAL',recorded_by=organizer,reason='Waiting test' WHERE registration_id=reg;
  RAISE EXCEPTION USING ERRCODE='22000',MESSAGE='FAIL: waiting attendance';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 UPDATE campus.registrations SET status='REGISTERED',registered_at=now() WHERE id=reg;
 UPDATE campus.attendance SET result='PRESENT',method='MANUAL',recorded_by=organizer,reason='New attendance' WHERE registration_id=reg;
 UPDATE campus.events SET registration_closes_at=now()-interval '2 hours',starts_at=now()-interval '1 hour' WHERE id=ev;
 BEGIN
  UPDATE campus.registrations SET status='CANCELLED',cancelled_at=now() WHERE id=reg;
  RAISE EXCEPTION USING ERRCODE='22000',MESSAGE='FAIL: late cancellation';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 RAISE NOTICE 'PASS: capacity, cancel, reset, audit, rollback, same row, promotion and deadline';
END $$;
ROLLBACK;
