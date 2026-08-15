// Sesión GPS de jornada: singleton persistido en localStorage para
// sobrevivir a recargas de la app en el campo.
import { haversineKm } from './utils/geo.js'
import { COMPARTIR } from './variante.js'

const KEY = COMPARTIR ? 'caza.gps.compartir' : 'caza.gps'
// Precisión aceptada: en el campo un móvil rara vez baja de 20-30 m, y bajo
// arbolado puede irse a 50-100. Se empieza exigente y se relaja si llevamos
// mucho rato sin ningún punto válido — mejor un track con algo de ruido que
// ninguno.
const ACC_BASE = 50
const ACC_RELAJADA = 100
const ESPERA_RELAJAR = 90000 // 1,5 min sin punto aceptado
const MIN_DIST_KM = 0.005 // 5 m entre puntos
const ESCRITURA_MS = 5000

let sesion = cargar()
let watchId = null
let wakeLock = null
const subs = new Set()

function cargar() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}

let ultimaEscritura = 0
function persistir(force = false) {
  const ahora = Date.now()
  if (force || ahora - ultimaEscritura > ESCRITURA_MS) {
    localStorage.setItem(KEY, JSON.stringify(sesion))
    ultimaEscritura = ahora
  }
}

function avisar() {
  // copia superficial para que React detecte el cambio
  const snap = sesion ? { ...sesion } : null
  for (const cb of subs) cb(snap)
}

// Si tras un rato no ha entrado ningún punto (arbolado, barrancos, móvil en
// el bolsillo), se relaja el límite para el resto de la jornada: un track con
// ruido vale más que ninguno.
function limiteAccuracy() {
  if (sesion.limite === ACC_RELAJADA) return ACC_RELAJADA
  const desde = sesion.fixTs || sesion.startTs
  if (Date.now() - desde > ESPERA_RELAJAR) {
    sesion.limite = ACC_RELAJADA
    return ACC_RELAJADA
  }
  return ACC_BASE
}

function onPos(pos) {
  if (!sesion) return
  const { latitude, longitude, accuracy } = pos.coords
  sesion.err = null
  sesion.acc = Math.round(accuracy)
  if (accuracy > limiteAccuracy()) {
    sesion.rechazados = (sesion.rechazados || 0) + 1
    persistir()
    avisar()
    return
  }
  const p = [
    Math.round(latitude * 1e6) / 1e6,
    Math.round(longitude * 1e6) / 1e6
  ]
  const last = sesion.points[sesion.points.length - 1]
  sesion.pos = p
  sesion.fixTs = Date.now()
  if (last) {
    const d = haversineKm(last, p)
    if (d < MIN_DIST_KM) { persistir(); avisar(); return }
    sesion.km += d
  }
  sesion.points.push(p)
  persistir()
  avisar()

  // Transmitir posición GPS en tiempo real a Firestore si el cazador ha iniciado sesión
  try {
    import('./firebase.js').then(({ auth, dbFirestore, doc, setDoc }) => {
      const user = auth.currentUser
      if (user) {
        const hunterRef = doc(dbFirestore, 'liveHunters', user.uid)
        setDoc(hunterRef, {
          uid: user.uid,
          name: user.displayName || user.email || 'Cazador',
          lat: p[0],
          lng: p[1],
          updatedAt: Date.now()
        }, { merge: true }).catch(() => {})
      }
    }).catch(() => {})
  } catch {}
}

// Los errores del GPS ya no se tragan: se muestran en la tarjeta de la jornada
function onErr(e) {
  if (!sesion) return
  sesion.err = { code: e.code, ts: Date.now() }
  persistir(true)
  avisar()
}

async function pedirWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen')
  } catch {
    wakeLock = null
  }
}

function arrancarWatch() {
  if (!('geolocation' in navigator)) {
    if (sesion) { sesion.err = { code: 2, ts: Date.now() }; avisar() }
    return
  }
  watchId = navigator.geolocation.watchPosition(onPos, onErr, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 30000
  })
  pedirWakeLock()
}

// reengancha el wake lock al volver a la app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sesion) pedirWakeLock()
})

// si Android mata la app en segundo plano, que no se pierda lo andado
window.addEventListener('pagehide', () => { if (sesion) persistir(true) })

// si había una sesión activa al cargar la app, reanuda el GPS
if (sesion) arrancarWatch()

export const gps = {
  activa: () => sesion,

  subscribe(cb) {
    subs.add(cb)
    cb(sesion ? { ...sesion } : null)
    return () => subs.delete(cb)
  },

  iniciar() {
    if (sesion) return sesion
    sesion = {
      startTs: Date.now(),
      points: [],
      km: 0,
      lances: [],
      pos: null,
      fixTs: null,
      acc: null,
      rechazados: 0,
      limite: ACC_BASE,
      err: null
    }
    persistir(true)
    arrancarWatch()
    avisar()
    return sesion
  },

  lance(sp) {
    if (!sesion) return
    const pos = sesion.pos || sesion.points[sesion.points.length - 1]
    sesion.lances.push({
      sp,
      ts: Date.now(),
      lat: pos?.[0] ?? null,
      lng: pos?.[1] ?? null
    })
    persistir(true)
  },

  quitarLance(sp) {
    if (!sesion) return
    for (let i = sesion.lances.length - 1; i >= 0; i--) {
      if (sesion.lances[i].sp === sp) {
        sesion.lances.splice(i, 1)
        break
      }
    }
    persistir(true)
  },

  // Detiene el GPS y devuelve el resumen para adjuntar a la jornada
  terminar() {
    if (!sesion) return null
    const res = {
      km: Math.round(sesion.km * 10) / 10,
      duracion: Math.round((Date.now() - sesion.startTs) / 60000),
      track: sesion.points,
      lances: sesion.lances,
      // para explicar al usuario por qué no hay km, si es el caso
      puntos: sesion.points.length,
      err: sesion.err
    }
    this.descartar()
    return res
  },

  descartar() {
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId)
    watchId = null
    wakeLock?.release?.()
    wakeLock = null
    sesion = null
    localStorage.removeItem(KEY)
    avisar()
  }
}

// Texto de estado del GPS para la interfaz
export function estadoGps(s) {
  if (!s) return null
  const n = s.points.length
  if (s.err?.code === 1) return { nivel: 'error', texto: '⚠ Permiso de ubicación denegado — actívalo para el móvil y para la app' }
  // Un "posición no disponible" puntual es normal; solo alarma si aún no hay track
  if (s.err?.code === 2 && n === 0) return { nivel: 'error', texto: '⚠ GPS no disponible ahora mismo' }
  if (!s.fixTs) {
    return {
      nivel: 'buscando',
      texto: s.rechazados > 0
        ? `Buscando señal… (precisión ${s.acc} m, aún insuficiente)`
        : 'Buscando señal GPS…'
    }
  }
  const desde = Math.round((Date.now() - s.fixTs) / 60000)
  if (desde >= 2) {
    return { nivel: 'aviso', texto: `⚠ Sin señal desde hace ${desde} min · ${n} puntos — ¿pantalla apagada?` }
  }
  return { nivel: 'ok', texto: `GPS activo · ±${s.acc} m · ${n} puntos` }
}
