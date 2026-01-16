import os
import uuid
from datetime import datetime

import streamlit as st
from collections import defaultdict
import json
from src.auth.manager import AuthManager

# Configuración de página
st.set_page_config(page_title="UniHorario USS - Optimizador Inteligente", layout="wide")

# Inicializar claves de session_state de forma temprana para evitar AttributeError
early_defaults = {
    'horarios_crudos': [],
    'selecciones': {},
    'mejores_horarios': [],
    'indice_horario': 0,
    'json_store': {},
    'mapa_colores_actual': {},
    'logged_in': False,
    # Preferencias de usuario usadas por el optimizador
    'pref_no_temprano': True,
    'pref_no_tarde': True,
    'pref_sin_ventanas': True,
    'pref_sin_sabados': True,
    '_rerun_trigger': 0
}
for k, v in early_defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# Configuración de base de datos remota (mantener la existente si corresponde)
NEON_DB_URL = os.getenv('NEON_DB_URL', "postgresql://neondb_owner:npg_IhV8Zt4aoilr@ep-twilight-sound-adxqbeo9-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")

# Admin secret
ADMIN_SECRET = os.getenv('ADMIN_SECRET', None)
# Contacto para migración (paridad con desktop)
LICENSE_MIGRATION_CONTACT = os.getenv('LICENSE_MIGRATION_CONTACT', 'admin')

# Inicializar AuthManager de forma temprana para que el bloque de login pueda usarlo
if 'auth' not in st.session_state:
    try:
        st.session_state.auth = AuthManager(NEON_DB_URL)
    except Exception:
        # en entornos sin DB, dejar un placeholder que falle de forma controlada
        st.session_state.auth = type('StubAuth', (), {'register': lambda *a, **k: (False, 'Auth no disponible'), 'login': lambda *a, **k: (False, 'Auth no disponible'), 'apply_license_and_activate': lambda *a, **k: (False, 'Auth no disponible')})()

# --- BLOQUE DE AUTENTICACIÓN (mostrar ANTES de cualquier otra cosa) ---
def _render_login_block():
    # Asegurar que exista un objeto auth en session_state (por seguridad en reruns)
    if 'auth' not in st.session_state:
        try:
            st.session_state.auth = AuthManager(NEON_DB_URL)
        except Exception:
            st.session_state.auth = type('StubAuth', (), {'register': lambda *a, **k: (False, 'Auth no disponible'), 'login': lambda *a, **k: (False, 'Auth no disponible'), 'apply_license_and_activate': lambda *a, **k: (False, 'Auth no disponible')})()

    # Toggle between Login and Register using a clear radio selector
    if 'auth_mode' not in st.session_state:
        st.session_state.auth_mode = 'Entrar'

    st.markdown('### Acceso / Registro')
    mode = st.radio('Modo', ['Entrar', 'Crear Cuenta'], index=0 if st.session_state.auth_mode == 'Entrar' else 1, horizontal=True, key='auth_mode_radio', label_visibility='collapsed')
    st.session_state.auth_mode = mode

    if mode == 'Entrar':
        with st.form('auth_form'):
            form_user = st.text_input('Usuario')
            form_pass = st.text_input('Contraseña', type='password')
            submitted = st.form_submit_button('Entrar')

        if submitted:
            device_id = str(uuid.uuid4())[:12]
            ok, msg = st.session_state.auth.login(form_user, form_pass, device_id=device_id)
            if ok:
                st.session_state.logged_in = True
                st.session_state.auth.is_authenticated = True
                st.session_state.auth.current_user = form_user
                st.success(msg)
                # Try to trigger a rerun; Streamlit may not expose experimental_rerun in all versions
                try:
                    rerun_fn = getattr(st, 'experimental_rerun', None)
                    if callable(rerun_fn):
                        rerun_fn()
                    else:
                        # Fallback: toggle a session key to force a rerun on some Streamlit versions
                        st.session_state['_rerun_trigger'] = st.session_state.get('_rerun_trigger', 0) + 1
                except Exception:
                    pass
            else:
                st.error(msg)
                lowered = (msg or '').lower()
                if 'no activada' in lowered or 'no activado' in lowered or 'pendiente' in lowered:
                    st.info("Tu cuenta existe pero no está activada. Pídele al administrador que marque la cuenta como activa en la base de datos (cambiar `is_active` a TRUE). Una vez hecho esto, podrás iniciar sesión normalmente.")
                elif '2 dispositivos' in lowered or '2 dispositivo' in lowered or 'ya fue ingresada anteriormente' in lowered:
                    st.info("La cuenta ya tiene 2 dispositivos activos. Contacta al administrador para liberar una sesión o activar este equipo.")

        st.markdown("---")
        if st.button("Continuar sin cuenta (Invitado) ➜", use_container_width=True):
            st.session_state.logged_in = True
            # Aseguramos que el objeto auth tenga el atributo setead en caso de ser el stub o el manager real
            if hasattr(st.session_state, 'auth'):
                st.session_state.auth.current_user = "Invitado"
            st.rerun()

    else:  # Crear Cuenta
        with st.form('create_account_form'):
            reg_user = st.text_input('Nombre de usuario (nuevo)')
            reg_phone = st.text_input('Teléfono (opcional)')
            reg_pw1 = st.text_input('Contraseña', type='password')
            reg_pw2 = st.text_input('Repetir contraseña', type='password')
            reg_submit = st.form_submit_button('Crear cuenta')

        if reg_submit:
            if not reg_user or not reg_pw1:
                st.error('Completa usuario y contraseña para crear la cuenta.')
            elif reg_pw1 != reg_pw2:
                st.error('Las contraseñas no coinciden.')
            else:
                ok, msg = st.session_state.auth.register(reg_user, reg_pw1)
                if ok:
                    # After register, switch back to Entrar so user can attempt login when admin activates
                    st.session_state.auth_mode = 'Entrar'
                    st.success(msg + ' Espera a que el admin active la cuenta.')
                else:
                    st.error(msg)

