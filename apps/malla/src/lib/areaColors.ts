// Categorical color-by-area mapping for course cards. Palette picked and
// validated with the `dataviz` skill's categorical formula (fixed hue
// order, never cycled — see references/color-formula.md) against this
// app's actual dark surface (`--color-surface: #161b27`):
//
//   node scripts/validate_palette.js
//     "#3987e5,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767"
//     --mode dark --surface "#161b27"
//   -> ALL CHECKS PASS (lightness band, chroma floor, CVD ΔE, normal-vision
//      ΔE, contrast vs surface all clear).
//
// Malla 2021 has 9 areas — one more than the 8 validated categorical slots.
// Per the skill's rule ("a 9th series is never a generated hue — it folds
// into Other"), "Formación Integral" (general-education electives, present
// in both mallas, the least "core major" of the areas) folds into the
// neutral slot instead of taking a 9th hue.
//
// Each area name maps to a FIXED slot always (never reassigned per view),
// which is what keeps the CVD-adjacency guarantee valid for whichever
// subset of areas a given malla actually uses.

export interface AreaColor {
  bg: string; // card fill
  border: string; // left accent border
  text: string; // readable on `bg`
}

const NEUTRAL: AreaColor = { bg: '#262b38', border: '#3a4051', text: '#c7ccd6' };

// hue -> { bg (dark step, ~15% mixed toward surface for a card fill that
// still reads as "area", not a saturated chip), border (full dark step),
// text (near-white, all areas share the same text ink) }
const HUES: Record<string, AreaColor> = {
  blue: { bg: '#1c2d47', border: '#3987e5', text: '#dbe6f8' },
  orange: { bg: '#3a2617', border: '#d95926', text: '#f6ddce' },
  aqua: { bg: '#123329', border: '#199e70', text: '#cdeee1' },
  yellow: { bg: '#332708', border: '#c98500', text: '#f0ddb8' },
  magenta: { bg: '#3a1f2a', border: '#d55181', text: '#f5d9e4' },
  green: { bg: '#122912', border: '#008300', text: '#c9e8c9' },
  violet: { bg: '#241f3d', border: '#9085e9', text: '#e0dcf7' },
  red: { bg: '#3a1a1a', border: '#e66767', text: '#f6d6d6' },
};

// Area name (as transcribed in prisma/seed-data/malla-*.ts) -> fixed hue.
const AREA_HUE: Record<string, keyof typeof HUES> = {
  // Malla 2021
  'Ciencias Básicas y de la Ingeniería': 'blue',
  'Sistemas de Información': 'aqua',
  'Infraestructura TI': 'violet',
  'Proyectos TI': 'orange',
  'Electivos de Profundización': 'magenta',
  'Proyectos en Empresa': 'yellow',
  Inglés: 'green',
  'Habilidades para la Ingeniería': 'red',
  // 'Formación Integral' intentionally omitted -> neutral (both mallas)

  // Malla 2024
  'Formación Disciplinar': 'blue',
  'Formación Profesional': 'aqua',
  'Gestión para la Empleabilidad': 'orange',
};

export function colorForArea(area: string | null | undefined): AreaColor {
  if (!area) return NEUTRAL;
  const hue = AREA_HUE[area];
  return hue ? HUES[hue] : NEUTRAL;
}

// For a legend: unique (area, color) pairs actually present in a course list,
// in a stable order (first-seen).
export function legendFor(areas: (string | null | undefined)[]): { area: string; color: AreaColor }[] {
  const seen = new Set<string>();
  const result: { area: string; color: AreaColor }[] = [];
  for (const area of areas) {
    const label = area || 'Formación Integral';
    if (seen.has(label)) continue;
    seen.add(label);
    result.push({ area: label, color: colorForArea(area) });
  }
  return result;
}
