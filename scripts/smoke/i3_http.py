"""I3 backend acceptance: real HTTP/PostgreSQL, private tmpfs DB, no real mail."""
import concurrent.futures
import csv
from datetime import datetime, timedelta, timezone
import io
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid

os.environ['I1_API_BASE']='http://127.0.0.1:18082/api'
os.environ['I1_TEST_PROJECT']='campus-events-i3-test'
os.environ['I1_TEST_COMPOSE']='compose.i3-test.yaml'
from i1_http import BASE, COMPOSE, Client, PASSWORD, ready, sql


def raw(client,path,expected=200):
    request=urllib.request.Request(BASE+path)
    try:
        response=client.opener.open(request,timeout=20)
    except urllib.error.HTTPError as error:
        response=error
    content=response.read()
    assert response.code==expected, f'GET {path}: expected {expected}, got {response.code}: {content[:150]!r}'
    return content,response.headers


def main():
    admin=ready()
    organizer=Client();organizer.login('organizer.i1@example.test')
    department=organizer.call('GET','/catalog/departments')[0]['id']
    unit=organizer.call('GET','/catalog/organization-units')[0]['id']
    suffix=uuid.uuid4().hex[:8]
    clients=[]; users=[]
    for number in range(4):
        client=Client()
        user=client.call('POST','/auth/register',dict(fullName=f'I3 Student {number}',email=f'i3-{suffix}-{number}@example.test',
            studentCode=f'I3{suffix}{number}',password=PASSWORD,departmentId=department,studyYear=2),expected=201)
        client.login(user['email']);clients.append(client);users.append(user)

    def create(title='I3',capacity=2,publish=True,**overrides):
        now=datetime.now(timezone(timedelta(hours=7)))
        body=dict(title=title+' '+suffix,description='I3 test',location='Phòng I3',organizationUnitId=unit,
            registrationOpensAt=(now-timedelta(days=1)).isoformat(),registrationClosesAt=(now+timedelta(minutes=10)).isoformat(),
            startsAt=(now+timedelta(minutes=20)).isoformat(),endsAt=(now+timedelta(hours=2)).isoformat(),capacity=capacity,departmentIds=[],studyYears=[])
        body.update(overrides)
        e=organizer.call('POST','/events',body,expected=201)
        return organizer.call('POST',f"/events/{e['id']}/publish",dict(version=e['version'])) if publish else e

    def register(client,e):return client.call('POST',f"/events/{e['id']}/registrations",{},expected=201)
    def own(e,suffix=''):return f"/organizer/events/{e['id']}/attendance"+suffix
    def opening(e,client=organizer,expected=200):return client.call('POST',own(e,'/sessions'),dict(durationMinutes=30),expected=expected)
    def preview(client,e,session,expected=200):
        payload=json.loads(session['qrPayload'])
        return client.call('POST',f"/events/{e['id']}/attendance/preview",dict(sessionId=payload['sessionId'],token=payload['token']),expected=expected)
    def check(client,e,session,expected=200,**extra):
        payload=json.loads(session['qrPayload'])
        current=client.call('GET',f"/events/{e['id']}")
        me=client.call('GET','/auth/me')
        registration=client.call('GET',f"/events/{e['id']}/registration")['registration'] if me['role']=='STUDENT' else None
        recorded=client.call('GET',f"/events/{e['id']}/attendance")['attendance'] if me['role']=='STUDENT' else None
        body=dict(sessionId=payload['sessionId'],token=payload['token'],eventVersion=current['version'],registrationVersion=registration['version'] if registration else 1,attendanceVersion=recorded['version'] if recorded else 0)
        body.update(extra)
        return client.call('POST',f"/events/{e['id']}/attendance/check-in",body,expected=expected)
    def manual(client,e,r,result,version,registration_version=None,expected=200,reason='I3 manual reason'):
        return client.call('PUT',own(e,f"/{r['id']}"),dict(result=result,version=version,registrationVersion=r['version'] if registration_version is None else registration_version,reason=reason),expected=expected)
    def report(e,client=organizer,expected=200):return client.call('GET',f"/organizer/events/{e['id']}/report",expected=expected)
    def history(e,r):return organizer.call('GET',own(e,f"/{r['id']}/history"))['items']
    def cancel(client,e,r):return client.call('POST',f"/events/{e['id']}/registration/cancel",dict(version=r['version']))

    e=create(); regs=[register(c,e) for c in clients[:3]]
    assert [r['status'] for r in regs]==['REGISTERED','REGISTERED','WAITLISTED']
    org=admin.call('POST','/admin/users',dict(fullName='Other I3 Organizer',email=f'i3-org-{suffix}@example.test',temporaryPassword=PASSWORD,organizationUnitId=unit,reason='ownership'),expected=201)
    outsider=Client();outsider.login(org['email'])
    outsider.call('POST','/auth/password',dict(currentPassword=PASSWORD,newPassword=PASSWORD+'I3'),expected=204)
    outsider.login(org['email'],PASSWORD+'I3')
    Client().call('GET',own(e,'/session'),expected=401)
    for client in (admin,clients[0]):
        opening(e,client,403);report(e,client,403)
        manual(client,e,regs[0],'PRESENT',0,expected=403)
    opening(e,outsider,404);report(e,outsider,404)
    manual(outsider,e,regs[0],'PRESENT',0,expected=404)
    organizer.call('POST',own(e,'/sessions'),dict(durationMinutes=30),expected=403,csrf=False)
    organizer.call('POST',own(e,'/sessions'),dict(durationMinutes=0),expected=400)
    opening(create('draft',publish=False),expected=404)
    now=datetime.now(timezone.utc)
    opening(create('too early',startsAt=(now+timedelta(hours=1)).isoformat()),expected=409)
    assert organizer.call('GET',own(e,'/session')) is None
    session=opening(e);payload=json.loads(session['qrPayload'])
    assert payload['type']=='BKeventCheckIn' and payload['eventId']==e['id'] and session['active']
    assert opening(e)==session
    assert sql(f"SELECT count(*) FROM campus.attendance_sessions WHERE event_id={e['id']} AND closed_at IS NULL;")=='1'
    assert sql(f"SELECT length(token_hash)=64 AND token_ciphertext NOT LIKE '%{payload['token']}%' FROM campus.attendance_sessions WHERE id={session['id']};")=='t'
    svg,headers=raw(organizer,own(e,f"/sessions/{session['id']}/qr.svg"))
    assert b'<svg' in svg and b'<path' in svg and headers['Content-Type'].startswith('image/svg+xml')
    assert 'no-store' in headers['Cache-Control'] and payload['token'].encode() not in svg
    raw(clients[0],own(e,f"/sessions/{session['id']}/qr.svg"),403)
    check(clients[2],e,session,409);check(clients[3],e,session,404)
    clients[0].call('POST',f"/events/{e['id']}/attendance/check-in",dict(sessionId=session['id'],token='A'*43,eventVersion=e['version'],registrationVersion=regs[0]['version'],attendanceVersion=0),expected=409)
    clients[0].call('POST',f"/events/{e['id']}/attendance/check-in",dict(sessionId=session['id'],token='short'),expected=400)
    clients[0].call('POST',f"/events/{e['id']}/attendance/check-in",dict(sessionId=session['id'],token=payload['token']),expected=400)
    for client in (admin,organizer):preview(client,e,session,403)
    preview(clients[2],e,session,409);preview(clients[3],e,session,404)
    p=preview(clients[0],e,session)
    assert p['eventId']==e['id'] and p['registrationId']==regs[0]['id'] and p['registrationVersion']==regs[0]['version'] and not p['alreadyPresent']
    assert sql(f"SELECT count(*) FROM campus.attendance WHERE event_id={e['id']};")=='0'
    assert sql(f"SELECT count(*) FROM campus.attendance_history h JOIN campus.attendance a ON a.registration_id=h.registration_id WHERE a.event_id={e['id']};")=='0'
    for client in (admin,organizer):check(client,e,session,403)
    first=check(clients[0],e,session,studentId=users[1]['id'])
    assert first['registrationId']==regs[0]['id'] and first['recordedBy']==users[0]['id'] and first['method']=='QR'
    assert check(clients[0],e,session)==first and len(history(e,regs[0]))==1
    assert preview(clients[0],e,session)['alreadyPresent']
    assert history(e,regs[0])[0]['beforeData'] is None
    manual(organizer,e,regs[1],'PRESENT',0,reason='',expected=400)
    manual(organizer,e,regs[1],'ABSENT',0,expected=400)
    m=manual(organizer,e,regs[1],'NOT_RECORDED',0)
    assert m['version']==1 and m['method']=='MANUAL'
    manual(organizer,e,regs[1],'PRESENT',0,expected=409)
    manual(organizer,e,regs[2],'PRESENT',0,expected=409)
    print('PASS I3: QR window, ownership/RBAC/CSRF, real SVG, encrypted persisted token, own-student identity, idempotent check-in, manual validation/version/history.',flush=True)

    closed=organizer.call('POST',own(e,f"/sessions/{session['id']}/close"),{})
    assert not closed['active'] and closed['qrPayload'] is None and closed['closedAt']
    assert organizer.call('POST',own(e,f"/sessions/{session['id']}/close"),{})==closed
    check(clients[0],e,session,409)
    session2=opening(e);assert session2['id']!=session['id']
    assert json.loads(session2['qrPayload'])['token']!=payload['token']
    b=check(clients[1],e,session2);assert b['version']==2
    # Concurrent manual writes with the same version: exactly one update succeeds.
    other_owner=Client();other_owner.login('organizer.i1@example.test')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda client:manual(client,e,regs[1],'NOT_RECORDED',2,expected=(200,409)),[organizer,other_owner]))
    assert sum(r.get('code')=='VERSION_CONFLICT' for r in results)==1
    assert len(history(e,regs[1]))==3
    # Concurrent scans serialize to one attendance transition and one audit entry.
    reset=manual(organizer,e,regs[0],'NOT_RECORDED',first['version'])
    copies=[Client(),Client()]
    for client in copies:client.login(users[0]['email'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda c:check(c,e,session2),copies))
    assert results[0]==results[1] and results[0]['version']==reset['version']+1
    assert len(history(e,regs[0]))==3
    cancel(clients[0],e,regs[0])
    again=register(clients[0],e)
    assert again['id']==regs[0]['id'] and again['status']=='WAITLISTED'
    assert sql(f"SELECT result||':'||method FROM campus.attendance WHERE registration_id={again['id']};")=='NOT_RECORDED:SYSTEM'
    body={k:e[k] for k in ('title','description','location','organizationUnitId','registrationOpensAt','registrationClosesAt','startsAt','endsAt','capacity','departmentIds','studyYears','version')}
    e=organizer.call('PATCH',f"/events/{e['id']}",dict(body,capacity=3))
    a_state=clients[0].call('GET',f"/events/{e['id']}/registration")['registration']
    current_a=clients[0].call('GET',f"/events/{e['id']}/attendance")['attendance']
    manual(organizer,e,a_state,'PRESENT',current_a['version'],registration_version=regs[0]['version'],expected=409)
    check(clients[0],e,session2)
    assert any(h['reason']=='Reset on re-registration' for h in history(e,regs[0]))
    # Restart preserves the encrypted token: another instance with the same key can redisplay it.
    subprocess.run(COMPOSE+['restart','backend'],check=True,capture_output=True)
    ready()
    restored=organizer.call('GET',own(e,'/session'))
    assert restored['id']==session2['id'] and restored['expiresAt']==session2['expiresAt']
    assert json.loads(restored['qrPayload'])==json.loads(session2['qrPayload'])
    # Expiry closes the previous row before creating the next (unique open-session index).
    sql(f"UPDATE campus.attendance_sessions SET opened_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE id={session2['id']};")
    check(clients[0],e,session2,409)
    assert organizer.call('GET',own(e,'/session'))['qrPayload'] is None
    session3=opening(e);assert session3['id']!=session2['id']
    assert sql(f"SELECT count(*) FROM campus.attendance_sessions WHERE event_id={e['id']} AND closed_at IS NULL;")=='1'
    # QR lifetime is always clipped to ends_at.
    now=datetime.now(timezone.utc)
    short=create('clipped',registrationOpensAt=(now-timedelta(hours=2)).isoformat(),registrationClosesAt=(now-timedelta(hours=1)).isoformat(),startsAt=(now-timedelta(minutes=10)).isoformat(),endsAt=(now+timedelta(minutes=5)).isoformat())
    clipped=opening(short)
    assert datetime.fromisoformat(clipped['expiresAt'])==datetime.fromisoformat(short['endsAt'])
    print('PASS I3: close/reopen/replay, concurrent scans and edits, re-registration reset, stale admission conflict, restart persistence, expired-session replacement and ends_at clipping.',flush=True)

    # Fail the audit insert in this private DB: attendance must roll back with it.
    fault=create('audit rollback');fr=register(clients[3],fault);fs=opening(fault)
    sql("CREATE FUNCTION campus.i3_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'I3 fault injection'; END $$; CREATE TRIGGER i3_fail_audit BEFORE INSERT ON campus.attendance_history FOR EACH ROW EXECUTE FUNCTION campus.i3_fail_audit();")
    try:
        check(clients[3],fault,fs,503)
        assert sql(f"SELECT count(*) FROM campus.attendance WHERE registration_id={fr['id']};")=='0'
    finally:sql('DROP TRIGGER i3_fail_audit ON campus.attendance_history; DROP FUNCTION campus.i3_fail_audit();')
    check(clients[3],fault,fs)
    assert len(history(fault,fr))==1
    provisional=report(e)
    assert provisional['registeredCount']==3 and provisional['presentCount']==1 and provisional['notRecordedCount']==2
    assert provisional['attendanceRate']==33.3 and provisional['absentCount'] is None and not provisional['hasEnded']
    # Cancelled historical PRESENT must not contribute to the report denominator/numerator.
    manual(organizer,e,regs[1],'PRESENT',3)
    cancel(clients[1],e,regs[1])
    current=report(e)
    assert current['registeredCount']==2 and current['presentCount']==1 and current['cancelledCount']==1 and current['attendanceRate']==50.0
    sql(f"UPDATE campus.events SET registration_opens_at=clock_timestamp()-interval '3 hours',registration_closes_at=clock_timestamp()-interval '2 hours',starts_at=clock_timestamp()-interval '1 hour',ends_at=clock_timestamp()-interval '1 second' WHERE id={e['id']};")
    ended=report(e)
    assert ended['hasEnded'] and ended['absentCount']==1
    assert clients[2].call('GET',f"/events/{e['id']}/attendance")['attendanceState']=='ABSENT'
    check(clients[0],e,session3,409);opening(e,expected=409)
    c=clients[2].call('GET',f"/events/{e['id']}/registration")['registration']
    correction=manual(organizer,e,c,'PRESENT',0,reason='Bổ sung sau sự kiện từ biên bản dự phòng')
    assert correction['method']=='MANUAL' and correction['version']==1
    final=report(e);assert final['presentCount']==2 and final['absentCount']==0 and final['attendanceRate']==100.0
    page=organizer.call('GET',own(e,'?status=&size=2'))
    assert len(page['items'])==2 and page['hasNext']
    organizer.call('GET',own(e,'?status=ABSENT'),expected=400)
    organizer.call('GET',own(e,'?page=-1'),expected=400)
    empty=create('empty');zero=report(empty)
    assert zero['registeredCount']==0 and zero['attendanceRate'] is None
    # CSV: UTF-8 BOM, formulas, multiline quoting, summary and detail use one snapshot.
    hostile='  =HYPERLINK("https://example.test","Tên Việt")\nDòng, hai'
    sql(f"UPDATE campus.users SET full_name=$name${hostile}$name$ WHERE id={users[0]['id']};")
    data,headers=raw(organizer,f"/organizer/events/{e['id']}/report.csv")
    assert data.startswith(b'\xef\xbb\xbf') and 'attachment;' in headers['Content-Disposition'] and 'no-store' in headers['Cache-Control']
    rows=list(csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
    assert len(rows)==2 and all(r['registration_status']=='REGISTERED' for r in rows)
    assert any(r['full_name']=="'"+hostile for r in rows)
    assert all(r['attendance_state']=='PRESENT' and r['registered_count']=='2' and r['absent_count']=='0' for r in rows)
    raw(admin,f"/organizer/events/{e['id']}/report.csv",403)
    raw(outsider,f"/organizer/events/{e['id']}/report.csv",404)
    empty_csv,_=raw(organizer,f"/organizer/events/{empty['id']}/report.csv")
    empty_rows=list(csv.DictReader(io.StringIO(empty_csv.decode('utf-8-sig'))))
    assert len(empty_rows)==1 and empty_rows[0]['attendance_rate_percent']==''
    all_csv,_=raw(organizer,f"/organizer/events/{e['id']}/report.csv?status=")
    assert any(r['registration_status']=='CANCELLED' and r['attendance_state']=='NOT_APPLICABLE' for r in csv.DictReader(io.StringIO(all_csv.decode('utf-8-sig'))))
    print('PASS I3: audit rollback, provisional/final formulas, cancelled exclusion, null rate, derived absence, post-event correction, pagination and safe UTF-8 CSV.',flush=True)

    # A confirmation must apply to the exact event/admission that the student previewed.
    confirmation=create('confirmation versions')
    ar=register(clients[0],confirmation);br=register(clients[1],confirmation);cs=opening(confirmation)
    old=preview(clients[0],confirmation,cs)
    content={k:confirmation[k] for k in ('title','description','location','organizationUnitId','registrationOpensAt','registrationClosesAt','startsAt','endsAt','capacity','departmentIds','studyYears','version')}
    confirmation=organizer.call('PATCH',f"/events/{confirmation['id']}",dict(content,location='Changed after scan'))
    assert check(clients[0],confirmation,cs,409,eventVersion=old['eventVersion'])['code']=='CONFIRMATION_STALE'
    assert sql(f"SELECT count(*) FROM campus.attendance WHERE event_id={confirmation['id']};")=='0'
    check(clients[0],confirmation,cs)
    old_recorded=preview(clients[0],confirmation,cs)
    manual(organizer,confirmation,ar,'NOT_RECORDED',old_recorded['attendanceVersion'])
    assert check(clients[0],confirmation,cs,409,attendanceVersion=old_recorded['attendanceVersion'])['code']=='CONFIRMATION_STALE'
    check(clients[0],confirmation,cs)
    old=preview(clients[1],confirmation,cs)
    cancel(clients[1],confirmation,br);rejoined=register(clients[1],confirmation)
    assert rejoined['id']==br['id'] and rejoined['status']=='REGISTERED'
    assert check(clients[1],confirmation,cs,409,registrationVersion=old['registrationVersion'])['code']=='CONFIRMATION_STALE'
    check(clients[1],confirmation,cs)
    # Expiry between service validation and INSERT must be 409, and must roll back.
    race=create('expiry at write');rr=register(clients[3],race);rs=opening(race)
    sql("CREATE FUNCTION campus.i3_expire_at_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE campus.attendance_sessions SET opened_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE id=NEW.session_id; RETURN NEW; END $$; CREATE TRIGGER aaa_i3_expire BEFORE INSERT ON campus.attendance FOR EACH ROW EXECUTE FUNCTION campus.i3_expire_at_write();")
    try:
        assert check(clients[3],race,rs,409)['code']=='QR_SESSION_INVALID'
        assert sql(f"SELECT count(*) FROM campus.attendance WHERE registration_id={rr['id']};")=='0'
        assert organizer.call('GET',own(race,'/session'))['active']
    finally:sql('DROP TRIGGER aaa_i3_expire ON campus.attendance; DROP FUNCTION campus.i3_expire_at_write();')
    # The session may outlive a shortened event; enforce the current ends_at at write time.
    sql(f"UPDATE campus.events SET registration_opens_at=clock_timestamp()-interval '3 hours',registration_closes_at=clock_timestamp()-interval '2 hours',starts_at=clock_timestamp()-interval '1 hour',ends_at=clock_timestamp()+interval '5 seconds' WHERE id={race['id']};")
    sql("CREATE FUNCTION campus.i3_delay_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(6); RETURN NEW; END $$; CREATE TRIGGER aaa_i3_delay BEFORE INSERT ON campus.attendance FOR EACH ROW EXECUTE FUNCTION campus.i3_delay_write();")
    try:
        assert check(clients[3],race,rs,409)['code']=='QR_SESSION_INVALID'
        assert sql(f"SELECT count(*) FROM campus.attendance WHERE registration_id={rr['id']};")=='0'
    finally:sql('DROP TRIGGER aaa_i3_delay ON campus.attendance; DROP FUNCTION campus.i3_delay_write();')
    print('PASS I3 audit: read-only preview, stale event/admission confirmation, exact expiry/end write guard and 409 with rollback.',flush=True)

    # Fixed-size local performance fixture; this is not a concurrent production load test.
    bulk=create('2000-row export',capacity=11000)
    def add_bulk(start,end):
        sql(f"""WITH new_users AS (INSERT INTO campus.users(full_name,email,password_hash,role)
            SELECT 'Bulk Student '||n,'i3-bulk-{suffix}-'||n||'@example.test',(SELECT password_hash FROM campus.users WHERE id={users[0]['id']}),'STUDENT'
            FROM generate_series({start},{end}) n RETURNING id), profiles AS (
            INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year)
            SELECT id,'I3BULK'||id,{department},2 FROM new_users RETURNING user_id)
            INSERT INTO campus.registrations(event_id,student_id,status,registered_at)
            SELECT {bulk['id']},user_id,'REGISTERED',clock_timestamp() FROM profiles;""")
    add_bulk(1,2000)
    began=time.perf_counter();summary=report(bulk);report_time=time.perf_counter()-began
    began=time.perf_counter();bulk_csv,_=raw(organizer,f"/organizer/events/{bulk['id']}/report.csv");csv_time=time.perf_counter()-began
    assert summary['registeredCount']==2000 and len(list(csv.DictReader(io.StringIO(bulk_csv.decode('utf-8-sig')))))==2000
    assert report_time<5 and csv_time<10, f'Local target missed: report={report_time:.3f}s CSV={csv_time:.3f}s'
    add_bulk(2001,10001)
    raw(organizer,f"/organizer/events/{bulk['id']}/report.csv",413)
    print(f'PASS I3: local 2,000-row fixture report={report_time:.3f}s, CSV={csv_time:.3f}s; 10,001-row export bounded with 413.',flush=True)
    print('PASS: I3 backend acceptance completed on isolated PostgreSQL; no real email sent.',flush=True)


if __name__=='__main__':main()
