# 🧠 Manual Maestro: UniHorario USS (Technical Deep-Dive)

Este manual está diseñado para que comprendas tu proyecto como si tú mismo hubieras escrito cada línea. Aquí explicamos el "qué", el "cómo" y el "por qué" de todo el sistema.

## 🏗️ 1. Arquitectura del Proyecto (El Esqueleto)
El proyecto sigue una estructura modular para que sea fácil de mantener y escalar:

```text
/Horario
├── dist/                # Donde vive el archivo .exe final (TU PRODUCTO)
├── src/
│   ├── auth/            # 🔐 Gestión de seguridad y membresías
│   ├── core/            # 🧠 El "cerebro": algoritmos de optimización y modelos
│   ├── data/            # 📥 Lectura de datos (parsing) y exportación a Excel
│   └── styles.css       # 🎨 Estilos visuales comunes
├── launcher_desktop.py  # 🖥️ Lanzador para la aplicación de PC (Tkinter)
├── launcher_web.py      # 🌐 Lanzador para la aplicación Web (Streamlit)
└── GUIA_USUARIO.txt     # 📖 Lo que lee tu cliente
```

## 🧠 2. El Cerebro: El Optimizador (`src/core/optimizer.py`)
### ¿Cómo funciona la "magia"?
1. **Combinatoria:** El programa toma todos los NRCs que el usuario seleccionó y genera todas las combinaciones posibles de horarios sin choques.
2. **Evaluación (Scoring):** No todos los horarios son iguales. El programa "castiga" o "premia" horarios basándose en:
   - **Mañanas:** Si el usuario prefiere no madrugar, se penalizan las clases antes de las 9:30 AM.
   - **Ventanas:** Se penalizan los bloques libres entre clases.
   - **Tardes:** Se premia terminar temprano.
3. **Diversidad:** Para que el botón "Ver otra opción" sea útil, el algoritmo filtra horarios que sean 90% idénticos, obligando a mostrar opciones genuinamente diferentes.

## 🔐 3. Seguridad y Membresía (`src/auth/manager.py`)
### La Conexión a la Nube (PostgreSQL / Neon.tech)
- **Hash de Contraseñas:** Nunca guardamos la clave real del usuario. Usamos **SHA-256** para convertirla en un código irreversible. Al loguearse, hasheamos lo que el usuario escribe y comparamos los códigos.
- **Membresía de 30 Días:** Cada usuario tiene una columna `expires_at`. Al iniciar sesión, el programa compara la hora actual con esa fecha. Si la hora actual es mayor, el acceso se bloquea.
- **Estado 'is_active':** Es tu interruptor manual. Aunque la fecha sea válida, si este campo es `False`, el usuario no entra.

## 🛠️ 4. Herramientas Utilizadas (Stack Tecnológico)
1. **Python:** Lenguaje principal.
2. **Tkinter:** Para la interfaz de escritorio (ligera y nativa).
3. **Streamlit:** Para la interfaz web (rápida y moderna).
4. **Psycopg2:** El "túnel" para hablar con la base de datos PostgreSQL en la nube.
5. **OpenPyXL:** Para crear los archivos Excel desde cero.
6. **PyInstaller:** El "empaquetador" que convierte el código Python en un archivo `.exe` que corre en cualquier PC sin necesidad de instalar nada.

## ▶️ Quick Start (Desarrollador y Usuario)

1. Requisitos mínimos:
   - Python 3.10+ instalado
   - Instalar dependencias: `pip install -r requirements.txt`

2. Ejecutar la aplicación (forma recomendada):
   - Usar el lanzador incluido:
     - Linux/macOS: `./build/unihorario`
     - Windows (si se creó un .exe): `dist/UniHorarioUSS.exe` (si aplica)
   - Alternativa: `python launcher_desktop.py`

3. Generar ejecutable (opcional):
   - Si quieres un `.exe` o binario, usa PyInstaller con la spec adecuada (ejemplo):
     `pyinstaller UniHorarioUSS_Oficial.spec --noconfirm`
   - Después de crear el ejecutable, **las `.spec` ya no son estrictamente necesarias** y se pueden eliminar del repositorio si prefieres mantenerlo limpio.

## 🔄 Notas de Limpieza
Se removieron archivos de ejemplo y pruebas para dejar el repositorio compacto: `tests/`, imágenes de ayuda y builds intermedios. Se conserva `src/` (código), `README.md`, `MANUAL_TECNICO_MAESTRO.md` y `GUIA_USUARIO.txt`.

## 💾 Dónde se guardan datos del usuario
- Las sesiones y archivos de estado del usuario ya NO se guardan en el root del repo.
- En Linux/macOS: `~/.config/unihorario/user_session.json`
- En Windows: `%APPDATA%\UniHorario\user_session.json`

## 🗂️ Dist y ejecutables
- El proceso de build coloca un único archivo ejecutable versionado en `dist/` con formato `UniHorarioUSS_v<MAJOR>.<MINOR>`.
- Si ejecutas `build/build_release.py` localmente, incrementará la versión menor y generará el binario (Linux). Para Windows, el workflow de GitHub Actions puede crear el ejecutable en `dist/`.

---
Si quieres, puedo añadir un objetivo Makefile o un `scripts/` con comandos `make run` y `make build` para estandarizar estas instrucciones.
## 📦 5. Glosario de Archivos "Raros"
- **`.spec`**: Archivos de configuración de PyInstaller. Dicen qué carpetas e imágenes meter dentro del `.exe`. Se pueden borrar después de crear el ejecutable.
- **`__pycache__`**: Carpetas que crea Python para que el código corra más rápido. Son basura, se pueden borrar.
- **`.venv`**: El "entorno virtual". Es un rincón aislado donde están instaladas las librerías necesarias para que el código funcione en tu PC de desarrollo.

---
*Este proyecto fue construido para ser robusto, seguro y listo para escalar a miles de usuarios.* 🚀✨
