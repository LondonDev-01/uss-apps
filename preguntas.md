# Cómo responder si te preguntan "Cómo lo hice"

Breve guía para dar respuestas rápidas y consistentes cuando te pregunten sobre el proyecto.

## Resumen rápido
- Proyecto: UniHorario (optimización y generación de horarios).
- Ejecutables / lanzadores: [launcher_desktop.py](launcher_desktop.py), [launcher_web.py](launcher_web.py).
- Frontend: [frontend/README.md](frontend/README.md).

## Si te preguntan "¿Cómo lo hiciste?"
Respuesta corta (ejemplo):
- "Desarrollé la lógica central en Python, el optimizador está en [`src.core.optimizer`](src/core/optimizer.py) y el parsing/export a Excel en [`src.data.parser`](src/data/parser.py). Para la UI web uso Streamlit (ver [launcher_web.py](launcher_web.py)) y para escritorio Tkinter (ver [launcher_desktop.py](launcher_desktop.py))."

## Librerías principales (ver [requirements.txt](requirements.txt))
- Streamlit, Tkinter (GUI), psycopg2 (Postgres), OpenPyXL (Excel), PyInstaller (empaquetado).
- NumPy / Pillow / OpenPyXL aparecen en builds; ver los archivos en `build/` y las entradas `.spec` como [UniHorarioUSS_v1.6.spec](UniHorarioUSS_v1.6.spec).

## Qué lógica uso (respuesta orientativa)
- Separación por capas: lógica de dominio y optimización en [`src.core.optimizer`](src/core/optimizer.py), modelos en [`src.core.models`](src/core/models.py).
- Parsing de datos y exportadores en [`src.data.parser`](src/data/parser.py) y [`src.data.excel_exporter`](src/data/excel_exporter.py).
- Autenticación/licencias (si aplica) en [`src.auth.manager`](src/auth/manager.py).

## Cómo leo/uso JSON (ejemplo simple)
Puedes explicar así (y referir al parser):
```python
# ejemplo genérico de lectura JSON
import json
from src.data import parser  # referencia al parser del proyecto

with open("input.json", "r", encoding="utf-8") as f:
    datos = json.load(f)

# pasar los datos al parser del proyecto
resultado = parser.parse_from_dict(datos)
```
Comenta que el detalle exacto está en [`src.data.parser`](src/data/parser.py).

## Empaquetado / builds
- Usamos PyInstaller para generar ejecutables; hay versiones y logs en `build/` (p. ej. `build/UniHorarioUSS_v1.6/`).
- Las .spec en la raíz controlan el empaquetado (p. ej. [UniHorarioUSS_v1.6.spec](UniHorarioUSS_v1.6.spec)).

## Preguntas frecuentes y respuestas cortas
- "¿Dónde está el optimizador?" → [`src.core.optimizer`](src/core/optimizer.py) — [src/core/optimizer.py](src/core/optimizer.py)  
- "¿Cómo exportas a Excel?" → `src.data.excel_exporter` — [src/data/excel_exporter.py](src/data/excel_exporter.py)  
- "¿Qué librerías usaste?" → Ver [requirements.txt](requirements.txt) y [MANUAL_TECNICO_MAESTRO.md](MANUAL_TECNICO_MAESTRO.md).

## Referencias rápidas
- Código principal: [src/](src/)  
- Parser: [`src.data.parser`](src/data/parser.py) — [src/data/parser.py](src/data/parser.py)  
- Optimizador: [`src.core.optimizer`](src/core/optimizer.py) — [src/core/optimizer.py](src/core/optimizer.py)  
- Lanzadores: [launcher_web.py](launcher_web.py), [launcher_desktop.py](launcher_desktop.py)  
- Docs de proyecto: [README.md](README.md), [MANUAL_TECNICO_MAESTRO.md](MANUAL_TECNICO_MAESTRO.md)

Si quieres, lo dejo más formal y extendido para imprimir antes de entrevistas o para enviar por email.

## Autenticación y flujo de licencias (respuesta preparada)

- **Resumen corto:** La autenticación usa PostgreSQL (psycopg2) para almacenar usuarios y sesiones. Cada usuario tiene `password_hash`, `is_active`, `expires_at` y una clave de migración (`migrate_pass_token`) que el admin puede ver y copiar desde la consola administrativa en `launcher_web.py`.
- **Dónde está:** Implementación en `src/auth/manager.py` y UI en `launcher_web.py`.

### Lógica principal
- Registro: `AuthManager.register(username, password)` crea el usuario (inactivo) con expiración por defecto (30 días) y genera automáticamente una clave de migración. Esa clave se almacena como HASH (`migrate_pass_hash`) y también como token en texto plano (`migrate_pass_token`) para que el admin la copie desde la consola.
- Activación: El admin puede activar la cuenta manualmente desde la consola o el usuario puede aplicar la licencia pegando la `clave de migración` que el admin le proporcionó usando `AuthManager.apply_license(username, token_o_hash)`.
- Login: `AuthManager.login(username, password, device_id, transfer=False, transfer_password=None)` valida credenciales, revisa si la cuenta está activa/expirada y controla sesiones activas por `device_id`. Si ya hay 2 dispositivos activos, el cliente debe pedir al admin la clave de migración para transferir (no se cierra la sesión anterior automáticamente).

### Mensajes que debes usar al explicar
- "Usuario no encontrado": cuando no existe el username en la BD.
- "Contraseña incorrecta": cuando la contraseña no coincide.
- "Cuenta no activada. Solicita al admin la clave de migración para activarla.": cuando `is_active` es False.
- "Tu membresía expiró el DD/MM/YYYY. Contacta al admin para renovar.": cuando `expires_at` ya pasó.
- "Cuenta activa en 2 dispositivos. Para agregar este equipo, solicita la clave de migración al admin.": cuando se excede el límite de equipos.

### Librerías usadas para esto
- `psycopg2` — conexión a PostgreSQL/Neon.
- `hashlib` — para hashear contraseñas y claves de migración (SHA-256).
- `secrets` — para generar tokens seguros.
- `streamlit` — interfaz administrativa y panel de login.

### Cómo correr la interfaz web (desarrollo)
1. Asegúrate de tener Python 3.10+ y las dependencias instaladas:

```bash
python -m pip install -r requirements.txt
```

2. Define la variable de entorno `NEON_DB_URL` apuntando a tu base de datos Postgres (o usa la URL por defecto si tienes Neon configurado). Para proteger la consola admin define `ADMIN_SECRET`:

```bash
export NEON_DB_URL="postgresql://user:pass@host:port/dbname?sslmode=require"
export ADMIN_SECRET="una_clave_segura"
```

3. Ejecuta la app Streamlit:

```bash
streamlit run launcher_web.py
```

La primera vez que abras la página, `AuthManager` creará las tablas necesarias (`usuarios`, `active_sessions`) automáticamente.

Si quieres que pruebe algún cambio adicional (por ejemplo limitar a 1 dispositivo, o no guardar el token en texto plano), dime y lo implemento.