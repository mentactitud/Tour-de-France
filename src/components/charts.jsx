import { useRef, useState } from 'react'

export function StatTile({ label, value, delta, deltaLabel }) {
  let cls = 'flat', arrow = ''
  if (typeof delta === 'number' && delta > 0) { cls = 'up'; arrow = '▲ ' }
  if (typeof delta === 'number' && delta < 0) { cls = 'down'; arrow = '▼ ' }
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={'delta ' + cls}>
          {arrow}{delta > 0 ? '+' : ''}{delta} {deltaLabel}
        </div>
      )}
    </div>
  )
}

// Barras horizontales agrupadas: un bloque por especie, una barra por temporada.
// Valor visible junto a cada barra (regla de socorro: el color nunca va solo).
export function BarrasEspecies({ bloques, colorDe }) {
  const max = Math.max(1, ...bloques.flatMap(b => b.valores.map(v => v.total)))
  return (
    <div>
      {bloques.map(b => (
        <div key={b.especie} className="especie-bloque">
          <div className="especie-nombre">{b.especie}</div>
          {b.valores.map(v => (
            <div key={v.season} className="bar-fila">
              <span className="temp">{v.season}</span>
              <div className="bar-pista">
                <div
                  className="bar-relleno"
                  style={{ width: `${(v.total / max) * 100}%`, background: colorDe(v.season) }}
                />
              </div>
              <span className="num">{v.total}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Línea de acumulado por temporada. x = día de temporada, y = piezas acumuladas.
// Crosshair + tooltip al tocar/pasar el dedo; etiquetas directas al final de línea.
export function LineaAcumulado({ series, mesInicio, mesesEtiquetas }) {
  const W = 360, H = 210
  const M = { top: 10, right: 64, bottom: 24, left: 34 }
  const ref = useRef(null)
  const [hover, setHover] = useState(null)

  const todasX = series.flatMap(s => s.points.map(p => p.x))
  const todasY = series.flatMap(s => s.points.map(p => p.y))
  if (todasX.length === 0) return <div className="vacio">Sin datos para esta selección.</div>

  const maxX = Math.max(...todasX, 30)
  const maxY = Math.max(...todasY, 5)
  const sx = x => M.left + (x / maxX) * (W - M.left - M.right)
  const sy = y => H - M.bottom - (y / maxY) * (H - M.top - M.bottom)

  // Ticks del eje X en los inicios de mes desde el inicio del período
  const ticksX = []
  const base = new Date(2001, mesInicio, 1)
  for (let i = 0; i <= 6; i++) {
    const d = new Date(2001, mesInicio + i, 1)
    const off = Math.round((d - base) / 86400000)
    if (off > maxX) break
    ticksX.push({ x: off, label: mesesEtiquetas[(mesInicio + i) % 12] })
  }
  const ticksY = [0, Math.round(maxY / 2), maxY]

  function onMove(e) {
    const rect = ref.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const dia = ((px - M.left) / (W - M.left - M.right)) * maxX
    if (dia < -3 || dia > maxX + 3) { setHover(null); return }
    // valor acumulado de cada temporada en ese día (último punto <= día)
    const filas = series.map(s => {
      let last = null
      for (const p of s.points) { if (p.x <= dia + 0.5) last = p; else break }
      if (!last) return null
      return { name: s.name, color: s.color, y: last.y, x: last.x }
    }).filter(Boolean)
    if (!filas.length) { setHover(null); return }
    const diaSnap = Math.max(0, Math.min(Math.round(dia), maxX))
    setHover({ dia: diaSnap, filas, px: (sx(diaSnap) / W) * rect.width })
  }

  const fechaDe = dia => {
    const d = new Date(2001, mesInicio, 1 + dia)
    return `${d.getDate()} ${mesesEtiquetas[d.getMonth()]}`
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticksY.map(t => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)}
              stroke="var(--grid)" strokeWidth="1" />
            <text x={M.left - 6} y={sy(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)} stroke="var(--baseline)" strokeWidth="1" />
        {ticksX.map(t => (
          <text key={t.x} x={sx(t.x)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {t.label}
          </text>
        ))}
        {hover && (
          <line x1={sx(hover.dia)} x2={sx(hover.dia)} y1={M.top} y2={H - M.bottom}
            stroke="var(--baseline)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {series.map(s => {
          const pts = s.points
          if (!pts.length) return null
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
          const fin = pts[pts.length - 1]
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={sx(fin.x)} cy={sy(fin.y)} r="3" fill={s.color}
                stroke="var(--surface)" strokeWidth="2" />
              <text x={sx(fin.x) + 7} y={sy(fin.y) + 3.5} fontSize="10.5" fontWeight="600" fill="var(--ink-2)">
                {s.name}
              </text>
            </g>
          )
        })}
        {hover && hover.filas.map(f => (
          <circle key={f.name} cx={sx(Math.min(f.x, hover.dia))} cy={sy(f.y)} r="4"
            fill={f.color} stroke="var(--surface)" strokeWidth="2" />
        ))}
      </svg>
      {hover && (
        <div
          className="tooltip-box"
          style={{
            left: hover.px > (ref.current?.getBoundingClientRect().width ?? 360) / 2 ? undefined : hover.px + 12,
            right: hover.px > (ref.current?.getBoundingClientRect().width ?? 360) / 2
              ? (ref.current?.getBoundingClientRect().width ?? 360) - hover.px + 12 : undefined,
            top: 4
          }}
        >
          <div className="t-fecha">{fechaDe(hover.dia)}</div>
          {hover.filas.map(f => (
            <div key={f.name} className="t-fila">
              <span className="t-dot" style={{ background: f.color }} />
              <span>{f.name}: <b>{f.y}</b></span>
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        {series.map(s => (
          <span key={s.name} className="item">
            <span className="dot" style={{ background: s.color }} />{s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
