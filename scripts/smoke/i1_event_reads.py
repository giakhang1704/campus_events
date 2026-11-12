"""Published-event discovery API checks on the isolated I1 PostgreSQL database."""
from datetime import datetime, timedelta
from urllib.parse import quote
import uuid


def verify_published_event_reads(admin, organizer, student, client_type, sql, template):
    suffix = uuid.uuid4().hex[:10]
    marker = 'Discovery-' + suffix
    start = datetime.fromisoformat('2031-02-05T08:00:00+07:00')

    def create(title, day, publish=True, restricted=False):
        begins = start + timedelta(days=day)
        payload = dict(template, title=title, description='Discovery detail ' + suffix,
                       registrationOpensAt=(begins - timedelta(days=2)).isoformat(),
                       registrationClosesAt=(begins - timedelta(days=1)).isoformat(),
                       startsAt=begins.isoformat(), endsAt=(begins + timedelta(hours=2)).isoformat(),
                       departmentIds=[template['departmentIds'][-1]] if restricted else [],
                       studyYears=[4, 5] if restricted else [])
        event = organizer.call('POST', '/events', payload, expected=201)
        if publish:
            event = organizer.call('POST', f"/events/{event['id']}/publish", dict(version=event['version']))
        return event, payload

    # Creation order differs from start order; equal start times use the id tie-breaker.
    last, _ = create(marker + ' Python', 1)
    first, first_payload = create(marker + ' Bách khoa %_!' + suffix, 0, restricted=True)
    middle, _ = create(marker + ' Java abc!' + suffix, 0)
    draft, _ = create(marker + ' hidden draft', 0, publish=False)
    expected_ids = [first['id'], middle['id'], last['id']]
    ids = expected_ids + [draft['id']]
    snapshot_query = 'SELECT jsonb_agg(to_jsonb(e) ORDER BY id)::text FROM campus.events e WHERE id IN (' + ','.join(map(str, ids)) + ');'
    before = sql(snapshot_query)
    registrations_before = sql('SELECT count(*) FROM campus.registrations;')

    def listing(client, query=marker, page=0, size=10, extra=''):
        return client.call('GET', '/events?q=' + quote(query, safe='') + f'&page={page}&size={size}' + extra)

    anonymous = client_type()
    anonymous.call('GET', '/events', expected=401)
    anonymous.call('GET', f"/events/{first['id']}", expected=401)
    anonymous.call('GET', f"/events/{draft['id']}", expected=401)
    for reader in (student, organizer, admin):
        result = listing(reader)
        assert [event['id'] for event in result['items']] == expected_ids
        assert not result['hasNext'] and result['page'] == 0 and result['size'] == 10
        assert all(event['status'] == 'PUBLISHED' for event in result['items'])
        assert reader.call('GET', f"/events/{first['id']}") == first
        hidden = reader.call('GET', f"/events/{draft['id']}", expected=404)
        missing = reader.call('GET', '/events/9223372036854775807', expected=404)
        assert hidden == missing and hidden['code'] == 'EVENT_NOT_FOUND'
    assert organizer.call('GET', f"/organizer/events/{draft['id']}") == draft

    page0 = listing(student, page=0, size=2)
    page1 = listing(student, page=1, size=2)
    assert [event['id'] for event in page0['items'] + page1['items']] == expected_ids
    assert page0['hasNext'] and not page1['hasNext']
    empty = listing(student, page=2, size=2)
    assert empty == dict(items=[], page=2, size=2, hasNext=False)
    assert listing(student, page=100000, size=100)['items'] == []
    assert listing(student, query='No match ' + suffix)['items'] == []
    assert [e['id'] for e in listing(student, query='bÁcH kHOa')['items'] if suffix in e['title']] == [first['id']]
    assert [e['id'] for e in listing(student, query='  ' + marker + '  ')['items']] == expected_ids
    assert listing(student, query='   ', size=100) == listing(student, query='', size=100)
    assert [e['id'] for e in listing(student, query='%_!' + suffix)['items']] == [first['id']]
    assert listing(student, query="' OR 1=1 --")['items'] == []
    assert [e['id'] for e in listing(student, extra='&status=DRAFT&includeDrafts=true')['items']] == expected_ids

    # Query and path validation returns JSON errors, not an error-page redirect or raw exception.
    for path in ('/events?page=-1', '/events?page=100001', '/events?page=1.5', '/events?page=abc',
                 '/events?page=2147483648', '/events?size=0', '/events?size=101', '/events?size=-1',
                 '/events?size=1.5', '/events?size=abc', '/events?q=' + 'x' * 101,
                 '/events/0', '/events/-1', '/events/abc', '/events/9223372036854775808'):
        error = student.call('GET', path, expected=400)
        assert error['code'] in ('VALIDATION_ERROR', 'INVALID_PARAMETER')
    default_page = student.call('GET', '/events')
    assert default_page['page'] == 0 and default_page['size'] == 10
    assert all(event['status'] == 'PUBLISHED' for event in default_page['items'])
    detail = student.call('GET', f"/events/{first['id']}")
    assert detail['description'] == first_payload['description']
    assert detail['organizationUnitId'] == first_payload['organizationUnitId']
    assert detail['capacity'] == first_payload['capacity']
    assert detail['departmentIds'] == sorted(first_payload['departmentIds']) and detail['studyYears'] == [4, 5]
    assert student.call('GET', f"/events/{middle['id']}")['departmentIds'] == []
    assert sql(snapshot_query) == before
    assert sql('SELECT count(*) FROM campus.registrations;') == registrations_before

    # A subsequent read sees persisted edits, rather than a cached local/session snapshot.
    updated = organizer.call('PATCH', f"/events/{first['id']}", dict(first_payload, description='Latest detail', version=first['version']))
    assert student.call('GET', f"/events/{first['id']}") == updated
    assert next(event for event in listing(student)['items'] if event['id'] == first['id']) == updated
    print('PASS: published discovery, literal/Unicode search, stable pagination, full detail, hidden drafts/404, authentication, malformed parameters and read-only persistence.')
