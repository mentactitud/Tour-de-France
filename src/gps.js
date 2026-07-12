// Sesión GPS de jornada: singleton persistido en localStorage para
// sobrevivir a recargas de la app en el campo.
import { haversineKm } from './utils/geo.js'
import { COMPARTIR } from './variante.js'

const KEY = COMPARTIR ? 'caza.gps.compartir' : 'caza.gps'
const MAX_ACCURACY_M = 35
const MIN_DIST_KM = 0.005 // 5 m entre puntos

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

let pendientes = 0
function persistir(force = false) {
  // no escribir en cada punto: cada 10 puntos o en eventos importantes
  pendientes++
  if (force || pendientes >= 10) {
    localStorage.setItem(KEY, JSON.stringify(sesion))
    pendientes = 0
  }
}

function avisar() {
  // copia superficial para que React detecte el cambio
  const snap = sesion ? { ...sesion } : null
  for (const cb of subs) cb(snap)
}

function onPos(pos) {
  if (!sesion) return
  const { latitude, longitude, accuracy } = pos.coords
  if (accuracy > MAX_ACCURACY_M) return
  const p = [
    Math.round(latitude * 1e6) / 1e6,
    Math.round(longitude * 1e6) / 1e6
  ]
  const last = sesion.points[sesion.points.length - 1]
  sesion.pos = p
  if (last) {
    const d = haversineKm(last, p)
    if (d < MIN_DIST_KM) { avisar(); return }
    sesion.km += d
  }
  sesion.points.push(p)
  persistir()
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
  if (!('geolocation' in navigator)) return
  watchId = navigator.geolocation.watchPosition(onPos, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 20000
  })
  pedirWakeLock()
}

// reengancha el wake lock al volver a la app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sesion) pedirWakeLock()
})

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
    sesion = { startTs: Date.now(), points: [], km: 0, lances: [], pos: null }
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
      lances: sesion.lances
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
