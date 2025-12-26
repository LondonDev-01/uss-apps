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
        
        # Componentes lógicos
        self.parser = ParserInteligente()
        self.optimizer = OptimizadorReal()
        self.auth = AuthManager(NEON_DB_URL)
        
        # Ocultar ventana principal hasta login
        self.root.withdraw()
        # Generar/recuperar device id antes de abrir UI de login (evita condiciones de carrera)
        self.device_id = self._get_or_create_device_id()
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
                            # Si la cuenta está activa en otro dispositivo, preguntar si quiere transferir
                            if "otro dispositivo" in msg.lower():
                                if messagebox.askyesno("Transferir licencia", "Cuenta activa en otro dispositivo. ¿Deseas migrar la licencia a este equipo? Esta acción cerrará la sesión remota."):
                                    ok2, msg2 = self.auth.login(u, p, self.device_id, transfer=True)
                                    if ok2:
                                        self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                                        self.root.deiconify()
                                        if hasattr(self, 'login_win_ref'): self.login_win_ref.destroy()
                                    else:
                                        messagebox.showerror("Error", f"No se pudo migrar la licencia: {msg2}")
                    else:
                        # No logged in; ensure UI shows invitado
                        self.lbl_user_info.configure(text="Invitado")
            except: pass

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
            # Pedir contraseña y forzar transferencia
            # Ofrecer transferencia por contraseña
            pwd = ctk.CTkInputDialog(text="Ingresa tu contraseña para transferir:", title="Confirmar transferencia").get_input()
            if pwd:
                try:
                    self.show_loader("Validando contraseña...")
                    ok, msg = self.auth.login(cur, pwd, self.device_id, transfer=True)
                finally:
                    self.hide_loader()
                if ok:
                    messagebox.showinfo("Éxito", "Licencia transferida a este equipo.", parent=win)
                    self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                    self.guardar_sesion(cur, pwd)
                    win.destroy()
                    self._update_license_ui()
                    return
                else:
                    # intentar con CLAVE TEMPORAL proporcionada por admin si la contraseña de usuario no funcionó
                    mig = ctk.CTkInputDialog(text="Ingresa la CLAVE TEMPORAL proporcionada por el admin:", title="Clave temporal").get_input()
                    if not mig:
                        messagebox.showerror("Error", msg, parent=win)
                        return
                    try:
                        self.show_loader("Validando clave temporal...")
                        valid = self.auth.validate_migration_key(mig.strip(), cur)
                    finally:
                        self.hide_loader()
                    if valid:
                        ok2, msg2 = self.auth.login(cur, pwd, self.device_id, transfer=True)
                        if ok2:
                            try: self.auth.delete_migration_key(mig.strip())
                            except: pass
                            messagebox.showinfo("Éxito", "Licencia transferida a este equipo.", parent=win)
                            self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                            self.guardar_sesion(cur, pwd)
                            win.destroy(); self._update_license_ui(); return
                        else:
                            messagebox.showerror("Error", msg2, parent=win)
                    else:
                        messagebox.showerror("Error", "Clave temporal inválida o expirada.", parent=win)

            # Alternativa: migrar con clave (válida si está en DB y no expiró)
            clave = ctk.CTkInputDialog(text="Ingresa la clave de migración proporcionada por el admin:", title="Migrar con clave").get_input()
            if not clave:
                return
            try:
                valid = self.auth.validate_migration_key(clave.strip(), cur)
            except Exception:
                valid = False
            if valid:
                ok, msg = self.auth.migrate_license(cur, self.device_id)
                if ok:
                    # borrar clave usada
                    try:
                        # Si la clave era una migration_key, elimínala; si fue password-based, no la borramos
                        self.auth.delete_migration_key(clave.strip())
                    except: pass
                    messagebox.showinfo("Éxito", "Licencia migrada correctamente a este equipo.")
                    self.lbl_user_info.configure(text=f"Sesión: {cur} (Licencia migrada)")
                    self.guardar_sesion(cur, 'LICENSE-MIGRATION')
                    win.destroy()
                    self._update_license_ui()
                else:
                    messagebox.showerror("Error", msg, parent=win)
            else:
                messagebox.showerror("Error", "Clave temporal inválida o expirada. Solicítala al admin.", parent=win)

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
            if not u or not p: return
            try:
                self.show_loader("Validando credenciales...")
                ok, msg = self.auth.login(u, p, self.device_id)
            except Exception as e:
                self.hide_loader()
                messagebox.showerror("Error", f"Error al iniciar sesión: {e}", parent=self.login_win_ref)
                return
            self.hide_loader()
            if ok:
                self.guardar_sesion(u, p)
                self.login_win_ref.destroy()
                # Mostrar ventana principal (si aún no fue creada o está oculta)
                try:
                    self.root.deiconify()
                    self.root.attributes("-zoomed", True)
                except Exception:
                    pass
                # Actualizar etiqueta de usuario si existe (y mostrar estado de licencia)
                if hasattr(self, 'lbl_user_info'):
                    try:
                        if self.auth.has_active_license(self.device_id):
                            self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia activa)")
                        else:
                            self.lbl_user_info.configure(text=f"Sesión: {u} (Sin licencia)")
                    except Exception:
                        pass
                # Actualizar UI relacionada a licencia
                try:
                    self._update_license_ui()
                except Exception:
                    pass
            else:
                messagebox.showerror("Error", msg, parent=self.login_win_ref)

            # Si está bloqueado por sesiones, ofrecer ingresar una CLAVE TEMPORAL proporcionada por el admin
            if not ok and ("otro dispositivo" in msg.lower() or "2 dispositivos" in msg.lower()):
                if messagebox.askyesno("Migrar licencia", "La cuenta está activa en otros dispositivos. ¿Migrar tu licencia a este dispositivo? Pide al admin una CLAVE TEMPORAL y cópiala aquí.", parent=self.login_win_ref):
                    clave = ctk.CTkInputDialog(text="Ingresa la CLAVE TEMPORAL proporcionada por el admin:", title="Clave temporal").get_input()
                    if not clave:
                        return
                    try:
                        self.show_loader("Validando clave temporal...")
                        valid = self.auth.validate_migration_key(clave.strip(), u)
                    finally:
                        self.hide_loader()
                    if valid:
                        ok2, msg2 = self.auth.login(u, p, self.device_id, transfer=True)
                        if ok2:
                            # Consumir la clave temporal
                            try: self.auth.delete_migration_key(clave.strip())
                            except: pass
                            self.guardar_sesion(u, p)
                            self.login_win_ref.destroy()
                            self.root.deiconify()
                            self.root.attributes("-zoomed", True)
                            self.lbl_user_info.configure(text=f"Sesión: {u} (Licencia migrada)")
                        else:
                            messagebox.showerror("Error", msg2, parent=self.login_win_ref)
                    else:
                        messagebox.showerror("Error", "Clave temporal inválida o expirada.", parent=self.login_win_ref)

        btn = ctk.CTkButton(card, text="INICIAR SESIÓN", command=do_login, height=48, corner_radius=10, font=("Inter", 14, "bold"))
        btn.pack(fill="x", padx=40, pady=(15, 10))
        
        ctk.CTkButton(card, text="¿No tienes cuenta? Regístrate gratis", fg_color="transparent", text_color="#3B82F6",
                      command=lambda: self.open_reg(self.login_win_ref)).pack()
        
        u_e.bind("<Return>", lambda e: p_e.focus())
        p_e.bind("<Return>", do_login)
        self.login_win_ref.protocol("WM_DELETE_WINDOW", lambda: self.root.destroy())

    def open_reg(self, parent):
        reg_win = ctk.CTkToplevel(parent)
        reg_win.title("Registro")
        reg_win.geometry("450x650")
        reg_win.resizable(False, False)
        
        bg = ctk.CTkFrame(reg_win, fg_color=("#F3F4F6", "#111827"), corner_radius=0)
        bg.pack(fill="both", expand=True)
        
        card = ctk.CTkFrame(bg, fg_color=("#FFFFFF", "#1F2937"), corner_radius=20, border_width=1, width=400, height=600)
        card.place(relx=0.5, rely=0.5, anchor="center")
        card.pack_propagate(False)

        ctk.CTkLabel(card, text="CREAR CUENTA", font=("Inter", 24, "bold")).pack(pady=(35, 20))
        
        ru = ctk.CTkEntry(card, placeholder_text="Nombre de usuario", height=40, corner_radius=8)
        ru.pack(fill="x", padx=45, pady=5)
        
        rt = ctk.CTkEntry(card, placeholder_text="WhatsApp", height=40, corner_radius=8)
        rt.pack(fill="x", padx=45, pady=5)

        rp1 = self.create_password_entry(card, "Nueva Contraseña", height=40, corner_radius=8)
        rp2 = self.create_password_entry(card, "Confirmar Contraseña", height=40, corner_radius=8)
        
        def do_reg():
            u, t, p1, p2 = ru.get(), rt.get(), rp1.get(), rp2.get()
            if not u or not p1 or p1 != p2:
                messagebox.showerror("Error", "Revisa los campos y que las claves coincidan.", parent=reg_win)
                return
            ok, msg = self.auth.register(u, p1, t)
            if ok:
                info = "Cuenta creada. Espera activación."
                info += f"\n\nNota: Si necesitas migrar la licencia en el futuro, solicita una CLAVE TEMPORAL al admin ({LICENSE_MIGRATION_CONTACT})."
                messagebox.showinfo("Éxito", info, parent=reg_win)
                reg_win.destroy()
            else:
                messagebox.showerror("Error", msg, parent=reg_win)
        
        btn = ctk.CTkButton(card, text="REGISTRARSE", command=do_reg, height=48, fg_color="#10B981", corner_radius=10)
        btn.pack(pady=20, padx=45, fill="x")
        ctk.CTkButton(card, text="Volver", fg_color="transparent", text_color="gray", command=reg_win.destroy).pack()

    # --- PESTAÑA 1: ENTRADA (SIN IA) ---
    def setup_tab_entrada(self):
        tab = self.tabview.tab("1. Datos del Portal")
        tab.grid_columnconfigure((0,1,2), weight=1); tab.grid_rowconfigure(2, weight=1)
        
        pf = ctk.CTkFrame(tab)
        pf.grid(row=0, column=0, columnspan=3, sticky="ew", pady=(0, 20))
        
        # Preferencias de Horario
        ctk.CTkCheckBox(pf, text="Priorizar NO Entrar Temprano", variable=self.pref_no_temprano).pack(side="left", padx=15, pady=10)
        ctk.CTkCheckBox(pf, text="Priorizar NO Salir Tarde", variable=self.pref_no_tarde).pack(side="left", padx=15)
        ctk.CTkCheckBox(pf, text="Menos Ventanas", variable=self.pref_sin_ventanas).pack(side="left", padx=15)
        ctk.CTkCheckBox(pf, text="Sin Sábados", variable=self.pref_sin_sabados).pack(side="left", padx=15)

        # Selector de Modo de Ingreso
        ctk.CTkLabel(pf, text="Método de Ingreso:", font=ctk.CTkFont(weight="bold")).pack(side="left", padx=(30, 5))
        self.menu_modo = ctk.CTkOptionMenu(pf, values=["Auto", "Tabular", "Visual", "JSON"], variable=self.modo_parser, width=120)
        self.menu_modo.pack(side="left", padx=5)
        
        # Campos de texto para pegar datos
        self.t0 = ctk.CTkTextbox(tab, font=("Consolas", 13), border_width=1)
        self.t0.grid(row=2, column=0, sticky="nsew", padx=5, pady=5)
        self.t1 = ctk.CTkTextbox(tab, font=("Consolas", 13), border_width=1)
        self.t1.grid(row=2, column=1, sticky="nsew", padx=5, pady=5)
        self.t2 = ctk.CTkTextbox(tab, font=("Consolas", 13), border_width=1)
        self.t2.grid(row=2, column=2, sticky="nsew", padx=5, pady=5)

        ft = ctk.CTkFrame(tab, fg_color="transparent")
        ft.grid(row=3, column=0, columnspan=3, sticky="ew", pady=(15, 0))
        
        # Solo botón de procesamiento local
        ctk.CTkButton(ft, text="PROCESAR TODO", width=200, height=50, command=self.procesar_todo, 
                  font=ctk.CTkFont(size=14, weight="bold")).pack(side="right", padx=10)
        ctk.CTkButton(ft, text="Limpiar Texto", fg_color="#64748B", hover_color="#475569", 
                  command=self.limpiar_inputs, width=120).pack(side="left", padx=5)

    def _update_license_ui(self):
        """Actualizar elementos visuales relacionados con la licencia (ocultar/mostrar botones y estado)."""
        try:
            # Determinar si la licencia está activa y asignada a este dispositivo
            active = False
            if self.auth and self.auth.current_user:
                try:
                    active = self.auth.is_license_active_on_device(self.auth.current_user, self.device_id)
                except Exception:
                    active = self.auth.has_active_license(self.device_id)
            else:
                active = False
            if active:
                # Ocultar botón de licencia si está activa
                try:
                    if self.btn_license.winfo_ismapped():
                        self.btn_license.pack_forget()
                except Exception:
                    pass
                # Mostrar texto de estado
                try:
                    self.lbl_license_status.configure(text="Licencia: Activa")
                except Exception:
                    pass
            else:
                # Mostrar el botón (si no está visible)
                try:
                    if not self.btn_license.winfo_ismapped():
                        self.btn_license.pack(side="right", padx=(0,10))
                except Exception:
                    pass
                try:
                    self.lbl_license_status.configure(text="Licencia: Inactiva")
                except Exception:
                    pass
        except Exception:
            pass

    def _periodic_license_check(self, interval_ms: int = 15000):
        """Revisa periódicamente si la licencia sigue activa en este dispositivo y actualiza la UI."""
        try:
            if self.auth and self.auth.current_user:
                active_on_device = False
                try:
                    active_on_device = self.auth.is_license_active_on_device(self.auth.current_user, self.device_id)
                except Exception:
                    active_on_device = self.auth.has_active_license(self.device_id)
                # Si ya no es activa, reflejarlo en UI
                if not active_on_device:
                    try:
                        self.lbl_user_info.configure(text=f"Sesión: {self.auth.current_user} (Sin licencia)")
                    except Exception:
                        pass
                    try:
                        self._update_license_ui()
                    except Exception:
                        pass
        except Exception:
            pass
        finally:
            try:
                self.root.after(interval_ms, lambda: self._periodic_license_check(interval_ms))
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
            self.tabview.set("1. Datos del Portal")
            messagebox.showinfo("Reinicio", "Todos los datos han sido borrados.")

    def procesar_todo(self):
        # Requerir licencia activa antes de procesar
        if not self.auth.has_active_license(self.device_id):
            messagebox.showwarning("Licencia requerida", f"No puedes procesar sin una licencia activa. Migra tu licencia contactando al desarrollador ({LICENSE_MIGRATION_CONTACT}) y proporciona esta llave: {LICENSE_MIGRATION_HASH}", parent=self.root)
            return
        self.horarios_crudos = []
        d0, d1, d2 = self.t0.get("1.0", tk.END).strip(), self.t1.get("1.0", tk.END).strip(), self.t2.get("1.0", tk.END).strip()
        modo = self.modo_parser.get()
        
        if not any([d0,d1,d2]): 
            messagebox.showwarning("Atención", "No hay datos para procesar.", parent=self.root)
            return
        # Mostrar loader durante el procesamiento (puede bloquear la UI brevemente)
        try:
            self.show_loader("Procesando horarios...")
            if d0: self.horarios_crudos.extend(self.parser.parsear_texto_por_prioridad(d0, 0, modo=modo))
            if d1: self.horarios_crudos.extend(self.parser.parsear_texto_por_prioridad(d1, 1, modo=modo))
            if d2: self.horarios_crudos.extend(self.parser.parsear_texto_por_prioridad(d2, 2, modo=modo))
        finally:
            self.hide_loader()
        
        if not self.horarios_crudos:
            messagebox.showwarning("Parser", "No se detectaron ramos válidos en el texto.\n\nAsegúrate de copiar el formato correcto del portal.")
            return
        
        self._avanzar()

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
            cand = self.optimizer.procesar_selecciones_usuario(self.selecciones_usuario)
            prefs = {'no_temprano': self.pref_no_temprano.get(), 'no_tarde': self.pref_no_tarde.get(), 'sin_ventanas': self.pref_sin_ventanas.get(), 'sin_sabados': self.pref_sin_sabados.get()}
            self.mejores_horarios, m = self.optimizer.generar_top_horarios(cand, top_n=20, preferencias=prefs)
            if not self.mejores_horarios: messagebox.showerror("Error", m); return
            self.indice_horario_actual = 0; self.render_grid(); self.tabview.set("3. Horario Optimizado")
        except Exception as e: messagebox.showerror("Generador", str(e))

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
            self.txt_export_json.delete("1.0", tk.END)
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
        self.txt_export_json.delete("1.0", tk.END)
        self.txt_export_json.insert("1.0", json.dumps(data_export, indent=4, ensure_ascii=False))

        dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        horas = list(range(8, 22))  # 8:00 a 21:00
        
        # Configurar grid
        self.scroll_g.grid_columnconfigure(0, minsize=70)  # Columna de horas
        for i in range(len(dias)):
            self.scroll_g.grid_columnconfigure(i+1, minsize=150, weight=1)
        
        # Cabecera
        ctk.CTkLabel(self.scroll_g, text="", width=70, height=40).grid(row=0, column=0)
        for i, dia in enumerate(dias):
            ctk.CTkLabel(self.scroll_g, text=dia, fg_color="#1E3A8A", text_color="white", 
                        width=150, height=40, corner_radius=4, font=("Inter", 12, "bold")).grid(row=0, column=i+1, padx=2, pady=2, sticky="ew")
        
        # Filas de horas + celdas vacías
        for j, hora in enumerate(horas):
            # Etiqueta de hora
            ctk.CTkLabel(self.scroll_g, text=f"{hora:02d}:00", width=70, height=50, 
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
                
                # Calcular posición en el grid
                if hi < 8 or hi >= 22: continue  # Fuera de rango
                
                row_start = (hi - 8) + 1  # +1 por la cabecera
                duracion_minutos = (hf * 60 + mf) - (hi * 60 + mi)
                row_span = max(1, round(duracion_minutos / 60))
                
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
            ctk.CTkLabel(lf, text="", width=14, height=14, fg_color=self.mapa_colores_actual[c.nrc], corner_radius=7).pack(side="left", padx=10, pady=8)
            ctk.CTkLabel(lf, text=f"{c.titulo} ({tipo_norm})\nNRC: {c.nrc}", font=("Inter", 10), justify="left").pack(side="left", pady=8)

    # --- EXPORT ---
    def setup_tab_export(self):
        tab = self.tabview.tab("4. Exportar")
        f = ctk.CTkFrame(tab, corner_radius=15); f.pack(pady=20, padx=100, fill="both", expand=True)
        ctk.CTkLabel(f, text="Exportar Horario", font=("Inter", 24, "bold")).pack(pady=20)
        
        # Sección Excel
        ctk.CTkLabel(f, text="📊 Formato Excel", font=("Inter", 16, "bold")).pack(pady=(10, 5))
        ctk.CTkButton(f, text="GUARDAR EXCEL", width=300, height=50, fg_color="#059669", 
                      font=("Inter", 14, "bold"), command=self.exp_excel).pack(pady=5)
        
        ctk.CTkLabel(f, text="--------------------------------------------------", text_color="gray").pack(pady=10)

        # Sección JSON
        ctk.CTkLabel(f, text="📄 Formato JSON", font=("Inter", 16, "bold")).pack(pady=(10, 5))
        
        json_frame = ctk.CTkFrame(f, fg_color="transparent")
        json_frame.pack(fill="both", expand=True, padx=50, pady=10)
        
        self.txt_export_json = ctk.CTkTextbox(json_frame, height=200, font=("Consolas", 12))
        self.txt_export_json.pack(fill="both", expand=True, pady=5)
        
        btn_json_f = ctk.CTkFrame(json_frame, fg_color="transparent")
        btn_json_f.pack(fill="x")
        
        ctk.CTkButton(btn_json_f, text="📋 COPIAR JSON", width=200, height=40, fg_color="#2563EB", 
                      command=self.copy_export_json).pack(side="left", padx=5)
        
        ctk.CTkButton(btn_json_f, text="💾 GUARDAR COMO ARCHIVO", width=200, height=40, fg_color="gray40", 
                      command=self.exp_json).pack(side="right", padx=5)

    def copy_export_json(self):
        txt = self.txt_export_json.get("1.0", tk.END).strip()
        if not txt or txt == "[]":
            messagebox.showwarning("Atención", "No hay horario generado para copiar.")
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(txt)
        messagebox.showinfo("Copiado", "JSON del horario copiado al portapapeles.")

    def exp_excel(self):
        if not self.mejores_horarios: 
            messagebox.showwarning("Atención", "Genera un horario primero.")
            return
        p = filedialog.asksaveasfilename(defaultextension=".xlsx", initialfile=f"Horario_Opcion_{self.indice_horario_actual+1}.xlsx")
        if p: 
            from src.data.excel_exporter import ExcelExporter
            ExcelExporter.exportar(self.mejores_horarios[self.indice_horario_actual], p)
            messagebox.showinfo("Éxito", "Excel guardado correctamente.")

    def exp_json(self):
        if not self.mejores_horarios: 
            messagebox.showwarning("Atención", "Genera un horario primero.")
            return
        p = filedialog.asksaveasfilename(defaultextension=".json", initialfile=f"Horario_Opcion_{self.indice_horario_actual+1}.json")
        if p:
            horario_actual = self.mejores_horarios[self.indice_horario_actual]
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
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data_export, f, indent=4, ensure_ascii=False)
            messagebox.showinfo("Éxito", "JSON guardado correctamente.")

    # --- JSON ---
    def setup_tab_json(self):
        tab = self.tabview.tab("5. Gestión JSON"); self.scroll_j = ctk.CTkScrollableFrame(tab); self.scroll_j.pack(fill="both", expand=True, padx=20, pady=20)

    def actualizar_json_tab(self):
        for w in self.scroll_j.winfo_children(): w.destroy()
        for t, d in self.ramos_json_store.items():
            f = ctk.CTkFrame(self.scroll_j); f.pack(fill="x", pady=5, padx=10)
            
            header = ctk.CTkFrame(f, fg_color="transparent")
            header.pack(fill="x", padx=10, pady=5)
            
            ctk.CTkLabel(header, text=t, font=("Inter", 12, "bold")).pack(side="left")
            
            def copy_to_clip(txt=d['json_str']):
                self.root.clipboard_clear()
                self.root.clipboard_append(txt)
                messagebox.showinfo("Copiado", f"JSON de {t} copiado al portapapeles.")

            ctk.CTkButton(header, text="📋 Copiar", width=80, height=24, command=copy_to_clip).pack(side="right")
            
            tx = ctk.CTkTextbox(f, height=120)
            tx.insert("1.0", d['json_str'])
            tx.pack(fill="x", padx=10, pady=(0, 10))

if __name__ == "__main__":
    root = ctk.CTk(); app = HorarioAppProfesional(root); root.mainloop()