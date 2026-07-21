import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/qr-code-scanner/',
  plugins: [
    VitePWA({
      manifest: {
        name: 'QR Code Scanner',
        short_name: 'QR Scanner',
        description: 'Scan QR codes with your device camera',
        display: 'standalone',
        scope: '/qr-code-scanner/',
        start_url: '/qr-code-scanner/',
        theme_color: '#863bff',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      registerType: 'autoUpdate',
    }),
  ],
})
