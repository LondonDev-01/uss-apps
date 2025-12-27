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

from src.data.parser import ParserInteligente
from src.core.optimizer import OptimizadorReal
NEON_DB_URL = "postgresql://neondb_owner:npg_IhV8Zt4aoilr@ep-twilight-sound-adxqbeo9-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

from pathlib import Path

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

from src.auth.manager import AuthManager

# Configuración Global
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class HorarioAppProfesional:
    def __init__(self, root):
        self.root = root
        self.root.title("UniHorario USS Profesional")
        self.root.geometry("1400x900")
        
        # Obligar Pantalla Completa
        self.root.attributes("-zoomed", True)
        self.root.resizable(False, False)
        
        # Mostrar loader durante inicialización
        try:
            # show temporary loader window
            self._init_loader_shown = True
            # create minimal loader window attached to root (will be hidden later)
            # si show_loader depende de atributos no creados aún, solo crear bandera y usar show_loader después
        except Exception:
            self._init_loader_shown = False

        # Componentes lógicos
        self.parser = ParserInteligente()
        self.optimizer = OptimizadorReal()
        self.auth = AuthManager(NEON_DB_URL)

        # Ocultar ventana principal hasta login
        self.root.withdraw()
        # Generar/recuperar device id antes de abrir UI de login (evita condiciones de carrera)
        self.device_id = self._get_or_create_device_id()
        # Mostrar loader real y luego abrir login
        try:
            self.show_loader("Cargando aplicación...")
        except Exception:
            pass
        self.abrir_login()
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
        
        self.tabview.add("1. Datos del Portal")
        self.tabview.add("2. Datos Procesados")
        self.tabview.add("3. Horario Optimizado")
        self.tabview.add("4. Exportar")
        self.tabview.add("5. Gestión JSON")
        
        self.setup_tab_entrada()
        self.setup_tab_config()
        self.setup_tab_horario()
        self.setup_tab_export()
        self.setup_tab_json()

        # Ajustar visibilidad inicial de botones según sesión
        try:
            self._update_license_ui()
        except Exception:
            pass

    # --- HELPERS ---
    def add_enter_nav(self, current, next_widget):
        current.bind("<Return>", lambda e: next_widget.focus())

    def create_password_entry(self, parent, placeholder, **kwargs):
        entry = ctk.CTkEntry(parent, placeholder_text=placeholder, show="*", **kwargs)
        entry.pack(fill="x", padx=40, pady=(5,0))
        
        def toggle():
            current = entry.cget("show")
            new_show = "" if current == "*" else "*"
            entry.configure(show=new_show)
            btn.configure(text="🔒 OCULTAR" if current == "*" else "👁️ MOSTRAR")
        
        btn = ctk.CTkButton(parent, text="👁️ MOSTRAR", height=25, width=100,
                            fg_color="transparent", text_color="#3B82F6",
                            font=("Inter", 11, "bold"), command=toggle)
        btn.pack(pady=(2, 8))
        return entry

    # --- Loader (overlay modal) ---
    def show_loader(self, text: str = "Cargando..."):
        try:
            if hasattr(self, '_loader_win') and self._loader_win:
                return
            w = ctk.CTkToplevel(self.root)
            w.geometry("300x120")
            w.title("")
            w.resizable(False, False)
            w.attributes("-topmost", True)
            w.transient(self.root)
            f = ctk.CTkFrame(w, fg_color=("#FFFFFF", "#1F2937"))
            f.pack(fill="both", expand=True, padx=10, pady=10)
            ctk.CTkLabel(f, text=text, font=ctk.CTkFont(size=12)).pack(pady=(8,6))
            pb = ctk.CTkProgressBar(f)
            pb.pack(fill="x", padx=10, pady=(6,8))
            pb.configure(mode="indeterminate")
            pb.start()
            # Store refs
            self._loader_win = w
            self._loader_progress = pb
        except Exception:
            pass

    def hide_loader(self):
        try:
            if hasattr(self, '_loader_progress') and self._loader_progress:
                try: self._loader_progress.stop()
                except: pass
            if hasattr(self, '_loader_win') and self._loader_win:
                try: self._loader_win.destroy()
                except: pass
        finally:
            self._loader_win = None
            self._loader_progress = None

    def _update_license_ui(self):
        """Muestra u oculta el botón 'Licencia' y 'Cerrar sesión' según el estado de autenticación."""
        try:
            if hasattr(self, 'auth') and self.auth and self.auth.current_user:
                # Usuario logueado: ocultar botón Licencia (solo visible para invitados) y mostrar logout
                try:
                    self.btn_license.pack_forget()
                except Exception:
                    pass
                try:
                    self.btn_logout.pack(side="right", padx=(0,10))
                except Exception:
                    pass
            else:
                # Invitado: mostrar Licencia y ocultar logout
                try:
                    self.btn_license.pack(side="right", padx=(0,10))
                except Exception:
                    pass
                try:
                    self.btn_logout.pack_forget()
                except Exception:
                    pass
        except Exception:
            pass

    # --- ACCESO ---
    def intentar_autologin(self):
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    u = data.get('u')
                    p = data.get('p')
                    mig = data.get('mig')
                    if u:
                        if mig:
                            # Sesión migrada anteriormente; recuperar estado sin validar contraseña
                            self.auth.current_user = u
                            self.auth.is_authenticated = True
                            # Mostrar licencia migrada
                            self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                            self.root.deiconify()
                            if hasattr(self, 'login_win_ref'): self.login_win_ref.destroy()
                        elif p:
                            ok, msg = self.auth.login(u, p, self.device_id)
                            if ok:
                                # Mostrar estado de licencia en la etiqueta
                                if self.auth.has_active_license(self.device_id):
                                    self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia activa)")
                                else:
                                    self.lbl_user_info.configure(text=f"Sesión: {u} (Sin licencia)")
                                self.root.deiconify()
                                if hasattr(self, 'login_win_ref'): self.login_win_ref.destroy()
                            else:
                                # Si llega aquí, podría requerir migrate_pass_hash; mantener invitado
                                self.lbl_user_info.configure(text="Invitado")
                        else:
                            self.lbl_user_info.configure(text="Invitado")
                            # No hay datos útiles para auto-login
                    else:
                        # No logged in; ensure UI shows invitado
                        self.lbl_user_info.configure(text="Invitado")
            except:
                pass
        # ocultar loader inicial (si fue mostrado)
        try:
            self.hide_loader()
        except Exception:
            pass
        # actualizar UI de licencia
        try:
            self._update_license_ui()
        except Exception:
            pass

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

    def limpiar_inputs(self):
        """Borra el contenido de los 3 textbox de entrada si existen."""
        try:
            if hasattr(self, 't0'):
                self.t0.delete('1.0', tk.END)
            if hasattr(self, 't1'):
                self.t1.delete('1.0', tk.END)
            if hasattr(self, 't2'):
                self.t2.delete('1.0', tk.END)
        except Exception:
            pass

    def procesar_todo(self):
        """Implementación mínima de procesamiento: valida textos y avanza a la pestaña de 'Datos Procesados'."""
        try:
            # Chequear licencia (si AuthManager está disponible)
            try:
                if hasattr(self, 'auth') and self.auth:
                    if not getattr(self.auth, 'has_active_license', lambda d: False)(self.device_id):
                        messagebox.showwarning('Licencia requerida', f'No puedes procesar sin una licencia activa. Contacta: {LICENSE_MIGRATION_CONTACT}', parent=self.root)
                        return
            except Exception:
                # Si falla la comprobación, continuar con precaución
                pass

            d0 = self.t0.get('1.0', tk.END).strip() if hasattr(self, 't0') else ''
            d1 = self.t1.get('1.0', tk.END).strip() if hasattr(self, 't1') else ''
            d2 = self.t2.get('1.0', tk.END).strip() if hasattr(self, 't2') else ''
            if not any([d0, d1, d2]):
                messagebox.showwarning('Atención', 'No hay datos para procesar.', parent=self.root)
                return

            # Mostrar loader mientras se 'procesa'
            try:
                self.show_loader('Procesando...')
                parsed = []
                modo = self.modo_parser.get() if hasattr(self, 'modo_parser') else 'Auto'
                if d0 and hasattr(self.parser, 'parsear_texto_por_prioridad'):
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d0, 0, modo=modo))
                if d1 and hasattr(self.parser, 'parsear_texto_por_prioridad'):
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d1, 1, modo=modo))
                if d2 and hasattr(self.parser, 'parsear_texto_por_prioridad'):
                    parsed.extend(self.parser.parsear_texto_por_prioridad(d2, 2, modo=modo))
                self.horarios_crudos = parsed
            finally:
                try: self.hide_loader()
                except: pass

            if not getattr(self, 'horarios_crudos', None):
                messagebox.showwarning('Parser', 'No se detectaron ramos válidos en el texto.', parent=self.root)
                return

            # Agrupar y preparar pestaña de configuración si es posible
            try:
                agrupados = self.parser.agrupar_por_nrc(self.horarios_crudos) if hasattr(self.parser, 'agrupar_por_nrc') else {}
                try:
                    self.cargar_config(agrupados)
                except Exception:
                    pass
                try:
                    self.tabview.set('2. Datos Procesados')
                except Exception:
                    pass
            except Exception as e:
                messagebox.showerror('Error', f'Error procesando datos: {e}', parent=self.root)
        except Exception as e:
            messagebox.showerror('Error inesperado', str(e), parent=self.root)

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
        ctk.CTkLabel(win, text=f"Si necesitas migrar, contacta: {LICENSE_MIGRATION_CONTACT} (el admin generará una clave temporal)", font=ctk.CTkFont(size=11), text_color="gray").pack(pady=(6,0))

        def do_release():
            if not active:
                messagebox.showinfo("Licencia", "No hay sesión remota para liberar.", parent=win)
                return
            if active == self.device_id:
                messagebox.showinfo("Licencia", "La sesión activa corresponde a este equipo.", parent=win)
                return
            if messagebox.askyesno("Confirmar", "Liberar la sesión remota? Esto permitirá iniciar en este equipo.", parent=win):
                try:
                    self.auth.logout(cur, active)
                    messagebox.showinfo("Éxito", "Sesión remota liberada.", parent=win)
                    win.destroy()
                except Exception as e:
                    messagebox.showerror("Error", str(e), parent=win)

        def do_force_transfer():
            # Pedir al admin el migrate_pass_hash (el admin debe generarlo desde su consola)
            mig_hash = ctk.CTkInputDialog(text="Ingresa el migrate_pass_hash proporcionado por el admin:", title="migrate_pass_hash").get_input()
            if not mig_hash:
                return
            try:
                self.show_loader("Validando migrate_pass_hash...")
                ok_apply, msg_apply = self.auth.apply_license(cur, mig_hash.strip())
            finally:
                self.hide_loader()
            if ok_apply:
                # Registrar la sesión activa en este device
                ok2, msg2 = self.auth.migrate_license(cur, self.device_id)
                if ok2:
                    messagebox.showinfo("Éxito", "Licencia transferida y activada en este equipo.", parent=win)
                    self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                    self.guardar_sesion(cur, 'LICENSE-MIGRATION')
                    win.destroy(); self._update_license_ui(); return
                else:
                    messagebox.showerror("Error", msg2, parent=win)
            else:
                messagebox.showerror("Error", msg_apply, parent=win)

        btn_rel = ctk.CTkButton(win, text="Liberar sesión remota", fg_color="#f97316", command=do_release)
        btn_rel.pack(pady=(6,4), padx=30, fill="x")
        btn_force = ctk.CTkButton(win, text="Transferir a este equipo (clave)", fg_color="#10b981", command=do_force_transfer)
        btn_force.pack(pady=(4,10), padx=30, fill="x")
        # Nota: las contraseñas de migración son administradas por el admin; si necesitas migrar, pide una clave temporal.

    def do_logout(self):
        # Cerrar sesión localmente y en servidor
        if not self.auth or not self.auth.current_user:
            messagebox.showinfo("Salir", "No hay sesión activa.")
            return
        user = self.auth.current_user
        try:
            self.auth.logout(user, self.device_id)
        except Exception:
            pass
        try:
            if os.path.exists(SESSION_FILE): os.remove(SESSION_FILE)
        except Exception:
            pass
        self.lbl_user_info.configure(text="Invitado")
        messagebox.showinfo("Salir", "Sesión cerrada.")
        # Volver al login: ocultar la ventana principal y abrir la ventana de login
        try:
            # Asegurar que no quede una ventana de login previa
            if hasattr(self, 'login_win_ref') and self.login_win_ref:
                try: self.login_win_ref.destroy()
                except: pass
            self.root.withdraw()
            self.abrir_login()
        except Exception:
            pass
        try:
            self._update_license_ui()
        except Exception:
            pass

    def abrir_login(self):
        self.login_win_ref = ctk.CTkToplevel(self.root)
        self.login_win_ref.title("UniHorario USS - Acceso")
        self.login_win_ref.geometry("450x550")
        self.login_win_ref.resizable(False, False)
        self.login_win_ref.attributes("-topmost", True)
        
        self.login_win_ref.update_idletasks()
        w, h = 450, 550
        x = (self.login_win_ref.winfo_screenwidth() // 2) - (w // 2)
        y = (self.login_win_ref.winfo_screenheight() // 2) - (h // 2)
        self.login_win_ref.geometry(f"{w}x{h}+{x}+{y}")
        
        bg = ctk.CTkFrame(self.login_win_ref, fg_color=("#F3F4F6", "#111827"), corner_radius=0)
        bg.pack(fill="both", expand=True)
        
        card = ctk.CTkFrame(bg, fg_color=("#FFFFFF", "#1F2937"), corner_radius=20, border_width=1, width=380, height=520)
        card.place(relx=0.5, rely=0.5, anchor="center")
        card.pack_propagate(False)
        
        ctk.CTkLabel(card, text="BIENVENIDO", font=("Inter", 28, "bold")).pack(pady=(40, 5))
        ctk.CTkLabel(card, text="Optimiza tu horario USS", font=("Inter", 13), text_color="gray").pack(pady=(0, 25))
        
        u_e = ctk.CTkEntry(card, placeholder_text="Nombre de usuario", height=42, corner_radius=8)
        u_e.pack(fill="x", padx=40, pady=5)
        
        p_e = self.create_password_entry(card, "Contraseña", height=42, corner_radius=8)
        
        def do_login(event=None):
            u, p = u_e.get(), p_e.get()
            if not u or not p:
                return
            try:
                self.show_loader("Validando credenciales...")
                ok, msg = self.auth.login(u, p, self.device_id)
            except Exception as e:
                try: self.hide_loader()
                except: pass
                messagebox.showerror("Error", f"Error al iniciar sesión: {e}", parent=self.login_win_ref)
                return
            try:
                self.hide_loader()
            except: pass

            if ok:
                # Sesión OK
                try:
                    self.guardar_sesion(u, p)
                    self.login_win_ref.destroy()
                except Exception:
                    pass
                try:
                    self.root.deiconify()
                    self.root.attributes("-zoomed", True)
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

            # Si falla el login, mostrar mensaje y permitir migración con migrate_pass_hash si corresponde
            try:
                messagebox.showerror("Error", msg, parent=self.login_win_ref)
            except Exception:
                pass

            if "otro dispositivo" in (msg or '').lower() or "2 dispositivos" in (msg or '').lower():
                if not messagebox.askyesno("Migrar licencia", "La cuenta está activa en otros dispositivos. ¿Migrar tu licencia a este dispositivo? Solicita al admin el migrate_pass_hash y pégalo a continuación.", parent=self.login_win_ref):
                    return
                mig_hash = ctk.CTkInputDialog(text="Pega aquí el migrate_pass_hash que te dio el admin:", title="migrate_pass_hash").get_input()
                if not mig_hash:
                    return
                try:
                    self.show_loader("Validando migrate_pass_hash...")
                    valid = self.auth.validate_migrate_hash(u, mig_hash.strip())
                finally:
                    try: self.hide_loader()
                    except: pass
                if not valid:
                    messagebox.showerror("Error", "migrate_pass_hash inválido o no coincide.", parent=self.login_win_ref)
                    return
                # Aplicar migración localmente
                ok2, msg2 = self.auth.migrate_license(u, self.device_id)
                if ok2:
                    try:
                        self.guardar_sesion(u, 'LICENSE-MIGRATION')
                        self.login_win_ref.destroy()
                        self.root.deiconify()
                        self.root.attributes("-zoomed", True)
                    except Exception:
                        pass
                    try:
                        self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                    except Exception:
                        pass
                    try:
                        self._update_license_ui()
                    except Exception:
                        pass
                else:
                    messagebox.showerror("Error", msg2, parent=self.login_win_ref)

        btn = ctk.CTkButton(card, text="INICIAR SESIÓN", command=do_login, height=48, corner_radius=10, font=("Inter", 14, "bold"))
        btn.pack(fill="x", padx=40, pady=(15, 10))

        ctk.CTkButton(card, text="¿No tienes cuenta? Regístrate gratis", fg_color="transparent", text_color="#3B82F6",
                      command=lambda: self.open_reg(self.login_win_ref)).pack()

        u_e.bind("<Return>", lambda e: p_e.focus())
        p_e.bind("<Return>", do_login)
        self.login_win_ref.protocol("WM_DELETE_WINDOW", lambda: self.root.destroy())

    def open_reg(self, parent):
        pass  # Implementar lógica de registro si es necesario

    # --- CARGA Y PROCESAMIENTO DE DATOS ---
    def setup_tab_entrada(self):
        """Configura la pestaña 1 con los 3 inputs principales tal como en la versión web:
        - Ramos principales
        - Ramos para adelantar
        - Electivos (si no lo tienes claro, elegimos uno al azar entre los que pongas)
        """
        tab = self.tabview.tab("1. Datos del Portal")
        # Layout básico: 3 columnas para los 3 campos
        tab.grid_columnconfigure((0,1,2), weight=1)
        tab.grid_rowconfigure(2, weight=1)

        # Preferencias (mantener simples)
        pf = ctk.CTkFrame(tab)
        pf.grid(row=0, column=0, columnspan=3, sticky="ew", pady=(0, 12), padx=8)
        ctk.CTkCheckBox(pf, text="Priorizar NO Entrar Temprano", ).pack(side="left", padx=8)
        ctk.CTkCheckBox(pf, text="Priorizar NO Salir Tarde", ).pack(side="left", padx=8)

        # Mensaje guía general
        ctk.CTkLabel(tab, text="Paso 1: Ingresa tus ramos por categoría (pega cada lista en su columna)", font=ctk.CTkFont(size=12, weight="bold")).grid(row=1, column=0, columnspan=3, sticky="w", padx=10, pady=(6,6))

        # Ramos principales
        lbl0 = ctk.CTkLabel(tab, text="📘 Ramos principales", font=ctk.CTkFont(size=12, weight="bold"))
        lbl0.grid(row=2, column=0, sticky="nw", padx=10, pady=(4,2))
        self.t0 = ctk.CTkTextbox(tab, height=220, font=("Consolas", 12))
        self.t0.grid(row=3, column=0, sticky="nsew", padx=10, pady=(0,10))

        # Ramos para adelantar
        lbl1 = ctk.CTkLabel(tab, text="☀️ Ramos para adelantar", font=ctk.CTkFont(size=12, weight="bold"))
        lbl1.grid(row=2, column=1, sticky="nw", padx=10, pady=(4,2))
        self.t1 = ctk.CTkTextbox(tab, height=220, font=("Consolas", 12))
        self.t1.grid(row=3, column=1, sticky="nsew", padx=10, pady=(0,10))

        # Electivos
        lbl2 = ctk.CTkLabel(tab, text="🍀 Electivos (si no lo tienes claro, elegimos uno al azar entre los que pongas)", font=ctk.CTkFont(size=12, weight="bold"))
        lbl2.grid(row=2, column=2, sticky="nw", padx=10, pady=(4,2))
        self.t2 = ctk.CTkTextbox(tab, height=220, font=("Consolas", 12))
        self.t2.grid(row=3, column=2, sticky="nsew", padx=10, pady=(0,10))

        # Botones de acción
        ft = ctk.CTkFrame(tab, fg_color="transparent")
        ft.grid(row=4, column=0, columnspan=3, sticky="ew", pady=(6, 12), padx=10)
        ctk.CTkButton(ft, text="Limpiar Texto", fg_color="#64748B", hover_color="#475569", command=self.limpiar_inputs, width=160).pack(side="left")
        ctk.CTkButton(ft, text="PROCESAR TODO", width=220, height=40, command=self.procesar_todo, fg_color="#2563EB").pack(side="right")

    def cargar_config(self, agrupados):
        """Implementación mínima para mostrar los ramos detectados en la pestaña 2.
        Esto evita errores cuando `procesar_todo` llama a `cargar_config`.
        """
        try:
            tab = self.tabview.tab("2. Datos Procesados")
            # Limpiar contenido previo si existe
            for w in tab.winfo_children():
                try: w.destroy()
                except: pass
            f = ctk.CTkFrame(tab)
            f.pack(fill="both", expand=True, padx=10, pady=10)
            ctk.CTkLabel(f, text="Ramos detectados (vista simplificada):", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="nw")
            # Mostrar lista simple
            for titulo, data in (agrupados.items() if isinstance(agrupados, dict) else []):
                try:
                    ctk.CTkLabel(f, text=f"- {titulo}").pack(anchor="nw", padx=6)
                except Exception:
                    pass
            # Guardar referencia mínima
            self.nrc_widgets = dict(agrupados)
        except Exception:
            # Fallback silencioso
            pass

    def setup_tab_config(self):
        pass  # Implementar configuración de tab de configuración

    def setup_tab_horario(self):
        pass  # Implementar configuración de tab de horario

    def setup_tab_export(self):
        pass  # Implementar configuración de tab de exportación

    def setup_tab_json(self):
        pass  # Implementar configuración de tab de gestión JSON

    # --- OPTIMIZACIÓN Y GENERACIÓN DE HORARIOS ---
    def optimizar_horario(self):
        pass  # Implementar lógica de optimización de horario

    def exportar_horario(self, formato="pdf"):
        pass  # Implementar lógica de exportación de horario

    def importar_json(self, archivo):
        pass  # Implementar lógica de importación desde JSON

    def exportar_json(self, archivo):
        pass  # Implementar lógica de exportación a JSON

    # --- SINCRONIZACIÓN Y ACTUALIZACIÓN ---
    def _periodic_license_check(self):
        pass  # Implementar lógica de chequeo periódico de licencia

    def _check_for_updates(self):
        pass  # Implementar lógica de chequeo de actualizaciones

    def _apply_update(self, archivo):
        pass  # Implementar lógica de aplicación de actualizaciones

    # --- MENSAJES Y NOTIFICACIONES ---
    def mostrar_mensaje(self, titulo, mensaje, tipo="info"):
        if tipo == "info":
            messagebox.showinfo(titulo, mensaje)
        elif tipo == "error":
            messagebox.showerror(titulo, mensaje)
        elif tipo == "warning":
            messagebox.showwarning(titulo, mensaje)

    # --- CONFIGURACIÓN Y PREFERENCIAS ---
    def cargar_preferencias(self):
        pass  # Implementar carga de preferencias

    def guardar_preferencias(self):
        pass  # Implementar guardado de preferencias

    # --- ESTADÍSTICAS Y REPORTES ---
    def generar_reporte(self, tipo="horario"):
        pass  # Implementar lógica de generación de reportes

    # --- ADMINISTRACIÓN ---
    def abrir_panel_admin(self):
        pass  # Implementar lógica para abrir panel de administración

    def gestionar_usuarios(self):
        pass  # Implementar lógica para gestión de usuarios

    def gestionar_dispositivos(self):
        pass  # Implementar lógica para gestión de dispositivos

    def gestionar_licencias(self):
        pass  # Implementar lógica para gestión de licencias

    # --- MISC ---
    def acerca_de(self):
        pass  # Implementar lógica para mostrar información acerca de la aplicación

    def contactar_soporte(self):
        pass  # Implementar lógica para contactar soporte técnico

    def verificar_integridad_datos(self):
        pass  # Implementar lógica para verificar integridad de datos

    def reparar_datos(self):
        pass  # Implementar lógica para reparar datos si es necesario

    def respaldar_datos(self):
        pass  # Implementar lógica para respaldar datos

    def restaurar_datos(self):
        pass  # Implementar lógica para restaurar datos desde respaldo

    def cerrar_aplicacion(self):
        # Método para cerrar la aplicación de manera segura
        try:
            self.do_logout()  # Intentar cerrar sesión primero
        except Exception:
            pass
        finally:
            self.root.destroy()  # Cerrar la ventana principal

# Función de inicio
def main():
    root = ctk.CTk()
    app = HorarioAppProfesional(root)
    root.mainloop()


if __name__ == "__main__":
    import traceback
    try:
        main()
    except Exception as e:
        tb = traceback.format_exc()
        # Guardar traceback en archivo para depuración si la GUI falla al iniciar
        try:
            with open('launcher_desktop_error.log', 'w', encoding='utf-8') as fh:
                fh.write(tb)
        except Exception:
            pass
        print("Error al iniciar la aplicación. Se guardó el traceback en launcher_desktop_error.log")
        raise
