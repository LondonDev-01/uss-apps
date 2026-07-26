# Configuración de Semestre

## Cómo cambiar las fechas

Editar el archivo `frontend/src/lib/constants.ts`:

```ts
export const SEMESTRE_INICIO = '03-08-2026'  // DD-MM-YYYY
export const SEMESTRE_FIN   = '31-12-2026'   // DD-MM-YYYY
```

- `SEMESTRE_INICIO`: primer día del semestre. La exportación ICS calcula
  automáticamente el DTSTART correcto por cada día de la semana (una clase
  de martes arranca el martes siguiente si el inicio del semestre cae lunes).
- `SEMESTRE_FIN`: último día del semestre. Se usa como `UNTIL` en la
  recurrencia semanal del ICS.

## Dependencias

Ambas constantes se importan y usan en:

- `frontend/src/lib/excelParser.ts` — fecha por defecto al parsear Excel
- `frontend/src/lib/parser.ts` — fecha por defecto al parsear texto legacy
- `frontend/src/pages/ExportPage.tsx` — generación de archivos `.ics`

No hay más lugares donde las fechas estén hardcodeadas.
