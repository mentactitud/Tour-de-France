import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const compartir = process.env.VITE_VARIANTE === 'compartir'

export default defineConfig({
  // OJO: debe coincidir con el nombre del repositorio en GitHub.
  // Si el repo se renombra a hunting-tracker-app, cambiar aquí las dos rutas.
  base: compartir ? '/Tour-de-France/compartir/' : '/Tour-de-France/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // la variante /compartir/ tiene su propio service worker: el SW
        // principal no debe responder a sus navegaciones
        navigateFallbackDenylist: [/\/compartir\//],
        // teselas del mapa en caché: las zonas ya vistas funcionan sin cobertura
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(www\.ign\.es|tile\.openstreetmap\.org)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'teselas-mapa',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: compartir ? 'Cuaderno de Caza' : 'Caza — Borges Blanques',
        short_name: compartir ? 'Cuaderno' : 'Caza',
        description: 'Seguimiento y control de jornadas de caza',
        lang: 'es',
        theme_color: '#22402a',
        background_color: '#f9f9f7',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
