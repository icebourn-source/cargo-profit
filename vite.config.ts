import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' — чтобы приложение работало с любого подкаталога при статическом хостинге
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Карго Профит — учёт прибыли с посылок',
        short_name: 'Карго Профит',
        description: 'Учёт себестоимости и прибыли с поставок из Китая (CNY/USD/BYN)',
        theme_color: '#4f46e5',
        background_color: '#0f172a',
        display: 'standalone',
        lang: 'ru',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // офлайн: весь собранный приложение прекешируется сервис-воркером
      workbox: { clientsClaim: true, skipWaiting: true },
    }),
  ],
})
