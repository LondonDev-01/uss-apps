# 📅 UniHorario USS: Optimizador para la Universidad San Sebastián

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=Streamlit&logoColor=white)
![USS](https://img.shields.io/badge/Universidad-San_Sebastián-003366?style=for-the-badge)

**UniHorario USS** es una herramienta de optimización diseñada específicamente para estudiantes de la **Universidad San Sebastián**. Permite transformar el proceso de toma de ramos en una experiencia automatizada, asegurando el mejor horario posible según tus propias reglas y preferencias.

---

## 🌟 Características Principales

### 🧠 Motor de Optimización Localizado
- **USS Ready**: Adaptado para procesar el formato de datos del portal de la Universidad San Sebastián.
- **Diversidad de Opciones**: El algoritmo filtra horarios casi idénticos para ofrecerte 20 alternativas que realmente cambian tu semana.
- **Prioridades Personalizadas**: Decide si prefieres entrar tarde, salir temprano, evitar ventanas o no tener clases los sábados.

### 📂 Extracción Inteligente de Datos
- **Copiado Directo**: Pega tus ramos directamente desde el portal USS sin preocuparte por el formato.
- **Sincronización TEO/LAB**: Manejo automático de bloques teóricos y laboratorios ligados (Ligas y Conectores).
- **Detección de Días**: Soporta múltiples formatos de abreviación de días usados en la universidad.

### 🖥️ Plataformas Disponibles
- **Aplicación Desktop**: Interfaz profesional en Tkinter, ideal para uso personal rápido.
- **Pataforma Web**: Versión moderna en Streamlit con soporte para modo oscuro adaptativo.

---

## 🏗️ Arquitectura del Proyecto

Estructurado bajo estándares de **Arquitectura Limpia** para facilitar su mantenimiento y escalabilidad comercial:

```bash
src/
├── core/       # Lógica de optimización y modelos de dominio.
├── data/       # Parsers específicos para datos USS y exportadores.
├── auth/       # Sistema de gestión de licencias (Placeholder).
└── assets/     # Recursos visuales.
```

---

## 🚀 Inicio Rápido

1. **Clonar**: `git clone https://github.com/tu-usuario/unihorario-uss.git`
2. **Dependencias**: `pip install -r requirements.txt`
3. **Ejecutar**:
   - Escritorio: `python launcher_desktop.py`
   - Web: `streamlit run launcher_web.py`

   ## Frontend (Vite + React)

   He añadido una carpeta `frontend/` con un scaffold mínimo de Vite + React + TypeScript y placeholders para integrar Neon Auth.

   Pasos rápidos:

   - Entrar en la carpeta: `cd frontend`
   - Instalar dependencias (ej. con pnpm): `pnpm install`
   - Copiar `.env.example` a `.env` y establecer `VITE_NEON_AUTH_URL`
   - Levantar el servidor de desarrollo: `pnpm dev`
   - Generar la versión de producción: `pnpm build`

   En `.github/workflows/build-frontend.yml` hay un workflow que compila `frontend/dist` y lo sube como artifact en pushes a `main`.

---

## 💼 Enfoque Comercial
Diseñado para ser distribuido como un producto final. Incluye guías para:
- Generación de instalador **.EXE**.
- Conexión a Base de Datos **PostgreSQL** en la nube.
- Sistema de licencias para usuarios únicos.

---
*Desarrollado para optimizar la vida académica de los Sebastianos.*

---
**Nota (2025-12-26):** La herramienta de administración local (scripts y panel `/admin`) fue eliminada; las operaciones administrativas deben realizarse desde la consola de Neon o mediante consultas SQL directas. Ver `CHANGES.md` para más detalles.

Seguridad: el token de migración de licencias se genera automáticamente y se almacena en la tabla `usuarios` como un hash (`migrate_pass_hash`) y (para conveniencia administrativa) como `migrate_pass_token`. Este token **no** se muestra en la UI a usuarios finales; lo verás únicamente en la consola Neon (o puedes regenerarlo usando la función `regenerate_migrate_token`).
