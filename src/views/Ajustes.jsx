import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { zipSync } from 'fflate'
import { db, reimportHistorico, totalPiezas, cargarMapa } from '../db.js'
import { ESPECIES, PERIODOS } from '../data/especies.js'
import ImportarKML from '../components/ImportarKML.jsx'

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export default function Ajustes() {
  const [msg, setMsg] = useState('')
  const n = useLiveQuery(() => db.jornadas.count(), [])
  const piezas = useLiveQuery(
    async () => (await db.jornadas.toArray()).reduce((a, j) => a + totalPiezas(j), 0), []
  )

  async function exportarJSON() {
    const todas = await db.jornadas.orderBy('date').toArray()
    descargar(
      `caza-borges-blanques-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(todas, null, 1),
      'application/json'
    )
  }

  async function exportarCSV() {
    const todas = await db.jornadas.orderBy('date').toArray()
    const cab = ['fecha', 'periodo', 'temporada', ...ESPECIES, 'total', 'km', 'notas']
    const filas = todas.map(j => [
      j.date,
      PERIODOS[j.period].label,
      j.season,
      ...ESPECIES.map(sp => j.counts?.[sp] ?? ''),
      totalPiezas(j),
      j.km ?? '',
      `"${(j.notes || '').replaceAll('"', '""')}"`
    ].join(';'))
    descargar(
      `caza-borges-blanques-${new Date().toISOString().slice(0, 10)}.csv`,
      '﻿' + [cab.join(';'), ...filas].join('\n'),
      'text/csv;charset=utf-8'
    )
  }

  async function importarJSON(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data)) throw new Error('formato')
      const limpias = data
        .filter(j => j && typeof j.date === 'string' && j.period in PERIODOS)
        .map(({ id, ...j }) => j)
      if (!limpias.length) throw new Error('vacío')
      if (confirm(`El archivo contiene ${limpias.length} jornadas. ¿Añadirlas a las ${n} actuales?`)) {
        await db.jornadas.bulkAdd(limpias)
        setMsg(`✓ ${limpias.length} jornadas importadas`)
      }
    } catch {
      setMsg('⚠ No se pudo leer el archivo (debe ser un JSON exportado por esta app)')
    }
    e.target.value = ''
  }

  async function reimportar() {
    const añadidas = await reimportHistorico()
    setMsg(añadidas ? `✓ ${añadidas} jornadas del Excel recuperadas` : 'El histórico del Excel ya está completo')
  }

  async function exportarFotosZip() {
    const fotos = await db.fotos.toArray()
    if (!fotos.length) { setMsg('No hay fotos guardadas todavía.'); return }
    const jornadas = new Map((await db.jornadas.toArray()).map(j => [j.id, j.date]))
    const entradas = {}
    const contador = {}
    for (const f of fotos) {
      const fecha = jornadas.get(f.jornadaId) || 'sin-fecha'
      contador[fecha] = (contador[fecha] || 0) + 1
      entradas[`${fecha}/caza-${fecha}-${contador[fecha]}.jpg`] =
        new Uint8Array(await f.blob.arrayBuffer())
    }
    const zip = zipSync(entradas, { level: 0 }) // JPEG ya comprimido
    descargar(`fotos-caza-${new Date().toISOString().slice(0, 10)}.zip`, zip, 'application/zip')
    setMsg(`✓ ${fotos.length} fotos exportadas en zip`)
  }

  async function borrarTodo() {
    if (!confirm(`¿Borrar TODAS las jornadas (${n})? Esta acción no se puede deshacer.`)) return
    if (!confirm('¿Seguro? Se perderá todo lo registrado en este dispositivo.')) return
    await db.jornadas.clear()
    setMsg('Datos borrados. Puedes recuperar el histórico del Excel con el botón de arriba.')
  }

  return (
    <div>
      <div className="card">
        <h2>Datos</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 10 }}>
          {n ?? '…'} jornadas · {piezas ?? '…'} piezas guardadas en este dispositivo.
        </p>
        <button className="btn secundario" onClick={exportarJSON}>Exportar copia (JSON)</button>
        <button className="btn secundario" onClick={exportarCSV}>Exportar a Excel (CSV)</button>
        <label className="btn secundario" style={{ textAlign: 'center', cursor: 'pointer' }}>
          Importar copia JSON
          <input type="file" accept="application/json" onChange={importarJSON} style={{ display: 'none' }} />
        </label>
        <button className="btn secundario" onClick={reimportar}>Recuperar histórico del Excel</button>
        <button className="btn secundario" onClick={exportarFotosZip}>Exportar fotos (zip)</button>
      </div>

      <div className="card">
        <h2>Mapa del coto</h2>
        <EstadoMapa />
        <ImportarKML />
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8 }}>
          Exporta el archivo desde Google My Maps: menú ⋮ → «Exportar a KML/KMZ»,
          desmarcando «Mantener actualizados los datos con el mapa».
        </p>
      </div>

      <div className="aviso">
        <b>Copia de seguridad:</b> los datos viven en este dispositivo (funciona sin cobertura).
        Exporta el JSON de vez en cuando y guárdalo en tu Drive (las fotos van aparte,
        con «Exportar fotos (zip)» o compartiéndolas desde cada jornada).
      </div>

      <div className="card">
        <h2>Zona de peligro</h2>
        <button className="btn peligro" onClick={borrarTodo}>Borrar todos los datos</button>
      </div>

      {msg && <div className="aviso">{msg}</div>}
    </div>
  )
}

function EstadoMapa() {
  const mapa = useLiveQuery(() => cargarMapa(), [])
  if (!mapa) return <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 10 }}>Sin mapa cargado.</p>
  return (
    <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 10 }}>
      «{mapa.name}»: {mapa.polygons.length} zona(s), {mapa.lines.length} línea(s), {mapa.points.length} favorito(s).
    </p>
  )
}
