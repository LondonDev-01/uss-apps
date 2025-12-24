import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import tkinter.font as tkFont
import pyperclip
import json
import os
from datetime import datetime
from collections import defaultdict

from src.data.parser import ParserInteligente
from src.core.optimizer import OptimizadorReal
from src.core.models import HorarioCrudo, ClaseConDia
from src.auth.manager import AuthManager

# Configuración de base de datos remota
NEON_DB_URL = "postgresql://neondb_owner:REDACTED_CREDENTIAL@ep-twilight-sound-adxqbeo9-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

class HorarioAppCorregida:
    def __init__(self, root):
        self.root = root
        self.root.title("📅 UniHorario USS - Optimizador Inteligente")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        # Componentes lógicos
        self.parser = ParserInteligente()
        self.optimizer = OptimizadorReal()
        self.auth = AuthManager(NEON_DB_URL)
        
        # Configuración de estilos y colores
        self.setup_styles()
        
        # Ocultar ventana principal hasta login
        self.root.withdraw()
        self.abrir_login()
        
        # Estado de la aplicación
        self.horarios_crudos = []  # Lista de HorarioCrudo (sin días)
        self.selecciones_usuario = {}  # {clave_bloque: {'dia': str, 'horario': HorarioCrudo}}
        self.nrc_widgets = {}  # {nrc: {'widget': frame, 'asignado': bool}}
        
        # Preferencias de Optimización
        self.pref_no_temprano = tk.BooleanVar(value=True)
        self.pref_no_tarde = tk.BooleanVar(value=True)
        self.pref_sin_ventanas = tk.BooleanVar(value=True)
        self.pref_sin_sabados = tk.BooleanVar(value=True)
        
        # Gestión de Múltiples Soluciones
        self.mejores_horarios = [] # Lista de listas de ClaseConDia
        self.indice_horario_actual = 0
        self.mapa_colores_actual = {} # Para consistencia visual
        
        # Almacén de JSONs de ramos
        self.ramos_json_store = {} # {nrc: {titulo, json_str}}
        
        # Interfaz
        self.setup_ui()
        self.center_window()
        
        # Manejo de cierre
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def on_closing(self):
        """Manejar cierre seguro de la aplicación"""
        self.root.destroy()
    
    def abrir_login(self):
        """Diálogo de autenticación y registro"""
        login_win = tk.Toplevel(self.root)
        login_win.title("Acceso UniHorario USS")
        login_win.geometry("400x500")
        login_win.configure(bg=self.colors['bg_main'])
        login_win.resizable(False, False)
        
        # Centrar
        login_win.update_idletasks()
        x = (login_win.winfo_screenwidth() // 2) - 200
        y = (login_win.winfo_screenheight() // 2) - 250
        login_win.geometry(f"+{x}+{y}")
        
        container = ttk.Frame(login_win, padding=30)
        container.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(container, text="🔑 Inicio de Sesión", font=self.fonts['h1'], foreground=self.colors['primary']).pack(pady=(0,20))
        
        ttk.Label(container, text="Usuario").pack(anchor=tk.W)
        user_var = tk.StringVar()
        user_entry = ttk.Entry(container, textvariable=user_var, font=self.fonts['body'])
        user_entry.pack(fill=tk.X, pady=(5,15))
        
        ttk.Label(container, text="Contraseña").pack(anchor=tk.W)
        pass_var = tk.StringVar()
        pass_entry = ttk.Entry(container, textvariable=pass_var, show="*", font=self.fonts['body'])
        pass_entry.pack(fill=tk.X, pady=(5,25))
        
        def intentar_login():
            user = user_var.get()
            pwd = pass_var.get()
            success, msg = self.auth.login(user, pwd)
            if success:
                messagebox.showinfo("Bienvenido", f"¡Hola {user}! Acceso concedido.")
                login_win.destroy()
                self.root.deiconify() # Mostrar app principal
                self.actualizar_label_usuario()
            else:
                messagebox.showwarning("Acceso Denegado", msg)

        def abrir_registro():
            reg_win = tk.Toplevel(login_win)
            reg_win.title("Registro de Usuario")
            reg_win.geometry("350x400")
            reg_win.transient(login_win)
            reg_win.grab_set()
            
            reg_container = ttk.Frame(reg_win, padding=20)
            reg_container.pack(fill=tk.BOTH, expand=True)
            
            ttk.Label(reg_container, text="📝 Crear Cuenta", font=self.fonts['h2']).pack(pady=(0,20))
            
            ttk.Label(reg_container, text="Nuevo Usuario").pack(anchor=tk.W)
            r_user = tk.StringVar()
            ttk.Entry(reg_container, textvariable=r_user).pack(fill=tk.X, pady=5)
            
            ttk.Label(reg_container, text="Contraseña").pack(anchor=tk.W)
            r_pass = tk.StringVar()
            ttk.Entry(reg_container, textvariable=r_pass, show="*").pack(fill=tk.X, pady=5)
            
            def ejecutar_registro():
                u, p = r_user.get(), r_pass.get()
                ok, res = self.auth.register(u, p)
                if ok:
                    messagebox.showinfo("Registrado", res)
                    reg_win.destroy()
                else:
                    messagebox.showerror("Error", res)

            ttk.Button(reg_container, text="Registrar Ahora", command=ejecutar_registro, style='Success.TButton').pack(pady=20, fill=tk.X)

        ttk.Button(container, text="Entrar", command=intentar_login, style='Primary.TButton').pack(fill=tk.X, pady=5)
        ttk.Button(container, text="No tengo cuenta (Registrar)", command=abrir_registro).pack(fill=tk.X, pady=5)
        
        # Si cierran la ventana de login, cerrar toda la app
        login_win.protocol("WM_DELETE_WINDOW", lambda: self.root.destroy())

    def actualizar_label_usuario(self):
        """Muestra el usuario actual en la interfaz"""
        if self.auth.current_user:
            ttk.Label(self.root, text=f"👤 Sesión: {self.auth.current_user}", foreground=self.colors['secondary']).place(relx=0.98, rely=0.02, anchor=tk.NE)

    def setup_styles(self):
        """Configurar tema visual moderno y profesional"""
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # Paleta de colores "Clean Professional"
        self.colors = {
            'bg_main': '#F5F7FA',       # Fondo general suave
            'bg_content': '#FFFFFF',     # Fondo de contenido (tarjetas)
            'primary': '#2563EB',        # Azul vibrante profesional
            'primary_dark': '#1e40af',   # Azul oscuro para hover/títulos
            'secondary': '#64748B',      # Gris azulado para texto secundario
            'success': '#059669',        # Verde esmeralda
            'warning': '#D97706',        # Ámbar oscuro (legible)
            'error': '#DC2626',          # Rojo
            'text_main': '#1E293B',      # Gris muy oscuro (casi negro)
            'text_light': '#F8FAFC'      # Blanco/Gris muy claro
        }
        
        # Configuración global
        self.root.configure(bg=self.colors['bg_main'])
        
        # Fuentes
        self.fonts = {
            'h1': tkFont.Font(family="Segoe UI", size=18, weight="bold"),
            'h2': tkFont.Font(family="Segoe UI", size=14, weight="bold"),
            'body': tkFont.Font(family="Segoe UI", size=10),
            'body_bold': tkFont.Font(family="Segoe UI", size=10, weight="bold"),
            'mono': tkFont.Font(family="Consolas", size=9)
        }
        
        # Estilos de botones y frames
        self.style.configure('TFrame', background=self.colors['bg_main'])
        self.style.configure('Card.TFrame', background=self.colors['bg_content'], relief='flat')
        self.style.configure('TLabel', background=self.colors['bg_main'], foreground=self.colors['text_main'], font=self.fonts['body'])
        self.style.configure('Card.TLabel', background=self.colors['bg_content'], foreground=self.colors['text_main'])
        
        # Botones personalizados
        self.style.configure(
            'Primary.TButton',
            font=('Segoe UI', 10, 'bold'),
            background=self.colors['primary'],
            foreground='white',
            padding=10,
            borderwidth=0
        )
        self.style.map('Primary.TButton', background=[('active', self.colors['primary_dark'])])
        
        self.style.configure(
            'Success.TButton',
            font=('Segoe UI', 10, 'bold'),
            background=self.colors['success'],
            foreground='white',
            padding=10,
            borderwidth=0
        )
        self.style.map('Success.TButton', background=[('active', '#047857')])

        self.style.configure(
            'Accent.TButton', # Usado para acciones secundarias importantes
            font=('Segoe UI', 10, 'bold'),
            background=self.colors['secondary'],
            foreground='white',
            padding=8,
            borderwidth=0
        )
        
        self.style.configure(
            'Danger.TButton', # Para eliminar
            font=('Segoe UI', 9, 'bold'),
            background=self.colors['error'],
            foreground='white',
            padding=8,
            borderwidth=0
        )
    
    def center_window(self):
        self.root.update_idletasks()
        try:
            w = self.root.winfo_width()
            h = self.root.winfo_height()
            ws = self.root.winfo_screenwidth()
            hs = self.root.winfo_screenheight()
            x = (ws/2) - (w/2)
            y = (hs/2) - (h/2)
            self.root.geometry(f'{w}x{h}+{int(x)}+{int(y)}')
        except:
            pass # Si falla por alguna razón, no es crítico
    
    def setup_ui(self):
        # Notebook principal
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Pestañas
        self.tab_entrada = ttk.Frame(self.notebook, style='TFrame')
        self.tab_dias = ttk.Frame(self.notebook, style='TFrame')
        self.tab_horario = ttk.Frame(self.notebook, style='TFrame')
        self.tab_json = ttk.Frame(self.notebook, style='TFrame')
        self.tab_export = ttk.Frame(self.notebook, style='TFrame')
        
        self.notebook.add(self.tab_entrada, text=" 1. Datos del Portal ")
        self.notebook.add(self.tab_dias, text=" 2. Datos Procesados ")
        self.notebook.add(self.tab_horario, text=" 3. Horario Optimizado ")
        self.notebook.add(self.tab_export, text=" 4. Exportar ")
        self.notebook.add(self.tab_json, text=" 5. Gestión JSON ")
        
        self.setup_entrada_ui()
        self.setup_dias_ui()
        self.setup_horario_ui()
        self.setup_json_ui()
        self.setup_export_ui()
    
    # ------------------ PESTAÑA 1: ENTRADA ------------------
    def setup_entrada_ui(self):
        container = ttk.Frame(self.tab_entrada, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        # Header
        header_frame = ttk.Frame(container)
        header_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(header_frame, text="Paso 1: Ingreso de Ramos por Categoría", font=self.fonts['h1'], foreground=self.colors['primary']).pack(side=tk.LEFT)
        
        # Panel de Preferencias (Configuración de Algoritmo)
        prefs_frame = ttk.LabelFrame(container, text=" ⚙️ Preferencias de Horario ", padding=15)
        prefs_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Checkbutton(prefs_frame, text="Priorizar entrar más tarde", variable=self.pref_no_temprano).pack(side=tk.LEFT, padx=10)
        ttk.Checkbutton(prefs_frame, text="Priorizar salir más temprano ", variable=self.pref_no_tarde).pack(side=tk.LEFT, padx=10)
        ttk.Checkbutton(prefs_frame, text="Reducir ventanas", variable=self.pref_sin_ventanas).pack(side=tk.LEFT, padx=10)
        ttk.Checkbutton(prefs_frame, text="Evitar clases los Sábados", variable=self.pref_sin_sabados).pack(side=tk.LEFT, padx=10)

        # Layout de 3 columnas para entradas
        inputs_frame = ttk.Frame(container)
        inputs_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        # CATEGORÍA 0: OBLIGATORIOS (ROSA)
        self.frame_cat0 = ttk.LabelFrame(inputs_frame, text=" 🌸 Ramos del Semestre (Obligatorios) ", padding=10)
        self.frame_cat0.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        self.text_cat0 = scrolledtext.ScrolledText(self.frame_cat0, height=10, font=self.fonts['mono'], bg='#FFF1F2')
        self.text_cat0.pack(fill=tk.BOTH, expand=True)

        # CATEGORÍA 1: ADELANTAR (AMARILLO)
        self.frame_cat1 = ttk.LabelFrame(inputs_frame, text=" ☀️ Ramos para Adelantar (Opcionales) ", padding=10)
        self.frame_cat1.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        self.text_cat1 = scrolledtext.ScrolledText(self.frame_cat1, height=10, font=self.fonts['mono'], bg='#FEFCE8')
        self.text_cat1.pack(fill=tk.BOTH, expand=True)

        # CATEGORÍA 2: ELECTIVOS (VERDE)
        self.frame_cat2 = ttk.LabelFrame(inputs_frame, text=" 🍀 Ramos Electivos (Se elige uno) ", padding=10)
        self.frame_cat2.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        self.text_cat2 = scrolledtext.ScrolledText(self.frame_cat2, height=10, font=self.fonts['mono'], bg='#F0FDF4')
        self.text_cat2.pack(fill=tk.BOTH, expand=True)
        
        # Botón principal de acción
        bottom_frame = ttk.Frame(container, padding=(0, 10, 0, 0))
        bottom_frame.pack(fill=tk.X)
        
        self.lbl_status_entrada = ttk.Label(bottom_frame, text="Pega los datos en la categoría correspondiente.", foreground=self.colors['secondary'])
        self.lbl_status_entrada.pack(side=tk.LEFT, padx=10)
        
        ttk.Button(bottom_frame, text="Procesar Todos e ir a Paso 2 ➜", command=self.procesar_todo_prioridades, style='Primary.TButton').pack(side=tk.RIGHT)
        ttk.Button(bottom_frame, text="Limpiar Todo", command=self.limpiar_todas_entradas).pack(side=tk.RIGHT, padx=10)

    def limpiar_todas_entradas(self):
        self.text_cat0.delete('1.0', tk.END)
        self.text_cat1.delete('1.0', tk.END)
        self.text_cat2.delete('1.0', tk.END)
        self.lbl_status_entrada.config(text="Entradas limpias.")

    def procesar_todo_prioridades(self):
        self.horarios_crudos = []
        try:
            # Procesar cada área
            t0 = self.text_cat0.get('1.0', tk.END).strip()
            t1 = self.text_cat1.get('1.0', tk.END).strip()
            t2 = self.text_cat2.get('1.0', tk.END).strip()
            
            count = 0
            if t0: 
                h0 = self.parser.parsear_texto_por_prioridad(t0, 0)
                self.horarios_crudos.extend(h0)
                count += len(h0)
            if t1:
                h1 = self.parser.parsear_texto_por_prioridad(t1, 1)
                self.horarios_crudos.extend(h1)
                count += len(h1)
            if t2:
                h2 = self.parser.parsear_texto_por_prioridad(t2, 2)
                self.horarios_crudos.extend(h2)
                count += len(h2)
            
            if not self.horarios_crudos:
                messagebox.showwarning("Sin datos", "Por favor pega información en al menos una categoría.")
                return

            # ACTUALIZAR ALMACÉN JSON (Agrupado por Título como solicitó el usuario)
            ramos_por_titulo = defaultdict(list)
            for h in self.horarios_crudos:
                # Convertir a dict simple
                d = {
                    "nrc": h.nrc, "tipo": h.tipo, "seccion": h.seccion,
                    "hora": h.hora_str, "lugar": h.ubicacion, "liga": h.liga,
                    "conector": h.conector, "prioridad": h.prioridad
                }
                ramos_por_titulo[h.titulo].append(d)
            
            for titulo, secciones in ramos_por_titulo.items():
                self.ramos_json_store[titulo] = {
                    "titulo": titulo,
                    "json_str": json.dumps({
                        "curso": titulo,
                        "prioridad": secciones[0]['prioridad'],
                        "secciones": secciones
                    }, indent=4, ensure_ascii=False)
                }
            
            self.actualizar_json_tab()

            self.lbl_status_entrada.config(text=f"Procesados {count} bloques de horario.")
            
            # Agrupar y preparar paso 2
            agrupados = self.parser.agrupar_por_nrc(self.horarios_crudos)
            self.cargar_datos_paso_2(agrupados)
            self.notebook.select(self.tab_dias)

        except Exception as e:
            messagebox.showerror("Error", f"Error al procesar: {e}")

    # ------------------ PESTAÑA 2: ASIGNACIÓN DE DÍAS ------------------
    def setup_dias_ui(self):
        container = ttk.Frame(self.tab_dias, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        # Header
        header = ttk.Frame(container)
        header.pack(fill=tk.X, pady=(0, 15))
        ttk.Label(header, text="Paso 2: Datos Procesados", font=self.fonts['h1'], foreground=self.colors['primary']).pack(side=tk.LEFT)
        
        # Warning box
        warn_frame = ttk.Frame(container, style='Card.TFrame', padding=15)
        warn_frame.pack(fill=tk.X, pady=(0, 20))
        
        info_txt = ("Aquí debes asignar los días REALES a todos los cursos/secciones que te interesen.\n"
                   "El Optimizador elegirá la mejor combinación automáticamente.")
        
        ttk.Label(warn_frame, text="💡 CÓMO FUNCIONA EL OPTIMIZADOR", font=self.fonts['body_bold'], foreground=self.colors['warning'], background=self.colors['bg_content']).pack(anchor=tk.W)
        ttk.Label(warn_frame, text=info_txt, style='Card.TLabel').pack(anchor=tk.W)
        
        # Contenedor con scroll para los items
        list_container = ttk.Frame(container)
        list_container.pack(fill=tk.BOTH, expand=True)
        
        self.canvas_dias = tk.Canvas(list_container, bg=self.colors['bg_main'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_container, orient="vertical", command=self.canvas_dias.yview)
        self.scroll_frame_dias = ttk.Frame(self.canvas_dias, style='TFrame')
        
        self.scroll_frame_dias.bind(
            "<Configure>",
            lambda e: self.canvas_dias.configure(scrollregion=self.canvas_dias.bbox("all"))
        )
        self.canvas_window_dias = self.canvas_dias.create_window((0, 0), window=self.scroll_frame_dias, anchor="nw")
        
        # Ajustar ancho del frame al canvas
        def configure_frame_width(event):
            self.canvas_dias.itemconfig(self.canvas_window_dias, width=event.width)
        self.canvas_dias.bind('<Configure>', configure_frame_width)
        
        self.canvas_dias.configure(yscrollcommand=scrollbar.set)
        self.canvas_dias.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Footer con botón de continuar
        footer = ttk.Frame(container, padding=(0, 20, 0, 0))
        footer.pack(fill=tk.X)
        self.lbl_progreso = ttk.Label(footer, text="0 de 0 cursos listos", font=self.fonts['body_bold'], foreground=self.colors['secondary'])
        self.lbl_progreso.pack(side=tk.LEFT)
        
        self.btn_generar = ttk.Button(footer, text="Optimizar Horario Automáticamente ➜", command=self.generar_horario, state='disabled', style='Success.TButton')
        self.btn_generar.pack(side=tk.RIGHT)

    def cargar_datos_paso_2(self, agrupados):
        # Limpiar visualmente
        for widget in self.scroll_frame_dias.winfo_children():
            widget.destroy()
        
        self.nrc_widgets = {}
        
        if not agrupados:
            ttk.Label(self.scroll_frame_dias, text="No se encontraron datos.", font=self.fonts['h2']).pack(pady=50)
            return

        for nrc, horarios in agrupados.items():
            prioridad = horarios[0].prioridad
            # Colores por prioridad: Rosa (0), Amarillo (1), Verde (2)
            bg_card = '#FFF1F2' if prioridad == 0 else '#FEFCE8' if prioridad == 1 else '#F0FDF4'
            border_color = '#FDA4AF' if prioridad == 0 else '#FDE047' if prioridad == 1 else '#86EFAC'
            
            card = ttk.Frame(self.scroll_frame_dias, style='Card.TFrame', padding=15)
            card.pack(fill=tk.X, pady=5, padx=5)
            
            # Aplicar color de fondo manual (ttk.Frame es limitado, usamos un truco visual o simplemente el label interior)
            card_header = ttk.Frame(card, style='Card.TFrame')
            card_header.pack(fill=tk.X, pady=(0, 10))
            
            titulo_prefijo = "🌸 " if prioridad == 0 else "☀️ " if prioridad == 1 else "🍀 "
            titulo = f"{titulo_prefijo}{horarios[0].titulo}"
            tipo_actividad = horarios[0].tipo if horarios[0].tipo else "Desconocido"
            subtitulo = f"NRC: {nrc} | Sección: {horarios[0].seccion} | {tipo_actividad}"
            
            lbl_title = ttk.Label(card_header, text=titulo, font=self.fonts['body_bold'], style='Card.TLabel', foreground=self.colors['primary'])
            lbl_title.pack(anchor=tk.W)
            ttk.Label(card_header, text=subtitulo, font=self.fonts['mono'], style='Card.TLabel', foreground=self.colors['secondary']).pack(anchor=tk.W)
            
            # Detalles de los bloques y AUTO-DETECCIÓN
            bloques_text = ""
            todo_auto_asignado = True
            
            for idx, h in enumerate(horarios):
                # 1. Intentar detectar día explícito (parser)
                dia_detectado = h.dia_parseado
                
                # 2. Fallback: Calcular desde fecha
                if not dia_detectado:
                    dia_detectado = self.parser.calcular_dia_de_fecha(h.fecha_inicio)
                
                texto_dia = f" ({dia_detectado} ✅)" if dia_detectado else " (Sin fecha clara)"
                bloques_text += f"• {h.hora_str} en {h.ubicacion}{texto_dia}\n"
                
                if dia_detectado:
                    # Guardar selección automática
                    clave = f"{nrc}_{idx}"
                    self.selecciones_usuario[clave] = {
                        'dia': dia_detectado,
                        'horario': h,
                        'nrc_original': nrc
                    }
                else:
                    todo_auto_asignado = False
            
            ttk.Label(card, text=bloques_text.strip(), font=self.fonts['mono'], style='Card.TLabel').pack(anchor=tk.W, pady=(0, 10))
            
            # Estado y Botones
            action_frame = ttk.Frame(card, style='Card.TFrame')
            action_frame.pack(fill=tk.X)
            
            lbl_status = ttk.Label(action_frame, text="Pendiente", foreground=self.colors['error'], style='Card.TLabel', font=self.fonts['body_bold'])
            lbl_status.pack(side=tk.LEFT, pady=5)
            
            btn_eliminar = ttk.Button(action_frame, text="🗑️ Eliminar", command=lambda n=nrc: self.eliminar_nrc(n), style='Danger.TButton')
            btn_eliminar.pack(side=tk.RIGHT, padx=(10, 0))
            
            btn_asignar = ttk.Button(action_frame, text="⚙️ Asignar Días", command=lambda n=nrc, l=lbl_status: self.abrir_dialogo_dias(n, l))
            btn_asignar.pack(side=tk.RIGHT)
            
            # Si se auto-asignó todo
            if todo_auto_asignado and len(horarios) > 0:
                lbl_status.config(text="Listo (Auto-detectado)", foreground=self.colors['success'])
            
            self.nrc_widgets[nrc] = {
                'widget': card,
                'status_label': lbl_status,
                'asignado': todo_auto_asignado,  # Marcar como listo si se detectó todo
                'horarios': horarios
            }
            
        self.actualizar_progreso()

    def eliminar_nrc(self, nrc):
        """Elimina un NRC de la lista de candidatos y de las selecciones"""
        if messagebox.askyesno("Confirmar Eliminación", f"¿Estás seguro de eliminar el curso con NRC {nrc}?", parent=self.root):
            if nrc in self.nrc_widgets:
                self.nrc_widgets[nrc]['widget'].destroy()
                del self.nrc_widgets[nrc]
            
            claves_a_borrar = [k for k in self.selecciones_usuario.keys() if k.startswith(f"{nrc}_")]
            for k in claves_a_borrar:
                del self.selecciones_usuario[k]
            
            self.horarios_crudos = [h for h in self.horarios_crudos if h.nrc != nrc]
            
            self.actualizar_progreso()
            messagebox.showinfo("Eliminado", "Curso eliminado correctamente.", parent=self.root)

    def abrir_dialogo_dias(self, nrc, label_status):
        dialog = tk.Toplevel(self.root)
        dialog.title(f"Asignar Días - {nrc}")
        dialog.geometry("600x500")
        dialog.config(bg=self.colors['bg_main'])
        dialog.transient(self.root)
        dialog.grab_set()
        
        dialog.update_idletasks()
        try:
             x = self.root.winfo_x() + (self.root.winfo_width() // 2) - 300
             y = self.root.winfo_y() + (self.root.winfo_height() // 2) - 250
             dialog.geometry(f"+{int(x)}+{int(y)}")
        except:
             pass
        
        container = ttk.Frame(dialog, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(container, text=f"Asignar días para NRC: {nrc}", font=self.fonts['h2']).pack(pady=(0, 20))
        
        horarios = self.nrc_widgets[nrc]['horarios']
        vars_dias = []
        dias_semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        
        for idx, h in enumerate(horarios):
            block_frame = ttk.LabelFrame(container, text=f"Bloque {idx+1}: {h.hora_str}", padding=10)
            block_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(block_frame, text=f"Lugar: {h.ubicacion}").pack(anchor=tk.W)
            
            row_frame = ttk.Frame(block_frame)
            row_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(row_frame, text="Día:").pack(side=tk.LEFT)
            
            clave = f"{nrc}_{idx}"
            # IMPORTANTE: Usar el valor ya existente en selecciones_usuario (que podría ser el auto-detectado)
            # O intentar autodetectar ahora si no existe
            valor_defecto = dias_semana[0]
            if clave in self.selecciones_usuario:
                valor_defecto = self.selecciones_usuario[clave]['dia']
            else:
                 # Auto detectar como fallback (primero parser, luego fecha)
                 dia_auto = h.dia_parseado or self.parser.calcular_dia_de_fecha(h.fecha_inicio)
                 if dia_auto: valor_defecto = dia_auto

            var = tk.StringVar(value=valor_defecto)
            combo = ttk.Combobox(row_frame, textvariable=var, values=dias_semana, state="readonly", width=15)
            combo.pack(side=tk.LEFT, padx=10)
            
            vars_dias.append({'var': var, 'horario': h, 'idx': idx})
            
        def guardar():
            dias_asignados = []
            for item in vars_dias:
                dia = item['var'].get()
                dias_asignados.append(dia)
                clave = f"{nrc}_{item['idx']}"
                self.selecciones_usuario[clave] = {
                    'dia': dia,
                    'horario': item['horario'],
                    'nrc_original': nrc
                }
            
            dias_unicos = sorted(list(set(dias_asignados)), key=lambda d: dias_semana.index(d))
            label_status.config(text=f"Listo: {', '.join(dias_unicos)}", foreground=self.colors['success'])
            self.nrc_widgets[nrc]['asignado'] = True
            
            self.actualizar_progreso()
            dialog.destroy()
            
        ttk.Button(container, text="Guardar Confirmación", command=guardar, style='Success.TButton').pack(pady=20, fill=tk.X)

    def actualizar_progreso(self):
        total = len(self.nrc_widgets)
        listos = sum(1 for w in self.nrc_widgets.values() if w['asignado'])
        
        self.lbl_progreso.config(text=f"{listos} de {total} cursos configurados")
        
        if listos == total and total > 0:
            self.btn_generar.config(state='normal')
        else:
            self.btn_generar.config(state='disabled')

    def generar_horario(self):
        try:
            candidatos = self.optimizer.procesar_selecciones_usuario(self.selecciones_usuario)
            if not candidatos:
                messagebox.showwarning("Sin datos", "No hay cursos configurados.", parent=self.root)
                return

            # Recopilar preferencias
            preferencias = {
                'no_temprano': self.pref_no_temprano.get(),
                'no_tarde': self.pref_no_tarde.get(),
                'sin_ventanas': self.pref_sin_ventanas.get(),
                'sin_sabados': self.pref_sin_sabados.get()
            }

            # Ejecutar Optimizador Top Horarios (N=20)
            self.mejores_horarios, mensaje_debug = self.optimizer.generar_top_horarios(candidatos, top_n=20, preferencias=preferencias)
            
            if not self.mejores_horarios:
                messagebox.showerror(
                    "Error de Optimización", 
                    f"No se pudo generar un horario válido.\n\nCausa probable:\n{mensaje_debug}", 
                    parent=self.root
                )
                return
            
            # Resetear visor
            self.indice_horario_actual = 0
            
            messagebox.showinfo("Optimización Exitosa", f"¡Horarios Generados!\n{mensaje_debug}", parent=self.root)
            self.renderizar_horario()
            self.notebook.select(self.tab_horario)
            
        except Exception as e:
            messagebox.showerror("Error Crítico", f"Error al generar: {e}", parent=self.root)
            import traceback
            traceback.print_exc()

    # ------------------ PESTAÑA JSON: GESTIÓN DE DATOS ------------------
    def setup_json_ui(self):
        container = ttk.Frame(self.tab_json, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(container, text="Paso 4: Gestión de Datos JSON", font=self.fonts['h1'], foreground=self.colors['primary']).pack(anchor=tk.W, pady=(0, 10))
        
        info_frame = ttk.Frame(container, style='Card.TFrame', padding=15)
        info_frame.pack(fill=tk.X, pady=(0, 20))
        ttk.Label(info_frame, text="Aquí puedes ver, editar y re-procesar los ramos guardados.", style='Card.TLabel').pack(anchor=tk.W)

        # Scroll para la lista de JSONs
        list_container = ttk.Frame(container)
        list_container.pack(fill=tk.BOTH, expand=True)
        
        self.canvas_json = tk.Canvas(list_container, bg=self.colors['bg_main'], highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_container, orient="vertical", command=self.canvas_json.yview)
        self.scroll_frame_json = ttk.Frame(self.canvas_json, style='TFrame')
        
        self.scroll_frame_json.bind("<Configure>", lambda e: self.canvas_json.configure(scrollregion=self.canvas_json.bbox("all")))
        self.canvas_window_json = self.canvas_json.create_window((0, 0), window=self.scroll_frame_json, anchor="nw")
        
        def conf_width(e): self.canvas_json.itemconfig(self.canvas_window_json, width=e.width)
        self.canvas_json.bind('<Configure>', conf_width)
        
        self.canvas_json.configure(yscrollcommand=scrollbar.set)
        self.canvas_json.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def actualizar_json_tab(self):
        for widget in self.scroll_frame_json.winfo_children():
            widget.destroy()
            
        if not self.ramos_json_store:
            ttk.Label(self.scroll_frame_json, text="No hay ramos guardados.", font=self.fonts['body']).pack(pady=20)
            return

        for nrc, data in self.ramos_json_store.items():
            card = ttk.LabelFrame(self.scroll_frame_json, text=f"📦 {data['titulo']} (NRC: {nrc})", padding=10)
            card.pack(fill=tk.X, pady=5, padx=5)
            
            # Área de texto para el JSON (Editable)
            txt = scrolledtext.ScrolledText(card, height=6, font=self.fonts['mono'], bg='#f8f9fa')
            txt.insert('1.0', data['json_str'])
            txt.pack(fill=tk.X, pady=5)
            
            btn_frame = ttk.Frame(card)
            btn_frame.pack(fill=tk.X)
            
            def guardar_edit(n=nrc, t=txt):
                new_json = t.get('1.0', tk.END).strip()
                try:
                    json.loads(new_json) # Validar formato
                    self.ramos_json_store[n]['json_str'] = new_json
                    messagebox.showinfo("Éxito", "JSON actualizado localmente.")
                except:
                    messagebox.showerror("Error", "JSON inválido. No se guardó.")

            def reprocesar_uno(n=nrc, t=txt):
                content = t.get('1.0', tk.END).strip()
                # Simular pegado en tab 1
                self.text_area.delete('1.0', tk.END)
                self.text_area.insert('1.0', content)
                self.notebook.select(self.tab_entrada)
                self.procesar_texto()

            ttk.Button(btn_frame, text="💾 Guardar Cambios", command=guardar_edit).pack(side=tk.LEFT, padx=5)
            ttk.Button(btn_frame, text="🔄 Re-procesar este ramo", command=reprocesar_uno, style='Primary.TButton').pack(side=tk.LEFT, padx=5)
            ttk.Button(btn_frame, text="🗑️ Borrar", command=lambda n=nrc: self.borrar_de_almacen(n), style='Danger.TButton').pack(side=tk.RIGHT)

    def borrar_de_almacen(self, nrc):
        if nrc in self.ramos_json_store:
            del self.ramos_json_store[nrc]
            self.actualizar_json_tab()

    # ------------------ PESTAÑA 3: HORARIO FINAL ------------------
    def setup_horario_ui(self):
        container = ttk.Frame(self.tab_horario, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        # Header con navegación
        header = ttk.Frame(container)
        header.pack(fill=tk.X, pady=(0, 10))
        
        # Titulo y Label info
        info_nav = ttk.Frame(header)
        info_nav.pack(side=tk.LEFT)
        ttk.Label(info_nav, text="Paso 3: Tu Horario Semanal", font=self.fonts['h1'], foreground=self.colors['primary']).pack(anchor=tk.W)
        self.lbl_opcion_actual = ttk.Label(info_nav, text="Viendo opción 1", font=self.fonts['body'], foreground=self.colors['secondary'])
        self.lbl_opcion_actual.pack(anchor=tk.W)

        # Botones Navegación
        nav_btns = ttk.Frame(header)
        nav_btns.pack(side=tk.RIGHT)
        
        # Botón único circular
        ttk.Button(nav_btns, text="🔄 Ver otra opción", command=self.siguiente_opcion, style='Accent.TButton').pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(nav_btns, text="Exportar ➜", command=lambda: self.notebook.select(self.tab_export), style='Success.TButton').pack(side=tk.LEFT)
        
        # Layout Principal de Horario: Grid + Leyenda
        self.main_horario_paned = ttk.Panedwindow(container, orient=tk.HORIZONTAL)
        self.main_horario_paned.pack(fill=tk.BOTH, expand=True)
        
        # Lado Izquierdo: Horario
        self.horario_frame_left = ttk.Frame(self.main_horario_paned)
        self.main_horario_paned.add(self.horario_frame_left, weight=4)
        
        # Lado Derecho: Leyenda
        self.leyenda_frame_right = ttk.Frame(self.main_horario_paned, style='Card.TFrame', padding=10)
        self.main_horario_paned.add(self.leyenda_frame_right, weight=1)
        
        ttk.Label(self.leyenda_frame_right, text="Leyenda de Ramos", font=self.fonts['h2'], style='Card.TLabel', foreground=self.colors['primary']).pack(pady=(0, 10))
        
        self.leyenda_container = ttk.Frame(self.leyenda_frame_right, style='Card.TFrame')
        self.leyenda_container.pack(fill=tk.BOTH, expand=True)

        self.lbl_placeholder_horario = ttk.Label(self.horario_frame_left, text="Completa el paso 2 para ver tu horario aquí.", font=self.fonts['h2'], foreground=self.colors['secondary'])
        self.lbl_placeholder_horario.place(relx=0.5, rely=0.5, anchor=tk.CENTER)

    def siguiente_opcion(self):
        """Ciclar entre opciones disponibles de forma circular"""
        if not self.mejores_horarios: return
            
        total = len(self.mejores_horarios)
        if total > 1:
            self.indice_horario_actual = (self.indice_horario_actual + 1) % total
            self.renderizar_horario()

    def renderizar_horario(self):
        # Actualizar Label Info
        total = len(self.mejores_horarios)
        if total > 0:
            self.lbl_opcion_actual.config(text=f"Viendo opción {self.indice_horario_actual + 1} de {total}")
            clases_actuales = self.mejores_horarios[self.indice_horario_actual]
        else:
             return

        # Limpiar containers
        for widget in self.horario_frame_left.winfo_children():
            widget.destroy()
        for widget in self.leyenda_container.winfo_children():
            widget.destroy()
        
        # Canvas para scroll (Horario)
        canvas = tk.Canvas(self.horario_frame_left, bg='white')
        scrollbar_y = ttk.Scrollbar(self.horario_frame_left, orient="vertical", command=canvas.yview)
        scrollbar_x = ttk.Scrollbar(self.horario_frame_left, orient="horizontal", command=canvas.xview)
        
        frame_grid = ttk.Frame(canvas)
        
        val_block = canvas.create_window((0,0), window=frame_grid, anchor="nw")
        
        def conf(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
        frame_grid.bind("<Configure>", conf)
        
        canvas.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Dibujar malla
        dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        horas = [f"{h:02d}:00" for h in range(8, 23)]
        
        # Headers Días
        for i, dia in enumerate(dias):
            frm = tk.Frame(frame_grid, bg=self.colors['primary'], width=150, height=40)
            frm.grid(row=0, column=i+1, padx=1, pady=1, sticky="nsew")
            frm.pack_propagate(False)
            tk.Label(frm, text=dia, bg=self.colors['primary'], fg='white', font=self.fonts['body_bold']).pack(expand=True)
            
        # Headers Horas
        for j, hora in enumerate(horas):
            frm = tk.Frame(frame_grid, bg='#E2E8F0', width=60, height=60)
            frm.grid(row=j+1, column=0, padx=1, pady=1, sticky="nsew")
            frm.pack_propagate(False)
            tk.Label(frm, text=hora, bg='#E2E8F0', font=self.fonts['mono']).pack(expand=True)
            
            # Celdas vacías
            for i in range(len(dias)):
                cell = tk.Frame(frame_grid, bg='#F8FAFC', width=150, height=60)
                cell.grid(row=j+1, column=i+1, padx=1, pady=1, sticky="nsew")

        # Colocar Clases
        colores_ramos = ['#BFDBFE', '#BBF7D0', '#FEF3C7', '#FECACA', '#DDD6FE', '#F5D0FE']
        mapa_colores = {}
        idx_color = 0
        
        for clase in clases_actuales:
            if clase.nrc not in mapa_colores:
                mapa_colores[clase.nrc] = colores_ramos[idx_color % len(colores_ramos)]
                idx_color += 1
            
            try:
                h_inicio = int(clase.hora_inicio.split(':')[0])
                m_inicio = int(clase.hora_inicio.split(':')[1])
                h_fin = int(clase.hora_fin.split(':')[0])
                m_fin = int(clase.hora_fin.split(':')[1])
                
                start_row = (h_inicio - 8) + 1
                
                duracion_min = (h_fin * 60 + m_fin) - (h_inicio * 60 + m_inicio)
                span = round(duracion_min / 60)
                if span < 1: span = 1
                
                if clase.dia in dias:
                    col_idx = dias.index(clase.dia) + 1
                    
                    color = mapa_colores[clase.nrc]
                    card = tk.Frame(frame_grid, bg=color, borderwidth=1, relief='solid')
                    card.grid(row=start_row, column=col_idx, rowspan=span, sticky="nsew", padx=2, pady=2)
                    
                    # Info
                    lbl_t = tk.Label(card, text=f"{clase.titulo}", bg=color, font=('Segoe UI', 8, 'bold'), wraplength=140)
                    lbl_t.pack(pady=(2,0))
                    tk.Label(card, text=f"NRC: {clase.nrc}", bg=color, font=('Consolas', 8, 'bold')).pack()
                    tk.Label(card, text=f"{clase.hora_inicio} - {clase.hora_fin}", bg=color, font=('Segoe UI', 7)).pack()
                
            except Exception as e:
                print(f"Error renderizando {clase.titulo}: {e}")

        # --- RELLENAR LEYENDA ---
        self.mapa_colores_actual = mapa_colores
        for nrc, color in mapa_colores.items():
            # Buscar info del ramo
            clase_info = next((c for c in clases_actuales if c.nrc == nrc), None)
            if not clase_info: continue
            
            l_item = ttk.Frame(self.leyenda_container, style='Card.TFrame', padding=5)
            l_item.pack(fill=tk.X, pady=2)
            
            # Cuadro de color
            color_box = tk.Frame(l_item, bg=color, width=15, height=15, borderwidth=1, relief='solid')
            color_box.pack(side=tk.LEFT, padx=(0, 10))
            
            txt_info = f"{clase_info.titulo}\n{clase_info.tipo} | NRC: {nrc}"
            ttk.Label(l_item, text=txt_info, font=('Segoe UI', 8), style='Card.TLabel', justify=tk.LEFT).pack(side=tk.LEFT, fill=tk.X, expand=True)
            
            btn_del = tk.Button(l_item, text="✕", font=('Arial', 7), bg='#fee2e2', fg='#ef4444', 
                               relief='flat', command=lambda n=nrc: self.eliminar_nrc_directo(n))
            btn_del.pack(side=tk.RIGHT)

    def eliminar_nrc_directo(self, nrc):
        """Elimina un NRC y re-optimiza el horario"""
        # Eliminar de selecciones
        claves_a_borrar = [k for k in self.selecciones_usuario.keys() if k.startswith(f"{nrc}_")]
        for k in claves_a_borrar:
            del self.selecciones_usuario[k]
        
        # Eliminar de nrc_widgets para que no aparezca en Paso 2
        if nrc in self.nrc_widgets:
            del self.nrc_widgets[nrc]
            
        # Re-generar
        self.generar_horario()
        # Volver a cargar paso 2 visualmente para que esté sincronizado
        agrupados = self.parser.agrupar_por_nrc(self.horarios_crudos)
        # Filtrar solo los que quedan
        agrupados_restantes = {k: v for k, v in agrupados.items() if k in self.nrc_widgets}
        self.cargar_datos_paso_2(agrupados_restantes)

    # ------------------ PESTAÑA 4: EXPORTAR ------------------
    def setup_export_ui(self):
        container = ttk.Frame(self.tab_export, padding=20)
        container.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(container, text="Paso 4: Exportar Resultados", font=self.fonts['h1'], foreground=self.colors['primary']).pack(anchor=tk.W, pady=(0, 20))
        
        # Opciones
        box = ttk.Frame(container, style='Card.TFrame', padding=20)
        box.pack(fill=tk.X)
        
        ttk.Label(box, text="Selecciona el formato de salida:", style='Card.TLabel', font=self.fonts['h2']).pack(anchor=tk.W, pady=(0, 10))
        
        btn_frame = ttk.Frame(box, style='Card.TFrame')
        btn_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(btn_frame, text="📊 Descargar Excel (.xlsx) Simplificado", command=self.export_to_excel, style='Success.TButton').pack(side=tk.LEFT, padx=(0, 20))
        ttk.Button(btn_frame, text="📄 Descargar JSON", command=self.exportar_json).pack(side=tk.LEFT)
        
        ttk.Label(box, text="* El archivo Excel incluye una tabla simple y el horario visual.", font=self.fonts['body'], foreground=self.colors['secondary']).pack(pady=10)

    def export_to_excel(self):
        if not self.mejores_horarios:
            messagebox.showwarning("Atención", "No hay horarios generados para exportar.", parent=self.root)
            return

        filename = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx")],
            initialfile=f"Horario_Opcion_{self.indice_horario_actual + 1}.xlsx"
        )
        
        if filename:
            try:
                from src.data.excel_exporter import ExcelExporter
                ExcelExporter.exportar(self.mejores_horarios[self.indice_horario_actual], filename)
                messagebox.showinfo("Éxito", f"Horario exportado exitosamente a:\n{filename}", parent=self.root)
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo exportar el archivo: {str(e)}", parent=self.root)

    def exportar_json(self):
        if not self.mejores_horarios:
            messagebox.showwarning("Sin datos", "Primero genera el horario", parent=self.root)
            return

        filename = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if filename:
            try:
                clases_a_exportar = self.mejores_horarios[self.indice_horario_actual]
                datos = [{'titulo': c.titulo, 'dia': c.dia, 'hora': f"{c.hora_inicio}-{c.hora_fin}"} for c in clases_a_exportar]
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(datos, f, ensure_ascii=False, indent=2)
                messagebox.showinfo("Éxito", "JSON Exportado correctamente", parent=self.root)
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo guardar: {e}", parent=self.root)

if __name__ == "__main__":
    root = tk.Tk()
    app = HorarioAppCorregida(root)
    root.mainloop()