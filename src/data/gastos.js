// Categorías de gasto del cazador
export const CATEGORIAS = [
  { id: 'Munición', emoji: '🔫' },
  { id: 'Cuota del coto', emoji: '🌾' },
  { id: 'Licencias', emoji: '📄' },
  { id: 'Seguro', emoji: '🛡️' },
  { id: 'Equipo', emoji: '🎒' },
  { id: 'Perros', emoji: '🐕' },
  { id: 'Desplazamiento', emoji: '🚙' },
  { id: 'Otros', emoji: '📦' }
]

export const EMOJI_CATEGORIA = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.emoji]))

export const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2
})