# Render login only when not logged in; stop execution so tabs don't render
if not st.session_state.logged_in:
    _render_login_block()
    st.stop()

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

# NEON_DB_URL and AuthManager already initialized earlier near the top
# Admin secret already read earlier
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

# (removed duplicate later defaults - initialization done earlier)

# --- HEADER (LOGUEADO) ---
cols = st.columns([1, 0.3])
with cols[0]:
    st.markdown('<h1 class="main-header">Generador de Horarios</h1>', unsafe_allow_html=True)
with cols[1]:
    cur_user = getattr(st.session_state.auth, 'current_user', None) or 'Invitado'
    # Mostrar estado de licencia (Activa / Inactiva)
    try:
        acct_active = False
        f_active = getattr(st.session_state.auth, 'account_is_active', None)
        if callable(f_active) and cur_user and cur_user != 'Invitado':
            acct_active = bool(f_active(cur_user))
    except Exception:
        acct_active = False
    # Botones: Licencia (muestra expander) y Cerrar sesión
    btn_col_a, btn_col_b = st.columns([1,1])
    with btn_col_a:
        if st.button("Licencia"):
            st.session_state.show_license = not st.session_state.get('show_license', False)
    with btn_col_b:
        if st.button(f"{cur_user} (Salir)"):
            try:
                st.session_state.auth.logout()
            except Exception:
                pass
            st.session_state.logged_in = False
            st.rerun()
    # Badge
    if cur_user != 'Invitado':
        if acct_active:
            st.markdown('<div style="color:green;font-weight:600">Licencia: Activa</div>', unsafe_allow_html=True)
        else:
            st.markdown('<div style="color:#d97706;font-weight:600">Licencia: Inactiva</div>', unsafe_allow_html=True)

