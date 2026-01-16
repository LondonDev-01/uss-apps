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
- **Copiado Directo**: Pega tus ramos directamente desde el portal USS sin preocuparte por el formato. Soporta múltiples líneas y datos crudos.
- **Sincronización TEO/LAB**: Manejo automático de bloques teóricos y laboratorios ligados (Ligas y Conectores).
- **Detección de Días**: Soporta múltiples formatos de abreviación de días usados en la universidad.

### 🖥️ Plataformas Disponibles (Proyecto Fullstack)
- **Aplicación Desktop**: Interfaz profesional en Tkinter/CustomTkinter, ideal para uso personal rápido y offline (utilizando el ejecutable `.exe`).
- **Plataforma Web**: Versión moderna en Streamlit con soporte para modo oscuro adaptativo.
- **Frontend Moderno**: Proyecto complementario en **Vite + React + TypeScript** para el ecosistema web.

---

## 🔑 Credenciales de Prueba (Test Account)

Para probar la plataforma (Web o Desktop), utiliza las siguientes credenciales de invitado:

- **Usuario:** `invitado`
- **Contraseña:** `1234invitado`

---

## 🧪 Datos de Prueba (Copiar y Pegar)

Puedes usar el siguiente bloque de texto para probar el **Parser Inteligente** de la aplicación. Solo cópialo y pégalo en el área de entrada de ramos:

