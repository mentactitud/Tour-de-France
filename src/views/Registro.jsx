import { useEffect, useState } from 'react'
import { db } from '../db.js'
import { PERIODOS, periodoPorFecha, temporadaPara } from '../data/especies.js'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Registro({ editId, onDone, onCancel }) {
  const [date, setDate] = useState(hoy())
  const [period, setPeriod] = useState(periodoPorFecha(hoy()))
  const [periodManual, setPeriodManual] = useState(false)
  const [counts, setCounts] = useState({})
  const [km, setKm] = useState('')
  const [notes, setNotes] = useState('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (!editId) return
    db.jornadas.get(editId).then(j => {
      if (!j) return
      setDate(j.date)
      setPeriod(j.period)
      setPeriodManual(true)
      setCounts(j.counts || {})
      setKm(j.km ?? '')
      setNotes(j.notes || '')
    })
  }, [editId])

  function cambiaFecha(v) {
    setDate(v)
    if (!periodManual && v) setPeriod(periodoPorFecha(v))
  }

  function suma(sp, delta) {
    setCounts(c => {
      const n = Math.max(0, (c[sp] || 0) + delta)
      const next = { ...c }
      if (n === 0) delete next[sp]
      else next[sp] = n
      return next
    })
  }

  async function guardar() {
    if (!date) return
    const jornada = {
      date,
      period,
      season: temporadaPara(date, period),
      counts,
      km: km === '' ? null : parseFloat(km),
      notes: notes.trim(),
      source: 'app'
    }
    if (editId) {
      await db.jornadas.update(editId, jornada)
    } else {
      await db.jornadas.add(jornada)
    }
    setGuardado(true)
    setTimeout(() => onDone(), 350)
  }

  const especies = PERIODOS[period].especies
  const totalDia = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="card">
        <h2>{editId ? 'Editar jornada' : 'Nueva jornada'}</h2>
        <div className="form-row">
          <label>
            Fecha
            <input type="date" value={date} onChange={e => cambiaFecha(e.target.value)} />
          </label>
          <label>
            Km andados
            <input
              type="number" inputMode="decimal" min="0" step="0.1"
              placeholder="—" value={km} onChange={e => setKm(e.target.value)}
            />
          </label>
        </div>
        <div className="chips" role="radiogroup" aria-label="Período">
          {Object.entries(PERIODOS).map(([id, p]) => (
            <button
              key={id}
              className={'chip' + (period === id ? ' active' : '')}
              onClick={() => { setPeriod(id); setPeriodManual(true) }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Piezas · {temporadaPara(date, period)} {totalDia > 0 ? `· ${totalDia} en total` : ''}</h2>
        <div className="especie-grid">
          {especies.map(sp => (
            <div key={sp} className={'contador' + (counts[sp] ? ' con-piezas' : '')}>
              <button aria-label={`Quitar ${sp}`} onClick={() => suma(sp, -1)}>−</button>
              <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <div className="nombre">{sp}</div>
                <div className="valor">{counts[sp] || 0}</div>
              </div>
              <button className="mas" aria-label={`Añadir ${sp}`} onClick={() => suma(sp, 1)}>+</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Notas</h2>
        <textarea
          placeholder="Meteo, zona, compañeros, perros…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <button className="btn" onClick={guardar} disabled={guardado}>
        {guardado ? '✓ Guardada' : editId ? 'Guardar cambios' : 'Guardar jornada'}
      </button>
      {editId && (
        <button className="btn secundario" onClick={() => { onCancel(); onDone() }}>
          Cancelar
        </button>
      )}
    </div>
  )
}
