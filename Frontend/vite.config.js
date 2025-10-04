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
  // VITE_API_BASE is used by the frontend code (axios base). It may be a relative path like '/api'.
  // For the dev server proxy target we prefer an explicit VITE_PROXY_TARGET.
  // If VITE_PROXY_TARGET is not provided, and VITE_API_BASE is an absolute URL, use it; otherwise fallback to ENV_DEV_BACKEND or final 'http://127.0.0.1:3000'.
  const rawApiBase = env.VITE_API_BASE;
  const proxyTarget = env.VITE_PROXY_TARGET
    || ((rawApiBase && rawApiBase.match(/^https?:\/\//)) ? rawApiBase : (env.ENV_DEV_BACKEND || 'http://127.0.0.1:3000'));

  return defineConfig({
    plugins: [vue()],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      }
    },
  })
}
