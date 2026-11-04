"""Real HTTP + PostgreSQL checks against the dedicated compose.i1-test.yaml project."""
import concurrent.futures
import http.cookiejar
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from i1_events import verify_events

BASE = 'http://127.0.0.1:18080/api'
PASSWORD = os.environ['TEST_ACCOUNT_PASSWORD']
COMPOSE = ['docker', 'compose', '-p', 'campus-events-i1-test', '-f', 'compose.i1-test.yaml']


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None

    def call(self, method, path, data=None, expected=200, csrf=True):
        if method not in ('GET', 'HEAD') and csrf:
            self.csrf = self.call('GET', '/auth/csrf')['token']
        headers = {'Content-Type': 'application/json'}
        if csrf and self.csrf:
            headers['X-XSRF-TOKEN'] = self.csrf
        request = urllib.request.Request(BASE + path, method=method, headers=headers,
                                         data=None if data is None else json.dumps(data).encode())
        try:
            response = self.opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read().decode()
        result = json.loads(body) if body else None
        allowed = (expected,) if isinstance(expected, int) else expected
        assert response.code in allowed, f'{method} {path}: expected {allowed}, got {response.code}: {result}'
        if isinstance(result, dict):
            assert not any(key in json.dumps(result) for key in ('password_hash', 'token_hash', 'passwordHash'))
        return result

    def login(self, email, password=PASSWORD):
        return self.call('POST', '/auth/login', {'email': email, 'password': password})


def sql(query):
    result = subprocess.run(COMPOSE + ['exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1',
                                     '-U', 'campus_test', '-d', 'campus_i1_test', '-tA'],
                            input=query, text=True, capture_output=True, check=True)
    return result.stdout.strip()


def ready():
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            client = Client()
            if client.call('GET', '/health')['status'] == 'UP':
                client.login('admin.i1@example.test')
                return client
        except (OSError, AssertionError, json.JSONDecodeError):
            time.sleep(2)
    raise AssertionError('Seeded test backend did not become ready')


