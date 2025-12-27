import tkinter as tk
from tkinter import messagebox, filedialog
import customtkinter as ctk
import json
import os
from datetime import datetime
from collections import defaultdict
import uuid
import platform
import hashlib
import threading

from src.data.parser import ParserInteligente
from src.core.optimizer import OptimizadorReal
NEON_DB_URL = "postgresql://neondb_owner:npg_IhV8Zt4aoilr@ep-twilight-sound-adxqbeo9-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

from pathlib import Path

# Simple logger para diagnosticar arranque/UI
def _write_log(msg: str):
    try:
        p = Path(_get_config_dir()) / 'launcher_debug.log'
        with open(p, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.now().isoformat()} - {msg}\n")
    except Exception:
        pass

def _get_config_dir() -> Path:
    if os.name == 'nt':
        base = Path(os.getenv('APPDATA', Path.home() / 'AppData' / 'Roaming')) / 'UniHorario'
    else:
        base = Path(os.getenv('XDG_CONFIG_HOME', Path.home() / '.config')) / 'unihorario'
    base.mkdir(parents=True, exist_ok=True)
    return base


# Ubicación de archivos de configuración/estado del usuario
CONFIG_DIR = _get_config_dir()
SESSION_FILE = str(CONFIG_DIR / 'user_session.json')
DEVICE_FILE = str(CONFIG_DIR / '.device_id')
LICENSE_MIGRATION_CONTACT = "admin"
LICENSE_MIGRATION_HASH = os.getenv('LICENSE_MIGRATION_HASH', 'xxxxxxxxxxxxxxxx')

from src.auth.manager import AuthManager