# Mostrar expander de Gestión de Licencia si el usuario lo solicita (paridad con desktop)
if st.session_state.get('show_license'):
    with st.expander("Gestión de licencia", expanded=True):
        cur = getattr(st.session_state.auth, 'current_user', None)
        if not cur:
            st.info("No has iniciado sesión.")
        else:
            active = None
            try:
                get_dev = getattr(st.session_state.auth, 'get_active_device', None)
                if callable(get_dev):
                    active = get_dev(cur)
            except Exception:
                active = None
            st.markdown(f"**Usuario:** {cur}")
            st.markdown(f"**Dispositivo activo:** {active if active else 'ninguno'}")
            st.markdown(f"Si necesitas migrar, contacta: {LICENSE_MIGRATION_CONTACT}")

            col_rel, col_force = st.columns(2)
            with col_rel:
                if st.button("Liberar sesión remota"):
                    if not active:
                        st.info("No hay sesión remota para liberar.")
                    else:
                        try:
                            st.session_state.auth.logout(cur, active)
                            st.success("Sesión remota liberada.")
                            # actualizar estado
                            st.session_state.show_license = False
                            try:
                                rerun_fn = getattr(st, 'experimental_rerun', None)
                                if callable(rerun_fn):
                                    rerun_fn()
                                else:
                                    st.session_state['_rerun_trigger'] = st.session_state.get('_rerun_trigger', 0) + 1
                            except Exception:
                                pass
                        except Exception as e:
                            st.error(str(e))

            with col_force:
                st.markdown("#### Transferir a este equipo")
                pwd = st.text_input("Ingresa tu contraseña para transferir:", type='password', key='transfer_pwd')
                if st.button("Transferir (contraseña)", key='transfer_pwd_btn'):
                    if not pwd:
                        st.error("Proporciona la contraseña para transferir.")
                    else:
                        device_id = str(uuid.uuid4())[:12]
                        ok, msg = st.session_state.auth.login(cur, pwd, device_id=device_id, transfer=True)
                        if ok:
                            st.success("Licencia transferida a este equipo.")
                            st.session_state.auth.is_authenticated = True
                            st.session_state.auth.current_user = cur
                            st.session_state.logged_in = True
                            st.session_state.show_license = False
                            try:
                                rerun_fn = getattr(st, 'experimental_rerun', None)
                                if callable(rerun_fn):
                                    rerun_fn()
                                else:
                                    st.session_state['_rerun_trigger'] = st.session_state.get('_rerun_trigger', 0) + 1
                            except Exception:
                                pass
                        else:
                            st.error(msg)

                mig = st.text_input('Ingresa la clave de migración proporcionada por el admin:', key='mig_transfer')
                if st.button('Transferir por clave', key='transfer_key_btn'):
                    if not mig:
                        st.error('Proporciona la clave de migración.')
                    else:
                        device_id = str(uuid.uuid4())[:12]
                        ok2, msg2 = st.session_state.auth.apply_license_and_activate(cur, mig, device_id=device_id)
                        if ok2:
                            st.success('Licencia migrada correctamente a este equipo.')
                            st.session_state.auth.is_authenticated = True
                            st.session_state.auth.current_user = cur
                            st.session_state.logged_in = True
                            st.session_state.show_license = False
                            try:
                                rerun_fn = getattr(st, 'experimental_rerun', None)
                                if callable(rerun_fn):
                                    rerun_fn()
                                else:
                                    st.session_state['_rerun_trigger'] = st.session_state.get('_rerun_trigger', 0) + 1
                            except Exception:
                                pass
                        else:
                            st.error(msg2)

st.markdown('<p class="sub-header">Paso 1: Ingreso de Ramos por Categoría</p>', unsafe_allow_html=True)

# --- NAVEGACIÓN (selector de página para evitar ejecutar todo junto) ---
PAGES = [
    "1. Introducir Ramos",
    "2. Datos Procesados",
    "3. Horario Optimizado",
    "4. Exportar",
    "5. Gestión JSON",
]
# Usar un radio horizontal como 'pestañas' — sólo la página activa ejecutará su código
page = st.radio('Navegación', PAGES, index=0, horizontal=True, key='page_selector', label_visibility='collapsed')

