import { db } from '../db.js'

const MAX_LADO = 1600
const CALIDAD = 0.85

// Redimensiona una imagen a JPEG ≤1600px para no agotar el almacenamiento
export async function comprimirFoto(file) {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * escala)
  const h = Math.round(bmp.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', CALIDAD))
  if (!blob) throw new Error('No se pudo procesar la foto')
  return blob
}

export async function guardarFotos(jornadaId, blobs) {
  await db.fotos.bulkAdd(blobs.map(blob => ({ jornadaId, blob, ts: Date.now() })))
}

export function archivoDeFoto(foto, fecha, i) {
  return new File([foto.blob], `caza-${fecha}-${i + 1}.jpg`, { type: 'image/jpeg' })
}

// Hoja de compartir de Android (permite mandar a Drive). Fallback: descarga.
export async function compartirFotos(fotos, fecha) {
  const files = fotos.map((f, i) => archivoDeFoto(f, fecha, i))
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: `Caza ${fecha}` })
      return true
    } catch (e) {
      if (e.name === 'AbortError') return true // el usuario cerró la hoja
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }
  return false
}
