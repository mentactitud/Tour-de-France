// Meteo del coto vía Open-Meteo (gratuita, sin clave, con CORS).
// Previsión para la pantalla de registro y meteo del día guardada en cada jornada.

const CACHE_KEY = 'caza.meteo.cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 h

// Centro aproximado del mapa importado (linde/favoritos); null si no hay mapa
export function centroDelMapa(mapa) {
  if (!mapa) return null
  const pts = [
    ...(mapa.polygons || []).flatMap(p => p.coords),
    ...(mapa.lines || []).flatMap(l => l.coords),
    ...(mapa.points || []).map(p => [p.lat, p.lng])
  ]
  if (!pts.length) return null
  const lats = pts.map(p => p[0])
  const lngs = pts.map(p => p[1])
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2
  ]
}

// Código WMO → descripción y emoji
export function tiempoDe(code) {
  const c = Number(code)
  if (c === 0) return { emoji: '☀️', desc: 'despejado' }
  if (c <= 2) return { emoji: '🌤️', desc: 'poco nuboso' }
  if (c === 3) return { emoji: '☁️', desc: 'nublado' }
  if (c === 45 || c === 48) return { emoji: '🌫️', desc: 'niebla' }
  if (c <= 57) return { emoji: '🌦️', desc: 'llovizna' }
  if (c <= 67) return { emoji: '🌧️', desc: 'lluvia' }
  if (c <= 77) return { emoji: '🌨️', desc: 'nieve' }
  if (c <= 82) return { emoji: '🌦️', desc: 'chubascos' }
  if (c <= 86) return { emoji: '🌨️', desc: 'nieve' }
  return { emoji: '⛈️', desc: 'tormenta' }
}

export function rumbo(grados) {
  const puntos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return puntos[Math.round(((grados % 360) + 360) % 360 / 45) % 8]
}

const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant'

// Previsión de hoy + 3 días, con caché de 1 h para el campo
export async function getPrevision([lat, lng]) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cache && Date.now() - cache.ts < CACHE_TTL &&
        Math.abs(cache.lat - lat) < 0.05 && Math.abs(cache.lng - lng) < 0.05) {
      return cache.data
    }
  } catch { /* caché corrupta: se ignora */ }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m` +
    `&daily=${DAILY}&timezone=auto&forecast_days=4`
  const r = await fetch(url)
  if (!r.ok) throw new Error('meteo no disponible')
  const data = await r.json()
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), lat, lng, data }))
  return data
}

// Meteo de un día concreto (para guardarla en la jornada).
// Hasta ~3 meses atrás la da la API de previsión; más allá, el archivo histórico.
export async function meteoDeFecha([lat, lng], fecha) {
  const dias = (Date.now() - new Date(fecha + 'T12:00:00')) / 86400000
  const host = dias > 85
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast'
  const url = `${host}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    `&daily=${DAILY}&timezone=auto&start_date=${fecha}&end_date=${fecha}`
  const r = await fetch(url)
  if (!r.ok) throw new Error('meteo no disponible')
  const d = (await r.json()).daily
  if (!d?.time?.length || d.weather_code[0] == null) throw new Error('sin datos')
  return {
    code: d.weather_code[0],
    tmax: Math.round(d.temperature_2m_max[0]),
    tmin: Math.round(d.temperature_2m_min[0]),
    viento: Math.round(d.wind_speed_10m_max[0]),
    rumbo: rumbo(d.wind_direction_10m_dominant[0])
  }
}

export function textoMeteo(m) {
  if (!m) return null
  const t = tiempoDe(m.code)
  return `${t.emoji} ${t.desc}, ${m.tmin}–${m.tmax}°C, viento ${m.rumbo} ${m.viento} km/h`
}