# --- PÁGINA 1: DATOS DEL PORTAL ---
if page == "1. Introducir Ramos":
    st.markdown("### Preferencias de Horario")
    col_p1, col_p2, col_p3, col_p4 = st.columns(4)
    with col_p1:
        st.checkbox("Priorizar NO entrar temprano", value=st.session_state.get('pref_no_temprano', True), key='pref_no_temprano')
    with col_p2:
        st.checkbox("Priorizar NO salir tarde", value=st.session_state.get('pref_no_tarde', True), key='pref_no_tarde')
    with col_p3:
        st.checkbox("Evitar ventanas largas", value=st.session_state.get('pref_sin_ventanas', True), key='pref_sin_ventanas')
    with col_p4:
        st.checkbox("Quitar sábados", value=st.session_state.get('pref_sin_sabados', True), key='pref_sin_sabados')

    st.markdown("---")
    # Tres columnas con tarjetas y textareas (igual que desktop)
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown('<div class="card cat-obligatorio"><div class="cat-title">RAMOS PRIORIDAD</div></div>', unsafe_allow_html=True)
        t0 = st.text_area("", height=520, key="txt_cat0", label_visibility="collapsed")
    with col2:
        st.markdown('<div class="card cat-adelantar"><div class="cat-title">RAMOS OPCIONALES</div></div>', unsafe_allow_html=True)
        t1 = st.text_area("", height=520, key="txt_cat1", label_visibility="collapsed")
    with col3:
        st.markdown('<div class="card cat-electivo"><div class="cat-title">ELECTIVOS (PEGA AQUÍ LOS ELEC, SI NO SABES CUAL ELEGIR)</div></div>', unsafe_allow_html=True)
        t2 = st.text_area("", height=520, key="txt_cat2", label_visibility="collapsed")

    # Botones de acción alineados como en desktop
    btn_col_left, btn_col_center, _ = st.columns([1,2,1])
    with btn_col_left:
        if st.button("Limpiar inputs"):
            st.session_state.horarios_crudos = []
            st.session_state.selecciones = {}
            st.session_state.mejores_horarios = []
            st.session_state.json_store = {}
            try:
                rerun_fn = getattr(st, 'experimental_rerun', None)
                if callable(rerun_fn):
                    rerun_fn()
                else:
                    st.session_state['_rerun_trigger'] = st.session_state.get('_rerun_trigger', 0) + 1
            except Exception:
                pass
    with btn_col_center:
        if st.button("Procesar Ramos", type="primary", use_container_width=True):
            all_crudos = []
            m = "Auto"
            try:
                if t0 and t0.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t0, 0, modo=m))
                if t1 and t1.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t1, 1, modo=m))
                if t2 and t2.strip(): all_crudos.extend(st.session_state.parser.parsear_texto_por_prioridad(t2, 2, modo=m))
            except Exception as e:
                st.error(f"Error procesando los ramos: {e}")
                all_crudos = []

            if all_crudos:
                st.session_state.horarios_crudos = all_crudos
                st.toast(f"Procesados {len(all_crudos)} bloques de horario.")
                # Sincronizar Almacén JSON y auto-detección para Paso 2
                ramos_por_titulo = defaultdict(list)
                for h in all_crudos:
                    d = {"nrc": h.nrc, "tipo": h.tipo, "seccion": h.seccion, "dia": h.dia_parseado, "hora": h.hora_str, "lugar": h.ubicacion}
                    ramos_por_titulo[h.titulo].append(d)
                for titulo, secciones in ramos_por_titulo.items():
                    st.session_state.json_store[titulo] = {"curso": titulo, "secciones": secciones}

                agrupados = st.session_state.parser.agrupar_por_nrc(all_crudos)
                for nrc, horarios in agrupados.items():
                    for idx, h in enumerate(horarios):
                        dia = h.dia_parseado or st.session_state.parser.calcular_dia_de_fecha(h.fecha_inicio)
                        if dia:
                            st.session_state.selecciones[f"{nrc}_{idx}"] = {'dia': dia, 'horario': h, 'nrc_original': nrc}
                st.info("Pasa a la pestaña '2. Datos Procesados'")
            else:
                st.error("No se detectaron datos válidos.")

# --- PÁGINA 2: DATOS PROCESADOS ---
if page == "2. Datos Procesados":
    st.markdown("### CÓMO FUNCIONA EL OPTIMIZADOR")
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
            st.toast(f"NRC {nrc_to_del} eliminado")
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
            
            status_text = "Listo" if configurado else "Pendiente"
            status_color = "#10B981" if configurado else "#EF4444"

            with st.container():
                col_h, col_b = st.columns([5, 1])
                with col_h:
                    st.markdown(f'<div class="card {cat_class}"><b>{horarios[0].titulo}</b> (NRC: {nrc}) <span style="float:right; font-size:0.8rem; color:{status_color}; font-weight:bold;">{status_text}</span></div>', unsafe_allow_html=True)
                with col_b:
                    st.markdown("<br>", unsafe_allow_html=True)
                    if st.button("Eliminar", key=f"del_{nrc}", help=f"Eliminar {horarios[0].titulo}", use_container_width=True):
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
                    'no_temprano': st.session_state.get('pref_no_temprano', True),
                    'no_tarde': st.session_state.get('pref_no_tarde', True),
                    'sin_ventanas': st.session_state.get('pref_sin_ventanas', True),
                    'sin_sabados': st.session_state.get('pref_sin_sabados', True)
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

