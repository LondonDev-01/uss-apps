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
        """Inicializa la tabla de usuarios en la nube si no existe"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP
                )
            ''')
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Error inicializando DB remota: {e}")

    def _hash_password(self, password: str) -> str:
        """Genera un hash SHA-256 de la contraseña"""
        return hashlib.sha256(password.encode()).hexdigest()

    def register(self, username: str, password: str) -> Tuple[bool, str]:
        """Registra un nuevo usuario con expiración de 30 días (pero inicia como inactivo)"""
        if not username or not password:
            return False, "Usuario y contraseña son requeridos."
        
        # Por defecto, la membresía dura 30 días desde el registro
        fecha_expiracion = datetime.now() + timedelta(days=30)
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO usuarios (username, password_hash, is_active, expires_at) VALUES (%s, %s, %s, %s)",
                (username, self._hash_password(password), False, fecha_expiracion)
            )
            conn.commit()
            cursor.close()
            conn.close()
            return True, "Registro exitoso. Tu cuenta está pendiente de activación por el admin."
        except psycopg2.errors.UniqueViolation:
            return False, "El nombre de usuario ya existe."
        except Exception as e:
            return False, f"Error al registrar: {str(e)}"

    def login(self, username: str, password: str) -> Tuple[bool, str]:
        """Valida credenciales remotas, estado activo y fecha de expiración"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT password_hash, is_active, expires_at FROM usuarios WHERE username = %s",
                (username,)
            )
            result = cursor.fetchone()
            cursor.close()
            conn.close()

            if not result:
                return False, "Usuario no encontrado."

            db_hash, is_active, expires_at = result
            if db_hash != self._hash_password(password):
                return False, "Contraseña incorrecta."

            if not is_active:
                return False, f"Cuenta '{username}' no activada. Contacta al admin para validar el pago."

            # Verificar expiración (si expires_at es menor a la fecha actual)
            if expires_at and expires_at < datetime.now():
                return False, f"Tu membresía expiró el {expires_at.strftime('%d/%m/%Y')}. Contacta al admin para renovar."

            self.is_authenticated = True
            self.current_user = username
            return True, "Acceso concedido."

        except Exception as e:
            return False, f"Error en login remoto: {str(e)}"

    def logout(self):
        self.is_authenticated = False
        self.current_user = None

    def has_active_license(self) -> bool:
        """Verificación rápida de seguridad"""
        return self.is_authenticated

    def logout(self):
        self.is_authenticated = False
        self.current_user = None

    def has_active_license(self) -> bool:
        """Verificación rápida de seguridad"""
        return self.is_authenticated
