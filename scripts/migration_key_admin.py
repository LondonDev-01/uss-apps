#!/usr/bin/env python3
"""Small admin CLI to list/generate/delete migration keys.
Usage:
  python scripts/migration_key_admin.py --db <DB_URL> --list <username>
  python scripts/migration_key_admin.py --db <DB_URL> --generate <username> [--days N]
  python scripts/migration_key_admin.py --db <DB_URL> --delete <key>

Note: keep DB URL secure. This script must be run by the admin only.
"""
import argparse
import os
from src.auth.manager import AuthManager

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--db', help='DB connection string', default=os.getenv('NEON_DB_URL'))
    p.add_argument('--list', metavar='USERNAME', help='List migration keys for a user (or omit to list all)')
    p.add_argument('--generate', metavar='USERNAME', help='Generate a new migration key for username')
    p.add_argument('--days', type=int, default=365, help='Days valid for generated key')
    p.add_argument('--delete', metavar='KEY', help='Delete a migration key')
    args = p.parse_args()

    if not args.db:
        print('DB connection string is required; set --db or NEON_DB_URL env var')
        return

    am = AuthManager(args.db)

    if args.list is not None:
        rows = am.list_migration_keys(args.list)
        if not rows:
            print('No keys found')
            return
        for r in rows:
            if len(r) == 2:
                k, until = r
                print(f"{k} (valid_until: {until})")
            else:
                k, username, until = r
                print(f"{k} (user: {username}) valid_until: {until}")
        return

    if args.generate:
        key = am.generate_migration_key(args.generate, days_valid=args.days)
        if key:
            print(f"Generated key for {args.generate}: {key} (valid {args.days} days)")
        else:
            print('Failed to generate key')
        return

    if args.delete:
        am.delete_migration_key(args.delete)
        print('Deleted (if existed)')
        return

    p.print_help()

if __name__ == '__main__':
    main()