# --- PÁGINA 3: HORARIO OPTIMIZADO ---
if page == "3. Horario Optimizado":
    if not st.session_state.mejores_horarios:
        st.info("Completa el paso 2 para ver tu horario aquí.")
    else:
        st.markdown(f"### Paso 3: Tu Horario Semanal")
        
        horario_actual = st.session_state.mejores_horarios[st.session_state.indice_horario]
        
        col_nav1, col_nav2, col_nav3 = st.columns([2, 1, 1])
        with col_nav1:
            st.markdown(f"**Viendo opción {st.session_state.indice_horario + 1} de {len(st.session_state.mejores_horarios)}**")
        with col_nav2:
            if st.button("Ver otra opción", use_container_width=True):
                st.session_state.indice_horario = (st.session_state.indice_horario + 1) % len(st.session_state.mejores_horarios)
                st.rerun()
        with col_nav3:
            if st.button("REINICIAR TODO", type="secondary", use_container_width=True):
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
            # Use the same custom slots as desktop
            slots = ["08:00","09:30","11:00","12:30","13:11","14:40","16:00","17:35","19:00"]
            
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

            # Renderizar Grilla HTML con slots y rowspans para duración
            # Precompute minute ranges
            def hhmm_to_min(s):
                try:
                    h, m = [int(x) for x in s.split(':')]
                    return h*60 + m
                except Exception:
                    return 0

            slot_minutes = [hhmm_to_min(s) for s in slots]

            # track placed cells to skip when a rowspan covers them
            placed = {d: [False]*len(slots) for d in dias}

            html_grid = f"""
            <div style="overflow-x: auto;">
                <table class="schedule-grid" style="width: 100%; border-collapse: collapse; font-family: 'Outfit', sans-serif; background: transparent;">
                    <thead>
                        <tr>
                            <th style="padding: 8px; width: 60px;">Hora</th>
                            {''.join([f'<th style="padding: 8px; min-width: 120px;">{d}</th>' for d in dias])}
                        </tr>
                    </thead>
                    <tbody>
            """

            for si, s in enumerate(slots):
                html_grid += f"<tr><td style='border: 1px solid #E2E8F0; padding: 8px; font-weight: 600; background: #F8FAFC; text-align: center;'>{s}</td>"
                for d in dias:
                    if placed[d][si]:
                        # cell covered by previous rowspan
                        continue

                    # find a class that intersects this slot
                    clase = None
                    for c in horario_actual:
                        if c.dia != d:
                            continue
                        hi = hhmm_to_min(getattr(c, 'hora_inicio', '00:00'))
                        hf = hhmm_to_min(getattr(c, 'hora_fin', '00:00'))
                        if hi <= slot_minutes[si] < hf:
                            clase = c
                            break

                    if not clase:
                        html_grid += "<td></td>"
                    else:
                        # determine how many slots it spans
                        span = 1
                        for sj in range(si+1, len(slots)):
                            if slot_minutes[sj] < hhmm_to_min(getattr(clase, 'hora_fin', '00:00')):
                                span += 1
                            else:
                                break

                        color = nrc_colors.get(clase.nrc, "#CBD5E1")
                        content = f"<div style='font-weight: 700; line-height: 1.1;'>{clase.titulo}</div>"
                        content += f"<div style='font-size: 0.7rem; margin-top: 2px;'>{clase.nrc}</div>"
                        content += f"<div style='font-size: 0.7rem;'>{clase.hora_inicio}-{clase.hora_fin}</div>"

                        if span > 1:
                            html_grid += f"<td rowspan=\"{span}\" style='padding: 6px; background-color: {color}; color: #1E293B; vertical-align: middle;'>" + content + "</td>"
                            # mark covered slots
                            for k in range(si, si+span):
                                if k < len(slots):
                                    placed[d][k] = True
                        else:
                            html_grid += f"<td style='padding: 6px; background-color: {color}; color: #1E293B; vertical-align: middle;'>" + content + "</td>"
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