```text
13851	ICIF	G002	T01	TEO	SISTEMAS OPERATIVOS	T1	L1	50	02-03-2026	11-07-2026	F408	1440	1600					F			177564524	LUCIANO	RADRIGAN/FIGUEROA
13852	ICIF	G002	T50	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F309	0800	0920				R				177564524	LUCIANO	RADRIGAN/FIGUEROA
13852	ICIF	G002	T50	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F309	0930	1050				R				177564524	LUCIANO	RADRIGAN/FIGUEROA
23281	ICIF	G002	T51	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F301	0800	0920						S		177564524	LUCIANO	RADRIGAN/FIGUEROA
23281	ICIF	G002	T51	LAB	SISTEMAS OPERATIVOS	L1	T1	25	02-03-2026	11-07-2026	F301	0930	1050						S		177564524	LUCIANO	RADRIGAN/FIGUEROA
13853	ICIF	G003	T50	LAB	APLICAC. Y TECNOL. DE LA WEB			30	02-03-2026	11-07-2026	F301	0800	0920			W					129205016	LEONARDO	HERNANDEZ/VERA
13853	ICIF	G003	T50	LAB	APLICAC. Y TECNOL. DE LA WEB			30	02-03-2026	11-07-2026	F309	0800	0920		T						129205016	LEONARDO	HERNANDEZ/VERA
13853	ICIF	G003	T50	LAB	APLICAC. Y TECNOL. DE LA WEB			30	02-03-2026	11-07-2026	F309	0930	1050		T						129205016	LEONARDO	HERNANDEZ/VERA
13854	ICIF	G003	T51	LAB	APLICAC. Y TECNOL. DE LA WEB			25	02-03-2026	11-07-2026	F303	0930	1050			W					129205016	LEONARDO	HERNANDEZ/VERA
13854	ICIF	G003	T51	LAB	APLICAC. Y TECNOL. DE LA WEB			25	02-03-2026	11-07-2026	F309	0800	0920					F			129205016	LEONARDO	HERNANDEZ/VERA
13854	ICIF	G003	T51	LAB	APLICAC. Y TECNOL. DE LA WEB			25	02-03-2026	11-07-2026	F309	0930	1050					F			129205016	LEONARDO	HERNANDEZ/VERA
13855	ICIF	G004	T01	TEO	TALLER  INTERFA. Y DIS. SOFTW	T1	L1	45	02-03-2026	11-07-2026	F408	1735	1855			W					117943747	SILVIA	REYES/QUEZADA/
13855	ICIF	G004	T01	TEO	TALLER  INTERFA. Y DIS. SOFTW	T1	L1	45	02-03-2026	11-07-2026	F408	1900	2020			W					117943747	SILVIA	REYES/QUEZADA/
13867	ICIF	G004	T50	LAB	TALLER  INTERFA. Y DIS. SOFTW	L1	T1	25	02-03-2026	11-07-2026	F303	1100	1220	M							231319948	ELIZABETH	CHICATA/CASTRO
23282	ICIF	G004	T51	LAB	TALLER  INTERFA. Y DIS. SOFTW	L1	T1	20	02-03-2026	11-07-2026	F309	1311	1431	M							231319948	ELIZABETH	CHICATA/CASTRO
24282	FORI	0001	T47	TEO	ANTROPOLOGIA			60	02-03-2026	11-07-2026	C502	1610	1730					F			104472192	SANDRA	GAJARDO/SALDÍAS
24282	FORI	0001	T47	TEO	ANTROPOLOGIA			60	02-03-2026	11-07-2026	C509	1311	1431			W					104472192	SANDRA	GAJARDO/SALDÍAS
13856	ICIF	G005	T50	LAB	INGLES DE ESPECIALIDAD			20	02-03-2026	11-07-2026	F408	1440	1600				R				163488124	FELIPE	BENAVENTE/ULLOA
13856	ICIF	G005	T50	LAB	INGLES DE ESPECIALIDAD			20	02-03-2026	11-07-2026	F503	1311	1431		T						163488124	FELIPE	BENAVENTE/ULLOA
23283	ICIF	G005	T51	LAB	INGLES DE ESPECIALIDAD			20	02-03-2026	11-07-2026	F408	1311	1431				R				163488124	FELIPE	BENAVENTE/ULLOA
23283	ICIF	G005	T51	LAB	INGLES DE ESPECIALIDAD			20	02-03-2026	11-07-2026	F408	1440	1600		T						163488124	FELIPE	BENAVENTE/ULLOA
23288	ICIF	I004	T01	TEO	MINERIA DE DATOS Y BIG DATA	T1	L1	28	02-03-2026	11-07-2026	B410	1735	1855				R				18107163K	BLAS	MARDONES/ZAMBRANO/
23288	ICIF	I004	T01	TEO	MINERIA DE DATOS Y BIG DATA	T1	L1	28	02-03-2026	11-07-2026	B410	1900	2020				R				18107163K	BLAS	MARDONES/ZAMBRANO/
23289	ICIF	I004	T50	LAB	MINERIA DE DATOS Y BIG DATA	L1	T1	28	02-03-2026	11-07-2026	F309	1100	1220		T						231319948	ELIZABETH	CHICATA/CASTRO
23289	ICIF	I004	T50	LAB	MINERIA DE DATOS Y BIG DATA	L1	T1	28	02-03-2026	11-07-2026	F309	1440	1600	M							231319948	ELIZABETH	CHICATA/CASTRO
23289	ICIF	I004	T50	LAB	MINERIA DE DATOS Y BIG DATA	L1	T1	28	02-03-2026	11-07-2026	F309	1610	1730	M							231319948	ELIZABETH	CHICATA/CASTRO
14492	ICIF	1042	T01	TEO	TALLER SOFTWARE DATA SCIENCE	T1	L1	40	02-03-2026	11-07-2026	VC302	1735	1855					F			231319948	ELIZABETH	CHICATA/CASTRO
14493	ICIF	1042	T50	LAB	TALLER SOFTWARE DATA SCIENCE	L1	T1	40	02-03-2026	11-07-2026	VC302	1900	2020					F			231319948	ELIZABETH	CHICATA/CASTRO
23917	ICIF	1039	T01	TEO	SISTEMAS DE CLASE MUNDIAL	T1	L1	40	02-03-2026	11-07-2026	VA301	1100	1220					F			13034349K	HUGO	GUTIERREZ/FIGUEROA
23918	ICIF	1039	T50	LAB	SISTEMAS DE CLASE MUNDIAL	L1	T1	40	02-03-2026	11-07-2026	VA301	1310	1430					F			13034349K	HUGO	GUTIERREZ/FIGUEROA
```

---

## 🏗️ Arquitectura del Proyecto

Estructurado bajo estándares de **Arquitectura Limpia**:

```bash
src/
├── core/       # CEREBRO: Lógica de optimización y combinatoria.
├── data/       # DATOS: Parsers de texto USS y generadores (.xlsx).
├── auth/       # SEGURIDAD: Gestión de licencias y conexión a DB Neon.
└── assets/     # Recursos visuales.
frontend/       # MODERNO: Interfaz en React + Vite + TypeScript.
```

---

## 🚀 Inicio Rápido

1. **Clonar**: `git clone https://github.com/tu-usuario/unihorario-uss.git`
2. **Dependencias**: `pip install -r requirements.txt`
3. **Ejecutar**:
   - Escritorio: `python launcher_desktop.py`
   - Web: `streamlit run launcher_web.py`

### Módulo Frontend (Vite + React)

- **Instalación:** `cd frontend && pnpm install`
- **Desarrollo:** `pnpm dev`
- **Build:** `pnpm build`

---

