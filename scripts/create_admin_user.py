#!/usr/bin/env python3
"""Create or promote a user to admin (local script).
Usage:
  python3 scripts/create_admin_user.py --username Subaru
The script will prompt for a password (hidden) if not provided via --password (not recommended).
"""
import argparse
import getpass
from src.auth.manager import AuthManager
import os

p = argparse.ArgumentParser()
p.add_argument('--username', required=True)
p.add_argument('--password', required=False)
p.add_argument('--db', required=False, help='DB URL (overrides NEON_DB_URL env var)')
args = p.parse_args()

db = args.db or os.getenv('NEON_DB_URL')
if not db:
    print('NEON_DB_URL not provided, set env var or use --db'); exit(1)

pwd = args.password
if not pwd:
    pwd = getpass.getpass('Admin password: ')

am = AuthManager(db)
ok, msg = am.create_or_promote_admin(args.username, pwd)
print(ok, msg)
