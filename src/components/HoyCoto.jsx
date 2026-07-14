import { useLiveQuery } from 'dexie-react-hooks'
import { cargarMapa, cargarVedas } from '../db.js'
import { centroDelMapa } from '../utils/meteo.js'
import { solDia, faseLunar, fmtHora } from '../utils/sol.js'
import { VEDAS_DEFECTO, estadoVedas } from '../data/vedas.js'
import { PERIODOS } from '../data/especies.js'

const BORGES = [41.522, 0.866]

function fmtDia(d) {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function HoyCoto() {
  const mapa = useLiveQuery(async () => (await cargarMapa()) ?? null, [])
  const vedas = useLiveQuery(async () => (await cargarVedas()) ?? VEDAS_DEFECTO, [])

  if (mapa === undefined || !vedas) return null
  const coords = centroDelMapa(mapa) || BORGES
  const hoyStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD local
  const sol = solDia(coords, hoyStr)
  const luna = faseLunar(hoyStr)
  const { abiertos, proximos } = estadoVedas(vedas)

  return (
    <div className="card hoy-coto">
      <div className="hc-linea">
        {sol && (
          <>
            <span>🌅 {fmtHora(sol.orto)}</span>
            <span>🌇 {fmtHora(sol.ocaso)}</span>
          </>
        )}
        <span>{luna.emoji} {luna.nombre}</span>
      </div>
      {sol && (
        <div className="hc-habil">
          Horario hábil orientativo:{' '}
          <b>{fmtHora(new Date(sol.orto.getTime() - 3600000))} – {fmtHora(new Date(sol.ocaso.getTime() + 3600000))}</b>
          {' '}(1 h antes y después del sol; consulta tu resolución de vedas)
        </div>
      )}
      <div className="hc-vedas">
        {abiertos.map(a => (
          <span key={a.period} className="hc-veda abierta">
            🔓 {PERIODOS[a.period].label} · cierra el {fmtDia(a.fecha)} ({a.dias} {a.dias === 1 ? 'día' : 'días'})
          </span>
        ))}
        {abiertos.length === 0 && proximos[0] && (
          <span className="hc-veda">
            ⏳ {PERIODOS[proximos[0].period].label} abre el {fmtDia(proximos[0].fecha)} ({proximos[0].dias} días)
          </span>
        )}
        {abiertos.length > 0 && proximos[0] && (
          <span className="hc-veda">
            ⏳ Siguiente: {PERIODOS[proximos[0].period].label} el {fmtDia(proximos[0].fecha)} ({proximos[0].dias} días)
          </span>
        )}
      </div>
    </div>
  )
}
