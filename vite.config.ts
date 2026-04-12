import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    vue(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Manual chunk splitting for better caching and parallel loading
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vue core - rarely changes, cacheable
          if (id.includes('vue/dist/vue.runtime.esm-bundler')) {
            return 'vue-runtime'
          }
          // Naive UI - large, separate for caching
          if (id.includes('naive-ui') || id.includes('naive')) {
            return 'naive-ui'
          }
          // Pinia state management
          if (id.includes('pinia')) {
            return 'pinia'
          }
          // VueUse utilities
          if (id.includes('@vueuse/core')) {
            return 'vueuse'
          }
          // Editor store - app-specific, changes frequently
          if (id.includes('/stores/editor') || id.includes('/stores/editor.ts')) {
            return 'editor'
          }
          // Canvas components
          if (id.includes('/components/canvas')) {
            return 'canvas'
          }
        },
      },
    },
  },
})
