"""Organizer event lifecycle checks, run by i1_http.py on the isolated test database."""
import concurrent.futures
import uuid
from i1_event_reads import verify_published_event_reads


def verify_events(admin, organizer, student, client_type, sql, password):
    owner = organizer.call('GET', '/auth/me')
    departments = organizer.call('GET', '/catalog/departments')
    units = organizer.call('GET', '/catalog/organization-units')
    suffix = uuid.uuid4().hex[:10]
    content = dict(title='Lifecycle ' + suffix, description='Description', location='Room A',
                   organizationUnitId=units[0]['id'], registrationOpensAt='2030-11-10T08:00:00+07:00',
                   registrationClosesAt='2030-11-11T08:00:00+07:00', startsAt='2030-11-11T08:00:00+07:00',
                   endsAt='2030-11-11T10:00:00+07:00', capacity=20,
                   departmentIds=[d['id'] for d in departments], studyYears=[1, 2])
    outsider_email = 'event-owner-' + suffix + '@example.test'
    outsider_user = admin.call('POST', '/admin/users', dict(fullName='Other Organizer', email=outsider_email,
                              temporaryPassword=password, organizationUnitId=units[0]['id'], reason='Event tests'), expected=201)
    outsider = client_type()
    outsider.login(outsider_email)
    outsider.call('POST', '/events', content, expected=403)
    outsider.call('GET', '/events', expected=403)
    outsider.call('POST', '/auth/password', dict(currentPassword=password, newPassword=password + 'E'), expected=204)
    outsider.login(outsider_email, password + 'E')

    for client in (admin, student):
        client.call('POST', '/events', content, expected=403)
        client.call('GET', '/organizer/events', expected=403)
    organizer.call('GET', '/organizer/events?size=0', expected=400)
    organizer.call('POST', '/events', content, expected=403, csrf=False)
    for invalid in (
        dict(content, title=' '), dict(content, location=''), dict(content, description=''),
        dict(content, capacity=0), dict(content, capacity=1.5), dict(content, organizationUnitId=99999999),
        dict(content, departmentIds=[99999999]), dict(content, studyYears=[0]),
        dict(content, studyYears=[1, 1]), dict(content, departmentIds=[departments[0]['id']] * 2),
        dict(content, registrationClosesAt=content['registrationOpensAt']),
        dict(content, startsAt=content['registrationOpensAt']), dict(content, endsAt=content['startsAt']),
        dict(content, startsAt='2030-11-11T08:00:00')
    ):
        organizer.call('POST', '/events', invalid, expected=400)
    assert sql("SELECT count(*) FROM campus.events WHERE title='" + content['title'] + "';") == '0'

    event = organizer.call('POST', '/events', dict(content, organizerId=outsider_user['id'], status='PUBLISHED'), expected=201)
    assert event['status'] == 'DRAFT' and event['publishedAt'] is None and event['version'] == 1
    assert event['organizerId'] == owner['id']
    event_id = event['id']
    assert organizer.call('GET', f'/organizer/events/{event_id}') == event
    assert set(event['departmentIds']) == set(content['departmentIds']) and event['studyYears'] == [1, 2]
    assert all(e['organizerId'] == owner['id'] for e in organizer.call('GET', '/organizer/events?size=100')['items'])
    assert not any(e['id'] == event_id for e in outsider.call('GET', '/organizer/events?size=100')['items'])
    all_owned = organizer.call('GET', '/organizer/events?size=100')['items']
    page0 = organizer.call('GET', '/organizer/events?size=2&page=0')
    page1 = organizer.call('GET', '/organizer/events?size=2&page=1')
    assert [e['id'] for e in page0['items'] + page1['items']] == [e['id'] for e in all_owned]
    assert page0['hasNext'] and not page1['hasNext']
    outsider.call('GET', f'/organizer/events/{event_id}', expected=404)
    outsider.call('PATCH', f'/events/{event_id}', dict(content, version=1), expected=404)
    outsider.call('POST', f'/events/{event_id}/publish', dict(version=1), expected=404)
    student.call('GET', f'/organizer/events/{event_id}', expected=403)
    organizer.call('PATCH', f'/events/{event_id}', content, expected=400)
    organizer.call('PATCH', f'/events/{event_id}', dict(content, version=99), expected=409)
    organizer.call('PATCH', f'/events/{event_id}', dict(content, version=1, departmentIds=[99999999]), expected=400)
    assert organizer.call('GET', f'/organizer/events/{event_id}') == event

    edited = dict(content, title=content['title'] + ' edited', departmentIds=[], studyYears=[], version=1,
                  status='PUBLISHED', organizerId=outsider_user['id'])
    event = organizer.call('PATCH', f'/events/{event_id}', edited)
    assert event['version'] == 2 and event['status'] == 'DRAFT' and event['departmentIds'] == [] and event['studyYears'] == []
    assert event['organizerId'] == owner['id']
    organizer.call('POST', f'/events/{event_id}/publish', dict(version=1), expected=409)
    organizer.call('POST', f'/events/{event_id}/publish', dict(version=2), expected=403, csrf=False)
    event = organizer.call('POST', f'/events/{event_id}/publish', dict(version=2))
    assert event['status'] == 'PUBLISHED' and event['publishedAt'] and event['version'] == 3
    assert organizer.call('POST', f'/events/{event_id}/publish', dict(version=3)) == event
    assert sql(f'SELECT count(*) FROM campus.registrations WHERE event_id={event_id};') == '0'

    # Separate clients avoid sharing cookie state during concurrent requests.
    first, second = client_type(), client_type()
    first.login('organizer.i1@example.test')
    second.login('organizer.i1@example.test')
    def write(pair):
        client, number = pair
        return client.call('PATCH', f'/events/{event_id}', dict(edited, title=f'Concurrent {suffix} {number}', version=3), expected=(200, 409))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(write, [(first, 1), (second, 2)]))
    assert sum(result.get('version') == 4 for result in outcomes) == 1
    assert sum(result.get('code') == 'VERSION_CONFLICT' for result in outcomes) == 1
    saved = organizer.call('GET', f'/organizer/events/{event_id}')
    assert saved['version'] == 4 and saved['publishedAt'] == event['publishedAt']
    assert sql(f"SELECT version FROM campus.events WHERE id={event_id};") == '4'
    student_id = student.call('GET', '/auth/me')['id']
    sql(f"INSERT INTO campus.registrations(event_id,student_id,status,registered_at) VALUES({event_id},{student_id},'REGISTERED',clock_timestamp());")
    saved = organizer.call('PATCH', f'/events/{event_id}', dict(edited, version=4, location='Changed room'))
    assert saved['version'] == 5
    assert sql(f"SELECT count(*) FROM campus.email_outbox WHERE event_id={event_id} AND kind='EVENT_CHANGED';") == '1'
    blocked = organizer.call('PATCH', f'/events/{event_id}', dict(edited, version=5, departmentIds=[departments[0]['id']]), expected=409)
    assert blocked['code'] == 'REGISTERED_ELIGIBILITY_CHANGE'
    assert organizer.call('GET', f'/organizer/events/{event_id}') == saved
    verify_published_event_reads(admin, organizer, student, client_type, sql, content)
    print('PASS: organizer create/edit/publish, validation, ownership/RBAC/CSRF, forged owner, PostgreSQL persistence, atomic restrictions and concurrent version conflict.')
