import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, totalPiezas } from '../db.js'
import { PERIODOS } from '../data/especies.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fmtFecha(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function Historial({ onEdit }) {
  const jornadas = useLiveQuery(() => db.jornadas.orderBy('date').reverse().toArray(), [])
  const [fAno, setFAno] = useState('')
  const [fMes, setFMes] = useState('')
  const [fDia, setFDia] = useState('')

  // Opciones de los desplegables, derivadas de las fechas que existen
  const opciones = useMemo(() => {
    if (!jornadas) return { anos: [], meses: [], dias: [] }
    const anos = [...new Set(jornadas.map(j => j.date.slice(0, 4)))].sort().reverse()
    const enAno = fAno ? jornadas.filter(j => j.date.slice(0, 4) === fAno) : jornadas
    const meses = [...new Set(enAno.map(j => j.date.slice(5, 7)))].sort()
    const enMes = fMes ? enAno.filter(j => j.date.slice(5, 7) === fMes) : enAno
    const dias = [...new Set(enMes.map(j => j.date.slice(8, 10)))].sort()
    return { anos, meses, dias }
  }, [jornadas, fAno, fMes])

  if (!jornadas) return null
  if (jornadas.length === 0) {
    return <div className="vacio">Sin jornadas todavía.<br />Registra la primera en la pestaña Registro.</div>
  }

  const filtradas = jornadas.filter(j =>
    (!fAno || j.date.slice(0, 4) === fAno) &&
    (!fMes || j.date.slice(5, 7) === fMes) &&
    (!fDia || j.date.slice(8, 10) === fDia)
  )
  const hayFiltro = fAno || fMes || fDia

  function cambiaAno(v) { setFAno(v); setFMes(''); setFDia('') }
  function cambiaMes(v) { setFMes(v); setFDia('') }

  async function borrar(e, j) {
    e.stopPropagation()
    const resumen = Object.entries(j.counts || {}).map(([sp, n]) => `${n} ${sp}`).join(', ') || 'sin piezas'
    if (confirm(`¿Borrar la jornada del ${fmtFecha(j.date)} (${resumen})?`)) {
      await db.jornadas.delete(j.id)
    }
  }

  // Agrupa por temporada+período, ya ordenado por fecha desc
  const grupos = []
  for (const j of filtradas) {
    const key = `${PERIODOS[j.period].label} ${j.season}`
    const last = grupos[grupos.length - 1]
    if (last && last.key === key) last.items.push(j)
    else grupos.push({ key, items: [j] })
  }

  return (
    <div>
      <div className="filtro-fecha">
        <label>
          Año
          <select value={fAno} onChange={e => cambiaAno(e.target.value)}>
            <option value="">Todos</option>
            {opciones.anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Mes
          <select value={fMes} onChange={e => cambiaMes(e.target.value)}>
            <option value="">Todos</option>
            {opciones.meses.map(m => <option key={m} value={m}>{MESES[parseInt(m, 10) - 1]}</option>)}
          </select>
        </label>
        <label>
          Día
          <select value={fDia} onChange={e => setFDia(e.target.value)}>
            <option value="">Todos</option>
            {opciones.dias.map(d => <option key={d} value={d}>{parseInt(d, 10)}</option>)}
          </select>
        </label>
        {hayFiltro && (
          <button className="chip quitar-filtro" onClick={() => { setFAno(''); setFMes(''); setFDia('') }}>
            ✕ Quitar
          </button>
        )}
      </div>

      {hayFiltro && (
        <div className="resumen-filtro">
          {filtradas.length === 1 ? '1 jornada' : `${filtradas.length} jornadas`} ·{' '}
          {filtradas.reduce((a, j) => a + totalPiezas(j), 0)} piezas con este filtro
        </div>
      )}

      {filtradas.length === 0 && <div className="vacio">Ninguna jornada coincide con el filtro.</div>}

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
