import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cargarMapa } from '../db.js'
import { centroDelMapa, getPrevision, tiempoDe, rumbo } from '../utils/meteo.js'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function Prevision() {
  // null = "consultado y no hay mapa" (undefined sería "aún cargando")
  const mapa = useLiveQuery(async () => (await cargarMapa()) ?? null, [])
  const [datos, setDatos] = useState(null)
  const [coords, setCoords] = useState(null)

  // coordenadas: centro del coto; si no hay mapa, la posición del móvil
  useEffect(() => {
    if (mapa === undefined) return
    const c = centroDelMapa(mapa)
    if (c) { setCoords(c); return }
    navigator.geolocation?.getCurrentPosition(
      p => setCoords([p.coords.latitude, p.coords.longitude]),
      () => {},
      { maximumAge: 600000, timeout: 8000 }
    )
  }, [mapa])

  useEffect(() => {
    if (!coords) return
    let vivo = true
    getPrevision(coords).then(d => { if (vivo) setDatos(d) }).catch(() => {})
    return () => { vivo = false }
  }, [coords])

  if (!datos?.daily) return null
  const cur = datos.current
  const d = datos.daily

  return (
    <div className="card prevision">
      <h2>El tiempo en el coto</h2>
      {cur && (
        <div className="prev-actual">
          <span className="prev-emoji">{tiempoDe(cur.weather_code).emoji}</span>
          <span className="prev-temp">{Math.round(cur.temperature_2m)}°</span>
          <span className="prev-detalle">
            {tiempoDe(cur.weather_code).desc} · viento {rumbo(cur.wind_direction_10m)}{' '}
            {Math.round(cur.wind_speed_10m)} km/h
          </span>
        </div>
      )}
      <div className="prev-dias">
        {d.time.map((fecha, i) => (
          <div key={fecha} className="prev-dia">
            <span className="d">{i === 0 ? 'hoy' : DIAS[new Date(fecha + 'T12:00:00').getDay()]}</span>
            <span className="e">{tiempoDe(d.weather_code[i]).emoji}</span>
            <span className="t">{Math.round(d.temperature_2m_max[i])}°<em>/{Math.round(d.temperature_2m_min[i])}°</em></span>
            <span className="v">{rumbo(d.wind_direction_10m_dominant[i])} {Math.round(d.wind_speed_10m_max[i])}</span>
            {d.precipitation_probability_max?.[i] > 20 && (
              <span className="p">💧{d.precipitation_probability_max[i]}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
