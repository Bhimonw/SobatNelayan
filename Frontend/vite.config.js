import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// Explicit Vite config: Vue plugin + explicit PostCSS plugin list to ensure
// the Tailwind PostCSS adapter is used during development.
export default ({ mode }) => {
  // load .env files for given mode
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(env.VITE_PORT) || 5173;
  const apiTarget = env.VITE_API_BASE || 'http://localhost:3000';

  return defineConfig({
    plugins: [vue()],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      }
    },
  })
}