## 💼 Enfoque Comercial y Seguridad
- **Distribución:** Preparado para empaquetado **.EXE** mediante PyInstaller.
- **Base de Datos:** Integración con **PostgreSQL (Neon)**.
- **Seguridad:** Hashes SHA-256 para protección de accesos.

---
*Desarrollado para optimizar la vida académica de los Sebastianos.*

---
**Nota Técnica:** La herramienta de administración local fue eliminada; las operaciones deben realizarse desde la consola de Neon.

## 🌟 Características Principales

### 🧠 Motor de Optimización Localizado
- **USS Ready**: Adaptado para procesar el formato de datos del portal de la Universidad San Sebastián.
- **Diversidad de Opciones**: El algoritmo filtra horarios casi idénticos para ofrecerte 20 alternativas que realmente cambian tu semana.
- **Prioridades Personalizadas**: Decide si prefieres entrar tarde, salir temprano, evitar ventanas o no tener clases los sábados.

### 📂 Extracción Inteligente de Datos
- **Copiado Directo**: Pega tus ramos directamente desde el portal USS sin preocuparte por el formato. Soporta múltiples líneas y datos crudos.
- **Sincronización TEO/LAB**: Manejo automático de bloques teóricos y laboratorios ligados (Ligas y Conectores).
- **Detección de Días**: Soporta múltiples formatos de abreviación de días usados en la universidad.

### 🖥️ Plataformas Disponibles (Proyecto Fullstack)
- **Aplicación Desktop**: Interfaz profesional en Tkinter/CustomTkinter, ideal para uso personal rápido y offline (utilizando el ejecutable `.exe`).
- **Plataforma Web**: Versión moderna en Streamlit con soporte para modo oscuro adaptativo.
- **Frontend Moderno**: Proyecto complementario en **Vite + React + TypeScript** para el ecosistema web.

---

## 🔑 Credenciales de Prueba (Test Account)

Para evaluar las funcionalidades en cualquiera de las plataformas, utiliza las siguientes credenciales de invitado:

- **Usuario:** `invitado`
- **Contraseña:** `1234invitado`

---

## 🧪 Datos de Prueba (Copiar y Pegar)

Puedes usar el siguiente bloque de texto para probar el **Parser Inteligente** de la aplicación. Solo cópialo y pégalo en el área de entrada de ramos:

