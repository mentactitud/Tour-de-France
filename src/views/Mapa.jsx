import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, cargarMapa, totalPiezas } from '../db.js'
import { dentroDelCoto } from '../utils/geo.js'
import ImportarKML from '../components/ImportarKML.jsx'

const BORGES = [41.522, 0.866] // centro aproximado de Les Borges Blanques

export default function Mapa() {
  const mapa = useLiveQuery(() => cargarMapa(), [])
  const conTrack = useLiveQuery(
    async () => (await db.jornadas.toArray()).filter(j => j.track?.length > 1).sort((a, b) => (a.date < b.date ? 1 : -1)),
    []
  )
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const capasRef = useRef({})
  const [dentro, setDentro] = useState(null)
  const [trackId, setTrackId] = useState('')

  // crea el mapa una vez
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const pnoa = L.tileLayer(
      'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}',
      { maxZoom: 19, attribution: '© Instituto Geográfico Nacional de España' }
    )
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    })
    const map = L.map(divRef.current, { center: BORGES, zoom: 13, layers: [pnoa], zoomControl: true })
    L.control.layers({ 'Satélite (PNOA)': pnoa, Callejero: osm }, null, { position: 'topright' }).addTo(map)
    mapRef.current = map

    // posición en directo
    let marcador = null
    let circulo = null
    const watchId = navigator.geolocation?.watchPosition(
      pos => {
        const p = [pos.coords.latitude, pos.coords.longitude]
        if (!marcador) {
          marcador = L.circleMarker(p, { radius: 8, color: '#fff', weight: 2, fillColor: '#2a78d6', fillOpacity: 1 }).addTo(map)
          circulo = L.circle(p, { radius: pos.coords.accuracy, color: '#2a78d6', weight: 1, fillOpacity: 0.08 }).addTo(map)
        } else {
          marcador.setLatLng(p)
          circulo.setLatLng(p).setRadius(pos.coords.accuracy)
        }
        capasRef.current.pos = p
        if (capasRef.current.mapaDatos) setDentro(dentroDelCoto(p, capasRef.current.mapaDatos))
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => {
      if (watchId != null) navigator.geolocation?.clearWatch(watchId)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // dibuja el coto cuando llega de la BD
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapa === undefined) return
    capasRef.current.coto?.remove()
    capasRef.current.mapaDatos = mapa || null
    if (!mapa) return
    const g = L.featureGroup()
    for (const pg of mapa.polygons || []) {
      L.polygon(pg.coords, { color: '#eda100', weight: 3, fillColor: '#eda100', fillOpacity: 0.06 })
        .bindPopup(pg.name || mapa.name).addTo(g)
    }
    for (const ln of mapa.lines || []) {
      L.polyline(ln.coords, { color: '#eda100', weight: 3 }).bindPopup(ln.name || mapa.name).addTo(g)
    }
    for (const pt of mapa.points || []) {
      L.circleMarker([pt.lat, pt.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#e34948', fillOpacity: 1 })
        .bindPopup(pt.name || 'Favorito').addTo(g)
    }
    g.addTo(map)
    capasRef.current.coto = g
    if (g.getBounds().isValid()) map.fitBounds(g.getBounds().pad(0.08))
    if (capasRef.current.pos) setDentro(dentroDelCoto(capasRef.current.pos, mapa))
  }, [mapa])

  // superpone el track de la jornada elegida
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    capasRef.current.track?.remove()
    capasRef.current.track = null
    if (!trackId || !conTrack) return
    const j = conTrack.find(x => String(x.id) === trackId)
    if (!j) return
    const g = L.featureGroup()
    L.polyline(j.track, { color: '#e34948', weight: 3 }).addTo(g)
    for (const lance of j.lances || []) {
      if (lance.lat == null) continue
      L.circleMarker([lance.lat, lance.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#008300', fillOpacity: 1 })
        .bindPopup(lance.sp).addTo(g)
    }
    g.addTo(map)
    capasRef.current.track = g
    if (g.getBounds().isValid()) map.fitBounds(g.getBounds().pad(0.15))
  }, [trackId, conTrack])

  const sinMapa = mapa === null

  return (
    <div className="mapa-wrap">
      <div className="mapa-barra">
        {dentro !== null && (
          <span className={'badge-coto ' + (dentro ? 'dentro' : 'fuera')}>
            {dentro ? '✓ Dentro del coto' : '✗ Fuera del coto'}
          </span>
        )}
        {conTrack?.length > 0 && (
          <select value={trackId} onChange={e => setTrackId(e.target.value)} aria-label="Ver ruta de jornada">
            <option value="">Ver ruta de jornada…</option>
            {conTrack.map(j => (
              <option key={j.id} value={j.id}>
                {j.date} · {totalPiezas(j)} piezas{j.km ? ` · ${j.km} km` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <div ref={divRef} className="mapa-leaflet" />
      {sinMapa && (
        <div className="mapa-aviso">
          <b>Aún no has cargado el mapa del coto.</b>
          <p>
            En Google My Maps: menú <b>⋮ → Exportar a KML/KMZ</b>, desmarca «Mantener
            actualizados los datos» y descarga el archivo. Luego impórtalo aquí:
          </p>
          <ImportarKML />
        </div>
      )}
    </div>
  )
}
