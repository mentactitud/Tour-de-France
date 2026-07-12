import { unzipSync } from 'fflate'

// Distancia en km entre dos puntos [lat, lng]
export function haversineKm(a, b) {
  const R = 6371
  const rad = x => (x * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function kmDeTrack(points) {
  let km = 0
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i])
  return km
}

// Ray casting: ¿está [lat,lng] dentro del anillo [[lat,lng],…]?
function dentroDeAnillo(p, anillo) {
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [yi, xi] = anillo[i]
    const [yj, xj] = anillo[j]
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}

export function dentroDelCoto(p, mapa) {
  if (!mapa?.polygons?.length) return null
  return mapa.polygons.some(pg => dentroDeAnillo(p, pg.coords))
}

// "lng,lat[,alt] lng,lat[,alt] …" → [[lat,lng],…]
function parseCoords(texto) {
  return (texto || '')
    .trim()
    .split(/\s+/)
    .map(par => {
      const [lng, lat] = par.split(',').map(Number)
      return [lat, lng]
    })
    .filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]))
}

// KML de Google My Maps → { name, points, lines, polygons }
export function parseKML(texto) {
  const doc = new DOMParser().parseFromString(texto, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('KML no válido')
  const res = {
    name: doc.querySelector('Document > name')?.textContent?.trim() || 'Coto',
    points: [],
    lines: [],
    polygons: []
  }
  for (const pm of doc.querySelectorAll('Placemark')) {
    const name = pm.querySelector('name')?.textContent?.trim() || ''
    for (const pt of pm.querySelectorAll('Point > coordinates')) {
      const c = parseCoords(pt.textContent)[0]
      if (c) res.points.push({ name, lat: c[0], lng: c[1] })
    }
    for (const ln of pm.querySelectorAll('LineString > coordinates')) {
      const coords = parseCoords(ln.textContent)
      if (coords.length > 1) res.lines.push({ name, coords })
    }
    for (const pg of pm.querySelectorAll('Polygon')) {
      const outer = pg.querySelector('outerBoundaryIs coordinates') || pg.querySelector('coordinates')
      const coords = parseCoords(outer?.textContent)
      if (coords.length > 2) res.polygons.push({ name, coords })
    }
  }
  if (!res.points.length && !res.lines.length && !res.polygons.length) {
    if (doc.querySelector('NetworkLink')) {
      throw new Error(
        'Este KML es solo un enlace al mapa online. Al exportar desde My Maps, desmarca "Mantener actualizados los datos con el mapa".'
      )
    }
    throw new Error('El KML no contiene puntos, líneas ni polígonos')
  }
  return res
}

export async function parseKMLoKMZ(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  // KMZ = zip (empieza por "PK")
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf)
    const kmlName = Object.keys(files).find(n => n.toLowerCase().endsWith('.kml'))
    if (!kmlName) throw new Error('El KMZ no contiene ningún KML')
    return parseKML(new TextDecoder().decode(files[kmlName]))
  }
  return parseKML(new TextDecoder().decode(buf))
}

// GPX del reloj o de Wikiloc/Strava → { track, km, fecha, duracion }
// fecha/duracion salen de los <time> de los puntos (null si el GPX no trae horas)
export function parseGPX(texto) {
  const doc = new DOMParser().parseFromString(texto, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('GPX no válido')
  const track = []
  let primeraHora = null
  let ultimaHora = null
  for (const el of doc.querySelectorAll('trkpt, rtept')) {
    const lat = parseFloat(el.getAttribute('lat'))
    const lng = parseFloat(el.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    track.push([lat, lng])
    const t = Date.parse(el.querySelector('time')?.textContent || '')
    if (!Number.isNaN(t)) {
      if (primeraHora === null) primeraHora = t
      ultimaHora = t
    }
  }
  if (track.length < 2) throw new Error('El GPX no contiene ningún track')
  let fecha = null
  if (primeraHora !== null) {
    const d = new Date(primeraHora)
    fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return {
    track,
    km: Math.round(kmDeTrack(track) * 10) / 10,
    fecha,
    duracion: ultimaHora > primeraHora ? Math.round((ultimaHora - primeraHora) / 60000) : null
  }
}
