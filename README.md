# 📅 UniHorario USS

Optimizador de horarios académicos para estudiantes de la **Universidad San Sebastián**. Pega los datos de tus ramos desde el portal USS y obtén automáticamente las mejores combinaciones de horario según tus preferencias.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## ✨ Características

- 🧠 **Motor de optimización** — Algoritmo combinatorio que genera hasta 20 horarios diversos, priorizando los mejores según tus reglas.
- 🎯 **Preferencias personalizadas** — Entrar tarde, salir temprano, evitar ventanas, sin clases los sábados.
- 📋 **3 categorías de ramos** — Obligatorios, opcionales (adelantar) y electivos (elige uno).
- 📥 **Parser inteligente** — Soporta el formato tabular del portal USS. Pega y listo.
- 📅 **Exportar a calendario** — Genera archivos `.ics` compatibles con Google Calendar, Apple Calendar y Outlook.
- 📊 **Exportar a CSV/JSON** — Para imprimir o respaldar.
- 🌗 **Modo oscuro adaptativo** — Sigue el tema del sistema.
- 💾 **Sin login, sin servidor** — Todo funciona en tu navegador. Tus datos nunca salen de tu computador.

---

## 🧪 Datos de Prueba

Copia y pega este bloque en el Paso 1 para probar la app:

```
13851	ICIF	G002	T01	TEO	SISTEMAS OPERATIVOS	T1	L1	50	02-03-2026	11-07-2026	F408	1440	1600					F			177564524	LUCIANO	RADRIGAN/FIGUEROA
13852	ICIF	G002	T50	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F309	0800	0920				R				177564524	LUCIANO	RADRIGAN/FIGUEROA
23281	ICIF	G002	T51	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F301	0800	0920						S		177564524	LUCIANO	RADRIGAN/FIGUEROA
13855	ICIF	G004	T01	TEO	TALLER INTERFA. Y DIS. SOFTW	T1	L1	45	02-03-2026	11-07-2026	F408	1735	1855			W					117943747	SILVIA	REYES/QUEZADA/
13867	ICIF	G004	T50	LAB	TALLER INTERFA. Y DIS. SOFTW	L1	T1	25	02-03-2026	11-07-2026	F303	1100	1220	M							231319948	ELIZABETH	CHICATA/CASTRO
23282	ICIF	G004	T51	LAB	TALLER INTERFA. Y DIS. SOFTW	L1	T1	20	02-03-2026	11-07-2026	F309	1311	1431	M							231319948	ELIZABETH	CHICATA/CASTRO
```

---

## 🚀 Desarrollo Local

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:3000

## 📦 Build de Producción

```bash
cd frontend
npm run build
```

Genera la carpeta `dist/` lista para desplegar.

## ☁️ Desplegar en Vercel

1. Sube el repo a GitHub
2. Conecta el repo en [vercel.com](https://vercel.com)
3. Configura el **Root Directory** como `frontend`
4. Vercel detectará automáticamente Vite y desplegará

No necesitas variables de entorno ni configuración adicional. La app funciona 100% en el navegador.

---

## 🏗️ Arquitectura

```
frontend/
├── src/
│   ├── App.tsx              # Layout principal con navegación
│   ├── main.tsx             # Entry point
│   ├── styles.css           # Estilos globales (tema claro/oscuro)
│   ├── store.tsx            # Estado global (React Context)
│   ├── types.ts             # Tipos TypeScript
│   ├── lib/
│   │   ├── parser.ts        # Parser del formato USS
│   │   └── optimizer.ts     # Motor de optimización
│   ├── pages/
│   │   ├── InputPage.tsx    # Paso 1: Ingreso de ramos
│   │   ├── ProcessPage.tsx  # Paso 2: Asignar días
│   │   ├── SchedulePage.tsx # Paso 3: Ver horario
│   │   └── ExportPage.tsx   # Paso 4: Exportar
│   └── components/
│       └── ScheduleGrid.tsx # Grilla visual de horario
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

---

## ⚙️ Cómo Funciona el Optimizador

1. **Parser** detecta bloques de horario desde texto pegado
2. **Usuario asigna días** (L, M, W, J, V, S) a cada bloque
3. **Algoritmo** genera el producto cartesiano de todas las opciones
4. **Filtra** combinaciones con conflictos de horario
5. **Puntúa** cada combinación según:
   - Penalización por clases los sábados (-10000)
   - Bonus por no entrar temprano
   - Penalización por salir tarde
   - Penalización por ventanas entre clases
   - Bonus por consistencia de sección teórica
6. **Dedupica** y selecciona las 20 más diversas

---

*Desarrollado para optimizar la vida académica de los Sebastianos.*
