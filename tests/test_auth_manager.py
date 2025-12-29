import sys
import types
import unittest
from datetime import datetime, timedelta

# Provide a fake psycopg2 module so tests don't require the real package.
fake_psycopg2 = types.SimpleNamespace()
fake_psycopg2.errors = types.SimpleNamespace(UniqueViolation=Exception)
sys.modules['psycopg2'] = fake_psycopg2

from src.auth.manager import AuthManager


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._last_rows = None

    def execute(self, query, params=None):
        q = (query or '').lower()
        p = params or ()
        # CREATE TABLE or other ignored statements
        if q.strip().startswith('create table'):
            return
        if 'insert into usuarios' in q:
            username = p[0]
            if any(u['username'] == username for u in self.state['usuarios']):
                raise Exception('unique')
            uid = len(self.state['usuarios']) + 1
            self.state['usuarios'].append({
                'id': uid,
                'username': username,
                'password_hash': p[1],
                'is_active': p[2],
                'expires_at': p[3],
                'telefono': p[4],
                'migrate_pass_hash': None,
                'migrate_pass_token': None,
            })
            return
        if 'update usuarios set migrate_pass_hash' in q or 'update usuarios set migrate_pass_hash,' in q:
            # params: (hash, token, username) or (hash, username)
            if len(p) == 3:
                h, t, username = p
            else:
                h, username = p
                t = None
            for u in self.state['usuarios']:
                if u['username'] == username:
                    u['migrate_pass_hash'] = h
                    if t is not None:
                        u['migrate_pass_token'] = t
                    return
            return
        if "select migrate_pass_hash, migrate_pass_token from usuarios" in q or "select migrate_pass_hash, migrate_pass_token" in q:
            username = p[0]
            for u in self.state['usuarios']:
                if u['username'] == username:
                    self._last_rows = [(u.get('migrate_pass_hash'), u.get('migrate_pass_token'))]
                    return
            self._last_rows = []
            return
        if "select password_hash, is_active, expires_at from usuarios" in q:
            username = p[0]
            for u in self.state['usuarios']:
                if u['username'] == username:
                    self._last_rows = [(u.get('password_hash'), u.get('is_active'), u.get('expires_at'))]
                    return
            self._last_rows = []
            return
        if 'insert into active_sessions' in q:
            username, device_id, last_seen = p
            self.state['active_sessions'].append({'username': username, 'device_id': device_id, 'last_seen': last_seen})
            return
        if 'select device_id, last_seen from active_sessions' in q:
            username = p[0]
            rows = [(s['device_id'], s['last_seen']) for s in sorted(self.state['active_sessions'], key=lambda x: x['last_seen']) if s['username'] == username]
            self._last_rows = rows
            return
        if 'delete from active_sessions' in q:
            username, device_id = p
            self.state['active_sessions'] = [s for s in self.state['active_sessions'] if not (s['username'] == username and s['device_id'] == device_id)]
            return
        if "select device_id from active_sessions where username = %s" in q and 'order' not in q:
            username = p[0]
            rows = [(s['device_id'],) for s in self.state['active_sessions'] if s['username'] == username]
            self._last_rows = rows
            return
        if "select id, username, is_active, expires_at, telefono, migrate_pass_token from usuarios order by id desc" in q:
            rows = []
            for u in sorted(self.state['usuarios'], key=lambda x: x['id'], reverse=True):
                rows.append((u['id'], u['username'], u['is_active'], u['expires_at'], u['telefono'], u['migrate_pass_token']))
            self._last_rows = rows
            return
        if "update usuarios set is_active = true where username = %s" in q:
            username = p[0]
            for u in self.state['usuarios']:
                if u['username'] == username:
                    u['is_active'] = True
                    return
        if "delete from usuarios where username = %s" in q:
            username = p[0]
            self.state['usuarios'] = [u for u in self.state['usuarios'] if u['username'] != username]
            return

    def fetchone(self):
        if not self._last_rows:
            return None
        return self._last_rows[0]

    def fetchall(self):
        return self._last_rows or []

    def close(self):
        pass


class FakeConnection:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


class TestAuthManager(unittest.TestCase):
    def setUp(self):
        # shared fake DB state
        self.state = {'usuarios': [], 'active_sessions': []}
        # monkeypatch AuthManager._get_connection to return FakeConnection with shared state
        state = self.state
        def _fake_get_conn(self):
            return FakeConnection(state)
        AuthManager._get_connection = _fake_get_conn
        self.auth = AuthManager('fake-conn-string')

    def test_register_and_token_and_apply_license(self):
        ok, msg = self.auth.register('pepe', 'secret')
        self.assertTrue(ok)
        # regenerate returns a token in plaintext
        token = self.auth.regenerate_migrate_hash('pepe')
        self.assertIsNotNone(token)
        ok2, msg2 = self.auth.apply_license('pepe', token)
        self.assertTrue(ok2)

    def test_login_requires_activation(self):
        ok, msg = self.auth.register('pepe2', 'secret2')
        self.assertTrue(ok)
        ok_login, msg_login = self.auth.login('pepe2', 'secret2', device_id='dev1')
        self.assertFalse(ok_login)
        self.assertIn('no activada', msg_login.lower())

    def test_login_after_activation_and_device_limits(self):
        ok, _ = self.auth.register('pepe3', 'pwd')
        self.assertTrue(ok)
        # activate
        conn = FakeConnection(self.state)
        cur = conn.cursor()
        cur.execute('UPDATE usuarios SET is_active = TRUE WHERE username = %s', ('pepe3',))

        # login device1
        ok1, m1 = self.auth.login('pepe3', 'pwd', device_id='d1')
        self.assertTrue(ok1)
        # login device2
        ok2, m2 = self.auth.login('pepe3', 'pwd', device_id='d2')
        self.assertTrue(ok2)
        # login device3 without transfer should be blocked
        ok3, m3 = self.auth.login('pepe3', 'pwd', device_id='d3')
        self.assertFalse(ok3)
        self.assertIn('2 dispositivos', m3)
        # generate token and try transfer
        token = self.auth.regenerate_migrate_hash('pepe3')
        ok4, m4 = self.auth.login('pepe3', 'pwd', device_id='d3', transfer=True, transfer_password=token)
        self.assertTrue(ok4)


if __name__ == '__main__':
    unittest.main()
