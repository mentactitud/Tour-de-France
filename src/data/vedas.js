// Fechas de apertura y cierre de cada período (día-mes, se repiten cada año).
// Son orientativas y editables en Ajustes: la resolución de vedas cambia cada año.
export const VEDAS_DEFECTO = {
  descaste: { ini: '01-04', fin: '15-08' },
  media_veda: { ini: '21-08', fin: '21-09' },
  veda_general: { ini: '12-10', fin: '08-02' }
}

// Fecha concreta más próxima (hoy o futura) para un 'DD-MM'
function proximaFecha(ddmm, desde) {
  const [d, m] = ddmm.split('-').map(Number)
  let f = new Date(desde.getFullYear(), m - 1, d, 12)
  if (f < desde) f = new Date(desde.getFullYear() + 1, m - 1, d, 12)
  return f
}

function dentro(ddmmIni, ddmmFin, hoy) {
  const [di, mi] = ddmmIni.split('-').map(Number)
  const [df, mf] = ddmmFin.split('-').map(Number)
  const n = (hoy.getMonth() + 1) * 100 + hoy.getDate()
  const a = mi * 100 + di
  const b = mf * 100 + df
  // el período puede cruzar el fin de año (veda general: oct → feb)
  return a <= b ? n >= a && n <= b : n >= a || n <= b
}

// Estado de las vedas hoy: períodos abiertos (con su cierre) y próxima apertura
export function estadoVedas(vedas, hoy = new Date()) {
  const abiertos = []
  const proximos = []
  for (const [period, v] of Object.entries(vedas)) {
    if (!v?.ini || !v?.fin) continue
    if (dentro(v.ini, v.fin, hoy)) {
      const cierra = proximaFecha(v.fin, hoy)
      abiertos.push({ period, fecha: cierra, dias: Math.round((cierra - hoy) / 86400000) })
    } else {
      const abre = proximaFecha(v.ini, hoy)
      proximos.push({ period, fecha: abre, dias: Math.round((abre - hoy) / 86400000) })
    }
  }
  proximos.sort((a, b) => a.dias - b.dias)
  return { abiertos, proximos }
}
