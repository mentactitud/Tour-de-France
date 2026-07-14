// Resumen de jornada para compartir (WhatsApp, etc.)
import { PERIODOS } from '../data/especies.js'
import { totalPiezas } from '../db.js'
import { textoMeteo } from './meteo.js'
import { archivoDeFoto } from './fotos.js'

function fmtDuracion(min) {
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`
}

export function textoResumen(j, lugar) {
  const fecha = new Date(j.date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const total = totalPiezas(j)
  const lineas = [`🐇 *Jornada de caza* — ${fecha}`]
  lineas.push(`📍 ${lugar ? lugar + ' · ' : ''}${PERIODOS[j.period].label} ${j.season}`)
  if (total > 0) {
    const detalle = Object.entries(j.counts).map(([sp, n]) => `${n} ${sp}`).join(' · ')
    lineas.push(`🎯 ${total} ${total === 1 ? 'pieza' : 'piezas'}: ${detalle}`)
  } else {
    lineas.push('🎯 Sin piezas (día de paseo)')
  }
  const anda = []
  if (j.km) anda.push(`${j.km} km`)
  if (j.duracion) anda.push(fmtDuracion(j.duracion))
  if (anda.length) lineas.push(`👣 ${anda.join(' · ')}`)
  if (j.cartuchos) {
    const punteria = total > 0 ? ` (${(j.cartuchos / total).toFixed(1)} por pieza)` : ''
    lineas.push(`🔫 ${j.cartuchos} cartuchos${punteria}`)
  }
  const meteo = textoMeteo(j.meteo)
  if (meteo) lineas.push(meteo)
  if (j.notes) lineas.push(`📝 ${j.notes}`)
  return lineas.join('\n')
}

// Comparte texto (+fotos si el navegador lo permite); fallback a wa.me
export async function compartirResumen(j, fotos = [], lugar = '') {
  const text = textoResumen(j, lugar)
  const files = fotos.map((f, i) => archivoDeFoto(f, j.date, i))
  try {
    if (files.length && navigator.canShare?.({ files, text })) {
      await navigator.share({ files, text, title: 'Jornada de caza' })
      return true
    }
    if (navigator.share) {
      await navigator.share({ text, title: 'Jornada de caza' })
      return true
    }
  } catch (e) {
    if (e.name === 'AbortError') return true // el usuario cerró la hoja
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  return true
}
