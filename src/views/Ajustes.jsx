import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { zipSync } from 'fflate'
import { db, reimportHistorico, totalPiezas, cargarMapa, cargarVedas, guardarVedas } from '../db.js'
import { ESPECIES, PERIODOS } from '../data/especies.js'
import { VEDAS_DEFECTO } from '../data/vedas.js'
import { leerExcel, descargarPlantilla } from '../utils/excel.js'
import { COMPARTIR } from '../variante.js'
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
  const nGastos = useLiveQuery(() => db.gastos.count(), [])
  const piezas = useLiveQuery(
    async () => (await db.jornadas.toArray()).reduce((a, j) => a + totalPiezas(j), 0), []
  )

  async function exportarJSON() {
    const [jornadas, gastos] = await Promise.all([
      db.jornadas.orderBy('date').toArray(),
      db.gastos.orderBy('fecha').toArray()
    ])
    descargar(
      `caza-borges-blanques-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 2, jornadas, gastos }, null, 1),
      'application/json'
    )
  }

  async function exportarCSV() {
    const todas = await db.jornadas.orderBy('date').toArray()
    const cab = ['fecha', 'periodo', 'temporada', ...ESPECIES, 'total', 'km', 'cartuchos', 'notas']
    const filas = todas.map(j => [
      j.date,
      PERIODOS[j.period].label,
      j.season,
      ...ESPECIES.map(sp => j.counts?.[sp] ?? ''),
      totalPiezas(j),
      j.km ?? '',
      j.cartuchos ?? '',
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
      // formato antiguo: array plano de jornadas; nuevo: {jornadas, gastos}
      const brutoJ = Array.isArray(data) ? data : data?.jornadas
      const brutoG = Array.isArray(data) ? [] : data?.gastos || []
      if (!Array.isArray(brutoJ)) throw new Error('formato')
      const limpias = brutoJ
        .filter(j => j && typeof j.date === 'string' && j.period in PERIODOS)
        .map(({ id, ...j }) => j)
      const gastosLimpios = brutoG
        .filter(g => g && typeof g.fecha === 'string' && Number.isFinite(g.importe))
        .map(({ id, ...g }) => g)
      if (!limpias.length && !gastosLimpios.length) throw new Error('vacío')
      const partes = []
      if (limpias.length) partes.push(`${limpias.length} jornadas`)
      if (gastosLimpios.length) partes.push(`${gastosLimpios.length} gastos`)
      if (confirm(`El archivo contiene ${partes.join(' y ')}. ¿Añadirlos a los datos actuales?`)) {
        if (limpias.length) await db.jornadas.bulkAdd(limpias)
        if (gastosLimpios.length) await db.gastos.bulkAdd(gastosLimpios)
        setMsg(`✓ Importados ${partes.join(' y ')}`)
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

  async function exportarGastosCSV() {
    const todos = await db.gastos.orderBy('fecha').toArray()
    if (!todos.length) { setMsg('No hay gastos registrados todavía.'); return }
    const filas = todos.map(g =>
      [g.fecha, g.categoria, `"${(g.concepto || '').replaceAll('"', '""')}"`, String(g.importe).replace('.', ',')].join(';')
    )
    descargar(
      `gastos-caza-${new Date().toISOString().slice(0, 10)}.csv`,
      '﻿' + ['fecha;categoria;concepto;importe', ...filas].join('\n'),
      'text/csv;charset=utf-8'
    )
  }

  async function importarExcel(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { jornadas, gastos, avisos } = await leerExcel(file)
      const partes = []
      if (jornadas.length) {
        const piezasNuevas = jornadas.reduce((a, j) => a + totalPiezas(j), 0)
        partes.push(`${jornadas.length} jornadas con ${piezasNuevas} piezas`)
      }
      if (gastos.length) {
        const totalG = gastos.reduce((a, g) => a + g.importe, 0)
        partes.push(`${gastos.length} gastos (${totalG.toFixed(2)} €)`)
      }
      if (!confirm(
        `El Excel contiene ${partes.join(' y ')}.` +
        (avisos.length ? `\n\nAvisos:\n· ${avisos.slice(0, 5).join('\n· ')}` : '') +
        `\n\n¿Añadirlos a los datos actuales?`
      )) return
      if (jornadas.length) await db.jornadas.bulkAdd(jornadas)
      if (gastos.length) await db.gastos.bulkAdd(gastos)
      setMsg(`✓ Importados: ${partes.join(' y ')}${avisos.length ? ` (${avisos.length} avisos)` : ''}`)
    } catch (err) {
      setMsg('⚠ ' + err.message)
    }
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
    if (!confirm(`¿Borrar TODOS los datos (${n} jornadas, fotos y gastos)? Esta acción no se puede deshacer.`)) return
    if (!confirm('¿Seguro? Se perderá todo lo registrado en este dispositivo.')) return
    await Promise.all([db.jornadas.clear(), db.fotos.clear(), db.gastos.clear()])
    setMsg('Datos borrados. Puedes recuperar el histórico del Excel con el botón de arriba.')
  }

  return (
    <div>
      <div className="card">
        <h2>Datos</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 10 }}>
          {n ?? '…'} jornadas · {piezas ?? '…'} piezas
          {nGastos ? ` · ${nGastos} gastos` : ''} en este dispositivo.
        </p>
        <button className="btn secundario" onClick={exportarJSON}>Exportar copia (JSON)</button>
        <button className="btn secundario" onClick={exportarCSV}>Exportar a Excel (CSV)</button>
        <button className="btn secundario" onClick={exportarGastosCSV}>Exportar gastos (CSV)</button>
        <label className="btn secundario" style={{ textAlign: 'center', cursor: 'pointer' }}>
          Importar copia JSON
          <input type="file" accept="application/json" onChange={importarJSON} style={{ display: 'none' }} />
        </label>
        {!COMPARTIR && (
          <button className="btn secundario" onClick={reimportar}>Recuperar histórico del Excel</button>
        )}
        <button className="btn secundario" onClick={exportarFotosZip}>Exportar fotos (zip)</button>
      </div>

      <div className="card">
        <h2>Importar desde Excel</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>
          Sube un .xlsx con una columna <b>Fecha</b> y una columna por especie
          (Conejo, Zorzal…). Opcionales: Km, Cartuchos, Notas y Periodo — si falta,
          el período se deduce de la fecha. Descarga la plantilla para verlo.
        </p>
        <label className="btn secundario" style={{ textAlign: 'center', cursor: 'pointer' }}>
          Importar Excel (.xlsx)
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={importarExcel}
            style={{ display: 'none' }}
          />
        </label>
        <button className="btn secundario" onClick={descargarPlantilla}>Descargar plantilla Excel</button>
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

      <EditorVedas />

      <div className="card">
        <h2>Zona de peligro</h2>
        <button className="btn peligro" onClick={borrarTodo}>Borrar todos los datos</button>
      </div>

      {msg && <div className="aviso">{msg}</div>}
    </div>
  )
}

