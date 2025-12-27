import psycopg2
from psycopg2 import extras
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple

class AuthManager:
    """
    Gestor de autenticación y licencias con persistencia en PostgreSQL (Neon.tech).
    Incluye lógica de membresía con expiración de 30 días.
    """
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.is_authenticated = False
        self.current_user: Optional[str] = None
        self._init_db()

    def _get_connection(self):
        """Retorna una conexión a la base de datos de Neon.tech"""
        return psycopg2.connect(self.connection_string)

    def _init_db(self):
        """Inicializa la tabla de usuarios y asegura la migración del esquema"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            # Crear tabla si no existe
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT FALSE,
                    is_admin BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP,
                    telefono TEXT,
                    migrate_pass_hash TEXT
                )
            ''')
            # Migración: Asegurarse de que las columnas existen
            cursor.execute('''
                ALTER TABLE usuarios 
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS telefono TEXT
                , ADD COLUMN IF NOT EXISTS migrate_pass_hash TEXT
                , ADD COLUMN IF NOT EXISTS is_admin BOOLEAN
            ''')
            # Tabla para sesiones activas (una por usuario)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS active_sessions (
                    username TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    last_seen TIMESTAMP,
                    PRIMARY KEY (username, device_id)
                )
            ''')
            # Tabla para claves de migración (validez por tiempo)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS migration_keys (
                    key TEXT PRIMARY KEY,
                    username TEXT,
                    valid_until TIMESTAMP
                )
            ''')
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Error inicializando/migrando DB remota: {e}")

    def _hash_password(self, password: str) -> str:
        """Genera un hash SHA-256 de la contraseña"""
        return hashlib.sha256(password.encode()).hexdigest()

    def set_migrate_password(self, username: str, password: str) -> Tuple[bool, str]:
        """Configura una contraseña de migración (almacenada como hash) para un usuario."""
        if not username or not password:
            return False, "Usuario y contraseña requeridos"
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("UPDATE usuarios SET migrate_pass_hash = %s WHERE username = %s", (self._hash_password(password), username))
            conn.commit(); cur.close(); conn.close()
            return True, "Contraseña de migración establecida"
        except Exception as e:
            return False, f"Error: {e}"

    def validate_migrate_password(self, username: str, password: str) -> bool:
        """Valida la contraseña de migración para el usuario."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT migrate_pass_hash FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone(); cur.close(); conn.close()
            if not row or not row[0]:
                return False
            return row[0] == self._hash_password(password)
        except Exception:
            return False

    # --- Migration keys management ---
    def generate_migration_key(self, username: Optional[str] = None, days_valid: int = 5) -> str:
        """Genera y guarda una clave de migración válida por `days_valid` días. Retorna la clave."""
        import secrets
        key = secrets.token_hex(32)
        valid_until = datetime.now() + timedelta(days=days_valid)
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("INSERT INTO migration_keys (key, username, valid_until) VALUES (%s, %s, %s)", (key, username, valid_until))
            conn.commit(); cur.close(); conn.close()
            return key
        except Exception:
            # En caso de fallo, no propagar excepción para no romper el flujo de registro;
            # retornar None para indicar que no se creó la clave.
            try:
                cur.close(); conn.close()
            except Exception:
                pass
            return None

    def list_migration_keys(self, username: Optional[str] = None) -> list:
        """Retorna una lista de (key, valid_until) para el username proporcionado (o todas si username es None)."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            if username:
                cur.execute("SELECT key, valid_until FROM migration_keys WHERE username = %s", (username,))
            else:
                cur.execute("SELECT key, username, valid_until FROM migration_keys ORDER BY valid_until DESC")
            rows = cur.fetchall()
            cur.close(); conn.close()
            return rows
        except Exception:
            return []

    # NOTE: generation/setting of user-facing migrate passwords is admin-only.
    # The methods `set_migrate_password` and `validate_migrate_password` remain for admin use.
    # Do NOT auto-generate or display migrate passwords to end users.

    def validate_migration_key(self, key: str, username: Optional[str] = None) -> bool:
        """Valida que la clave exista, opcionalmente para un username, y no haya expirado."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            if username:
                cur.execute("SELECT valid_until FROM migration_keys WHERE key = %s AND (username = %s OR username IS NULL)", (key, username))
            else:
                cur.execute("SELECT valid_until FROM migration_keys WHERE key = %s", (key,))
            row = cur.fetchone(); cur.close(); conn.close()
            if not row: return False
            valid_until = row[0]
            return valid_until and valid_until >= datetime.now()
        except Exception:
            return False

    def delete_migration_key(self, key: str):
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("DELETE FROM migration_keys WHERE key = %s", (key,))
            conn.commit(); cur.close(); conn.close()
        except Exception:
            pass

    def register(self, username: str, password: str, telefono: Optional[str] = None) -> Tuple[bool, str]:
        """Registra un nuevo usuario con expiración de 30 días (pero inicia como inactivo)"""
        if not username or not password:
            return False, "Usuario y contraseña son requeridos."
        
        # Por defecto, la membresía dura 30 días desde el registro
        fecha_expiracion = datetime.now() + timedelta(days=30)
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO usuarios (username, password_hash, is_active, expires_at, telefono) VALUES (%s, %s, %s, %s, %s)",
                (username, self._hash_password(password), False, fecha_expiracion, telefono)
            )
            conn.commit()
            cursor.close()
            conn.close()

            # Generar automáticamente una clave de migración en BD (no se muestra al usuario)
            try:
                # Generar con validez por defecto de 365 días
                self.generate_migration_key(username=username, days_valid=365)
            except Exception:
                # No bloquear el registro por fallo en generación de clave
                pass

            return True, "Registro exitoso. Tu cuenta está pendiente de activación por el admin."
        except psycopg2.errors.UniqueViolation:
            return False, "El nombre de usuario ya existe."
        except Exception as e:
            return False, f"Error al registrar: {str(e)}"

    def create_or_promote_admin(self, username: str, password: str) -> Tuple[bool, str]:
        """Crea o promueve un usuario a admin. Activa la cuenta y setea la contraseña.

        Esta operación debe ejecutarse por el admin local (no desde clientes).
        """
        if not username or not password:
            return False, "Usuario y contraseña requeridos."
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT id FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE usuarios SET password_hash = %s, is_active = TRUE, is_admin = TRUE WHERE username = %s", (self._hash_password(password), username))
            else:
                expires = datetime.now() + timedelta(days=365)
                cur.execute("INSERT INTO usuarios (username, password_hash, is_active, is_admin, expires_at) VALUES (%s, %s, TRUE, TRUE, %s)", (username, self._hash_password(password), expires))
            conn.commit(); cur.close(); conn.close()
            return True, "Admin creado/actualizado correctamente."
        except Exception as e:
            return False, f"Error creando admin: {e}"

    def validate_admin_credentials(self, username: str, password: str) -> bool:
        """Valida que las credenciales correspondan a un admin activo."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT password_hash, is_admin, is_active FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone(); cur.close(); conn.close()
            if not row:
                return False
            db_hash, is_admin, is_active = row
            if not is_admin or not is_active:
                return False
            return db_hash == self._hash_password(password)
        except Exception:
            return False

    def login(self, username: str, password: str, device_id: Optional[str] = None, transfer: bool = False) -> Tuple[bool, str]:
        """Valida credenciales remotas, estado activo, expiración y limita sesión por dispositivo.

        Parámetros:
        - device_id: identificador del dispositivo que intenta iniciar sesión.
        - transfer: si True, forza la transferencia de la sesión activa a este device_id.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT password_hash, is_active, expires_at FROM usuarios WHERE username = %s",
                (username,)
            )
            result = cursor.fetchone()

            if not result:
                cursor.close(); conn.close()
                return False, "Usuario no encontrado."

            db_hash, is_active, expires_at = result
            if db_hash != self._hash_password(password):
                cursor.close(); conn.close()
                return False, "Contraseña incorrecta."

            if not is_active:
                cursor.close(); conn.close()
                # Mensaje claro: la cuenta no tiene licencia activa
                return False, (f"Cuenta '{username}' no activada. "
                                f"Migra o activa tu licencia contactando al desarrollador (onsole.neon.tech).")

            # Verificar expiración (si expires_at es menor a la fecha actual)
            if expires_at and expires_at < datetime.now():
                cursor.close(); conn.close()
                return False, f"Tu membresía expiró el {expires_at.strftime('%d/%m/%Y')}. Contacta al admin para renovar."

            # Si se pasa device_id, gestionar la tabla de sesiones activas
            if device_id:
                # Revisar sesiones activas existentes
                cursor.execute("SELECT device_id, last_seen FROM active_sessions WHERE username = %s ORDER BY last_seen ASC", (username,))
                rows = cursor.fetchall()
                existing_device_ids = [r[0] for r in rows]
                if device_id in existing_device_ids:
                    # Actualizar last_seen
                    cursor.execute("UPDATE active_sessions SET last_seen = %s WHERE username = %s AND device_id = %s", (datetime.now(), username, device_id))
                else:
                    if len(existing_device_ids) < 2:
                        cursor.execute("INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s)", (username, device_id, datetime.now()))
                    else:
                        # Ya hay 2 dispositivos activos
                        if transfer:
                            # Reemplazar la sesión más antigua
                            oldest = existing_device_ids[0]
                            cursor.execute("DELETE FROM active_sessions WHERE username = %s AND device_id = %s", (username, oldest))
                            cursor.execute("INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s)", (username, device_id, datetime.now()))
                        else:
                            cursor.close(); conn.close()
                            return False, "Cuenta activa en 2 dispositivos. Para agregar este equipo, solicita al admin que genere una CLAVE TEMPORAL para migración."
                conn.commit()

            cursor.close()
            conn.close()

            self.is_authenticated = True
            self.current_user = username
            return True, "Acceso concedido."

        except Exception as e:
            return False, f"Error en login remoto: {str(e)}"

    def logout(self, username: Optional[str] = None, device_id: Optional[str] = None):
        """Desactiva la sesión local y elimina la sesión activa en la BD si se indica."""
        try:
            if username or device_id:
                conn = self._get_connection()
                cursor = conn.cursor()
                if username and device_id:
                    cursor.execute("DELETE FROM active_sessions WHERE username = %s AND device_id = %s", (username, device_id))
                elif username:
                    cursor.execute("DELETE FROM active_sessions WHERE username = %s", (username,))
                elif device_id:
                    cursor.execute("DELETE FROM active_sessions WHERE device_id = %s", (device_id,))
                conn.commit()
                cursor.close(); conn.close()
        except Exception:
            pass

        self.is_authenticated = False
        self.current_user = None

    def has_active_license(self, device_id: Optional[str] = None) -> bool:
        """Verificación rápida de seguridad.

        Si se pasa `device_id`, retorna True solo si la licencia está activa y la sesión
        activa corresponde a ese `device_id`.
        Si no se pasa, retorna True si la cuenta está activa y existe alguna sesión activa.
        """
        try:
            if not self.current_user:
                return False
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT is_active FROM usuarios WHERE username = %s", (self.current_user,))
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close(); return False
            is_active = row[0]
            if not is_active:
                cur.close(); conn.close(); return False

            # Si nos piden comprobar un device concreto, delegar a is_license_active_on_device
            if device_id:
                cur.close(); conn.close()
                return self.is_license_active_on_device(self.current_user, device_id)

            # Sin device_id: basta con que exista una sesión activa para el usuario
            cur.execute("SELECT device_id FROM active_sessions WHERE username = %s", (self.current_user,))
            row2 = cur.fetchone(); cur.close(); conn.close()
            if not row2:
                return False
            return True
        except Exception:
            # Fallback a estado local
            return self.is_authenticated

    def is_license_active_on_device(self, username: str, device_id: str) -> bool:
        """Retorna True si la cuenta existe, está activa y la sesión activa coincide con device_id."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT is_active FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close()
                return False
            is_active = row[0]
            if not is_active:
                cur.close(); conn.close()
                return False
            cur.execute("SELECT device_id FROM active_sessions WHERE username = %s", (username,))
            row2 = cur.fetchone()
            cur.close(); conn.close()
            if not row2:
                return False
            return row2[0] == device_id
        except Exception:
            return False

    def get_active_device(self, username: str) -> Optional[str]:
        """Retorna el device_id actualmente activo para un usuario, o None."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT device_id FROM active_sessions WHERE username = %s", (username,))
            row = cursor.fetchone()
            cursor.close(); conn.close()
            return row[0] if row else None
        except Exception:
            return None

    def migrate_license(self, username: str, device_id: str) -> Tuple[bool, str]:
        """Forza la migración de la licencia para el usuario al device_id indicado.

        Nota: la validación externa de la 'clave de migración' se debe hacer en el cliente
        (por ejemplo, comparando con un hash proporcionado por el desarrollador).
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s) "
                "ON CONFLICT (username) DO UPDATE SET device_id = EXCLUDED.device_id, last_seen = EXCLUDED.last_seen",
                (username, device_id, datetime.now())
            )
            conn.commit()
            cursor.close(); conn.close()
            self.is_authenticated = True
            self.current_user = username
            return True, "Licencia migrada correctamente."
        except Exception as e:
            return False, f"Error migrando licencia: {e}"

