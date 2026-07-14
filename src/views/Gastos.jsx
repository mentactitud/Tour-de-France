import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, totalPiezas } from '../db.js'
import { anoCinegetico } from '../data/especies.js'
import { CATEGORIAS, EMOJI_CATEGORIA, EUR } from '../data/gastos.js'
import { StatTile } from '../components/charts.jsx'

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtFecha(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
}

const FORM_VACIO = { importe: '', categoria: 'Munición', concepto: '', fecha: hoy() }

export default function Gastos() {
  const gastos = useLiveQuery(() => db.gastos.toArray(), [])
  const jornadas = useLiveQuery(() => db.jornadas.toArray(), [])
  const [ano, setAno] = useState(anoCinegetico(hoy()))
  const [form, setForm] = useState(FORM_VACIO)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState('')

  const datos = useMemo(() => {
    if (!gastos || !jornadas) return null
    const anos = [...new Set([...gastos.map(g => anoCinegetico(g.fecha)), anoCinegetico(hoy())])].sort().reverse()
    const del = gastos.filter(g => anoCinegetico(g.fecha) === ano).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    const total = del.reduce((a, g) => a + g.importe, 0)
    const anoPrevio = `${parseInt(ano, 10) - 1}-${String(parseInt(ano, 10) % 100).padStart(2, '0')}`
    const totalPrevio = gastos
      .filter(g => anoCinegetico(g.fecha) === anoPrevio)
      .reduce((a, g) => a + g.importe, 0)
    const jAno = jornadas.filter(j => anoCinegetico(j.date) === ano)
    const piezas = jAno.reduce((a, j) => a + totalPiezas(j), 0)
    const cartuchos = jAno.reduce((a, j) => a + (j.cartuchos || 0), 0)
    const porCategoria = CATEGORIAS
      .map(c => ({ ...c, total: del.filter(g => g.categoria === c.id).reduce((a, g) => a + g.importe, 0) }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
    return { anos, del, total, totalPrevio, jornadas: jAno.length, piezas, cartuchos, porCategoria }
  }, [gastos, jornadas, ano])

  if (!datos) return null
  const maxCat = Math.max(1, ...datos.porCategoria.map(c => c.total))

  async function guardar() {
    const importe = parseFloat(String(form.importe).replace(',', '.'))
    if (!Number.isFinite(importe) || importe <= 0) { setMsg('⚠ Pon un importe válido'); return }
    if (!form.fecha) { setMsg('⚠ Falta la fecha'); return }
    const gasto = { fecha: form.fecha, categoria: form.categoria, concepto: form.concepto.trim(), importe }
    if (editId) await db.gastos.update(editId, gasto)
    else await db.gastos.add(gasto)
    setAno(anoCinegetico(form.fecha))
    setForm({ ...FORM_VACIO, fecha: hoy() })
    setEditId(null)
    setMsg('')
  }

  function editar(g) {
    setEditId(g.id)
    setForm({ importe: String(g.importe), categoria: g.categoria, concepto: g.concepto || '', fecha: g.fecha })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function borrar(e, g) {
    e.stopPropagation()
    if (confirm(`¿Borrar el gasto de ${EUR.format(g.importe)} (${g.categoria})?`)) {
      await db.gastos.delete(g.id)
      if (editId === g.id) { setEditId(null); setForm({ ...FORM_VACIO, fecha: hoy() }) }
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{editId ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        <div className="form-row">
          <label style={{ maxWidth: 130 }}>
            Importe (€)
            <input
              type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00"
              value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))}
            />
          </label>
          <label>
            Fecha
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </label>
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {CATEGORIAS.map(c => (
            <button
              key={c.id}
              className={'chip' + (form.categoria === c.id ? ' active' : '')}
              style={{ padding: '5px 10px', fontSize: 12.5 }}
              onClick={() => setForm(f => ({ ...f, categoria: c.id }))}
            >
              {c.emoji} {c.id}
            </button>
          ))}
        </div>
        <input
          type="text" placeholder="Concepto (opcional): caja del 24, cuota anual…"
          value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
          style={{ marginBottom: 10 }}
        />
        <button className="btn" onClick={guardar}>{editId ? 'Guardar cambios' : 'Añadir gasto'}</button>
        {editId && (
          <button className="btn secundario" onClick={() => { setEditId(null); setForm({ ...FORM_VACIO, fecha: hoy() }) }}>
            Cancelar edición
          </button>
        )}
        {msg && <div className="aviso" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="chips" style={{ margin: '4px 0 12px' }}>
        {datos.anos.map(a => (
          <button key={a} className={'chip' + (ano === a ? ' active' : '')} onClick={() => setAno(a)}>
            {a}
          </button>
        ))}
      </div>

      <div className="kpi-row">
        <StatTile
          label={`Total ${ano}`}
          value={EUR.format(datos.total)}
          delta={datos.totalPrevio > 0 ? Math.round(datos.total - datos.totalPrevio) : undefined}
          deltaLabel={datos.totalPrevio > 0 ? '€ vs año anterior' : ''}
        />
        <StatTile
          label="€ / jornada"
          value={datos.jornadas ? EUR.format(datos.total / datos.jornadas) : '—'}
        />
        <StatTile
          label="€ / pieza"
          value={datos.piezas ? EUR.format(datos.total / datos.piezas) : '—'}
        />
        <StatTile label={`Jornadas ${ano}`} value={datos.jornadas} />
      </div>

      {datos.porCategoria.length > 0 && (
        <div className="card">
          <h2>Por categoría</h2>
          {datos.porCategoria.map(c => (
            <div key={c.id} className="bar-fila" style={{ marginBottom: 6 }}>
              <span className="temp" style={{ width: 118, fontSize: 12 }}>{c.emoji} {c.id}</span>
              <div className="bar-pista">
                <div className="bar-relleno" style={{ width: `${(c.total / maxCat) * 100}%`, background: 'var(--series-1)' }} />
              </div>
              <span className="num" style={{ width: 62 }}>{EUR.format(c.total)}</span>
            </div>
          ))}
          {datos.cartuchos > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Cartuchos tirados en {ano}: {datos.cartuchos}
            </p>
          )}
        </div>
      )}

      {datos.del.length === 0 ? (
        <div className="vacio">Sin gastos en {ano}.</div>
      ) : (
        <div className="card" style={{ padding: '2px 12px' }}>
          {datos.del.map(g => (
            <div key={g.id} className="jornada-row" onClick={() => editar(g)}>
              <span className="fecha">{fmtFecha(g.fecha)}</span>
              <span className="detalle">
                {EMOJI_CATEGORIA[g.categoria] || '📦'} {g.categoria}
                {g.concepto ? ` · ${g.concepto}` : ''}
              </span>
              <span className="total">{EUR.format(g.importe)}</span>
              <button
                className="chip" aria-label="Borrar gasto" style={{ padding: '4px 9px' }}
                onClick={e => borrar(e, g)}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