# --- PÁGINA 4: EXPORTAR ---
if page == "4. Exportar":
    if not st.session_state.mejores_horarios:
        st.info("Genera un horario primero.")
    else:
        st.markdown("### Paso 4: Exportar Resultado")
        
        col_exp1, col_exp2 = st.columns(2)
        
        with col_exp1:
            st.markdown("#### Formato Excel")
            st.write("Ideal para imprimir o compartir.")
            filename = f"Horario_Opcion_{st.session_state.indice_horario + 1}.xlsx"
            if st.button("Generar Archivo Excel", type="primary", use_container_width=True):
                with st.spinner("Generando archivo..."):
                    from src.data.excel_exporter import ExcelExporter
                    ExcelExporter.exportar(st.session_state.mejores_horarios[st.session_state.indice_horario], filename)
                    with open(filename, "rb") as f:
                        st.download_button("DESCARGAR EXCEL", f, file_name=filename, mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
            st.markdown("---")
            st.markdown("#### Formato CSV (Compatibilidad)")
            if st.button("Generar CSV agrupado", use_container_width=True, key='gen_csv'):
                import io, csv
                buf = io.StringIO()
                writer = csv.writer(buf)
                # Reuse grouping logic from desktop
                horario_actual = st.session_state.mejores_horarios[st.session_state.indice_horario]
                grouped = {}
                for c in horario_actual:
                    key = (getattr(c, 'nrc', ''), getattr(c, 'titulo', ''), getattr(c, 'tipo', ''))
                    lugar = f"{getattr(c,'edificio','') or ''} {getattr(c,'salon','') or ''}".strip()
                    if lugar.lower() in ('n/a', 'na', '-', 's/i'):
                        lugar = ''
                    bloque = f"{getattr(c,'dia','')} {getattr(c,'hora_inicio','')}-{getattr(c,'hora_fin','')}" + (f" {lugar}" if lugar else "")
                    grouped.setdefault(key, []).append(bloque)

                writer.writerow(['NRC','Titulo','Tipo','Bloque 1','Bloque 2','Bloque 3'])
                for (nrc, titulo, tipo), bloques in grouped.items():
                    row = [nrc, titulo, tipo]
                    row.extend([bloques[i] if i < len(bloques) else '' for i in range(3)])
                    writer.writerow(row)

                # Append textual ARMADO DEL HORARIO
                buf.write('\n')
                buf.write('ARMADO DEL HORARIO:\n')
                schedule_by_day = {}
                for c in horario_actual:
                    dia = getattr(c, 'dia', '')
                    if not dia:
                        continue
                    lugar = f"{getattr(c,'edificio','') or ''} {getattr(c,'salon','') or ''}".strip()
                    if lugar.lower() in ('n/a', 'na', '-', 's/i'):
                        lugar = ''
                    hora_range = f"{getattr(c,'hora_inicio','')}-{getattr(c,'hora_fin','')}"
                    title = getattr(c, 'titulo', '')
                    nrc = getattr(c, 'nrc', '')
                    line = f"{dia} {hora_range} {lugar} — {title} ({nrc})" if lugar else f"{dia} {hora_range} — {title} ({nrc})"
                    schedule_by_day.setdefault(dia, []).append((getattr(c,'hora_inicio',''), line))

                day_order = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
                for d in day_order:
                    items = schedule_by_day.get(d, [])
                    if not items:
                        continue
                    items.sort(key=lambda x: x[0])
                    buf.write(f"\n{d}:\n")
                    for _, line in items:
                        buf.write(line + '\n')

                csv_bytes = buf.getvalue().encode('utf-8')
                st.download_button('Descargar CSV', csv_bytes, file_name=f'Horario_Opcion_{st.session_state.indice_horario + 1}.csv', mime='text/csv', use_container_width=True)
        
        with col_exp2:
            st.markdown("#### Formato JSON")
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
            st.download_button("Descargar como archivo .json", json_str, file_name=f"Horario_Opcion_{st.session_state.indice_horario + 1}.json", mime="application/json", use_container_width=True)

# --- PÁGINA 5: GESTIÓN JSON ---
if page == "5. Gestión JSON":
    st.markdown("### Paso 5: Almacén de Datos JSON")
    st.info("Aquí puedes ver y respaldar los datos consolidados de todos tus ramos.")
    if not st.session_state.json_store:
        st.warning("No hay ramos guardados en la memoria actual.")
    else:
        for titulo, data in st.session_state.json_store.items():
            with st.expander(f"Asignatura: {titulo}"):
                json_text = json.dumps(data, indent=4, ensure_ascii=False)
                st.code(json_text, language="json")
                st.button(f"Copiar JSON de {titulo}", on_click=lambda t=json_text: st.write(f"Copiado al portapapeles (Simulado): {t[:20]}..."), key=f"copy_{titulo}")
        
        full_json = json.dumps(list(st.session_state.json_store.values()), indent=4, ensure_ascii=False)
        st.download_button("Exportar Base de Datos Completa (JSON)", full_json, file_name="almacen_ramos_completo.json", mime="application/json")

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

# Authentication UI moved earlier to render before tabs

# Nota: la consola administrativa fue retirada de la interfaz web para mantener paridad
# con la versión desktop. La gestión de licencia se realiza desde el botón 'Licencia' en el
# encabezado, y la funcionalidad administrativa debe realizarse por consola si es necesario.
