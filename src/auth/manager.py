import psycopg2
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Tuple

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
        """Inicializa la tabla de usuarios y asegura la migración del esquema
        La tabla `usuarios` contiene sólo las columnas requeridas por el cliente.
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            # Crear tabla `usuarios` con sólo las columnas solicitadas
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP,
                    telefono TEXT,
                    migrate_pass_hash TEXT
                )
            ''')
            # Tabla para sesiones activas (una por usuario/device)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS active_sessions (
                    username TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    last_seen TIMESTAMP,
                    PRIMARY KEY (username, device_id)
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

    def set_migrate_hash(self, username: str, migrate_hash: str) -> Tuple[bool, str]:
        """Permite que el admin establezca directamente el migrate_pass_hash para un usuario."""
        if not username or not migrate_hash:
            return False, "Usuario y hash requeridos"
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("UPDATE usuarios SET migrate_pass_hash = %s WHERE username = %s",
                        (migrate_hash, username))
            conn.commit(); cur.close(); conn.close()
            return True, "Hash de migración establecido"
        except Exception as e:
            return False, f"Error: {e}"

    def validate_migrate_hash(self, username: str, migrate_hash: str) -> bool:
        """Valida que el hash de migración proporcionado coincida con el almacenado."""
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT migrate_pass_hash FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone(); cur.close(); conn.close()
            if not row:
                return False
            db_hash = row[0]
            if not db_hash:
                return False
            # La comparación es directa: el admin compartirá este HASH con el cliente.
            return db_hash == migrate_hash
        except Exception:
            return False

    def regenerate_migrate_hash(self, username: str) -> Optional[str]:
        """Genera un nuevo token, almacena su hash en migrate_pass_hash y retorna el HASH
        (no se almacena texto plano en la base de datos; el admin recibirá el hash que debe
        comunicar al cliente).
        """
        try:
            import secrets
            token = secrets.token_urlsafe(12)
            token_hash = self._hash_password(token)
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("UPDATE usuarios SET migrate_pass_hash = %s WHERE username = %s",
                        (token_hash, username))
            conn.commit(); cur.close(); conn.close()
            # Retornar el HASH (el admin lo copiará y se lo dará al cliente)
            return token_hash
        except Exception:
            return None

    def register(self, username: str, password: str, telefono: Optional[str] = None) -> Tuple[bool, str]:
        """Registra un nuevo usuario con expiración de 30 días (pero inicia como inactivo).
        Nota: NO generamos aquí el migrate_pass_hash automáticamente; el admin lo debe
        establecer desde la consola (o usando regenerate_migrate_hash).
        """
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
            cursor.close(); conn.close()
            return True, "Registro exitoso. Tu cuenta está pendiente de activación por admin."
        except psycopg2.errors.UniqueViolation:
            return False, "El nombre de usuario ya existe."
        except Exception as e:
            return False, f"Error al registrar: {str(e)}"

    def apply_license(self, username: str, migrate_hash: str) -> Tuple[bool, str]:
        """Permite al usuario activar su cuenta proporcionando el `migrate_pass_hash` que el admin
        le entregó (si coincide con lo almacenado, activamos la cuenta).
        """
        if not username or not migrate_hash:
            return False, "Usuario y hash de migración requeridos."
        try:
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT migrate_pass_hash FROM usuarios WHERE username = %s", (username,))
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close();
                return False, "Usuario no encontrado."
            stored_hash = row[0]
            if not stored_hash:
                cur.close(); conn.close();
                return False, "No hay hash de migración establecido para este usuario. Contacta al admin."
            if stored_hash != migrate_hash:
                cur.close(); conn.close();
                return False, "Hash de migración inválido."
            # Coincide: activar la cuenta
            cur.execute("UPDATE usuarios SET is_active = TRUE WHERE username = %s", (username,))
            conn.commit(); cur.close(); conn.close()
            return True, "Cuenta activada correctamente. Ahora puedes usar la licencia en este equipo."
        except Exception as e:
            return False, f"Error al aplicar licencia: {e}"

    def login(self, username: str, password: str, device_id: Optional[str] = None, transfer: bool = False, transfer_password: Optional[str] = None) -> Tuple[bool, str]:
        """Valida credenciales remotas, estado activo, expiración y limita sesión por dispositivo.

        Parmetros:
        - device_id: identificador del dispositivo que intenta iniciar sesión.
        - transfer: si True, fuerza la transferencia de la sesión activa a este device_id.
        - transfer_password: en este diseño, se espera que sea el migrate_pass_hash (no texto plano).
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
                                f"Solicita al admin el migrate_pass_hash para activar la cuenta.")

            # Verificar expiración
            if expires_at and expires_at < datetime.now():
                cursor.close(); conn.close()
                return False, f"Tu membresía expiró el {expires_at.strftime('%d/%m/%Y')}. Contacta al admin para renovar."

            # Gestión de sesiones activas por device
            if device_id:
                cursor.execute("SELECT device_id, last_seen FROM active_sessions WHERE username = %s ORDER BY last_seen ASC", (username,))
                rows = cursor.fetchall()
                existing_device_ids = [r[0] for r in rows]
                if device_id in existing_device_ids:
                    # Actualizar last_seen
                    cursor.execute("UPDATE active_sessions SET last_seen = %s WHERE username = %s AND device_id = %s", (datetime.now(), username, device_id))
                else:
                    if len(existing_device_ids) < 2:
                        cursor.execute(
                            "INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s)",
                            (username, device_id, datetime.now())
                        )
                    else:
                        # Ya hay 2 dispositivos activos
                        if transfer:
                            # Si se pasa transfer_password (se espera migrate_hash) y es válido, reemplazar la sesión más antigua
                            if transfer_password and self.validate_migrate_hash(username, transfer_password):
                                oldest = existing_device_ids[0]
                                cursor.execute("DELETE FROM active_sessions WHERE username = %s AND device_id = %s", (username, oldest))
                                cursor.execute("INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s)", (username, device_id, datetime.now()))
                            else:
                                cursor.close(); conn.close()
                                return False, "Cuenta activa en 2 dispositivos. Para agregar este equipo, solicita el migrate_pass_hash al admin."
                        else:
                            cursor.close(); conn.close()
                            return False, "Cuenta activa en 2 dispositivos. Para agregar este equipo, proporciona el migrate_pass_hash que el admin te dará."
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
        """Verificación rápida de seguridad."""
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

            if device_id:
                cur.close(); conn.close()
                return self.is_license_active_on_device(self.current_user, device_id)

            cur.execute("SELECT device_id FROM active_sessions WHERE username = %s", (self.current_user,))
            row2 = cur.fetchone(); cur.close(); conn.close()
            if not row2:
                return False
            return True
        except Exception:
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

        (mantener por compatibilidad, internamente puede usarse validate_migrate_hash)
        """
        try:
            # simplemente reemplazar la sesión más antigua si existe
            conn = self._get_connection(); cur = conn.cursor()
            cur.execute("SELECT device_id FROM active_sessions WHERE username = %s ORDER BY last_seen ASC", (username,))
            rows = cur.fetchall()
            existing_device_ids = [r[0] for r in rows]
            if existing_device_ids:
                oldest = existing_device_ids[0]
                cur.execute("DELETE FROM active_sessions WHERE username = %s AND device_id = %s", (username, oldest))
            cur.execute("INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s)", (username, device_id, datetime.now()))
            conn.commit(); cur.close(); conn.close()
            return True, "Migración forzada realizada"
        except Exception as e:
            return False, f"Error migrando: {e}"
