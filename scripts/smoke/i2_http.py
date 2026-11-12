"""I2 acceptance checks. Only the isolated tmpfs database and local mail stub are used."""
import concurrent.futures
from datetime import datetime, timedelta, timezone
import json
import os
import time
import urllib.request
import uuid

os.environ['I1_API_BASE'] = 'http://127.0.0.1:18081/api'
os.environ['I1_TEST_PROJECT'] = 'campus-events-i2-test'
os.environ['I1_TEST_COMPOSE'] = 'compose.i2-test.yaml'
from i1_http import Client, PASSWORD, ready, sql


def eventually(check, seconds=25):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(.3)
    raise AssertionError('Timed out waiting for I2 worker assertion')


def stub():
    with urllib.request.urlopen('http://127.0.0.1:19090/', timeout=3) as response:
        return json.load(response)


def main():
    admin = ready()
    organizer = Client()
    organizer.login('organizer.i1@example.test')
    department = organizer.call('GET', '/catalog/departments')[0]['id']
    unit = organizer.call('GET', '/catalog/organization-units')[0]['id']
    suffix = uuid.uuid4().hex[:8]
    students = []
    for number in range(8):
        client = Client()
        user = client.call('POST', '/auth/register', dict(fullName=f'I2 Student {number}',
            email=f'i2-{suffix}-{number}@example.test', studentCode=f'I2{suffix}{number}',
            password=PASSWORD, departmentId=department, studyYear=2), expected=201)
        client.login(user['email'])
        students.append((client, user))
    s = [item[0] for item in students]
    uid = [item[1]['id'] for item in students]

    def create(title='I2', capacity=1, publish=True, **overrides):
        now = datetime.now(timezone(timedelta(hours=7)))
        body = dict(title=title+' '+suffix, description='I2 acceptance', location='Phòng A <BK>',
            organizationUnitId=unit, registrationOpensAt=(now-timedelta(days=1)).isoformat(),
            registrationClosesAt=(now+timedelta(hours=1)).isoformat(),
            startsAt=(now+timedelta(hours=2)).isoformat(), endsAt=(now+timedelta(hours=4)).isoformat(),
            capacity=capacity, departmentIds=[], studyYears=[])
        body.update(overrides)
        event = organizer.call('POST', '/events', body, expected=201)
        return organizer.call('POST', f"/events/{event['id']}/publish", dict(version=event['version'])) if publish else event

    def register(client, event, expected=201, **extra):
        return client.call('POST', f"/events/{event['id']}/registrations", extra, expected=expected)

    def state(client, event):
        return client.call('GET', f"/events/{event['id']}/registration")

    def cancel(client, event, reg, expected=200):
        return client.call('POST', f"/events/{event['id']}/registration/cancel", dict(version=reg['version']), expected=expected)

    def edit(event, **changes):
        fields = ('title','description','location','organizationUnitId','registrationOpensAt',
                  'registrationClosesAt','startsAt','endsAt','capacity','departmentIds','studyYears','version')
        body = {key:event[key] for key in fields}
        body.update(changes)
        return organizer.call('PATCH', f"/events/{event['id']}", body)

    def status(event, student):
        return sql(f"SELECT status FROM campus.registrations WHERE event_id={event['id']} AND student_id={uid[student]};")

    def count(event, table='registrations', where=''):
        return int(sql(f"SELECT count(*) FROM campus.{table} WHERE event_id={event['id']} {where};"))

    event = create('Concurrent last seat')
    Client().call('GET', f"/events/{event['id']}/registration", expected=401)
    for client in (admin, organizer):
        register(client, event, expected=403)
        client.call('GET', '/me/registrations', expected=403)
    s[0].call('POST', f"/events/{event['id']}/registrations", {}, expected=403, csrf=False)
    register(s[0], create('Draft', publish=False), expected=404)
    s[0].call('GET', '/me/registrations?size=0', expected=400)
    s[0].call('GET', '/me/registrations?status=ALL', expected=400)
    s[0].call('GET', '/events/0/registration', expected=400)
    s[0].call('GET', f"/organizer/events/{event['id']}/registrations", expected=403)
    # Each concurrent request has its own cookie jar and CSRF token.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        outcomes = list(pool.map(lambda client: register(client, event, studentId=uid[7]), s[:6]))
    assert sum(r['status']=='REGISTERED' for r in outcomes)==1
    assert sum(r['status']=='WAITLISTED' for r in outcomes)==5
    assert {r['studentId'] for r in outcomes}==set(uid[:6])
    assert count(event)==6 and count(event,'email_outbox')==1
    winner = next(i for i,r in enumerate(outcomes) if r['status']=='REGISTERED')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        copies = [Client() for _ in range(4)]
        for client in copies:
            client.login(students[winner][1]['email'])
        repeats = list(pool.map(lambda client: register(client,event,expected=200), copies))
    assert all(r['id']==outcomes[winner]['id'] for r in repeats)
    assert count(event)==6 and count(event,'email_outbox')==1
    assert sql(f"SELECT count(*) FROM campus.registration_history WHERE registration_id={outcomes[winner]['id']};")=='1'
    page = organizer.call('GET', f"/organizer/events/{event['id']}/registrations?size=2")
    assert page['registeredCount']==1 and page['waitingCount']==5 and page['hasNext']
    assert len(page['items'])==2 and all('email' in row for row in page['items'])
    mine = s[winner].call('GET','/me/registrations?size=1')
    assert all(r['studentId']==uid[winner] for r in mine['items'])
    outsider = Client()
    org = admin.call('POST','/admin/users',dict(fullName='I2 outsider',email=f'org-{suffix}@example.test',
        temporaryPassword=PASSWORD,organizationUnitId=unit,reason='ownership test'),expected=201)
    outsider.login(org['email'])
    outsider.call('POST','/auth/password',dict(currentPassword=PASSWORD,newPassword=PASSWORD+'Z'),expected=204)
    outsider.login(org['email'],PASSWORD+'Z')
    outsider.call('GET',f"/organizer/events/{event['id']}/registrations",expected=404)
    print('PASS I2: RBAC/CSRF, ownership, validation, last-seat concurrency, duplicate idempotence, own-data pagination.',flush=True)

    # Close registration while the event has not started. Cancellation must still promote FIFO.
    sql(f"UPDATE campus.events SET registration_closes_at=clock_timestamp()-interval '1 second' WHERE id={event['id']};")
    register(s[7],event,expected=409)
    head = int(sql(f"SELECT student_id FROM campus.registrations WHERE event_id={event['id']} AND status='WAITLISTED' ORDER BY waitlisted_at,id LIMIT 1;"))
    cancel(s[winner],event,dict(version=999),expected=409)
    canceled = cancel(s[winner],event,outcomes[winner])
    assert canceled['status']=='CANCELLED'
    assert cancel(s[winner],event,outcomes[winner])==canceled
    assert sql(f"SELECT status FROM campus.registrations WHERE event_id={event['id']} AND student_id={head};")=='REGISTERED'
    assert count(event,'email_outbox',"AND kind='WAITLIST_PROMOTED'")==1
    # A fresh registration cannot jump an existing eligible waiter.
    capacity = create('Increase',capacity=1)
    r0 = register(s[0],capacity)
    r1 = register(s[1],capacity)
    r2 = register(s[2],capacity)
    r3 = register(s[3],capacity)
    assert state(s[2],capacity)['registration']['queuePosition']==2
    expanded = edit(capacity,capacity=3)
    assert [status(capacity,i) for i in range(4)]==['REGISTERED','REGISTERED','REGISTERED','WAITLISTED']
    assert state(s[3],capacity)['registration']['queuePosition']==1
    organizer.call('PATCH',f"/events/{capacity['id']}",dict(expanded,capacity=2),expected=409)
    organizer.call('PATCH',f"/events/{capacity['id']}",dict(expanded,departmentIds=[department]),expected=409)
    changed = edit(expanded,location='Phòng B mới')
    assert count(capacity,'email_outbox',"AND kind='EVENT_CHANGED'")==4
    assert count(capacity,'email_outbox',"AND kind='WAITLIST_PROMOTED'")==2
    # Empty restrictions mean all; both department and study year must match otherwise.
    restricted = create('Eligibility',departmentIds=[department],studyYears=[3])
    assert not state(s[0],restricted)['eligible']
    assert register(s[0],restricted,expected=403)['code']=='NOT_ELIGIBLE'
    restricted = edit(restricted,studyYears=[2,3])
    register(s[0],restricted)
    # Skip an ineligible head without blocking a later eligible waiter; record one SKIP per version.
    skip = create('Skip',capacity=1,departmentIds=[department],studyYears=[2])
    a = register(s[0],skip)
    b = register(s[1],skip)
    register(s[2],skip)
    sql(f"UPDATE campus.student_profiles SET study_year=3 WHERE user_id={uid[1]};")
    cancel(s[0],skip,a)
    assert status(skip,1)=='WAITLISTED' and status(skip,2)=='REGISTERED'
    assert sql(f"SELECT count(*) FROM campus.registration_history WHERE registration_id={b['id']} AND action='SKIP';")=='1'
    skip = edit(skip,capacity=2)
    assert sql(f"SELECT count(*) FROM campus.registration_history WHERE registration_id={b['id']} AND action='SKIP';")=='2'
    edit(skip,description='Unchanged eligibility and event version increments')
    sql(f"UPDATE campus.student_profiles SET study_year=2 WHERE user_id={uid[1]};")
    register(s[4],skip)
    assert status(skip,1)=='REGISTERED' and status(skip,4)=='WAITLISTED'
    print('PASS I2: promotion after close, FIFO on cancellation/capacity increase, department AND year, eligible waiter priority.',flush=True)

    rejoin = create('Rejoin attendance')
    before = register(s[0],rejoin)
    register(s[1],rejoin)
    owner = organizer.call('GET','/auth/me')['id']
    sql(f"INSERT INTO campus.attendance(registration_id,event_id,result,method,recorded_by,reason) VALUES({before['id']},{rejoin['id']},'PRESENT','MANUAL',{owner},'I2 historical fixture');")
    cancel(s[0],rejoin,before)
    assert sql(f"SELECT result FROM campus.attendance WHERE registration_id={before['id']};")=='PRESENT'
    register(s[2],rejoin)
    after = register(s[0],rejoin)
    assert after['id']==before['id'] and after['status']=='WAITLISTED' and after['queuePosition']==2
    assert sql(f"SELECT result||':'||method FROM campus.attendance WHERE registration_id={before['id']};")=='NOT_RECORDED:SYSTEM'
    assert sql(f"SELECT count(*) FROM campus.attendance_history WHERE registration_id={before['id']} AND old_result='PRESENT' AND new_result='NOT_RECORDED';")=='1'
    assert sql(f"SELECT count(*) FROM campus.registration_history WHERE registration_id={before['id']} AND action='REREGISTER';")=='1'
    started = create('Started')
    reg = register(s[6],started)
    sql(f"UPDATE campus.events SET registration_opens_at=clock_timestamp()-interval '3 hours',registration_closes_at=clock_timestamp()-interval '2 hours',starts_at=clock_timestamp()-interval '1 hour' WHERE id={started['id']};")
    assert cancel(s[6],started,reg,expected=409)['code']=='EVENT_STARTED'
    assert not state(s[6],started)['registrationOpen']
    edit(started,capacity=3,registrationOpensAt=(datetime.now(timezone.utc)-timedelta(hours=3)).isoformat(),
         registrationClosesAt=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat(),
         startsAt=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat())
    print('PASS I2: version conflict, deadline, idempotent cancel, same-row rejoin, new priority, attendance reset and audit.',flush=True)

    # Inject an outbox failure inside the private test DB; all business writes must roll back.
    rollback = create('Atomic register')
    sql("CREATE FUNCTION campus.i2_fail_mail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'I2 fault injection'; END $$; CREATE TRIGGER i2_fail_mail BEFORE INSERT ON campus.email_outbox FOR EACH ROW EXECUTE FUNCTION campus.i2_fail_mail();")
    try:
        register(s[5],rollback,expected=503)
        assert count(rollback)==0
    finally:
        sql('DROP TRIGGER i2_fail_mail ON campus.email_outbox; DROP FUNCTION campus.i2_fail_mail();')
    first = register(s[5],rollback)
    second = register(s[6],rollback)
    sql("CREATE FUNCTION campus.i2_fail_mail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'I2 fault injection'; END $$; CREATE TRIGGER i2_fail_mail BEFORE INSERT ON campus.email_outbox FOR EACH ROW EXECUTE FUNCTION campus.i2_fail_mail();")
    try:
        cancel(s[5],rollback,first,expected=503)
        assert status(rollback,5)=='REGISTERED' and status(rollback,6)=='WAITLISTED'
        assert sql(f"SELECT count(*) FROM campus.registration_history WHERE registration_id={first['id']} AND action='CANCEL';")=='0'
    finally:
        sql('DROP TRIGGER i2_fail_mail ON campus.email_outbox; DROP FUNCTION campus.i2_fail_mail();')
    print('PASS I2: outbox fault rolls back registration, cancellation, promotion and history together.',flush=True)

    def mail_case(title, student):
        event = create(title)
        registration = register(s[student],event)
        return event, int(sql(f"SELECT id FROM campus.email_outbox WHERE registration_id={registration['id']};"))

    normal, mail = mail_case('Mail tiếng Việt',7)
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={mail};")=='SENT')
    accepted = stub()['accepted']
    payload = next(p for p in accepted.values() if normal['title'] in p['subject'])
    assert payload['to']==[{'email':students[7][1]['email']}]
    assert 'giờ Việt Nam' in payload['textContent'] and '\n' in payload['textContent']
    assert '&lt;BK&gt;' in payload['htmlContent']
    retry, retry_id = mail_case('[retry]',7)
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={retry_id};")=='FAILED')
    assert sql(f"SELECT attempts||':'||last_error FROM campus.email_outbox WHERE id={retry_id};")=='1:BREVO_HTTP_503'
    sql(f"UPDATE campus.email_outbox SET next_attempt_at=clock_timestamp() WHERE id={retry_id};")
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={retry_id};")=='SENT')
    assert sql(f"SELECT attempts FROM campus.email_outbox WHERE id={retry_id};")=='2'
    _, reject_id = mail_case('[reject]',7)
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={reject_id};")=='FAILED')
    assert sql(f"SELECT attempts||':'||last_error FROM campus.email_outbox WHERE id={reject_id};")=='1:BREVO_HTTP_400'
    assert sql(f"SELECT next_attempt_at='infinity'::timestamptz FROM campus.email_outbox WHERE id={reject_id};")=='t'
    uncertain, uncertain_id = mail_case('[uncertain]',7)
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={uncertain_id};")=='FAILED')
    sql(f"UPDATE campus.email_outbox SET next_attempt_at=clock_timestamp() WHERE id={uncertain_id};")
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={uncertain_id};")=='SENT')
    assert sql(f"SELECT payload->>'providerMessageId' FROM campus.email_outbox WHERE id={uncertain_id};")=='deduplicated'
    assert sum(uncertain['title'] in p['subject'] for p in stub()['accepted'].values())==1
    _, exhausted_id = mail_case('[exhaust]',7)
    for attempt in range(1,6):
        eventually(lambda: sql(f"SELECT status||':'||attempts FROM campus.email_outbox WHERE id={exhausted_id};")==f'FAILED:{attempt}')
        sql(f"UPDATE campus.email_outbox SET next_attempt_at=clock_timestamp() WHERE id={exhausted_id};")
    time.sleep(1)
    assert sql(f"SELECT status||':'||attempts FROM campus.email_outbox WHERE id={exhausted_id};")=='FAILED:5'
    stale_id = int(sql(f"WITH added AS (INSERT INTO campus.email_outbox(event_id,registration_id,recipient_user_id,recipient_email,kind,dedupe_key,payload) SELECT event_id,registration_id,recipient_user_id,recipient_email,kind,dedupe_key||':stale',jsonb_set(payload,'{{registrationVersion}}','0'::jsonb) FROM campus.email_outbox WHERE id={mail} RETURNING id) SELECT id FROM added;"))
    eventually(lambda: sql(f"SELECT last_error FROM campus.email_outbox WHERE id={stale_id};")=='STALE_REGISTRATION')
    eventually(lambda: all(any(kind in p.get('tags',[]) for p in stub()['accepted'].values()) for kind in ('REGISTRATION_CONFIRMED','WAITLIST_PROMOTED','EVENT_CHANGED')))
    # Expired leases recover; a row already at the retry limit does not stay PROCESSING forever.
    sql(f"UPDATE campus.email_outbox SET status='PROCESSING',sent_at=NULL,attempts=1,locked_until=clock_timestamp()-interval '1 second' WHERE id={mail};")
    eventually(lambda: sql(f"SELECT status FROM campus.email_outbox WHERE id={mail};")=='SENT')
    sql(f"UPDATE campus.email_outbox SET status='PROCESSING',attempts=5,locked_until=clock_timestamp()-interval '1 second' WHERE id={reject_id};")
    eventually(lambda: sql(f"SELECT last_error FROM campus.email_outbox WHERE id={reject_id};")=='LEASE_EXPIRED')
    print('PASS I2: fake Brevo HTTP, UTF-8/+07, HTML escaping, retry, permanent error, uncertain acceptance dedupe, expired leases.',flush=True)
    assert sql("SELECT count(*) FROM (SELECT event_id FROM campus.registrations r JOIN campus.events e ON e.id=r.event_id WHERE r.status='REGISTERED' GROUP BY event_id,e.capacity HAVING count(*)>e.capacity) q;")=='0'
    print('PASS: I2 backend acceptance completed; no real provider or recipient was contacted.',flush=True)


if __name__=='__main__':
    main()
