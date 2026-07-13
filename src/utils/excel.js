// Importación y plantilla de Excel (.xlsx). SheetJS se carga bajo demanda
// para no engordar el paquete principal.
import { ESPECIES, PERIODOS, periodoPorFecha, temporadaPara } from '../data/especies.js'

const norm = s =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

const ESPECIE_POR_NOMBRE = new Map(ESPECIES.map(sp => [norm(sp), sp]))
ESPECIE_POR_NOMBRE.set('conejos', 'Conejo') // como en el Excel original

const PERIODO_POR_NOMBRE = new Map(
  Object.entries(PERIODOS).map(([id, p]) => [norm(p.label), id])
)

function parseFecha(v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    let y = parseInt(m[3], 10)
    if (y < 100) y += 2000
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  return null
}

// Lee un .xlsx: en cada hoja busca la fila de cabecera (contiene «Fecha»),
// asigna columnas de especies por nombre y crea una jornada por fila.
export async function leerExcel(file) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const jornadas = []
  const avisos = []

  for (const nombre of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null })
    const iCab = filas.findIndex(f => f?.some(c => norm(c) === 'fecha'))
    if (iCab === -1) {
      avisos.push(`Hoja «${nombre}»: sin columna "Fecha", ignorada`)
      continue
    }
    const cab = filas[iCab].map(norm)
    const col = {
      fecha: cab.indexOf('fecha'),
      km: cab.findIndex(c => c === 'km' || c.startsWith('km ')),
      cartuchos: cab.findIndex(c => c === 'cartuchos' || c.startsWith('cartucho')),
      notas: cab.indexOf('notas'),
      periodo: cab.findIndex(c => c === 'periodo'),
      especies: []
    }
    cab.forEach((c, i) => {
      const sp = ESPECIE_POR_NOMBRE.get(c)
      if (sp) col.especies.push([i, sp])
    })
    if (!col.especies.length) {
      avisos.push(`Hoja «${nombre}»: sin columnas de especies, ignorada`)
      continue
    }

    for (const fila of filas.slice(iCab + 1)) {
      if (!fila || fila.every(c => c === null || c === '')) continue
      const bruto = fila[col.fecha]
      if (norm(bruto) === 'total') continue
      const date = parseFecha(bruto)
      if (!date) {
        if (bruto !== null && bruto !== '') avisos.push(`Hoja «${nombre}»: fecha no reconocida «${bruto}», fila saltada`)
        continue
      }
      const counts = {}
      for (const [i, sp] of col.especies) {
        const n = parseInt(parseFloat(fila[i]), 10)
        if (n > 0) counts[sp] = n
      }
      const period =
        (col.periodo >= 0 && PERIODO_POR_NOMBRE.get(norm(fila[col.periodo]))) ||
        periodoPorFecha(date)
      const kmV = col.km >= 0 ? parseFloat(fila[col.km]) : NaN
      const cartV = col.cartuchos >= 0 ? parseInt(parseFloat(fila[col.cartuchos]), 10) : NaN
      jornadas.push({
        date,
        period,
        season: temporadaPara(date, period),
        counts,
        km: Number.isFinite(kmV) ? kmV : null,
        cartuchos: Number.isFinite(cartV) ? cartV : null,
        notes: col.notas >= 0 ? String(fila[col.notas] ?? '').trim() : '',
        source: 'excel-import'
      })
    }
  }
  if (!jornadas.length) throw new Error('No se encontró ninguna jornada en el Excel. ' + (avisos[0] || ''))
  jornadas.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { jornadas, avisos }
}

export async function descargarPlantilla() {
  const XLSX = await import('xlsx')
  const hoja = XLSX.utils.aoa_to_sheet([
    ['Fecha', ...ESPECIES, 'Km', 'Cartuchos', 'Notas', 'Periodo'],
    ['12/10/2025', 2, '', 1, '', '', '', '', '', '', '', '', '', 7.5, 8, 'Mañana de niebla', 'Veda General'],
    ['21/08/2025', '', '', 5, '', '', '', '', '', '', '', '', '', '', 12, '', 'Media Veda']
  ])
  hoja['!cols'] = [{ wch: 12 }, ...ESPECIES.map(() => ({ wch: 9 })), { wch: 6 }, { wch: 10 }, { wch: 24 }, { wch: 13 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, hoja, 'Jornadas')
  XLSX.writeFile(wb, 'plantilla-cuaderno-caza.xlsx')
}
