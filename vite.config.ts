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
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'assets/luts/manifest.json', 'assets/light_leaks/manifest.json'],
      manifest: {
        id: './',
        name: '胶片模拟 · Film Simulation',
        short_name: '胶片模拟',
        description: '照片只在浏览器本地处理的胶片模拟工具 · Local film simulation',
        lang: 'zh-CN',
        theme_color: '#12100e',
        background_color: '#12100e',
        display: 'standalone',
        start_url: './',
        scope: './',
        orientation: 'any',
        categories: ['photo', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        globIgnores: ['**/assets/luts/*.deflate', '**/assets/light_leaks/*.webp'],
        runtimeCaching: [{
          urlPattern: ({ url }) => isEffectAssetUrl(url),
          handler: 'CacheFirst',
          options: {
            cacheName: EFFECT_CACHE_NAME,
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 64, maxAgeSeconds: 31536000 },
          },
        }],
      },
    }),
  ],
  build: { target: 'safari15' },
})
