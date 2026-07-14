import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { PERIODOS, periodoPorFecha, temporadaPara } from '../data/especies.js'
import { gps } from '../gps.js'
import { parseGPX } from '../utils/geo.js'
import { comprimirFoto, guardarFotos, compartirFotos } from '../utils/fotos.js'
import { centroDelMapa, meteoDeFecha } from '../utils/meteo.js'
import { compartirResumen } from '../utils/resumen.js'
import { cargarMapa } from '../db.js'
import Prevision from '../components/Prevision.jsx'
import HoyCoto from '../components/HoyCoto.jsx'

// Tras guardar, intenta anotar la meteo del día en la jornada (sin bloquear)
async function anotarMeteo(id, fecha) {
  try {
    const mapa = await cargarMapa()
    const coords = centroDelMapa(mapa)
    if (!coords) return
    const meteo = await meteoDeFecha(coords, fecha)
    await db.jornadas.update(id, { meteo })
  } catch { /* sin red o sin datos: la jornada queda sin meteo */ }
}

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDuracion(min) {
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

export default function Registro({ editId, onDone, onCancel }) {
  const [date, setDate] = useState(hoy())
  const [period, setPeriod] = useState(periodoPorFecha(hoy()))
  const [periodManual, setPeriodManual] = useState(false)
  const [counts, setCounts] = useState({})
  const [km, setKm] = useState('')
  const [cartuchos, setCartuchos] = useState('')
  const [notes, setNotes] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [sesion, setSesion] = useState(gps.activa())
  const [pendGps, setPendGps] = useState(null) // {km,duracion,track,lances} al terminar
  const [fotosNuevas, setFotosNuevas] = useState([]) // [{blob,url}]
  const [msgFoto, setMsgFoto] = useState('')
  const [, setTic] = useState(0)
  const jornadaRef = useRef(null)

  const fotosGuardadas = useLiveQuery(
    () => (editId ? db.fotos.where('jornadaId').equals(editId).toArray() : []),
    [editId]
  )
  const urlsGuardadas = useMemo(
    () => (fotosGuardadas || []).map(f => ({ ...f, url: URL.createObjectURL(f.blob) })),
    [fotosGuardadas]
  )
  useEffect(() => () => urlsGuardadas.forEach(f => URL.revokeObjectURL(f.url)), [urlsGuardadas])
  useEffect(() => () => fotosNuevas.forEach(f => URL.revokeObjectURL(f.url)), [fotosNuevas])

  useEffect(() => gps.subscribe(setSesion), [])

  // cronómetro en vivo mientras hay sesión GPS
  useEffect(() => {
    if (!sesion) return
    const t = setInterval(() => setTic(x => x + 1), 5000)
    return () => clearInterval(t)
  }, [sesion])

  useEffect(() => {
    if (!editId) return
    db.jornadas.get(editId).then(j => {
      if (!j) return
      jornadaRef.current = j
      setDate(j.date)
      setPeriod(j.period)
      setPeriodManual(true)
      setCounts(j.counts || {})
      setKm(j.km ?? '')
      setCartuchos(j.cartuchos ?? '')
      setNotes(j.notes || '')
    })
  }, [editId])

  function cambiaFecha(v) {
    setDate(v)
    if (!periodManual && v) setPeriod(periodoPorFecha(v))
  }

  function suma(sp, delta) {
    if (delta > 0) gps.lance(sp)
    else gps.quitarLance(sp)
    setCounts(c => {
      const n = Math.max(0, (c[sp] || 0) + delta)
      const next = { ...c }
      if (n === 0) delete next[sp]
      else next[sp] = n
      return next
    })
  }

  function terminarGps() {
    const res = gps.terminar()
    if (!res) return
    setPendGps(res)
    if (res.km > 0) setKm(String(res.km))
  }

  async function importarGPX(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const gpx = parseGPX(await file.text())
      setPendGps(p => ({ ...(p || {}), track: gpx.track, km: gpx.km, duracion: gpx.duracion }))
      setKm(String(gpx.km))
      if (gpx.fecha) cambiaFecha(gpx.fecha)
      const fechaTxt = gpx.fecha
        ? new Date(gpx.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : null
      setMsgFoto(
        `✓ Ruta del reloj: ${fechaTxt ? fechaTxt + ' · ' : ''}${gpx.km} km${gpx.duracion ? ' · ' + fmtDuracion(gpx.duracion) : ''}`
      )
    } catch (err) {
      setMsgFoto('⚠ ' + err.message)
    }
    e.target.value = ''
  }

  async function anadirFotos(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    try {
      const nuevas = []
      for (const f of files) {
        const blob = await comprimirFoto(f)
        nuevas.push({ blob, url: URL.createObjectURL(blob) })
      }
      setFotosNuevas(prev => [...prev, ...nuevas])
    } catch (err) {
      setMsgFoto('⚠ ' + err.message)
    }
  }

  async function borrarFotoGuardada(id) {
    if (confirm('¿Borrar esta foto?')) await db.fotos.delete(id)
  }

  async function compartir() {
    const todas = [...(fotosGuardadas || []), ...fotosNuevas.map(f => ({ blob: f.blob }))]
    if (!todas.length) return
    const ok = await compartirFotos(todas, date)
    if (!ok) setMsgFoto('Tu navegador no permite compartir: se han descargado las fotos.')
  }

  async function compartirJornada() {
    const j = jornadaRef.current
    if (!j) return
    const fotos = fotosGuardadas || []
    const mapa = await cargarMapa()
    await compartirResumen({ ...j, counts, km: km === '' ? null : parseFloat(km), cartuchos: cartuchos === '' ? null : parseInt(cartuchos, 10), notes }, fotos, mapa?.name || '')
  }

  async function guardar() {
    if (!date) return
    const prev = jornadaRef.current
    const jornada = {
      date,
      period,
      season: temporadaPara(date, period),
      counts,
      km: km === '' ? null : parseFloat(km),
      cartuchos: cartuchos === '' ? null : parseInt(cartuchos, 10),
      notes: notes.trim(),
      duracion: pendGps?.duracion ?? prev?.duracion ?? null,
      track: pendGps?.track ?? prev?.track ?? null,
      lances: pendGps?.lances ?? prev?.lances ?? null,
      source: prev?.source || 'app'
    }
    let id = editId
    if (editId) {
      await db.jornadas.update(editId, jornada)
    } else {
      id = await db.jornadas.add(jornada)
    }
    if (fotosNuevas.length) await guardarFotos(id, fotosNuevas.map(f => f.blob))
    // meteo del día en segundo plano (si se editó la fecha, se reanota)
    if (!jornadaRef.current?.meteo || jornadaRef.current.date !== date) anotarMeteo(id, date)
    setGuardado(true)
    setTimeout(() => onDone(), 350)
  }

  const especies = PERIODOS[period].especies
  const totalDia = Object.values(counts).reduce((a, b) => a + b, 0)
  const nCart = cartuchos === '' ? null : parseInt(cartuchos, 10)
  const minutos = sesion ? Math.round((Date.now() - sesion.startTs) / 60000) : 0
  const nFotos = (fotosGuardadas?.length || 0) + fotosNuevas.length

  return (
    <div>
      {!editId && <HoyCoto />}
      {!editId && <Prevision />}
      {!editId && (
        <div className={'card gps-card' + (sesion ? ' activa' : '')}>
          {!sesion ? (
            <>
              <button className="btn" onClick={() => gps.iniciar()}>▶ Iniciar jornada con GPS</button>
              <p className="gps-nota">
                Registra km y ruta automáticamente. La pantalla se mantiene encendida
                (con la pantalla apagada, Android pausa el GPS).
              </p>
              <label className="gpx-link">
                ⌚ ¿La grabaste con el reloj? Importar GPX
                <input type="file" accept=".gpx" onChange={importarGPX} style={{ display: 'none' }} />
              </label>
              <p className="gps-nota">
                En Zepp: entrenamiento → ⋯ → Exportar datos → GPX. Rellena fecha, km,
                duración y ruta de golpe.
              </p>
            </>
          ) : (
            <>
              <div className="gps-live">
                <span className="gps-punto" aria-hidden="true" />
                <b>Jornada en curso</b>
                <span>{fmtDuracion(minutos)}</span>
                <span>{(Math.round(sesion.km * 10) / 10).toFixed(1)} km</span>
              </div>
              <p className="gps-nota">
                Cada <b>+1</b> guarda también el punto del lance. Al terminar se
                rellenan los km y la duración.
              </p>
              <button className="btn" onClick={terminarGps}>◼ Terminar jornada</button>
              <button
                className="btn secundario"
                onClick={() => { if (confirm('¿Descartar el GPS de esta jornada?')) gps.descartar() }}
              >
                Descartar GPS
              </button>
            </>
          )}
        </div>
      )}

      {pendGps && (
        <div className="aviso">
          ✓ GPS registrado: {pendGps.km ?? '?'} km
          {pendGps.duracion ? ` en ${fmtDuracion(pendGps.duracion)}` : ''} — se guardará con la jornada.
        </div>
      )}

      <div className="card">
        <h2>{editId ? 'Editar jornada' : 'Nueva jornada'}</h2>
        <div className="form-row">
          <label>
            Fecha
            <input type="date" value={date} onChange={e => cambiaFecha(e.target.value)} />
          </label>
          <label>
            Km andados
            <input
              type="number" inputMode="decimal" min="0" step="0.1"
              placeholder="—" value={km} onChange={e => setKm(e.target.value)}
            />
          </label>
        </div>
        <div className="chips" role="radiogroup" aria-label="Período">
          {Object.entries(PERIODOS).map(([id, p]) => (
            <button
              key={id}
              className={'chip' + (period === id ? ' active' : '')}
              onClick={() => { setPeriod(id); setPeriodManual(true) }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Piezas · {temporadaPara(date, period)} {totalDia > 0 ? `· ${totalDia} en total` : ''}</h2>
        <div className="especie-grid">
          {especies.map(sp => (
            <div key={sp} className={'contador' + (counts[sp] ? ' con-piezas' : '')}>
              <button aria-label={`Quitar ${sp}`} onClick={() => suma(sp, -1)}>−</button>
              <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <div className="nombre">{sp}</div>
                <div className="valor">{counts[sp] || 0}</div>
              </div>
              <button className="mas" aria-label={`Añadir ${sp}`} onClick={() => suma(sp, 1)}>+</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Cartuchos gastados</h2>
        <div className="form-row" style={{ alignItems: 'center', marginBottom: 0 }}>
          <label style={{ maxWidth: 140 }}>
            Nº de cartuchos
            <input
              type="number" inputMode="numeric" min="0" step="1"
              placeholder="—" value={cartuchos} onChange={e => setCartuchos(e.target.value)}
            />
          </label>
          {nCart > 0 && totalDia > 0 && (
            <div className="punteria">
              <span className="valor">{(nCart / totalDia).toFixed(1)}</span>
              <span className="etq">cartuchos por pieza</span>
            </div>
          )}
          {nCart > 0 && totalDia === 0 && (
            <div className="punteria"><span className="etq">sin piezas todavía</span></div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Fotos {nFotos > 0 ? `(${nFotos})` : ''}</h2>
        <div className="fotos-grid">
          {urlsGuardadas.map(f => (
            <div key={f.id} className="foto-mini">
              <img src={f.url} alt="Foto de la jornada" loading="lazy" />
              <button aria-label="Borrar foto" onClick={() => borrarFotoGuardada(f.id)}>✕</button>
            </div>
          ))}
          {fotosNuevas.map((f, i) => (
            <div key={f.url} className="foto-mini">
              <img src={f.url} alt="Foto nueva" />
              <button
                aria-label="Quitar foto"
                onClick={() => setFotosNuevas(arr => arr.filter((_, x) => x !== i))}
              >✕</button>
            </div>
          ))}
          <label className="foto-add">
            📷
            <input type="file" accept="image/*" capture="environment" multiple onChange={anadirFotos} style={{ display: 'none' }} />
          </label>
        </div>
        {nFotos > 0 && (
          <button className="btn secundario" onClick={compartir}>
            Compartir fotos (Drive, WhatsApp…)
          </button>
        )}
      </div>

      <div className="card">
        <h2>Notas</h2>
        <textarea
          placeholder="Meteo, zona, compañeros, perros…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        {editId && (
          <label className="gpx-link">
            ⌚ Importar ruta GPX del reloj (Zepp, Wikiloc, Strava…)
            <input type="file" accept=".gpx" onChange={importarGPX} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {msgFoto && <div className="aviso">{msgFoto}</div>}

      <button className="btn" onClick={guardar} disabled={guardado}>
        {guardado ? '✓ Guardada' : editId ? 'Guardar cambios' : 'Guardar jornada'}
      </button>
      {editId && (
        <>
          <button className="btn secundario" onClick={compartirJornada}>
            📤 Compartir resumen (WhatsApp…)
          </button>
          <button className="btn secundario" onClick={() => { onCancel(); onDone() }}>
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}
