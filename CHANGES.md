## 2025-12-26 — Removed local admin tooling

- Removed local admin scripts and API: `scripts/admin_api.py`, `scripts/create_admin_user.py`, `scripts/migration_key_admin.py`.
- Frontend admin panel `/admin` deprecated and removed; replaced with informational notice directing to Neon console.
- Disabled `create-admin` GitHub Actions workflow and archived files under `scripts/removed_admin/`.
- Removed admin-related helper methods from `src/auth/manager.py` (admin creation and validation helpers).

**Update 2025-12-26 (afternoon):** Reinstated per-user migration password support.
- Kept `migrate_pass_hash` column and reintroduced `set_migrate_password` / `validate_migrate_password` helpers in `src/auth/manager.py`.
- Login and UI updated to support migration via the admin-provided password (admin views the hash in the Neon console and shares the password with users when needed). Temporary one-time migration keys remain available but local admin tooling was removed.
 - Auto-generate a random migration token when a user registers. The token is stored **hashed** in `migrate_pass_hash` and **in plaintext** in `migrate_pass_token` so admins can copy it from the Neon console and give it to users when needed. The token is not shown to end users in the app UI.
 - **Security**: `regenerate_migrate_token` now returns the plaintext token directly (no env vars) so the admin can copy it from the Neon console; the token is not shown in the app UI.

Rationale: administration will be performed via the Neon console or direct DB access; local admin tooling was redundant and posed maintenance/security overhead.

If you want me to also remove DB columns (`is_admin`, `migrate_pass_hash`) and the `migration_keys` table, confirm and I'll run the destructive migration next.