```text
13851ICIFG002T01TEOSISTEMAS OPERATIVOST1L15002-03-202611-07-2026F40814401600F177564524LUCIANORADRIGAN/FIGUEROA
13852ICIFG002T50LABSISTEMAS OPERATIVOSL1T12502-03-202611-07-2026F30908000920R177564524LUCIANORADRIGAN/FIGUEROA
13852ICIFG002T50LABSISTEMAS OPERATIVOSL1T12502-03-202611-07-2026F30909301050R177564524LUCIANORADRIGAN/FIGUEROA
23281ICIFG002T51LABSISTEMAS OPERATIVOSL1T12502-03-202611-07-2026F30108000920S177564524LUCIANORADRIGAN/FIGUEROA
23281ICIFG002T51LABSISTEMAS OPERATIVOSL1T12502-03-202611-07-2026F30109301050S177564524LUCIANORADRIGAN/FIGUEROA
13853ICIFG003T50LABAPLICAC. Y TECNOL. DE LA WEB3002-03-202611-07-2026F30108000920W129205016LEONARDOHERNANDEZ/VERA
13853ICIFG003T50LABAPLICAC. Y TECNOL. DE LA WEB3002-03-202611-07-2026F30908000920T129205016LEONARDOHERNANDEZ/VERA
13853ICIFG003T50LABAPLICAC. Y TECNOL. DE LA WEB3002-03-202611-07-2026F30909301050T129205016LEONARDOHERNANDEZ/VERA
13854ICIFG003T51LABAPLICAC. Y TECNOL. DE LA WEB2502-03-202611-07-2026F30309301050W129205016LEONARDOHERNANDEZ/VERA
13854ICIFG003T51LABAPLICAC. Y TECNOL. DE LA WEB2502-03-202611-07-2026F30908000920F129205016LEONARDOHERNANDEZ/VERA
13854ICIFG003T51LABAPLICAC. Y TECNOL. DE LA WEB2502-03-202611-07-2026F30909301050F129205016LEONARDOHERNANDEZ/VERA
13855ICIFG004T01TEOTALLER  INTERFA. Y DIS. SOFTWT1L14502-03-202611-07-2026F40817351855W117943747SILVIAREYES/QUEZADA/
13855ICIFG004T01TEOTALLER  INTERFA. Y DIS. SOFTWT1L14502-03-202611-07-2026F40819002020W117943747SILVIAREYES/QUEZADA/
13867ICIFG004T50LABTALLER  INTERFA. Y DIS. SOFTWL1T12502-03-202611-07-2026F30311001220M231319948ELIZABETHCHICATA/CASTRO
23282ICIFG004T51LABTALLER  INTERFA. Y DIS. SOFTWL1T12002-03-202611-07-2026F30913111431M231319948ELIZABETHCHICATA/CASTRO
24282FORI0001T47TEOANTROPOLOGIA6002-03-202611-07-2026C50216101730F104472192SANDRAGAJARDO/SALDÍAS
24282FORI0001T47TEOANTROPOLOGIA6002-03-202611-07-2026C50913111431W104472192SANDRAGAJARDO/SALDÍAS
13856ICIFG005T50LABINGLES DE ESPECIALIDAD2002-03-202611-07-2026F40814401600R163488124FELIPEBENAVENTE/ULLOA
13856ICIFG005T50LABINGLES DE ESPECIALIDAD2002-03-202611-07-2026F50313111431T163488124FELIPEBENAVENTE/ULLOA
23283ICIFG005T51LABINGLES DE ESPECIALIDAD2002-03-202611-07-2026F40813111431R163488124FELIPEBENAVENTE/ULLOA
23283ICIFG005T51LABINGLES DE ESPECIALIDAD2002-03-202611-07-2026F40814401600T163488124FELIPEBENAVENTE/ULLOA
23288ICIFI004T01TEOMINERIA DE DATOS Y BIG DATAT1L12802-03-202611-07-2026B41017351855R18107163KBLASMARDONES/ZAMBRANO/
23288ICIFI004T01TEOMINERIA DE DATOS Y BIG DATAT1L12802-03-202611-07-2026B41019002020R18107163KBLASMARDONES/ZAMBRANO/
23289ICIFI004T50LABMINERIA DE DATOS Y BIG DATAL1T12802-03-202611-07-2026F30911001220T231319948ELIZABETHCHICATA/CASTRO
23289ICIFI004T50LABMINERIA DE DATOS Y BIG DATAL1T12802-03-202611-07-2026F30914401600M231319948ELIZABETHCHICATA/CASTRO
23289ICIFI004T50LABMINERIA DE DATOS Y BIG DATAL1T12802-03-202611-07-2026F30916101730M231319948ELIZABETHCHICATA/CASTRO
14492ICIF1042T01TEOTALLER SOFTWARE DATA SCIENCET1L14002-03-202611-07-2026VC30217351855F231319948ELIZABETHCHICATA/CASTRO
14493ICIF1042T50LABTALLER SOFTWARE DATA SCIENCEL1T14002-03-202611-07-2026VC30219002020F231319948ELIZABETHCHICATA/CASTRO
23917ICIF1039T01TEOSISTEMAS DE CLASE MUNDIALT1L14002-03-202611-07-2026VA30111001220F13034349KHUGOGUTIERREZ/FIGUEROA
23918ICIF1039T50LABSISTEMAS DE CLASE MUNDIALL1T14002-03-202611-07-2026VA30113101430F13034349KHUGOGUTIERREZ/FIGUEROA
```

---

## 🏗️ Arquitectura del Proyecto

Estructurado bajo estándares de **Arquitectura Limpia**:

```bash
src/
├── core/       # CEREBRO: Lógica de optimización y combinatoria.
├── data/       # DATOS: Parsers de texto USS y generadores (.xlsx).
├── auth/       # SEGURIDAD: Gestión de licencias y conexión a DB Neon.
└── assets/     # Recursos visuales.
frontend/       # MODERNO: Interfaz en React + Vite + TypeScript.
```

---

## 🚀 Inicio Rápido

1. **Clonar**: `git clone https://github.com/tu-usuario/unihorario-uss.git`
2. **Dependencias**: `pip install -r requirements.txt`
3. **Ejecutar**:
   - Escritorio: `python launcher_desktop.py`
   - Web: `streamlit run launcher_web.py`

### Módulo Frontend (Vite + React)

- **Instalación:** `cd frontend && pnpm install`
- **Desarrollo:** `pnpm dev`
- **Build:** `pnpm build`

---

## 💼 Enfoque Comercial y Seguridad
- **Distribución:** Preparado para empaquetado **.EXE** mediante PyInstaller.
- **Base de Datos:** Integración con **PostgreSQL (Neon)**.
- **Seguridad:** Hashes SHA-256 para protección de accesos.

---
*Desarrollado para optimizar la vida académica de los Sebastianos.*

---
**Nota Técnica:** La herramienta de administración local fue eliminada; las operaciones deben realizarse desde la consola de Neon.
