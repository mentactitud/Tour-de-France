// Orto, ocaso y fase lunar — cálculo local, sin internet.
// Precisión de ±2 min, de sobra para el horario orientativo de caza.

const rad = x => (x * Math.PI) / 180
const deg = x => (x * 180) / Math.PI

// Orto y ocaso (algoritmo de la "sunrise equation" de NOAA)
export function solDia([lat, lng], dateStr) {
  const fecha = new Date(dateStr + 'T12:00:00')
  const jd = fecha.getTime() / 86400000 + 2440587.5
  const n = Math.round(jd - 2451545 + 0.0009 - lng / 360)
  const jStar = n + 0.0009 - lng / 360
  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M))
  const lambda = (M + C + 180 + 102.9372) % 360
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda))
  const delta = Math.asin(Math.sin(rad(lambda)) * Math.sin(rad(23.4397)))
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * Math.sin(delta)) /
    (Math.cos(rad(lat)) * Math.cos(delta))
  if (cosW < -1 || cosW > 1) return null // sol de medianoche / noche polar
  const w = deg(Math.acos(cosW)) / 360
  const aDate = j => new Date((j - 2440587.5) * 86400000)
  return { orto: aDate(jTransit - w), ocaso: aDate(jTransit + w) }
}

// Fase lunar por edad del ciclo sinódico (29,53 días)
export function faseLunar(dateStr) {
  const jd = new Date(dateStr + 'T12:00:00').getTime() / 86400000 + 2440587.5
  const edad = (((jd - 2451550.1) % 29.530588853) + 29.530588853) % 29.530588853
  if (edad < 1.85) return { emoji: '🌑', nombre: 'luna nueva' }
  if (edad < 5.54) return { emoji: '🌒', nombre: 'creciente' }
  if (edad < 9.23) return { emoji: '🌓', nombre: 'cuarto creciente' }
  if (edad < 12.91) return { emoji: '🌔', nombre: 'creciente gibosa' }
  if (edad < 16.61) return { emoji: '🌕', nombre: 'luna llena' }
  if (edad < 20.30) return { emoji: '🌖', nombre: 'menguante gibosa' }
  if (edad < 23.99) return { emoji: '🌗', nombre: 'cuarto menguante' }
  if (edad < 27.68) return { emoji: '🌘', nombre: 'menguante' }
  return { emoji: '🌑', nombre: 'luna nueva' }
}

export const fmtHora = d =>
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
