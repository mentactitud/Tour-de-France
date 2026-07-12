import Dexie from 'dexie'
import historico from './data/historico.json'

export const db = new Dexie('cazaTracker')

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

// Carga el histórico del Excel una sola vez, en el primer arranque
export async function seedIfEmpty() {
  const seeded = localStorage.getItem('caza.seeded')
  if (seeded) return false
  const count = await db.jornadas.count()
  if (count === 0) {
    await db.jornadas.bulkAdd(historico)
  }
  localStorage.setItem('caza.seeded', '1')
  return count === 0
}

export async function reimportHistorico() {
  const existing = await db.jornadas.where('date').anyOf(historico.map(j => j.date)).toArray()
  const have = new Set(existing.filter(j => j.source === 'excel').map(j => j.date + '|' + j.period))
  const missing = historico.filter(j => !have.has(j.date + '|' + j.period))
  if (missing.length) await db.jornadas.bulkAdd(missing)
  return missing.length
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
