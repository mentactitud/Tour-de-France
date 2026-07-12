import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Tour-de-France/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
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
        name: 'Caza — Borges Blanques',
        short_name: 'Caza',
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
