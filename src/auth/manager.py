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
                    expires_at TIMESTAMP,
                    telefono TEXT
                )
            ''')
            # Migración: Asegurarse de que las columnas existen
            cursor.execute('''
                ALTER TABLE usuarios 
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS telefono TEXT
            ''')
            # Tabla para sesiones activas (una por usuario)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS active_sessions (
                    username TEXT UNIQUE NOT NULL,
                    device_id TEXT NOT NULL,
                    last_seen TIMESTAMP
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
            return True, "Registro exitoso. Tu cuenta está pendiente de activación por el admin."
        except psycopg2.errors.UniqueViolation:
            return False, "El nombre de usuario ya existe."
        except Exception as e:
            return False, f"Error al registrar: {str(e)}"

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
                cursor.execute("SELECT device_id FROM active_sessions WHERE username = %s", (username,))
                row = cursor.fetchone()
                if row:
                    current_device = row[0]
                    if current_device != device_id:
                        if transfer:
                            cursor.execute(
                                "UPDATE active_sessions SET device_id = %s, last_seen = %s WHERE username = %s",
                                (device_id, datetime.now(), username)
                            )
                            conn.commit()
                        else:
                            cursor.close(); conn.close()
                            # Mensaje orientado a migración de licencia
                            return False, "Cuenta activa en otro dispositivo. ¿Deseas migrar la licencia a este equipo?"
                # Insertar o actualizar la sesión
                cursor.execute(
                    "INSERT INTO active_sessions (username, device_id, last_seen) VALUES (%s, %s, %s) "
                    "ON CONFLICT (username) DO UPDATE SET device_id = EXCLUDED.device_id, last_seen = EXCLUDED.last_seen",
                    (username, device_id, datetime.now())
                )
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

    def has_active_license(self) -> bool:
        """Verificación rápida de seguridad"""
        return self.is_authenticated

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