function EditorVedas() {
  const guardadas = useLiveQuery(async () => (await cargarVedas()) ?? VEDAS_DEFECTO, [])
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const vedas = form ?? guardadas

  if (!vedas) return null
  const aTexto = ddmm => String(ddmm).replace('-', '/') // DD-MM → DD/MM
  const valida = t => /^([0-2]?\d|3[01])\/(0?\d|1[0-2])$/.test(t.trim())

  function cambia(period, campo, valor) {
    setForm({ ...vedas, [period]: { ...vedas[period], [campo]: valor } })
    setMsg('')
  }

  async function guardar() {
    const limpio = {}
    for (const [p, v] of Object.entries(vedas)) {
      const ini = String(v.ini).includes('/') ? v.ini : aTexto(v.ini)
      const fin = String(v.fin).includes('/') ? v.fin : aTexto(v.fin)
      if (!valida(ini) || !valida(fin)) {
        setMsg(`⚠ Fecha no válida en ${PERIODOS[p].label} (usa día/mes, p. ej. 12/10)`)
        return
      }
      const norm = t => t.trim().split('/').map(x => x.padStart(2, '0')).join('-')
      limpio[p] = { ini: norm(ini), fin: norm(fin) }
    }
    await guardarVedas(limpio)
    setForm(null)
    setMsg('✓ Fechas de veda guardadas')
  }

  const valorDe = v => (String(v).includes('/') ? v : aTexto(v))

  return (
    <div className="card">
      <h2>Fechas de veda (día/mes)</h2>
      {Object.entries(vedas).map(([p, v]) => (
        <div key={p} className="form-row" style={{ alignItems: 'center' }}>
          <span style={{ width: 108, fontSize: 13, fontWeight: 600 }}>{PERIODOS[p].label}</span>
          <label>
            Abre
            <input type="text" inputMode="numeric" placeholder="dd/mm" value={valorDe(v.ini)}
              onChange={e => cambia(p, 'ini', e.target.value)} />
          </label>
          <label>
            Cierra
            <input type="text" inputMode="numeric" placeholder="dd/mm" value={valorDe(v.fin)}
              onChange={e => cambia(p, 'fin', e.target.value)} />
          </label>
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 10px' }}>
        Orientativas: ajústalas cada año a la resolución de vedas de tu comunidad.
        Se usan para la cuenta atrás de la pantalla de Registro.
      </p>
      <button className="btn secundario" onClick={guardar}>Guardar fechas de veda</button>
      {msg && <div className="aviso" style={{ marginTop: 10 }}>{msg}</div>}
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
