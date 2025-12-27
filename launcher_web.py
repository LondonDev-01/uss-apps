import os
import uuid
from datetime import datetime

import streamlit as st
from collections import defaultdict
import json
from src.auth.manager import AuthManager

# Configuración de página
st.set_page_config(page_title="UniHorario USS - Optimizador Inteligente", layout="wide", page_icon="📅")

# Inyectar CSS para estética Premium (Adaptativo Modo Claro/Oscuro)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');

    /* Variables adaptativas basadas en el tema de Streamlit */
    :root {
        --card-bg: var(--background-color);
        --card-border: rgba(128, 128, 128, 0.2);
    }

    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }
    
    .main-header {
        font-size: 2.5rem;
        color: #2563EB; /* Azul corporativo se mantiene bien en ambos */
        font-weight: 800;
        letter-spacing: -0.025em;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        color: var(--text-color);
        opacity: 0.7;
        font-size: 1.1rem;
        font-weight: 400;
        margin-bottom: 2rem;
    }
    .card {
        background: var(--secondary-background-color);
        padding: 1.2rem;
        border-radius: 12px;
        border: 1px solid var(--card-border);
        margin-bottom: 1rem;
        color: var(--text-color);
    }
    
    .cat-title {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.8rem;
    }

    /* Colores de categorías adaptados para que sean legibles en ambos modos */
    .cat-obligatorio { border-left: 6px solid #FDA4AF; padding-left: 15px; }
    .cat-adelantar { border-left: 6px solid #FDE047; padding-left: 15px; }
    .cat-electivo { border-left: 6px solid #86EFAC; padding-left: 15px; }

    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
    }
    
    /* Ajustes para la tabla de horario en modo oscuro */
    .schedule-grid {
        background-color: var(--secondary-background-color) !important;
        color: var(--text-color) !important;
    }
    .schedule-grid th {
        background-color: #2563EB !important;
    }
    .schedule-grid td {
        border: 1px solid var(--card-border) !important;
    }
</style>
""", unsafe_allow_html=True)

# Configuración de base de datos remota (mantener la existente si corresponde)
NEON_DB_URL = os.getenv('NEON_DB_URL', "postgresql://neondb_owner:npg_IhV8Zt4aoilr@ep-twilight-sound-adxqbeo9-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")

# Admin secret (proteger la vista administrativa). Defínelo en el entorno como ADMIN_SECRET.
ADMIN_SECRET = os.getenv('ADMIN_SECRET', None)

# Inicializar AuthManager en el state de Streamlit
if 'auth' not in st.session_state:
    st.session_state.auth = AuthManager(NEON_DB_URL)
# Asegurar parser y optimizer si el proyecto los incluye (evitar errores al renderizar UI)
if 'parser' not in st.session_state:
    try:
        from src.data.parser import ParserInteligente
        st.session_state.parser = ParserInteligente()
    except Exception:
        st.session_state.parser = None
if 'optimizer' not in st.session_state:
    try:
        from src.core.optimizer import OptimizadorReal
        st.session_state.optimizer = OptimizadorReal()
    except Exception:
        st.session_state.optimizer = None

# --- HEADER (LOGUEADO) ---
cols = st.columns([1, 0.2])
with cols[0]:
    st.markdown('<h1 class="main-header">📅 Generador de Horarios</h1>', unsafe_allow_html=True)
with cols[1]:
    if st.button(f"👤 {st.session_state.auth.current_user} (Salir)"):
        st.session_state.auth.logout()
        st.rerun()

st.markdown('<p class="sub-header">Paso 1: Ingreso de Ramos por Categoría</p>', unsafe_allow_html=True)

# --- NAVEGACIÓN POR TABS ---
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    " 1. Datos del Portal ", 
    " 2. Datos Procesados ", 
    " 3. Horario Optimizado ", 
    " 4. Exportar ", 
    " 5. Gestión JSON "
])

# --- TAB 1: DATOS DEL PORTAL ---
with tab1:
    st.markdown("### ⚙️ Preferencias de Horario")
    col_p1, col_p2, col_p3, col_p4 = st.columns(4)
    with col_p1: pref_no_temprano = st.checkbox("Priorizar NO Entrar Temprano", value=True)
    with col_p2: pref_no_tarde = st.checkbox("Priorizar NO Salir Tarde", value=True)
    with col_p3: pref_sin_ventanas = st.checkbox("Menos Ventanas", value=True)
    with col_p4: pref_sin_sabados = st.checkbox("Evitar clases los Sábados", value=True)

    st.markdown("---")
    st.markdown("### 📥 Método de Ingreso")
    
    modo_ingreso = st.radio("Selecciona el formato del texto que vas a pegar:", 
                            ["Auto", "Tabular (Portal/Excel)", "Visual (Guía PDF)", "JSON"], 
                            horizontal=True, help="Auto detecta el formato, pero puedes forzar uno si falla.")

    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown('<div class="card cat-obligatorio"><div class="cat-title">📘 Ramos principales</div></div>', unsafe_allow_html=True)
        t0 = st.text_area("Ramos principales (uno por línea)", height=250, key="txt_cat0", label_visibility="collapsed")

    with col2:
        st.markdown('<div class="card cat-adelantar"><div class="cat-title">☀️ Ramos para adelantar</div></div>', unsafe_allow_html=True)
        t1 = st.text_area("Ramos para adelantar (opcional)", height=250, key="txt_cat1", label_visibility="collapsed")

    with col3:
        st.markdown('<div class="card cat-electivo"><div class="cat-title">🍀 Electivos (si no lo tienes claro, elegimos uno al azar entre los que pongas)</div></div>', unsafe_allow_html=True)
        t2 = st.text_area("Electivos (se elegirá uno si no eliges)", height=250, key="txt_cat2", label_visibility="collapsed")

    col_btn1, col_btn2 = st.columns([1, 4])
    with col_btn1:
        if st.button("Limpiar Todo"):
            st.rerun()
    with col_btn2:
        if st.button("Procesar Todo e ir a Paso 2 ➜", type="primary", use_container_width=True):
            all_crudos = []
            # Mapeo de nombres de UI a parámetros de código
            map_modos = {"Auto": "Auto", "Tabular (Portal/Excel)": "Tabular", "Visual (Guía PDF)": "Visual", "JSON": "JSON"}
            m = map_modos[modo_ingreso]
            
            if t0.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t0, 0, modo=m))
            if t1.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t1, 1, modo=m))
            if t2.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t2, 2, modo=m))
            
            if all_crudos:
                st.session_state.horarios_crudos = all_crudos
                st.toast(f"Procesados {len(all_crudos)} bloques de horario.", icon="✅")
                
                # Sincronizar Almacén JSON
                ramos_por_titulo = defaultdict(list)
                for h in all_crudos:
                    d = {
                        "nrc": h.nrc, 
                        "tipo": h.tipo, 
                        "seccion": h.seccion, 
                        "dia": h.dia_parseado,
                        "hora": h.hora_str, 
                        "lugar": h.ubicacion
                    }
                    ramos_por_titulo[h.titulo].append(d)
                for titulo, secciones in ramos_por_titulo.items():
                    st.session_state.json_store[titulo] = {"curso": titulo, "secciones": secciones}
                
                # Auto-detección para Paso 2
                agrupados = st.session_state.parser.agrupar_por_nrc(all_crudos)
                for nrc, horarios in agrupados.items():
                    for idx, h in enumerate(horarios):
                        dia = h.dia_parseado or st.session_state.parser.calcular_dia_de_fecha(h.fecha_inicio)
                        if dia:
                            st.session_state.selecciones[f"{nrc}_{idx}"] = {'dia': dia, 'horario': h, 'nrc_original': nrc}
                st.info("Pasa a la pestaña '2. Datos Procesados'")
            else:
                st.error("No se detectaron datos válidos.")

# --- TAB 2: DATOS PROCESADOS ---
with tab2:
    st.markdown("### 💡 CÓMO FUNCIONA EL OPTIMIZADOR")
    st.info("Aquí debes asignar los días REALES a todos los cursos/secciones que te interesen. El Optimizador elegirá la mejor combinación automáticamente.")
    
    if not st.session_state.horarios_crudos:
        st.warning("Primero ingresa los datos en el Paso 1.")
    else:
        agrupados = st.session_state.parser.agrupar_por_nrc(st.session_state.horarios_crudos)
        
        # Eliminar un NRC
        def eliminar_ramo(nrc_to_del):
            st.session_state.horarios_crudos = [h for h in st.session_state.horarios_crudos if h.nrc != nrc_to_del]
            # Limpiar selecciones asociadas
            claves_del = [k for k in st.session_state.selecciones.keys() if k.startswith(f"{nrc_to_del}_")]
            for k in claves_del: del st.session_state.selecciones[k]
            st.toast(f"NRC {nrc_to_del} eliminado", icon="🗑️")
            st.rerun()

        for nrc, horarios in agrupados.items():
            p = horarios[0].prioridad
            cat_class = "cat-obligatorio" if p == 0 else ("cat-adelantar" if p == 1 else "cat-electivo")

            # Verificar si está configurado (todos los bloques tienen día)
            configurado = True
            for i in range(len(horarios)):
                if f"{nrc}_{i}" not in st.session_state.selecciones:
                    configurado = False
                    break
            
            status_text = "✅ Listo" if configurado else "🔴 Pendiente"
            status_color = "#10B981" if configurado else "#EF4444"

            with st.container():
                col_h, col_b = st.columns([5, 1])
                with col_h:
                    st.markdown(f'<div class="card {cat_class}"><b>{horarios[0].titulo}</b> (NRC: {nrc}) <span style="float:right; font-size:0.8rem; color:{status_color}; font-weight:bold;">{status_text}</span></div>', unsafe_allow_html=True)
                with col_b:
                    st.markdown("<br>", unsafe_allow_html=True)
                    if st.button("🗑️ Eliminar", key=f"del_{nrc}", help=f"Eliminar {horarios[0].titulo}", use_container_width=True):
                        eliminar_ramo(nrc)

                cols = st.columns(len(horarios))
                for i, h in enumerate(horarios):
                    with cols[i]:
                        clave = f"{nrc}_{i}"
                        current_dia = st.session_state.selecciones.get(clave, {}).get('dia', 'Seleccionar')
                        # Auto-detección si no está en selecciones
                        if current_dia == 'Seleccionar':
                            dia_auto = h.dia_parseado or st.session_state.parser.calcular_dia_de_fecha(h.fecha_inicio)
                            if dia_auto: current_dia = dia_auto
                        
                        nuevo_dia = st.selectbox(f"Asignar Día ({h.hora_str})", 
                                               ['Seleccionar', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                                               index=['Seleccionar', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].index(current_dia) if current_dia in ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] else 0,
                                               key=f"sel_{clave}")
                        
                        if nuevo_dia != 'Seleccionar':
                            st.session_state.selecciones[clave] = {'dia': nuevo_dia, 'horario': h, 'nrc_original': nrc}
                        elif clave in st.session_state.selecciones:
                            # Si vuelve a 'Seleccionar', borrarlo
                            del st.session_state.selecciones[clave]

        st.markdown(f"**{len(st.session_state.selecciones)} de {len(st.session_state.horarios_crudos)} bloques configurados**")

        if st.button("Optimizar Horario Automáticamente ➜", type="primary", use_container_width=True):
            with st.spinner("Buscando la mejor combinación..."):
                candidatos = st.session_state.optimizer.procesar_selecciones_usuario(st.session_state.selecciones)
                prefs = {
                    'no_temprano': pref_no_temprano, 'no_tarde': pref_no_tarde,
                    'sin_ventanas': pref_sin_ventanas, 'sin_sabados': pref_sin_sabados
                }
                # Aumentamos top_n a 20 para dar más opciones al usuario
                mejores, msg = st.session_state.optimizer.generar_top_horarios(candidatos, top_n=20, preferencias=prefs)
                st.session_state.mejores_horarios = mejores
                st.session_state.indice_horario = 0
                if mejores:
                    st.success(f"¡Horarios Generados! {msg}")
                    st.toast("Optimización Exitosa")
                else:
                    st.error(msg)

# --- TAB 3: HORARIO OPTIMIZADO ---
with tab3:
    if not st.session_state.mejores_horarios:
        st.info("Completa el paso 2 para ver tu horario aquí.")
    else:
        st.markdown(f"### Paso 3: Tu Horario Semanal")
        
        horario_actual = st.session_state.mejores_horarios[st.session_state.indice_horario]
        
        col_nav1, col_nav2, col_nav3 = st.columns([2, 1, 1])
        with col_nav1:
            st.markdown(f"**Viendo opción {st.session_state.indice_horario + 1} de {len(st.session_state.mejores_horarios)}**")
        with col_nav2:
            if st.button("🔄 Ver otra opción", use_container_width=True):
                st.session_state.indice_horario = (st.session_state.indice_horario + 1) % len(st.session_state.mejores_horarios)
                st.rerun()
        with col_nav3:
            if st.button("🗑️ REINICIAR TODO", type="secondary", use_container_width=True):
                st.session_state.horarios_crudos = []
                st.session_state.selecciones = {}
                st.session_state.mejores_horarios = []
                st.session_state.json_store = {}
                st.session_state.indice_horario = 0
                st.rerun()

        col_main, col_sidebar = st.columns([3.5, 1])
        
        # --- GRILLA VISUAL ESTILO EXCEL ---
        with col_main:
            dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
            horas = [f"{h:02d}:00" for h in range(8, 22)]
            
            # Mapa de colores para la grilla
            colores_palette = ["#BFDBFE", "#BBF7D0", "#FEF3C7", "#FECACA", "#DDD6FE", "#F5D0FE", "#FED7AA", "#E9D5FF"]
            
            def hex_to_rgb(h: str):
                h = h.lstrip('#')
                return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

            def rgb_to_hex(rgb):
                return '#%02x%02x%02x' % (max(0, min(255, int(rgb[0]))), max(0, min(255, int(rgb[1]))), max(0, min(255, int(rgb[2]))))

            def adjust_brightness(hexcol: str, factor: float):
                r, g, b = hex_to_rgb(hexcol)
                return rgb_to_hex((r * factor, g * factor, b * factor))

            title_base = {}
            nrc_colors = {}
            
            # Asignar color base por título
            for h in horario_actual:
                if h.titulo not in title_base:
                    title_base[h.titulo] = colores_palette[len(title_base) % len(colores_palette)]

            # Asignar color por NRC basado en tipo (TEO claro, LAB oscuro)
            for h in horario_actual:
                if h.nrc not in nrc_colors:
                    base = title_base.get(h.titulo, colores_palette[0])
                    tipo_up = (h.tipo or '').upper()
                    tipo_norm = 'TEO' if ('TEOR' in tipo_up or 'TEO' in tipo_up) else 'LAB' if ('LAB' in tipo_up or 'TALLER' in tipo_up or 'PRACT' in tipo_up) else 'OTRO'
                    
                    if tipo_norm == 'TEO':
                        nrc_colors[h.nrc] = adjust_brightness(base, 1.15) # Un poco menos agresivo que desktop para web
                    elif tipo_norm == 'LAB':
                        nrc_colors[h.nrc] = adjust_brightness(base, 0.85)
                    else:
                        nrc_colors[h.nrc] = base

            # Renderizar Grilla HTML
            html_grid = f"""
            <div style="overflow-x: auto;">
                <table class="schedule-grid" style="width: 100%; border-collapse: collapse; font-family: 'Outfit', sans-serif; background: transparent;">
                    <thead>
                        <tr>
                            <th style="padding: 8px; width: 60px;">Hora</th>
                            {''.join([f'<th style="padding: 8px; min-width: 100px;">{d}</th>' for d in dias])}
                        </tr>
                    </thead>
                    <tbody>
            """
            
            for h_str in horas:
                html_grid += f"<tr><td style='border: 1px solid #E2E8F0; padding: 8px; font-weight: 600; background: #F8FAFC; text-align: center;'>{h_str}</td>"
                for d in dias:
                    clase_en_slot = None
                    h_num = int(h_str.split(':')[0])
                    for c in horario_actual:
                        if c.dia == d:
                            c_h_ini = int(c.hora_inicio.split(':')[0])
                            c_h_fin = int(c.hora_fin.split(':')[0])
                            if c_h_ini <= h_num < c_h_fin + (1 if int(c.hora_fin.split(':')[1]) > 0 else 0):
                                clase_en_slot = c
                                break
                    
                    if clase_en_slot:
                        color = nrc_colors.get(clase_en_slot.nrc, "#CBD5E1")
                        html_grid += f"<td style='padding: 6px; background-color: {color}; color: #1E293B; vertical-align: top;'>"
                        html_grid += f"<div style='font-weight: 700; line-height: 1.1;'>{clase_en_slot.titulo}</div>"
                        html_grid += f"<div style='font-size: 0.7rem; margin-top: 2px;'>{clase_en_slot.nrc}</div>"
                        html_grid += f"<div style='font-size: 0.7rem;'>{clase_en_slot.hora_inicio}-{clase_en_slot.hora_fin}</div>"
                        html_grid += "</td>"
                    else:
                        html_grid += "<td></td>"
                html_grid += "</tr>"
            
            html_grid += "</tbody></table></div>"
            st.markdown(html_grid, unsafe_allow_html=True)

        # --- LEYENDA DE RAMOS (SIDEBAR-LIKE) ---
        with col_sidebar:
            st.markdown("<div style='background: white; padding: 15px; border-radius: 10px; border: 1px solid #E2E8F0;'>", unsafe_allow_html=True)
            st.markdown("#### Leyenda de Ramos")
            
            # Obtener ramos únicos en el horario actual
            ramos_vistos = {}
            for h in horario_actual:
                if h.nrc not in ramos_vistos:
                    ramos_vistos[h.nrc] = {'titulo': h.titulo, 'tipo': h.tipo}
            
            for nrc, info in ramos_vistos.items():
                color = nrc_colors.get(nrc, "#CBD5E1")
                tipo_up = (info['tipo'] or '').upper()
                tipo_norm = 'TEO' if ('TEOR' in tipo_up or 'TEO' in tipo_up) else 'LAB' if ('LAB' in tipo_up or 'TALLER' in tipo_up or 'PRACT' in tipo_up) else 'OTRO'
                st.markdown(f"""
                <div style="display: flex; align-items: start; margin-bottom: 12px;">
                    <div style="width: 15px; height: 15px; background: {color}; border-radius: 3px; margin-top: 4px; margin-right: 10px; flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 0.85rem; font-weight: 600; line-height: 1.2;">{info['titulo']}</div>
                        <div style="font-size: 0.75rem; color: #64748B;">{tipo_norm} | NRC: {nrc}</div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("Exportar ➜", type="secondary", use_container_width=True):
                # Saltar a la pestaña 4 programáticamente no es fácil en tabs, 
                # pero podemos poner un aviso o disparar la descarga aquí
                st.toast("Dirígete a la pestaña 'Exportar' para descargar el Excel")

# --- TAB 4: EXPORTAR ---
with tab4:
    if not st.session_state.mejores_horarios:
        st.info("Genera un horario primero.")
    else:
        st.markdown("### Paso 4: Exportar Resultado")
        
        col_exp1, col_exp2 = st.columns(2)
        
        with col_exp1:
            st.markdown("#### 📊 Formato Excel")
            st.write("Ideal para imprimir o compartir.")
            filename = f"Horario_Opcion_{st.session_state.indice_horario + 1}.xlsx"
            if st.button("Generar Archivo Excel", type="primary", use_container_width=True):
                with st.spinner("Generando archivo..."):
                    from src.data.excel_exporter import ExcelExporter
                    ExcelExporter.exportar(st.session_state.mejores_horarios[st.session_state.indice_horario], filename)
                    with open(filename, "rb") as f:
                        st.download_button("⬇️ DESCARGAR EXCEL AHORA", f, file_name=filename, mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
        
        with col_exp2:
            st.markdown("#### 📄 Formato JSON")
            st.write("Copia este JSON para respaldar o importar tu horario.")
            
            # Construir JSON del horario actual
            horario_actual = st.session_state.mejores_horarios[st.session_state.indice_horario]
            data_export = []
            for c in horario_actual:
                data_export.append({
                    "nrc": c.nrc,
                    "titulo": c.titulo,
                    "tipo": c.tipo,
                    "seccion": c.seccion,
                    "dia": c.dia,
                    "hora": f"{c.hora_inicio} - {c.hora_fin}",
                    "lugar": f"{c.edificio} {c.salon}"
                })
            
            json_str = json.dumps(data_export, indent=4, ensure_ascii=False)
            st.code(json_str, language="json")
            st.download_button("⬇️ Descargar como archivo .json", json_str, file_name=f"Horario_Opcion_{st.session_state.indice_horario + 1}.json", mime="application/json", use_container_width=True)

# --- TAB 5: GESTIÓN JSON ---
with tab5:
    st.markdown("### Paso 5: Almacén de Datos JSON")
    st.info("Aquí puedes ver y respaldar los datos consolidados de todos tus ramos.")
    if not st.session_state.json_store:
        st.warning("No hay ramos guardados en la memoria actual.")
    else:
        for titulo, data in st.session_state.json_store.items():
            with st.expander(f"📦 Asignatura: {titulo}"):
                json_text = json.dumps(data, indent=4, ensure_ascii=False)
                st.code(json_text, language="json")
                st.button(f"📋 Copiar JSON de {titulo}", on_click=lambda t=json_text: st.write(f"Copiado al portapapeles (Simulado): {t[:20]}..."), key=f"copy_{titulo}")
        
        full_json = json.dumps(list(st.session_state.json_store.values()), indent=4, ensure_ascii=False)
        st.download_button("💾 Exportar Base de Datos Completa (JSON)", full_json, file_name="almacen_ramos_completo.json", mime="application/json")

# --- BLOQUE DE AUTENTICACIÓN SIMPLE (encima de las pestañas) ---
def get_user_info(username: str):
    """Retorna un dict con info básica del usuario o None si no existe."""
    if not username:
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(NEON_DB_URL)
        cur = conn.cursor()
        cur.execute('SELECT id, username, is_active, expires_at, telefono FROM usuarios WHERE username = %s', (username,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return None
        return {'id': row[0], 'username': row[1], 'is_active': row[2], 'expires_at': row[3], 'telefono': row[4]}
    except Exception:
        return None

if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False

with st.container():
    st.markdown('### Acceso / Registro')
    with st.form('auth_form'):
        form_user = st.text_input('Usuario')
        form_pass = st.text_input('Contraseña', type='password')
        device_id = st.text_input('device_id (identifica equipo)', value=str(uuid.uuid4())[:12])
        col_a, col_b = st.columns(2)
        with col_a:
            btn_enter = st.form_submit_button('Entrar')
        with col_b:
            btn_create = st.form_submit_button('Crear Cuenta')

    if btn_create:
        ok, msg = st.session_state.auth.register(form_user, form_pass)
        if ok:
            st.success(msg + ' Espera a que el admin active la cuenta o establece migrate_pass_hash.')
        else:
            st.error(msg)

    if btn_enter:
        ok, msg = st.session_state.auth.login(form_user, form_pass, device_id=device_id)
        if ok:
            st.session_state.logged_in = True
            st.success(msg)
        else:
            st.error(msg)
            # Si el problema es que la cuenta no está activada, mostrar input para migrate_pass_hash
            if 'no activada' in (msg or '').lower():
                st.info('Tu cuenta existe pero no está activada. Pega el migrate_pass_hash que el admin te dio para activarla:')
                mig_hash = st.text_input('migrate_pass_hash para activar cuenta')
                if mig_hash and st.button('Aplicar migrate_pass_hash'):
                    ok2, msg2 = st.session_state.auth.apply_license(form_user, mig_hash)
                    if ok2:
                        st.success(msg2)
                    else:
                        st.error(msg2)

# --- ADMIN CONSOLE (PROTECTED) ---
st.markdown("---")
st.subheader("Consola Administrativa (Protegida)")
admin_pw = st.text_input("Clave Admin", type="password", help="Clave para acceder a la consola administrativa (definir ADMIN_SECRET en entorno)")
show_admin = False
if ADMIN_SECRET is None:
    st.warning("ADMIN_SECRET no está definido en variable de entorno. Define ADMIN_SECRET para proteger la consola. Mientras tanto, la consola estará oculta.")
else:
    if admin_pw:
        if admin_pw == ADMIN_SECRET:
            show_admin = True
        else:
            st.error("Clave admin incorrecta")

if show_admin:
    st.success("Acceso admin concedido")
    st.markdown("#### Usuarios registrados (puedes regenerar el migrate_pass_hash)")
    # Mostrar usuarios desde la DB en crudo (id, username, is_active, expires_at, telefono, migrate_pass_hash)
    import psycopg2
    try:
        conn = psycopg2.connect(NEON_DB_URL)
        cur = conn.cursor()
        cur.execute('SELECT id, username, is_active, expires_at, telefono, migrate_pass_hash FROM usuarios ORDER BY id DESC')
        rows = cur.fetchall()
        if not rows:
            st.info('No hay usuarios registrados aún.')
        else:
            for r in rows:
                uid, uname, is_active, expires_at, telefono, mig_hash = r
                with st.expander(f'[{uid}] {uname} - activo={is_active}'):
                    st.write('Telefono:', telefono)
                    st.write('expires_at:', expires_at)
                    st.write('migrate_pass_hash (hash que debes copiar y dar al cliente):')
                    st.code(mig_hash or '<no hash>')
                    cols = st.columns([1,1,1])
                    if cols[0].button('Regenerar migrate_pass_hash', key=f'reg_{uid}'):
                        newh = st.session_state.auth.regenerate_migrate_hash(uname)
                        if newh:
                            st.success('Nuevo HASH generado y almacenado. Cópialo y envíaselo al cliente:')
                            st.code(newh)
                            st.experimental_rerun()
                        else:
                            st.error('No se pudo generar hash')
                    if cols[1].button('Activar cuenta', key=f'act_{uid}'):
                        try:
                            cur2 = conn.cursor()
                            cur2.execute('UPDATE usuarios SET is_active = TRUE WHERE username = %s', (uname,))
                            conn.commit()
                            cur2.close()
                            st.success('Cuenta activada')
                            st.experimental_rerun()
                        except Exception as e:
                            st.error(f'Error activando: {e}')
                    if cols[2].button('Eliminar usuario', key=f'del_{uid}'):
                        try:
                            cur3 = conn.cursor()
                            cur3.execute('DELETE FROM usuarios WHERE username = %s', (uname,))
                            conn.commit()
                            cur3.close()
                            st.success('Usuario eliminado')
                            st.experimental_rerun()
                        except Exception as e:
                            st.error(f'Error eliminando: {e}')
                cur.close(); conn.close()
    except Exception as e:
        st.error('Error conectando a la DB: ' + str(e))

st.markdown('\n---\n')
st.caption("Flujo: el cliente crea cuenta; el admin (tú) entra a esta página, ve la columna migrate_pass_hash y copia la clave para dársela al cliente cuando pida migración entre equipos.")
