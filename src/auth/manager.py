import psycopg2
from psycopg2 import extras
import hashlib
import os
from typing import Optional, Dict, Tuple

class AuthManager:
    """
    Gestor de autenticación y licencias con persistencia en PostgreSQL (Neon.tech).
    Permite la gestión remota de usuarios para distribución comercial.
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
                    is_active BOOLEAN DEFAULT FALSE
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
        """Registra un nuevo usuario (inactivo por defecto) en la nube"""
        if not username or not password:
            return False, "Usuario y contraseña son requeridos."
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO usuarios (username, password_hash, is_active) VALUES (%s, %s, %s)",
                (username, self._hash_password(password), False)
            )
            conn.commit()
            cursor.close()
            conn.close()
            return True, "Registro exitoso en la nube. Tu cuenta está pendiente de activación."
        except psycopg2.errors.UniqueViolation:
            return False, "El nombre de usuario ya existe."
        except Exception as e:
            return False, f"Error al registrar: {str(e)}"

    def login(self, username: str, password: str) -> Tuple[bool, str]:
        """Valida credenciales remotas y verifica si la cuenta está activa"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT password_hash, is_active FROM usuarios WHERE username = %s",
                (username,)
            )
            result = cursor.fetchone()
            cursor.close()
            conn.close()

            if not result:
                return False, "Usuario no encontrado."

            db_hash, is_active = result
            if db_hash != self._hash_password(password):
                return False, "Contraseña incorrecta."

            if not is_active:
                return False, f"Cuenta '{username}' pendiente de activación. Contacta al admin."

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