def main():
    admin = ready()
    me = admin.call('GET', '/auth/me')
    assert me['role'] == 'ADMIN'
    anonymous = Client()
    anonymous.call('GET', '/admin/users', expected=401)
    anonymous.call('POST', '/auth/login', {'email': 'admin.i1@example.test', 'password': PASSWORD}, expected=403, csrf=False)
    departments = anonymous.call('GET', '/catalog/departments')
    expected_departments = [
        'Khoa Điện – Điện tử', 'Khoa Kỹ thuật Xây dựng', 'Khoa Cơ khí',
        'Khoa Kỹ thuật Hoá học', 'Khoa Khoa học và Kỹ thuật Máy tính',
        'Khoa Công nghệ Vật liệu', 'Khoa Khoa học Ứng dụng', 'Khoa Kỹ thuật Giao thông',
        'Khoa Quản lý Công nghiệp', 'Khoa Kỹ thuật Địa chất và Dầu khí',
        'Khoa Môi trường và Tài nguyên', 'CT KỸ SƯ CHẤT LƯỢNG CAO PFIEV'
    ]
    assert [department['name'] for department in departments] == expected_departments
    assert len({department['id'] for department in departments}) == 12
    assert 'ECON' not in {department['code'] for department in departments}
    units = anonymous.call('GET', '/catalog/organization-units')
    suffix = uuid.uuid4().hex[:10]
    email = f'{suffix}@example.test'
    registration = dict(fullName='Sinh viên kiểm thử', email=email.upper(), password=PASSWORD,
                        studentCode='T' + suffix, departmentId=departments[0]['id'], studyYear=2, role='ADMIN')
    user = anonymous.call('POST', '/auth/register', registration, expected=201)
    assert user['role'] == 'STUDENT' and user['email'] == email
    duplicate = anonymous.call('POST', '/auth/register', registration, expected=409)
    assert duplicate['code'] == 'EMAIL_EXISTS' and 'email' in duplicate['fields']
    other_email = 'other-' + email
    duplicate = anonymous.call('POST', '/auth/register', dict(registration, email=other_email), expected=409)
    assert duplicate['code'] == 'STUDENT_CODE_EXISTS' and 'studentCode' in duplicate['fields']
    assert sql("SELECT count(*) FROM campus.users WHERE email='" + other_email + "';") == '0'
    invalid = anonymous.call('POST', '/auth/register', dict(registration, email='short-' + email, password='short'), expected=400)
    assert 'password' in invalid['fields']
    anonymous.call('POST', '/auth/register', dict(registration, email='long-' + email, password='ệ' * 30), expected=400)
    anonymous.call('POST', '/auth/register', dict(registration, email='dept-' + email, departmentId=9999999), expected=400)
    legacy_department = int(sql("WITH added AS (INSERT INTO campus.departments(code,name) VALUES('LEGACY','Legacy department') RETURNING id) SELECT id FROM added;"))
    anonymous.call('POST', '/auth/register', dict(registration, email='legacy-' + email, departmentId=legacy_department), expected=400)
    anonymous.call('POST', '/auth/login', {'email': email, 'password': 'wrong-password'}, expected=401)
    anonymous.call('POST', '/auth/login', {'email': 'locked.i1@example.test', 'password': PASSWORD}, expected=401)
    student = Client()
    student.login(email)
    assert student.call('GET', '/auth/me')['id'] == user['id']
    assert any(c.name == 'CAMPUS_SESSION' and c.has_nonstandard_attr('HttpOnly') for c in student.jar)
    student.call('GET', '/admin/users', expected=403)
    organizer = Client()
    organizer.login('organizer.i1@example.test')
    organizer.call('GET', '/admin/users', expected=403)
    admin.call('GET', '/admin/users?size=0', expected=400)
    page0 = admin.call('GET', '/admin/users?size=2&page=0')['items']
    page1 = admin.call('GET', '/admin/users?size=2&page=1')['items']
    all_users = admin.call('GET', '/admin/users?size=100')['items']
    assert [u['id'] for u in page0 + page1] == [u['id'] for u in all_users[:4]]
    filtered = admin.call('GET', '/admin/users?role=STUDENT&status=LOCKED&size=100')['items']
    assert filtered and all(u['role'] == 'STUDENT' and u['status'] == 'LOCKED' for u in filtered)
    assert not admin.call('GET', f'/admin/users?q={email}&role=ADMIN')['items']
    admin.call('GET', '/admin/users?role=OWNER', expected=400)
    admin.call('GET', '/admin/users?status=UNKNOWN', expected=400)
    student.call('POST', f"/admin/users/{user['id']}/status/preview", dict(status='LOCKED', version=user['version'], reason='forbidden'), expected=403)

    def target(uid):
        return next(u for u in admin.call('GET', '/admin/users?size=100')['items'] if u['id'] == uid)

    admin.call('PATCH', f"/admin/users/{me['id']}/status", dict(status='LOCKED', version=me['version'], reason='self test'), expected=409)
    new_org = admin.call('POST', '/admin/users', dict(fullName='Người tổ chức mới', email='org-' + email,
                         temporaryPassword=PASSWORD, organizationUnitId=units[0]['id'], reason='I1 test', role='ADMIN'), expected=201)
    assert new_org['mustChangePassword'] and new_org['role'] == 'ORGANIZER'
    forced = Client()
    forced.login('org-' + email)
    error = forced.call('GET', '/catalog/departments', expected=403)
    assert error['code'] == 'PASSWORD_CHANGE_REQUIRED'
    forced.call('POST', '/auth/password', dict(currentPassword='incorrect', newPassword=PASSWORD + 'X'), expected=400)
    forced.call('POST', '/auth/password', dict(currentPassword=PASSWORD, newPassword=PASSWORD + 'X'), expected=204)
    forced.call('GET', '/auth/me', expected=401)
    forced.login('org-' + email, PASSWORD + 'X')
    assert not forced.call('GET', '/auth/me')['mustChangePassword']
    # Roles are fixed: neither the removed API nor extra status fields can change them.
    before_role_attempt = target(user['id'])
    history_count = sql(f"SELECT count(*) FROM campus.account_history WHERE target_user_id={user['id']};")
    for desired in ('ADMIN', 'ORGANIZER', 'STUDENT'):
        admin.call('PATCH', f"/admin/users/{user['id']}/role", dict(role=desired, version=user['version'], reason='removed endpoint'), expected=403)
        admin.call('POST', f"/admin/users/{user['id']}/role/preview", dict(role=desired, version=user['version'], reason='removed preview'), expected=403)
    assert target(user['id']) == before_role_attempt
    assert sql(f"SELECT count(*) FROM campus.account_history WHERE target_user_id={user['id']};") == history_count
    assert student.call('GET', '/auth/me')['role'] == 'STUDENT'
    user_before = target(user['id'])
    history_before = sql(f"SELECT count(*) FROM campus.account_history WHERE target_user_id={user['id']};")
    preview = admin.call('POST', f"/admin/users/{user['id']}/status/preview", dict(status='LOCKED', version=user_before['version'], reason='preview only'))
    assert preview['changed'] and preview['before'] == user_before and preview['status'] == 'LOCKED'
    assert target(user['id']) == user_before
    assert student.call('GET', '/auth/me')['id'] == user['id']
    assert sql(f"SELECT count(*) FROM campus.account_history WHERE target_user_id={user['id']};") == history_before
    admin.call('PATCH', f"/admin/users/{user['id']}/status", dict(status='LOCKED', version=user_before['version'], reason=''), expected=400)
    admin.call('PATCH', f"/admin/users/{user['id']}/status", dict(status='LOCKED', version=user_before['version'], reason='test lock', role='ADMIN'))
    assert target(user['id'])['role'] == 'STUDENT'
    student.call('GET', '/auth/me', expected=401)
    admin.call('POST', f"/admin/users/{user['id']}/status/preview", dict(status='ACTIVE', version=user_before['version'], reason='stale preview'), expected=409)
    admin.call('PATCH', f"/admin/users/{user['id']}/status", dict(status='ACTIVE', version=user_before['version'], reason='stale'), expected=409)
    admin.call('PATCH', f"/admin/users/{user['id']}/status", dict(status='ACTIVE', version=target(user['id'])['version'], reason='unlock'))
    student.call('GET', '/auth/me', expected=401)
    student.login(email)
    assert student.call('GET', '/auth/me')['role'] == 'STUDENT'
    assert student.call('GET', '/auth/me')['studentCode'] == registration['studentCode'].upper()
    replay = Client()
    for cookie in student.jar:
        replay.jar.set_cookie(cookie)
    student.call('POST', '/auth/logout', {}, expected=204)
    replay.call('GET', '/auth/me', expected=401)
    student.login(email)
    sql(f"UPDATE campus.auth_sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE user_id={user['id']} AND revoked_at IS NULL;")
    student.call('GET', '/auth/me', expected=401)
    # Password hashes and snapshots must never contain the plaintext credential.
    student.call('POST', '/auth/logout', {}, expected=204)
    assert not any(c.name == 'CAMPUS_SESSION' for c in student.jar)
    student.call('POST', '/auth/logout', {}, expected=204)
    Client().call('POST', '/auth/logout', {}, expected=403, csrf=False)
    assert sql("SELECT bool_and(password_hash LIKE '$2a$12$%') FROM campus.users;") == 't'
    assert sql("SELECT count(*) FROM campus.account_history WHERE before_data::text LIKE '%password%' OR after_data::text LIKE '%password%';") == '0'
    before_counts = sql('SELECT (SELECT count(*) FROM campus.users)||\',\'||(SELECT count(*) FROM campus.events);')
    subprocess.run(COMPOSE + ['restart', 'backend'], check=True, capture_output=True)
    previous_admin = admin
    ready()
    previous_admin.call('GET', '/auth/me')
    admin = previous_admin
    assert sql('SELECT (SELECT count(*) FROM campus.users)||\',\'||(SELECT count(*) FROM campus.events);') == before_counts
    assert anonymous.call('GET', '/catalog/departments') == departments
    assert sql(f'SELECT count(*) FROM campus.departments WHERE id={legacy_department};') == '1'
    # Existing changed passwords survive a repeat seed/bootstrap startup.
    forced = Client()
    forced.login('org-' + email, PASSWORD + 'X')
    second = Client()
    student.login(email)
    verify_events(admin, organizer, student, Client, sql, PASSWORD)
    second.login('admin2.i1@example.test')
    admin1 = admin.call('GET', '/auth/me')
    admin2 = second.call('GET', '/auth/me')

    def lock_other(client, other):
        return client.call('PATCH', f"/admin/users/{other['id']}/status",
                           dict(status='LOCKED', version=other['version'], reason='concurrency test'),
                           expected=(200, 401, 403))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda pair: lock_other(*pair), [(admin, admin2), (second, admin1)]))
    assert sum(isinstance(x, dict) and x.get('status') == 'LOCKED' for x in outcomes) == 1
    assert sql("SELECT count(*) FROM campus.users WHERE role='ADMIN' AND status='ACTIVE';") == '1'
    print('PASS: real HTTP/PostgreSQL I1 fixed roles, auth, CSRF, RBAC, session revocation, admin lifecycle, audit, seed idempotence and concurrent Admin protection.')


if __name__ == '__main__':
    main()
