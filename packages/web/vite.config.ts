import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@react-pdf/renderer',
      'pako',
      'restructure',
      'svg-arc-to-cubic-bezier',
      'base64-js',
      'unicode-trie',
      'unicode-properties',
      'dfa',
      'tiny-inflate',
      'brotli',
      'clone',
      'bidi-js',
      'yoga-layout',
      'abs-svg-path',
      'normalize-svg-path',
      'parse-svg-path',
      'queue',
      'browserify-zlib',
      'inherits',
      'safe-buffer',
      'string_decoder',
      'crypto-js',
      'fast-deep-equal',
      'is-url',
      'emoji-regex',
      'events',
      'media-engine',
      'postcss-value-parser',
      'color-string',
      'hsl-to-hex',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lms/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
