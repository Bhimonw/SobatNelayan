import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// Explicit Vite config: Vue plugin + explicit PostCSS plugin list to ensure
// the Tailwind PostCSS adapter is used during development.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
})