# Configuración Global
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class HorarioAppProfesional:
    def __init__(self, root):
        _write_log('HorarioAppProfesional.__init__ start')
        self.root = root
        # Inicializar referencias que se crean más tarde para evitar warnings y Nones
        self.login_win_ref = None
        self.reg_win_ref = None
        self._btn_paste_migrate = None
        self._loader_win = None
        self._loader_label = None
        self._loader_pb = None
        # Estilo uniforme para entradas (porte uniforme)
        self._entry_height = 42
        self._entry_padx = 30
        self._entry_pady = (4, 6)
        self.root.title("UniHorario USS Profesional")
        self.root.geometry("1400x900")

        # Obligar Pantalla Completa y no redimensionable
        # Mostrar en pantalla completa al iniciar (permitir minimizar/cerrar desde WM)
        try:
            self.root.attributes("-zoomed", True)
        except Exception:
            pass
        try:
            self.root.attributes("-fullscreen", True)
        except Exception:
            pass
        self.root.resizable(False, False)

        # Componentes lógicos
        self.parser = ParserInteligente()
        self.optimizer = OptimizadorReal()
        self.auth = AuthManager(NEON_DB_URL)

        # Ocultar ventana principal hasta login
        _write_log('Hiding root window')
        self.root.withdraw()
        # Generar/recuperar device id antes de abrir UI de login (evita condiciones de carrera)
        self.device_id = self._get_or_create_device_id()
        _write_log(f'device_id: {self.device_id[:8]}...')
        _write_log('Calling abrir_login()')
        try:
            self.abrir_login()
            _write_log('abrir_login() returned')
        except Exception as e:
            _write_log(f'abrir_login() ERROR: {e}')
        # Intentar autologin después de un breve delay
        self.root.after(500, self.intentar_autologin)
        # Chequeo periódico de licencia para detectar revocaciones remotas
        self._periodic_license_check()

        # Asegurar cierre limpio (revocar sesión activa en servidor)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        # Estado de la aplicación
        self.horarios_crudos = []
        self.selecciones_usuario = {}

        self.nrc_widgets = {}
        self.mejores_horarios = []
        self.indice_horario_actual = 0

        self.mapa_colores_actual = {}
        self.ramos_json_store = {}
        # Preferencias (crear antes de que UI pueda usarlas)
        self.pref_no_temprano = tk.BooleanVar(value=True)
        self.pref_no_tarde = tk.BooleanVar(value=True)
        self.pref_sin_ventanas = tk.BooleanVar(value=True)
        self.pref_sin_sabados = tk.BooleanVar(value=True)
        self.modo_parser = tk.StringVar(value="Auto")

        # Setup UI (crear widgets principales antes de mostrar login)
        self.setup_ui()

    def _get_or_create_device_id(self) -> str:
        try:
            if os.path.exists(DEVICE_FILE):
                with open(DEVICE_FILE, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            raw = f"{uuid.getnode()}-{platform.node()}-{platform.platform()}"
            did = hashlib.sha256(raw.encode()).hexdigest()
            with open(DEVICE_FILE, 'w', encoding='utf-8') as f:
                f.write(did)
            return did
        except Exception:
            # Fallback simple id
            return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()

    def on_close(self):
        # Revocar sesión activa en servidor si corresponde
        try:
            if hasattr(self, 'auth') and self.auth and self.auth.current_user:
                self.auth.logout(self.auth.current_user, self.device_id)
        except Exception:
            pass
        try:
            self.root.destroy()
        except Exception:
            pass

    def setup_ui(self):
        # Header
        self.header_frame = ctk.CTkFrame(self.root, height=50, corner_radius=0)
        self.header_frame.pack(fill="x", side="top")

        self.lbl_title = ctk.CTkLabel(self.header_frame, text="UniHorario USS v1.9", font=ctk.CTkFont(size=18, weight="bold"))
        self.lbl_title.pack(side="left", padx=20)

        self.lbl_user_info = ctk.CTkLabel(self.header_frame, text="Invitado", font=ctk.CTkFont(size=12))
        self.lbl_user_info.pack(side="right", padx=20)
        # Botón de gestión de licencia / sesión
        self.btn_license = ctk.CTkButton(self.header_frame, text="Licencia", width=100, height=28, fg_color="#111827", command=self.open_license_manager)
        self.btn_license.pack(side="right", padx=(0,10))
        self.btn_logout = ctk.CTkButton(self.header_frame, text="Cerrar sesión", width=120, height=28, fg_color="#ef4444", command=self.do_logout)
        self.btn_logout.pack(side="right", padx=(0,10))
        # Indicador de estado de licencia (oculto si está activo)
        self.lbl_license_status = ctk.CTkLabel(self.header_frame, text="", font=ctk.CTkFont(size=11))
        self.lbl_license_status.pack(side="right", padx=(0,10))

        # Tabview Principal
        self.tabview = ctk.CTkTabview(self.root)
        self.tabview.pack(fill="both", expand=True, padx=20, pady=10)

        self.tabview.add("1. Introducir Ramos")
        self.tabview.add("2. Datos Procesados")
        self.tabview.add("3. Horario Optimizado")
        self.tabview.add("4. Exportar")
        self.tabview.add("5. Gestión JSON")

        self.setup_tab_entrada()
        self.setup_tab_config()
        self.setup_tab_horario()
        self.setup_tab_export()
        self.setup_tab_json()

        # Métodos adicionales añadidos dentro de la clase para evitar AttributeError
    def abrir_login(self):
        try:
            if getattr(self, 'login_win_ref', None):
                try: self.login_win_ref.deiconify(); self.login_win_ref.lift(); return
                except: pass
            win = ctk.CTkToplevel(self.root)
            win.title("Acceso UniHorario")
            win.geometry("420x520")
            win.resizable(False, False)
            self.login_win_ref = win
            card = ctk.CTkFrame(win, corner_radius=12, width=380, height=480)
            card.place(relx=0.5, rely=0.5, anchor="center")
            card.pack_propagate(False)
            ctk.CTkLabel(card, text="BIENVENIDO", font=("Inter", 22, "bold")).pack(pady=(30,6))
            # Mensaje breve bajo el título
            ctk.CTkLabel(card, text="Ingresa tus credenciales para acceder a UniHorario.", font=("Inter", 11), text_color="gray").pack(pady=(0,8))
            # Entrada de usuario con mismo porte y estilo (texto blanco, placeholder gris)
            self.login_user_entry = ctk.CTkEntry(card, placeholder_text="Nombre de usuario", height=self._entry_height, fg_color="transparent", text_color="white", placeholder_text_color="gray", corner_radius=8)
            self.login_user_entry.pack(fill="x", padx=self._entry_padx, pady=self._entry_pady)
            self.login_pass_entry = self.create_password_entry(card, "Contraseña")
            self.login_msg_var = tk.StringVar(value="")
            ctk.CTkLabel(card, textvariable=self.login_msg_var, text_color="#f59e0b").pack(pady=(6,4))
            btn_login = ctk.CTkButton(card, text="INICIAR SESIÓN", fg_color="#10B981", height=40, command=self._login_from_ui)
            btn_login.pack(pady=(12,8), padx=40, fill="x")
            # Botón para registro (si no tienes cuenta)
            ctk.CTkButton(card, text="¿No tienes cuenta? Regístrate", fg_color="transparent", text_color="#3B82F6", command=self.open_register).pack(pady=(6,4))
        except Exception as e:
            _write_log(f"abrir_login error: {e}")

    def open_register(self):
        """Abrir diálogo de registro con campos: usuario, teléfono opcional, contraseña y repetir contraseña."""
        try:
            # Si ya hay ventana, focusearla
            if getattr(self, 'reg_win_ref', None):
                try: self.reg_win_ref.deiconify(); self.reg_win_ref.lift(); return
                except: pass
            win = ctk.CTkToplevel(self.root)
            win.title("Registrarse")
            win.geometry("420x520")
            win.resizable(False, False)
            self.reg_win_ref = win

            card = ctk.CTkFrame(win, corner_radius=12)
            card.pack(fill='both', expand=True, padx=16, pady=16)

            ctk.CTkLabel(card, text="Crear cuenta", font=("Inter", 18, "bold")).pack(pady=(6,8))
            ctk.CTkLabel(card, text="Completa los datos para crear una cuenta.", font=("Inter", 11), text_color='gray').pack(pady=(0,8))

            # Campos de registro con el mismo porte y estilo que el login
            usr = ctk.CTkEntry(card, placeholder_text="Nombre de usuario", height=self._entry_height, fg_color="transparent", text_color="white", placeholder_text_color="gray", corner_radius=8)
            usr.pack(fill='x', padx=self._entry_padx, pady=self._entry_pady)
            tel = ctk.CTkEntry(card, placeholder_text="Teléfono (opcional)", height=self._entry_height, fg_color="transparent", text_color="white", placeholder_text_color="gray", corner_radius=8)
            tel.pack(fill='x', padx=self._entry_padx, pady=self._entry_pady)
            pw1 = self.create_password_entry(card, "Contraseña")
            pw2 = self.create_password_entry(card, "Repetir contraseña")

            def _do_register():
                user = usr.get().strip()
                phone = tel.get().strip()
                p1 = pw1.get().strip()
                p2 = pw2.get().strip()
                if not user:
                    messagebox.showwarning('Registro', 'El nombre de usuario es obligatorio.')
                    return
                if not p1:
                    messagebox.showwarning('Registro', 'La contraseña es obligatoria.')
                    return
                if p1 != p2:
                    messagebox.showwarning('Registro', 'Las contraseñas no coinciden.')
                    return
                # Intentar usar auth.register si está implementado
                try:
                    register_fn = getattr(self.auth, 'register', None)
                    if callable(register_fn):
                        # Ejecutar el registro en background para no bloquear la UI
                        self.show_loader('Creando cuenta...')
                        def _reg_task():
                            try:
                                ok, msg = register_fn(user, p1, phone)
                            except Exception as e:
                                ok, msg = False, str(e)
                            # Volver al hilo principal para actualizar UI
                            def _on_done():
                                try: self.hide_loader()
                                except: pass
                                if ok:
                                    try:
                                        messagebox.showinfo('Registro', msg)
                                    except Exception:
                                        pass
                                    try: win.destroy()
                                    except Exception:
                                        pass
                                else:
                                    try:
                                        messagebox.showerror('Registro', f'No se pudo crear la cuenta: {msg}')
                                    except Exception:
                                        pass
                            try:
                                self.root.after(0, _on_done)
                            except Exception:
                                _on_done()
                        threading.Thread(target=_reg_task, daemon=True).start()
                        return
                    else:
                        # No hay endpoint de registro en AuthManager
                        messagebox.showinfo('Registro', 'Registro no disponible en este servidor. Contacta al administrador.')
                        return
                except Exception as e:
                    messagebox.showerror('Registro', f'Error al registrar: {e}')

            ctk.CTkButton(card, text='CREAR CUENTA', fg_color='#2563EB', command=_do_register, height=44).pack(pady=(18,6), padx=40, fill='x')
            ctk.CTkButton(card, text='Cancelar', fg_color='transparent', command=lambda: win.destroy()).pack(pady=(4,8))
        except Exception as e:
            _write_log(f'open_register error: {e}')

    def _login_from_ui(self):
        try:
            u = (getattr(self, 'login_user_entry', None) and self.login_user_entry.get()) or ''
            p = (getattr(self, 'login_pass_entry', None) and self.login_pass_entry.get()) or ''
            if not u or not p:
                messagebox.showwarning('Atención', 'Completa usuario y contraseña')
                return
            self.show_loader('Iniciando sesión...')
            def _task():
                try:
                    res = self.auth.login(u, p, self.device_id)
                except Exception as e:
                    res = (False, str(e))
                self.root.after(0, lambda: self._handle_login_result(u, p, res, autologin=False))
            threading.Thread(target=_task, daemon=True).start()
        except Exception as e:
            _write_log(f'_login_from_ui error: {e}')

    def _periodic_license_check(self, interval_ms: int = 15000):
        try:
            if hasattr(self, 'auth') and getattr(self.auth, 'current_user', None):
                try:
                    f = getattr(self.auth, 'is_license_active_on_device', None)
                    if callable(f):
                        _ = f(self.auth.current_user, self.device_id)
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            try:
                self.root.after(interval_ms, lambda: self._periodic_license_check(interval_ms))
            except Exception:
                pass

    def _update_license_ui(self):
        try:
            active = False
            if hasattr(self, 'auth') and getattr(self.auth, 'current_user', None):
                try:
                    f = getattr(self.auth, 'is_license_active_on_device', None)
                    if callable(f):
                        active = bool(f(self.auth.current_user, self.device_id))
                except Exception:
                    active = False
            try:
                if active:
                    try: self.btn_license.pack_forget()
                    except Exception: pass
                    try: self.lbl_license_status.configure(text='Licencia: Activa')
                    except Exception: pass
                else:
                    try:
                        if not self.btn_license.winfo_ismapped():
                            self.btn_license.pack(side='right', padx=(0,10))
                    except Exception:
                        pass
                    try: self.lbl_license_status.configure(text='Licencia: Inactiva')
                    except Exception: pass
            except Exception:
                pass
        except Exception:
            pass

    def do_logout(self):
        try:
            if hasattr(self, 'auth') and getattr(self.auth, 'current_user', None):
                try: self.auth.logout(self.auth.current_user, self.device_id)
                except Exception: pass
            try:
                if os.path.exists(SESSION_FILE): os.remove(SESSION_FILE)
            except Exception:
                pass
            try: self.lbl_user_info.configure(text='Invitado')
            except Exception: pass
            try: self.root.withdraw(); self.abrir_login()
            except Exception: pass
        except Exception:
            pass

    def setup_tab_entrada(self):
        try:
            tab = self.tabview.tab('1. Introducir Ramos')
            # Disposición: filtros arriba, luego 3 columnas de inputs "Datos del portal", y botones al final
            tab.grid_columnconfigure((0,1,2), weight=1)
            # Filtros (preferencias) en fila 0 spanning las 3 columnas
            filters_frame = ctk.CTkFrame(tab, fg_color='transparent')
            filters_frame.grid(row=0, column=0, columnspan=3, sticky='ew', pady=(8,6), padx=10)
            filters_frame.grid_columnconfigure((0,1,2,3), weight=1)
            # Checkboxes para preferencias (usar las BooleanVar ya definidas en __init__)
            try:
                ctk.CTkCheckBox(filters_frame, text='Priorizar NO entrar temprano', variable=self.pref_no_temprano).grid(row=0, column=0, sticky='w', padx=8)
                ctk.CTkCheckBox(filters_frame, text='Priorizar NO salir tarde', variable=self.pref_no_tarde).grid(row=0, column=1, sticky='w', padx=8)
                ctk.CTkCheckBox(filters_frame, text='Evitar ventanas largas', variable=self.pref_sin_ventanas).grid(row=0, column=2, sticky='w', padx=8)
                ctk.CTkCheckBox(filters_frame, text='Quitar sábados', variable=self.pref_sin_sabados).grid(row=0, column=3, sticky='w', padx=8)
            except Exception:
                # Fallback si el widget no está disponible
                try:
                    ctk.CTkLabel(filters_frame, text='[Filtros de preferencia no disponibles]').grid(row=0, column=0, padx=8)
                except Exception:
                    pass

            # Títulos encima de cada columna (centrados)
            labels_frame = ctk.CTkFrame(tab, fg_color='transparent')
            # Aumentar padding vertical entre filtros y títulos
            labels_frame.grid(row=1, column=0, columnspan=3, sticky='ew', padx=5, pady=(14,6))
            labels_frame.grid_columnconfigure((0,1,2), weight=1)
            ctk.CTkLabel(labels_frame, text='RAMOS PRIORIDAD', anchor='center', font=ctk.CTkFont(size=12, weight='bold')).grid(row=0, column=0, sticky='ew')
            ctk.CTkLabel(labels_frame, text='RAMOS OPCIONALES', anchor='center', font=ctk.CTkFont(size=12, weight='bold')).grid(row=0, column=1, sticky='ew')
            ctk.CTkLabel(labels_frame, text='ELECTIVOS (PEGA AQUI LOS ELEC, SI NO SABES CUAL ELEGIR)', anchor='center', font=ctk.CTkFont(size=11), wraplength=280).grid(row=0, column=2, sticky='ew')

            # Textboxes con los datos pegados (fila 2)
            tab.grid_rowconfigure(2, weight=1)
            self.t0 = ctk.CTkTextbox(tab, font=('Consolas',12), border_width=1)
            self.t0.grid(row=2, column=0, sticky='nsew', padx=5, pady=5)
            self.t1 = ctk.CTkTextbox(tab, font=('Consolas',12), border_width=1)
            self.t1.grid(row=2, column=1, sticky='nsew', padx=5, pady=5)
            self.t2 = ctk.CTkTextbox(tab, font=('Consolas',12), border_width=1)
            self.t2.grid(row=2, column=2, sticky='nsew', padx=5, pady=5)

            # Botones de acción (limpiar y procesar) en fila 3
            btn_frame = ctk.CTkFrame(tab, fg_color='transparent')
            btn_frame.grid(row=3, column=0, columnspan=3, sticky='ew', pady=(6,12))
            btn_frame.grid_columnconfigure((0,1,2), weight=1)
            ctk.CTkButton(btn_frame, text='Limpiar inputs', fg_color='transparent', command=self.limpiar_inputs, width=180).grid(row=0, column=0, padx=20)
            ctk.CTkButton(btn_frame, text='Procesar Ramos', fg_color='#2563EB', command=self.procesar_todo, width=220, height=42).grid(row=0, column=1)
            # No mostrar modo invitado aquí: button eliminado por seguridad de licencia
            # (anteriormente: Modo Invitado)
            # Reservado: espacio en columna 2 para equilibrio visual
            ctk.CTkFrame(btn_frame, fg_color='transparent').grid(row=0, column=2, padx=20)

        except Exception as e:
            _write_log(f'setup_tab_entrada error: {e}')

    def _attempt_migrate_from_login(self, u: str, clave: str):
        try:
            migrate_with_key = getattr(self.auth, 'migrate_with_key', None)
            if callable(migrate_with_key):
                return migrate_with_key(u, clave, self.device_id)
            validate_key = getattr(self.auth, 'validate_migration_key', None)
            if callable(validate_key) and validate_key(clave, u):
                return getattr(self.auth, 'migrate_license', lambda *a, **k: (False, 'no impl'))(u, self.device_id)
            validate_pw = getattr(self.auth, 'validate_migrate_password', None)
            if callable(validate_pw) and validate_pw(u, clave):
                return getattr(self.auth, 'migrate_license', lambda *a, **k: (False, 'no impl'))(u, self.device_id)
            return False, 'Clave inválida'
        except Exception as e:
            return False, str(e)

    # --- HELPERS ---
    def add_enter_nav(self, current, next_widget):
        current.bind("<Return>", lambda e: next_widget.focus())

    def create_password_entry(self, parent, placeholder, **kwargs):
        # Entradas de contraseña/texto con estilo consistente para tema oscuro:
        # - altura uniforme
        # - texto en blanco
        # - placeholder en gris
        opts = dict(height=self._entry_height, fg_color="transparent", text_color="white", placeholder_text_color="gray", corner_radius=8)
        opts.update(kwargs)

        # Contenedor que mantiene el entry y el botón en la misma fila
        frame = ctk.CTkFrame(parent, fg_color="transparent")
        frame.pack(fill="x", padx=self._entry_padx, pady=self._entry_pady)
        frame.grid_columnconfigure(0, weight=1)

        entry = ctk.CTkEntry(frame, placeholder_text=placeholder, show="*", **opts)
        entry.grid(row=0, column=0, sticky='ew')

        # Botón lateral para mostrar/ocultar contraseña, altura igual al entry para que parezcan del mismo porte
        def toggle():
            current = entry.cget("show")
            new_show = "" if current == "*" else "*"
            entry.configure(show=new_show)
            try:
                btn.configure(text="🔒 OCULTAR" if current == "*" else "👁️ MOSTRAR")
            except Exception:
                pass

        btn = ctk.CTkButton(frame, text="👁️ MOSTRAR", height=self._entry_height, width=110,
                            fg_color="transparent", text_color="#3B82F6",
                            font=("Inter", 11, "bold"), command=toggle)
        btn.grid(row=0, column=1, padx=(8,0))

        return entry

    # --- ACCESO ---
    def intentar_autologin(self):
        _write_log('intentar_autologin called')
        # Si existe sesión guardada, intentar autologin en background mostrando loader
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                return
            u = data.get('u')
            p = data.get('p')
            mig = data.get('mig')
            if not u:
                try: self.lbl_user_info.configure(text="Invitado")
                except: pass
                return

            if mig:
                # Sesión migrada anteriormente; recuperar estado sin validar contraseña
                self.auth.current_user = u
                self.auth.is_authenticated = True
                try:
                    self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                    self.root.deiconify()
                    if hasattr(self, 'login_win_ref'): self.login_win_ref.destroy()
                    self._update_license_ui()
                except Exception:
                    pass
                return

            if not p:
                try: self.lbl_user_info.configure(text="Invitado")
                except: pass
                return

            # Ejecutar login en thread para no bloquear UI
            def _login_task():
                try:
                    res = self.auth.login(u, p, self.device_id)
                except Exception as e:
                    res = (False, f"Error servidor: {e}")
                # Pasar resultado al hilo principal
                self.root.after(0, lambda: self._handle_login_result(u, p, res, autologin=True))

            self.show_loader("Iniciando sesión automática...", block=False)
            _write_log('Autologin loader shown')
            threading.Thread(target=_login_task, daemon=True).start()

    def guardar_sesion(self, u, p):
        try:
            data = {'u': u, 't': str(datetime.now()), 'device_id': self.device_id}
            # si p tiene el marcador de migración, guardar flag separado
            if p == 'LICENSE-MIGRATION':
                data['mig'] = True
            else:
                data['p'] = p
            with open(SESSION_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f)
        except: pass

    def open_license_manager(self):
        if not self.auth or not self.auth.current_user:
            messagebox.showinfo("Licencia", "No has iniciado sesión.")
            return
        cur = self.auth.current_user
        active = self.auth.get_active_device(cur)
        win = ctk.CTkToplevel(self.root)
        win.title("Gestión de licencia")
        win.geometry("420x220")
        win.resizable(False, False)

        ctk.CTkLabel(win, text=f"Usuario: {cur}", font=ctk.CTkFont(size=14, weight="bold")).pack(pady=(12,6))
        ctk.CTkLabel(win, text=f"Dispositivo activo: {active if active else 'ninguno'}", font=ctk.CTkFont(size=12)).pack(pady=(0,10))
        ctk.CTkLabel(win, text=f"Si necesitas migrar, contacta: {LICENSE_MIGRATION_CONTACT}", font=ctk.CTkFont(size=11), text_color="gray").pack(pady=(6,0))
        ctk.CTkLabel(win, text=f"Clave de migración: {LICENSE_MIGRATION_HASH[:16]}... (proporcionada por el desarrollador)", font=ctk.CTkFont(size=11), text_color="gray").pack(pady=(0,6))

        def do_release():
            if not active:
                messagebox.showinfo("Licencia", "No hay sesión remota para liberar.")
                return
            if active == self.device_id:
                messagebox.showinfo("Licencia", "La sesión activa corresponde a este equipo.")
                return
            if messagebox.askyesno("Confirmar", "Liberar la sesión remota? Esto permitirá iniciar en este equipo."):
                try:
                    self.auth.logout(cur, active)
                    messagebox.showinfo("Éxito", "Sesión remota liberada.")
                    win.destroy()
                except Exception as e:
                    messagebox.showerror("Error", str(e))

        def do_force_transfer():
            # Pedir contraseña y forzar transferencia
            # Ofrecer transferencia por contraseña
            pwd = ctk.CTkInputDialog(text="Ingresa tu contraseña para transferir:", title="Confirmar transferencia").get_input()
            if pwd:
                ok, msg = self.auth.login(cur, pwd, self.device_id, transfer=True)
                if ok:
                    messagebox.showinfo("Éxito", "Licencia transferida a este equipo.")
                    self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                    self.guardar_sesion(cur, pwd)
                    win.destroy()
                    self._update_license_ui()
                    return
                else:
                    messagebox.showerror("Error", msg)

            # Alternativa: migrar con clave (válida si está en DB y no expiró)
            clave = ctk.CTkInputDialog(text="Ingresa la clave de migración proporcionada por el admin:", title="Migrar con clave").get_input()
            if not clave:
                return
            valid = False
            try:
                # Intentar métodos de validación si existen en AuthManager (fallback a False)
                validate_key = getattr(self.auth, 'validate_migration_key', lambda *a, **k: False)
                validate_pw = getattr(self.auth, 'validate_migrate_password', lambda *a, **k: False)
                # Primero intentar con clave temporal
                valid = bool(validate_key(clave.strip(), cur))
                # Si no es válida, intentar con la contraseña de migración del usuario
                if not valid:
                    valid = bool(validate_pw(cur, clave.strip()))
                    if valid:
                        # password-based migration: allow but do not delete server key
                        pass
            except Exception:
                valid = False
            if valid:
                ok, msg = self.auth.migrate_license(cur, self.device_id)
                if ok:
                    # borrar clave usada
                    try:
                        # Si la clave era una migration_key, elimínala; si fue password-based, no la borramos
                        delete_key = getattr(self.auth, 'delete_migration_key', None)
                        if callable(delete_key):
                            delete_key(clave.strip())
                    except: pass
                    messagebox.showinfo("Éxito", "Licencia migrada correctamente a este equipo.")
                    self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                    self.guardar_sesion(cur, 'LICENSE-MIGRATION')
                    win.destroy()
                    self._update_license_ui()
                else:
                    messagebox.showerror("Error", msg)
            else:
                messagebox.showerror("Error", "Clave de migración inválida o expirada. Contacta al admin.")

        btn_rel = ctk.CTkButton(win, text="Liberar sesión remota", fg_color="#f97316", command=do_release)
        btn_rel.pack(pady=(6,4), padx=30, fill="x")
        btn_force = ctk.CTkButton(win, text="Transferir a este equipo (clave)", fg_color="#10b981", command=do_force_transfer)
        btn_force.pack(pady=(4,10), padx=30, fill="x")

    # --- LOADERS / LOGIN HANDLERS ---
    def show_loader(self, message: str = "Cargando...", block: bool = True):
        """Muestra un modal con barra indeterminada."""
        try:
            if hasattr(self, '_loader_win') and self._loader_win:
                try: self._loader_label.configure(text=message); return
                except: pass
            win = ctk.CTkToplevel(self.root)
            win.transient(self.root)
            win.title("")
            win.geometry("320x110")
            win.resizable(False, False)
            win.attributes('-topmost', True)
            frame = ctk.CTkFrame(win, corner_radius=8)
            frame.pack(fill='both', expand=True, padx=12, pady=12)
            lbl = ctk.CTkLabel(frame, text=message, font=ctk.CTkFont(size=12))
            lbl.pack(pady=(6,8))
            pb = ctk.CTkProgressBar(frame, mode='indeterminate')
            pb.pack(fill='x', padx=6, pady=(0,6))
            try: pb.start()
            except Exception: pass
            if block:
                try: win.grab_set()
                except Exception: pass
            self._loader_win = win
            self._loader_label = lbl
            self._loader_pb = pb
        except Exception:
            pass

    def hide_loader(self):
        try:
            if hasattr(self, '_loader_pb'):
                try: self._loader_pb.stop()
                except: pass
            if hasattr(self, '_loader_win') and self._loader_win:
                try: self._loader_win.grab_release()
                except Exception: pass
                try: self._loader_win.destroy()
                except Exception: pass
            self._loader_win = None
            self._loader_label = None
            self._loader_pb = None
        except Exception:
            pass

    def _handle_login_result(self, u, p, res, autologin=False):
        # Resultado esperado: (ok, msg)
        try:
            self.hide_loader()
        except Exception:
            pass
        try:
            ok, msg = res
        except Exception:
            ok, msg = False, str(res)

        if ok:
            try:
                self.guardar_sesion(u, p)
            except Exception:
                pass
            # Cerrar la ventana de login SIEMPRE cuando el login sea exitoso (autologin incluido)
            try:
                if hasattr(self, 'login_win_ref') and self.login_win_ref:
                    try:
                        self.login_win_ref.destroy()
                    except Exception:
                        pass
                    self.login_win_ref = None
            except Exception:
                pass
            try:
                self.root.deiconify()
                # asegurar fullscreen visible
                try: self.root.attributes("-zoomed", True)
                except: pass
                try: self.root.attributes("-fullscreen", True)
                except: pass
            except Exception:
                pass
            try:
                if self.auth.has_active_license(self.device_id):
                    self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia activa)")
                else:
                    self.lbl_user_info.configure(text=f"Sesión: {u} (Sin licencia)")
            except Exception:
                pass
            try:
                self._update_license_ui()
            except Exception:
                pass
            return

        # Si falla y el mensaje indica "otro dispositivo", pedir migrate_pass al usuario
        try:
            if isinstance(msg, str) and "otro dispositivo" in msg.lower():
                # Si fue autologin, NO mostrar modal repetido: abrir la ventana de login y mostrar instrucción
                if autologin:
                    try:
                        # Asegurar que la ventana de login exista y esté visible
                        try:
                            if not (hasattr(self, 'login_win_ref') and self.login_win_ref):
                                self.abrir_login()
                        except Exception as e:
                            _write_log(f"abrir_login during autologin prefill failed: {e}")
                        # Intentar prellenar campos y mostrar instrucción + botón de pegar clave
                        try:
                            self.login_user_entry.delete(0, tk.END); self.login_user_entry.insert(0, u)
                            try: self.login_pass_entry.delete(0, tk.END)
                            except Exception: pass
                            try: self.login_msg_var.set("Cuenta activa en otro dispositivo. Pega la clave de migración si la tienes (SUBARU).")
                            except Exception: pass
                            # mostrar el botón para pegar la clave (si existe)
                            try: self._btn_paste_migrate.pack(pady=(6,8))
                            except Exception:
                                pass
                            try:
                                if hasattr(self, 'login_win_ref') and self.login_win_ref:
                                    self.login_win_ref.deiconify(); self.login_win_ref.lift()
                            except Exception:
                                pass
                        except Exception as e:
                            _write_log(f"autologin prefill error: {e}")
                        return
                    except Exception:
                        return
                else:
                    # Login manual: ofrecer pegar la clave inmediatamente
                    messagebox.showinfo("Transferencia requerida", "Tu cuenta está activa en otro dispositivo. Pega la clave de migración proporcionada por SUBARU en el diálogo siguiente.")
                    clave = ctk.CTkInputDialog(text="Pega aquí la clave de migración (migrate_pass):", title="Clave de migración").get_input()
                    if clave:
                        ok2, msg2 = self._attempt_migrate_from_login(u, clave.strip())
                        if ok2:
                            try: self.guardar_sesion(u, 'LICENSE-MIGRATION')
                            except Exception: pass
                            messagebox.showinfo("Éxito", "Licencia migrada correctamente a este equipo.")
                            try: self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                            except Exception: pass
                            try: self._update_license_ui()
                            except Exception: pass
                            return
                        else:
                            messagebox.showerror("Error", f"No se pudo migrar: {msg2}")
                            return
                    return
        except Exception:
            pass

        # Si la falla indica que la cuenta no está activada, mostrar aviso claro
        try:
            if isinstance(msg, str) and ("no activ" in msg.lower() or "pendiente de activ" in msg.lower() or "no activada" in msg.lower()):
                try:
                    messagebox.showwarning('Cuenta no activada', 'Tu cuenta aún no ha sido activada por el administrador. Espera a que el admin la active o contacta al administrador para asistencia.')
                except Exception:
                    pass
                return
        except Exception:
            pass

    def limpiar_inputs(self):
        self.t0.delete("1.0", tk.END); self.t1.delete("1.0", tk.END); self.t2.delete("1.0", tk.END)

    def reiniciar_todo(self):
        if messagebox.askyesno("Confirmar", "¿Estás seguro de que quieres borrar todos los datos y empezar de cero?"):
            self.limpiar_inputs()
            self.horarios_crudos = []
            self.selecciones_usuario = {}
            self.mejores_horarios = []
            self.ramos_json_store = {}
            self.indice_horario_actual = 0
            self.mapa_colores_actual = {}

            # Limpiar visualmente todas las pestañas
            for w in self.scroll_c.winfo_children(): w.destroy()
            for w in self.scroll_g.winfo_children(): w.destroy()
            for w in self.legend_c.winfo_children(): w.destroy()
            for w in self.scroll_j.winfo_children(): w.destroy()

            self.lbl_nav.configure(text="Propuesta 0 de 0")
            # Asegurar nombre de pestaña actualizado
            try:
                self.tabview.set("1. Introducir Ramos")
            except Exception:
                try: self.tabview.set("1. Datos del Portal")
                except Exception: pass
            messagebox.showinfo("Reinicio", "Todos los datos han sido borrados.")

    def procesar_todo(self):
        # Requerir licencia activa antes de procesar
        if not self.auth.has_active_license(self.device_id):
            messagebox.showwarning("Licencia requerida", f"No puedes procesar sin una licencia activa. Migra tu licencia contactando al desarrollador ({LICENSE_MIGRATION_CONTACT}) y proporciona esta llave: {LICENSE_MIGRATION_HASH}")
            return

        # Leer datos de UI (rápido) y delegar el parsing a un hilo para no bloquear la UI
        d0, d1, d2 = self.t0.get("1.0", tk.END).strip(), self.t1.get("1.0", tk.END).strip(), self.t2.get("1.0", tk.END).strip()
        modo = self.modo_parser.get()

        if not any([d0, d1, d2]):
            messagebox.showwarning("Atención", "No hay datos para procesar.")
            return

        self.show_loader('Procesando ramos...', block=False)

        def _parse_task():
            try:
                parsed = []
                if d0:
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d0, 0, modo=modo))
                if d1:
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d1, 1, modo=modo))
                if d2:
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d2, 2, modo=modo))
            except Exception as e:
                parsed = None
                err = str(e)

            def _on_done():
                try:
                    self.hide_loader()
                except Exception:
                    pass
                if parsed is None:
                    messagebox.showerror('Parser', f'Error procesando los datos: {err}')
                    return
                self.horarios_crudos = parsed
                if not self.horarios_crudos:
                    messagebox.showwarning('Parser', 'No se detectaron ramos válidos en el texto.\n\nAsegúrate de copiar el formato correcto del portal.')
                    return
                try:
                    self._avanzar()
                except Exception as e:
                    messagebox.showerror('Parser', f'Error al cargar los datos: {e}')

            try:
                self.root.after(0, _on_done)
            except Exception:
                _on_done()

        threading.Thread(target=_parse_task, daemon=True).start()

    def _avanzar(self):
        ramos = defaultdict(list)
        for h in self.horarios_crudos:
            ramos[h.titulo].append({
                "nrc": h.nrc,
                "tipo": h.tipo,
                "seccion": h.seccion,
                "dia": h.dia_parseado,
                "hora": h.hora_str,
                "lugar": h.ubicacion
            })
        for t, s in ramos.items():
            self.ramos_json_store[t] = {
                "titulo": t,
                "json_str": json.dumps({"curso": t, "secciones": s}, indent=4, ensure_ascii=False)
            }
        self.actualizar_json_tab()
        self.cargar_config(self.parser.agrupar_por_nrc(self.horarios_crudos))
        self.tabview.set("2. Datos Procesados")

    # --- PESTAÑA 2: CONFIG ---
    def setup_tab_config(self):
        tab = self.tabview.tab("2. Datos Procesados")
        tab.grid_columnconfigure(0, weight=1); tab.grid_rowconfigure(0, weight=1)
        self.scroll_c = ctk.CTkScrollableFrame(tab, label_text="Ramos Detectados")
        self.scroll_c.grid(row=0, column=0, sticky="nsew", pady=10)
        footer = ctk.CTkFrame(tab, fg_color="transparent")
        footer.grid(row=1, column=0, sticky="ew")
        self.btn_gen = ctk.CTkButton(footer, text="GENERAR HORARIO", width=250, height=55, command=self.generar_final)
        self.btn_gen.pack(side="right")

    def cargar_config(self, agrupados):
        for w in self.scroll_c.winfo_children(): w.destroy()
        self.nrc_widgets = {}
        for nrc, hrs in agrupados.items():
            f = ctk.CTkFrame(self.scroll_c); f.pack(fill="x", pady=5, padx=10)
            det = True
            for i, h in enumerate(hrs):
                dia = h.dia_parseado or self.parser.calcular_dia_de_fecha(h.fecha_inicio)
                if dia: self.selecciones_usuario[f"{nrc}_{i}"] = {'dia': dia, 'horario': h, 'nrc_original': nrc}
                else: det = False
            inner = ctk.CTkFrame(f, fg_color="transparent"); inner.pack(fill="x", padx=15, pady=10)
            ctk.CTkLabel(inner, text=f"{hrs[0].titulo} ({nrc})", font=ctk.CTkFont(size=14, weight="bold")).pack(side="left")
            st_l = ctk.CTkLabel(inner, text="Listo ✅" if det else "Falta Día ⏳", text_color="green" if det else "orange")
            st_l.pack(side="left", padx=20)

            ctk.CTkButton(inner, text="X", width=40, fg_color="#ef4444", command=lambda n=nrc: self.borrar_ramo(n)).pack(side="right", padx=5)
            ctk.CTkButton(inner, text="Días", width=80, command=lambda n=nrc, l=st_l: self.edit_dias(n, l)).pack(side="right", padx=5)

            self.nrc_widgets[nrc] = {'ok': det, 'hrs': hrs, 'card': f}

    def borrar_ramo(self, nrc):
        if nrc in self.nrc_widgets:
            self.nrc_widgets[nrc]['card'].destroy()
            del self.nrc_widgets[nrc]
            for k in list(self.selecciones_usuario.keys()):
                if k.startswith(f"{nrc}_"): del self.selecciones_usuario[k]

    def edit_dias(self, nrc, lbl):
        win = ctk.CTkToplevel(self.root); win.title(f"Ajustar {nrc}"); win.geometry("400x500"); win.attributes("-topmost", True)
        dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        hrs = self.nrc_widgets[nrc]['hrs']; sel_list = []
        for i, h in enumerate(hrs):
            f = ctk.CTkFrame(win); f.pack(fill="x", padx=35, pady=6)
            ctk.CTkLabel(f, text=f"{h.hora_str}:").pack(side="left")
            s = ctk.CTkOptionMenu(f, values=dias); s.set(self.selecciones_usuario.get(f"{nrc}_{i}", {}).get('dia', 'Lunes'))
            s.pack(side="right"); sel_list.append(s)
        def save():
            for i, s in enumerate(sel_list): self.selecciones_usuario[f"{nrc}_{i}"] = {'dia': s.get(), 'horario': hrs[i], 'nrc_original': nrc}
            lbl.configure(text="Listo ✅", text_color="green"); self.nrc_widgets[nrc]['ok'] = True; win.destroy()
        ctk.CTkButton(win, text="Guardar", command=save, height=45).pack(pady=35)

    def generar_final(self):
        try:
            # Ejecutar optimización en background para no bloquear la UI
            prefs = {'no_temprano': self.pref_no_temprano.get(), 'no_tarde': self.pref_no_tarde.get(), 'sin_ventanas': self.pref_sin_ventanas.get(), 'sin_sabados': self.pref_sin_sabados.get()}
            self.show_loader('Generando horarios...')

            def _gen_task():
                try:
                    cand = self.optimizer.procesar_selecciones_usuario(self.selecciones_usuario)
                    mejores, msg = self.optimizer.generar_top_horarios(cand, top_n=20, preferencias=prefs)
                except Exception as e:
                    mejores, msg = None, str(e)

                def _on_done():
                    try: self.hide_loader()
                    except Exception: pass
                    if mejores is None:
                        messagebox.showerror('Generador', f'Error generando horarios: {msg}')
                        return
                    if not mejores:
                        messagebox.showerror('Generador', msg)
                        return
                    self.mejores_horarios = mejores
                    self.indice_horario_actual = 0
                    try:
                        self.render_grid()
                        self.tabview.set('3. Horario Optimizado')
                    except Exception as e:
                        messagebox.showerror('Generador', f'Error actualizando UI: {e}')

                try:
                    self.root.after(0, _on_done)
                except Exception:
                    _on_done()

            threading.Thread(target=_gen_task, daemon=True).start()

        except Exception as e:
            messagebox.showerror("Generador", str(e))

    # --- PESTAÑA 3: GRID (CORREGIDO) ---
    def setup_tab_horario(self):
        tab = self.tabview.tab("3. Horario Optimizado")
        tab.grid_columnconfigure(0, weight=1); tab.grid_rowconfigure(1, weight=1)

        header = ctk.CTkFrame(tab); header.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        self.lbl_nav = ctk.CTkLabel(header, text="Cargando...", font=ctk.CTkFont(weight="bold"))
        self.lbl_nav.pack(side="left", padx=20)
        ctk.CTkButton(header, text="Nueva Opción", command=self.next_hor, width=120).pack(side="left", padx=10)

        ctk.CTkButton(header, text="🗑️ REINICIAR TODO", fg_color="#ef4444", hover_color="#dc2626",
                      command=self.reiniciar_todo, width=150).pack(side="right", padx=20)

        main_split = ctk.CTkFrame(tab, fg_color="transparent")
        main_split.grid(row=1, column=0, sticky="nsew")
        main_split.grid_columnconfigure(0, weight=4); main_split.grid_columnconfigure(1, weight=1)
        main_split.grid_rowconfigure(0, weight=1)

        # Frame para el grid (NO ScrollableFrame para evitar bugs)
        grid_container = ctk.CTkFrame(main_split)
        grid_container.grid(row=0, column=0, sticky="nsew", padx=(0, 10))

        # Canvas + Scrollbar manual
        self.canvas_horario = tk.Canvas(grid_container, bg="#1a1a1a", highlightthickness=0)
        scrollbar = ctk.CTkScrollbar(grid_container, command=self.canvas_horario.yview)
        self.canvas_horario.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side="right", fill="y")
        self.canvas_horario.pack(side="left", fill="both", expand=True)

        # Frame interno donde irá el grid
        self.scroll_g = ctk.CTkFrame(self.canvas_horario, fg_color="transparent")
        self.canvas_window = self.canvas_horario.create_window((0, 0), window=self.scroll_g, anchor="nw")

        self.scroll_g.bind("<Configure>", lambda e: self.canvas_horario.configure(scrollregion=self.canvas_horario.bbox("all")))

        self.legend_c = ctk.CTkScrollableFrame(main_split, label_text="Ramos")
        self.legend_c.grid(row=0, column=1, sticky="nsew")

    def next_hor(self):
        if not self.mejores_horarios: return
        self.indice_horario_actual = (self.indice_horario_actual + 1) % len(self.mejores_horarios); self.render_grid()

    def render_grid(self):
        # Limpiar
        for w in self.scroll_g.winfo_children(): w.destroy()
        for w in self.legend_c.winfo_children(): w.destroy()
        if not self.mejores_horarios:
            # Borrar contenido del editor JSON si existe (usar wrapper seguro)
            try:
                if hasattr(self, 'txt_export_json') and getattr(self.txt_export_json, 'winfo_exists', lambda: False)():
                    self.txt_export_json.delete("1.0", tk.END)
            except Exception:
                pass
            return

        self.lbl_nav.configure(text=f"Propuesta {self.indice_horario_actual + 1} de {len(self.mejores_horarios)}")
        cls = self.mejores_horarios[self.indice_horario_actual]

        # Actualizar JSON de exportación
        data_export = []
        for c in cls:
            data_export.append({
                "nrc": c.nrc, "titulo": c.titulo, "tipo": c.tipo, "seccion": c.seccion,
                "dia": c.dia, "hora": f"{c.hora_inicio} - {c.hora_fin}", "lugar": f"{c.edificio} {c.salon}"
            })
        # Actualizar editor JSON de forma segura (si existe)
        try:
            if hasattr(self, 'txt_export_json') and getattr(self.txt_export_json, 'winfo_exists', lambda: False)():
                self.txt_export_json.delete("1.0", tk.END)
                self.txt_export_json.insert("1.0", json.dumps(data_export, indent=4, ensure_ascii=False))
        except Exception:
            # Si el widget no existe o ocurrió error, ignorar para evitar crash de UI
            pass

        dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        # Generar lista de horas según la regla: empezar 08:00, sumar 1h30 repetidamente hasta
        # que el siguiente cruce pase 16:10; en ese caso, el último incremento será de 1h25.
        horas_list = []
        from datetime import time, datetime, timedelta
        cur = datetime.combine(datetime.today(), time(hour=8, minute=0))
        limit = datetime.combine(datetime.today(), time(hour=16, minute=10))
        while True:
            horas_list.append(cur.time().strftime('%H:%M'))
            # calcular siguiente con 1h30
            next1 = cur + timedelta(hours=1, minutes=30)
            if next1 > limit:
                # aplicar incremento final de 1h25 y terminar
                cur = cur + timedelta(hours=1, minutes=25)
                horas_list.append(cur.time().strftime('%H:%M'))
                break
            cur = next1
            # evitar bucle infinito si se pasa de 23:59
            if cur.day != datetime.today().day:
                break
        horas = horas_list

        # Configurar grid
        self.scroll_g.grid_columnconfigure(0, minsize=70)  # Columna de horas
        for i in range(len(dias)):
            self.scroll_g.grid_columnconfigure(i+1, minsize=150, weight=1)

        # Cabecera
        ctk.CTkLabel(self.scroll_g, text="", width=70, height=40).grid(row=0, column=0)
        for i, dia in enumerate(dias):
            ctk.CTkLabel(self.scroll_g, text=dia, fg_color="#1E3A8A", text_color="white",
                        width=150, height=40, corner_radius=4, font=("Inter", 12, "bold")).grid(row=0, column=i+1, padx=2, pady=2, sticky="ew")

        # Filas de horas + celdas vacías (usar cadenas de horas)
        for j, hora in enumerate(horas):
            # Etiqueta de hora
            ctk.CTkLabel(self.scroll_g, text=f"{hora}", width=70, height=50,
                        fg_color=("gray80", "gray30"), font=("Inter", 11)).grid(row=j+1, column=0, padx=2, pady=1, sticky="nsew")

            # Celdas vacías de fondo
            for i in range(len(dias)):
                ctk.CTkFrame(self.scroll_g, width=150, height=50,
                            fg_color=("gray90", "gray20"), corner_radius=2).grid(row=j+1, column=i+1, padx=1, pady=1, sticky="nsew")

        # Dibujar clases SOBRE el grid
        colors = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0891B2', '#F59E0b']
        self.mapa_colores_actual = {}
        # Mapeo por título para asegurar mismos tonos base entre TEO/LAB del mismo ramo
        title_base = {}

        def hex_to_rgb(h: str):
            h = h.lstrip('#')
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

        def rgb_to_hex(rgb):
            return '#%02x%02x%02x' % (max(0, min(255, int(rgb[0]))), max(0, min(255, int(rgb[1]))), max(0, min(255, int(rgb[2]))))

        def adjust_brightness(hexcol: str, factor: float):
            r, g, b = hex_to_rgb(hexcol)
            return rgb_to_hex((r * factor, g * factor, b * factor))

        # Asignar color base por título
        for c in cls:
            if c.titulo not in title_base:
                title_base[c.titulo] = colors[len(title_base) % len(colors)]

        # Asignar color por NRC basado en tipo (TEO claro, LAB oscuro)
        for c in cls:
            base = title_base.get(c.titulo, colors[0])
            tipo_up = (c.tipo or '').upper()
            tipo_norm = 'TEO' if ('TEOR' in tipo_up or 'TEO' in tipo_up) else 'LAB' if ('LAB' in tipo_up or 'TALLER' in tipo_up or 'PRACT' in tipo_up) else 'OTRO'

            if tipo_norm == 'TEO':
                tone = adjust_brightness(base, 1.25)
            elif tipo_norm == 'LAB':
                tone = adjust_brightness(base, 0.8)
            else:
                tone = base

            if c.nrc not in self.mapa_colores_actual:
                self.mapa_colores_actual[c.nrc] = tone

            try:
                # Parsear horas
                hi_str, hf_str = c.hora_inicio, c.hora_fin
                hi = int(hi_str.split(':')[0])
                mi = int(hi_str.split(':')[1])
                hf = int(hf_str.split(':')[0])
                mf = int(hf_str.split(':')[1])

                # Parsear horas
                hi_str, hf_str = c.hora_inicio, c.hora_fin
                hi = int(hi_str.split(':')[0])
                mi = int(hi_str.split(':')[1])
                hf = int(hf_str.split(':')[0])
                mf = int(hf_str.split(':')[1])

                # Convertir lista de horas (strings) a minutos desde 00:00
                try:
                    start_minutes = []
                    for hh in horas:
                        hh_h, hh_m = [int(x) for x in hh.split(':')]
                        start_minutes.append(hh_h * 60 + hh_m)
                except Exception:
                    start_minutes = [h*60 for h in range(8,22)]

                hi_min = hi * 60 + mi
                hf_min = hf * 60 + mf

                # Encontrar la fila (índice) donde comienza la clase: el último start <= hi_min
                import bisect
                idx = bisect.bisect_right(start_minutes, hi_min) - 1
                if idx < 0:
                    # fuera del rango por debajo
                    continue

                # Determinar intervalo en minutos para esta fila
                if idx + 1 < len(start_minutes):
                    interval = start_minutes[idx+1] - start_minutes[idx]
                else:
                    # si es la última fila, repetir el último intervalo si existe
                    if len(start_minutes) >= 2:
                        interval = start_minutes[-1] - start_minutes[-2]
                    else:
                        interval = 60

                row_start = idx + 1  # +1 por la cabecera
                duracion_minutos = hf_min - hi_min
                # row_span basado en cuántos intervalos cubre la duración
                row_span = max(1, round(duracion_minutos / max(1, interval)))

                if c.dia in dias:
                    col = dias.index(c.dia) + 1

                    # Crear bloque de clase
                    bloque = ctk.CTkFrame(self.scroll_g, fg_color=self.mapa_colores_actual[c.nrc],
                                         corner_radius=6, border_width=2, border_color="white")
                    bloque.grid(row=row_start, column=col, rowspan=row_span, sticky="nsew", padx=3, pady=3)

                    # Texto VISIBLE
                    texto = f"{c.titulo[:20]}\n{hi_str}-{hf_str}"
                    lbl = ctk.CTkLabel(bloque, text=texto, text_color="white",
                                      font=("Inter", 10, "bold"), wraplength=130, justify="center")
                    lbl.pack(expand=True, fill="both", padx=5, pady=5)

            except Exception as e:
                print(f"Error dibujando clase: {e}")
                continue

        # Leyenda
        seen = set()
        for c in cls:
            if c.nrc in seen: continue
            seen.add(c.nrc)
            lf = ctk.CTkFrame(self.legend_c, fg_color=("gray88", "gray28"), corner_radius=8)
            lf.pack(fill="x", pady=4, padx=5)
            # Mostrar color y tipo (TEO/LAB)
            tipo_up = (c.tipo or '').upper()
            tipo_norm = 'TEO' if ('TEOR' in tipo_up or 'TEO' in tipo_up) else 'LAB' if ('LAB' in tipo_up or 'TALLER' in tipo_up or 'PRACT' in tipo_up) else 'OTRO'
            color_muestra = colors[0]
            if tipo_norm == 'TEO':
                color_muestra = adjust_brightness(self.mapa_colores_actual[c.nrc], 1.25)
            elif tipo_norm == 'LAB':
                color_muestra = adjust_brightness(self.mapa_colores_actual[c.nrc], 0.8)
            ctk.CTkLabel(lf, text=tipo_norm, width=10, height=10, fg_color=color_muestra, corner_radius=5).pack(side="left", padx=10, pady=2)
            # Mostrar título + NRC y sala si existe
            ley_text = f"{c.titulo} ({getattr(c,'nrc','?')})"
            sala = (getattr(c, 'edificio', '') or '').strip() + (' ' + (getattr(c,'salon','') or '').strip() if (getattr(c,'salon','') or '').strip() else '')
            if sala.strip():
                ley_text += f" — {sala.strip()}"
            ctk.CTkLabel(lf, text=ley_text, font=("Inter", 11)).pack(side="left", padx=10, pady=2)

    # --- PESTAÑA 4: EXPORTAR ---
    def setup_tab_export(self):
        # La pestaña 'Exportar' ahora será exclusivamente para exportar a Excel/CSV
        tab = self.tabview.tab("4. Exportar")
        tab.grid_columnconfigure(0, weight=1); tab.grid_rowconfigure(0, weight=1)

        self.export_frame = ctk.CTkScrollableFrame(tab, label_text="Exportar a Excel/CSV")
        self.export_frame.grid(row=0, column=0, sticky="nsew", pady=10)

        # Tabla de ramos (simple lista) - arriba
        self.export_table = ctk.CTkFrame(self.export_frame)
        self.export_table.pack(fill='x', padx=10, pady=(8,8))
        ctk.CTkLabel(self.export_table, text='Ramos (vista previa) — Se exportará el horario actualmente mostrado', font=ctk.CTkFont(size=12, weight='bold')).pack(anchor='w', pady=(4,6))

        # Contenedor para la mini-vista del horario (similar al optimizado)
        self.export_preview = ctk.CTkFrame(self.export_frame)
        self.export_preview.pack(fill='both', expand=True, padx=10, pady=(8,8))

        # Botones de acción: Exportar CSV (Excel puede abrir CSV)
        ft = ctk.CTkFrame(tab, fg_color="transparent")
        ft.grid(row=1, column=0, sticky="ew", pady=(5,0))
        ctk.CTkButton(ft, text="EXPORTAR HORARIO A CSV", command=self.export_current_schedule_csv, width=240, height=50).pack(side="right", padx=10)

    def copiar_json(self):
        try:
            if not hasattr(self, 'txt_export_json') or not getattr(self.txt_export_json, 'winfo_exists', lambda: False)():
                messagebox.showwarning('Copiar', 'No hay editor de JSON disponible para copiar.')
                return
            self.root.clipboard_clear()
            self.root.clipboard_append(self.txt_export_json.get("1.0", tk.END))
            messagebox.showinfo("Copiar a portapapeles", "El JSON ha sido copiado al portapapeles.")
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo copiar: {e}")

    def descargar_json(self):
        try:
            if not hasattr(self, 'txt_export_json') or not getattr(self.txt_export_json, 'winfo_exists', lambda: False)():
                messagebox.showwarning('Descargar JSON', 'No hay datos para descargar.')
                return
            data = self.txt_export_json.get("1.0", tk.END).strip()
            if not data:
                messagebox.showwarning("Descargar JSON", "No hay datos para descargar.")
                return
            # Pedir nombre de archivo
            nombre_archivo = ctk.CTkInputDialog(text="Ingresa el nombre del archivo (sin extensión):", title="Descargar JSON").get_input()
            if not nombre_archivo:
                return
            if not nombre_archivo.endswith(".json"):
                nombre_archivo += ".json"
            # Ruta completa
            carpeta = filedialog.askdirectory(title="Selecciona carpeta de destino")
            if not carpeta:
                return
            ruta_archivo = os.path.join(carpeta, nombre_archivo)
            with open(ruta_archivo, 'w', encoding='utf-8') as f:
                f.write(data)
            messagebox.showinfo("Descargar JSON", f"Archivo guardado como: {ruta_archivo}")
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo guardar el archivo: {e}")

    def export_current_schedule_csv(self):
        try:
            if not self.mejores_horarios:
                messagebox.showwarning('Exportar', 'No hay horario generado para exportar.')
                return
            idx = self.indice_horario_actual or 0
            cls = self.mejores_horarios[idx]
            # Construir filas: NRC, titulo, tipo, seccion, dia, hora, lugar
            rows = []
            for c in cls:
                rows.append([getattr(c,'nrc',''), getattr(c,'titulo',''), getattr(c,'tipo',''), getattr(c,'seccion',''), getattr(c,'dia',''), f"{getattr(c,'hora_inicio','')}-{getattr(c,'hora_fin','')}", f"{getattr(c,'edificio','')} {getattr(c,'salon','')}".strip()])
            # Pedir nombre de archivo
            nombre = ctk.CTkInputDialog(text='Ingresa nombre para el archivo (sin extensión):', title='Exportar CSV').get_input()
            if not nombre:
                return
            if not nombre.endswith('.csv'):
                nombre += '.csv'
            carpeta = filedialog.askdirectory(title='Selecciona carpeta de destino')
            if not carpeta:
                return
            ruta = os.path.join(carpeta, nombre)
            import csv
            with open(ruta, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['NRC','Titulo','Tipo','Seccion','Dia','Hora','Lugar'])
                for r in rows:
                    writer.writerow(r)
            messagebox.showinfo('Exportar', f'Archivo exportado: {ruta}')
        except Exception as e:
            messagebox.showerror('Error', str(e))

    # --- PESTAÑA 5: GESTIÓN JSON ---
    def setup_tab_json(self):
        tab = self.tabview.tab("5. Gestión JSON")
        tab.grid_columnconfigure(0, weight=1); tab.grid_rowconfigure(0, weight=1)

        # Area superior: JSON del horario completo
        self.scroll_j = ctk.CTkScrollableFrame(tab, label_text="Horario completo (JSON)")
        self.scroll_j.grid(row=0, column=0, sticky="nsew", pady=10)
        self.txt_export_json = ctk.CTkTextbox(self.scroll_j, font=("Consolas", 12), border_width=1)
        self.txt_export_json.pack(fill="both", expand=True, padx=5, pady=5)

        # Botones para el JSON completo y export general
        ft = ctk.CTkFrame(tab, fg_color="transparent")
        ft.grid(row=1, column=0, sticky="ew", pady=(5,0))
        ctk.CTkButton(ft, text="COPIAR JSON", command=self.copiar_json, width=200, height=50).pack(side="right", padx=10)
        ctk.CTkButton(ft, text="DESCARGAR JSON", command=self.descargar_json, width=200, height=50).pack(side="right", padx=10)
        ctk.CTkButton(ft, text="EXPORTAR HORARIO (CSV)", command=self.export_current_schedule_csv, width=220, height=50).pack(side="right", padx=10)

        # Area inferior: JSONs separados / ramos
        self.scroll_j_ramos = ctk.CTkScrollableFrame(tab, label_text="Ramos JSON separados")
        self.scroll_j_ramos.grid(row=2, column=0, sticky='nsew', pady=(8,8))
        # mantener compatibilidad con actualizar_json_tab que usa self.scroll_j
        # actualizar_json_tab mostrará los JSONs separados dentro de scroll_j_ramos
        try:
            # Si no existe scroll_j, crear uno básico
            if not hasattr(self, 'scroll_j'):
                # crear minimalista en la pestaña 5
                tab = self.tabview.tab("5. Gestión JSON")
                self.scroll_j = ctk.CTkScrollableFrame(tab, label_text="Ramos JSON")
                self.scroll_j.pack(fill="both", expand=True, padx=10, pady=10)
            for w in list(self.scroll_j.winfo_children()):
                w.destroy()
            for t, d in self.ramos_json_store.items():
                f = ctk.CTkFrame(self.scroll_j); f.pack(fill="x", pady=5, padx=10)
                header = ctk.CTkFrame(f, fg_color="transparent")
                header.pack(fill="x", padx=10, pady=5)
                ctk.CTkLabel(header, text=t, font=("Inter", 12, "bold")).pack(side="left")
                def _copy(txt=d.get('json_str', '')):
                    try:
                        self.root.clipboard_clear(); self.root.clipboard_append(txt); messagebox.showinfo("Copiado", f"JSON de {t} copiado al portapapeles.")
                    except Exception:
                        pass
                ctk.CTkButton(header, text="📋 Copiar", width=80, height=24, command=_copy).pack(side="right")
                tx = ctk.CTkTextbox(f, height=120); tx.insert("1.0", d.get('json_str', '')); tx.pack(fill="x", padx=10, pady=(0,10))
        except Exception:
            pass

    def actualizar_json_tab(self):
        """Actualizar la pestaña de gestión JSON con `ramos_json_store`."""
        try:
            # Llenar el editor global con el JSON del horario actual (si existe)
            try:
                if hasattr(self, 'txt_export_json') and getattr(self.txt_export_json, 'winfo_exists', lambda: False)():
                    # Construir JSON global a partir de ramos_json_store si no está vacío
                    if self.ramos_json_store:
                        # construir lista ordenada
                        data_export = {k: v.get('json_str','') for k,v in self.ramos_json_store.items()}
                        self.txt_export_json.delete('1.0', tk.END)
                        self.txt_export_json.insert('1.0', json.dumps({k: json.loads(v.get('json_str','{}')) if v.get('json_str') else {} for k,v in self.ramos_json_store.items()}, indent=4, ensure_ascii=False))
            except Exception:
                pass

            # Ramas JSON separados (usar scroll_j_ramos)
            if not hasattr(self, 'scroll_j_ramos'):
                return
            for w in list(self.scroll_j_ramos.winfo_children()):
                w.destroy()
            for t, d in self.ramos_json_store.items():
                f = ctk.CTkFrame(self.scroll_j_ramos); f.pack(fill="x", pady=5, padx=10)
                header = ctk.CTkFrame(f, fg_color="transparent")
                header.pack(fill="x", padx=10, pady=5)
                ctk.CTkLabel(header, text=t, font=("Inter", 12, "bold")).pack(side="left")
                def _copy(txt=d.get('json_str', '')):
                    try:
                        self.root.clipboard_clear(); self.root.clipboard_append(txt); messagebox.showinfo("Copiado", f"JSON de {t} copiado al portapapeles.")
                    except Exception:
                        pass
                ctk.CTkButton(header, text="📋 Copiar", width=80, height=24, command=_copy).pack(side="right")
                tx = ctk.CTkTextbox(f, height=120); tx.insert("1.0", d.get('json_str', '')); tx.pack(fill="x", padx=10, pady=(0,10))
        except Exception:
             pass

def main():
    _write_log('main start')
    try:
        root = ctk.CTk()
        app = HorarioAppProfesional(root)
        _write_log('Entering mainloop')
        root.mainloop()
    except Exception as e:
        _write_log(f'main exception: {e}')
        try:
            messagebox.showerror('Error crítico', f'Error al iniciar la aplicación: {e}')
        except Exception:
            print(f'Error crítico: {e}')


if __name__ == '__main__':
    main()
