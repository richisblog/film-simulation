import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { EFFECT_CACHE_NAME, isEffectAssetUrl } from './src/config/pwaCache'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'assets/luts/manifest.json', 'assets/light_leaks/manifest.json', 'assets/dazz/luts/manifest-v1.json', 'assets/dazz/light_leaks/manifest-v1.json', 'assets/dazz/textures/manifest-v1.json'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        globIgnores: ['**/assets/luts/*.deflate', '**/assets/light_leaks/*.webp', '**/assets/dazz/luts/**/*.deflate', '**/assets/dazz/light_leaks/**/*.webp', '**/assets/dazz/textures/**/*.webp'],
        runtimeCaching: [{
          urlPattern: ({ url }) => isEffectAssetUrl(url),
          handler: 'CacheFirst',
          options: {
            cacheName: EFFECT_CACHE_NAME,
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 180, maxAgeSeconds: 31536000 },
          },
        }],
      },
    }),
  ],
  build: { target: 'safari15' },
})
