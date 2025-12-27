#!/usr/bin/env python3
"""Small admin HTTP API to manage migration keys.

Usage:
  export ADMIN_KEY=your-secret
  export NEON_DB_URL='postgresql://...'
  python3 scripts/admin_api.py --host 127.0.0.1 --port 8001

Endpoints (require header X-ADMIN-KEY == ADMIN_KEY):
- GET  /keys?username=<username>   -> list keys
- POST /keys  {"username":"user","days":30} -> generate key
- DELETE /keys/<key> -> delete key

This is meant for local admin usage only (bind to localhost) and never exposed publicly without additional auth.
"""
from flask import Flask, request, jsonify, abort
import os
from src.auth.manager import AuthManager
import argparse

app = Flask(__name__)

ADMIN_KEY = os.getenv('ADMIN_KEY')
DB_URL = os.getenv('NEON_DB_URL')
if not DB_URL:
    DB_URL = os.getenv('NEON_DB_URL', '')

def require_admin(req):
    # First check static ADMIN_KEY header
    key = req.headers.get('X-ADMIN-KEY')
    if key and ADMIN_KEY and key == ADMIN_KEY:
        return

    # Fallback: Basic auth with an admin user
    auth = req.headers.get('Authorization')
    if auth and auth.lower().startswith('basic '):
        import base64
        try:
            b64 = auth.split(' ', 1)[1]
            dec = base64.b64decode(b64).decode('utf-8')
            user, pwd = dec.split(':', 1)
            am = AuthManager(DB_URL)
            if am.validate_admin_credentials(user, pwd):
                return
        except Exception:
            pass

    abort(401, 'Unauthorized')

@app.route('/keys', methods=['GET'])
def list_keys():
    require_admin(request)
    username = request.args.get('username')
    am = AuthManager(DB_URL)
    rows = am.list_migration_keys(username)
    out = []
    for r in rows:
        if len(r) == 2:
            k, until = r
            out.append({'key': k, 'valid_until': until})
        else:
            k, user, until = r
            out.append({'key': k, 'user': user, 'valid_until': until})
    return jsonify(out)

@app.route('/keys', methods=['POST'])
def create_key():
    require_admin(request)
    data = request.get_json() or {}
    user = data.get('username')
    days = int(data.get('days', 365))
    if not user:
        abort(400, 'username required')
    am = AuthManager(DB_URL)
    key = am.generate_migration_key(user, days_valid=days)
    if not key:
        abort(500, 'failed to generate')
    return jsonify({'key': key, 'user': user, 'valid_days': days})

@app.route('/keys/<key>', methods=['DELETE'])
def delete_key(key):
    require_admin(request)
    am = AuthManager(DB_URL)
    am.delete_migration_key(key)
    return jsonify({'deleted': True, 'key': key})

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--host', default='127.0.0.1')
    p.add_argument('--port', type=int, default=8001)
    args = p.parse_args()
    if not ADMIN_KEY:
        print('WARNING: ADMIN_KEY not set; server will reject requests until ADMIN_KEY env var is set')
    if not DB_URL:
        print('ERROR: NEON_DB_URL not set. Set env var and restart.'); exit(1)
    app.run(host=args.host, port=args.port)
