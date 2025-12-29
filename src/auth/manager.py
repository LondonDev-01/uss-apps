import psycopg2
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple


class AuthManager:
    """
    Gestor de autenticación y licencias con PostgreSQL (Neon.tech).
    - Membresía con expiración
    - Máx 2 dispositivos activos
    """

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.is_authenticated = False
        self.current_user: Optional[str] = None
        self._init_db()

    # ---------- DB ----------
    def _get_connection(self):
        return psycopg2.connect(self.connection_string)

    def _init_db(self):
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS usuarios (
                            id SERIAL PRIMARY KEY,
                            username TEXT UNIQUE NOT NULL,
                            password_hash TEXT NOT NULL,
                            is_active BOOLEAN DEFAULT FALSE,
                            expires_at TIMESTAMP,
                            telefono TEXT
                        )
                    """)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS active_sessions (
                            username TEXT NOT NULL,
                            device_id TEXT NOT NULL,
                            last_seen TIMESTAMP,
                            PRIMARY KEY (username, device_id)
                        )
                    """)
        except Exception:
            pass

    # ---------- Utils ----------
    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    # ---------- Registro ----------
    def register(self, username: str, password: str, telefono: Optional[str] = None) -> Tuple[bool, str]:
        if not username or not password:
            return False, "Usuario y contraseña requeridos."

        expires_at = datetime.now() + timedelta(days=30)

        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO usuarios (username, password_hash, is_active, expires_at, telefono)
                        VALUES (%s, %s, FALSE, %s, %s)
                    """, (username, self._hash_password(password), expires_at, telefono))
            return True, "Registro exitoso. Cuenta pendiente de activación."
        except psycopg2.errors.UniqueViolation:
            return False, "El usuario ya existe."
        except Exception as e:
            return False, str(e)

    # ---------- Login ----------
    def login(self, username: str, password: str, device_id: Optional[str] = None) -> Tuple[bool, str]:
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT password_hash, is_active, expires_at
                        FROM usuarios WHERE username = %s
                    """, (username,))
                    row = cur.fetchone()

                    if not row:
                        return False, "Usuario no encontrado."

                    db_hash, is_active, expires_at = row

                    if db_hash != self._hash_password(password):
                        return False, "Contraseña incorrecta."

                    if not is_active:
                        return False, "Cuenta no activada."

                    if expires_at and expires_at < datetime.now():
                        return False, "Membresía expirada."

                    if device_id:
                        self._handle_device_session(cur, username, device_id)

            self.is_authenticated = True
            self.current_user = username
            return True, "Acceso concedido."

        except Exception as e:
            return False, f"Error login: {e}"

    # ---------- Sesiones ----------
    def _handle_device_session(self, cur, username: str, device_id: str):
        cur.execute("""
            SELECT device_id FROM active_sessions
            WHERE username = %s ORDER BY last_seen ASC
        """, (username,))
        devices = [r[0] for r in cur.fetchall()]

        if device_id in devices:
            cur.execute("""
                UPDATE active_sessions SET last_seen = %s
                WHERE username = %s AND device_id = %s
            """, (datetime.now(), username, device_id))
            return

        if len(devices) >= 2:
            cur.execute("""
                DELETE FROM active_sessions
                WHERE username = %s AND device_id = %s
            """, (username, devices[0]))

        cur.execute("""
            INSERT INTO active_sessions (username, device_id, last_seen)
            VALUES (%s, %s, %s)
        """, (username, device_id, datetime.now()))

    # ---------- Logout ----------
    def logout(self, username: Optional[str] = None, device_id: Optional[str] = None):
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    if username and device_id:
                        cur.execute("DELETE FROM active_sessions WHERE username=%s AND device_id=%s", (username, device_id))
                    elif username:
                        cur.execute("DELETE FROM active_sessions WHERE username=%s", (username,))
                    elif device_id:
                        cur.execute("DELETE FROM active_sessions WHERE device_id=%s", (device_id,))
        except Exception:
            pass

        self.is_authenticated = False
        self.current_user = None

    # ---------- Licencia ----------
    def has_active_license(self, device_id: Optional[str] = None) -> bool:
        if not self.current_user:
            return False

        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT is_active FROM usuarios WHERE username=%s", (self.current_user,))
                    row = cur.fetchone()
                    if not row or not row[0]:
                        return False

                    if device_id:
                        cur.execute("""
                            SELECT 1 FROM active_sessions
                            WHERE username=%s AND device_id=%s
                        """, (self.current_user, device_id))
                        return cur.fetchone() is not None

                    cur.execute("SELECT 1 FROM active_sessions WHERE username=%s", (self.current_user,))
                    return cur.fetchone() is not None
        except Exception:
            return False

    def account_is_active(self, username: str) -> bool:
        """Retorna True si la cuenta existe y la columna is_active es TRUE."""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT is_active FROM usuarios WHERE username = %s", (username,))
                    row = cur.fetchone()
                    return bool(row and row[0])
        except Exception:
            return False
