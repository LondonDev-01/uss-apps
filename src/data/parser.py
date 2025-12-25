import re
import json
from typing import List, Dict, Optional, Tuple
from datetime import date
from src.core.models import HorarioCrudo

class ParserInteligente:
    """Clase encargada de transformar texto plano y JSON en objetos de dominio HorarioCrudo"""
    def __init__(self):
        self.patron_titulo = re.compile(r'^([A-Z][A-Z\sÁÉÍÓÚÑ\-]+)$')
        
        self.patron_datos = re.compile(
            r'^([^\t]+)\t'    # Tipo
            r'([^\t]+)\t'     # Descripción
            r'([^\t]+)\t'     # Número curso
            r'([^\t]+)\t'     # Sección
            r'(\d+)\t'        # Créditos
            r'(\d+)\t'        # NRC
            r'([^\t]+)\t'     # Periodo
            r'([^\t]+)'       # Instructor
        )
        
        self.patron_horario = re.compile(
            r'(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*'
            r'Tipo:\s*([A-ZÁÉÍÓÚÑ]+)\s*'
            r'Edificio:\s*(.+?)\s*'
            r'Salón:\s*(.+?)\s*'
            r'Fecha de inicio:\s*(.+?)\s*'
            r'Fecha de fin:\s*(.+?)$'
        )
        
        self.patron_cupos = re.compile(r'(\d+)\s*de\s*(\d+)\s*lugares\s*disponibles\.')
        self.patron_dia = re.compile(r'^(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)$', re.IGNORECASE)
        
        # Patrón Tabular Robusto: Soporta con y sin fechas intermedias
        self.patron_tabular = re.compile(
            r'(\d{4,6})\t'        # [1] NRC
            r'([^\t]+)\t'         # [2] Materia/Depto
            r'([^\t]+)\t'         # [3] N_Curso
            r'([^\t]+)\t'         # [4] Seccion
            r'([^\t]+)\t'         # [5] Componente/Tipo
            r'([^\t]+)\t'         # [6] Nombre Asignatura
            r'([^\t]*)\t'         # [7] Liga
            r'([^\t]*)\t'         # [8] Conector
            r'(\d+)\t'            # [9] Vacantes
            r'(?:(\d{2}-\d{2}-\d{4})\t(\d{2}-\d{2}-\d{4})\t)?' # [10,11] Fechas (OPCIONALES)
            r'([^\t]+)\t'         # [12] Sala/Ubicacion
            r'(\d{2,4})\t'        # [13] H_Ini
            r'(\d{2,4})'          # [14] H_Fin
        )

    def parsear_texto_por_prioridad(self, texto: str, prioridad: int, modo: str = "Auto") -> List[HorarioCrudo]:
        texto = texto.strip()
        if not texto: return []
        
        # 1. Modo JSON
        if modo == "JSON" or (modo == "Auto" and (texto.startswith('[') or texto.startswith('{'))):
            try:
                data = json.loads(texto)
                if isinstance(data, dict): data = [data]
                res = []
                def _norm_hora(h):
                    """Normaliza valores de hora provenientes del JSON.
                    - Si ya es un rango 'HH:MM - HH:MM' lo devuelve.
                    - Si es una hora sola 'HH:MM(:SS)?' añade 80 minutos por defecto.
                    - Si es None o vacío devuelve '00:00 - 00:00'.
                    """
                    if not h:
                        return "00:00 - 00:00"
                    if isinstance(h, (int, float)):
                        # tratar como minutos desde 00:00 (poco probable)
                        h = str(h)
                    h = str(h).strip()
                    # Si ya es rango
                    if ' - ' in h:
                        parts = [p.strip() for p in h.split(' - ', 1)]
                        def _fmt(p):
                            p = p.split('.')[0]
                            if ':' in p:
                                hhmm = p
                            elif len(p) == 4 and p.isdigit():
                                hhmm = f"{p[:2]}:{p[2:]}"
                            else:
                                hhmm = p
                            return hhmm[:5]
                        return f"{_fmt(parts[0])} - {_fmt(parts[1])}"

                    # hora simple: aceptar 'HH:MM:SS' o 'HH:MM' o 'HHMM'
                    p = h.split('.')[0]
                    if ':' in p:
                        segs = p.split(':')
                        hh = int(segs[0])
                        mm = int(segs[1]) if len(segs) > 1 else 0
                    elif len(p) in (3,4) and p.isdigit():
                        if len(p) == 3:
                            hh = int(p[0]); mm = int(p[1:])
                        else:
                            hh = int(p[:2]); mm = int(p[2:])
                    else:
                        return "00:00 - 00:00"
                    start_min = hh * 60 + mm
                    end_min = start_min + 80
                    end_h = end_min // 60
                    end_m = end_min % 60
                    start_str = f"{hh:02d}:{mm:02d}"
                    end_str = f"{end_h:02d}:{end_m:02d}"
                    return f"{start_str} - {end_str}"
                for item in data:
                    # Soporte para formato anidado: {"curso": "...", "secciones": [...]}
                    titulo_base = item.get('titulo') or item.get('curso', 'Sin Título')
                    secciones = item.get('secciones')
                    
                    if isinstance(secciones, list):
                        for sec in secciones:
                            # Intentar detectar día desde el JSON si existe, sino usar fallback
                            dia_json = sec.get('dia')
                            if dia_json:
                                dia_json = dia_json.strip().title()
                            else:
                                dia_json = self.calcular_dia_de_fecha(sec.get('fecha_inicio', '02-03-2026'))

                            hora_norm = _norm_hora(sec.get('hora'))

                            # Si no hay NRC, usar la sección como identificador (ej. 'T01')
                            nrc_val = sec.get('nrc') if sec.get('nrc') not in (None, '') else sec.get('seccion', '')
                            nrc_val = str(nrc_val).strip().upper()
                            seccion_val = str(sec.get('seccion', 'T01')).strip().upper()
                            res.append(HorarioCrudo(
                                nrc=nrc_val or seccion_val, 
                                titulo=titulo_base.upper(),
                                tipo=sec.get('tipo', 'TEO'), 
                                seccion=seccion_val,
                                hora_str=hora_norm, 
                                ubicacion=sec.get('lugar', 'S/I') or 'S/I',
                                instructor=sec.get('instructor', 'S/I') or 'S/I', 
                                campus="Principal",
                                cupos_disponibles=0, cupos_totales=0, es_ligado=False,
                                fecha_inicio=sec.get('fecha_inicio', '02-03-2026'),
                                fecha_fin=sec.get('fecha_fin', '11-07-2026'), 
                                dia_parseado=dia_json,
                                prioridad=prioridad
                            ))
                    else:
                        # Formato plano
                        dia_json = item.get('dia')
                        if dia_json:
                            dia_json = dia_json.strip().title()
                        else:
                            dia_json = self.calcular_dia_de_fecha(item.get('fecha_inicio', '02-03-2026'))
                        hora_norm = _norm_hora(item.get('hora'))

                        # Si no hay NRC en el objeto plano, usar la sección
                        nrc_val = item.get('nrc') if item.get('nrc') not in (None, '') else item.get('seccion', '')
                        nrc_val = str(nrc_val).strip().upper()
                        seccion_val = str(item.get('seccion', 'T01')).strip().upper()
                        res.append(HorarioCrudo(
                            nrc=nrc_val or seccion_val, 
                            titulo=titulo_base.upper(),
                            tipo=item.get('tipo', 'TEO'), 
                            seccion=seccion_val,
                            hora_str=hora_norm, 
                            ubicacion=item.get('lugar', 'S/I') or 'S/I',
                            instructor=item.get('instructor', 'S/I') or 'S/I', 
                            campus="Principal",
                            cupos_disponibles=0, cupos_totales=0, es_ligado=False,
                            fecha_inicio=item.get('fecha_inicio', '02-03-2026'),
                            fecha_fin=item.get('fecha_fin', '11-07-2026'), 
                            dia_parseado=dia_json,
                            prioridad=prioridad
                        ))
                if res: return res
            except Exception as e:
                print(f"Error parseando JSON: {e}")
                pass

        # 2. Modo Visual USS (Guía de Horarios)
        if modo == "Visual" or (modo == "Auto" and "HORA INICIO" in texto.upper() and "TEORIA" in texto.upper()):
            res_visual = self.parsear_formato_visual(texto, prioridad)
            if res_visual: return res_visual

        # 3. Modo Tabular (Portal de Inscripción / Excel)
        if modo == "Tabular" or modo == "Auto":
            resultados = self.parsear_texto_tabular(texto, prioridad)
            if resultados: return resultados
        
        # 4. Fallback: Crudo (Formato antiguo o texto simple)
        resultados = self.parsear_texto_crudo(texto)
        for r in resultados: r.prioridad = prioridad

        # Deduplicación
        vistos = set()
        unicos = []
        for r in resultados:
            clave = (r.nrc, r.dia_parseado, r.hora_str, r.ubicacion)
            if clave not in vistos:
                vistos.add(clave)
                unicos.append(r)
        return unicos

    def parsear_texto_tabular(self, texto: str, prioridad: int) -> List[HorarioCrudo]:
        resultados = []
        texto = texto.replace('\r', '')
        
        # Detectar sistema: Si hay R (Thursday) o F (Friday), es English-style (M=Monday)
        es_ingles = bool(re.search(r'\t[RTFS]\t', texto)) or 'F' in texto or 'R' in texto
        
        mapping_en = {'M': 'Lunes', 'T': 'Martes', 'W': 'Miércoles', 'R': 'Jueves', 'F': 'Viernes', 'S': 'Sábado', 'U': 'Domingo'}
        mapping_es = {'L': 'Lunes', 'M': 'Martes', 'X': 'Miércoles', 'W': 'Miércoles', 'J': 'Jueves', 'V': 'Viernes', 'S': 'Sábado', 'D': 'Domingo'}
        mapping = mapping_en if es_ingles else mapping_es

        for match in self.patron_tabular.finditer(texto):
            g = match.groups()
            nrc, materia, ncurs, sec, tipo, nombre, liga, conec, vac, f_ini, f_fin, sala, h_ini, h_fin = g
            
            def fmt_h(h):
                h = h.replace(':', '').strip()
                if len(h) == 4: return f"{h[:2]}:{h[2:]}"
                if len(h) == 3: return f"0{h[0]}:{h[1:]}"
                return h
            
            # Días: Escaneamos tabs después del match
            pos_fin = match.end()
            fragmento = texto[pos_fin:pos_fin+250].split('\t')
            dia_detectado = None
            for seg in fragmento[:15]:
                s = seg.strip().upper()
                if s in mapping:
                    dia_detectado = mapping[s]
                    break
            
            if not dia_detectado:
                dia_detectado = self.calcular_dia_de_fecha(f_ini or "02-03-2026")

            resultados.append(HorarioCrudo(
                nrc=nrc, titulo=" ".join(nombre.split()).upper(), tipo=tipo.strip().upper(),
                seccion=sec.strip(), hora_str=f"{fmt_h(h_ini)} - {fmt_h(h_fin)}",
                ubicacion=sala.strip(), instructor="S/I", campus="Sede Principal",
                cupos_disponibles=int(vac) if vac and vac.isdigit() else 0,
                cupos_totales=int(vac) if vac and vac.isdigit() else 0,
                es_ligado=bool(liga.strip()), fecha_inicio=f_ini or "02-03-2026",
                fecha_fin=f_fin or "11-07-2026", dia_parseado=dia_detectado,
                prioridad=prioridad, liga=liga.strip(), conector=conec.strip()
            ))
        return resultados

    def parsear_formato_visual(self, texto: str, prioridad: int) -> List[HorarioCrudo]:
        """Parser experto para el formato visual de la USS (Nivel, Sección, Bloques)"""
        lineas = [l.strip() for l in texto.split('\n') if l.strip()]
        resultados = []
        
        seccion_global = "T01"
        hora_actual = "08:00"
        dias_actuales = []
        
        map_dias = {
            "LUNES": "Lunes", "MARTES": "Martes", "MIÉRCOLES": "Miércoles", "MIERCOLES": "Miércoles",
            "JUEVES": "Jueves", "VIERNES": "Viernes", "SÁBADO": "Sábado", "SABADO": "Sábado", "DOMINGO": "Domingo"
        }

        i = 0
        while i < len(lineas):
            linea = lineas[i]
            
            # 1. Detectar Hora (ej: 08:00:00)
            m_hora = re.match(r'^(\d{2}:\d{2})(:\d{2})?$', linea)
            if m_hora:
                hora_actual = m_hora.group(1)
                i += 1
                continue
            
            # 2. Detectar Sección Global (ej: TEORIA 03)
            if "TEORIA" in linea.upper():
                m_sec = re.search(r'TEORIA\s*(\d+)', linea.upper())
                if m_sec:
                    seccion_global = f"T{m_sec.group(1).zfill(2)}"
                i += 1
                continue
            
            # 3. Detectar Días
            dias_linea = []
            temp_linea = linea.upper()
            found_any = False
            for d_key in map_dias:
                if d_key in temp_linea:
                    dias_linea.append(map_dias[d_key])
                    found_any = True
            
            if found_any and len("".join(dias_linea)) >= len(linea.replace(" ", "")) * 0.6:
                # Ordenar días según aparecen en la línea
                dias_linea.sort(key=lambda x: linea.upper().find(x.upper().replace('Í', 'I').replace('Á', 'A')))
                dias_actuales = dias_linea
                i += 1
                continue

            # 4. Procesar Asignaturas
            if dias_actuales:
                bloque_texto = linea
                j = i + 1
                while j < len(lineas):
                    next_l = lineas[j]
                    if re.match(r'^\d{2}:\d{2}(:\d{2})?$', next_l) or "TEORIA" in next_l.upper() or any(d in next_l.upper() for d in map_dias):
                        break
                    bloque_texto += " " + next_l
                    j += 1
                
                # Intentar partir el bloque por patrones de ramos (MEVE... o Persona y sociedad)
                partes = re.split(r'(?=MEVE\d{4}|Persona y sociedad|MEV\d{1})', bloque_texto)
                partes = [p.strip() for p in partes if p.strip()]
                
                if len(dias_actuales) > 1 and len(partes) > 1:
                    if len(partes) % len(dias_actuales) == 0:
                        per_day = len(partes) // len(dias_actuales)
                        for d_idx, dia in enumerate(dias_actuales):
                            for k in range(per_day):
                                self._extraer_y_agregar_visual(partes[d_idx * per_day + k], dia, hora_actual, seccion_global, resultados, prioridad)
                    else:
                        for idx, p in enumerate(partes):
                            d_idx = idx % len(dias_actuales)
                            self._extraer_y_agregar_visual(p, dias_actuales[d_idx], hora_actual, seccion_global, resultados, prioridad)
                else:
                    for p in partes:
                        dia = dias_actuales[0] if dias_actuales else "Lunes"
                        self._extraer_y_agregar_visual(p, dia, hora_actual, seccion_global, resultados, prioridad)
                
                i = j
                continue

            i += 1
        return resultados

    def _extraer_y_agregar_visual(self, texto, dia, hora, seccion_defecto, resultados, prioridad):
        nrc = "NA"
        m_nrc = re.search(r'NRC\s*(\d+)', texto)
        if m_nrc: nrc = m_nrc.group(1)
        
        seccion = seccion_defecto
        m_sec = re.search(r'(T\d{2})', texto)
        if m_sec: seccion = m_sec.group(1)
        
        tipo = "TEO"
        try:
            sec_num = int(seccion[1:])
            if sec_num >= 50: tipo = "LAB"
        except: pass
        if "TEORIA" in texto.upper(): tipo = "TEO"
            
        titulo = texto
        titulo = re.sub(r'NRC\s*\d+', '', titulo)
        titulo = re.sub(r'T\d{2}', '', titulo)
        titulo = re.sub(r'[A-Z]\d{3}', '', titulo) # Sala
        titulo = titulo.replace("TEORIA", "").strip()
        
        if not titulo or len(titulo) < 3: return

        h_ini = hora
        h, m = map(int, h_ini.split(':'))
        total = h * 60 + m + 80 # Bloques de 80 min por defecto
        h_fin = f"{total//60:02d}:{total%60:02d}"

        resultados.append(HorarioCrudo(
            nrc=nrc, titulo=titulo.upper(), tipo=tipo, seccion=seccion,
            hora_str=f"{h_ini} - {h_fin}", ubicacion="S/I", instructor="S/I",
            campus="USS", cupos_disponibles=0, cupos_totales=0, es_ligado=False,
            fecha_inicio="02-03-2025", fecha_fin="11-07-2025", dia_parseado=dia,
            prioridad=prioridad
        ))

    def parsear_texto_crudo(self, texto: str) -> List[HorarioCrudo]:
        lineas = [l.strip() for l in texto.split('\n') if l.strip()]
        resultados = []
        i = 0
        while i < len(lineas):
            linea = lineas[i]
            if linea.isupper() and len(linea) > 5 and 'TÍTULO' not in linea:
                titulo = linea
                i += 1
                while i < len(lineas) and '\t' not in lineas[i]: i += 1
                if i >= len(lineas): break
                m = self.patron_datos.search(lineas[i])
                if m:
                    tipo, _, _, sec, _, nrc, _, inst = m.groups()
                    i += 1
                    dia_act = None
                    while i < len(lineas) and 'lugares disponibles' not in lineas[i]:
                        dm = self.patron_dia.match(lineas[i])
                        if dm: dia_act = dm.group(1).title()
                        hm = self.patron_horario.search(lineas[i])
                        if hm:
                            hi, hf, _, ed, sa, fi, ff = hm.groups()
                            resultados.append(HorarioCrudo(
                                nrc=nrc, titulo=titulo, tipo=tipo, seccion=sec,
                                hora_str=f"{hi} - {hf}", ubicacion=f"{ed} {sa}",
                                instructor=inst, campus="Principal", cupos_disponibles=0,
                                cupos_totales=0, es_ligado=False, fecha_inicio=fi,
                                fecha_fin=ff, dia_parseado=dia_act
                            ))
                        i += 1
            i += 1
        return resultados

    def agrupar_por_nrc(self, horarios: List[HorarioCrudo]) -> Dict[str, List[HorarioCrudo]]:
        agrupados = {}
        for h in horarios:
            if h.nrc not in agrupados: agrupados[h.nrc] = []
            agrupados[h.nrc].append(h)
        return agrupados

    def exportar_a_tsv_uss(self, horarios: List[HorarioCrudo]) -> str:
        """Exporta una lista de HorarioCrudo al formato tabulado solicitado por la USS"""
        headers = [
            "NRC", "MATERIA", "N_CURSO", "SECCION", "COMPONENTE", "NOMBRE",
            "LIGA", "CONECTOR", "VACANTES", "SALA", "HR_INICIO", "HR_FIN",
            "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO",
            "DOCENTE", "NOMBRE_", "APELLIDO"
        ]
        
        lineas = ["\t".join(headers)]
        for h in horarios:
            # Intentar separar Materia y N_Curso del título (ej: MEVE0021 - PATOLOGIA)
            materia = "NA"
            n_curso = "NA"
            nombre = h.titulo
            if " - " in h.titulo:
                partes = h.titulo.split(" - ", 1)
                materia = partes[0].strip()
                nombre = partes[1].strip()
            
            h_ini, h_fin = "NA", "NA"
            if " - " in h.hora_str:
                h_ini, h_fin = h.hora_str.split(" - ")

            # Días
            dias = ["NA"] * 7
            map_idx = {"Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4, "Sábado": 5, "Domingo": 6}
            if h.dia_parseado in map_idx:
                dias[map_idx[h.dia_parseado]] = "X"

            fila = [
                h.nrc, materia, n_curso, h.seccion, h.tipo, nombre,
                "NA", "NA", str(h.cupos_totales), h.ubicacion, h_ini, h_fin,
                *dias,
                h.instructor, "NA", "NA"
            ]
            lineas.append("\t".join(fila))
        
        return "\n".join(lineas)

    def calcular_dia_de_fecha(self, fecha_str: str) -> str:
        meses = {'Ene': 1, 'Feb': 2, 'Mar': 3, 'Abr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Ago': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dic': 12, 'Jan': 1, 'Mar': 3}
        dias_esp = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        try:
            p = fecha_str.split('-')
            if len(p) < 3: return "Lunes"
            m_str = p[1][:3].title()
            m_num = meses.get(m_str, 3)
            d = date(int(p[2]), m_num, int(p[0]))
            return dias_esp[d.weekday()]
        except: return "Lunes"