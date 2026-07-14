// Catálogo cerrado de especies y a qué período pertenecen
export const ESPECIES = [
  'Conejo',
  'Perdiz',
  'Torcaz',
  'Zorzal',
  'Liebre',
  'Perdiz suelta',
  'Becada',
  'Pato',
  'Griva',
  'Faisán',
  'Zurita',
  'Codorniz'
]

export const PERIODOS = {
  descaste: { label: 'Descaste', especies: ['Conejo'] },
  media_veda: { label: 'Media Veda', especies: ['Conejo', 'Torcaz', 'Zurita', 'Codorniz'] },
  veda_general: {
    label: 'Veda General',
    especies: [
      'Conejo', 'Perdiz', 'Torcaz', 'Zorzal', 'Liebre',
      'Perdiz suelta', 'Becada', 'Pato', 'Griva', 'Faisán', 'Zurita'
    ]
  }
}

// Sugerencia de período según el mes de la fecha
export function periodoPorFecha(dateStr) {
  const m = new Date(dateStr + 'T12:00:00').getMonth() + 1
  if (m >= 4 && m <= 7) return 'descaste'
  if (m === 8 || m === 9) return 'media_veda'
  return 'veda_general'
}

// Etiqueta de temporada: descaste/media veda → año; veda general → "2026-27".
// La Veda General de un año arranca en otoño: cualquier fecha de marzo en
// adelante pertenece a la temporada que empieza ese año; enero y febrero son
// la cola de la temporada que empezó el año anterior.
export function temporadaPara(dateStr, period) {
  const d = new Date(dateStr + 'T12:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (period !== 'veda_general') return String(y)
  if (m >= 3) return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`
}

// Año cinegético (1 mar – 28 feb): agrupa gastos y jornadas de una misma
// temporada de caza, que arranca con el descaste en primavera y termina
// con el cierre de la Veda General en febrero. "2026-27" = de marzo 2026
// a febrero 2027. Mismo corte que temporadaPara para la Veda General.
export function anoCinegetico(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const y = d.getFullYear()
  if (d.getMonth() + 1 >= 3) return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`
}

// Inicio nominal de cada período dentro de la temporada (para el eje del acumulado)
export function inicioTemporada(period, season) {
  if (period === 'veda_general') {
    const y = parseInt(season.slice(0, 4), 10)
    return new Date(y, 9, 1) // 1 de octubre
  }
  const y = parseInt(season, 10)
  if (period === 'media_veda') return new Date(y, 7, 15) // 15 de agosto
  return new Date(y, 3, 1) // descaste: 1 de abril
}

export function diaDeTemporada(dateStr, period, season) {
  const d = new Date(dateStr + 'T12:00:00')
  const start = inicioTemporada(period, season)
  return Math.round((d - start) / 86400000)
}
