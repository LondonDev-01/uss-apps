import { motion } from 'framer-motion'
import { ClaseConDia } from '../types'
import { getNrcColors, normTipo } from '../lib/colors'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const SLOTS = ['08:00', '09:30', '11:00', '12:30', '13:11', '14:40', '16:00', '17:35', '19:00']

function hhmmToMin(s: string): number {
  try {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  } catch { return 0 }
}

export { normTipo, getNrcColors }

interface Props {
  horario: ClaseConDia[]
  showMeta?: boolean
}

export default function ScheduleGrid({ horario, showMeta = true }: Props) {
  const nrcColors = getNrcColors(horario)

  const slotMinutes = SLOTS.map(hhmmToMin)
  const placed: Record<string, boolean[]> = {}
  for (const d of DIAS) placed[d] = new Array(SLOTS.length).fill(false)

  const rows: React.ReactNode[] = []

  for (let si = 0; si < SLOTS.length; si++) {
    const timeCell = (
      <td key={`t-${si}`} className="time-cell">
        <span>{SLOTS[si]}</span>
      </td>
    )

    const dayCells: React.ReactNode[] = []

    for (const d of DIAS) {
      if (placed[d][si]) continue

      const clase = horario.find(c => {
        if (c.dia !== d) return false
        const hi = hhmmToMin(c.hora_inicio)
        const hf = hhmmToMin(c.hora_fin)
        return hi <= slotMinutes[si] && slotMinutes[si] < hf
      })

      if (!clase) {
        dayCells.push(<td key={`${d}-${si}`} className="schedule-cell" />)
        continue
      }

      let span = 1
      for (let sj = si + 1; sj < SLOTS.length; sj++) {
        if (slotMinutes[sj] < hhmmToMin(clase.hora_fin)) span++
        else break
      }

      const color = nrcColors[clase.nrc] ?? '#CBD5E1'
      const content = (
        <>
          <div className="cell-title">{clase.titulo}</div>
          {showMeta && (
            <>
              <div className="cell-meta">{clase.nrc}</div>
              <div className="cell-meta">{clase.hora_inicio}-{clase.hora_fin}</div>
            </>
          )}
        </>
      )

      if (span > 1) {
        for (let k = si; k < si + span; k++) {
          if (k < SLOTS.length) placed[d][k] = true
        }
        dayCells.push(
          <td key={`${d}-${si}`} rowSpan={span} className="schedule-cell" style={{ backgroundColor: color, color: '#1E293B' }}>
            {content}
          </td>
        )
      } else {
        dayCells.push(
          <td key={`${d}-${si}`} className="schedule-cell" style={{ backgroundColor: color, color: '#1E293B' }}>
            {content}
          </td>
        )
      }
    }

    rows.push(<tr key={`r-${si}`}>{timeCell}{dayCells}</tr>)
  }

  return (
    <div className="schedule-wrap">
      <table className="schedule-grid">
        <thead>
          <tr>
            <th className="time-header">Hora</th>
            {DIAS.map(d => <th key={d} className="day-header">{d}</th>)}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}