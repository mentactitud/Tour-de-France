// Variante de compilación: la versión "compartir" sale sin el histórico
// personal, con base de datos propia y nombre genérico.
export const COMPARTIR = import.meta.env.VITE_VARIANTE === 'compartir'
export const TITULO = COMPARTIR ? 'Cuaderno de Caza' : 'Caza · Borges Blanques'
export const SUBTITULO = COMPARTIR ? 'mi coto' : 'coto de caza'
