import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, totalPiezas } from '../db.js'
import { PERIODOS, diaDeTemporada, inicioTemporada } from '../data/especies.js'
import { StatTile, BarrasEspecies, LineaAcumulado } from '../components/charts.jsx'

const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function Estadisticas() {
  const jornadas = useLiveQuery(() => db.jornadas.toArray(), [])
  const [period, setPeriod] = useState('veda_general')
  const [especie, setEspecie] = useState('Todas')

  const datos = useMemo(() => {
    if (!jornadas) return null
    const del = jornadas.filter(j => j.period === period).sort((a, b) => a.date < b.date ? -1 : 1)
    // Temporadas en orden cronológico; color fijo por temporada (nunca por rango)
    const seasons = [...new Set(del.map(j => j.season))].sort()
    const visibles = seasons.slice(-4)
    const colorMap = Object.fromEntries(visibles.map((s, i) => [s, SLOTS[i]]))
    return { del, seasons: visibles, colorMap }
  }, [jornadas, period])

  if (!datos) return null
  const { del, seasons, colorMap } = datos
  const colorDe = s => colorMap[s] || 'var(--muted)'

  const cambiaPeriodo = p => { setPeriod(p); setEspecie('Todas') }

  if (del.length === 0) {
    return (
      <div>
        <FiltroPeriodo period={period} setPeriod={cambiaPeriodo} />
        <div className="vacio">Sin jornadas de {PERIODOS[period].label}.</div>
      </div>
    )
  }

  // ---- Especies con datos en este período (para chips y barras) ----
  const especiesConDatos = PERIODOS[period].especies.filter(sp =>
    del.some(j => (j.counts?.[sp] || 0) > 0)
  )
  const espSel = especie !== 'Todas' && !especiesConDatos.includes(especie) ? 'Todas' : especie

  const cuenta = j => espSel === 'Todas'
    ? totalPiezas(j)
    : (j.counts?.[espSel] || 0)

  // ---- KPIs de la temporada actual ----
  const actual = seasons[seasons.length - 1]
  const anterior = seasons[seasons.length - 2]
  const jActual = del.filter(j => j.season === actual)
  const piezasActual = jActual.reduce((a, j) => a + cuenta(j), 0)
  const ultimoDia = Math.max(...jActual.map(j => diaDeTemporada(j.date, period, actual)))

  // Comparativa honesta: acumulado de la temporada anterior a la MISMA altura
  let delta = null
  if (anterior) {
    const acumAnt = del
      .filter(j => j.season === anterior && diaDeTemporada(j.date, period, anterior) <= ultimoDia)
      .reduce((a, j) => a + cuenta(j), 0)
    delta = piezasActual - acumAnt
  }

  const kmTotal = jActual.reduce((a, j) => a + (j.km || 0), 0)
  const mejorJornada = Math.max(0, ...jActual.map(cuenta))
  const cartTotal = jActual.reduce((a, j) => a + (j.cartuchos || 0), 0)
  // puntería sobre el total de piezas de la temporada (no filtrado por especie)
  const piezasTemporada = jActual.reduce((a, j) => a + totalPiezas(j), 0)

  // ---- Series de acumulado por temporada ----
  const series = seasons.map(s => {
    let cum = 0
    const points = del
      .filter(j => j.season === s)
      .map(j => {
        cum += cuenta(j)
        return { x: diaDeTemporada(j.date, period, s), y: cum }
      })
    return { name: s, color: colorDe(s), points: [{ x: 0, y: 0 }, ...points] }
  }).filter(s => s.points.length > 1)

  // ---- Totales por especie y temporada ----
  const bloques = especiesConDatos.map(sp => ({
    especie: sp,
    valores: seasons.map(s => ({
      season: s,
      total: del.filter(j => j.season === s).reduce((a, j) => a + (j.counts?.[sp] || 0), 0)
    }))
  }))

  const mesInicio = inicioTemporada(period, actual).getMonth()

  return (
    <div>
      <FiltroPeriodo period={period} setPeriod={cambiaPeriodo} />

      <div className="kpi-row">
        <StatTile
          label={`Piezas ${actual}${espSel !== 'Todas' ? ` · ${espSel}` : ''}`}
          value={piezasActual}
          delta={delta}
          deltaLabel={anterior ? `vs ${anterior} a igual fecha` : ''}
        />
        <StatTile label={`Jornadas ${actual}`} value={jActual.length} />
        <StatTile
          label="Piezas / jornada"
          value={jActual.length ? (piezasActual / jActual.length).toFixed(1) : '0'}
        />
        {kmTotal > 0
          ? <StatTile label={`Km andados ${actual}`} value={kmTotal.toFixed(1)} />
          : <StatTile label="Mejor jornada" value={mejorJornada} />}
      </div>

      {cartTotal > 0 && (
        <div className="kpi-row">
          <StatTile label={`Cartuchos ${actual}`} value={cartTotal} />
          <StatTile
            label="Cartuchos / pieza"
            value={piezasTemporada ? (cartTotal / piezasTemporada).toFixed(1) : '—'}
          />
        </div>
      )}

      <div className="card">
        <h2>Acumulado de temporada{espSel !== 'Todas' ? ` · ${espSel}` : ''}</h2>
        <div className="chips" style={{ marginBottom: 10 }}>
          {['Todas', ...especiesConDatos].map(sp => (
            <button
              key={sp}
              className={'chip' + (espSel === sp ? ' active' : '')}
              style={{ padding: '5px 11px', fontSize: 12 }}
              onClick={() => setEspecie(sp)}
            >
              {sp}
            </button>
          ))}
        </div>
        <LineaAcumulado series={series} mesInicio={mesInicio} mesesEtiquetas={MESES} />
      </div>

      <div className="card">
        <h2>Total por especie y temporada</h2>
        <BarrasEspecies bloques={bloques} colorDe={colorDe} />
        <div className="legend">
          {seasons.map(s => (
            <span key={s} className="item">
              <span className="dot" style={{ background: colorDe(s) }} />{s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FiltroPeriodo({ period, setPeriod }) {
  return (
    <div className="chips" style={{ margin: '4px 0 12px' }}>
      {Object.entries(PERIODOS).map(([id, p]) => (
        <button
          key={id}
          className={'chip' + (period === id ? ' active' : '')}
          onClick={() => setPeriod(id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
