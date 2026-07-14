import Dexie from 'dexie'
import { COMPARTIR } from './variante.js'

// La variante "compartir" usa su propia BD para no mezclarse con la
// personal si ambas se abren en el mismo móvil (mismo origen).
export const db = new Dexie(COMPARTIR ? 'cazaCompartir' : 'cazaTracker')

db.version(1).stores({
  jornadas: '++id, date, season, period'
})

// v2: fotos vinculadas a jornadas y mapa del coto importado del KML.
// Las jornadas ganan campos opcionales: track [[lat,lng],…], duracion (min)
// y lances [{sp,lat,lng,ts}] — no requieren migración de datos.
db.version(2).stores({
  jornadas: '++id, date, season, period',
  fotos: '++id, jornadaId',
  mapa: 'id'
})

// v3: control de gastos {fecha, categoria, concepto, importe}
db.version(3).stores({
  jornadas: '++id, date, season, period',
  fotos: '++id, jornadaId',
  mapa: 'id',
  gastos: '++id, fecha, categoria'
})

// Carga el histórico del Excel una sola vez, en el primer arranque.
// La condición inline sobre import.meta.env se pliega en la compilación:
// en la variante compartir el histórico personal NO viaja en el paquete.
export async function seedIfEmpty() {
  if (import.meta.env.VITE_VARIANTE !== 'compartir') {
    const seeded = localStorage.getItem('caza.seeded')
    if (seeded) return false
    const count = await db.jornadas.count()
    if (count === 0) {
      const { default: historico } = await import('./data/historico.json')
      await db.jornadas.bulkAdd(historico)
    }
    localStorage.setItem('caza.seeded', '1')
    return count === 0
  }
  return false
}

export async function reimportHistorico() {
  if (import.meta.env.VITE_VARIANTE !== 'compartir') {
    const { default: historico } = await import('./data/historico.json')
    const existing = await db.jornadas.where('date').anyOf(historico.map(j => j.date)).toArray()
    const have = new Set(existing.filter(j => j.source === 'excel').map(j => j.date + '|' + j.period))
    const missing = historico.filter(j => !have.has(j.date + '|' + j.period))
    if (missing.length) await db.jornadas.bulkAdd(missing)
    return missing.length
  }
  return 0
}

export function totalPiezas(j) {
  return Object.values(j.counts || {}).reduce((a, b) => a + b, 0)
}

export async function guardarMapa(mapa) {
  await db.mapa.put({ id: 'coto', ...mapa, importedAt: Date.now() })
}

export function cargarMapa() {
  return db.mapa.get('coto')
}
