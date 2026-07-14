// Fechas de apertura y cierre de cada período (día-mes). Editables en Ajustes:
// la resolución de vedas cambia cada año. Valores por defecto según la
// Resolució ARP/2305/2026 (Cataluña, temporada 2026-2027):
// - Caza menor general: 11 oct 2026 – 7 feb 2027 (zorzal hasta el 14 feb)
// - Media veda: solo los días 23 y 30 ago y 6 y 13 sep 2026
// - Conejo en Les Garrigues y comarcas vecinas: todo el año (1 abr – 14 ago sin perro)
export const VEDAS_DEFECTO = {
  descaste: { ini: '01-03', fin: '28-02' }, // todo el año
  media_veda: { ini: '23-08', fin: '13-09' },
  veda_general: { ini: '11-10', fin: '07-02' }
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

// ¿El período cubre el año entero? (el día antes de la apertura sigue "dentro")
function esTodoElAno(v) {
  const [d, m] = v.ini.split('-').map(Number)
  const antes = new Date(2026, m - 1, d - 1, 12)
  return dentro(v.ini, v.fin, antes)
}

// Estado de las vedas hoy: períodos abiertos (con su cierre) y próxima apertura
export function estadoVedas(vedas, hoy = new Date()) {
  const abiertos = []
  const proximos = []
  for (const [period, v] of Object.entries(vedas)) {
    if (!v?.ini || !v?.fin) continue
    if (esTodoElAno(v)) {
      abiertos.push({ period, todoElAno: true })
    } else if (dentro(v.ini, v.fin, hoy)) {
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
