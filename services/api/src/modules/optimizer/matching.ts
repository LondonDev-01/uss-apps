// Matching de ramos Excel <-> Malla (PLAN_V2 S8).
//
// NOTA: el plan describe un tercer paso con una tabla de alias conocidos
// ("ALIASES", ej. 'algebra' -> ['algebra', 'algebra 1', ...]). No se
// implementa todavia porque poblarla requiere titulos reales de Excel de
// periodos ya subidos (Fase E, admin upload) -- no hay esa data hoy. Con
// match exacto normalizado + fuzzy (Levenshtein) alcanza para el caso base;
// agregar alias es aditivo cuando haya evidencia real de que falla.

const DIACRITICS_RE = /[\u0300-\u036f]/g;

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '') // quitar tildes
    .replace(/[^a-z0-9\s]/g, '') // quitar puntuacion
    .replace(/\s+/g, ' ')
    .trim();
}

// Distancia de Levenshtein clasica (matriz DP). Los nombres de ramo son
// cortos (<100 chars normalizados), no hace falta optimizar memoria.
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Match exacto (normalizado) o fuzzy dentro de un 30% de distancia relativa
// al nombre mas largo de los dos.
//
// DESVIACION DEL PLAN: PLAN_V2 S8 especifica un piso fijo de 5 caracteres
// de holgura ("Math.max(nombreMalla.length * 0.3, 5)"). Verificado con
// datos reales, ese piso produce falsos positivos en nombres cortos: p.ej.
// "Etica" (normalizado, 5 chars) matchea contra "Mecanica" (distancia 4 <=
// umbral 5) pese a ser ramos completamente distintos. Sin el piso fijo
// (solo distancia/largo <= 0.3) ese caso queda correctamente rechazado
// (ratio 0.50) sin perder los matches legitimos que el piso queria cubrir
// (ej. "Prog Orientada a Objetos" vs "Programacion Orientada a Objetos",
// ratio 0.25 -> matchea igual). Ver services/api/scripts/verify-optimizer.ts
// si se quiere reproducir la comparacion.
export function matchByNombre(tituloExcel: string, nombreMalla: string): boolean {
  const a = normalizar(tituloExcel);
  const b = normalizar(nombreMalla);
  if (!a || !b) return false;
  if (a === b) return true;

  const distancia = levenshtein(a, b);
  const ratio = distancia / Math.max(a.length, b.length);
  return ratio <= 0.3;
}
