import itertools
from collections import defaultdict
from typing import List, Tuple, Dict
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from src.core.models import ClaseConDia

class OptimizadorReal:
    def __init__(self):
        self.dias_semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        self.colores_excel = [
            "BFDBFE", "BBF7D0", "FEF3C7", "FECACA", "DDD6FE", "F5D0FE", 
            "bae6fd", "a7f3d0", "fde68a", "fecaca"
        ]

    def _hora_a_minutos(self, hora_str: str) -> int:
        try:
            h, m = map(int, hora_str.split(':'))
            return h * 60 + m
        except:
            return 0

    def procesar_selecciones_usuario(self, selecciones: dict) -> List[ClaseConDia]:
        """Convierte el diccionario de la UI en objetos ClaseConDia robustos"""
        candidatos = []
        for clave, info in selecciones.items():
            h = info['horario']
            dia = info['dia']
            
            # Normalizar horas a minutos para cálculos rápidos
            m_ini = self._hora_a_minutos(h.hora_str.split(' - ')[0])
            m_fin = self._hora_a_minutos(h.hora_str.split(' - ')[1])
            
            # Limpiar edificio y salón
            ubicacion = h.ubicacion.replace("Edificio:", "").replace("Salón:", "").strip()
            partes = ubicacion.split()
            edificio = partes[0] if partes else "N/A"
            salon = partes[1] if len(partes) > 1 else "N/A"

            candidatos.append(ClaseConDia(
                nrc=h.nrc,
                titulo=h.titulo,
                tipo=h.tipo,
                seccion=h.seccion,
                dia=dia,
                hora_inicio=h.hora_str.split(' - ')[0],
                hora_fin=h.hora_str.split(' - ')[1],
                minutos_inicio=m_ini,
                minutos_fin=m_fin,
                edificio=edificio,
                salon=salon,
                instructor=h.instructor,
                fecha_inicio=h.fecha_inicio,
                prioridad=h.prioridad,
                liga=h.liga,
                conector=h.conector
            ))
            
        return candidatos

    def generar_top_horarios(self, candidatos: List[ClaseConDia], top_n=10, preferencias: Dict = None) -> Tuple[List[List[ClaseConDia]], str]:
        """
        Genera los TOP N mejores horarios posibles considerando PRIORIDADES y DEDUPLICACIÓN.
        Retorna (lista_de_listas_de_clases, mensaje_debug)
        """
        # 0. Deduplicar por Título: Si un curso está en varias categorías, dejar la de mayor prioridad (0 > 1 > 2)
        # Nota: Prioridad 0 es "Obligatorio", 1 "Adelantar", 2 "Electivo" (especial)
        prioridad_por_titulo = {}
        for c in candidatos:
            titulo = c.titulo
            current_p = c.prioridad
            if titulo not in prioridad_por_titulo or current_p < prioridad_por_titulo[titulo]:
                prioridad_por_titulo[titulo] = current_p

        # 1. Agrupar bloques por NRC y filtrar por la prioridad ganadora del título
        # Usamos (titulo, nrc) como clave para evitar colisiones si diferentes ramos usan el mismo NRC (ej: "T01")
        nrc_blocks = defaultdict(list)
        for c in candidatos:
            if c.prioridad == prioridad_por_titulo[c.titulo]:
                nrc_blocks[(c.titulo, c.nrc)].append(c)
            
        ramos_por_prioridad = {0: defaultdict(lambda: defaultdict(list)), 
                               1: defaultdict(lambda: defaultdict(list)), 
                               2: defaultdict(lambda: defaultdict(list))}

        for (titulo, nrc), blocks in nrc_blocks.items():
            base = blocks[0]
            tipo_up = (base.tipo or '').upper()
            tipo_norm = "TEO" if ("TEOR" in tipo_up or "TEO" in tipo_up) else "LAB" if ("LAB" in tipo_up or "TALLER" in tipo_up or "PRACT" in tipo_up) else "OTRO"
            ramos_por_prioridad[base.prioridad][titulo][tipo_norm].append(blocks)

        # 2. Construir UNA lista de opciones por RAMO (que pueden ser TEO+LAB)
        def consolidar_opciones(agrupacion):
            opciones = []
            nombres = []
            for titulo, tipos in agrupacion.items():
                opts_este_ramo = []
                
                # Caso: Tiene TEO y LAB -> Intentar emparejar
                if "TEO" in tipos and "LAB" in tipos:
                    # Intentamos todas las combinaciones posibles
                    for teo_blocks in tipos["TEO"]:
                        t_base = teo_blocks[0]
                        for lab_blocks in tipos["LAB"]:
                            l_base = lab_blocks[0]
                            
                            # Criterio estricto de match de Ligas:
                            t_liga = t_base.liga.strip() if t_base.liga else ""
                            t_conn = t_base.conector.strip() if t_base.conector else ""
                            l_liga = l_base.liga.strip() if l_base.liga else ""
                            l_conn = l_base.conector.strip() if l_base.conector else ""
                            
                            match_ligas = False
                            # 1. Si ambos campos de liga/conector están vacíos, emparejar libremente
                            if not t_liga and not t_conn and not l_liga and not l_conn:
                                match_ligas = True
                            # 2. Si hay códigos, deben coincidir cruzados (T:Liga->L:Conn y L:Liga->T:Conn)
                            elif t_liga == l_conn and l_liga == t_conn:
                                match_ligas = True

                            combo = teo_blocks + lab_blocks
                            # Primero intentar emparejado estricto por ligas/conectores
                            if match_ligas:
                                es_valido_interno, _ = self.verificar_conflictos_detallado(combo)
                                if es_valido_interno:
                                    opts_este_ramo.append(combo)
                            else:
                                # FALLBACK RELAJADO: Aun si las ligas no coinciden, en la práctica
                                # muchas ofertas separan TEO/LAB sin usar 'liga/conector' correctamente.
                                # Por tanto, como requisito del producto, si existe TEO y LAB
                                # para el mismo título y sus horarios no se pisan entre sí,
                                # se debe permitir la combinación (tomar 1 NRC de TEO + 1 NRC de LAB).
                                es_valido_interno, _ = self.verificar_conflictos_detallado(combo)
                                if es_valido_interno:
                                    opts_este_ramo.append(combo)
                
                # Si no se pudieron emparejar:
                # - Modo ESTRICTO: si existen TEO y LAB para el mismo título,
                #   NO añadimos opciones individuales aquí: sólo las combinaciones
                #   TEO+LAB son válidas. Si no hay combos válidos, este título quedará
                #   sin opciones y el generador indicará que no hay horarios posibles.
                # - Si NO existen ambos tipos, agregamos las opciones individuales disponibles.
                if not opts_este_ramo:
                    if "TEO" in tipos and "LAB" in tipos:
                        # No agregar fallback individual: dejamos opts_este_ramo vacío
                        opts_este_ramo = []
                    else:
                        for t_key in ["TEO", "LAB", "OTRO"]:
                            if t_key in tipos:
                                for blocks in tipos[t_key]:
                                    opts_este_ramo.append(blocks)
                
                if opts_este_ramo:
                    opciones.append(opts_este_ramo)
                    nombres.append(titulo)
            return opciones, nombres

        opts0, noms0 = consolidar_opciones(ramos_por_prioridad[0]) # Obligatorios
        opts1, noms1 = consolidar_opciones(ramos_por_prioridad[1]) # Adelantar
        opts2, noms2 = consolidar_opciones(ramos_por_prioridad[2]) # Electivos

        # 3. Lógica de selección:
        # - Obligatorios: Se intentan meter todos.
        # - Electivos: Se elige EXACTAMENTE UNO.
        # - Adelantar: Se intentan meter los que quepan.
        
        # Opciones para el producto cartesiano:
        # Los obligatorios son fijos (producto entre ellos)
        # Los electivos son una sola lista de opciones cruzadas (todas las opciones de todos los ramos electivos)
        todas_opts_electivos = []
        for o_list in opts2: todas_opts_electivos.extend(o_list)
        
        # Pre-construir listas de opciones para el generador
        # Estructura: [ [opt0_ramoA, opt0_ramoB], [opt1_ramoX], [TODOS_LOS_ELECTIVOS] ]
        lista_final_opciones = []
        for o in opts0: lista_final_opciones.append(o)
        
        if todas_opts_electivos:
            lista_final_opciones.append(todas_opts_electivos)
        
        # Para los de "Adelantar", son opcionales. El producto cartesiano normal los haría obligatorios.
        # Truco: Añadimos una opción "Nada" (lista vacía) a cada ramo de prioridad 1.
        for o in opts1:
            lista_final_opciones.append(o + [[]])

        total_combinaciones = 1
        for op in lista_final_opciones: total_combinaciones *= len(op)
        
        LIMITE_COMBINACIONES = 5_000_000
        if total_combinaciones > LIMITE_COMBINACIONES:
            return [], f"Demasiadas combinaciones ({total_combinaciones:,}). Intenta reducir ramos opcionales."

        validos_con_puntaje = []
        conflictos_diagnostico = defaultdict(int)
        
        for combinacion in itertools.product(*lista_final_opciones):
            horario_plano = [c for blocks in combinacion for c in blocks if blocks]
            
            if not horario_plano: continue

            es_valido, msg_conflicto = self.verificar_conflictos_detallado(horario_plano)
            if es_valido:
                n_nrcs = len(set(c.nrc for c in horario_plano))
                # Penalización por distancia TEO-LAB: preferir combos donde TEO y LAB queden cerca
                gap = self._calc_teo_lab_gap(horario_plano)
                puntaje = self._calcular_puntaje(horario_plano, preferencias) + (n_nrcs * 500) - (gap / 5)
                validos_con_puntaje.append((puntaje, horario_plano))
            else:
                conflictos_diagnostico[msg_conflicto] += 1
        
        if not validos_con_puntaje:
            msg = "No se encontró ningún horario válido (sin topes) con los ramos obligatorios."
            if conflictos_diagnostico:
                # Mostrar el top 3 de conflictos más comunes
                tops = sorted(conflictos_diagnostico.items(), key=lambda x: x[1], reverse=True)[:3]
                msg += "\n\nConflictos más frecuentes detectados:\n"
                for c_msg, count in tops:
                    msg += f"• {c_msg}\n"
            return [], msg
            
        validos_con_puntaje.sort(key=lambda x: x[0], reverse=True)
        
        mejores = []
        vistos_signatures = set() # Para evitar duplicados de NRCs
        vistos_layouts = []       # Para asegurar diversidad visual
        
        for p, h in validos_con_puntaje:
            # 1. Deduplicar por combinación exacta de NRCs
            signature = tuple(sorted([c.nrc for c in h]))
            if signature in vistos_signatures:
                continue
            
            # 2. Filtro de Diversidad Visual:
            # Evitamos mostrar horarios que sean casi idénticos a los ya seleccionados
            # (ej: mismo bloque horario pero solo cambió la sección física con idéntica hora)
            layout_actual = set((c.dia, c.hora_inicio, c.hora_fin) for c in h)
            
            es_demasiado_similar = False
            for layout_previo in vistos_layouts:
                # Calcular intersección de bloques horarios
                interseccion = layout_actual.intersection(layout_previo)
                similitud = len(interseccion) / len(layout_actual)
                
                # Si la similitud es > 90%, es prácticamente el mismo horario visualmente
                if similitud > 0.90:
                    es_demasiado_similar = True
                    break
            
            if not es_demasiado_similar:
                vistos_signatures.add(signature)
                vistos_layouts.append(layout_actual)
                mejores.append(h)
                
            if len(mejores) >= top_n: break
            
        # Fallback: si el filtro de diversidad fue demasiado estricto y nos quedamos con pocas opciones,
        # rellenamos con las mejores restantes (deduplicadas pero no necesariamente diversas)
        if len(mejores) < min(top_n, 5):
            for p, h in validos_con_puntaje:
                signature = tuple(sorted([c.nrc for c in h]))
                if signature not in vistos_signatures:
                    vistos_signatures.add(signature)
                    mejores.append(h)
                if len(mejores) >= top_n: break

        return mejores, f"¡Éxito! {len(validos_con_puntaje)} opciones encontradas ({len(mejores)} diversas)."

    # --- MOTOR DE PUNTUACIÓN (CRITERIOS DE OPTIMIZACIÓN) ---
    def _calcular_puntaje(self, horario: List[ClaseConDia], preferencias: Dict = None) -> int:
        """Determina la calidad de un horario basado en penalizaciones y premios."""
        if not preferencias:
            return 0

        total_score = 0
        clases_por_dia = defaultdict(list)
        for clase in horario:
            clases_por_dia[clase.dia].append(clase)

        for dia, clases in clases_por_dia.items():
            if not clases: continue
            
            # Penalización crítica por fines de semana
            if dia == 'Sábado' and preferencias.get('sin_sabados', True):
                total_score -= 10000

            dia_ordenado = sorted(clases, key=lambda x: x.minutos_inicio)
            total_score += self._evaluar_dia(dia_ordenado, preferencias)
        
        # Bono por Consistencia de Sección (Instrucción USS: preferir todos T01, T02 o T03)
        secciones_teo = [c.seccion for c in horario if (c.tipo or '').upper() == 'TEO']
        if secciones_teo:
            # Contar cuál es la sección teórica más frecuente en este horario
            conteo = {}
            for s in secciones_teo: conteo[s] = conteo.get(s, 0) + 1
            max_frecuencia = max(conteo.values())
            # Dar un bono proporcional a cuántos ramos comparten la misma sección teórica
            total_score += (max_frecuencia * 150)
            
        return int(total_score)

    def _calc_teo_lab_gap(self, horario: List[ClaseConDia]) -> int:
        """Calcula la suma de gaps en minutos entre TEO y LAB asignados del mismo título.
        Retorna la suma absoluta de diferencias de puntos medios horarios (en minutos).
        """
        por_titulo = {}
        for c in horario:
            por_titulo.setdefault(c.titulo, []).append(c)

        total_gap = 0
        for titulo, clases in por_titulo.items():
            teo_mid = None
            lab_mid = None
            for cl in clases:
                mid = (cl.minutos_inicio + cl.minutos_fin) // 2
                tipo_up = (cl.tipo or '').upper()
                if 'TEOR' in tipo_up or 'TEO' in tipo_up:
                    teo_mid = mid
                elif 'LAB' in tipo_up or 'TALLER' in tipo_up or 'PRACT' in tipo_up:
                    # If multiple labs, take the closest to teo later when teo exists
                    if lab_mid is None:
                        lab_mid = mid
                    else:
                        # keep the lab with minimal distance to teo if teo exists
                        if teo_mid is not None and abs(mid - teo_mid) < abs(lab_mid - teo_mid):
                            lab_mid = mid
            if teo_mid is not None and lab_mid is not None:
                total_gap += abs(teo_mid - lab_mid)
        return total_gap

    def _evaluar_dia(self, clases_dia: List[ClaseConDia], prefs: Dict) -> int:
        """Evalúa un día individual: entrada, salida y huecos."""
        dia_score = 0
        inicio_dia = clases_dia[0].minutos_inicio
        fin_dia = clases_dia[-1].minutos_fin

        # 1. ¿Entra tarde? (Premio por comodidad matutina)
        if prefs.get('no_temprano') and inicio_dia < 660: # Antes de las 11:00 AM
            dia_score += (inicio_dia - 480) # Bonus desde las 8:00 AM

        # 2. ¿Sale temprano? (Penalización por terminar tarde)
        if prefs.get('no_tarde') and fin_dia > 900: # Después de las 3:00 PM
            dia_score -= (fin_dia - 900) * 2

        # 3. ¿Tiene ventanas? (Penalización por tiempo muerto)
        if prefs.get('sin_ventanas'):
            dia_score -= self._calcular_ventanas(clases_dia) * 3

        return dia_score

    def _calcular_ventanas(self, clases: List[ClaseConDia]) -> int:
        """Calcula los minutos totales de tiempo muerto entre clases."""
        ventanas = 0
        for i in range(len(clases) - 1):
            gap = clases[i+1].minutos_inicio - clases[i].minutos_fin
            if gap > 20: # Más de 20 minutos se considera ventana pérdida
                ventanas += gap
        return ventanas

    def verificar_conflictos_detallado(self, horario: List[ClaseConDia]) -> Tuple[bool, str]:
        """Comprueba si hay choques de horario. Retorna (Valido, Mensaje)."""
        clases_ordenadas = sorted(horario, key=lambda x: (x.dia, x.minutos_inicio))
        
        for i in range(len(clases_ordenadas) - 1):
            c1, c2 = clases_ordenadas[i], clases_ordenadas[i+1]
            
            if c1.dia == c2.dia and c2.minutos_inicio < c1.minutos_fin:
                return False, f"'{c1.titulo}' y '{c2.titulo}' chocan el {c1.dia} ({c1.hora_inicio}-{c1.hora_fin})"
        
        return True, ""

    def verificar_conflictos(self, horario: List[ClaseConDia]) -> bool:
        v, _ = self.verificar_conflictos_detallado(horario)
        return not v