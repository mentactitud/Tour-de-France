import { useState } from 'react'
import { parseKMLoKMZ } from '../utils/geo.js'
import { guardarMapa } from '../db.js'

export default function ImportarKML() {
  const [msg, setMsg] = useState('')

  async function importar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const mapa = await parseKMLoKMZ(file)
      await guardarMapa(mapa)
      setMsg(
        `✓ «${mapa.name}»: ${mapa.polygons.length} zona(s), ${mapa.lines.length} línea(s), ${mapa.points.length} favorito(s)`
      )
    } catch (err) {
      setMsg('⚠ ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div>
      <label className="btn secundario" style={{ textAlign: 'center', cursor: 'pointer' }}>
        Importar mapa del coto (KML/KMZ)
        <input
          type="file"
          accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
          onChange={importar}
          style={{ display: 'none' }}
        />
      </label>
      {msg && <div className="aviso">{msg}</div>}
    </div>
  )
}
