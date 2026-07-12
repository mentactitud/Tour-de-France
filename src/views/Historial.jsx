import { useLiveQuery } from 'dexie-react-hooks'
import { db, totalPiezas } from '../db.js'
import { PERIODOS } from '../data/especies.js'

function fmtFecha(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function Historial({ onEdit }) {
  const jornadas = useLiveQuery(() => db.jornadas.orderBy('date').reverse().toArray(), [])

  if (!jornadas) return null
  if (jornadas.length === 0) {
    return <div className="vacio">Sin jornadas todavía.<br />Registra la primera en la pestaña Registro.</div>
  }

  async function borrar(e, j) {
    e.stopPropagation()
    const resumen = Object.entries(j.counts || {}).map(([sp, n]) => `${n} ${sp}`).join(', ') || 'sin piezas'
    if (confirm(`¿Borrar la jornada del ${fmtFecha(j.date)} (${resumen})?`)) {
      await db.jornadas.delete(j.id)
    }
  }

  // Agrupa por temporada+período, ya ordenado por fecha desc
  const grupos = []
  for (const j of jornadas) {
    const key = `${PERIODOS[j.period].label} ${j.season}`
    const last = grupos[grupos.length - 1]
    if (last && last.key === key) last.items.push(j)
    else grupos.push({ key, items: [j] })
  }

  return (
    <div>
      {grupos.map(g => (
        <div key={g.key}>
          <div className="season-head">
            {g.key} · {g.items.reduce((a, j) => a + totalPiezas(j), 0)} piezas en {g.items.length} {g.items.length === 1 ? 'jornada' : 'jornadas'}
          </div>
          <div className="card" style={{ padding: '2px 12px' }}>
            {g.items.map(j => (
              <div key={j.id} className="jornada-row" onClick={() => onEdit(j.id)}>
                <span className="fecha">{fmtFecha(j.date)}</span>
                <span className="detalle">
                  {Object.entries(j.counts || {}).map(([sp, n]) => `${n} ${sp}`).join(' · ') || 'sin piezas'}
                  {j.km ? ` · ${j.km} km` : ''}
                  {j.notes ? ` · ${j.notes}` : ''}
                </span>
                <span className="total">{totalPiezas(j)}</span>
                <button
                  className="chip"
                  aria-label="Borrar jornada"
                  style={{ padding: '4px 9px' }}
                  onClick={e => borrar(e, j)}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
