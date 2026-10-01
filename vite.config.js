import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/* The SkillBridge service routes. They are proxied in development so the app can
   call same-origin paths with no base URL and no CORS preflight. The target comes
   from VITE_CAREER_BRIDGE_API, so no host is hardcoded here. */
const API_ROUTES = ['/roadmap', '/velocity', '/proofs', '/vendor-flags', '/health', '/curriculum-intelligence', '/curriculum-record', '/curriculum-coverage', '/curriculum-gaps', '/curriculum-recommendations']

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  /* The documented dev default. An explicit VITE_CAREER_BRIDGE_API always wins,
     so production and same-origin setups are unaffected. */
  const target = (env.VITE_CAREER_BRIDGE_API ?? 'http://127.0.0.1:8000').trim().replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: target
      ? {
          proxy: Object.fromEntries(
            API_ROUTES.map((route) => [route, { target, changeOrigin: true }]),
          ),
        }
      : undefined,
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            gsap: ['gsap', 'gsap/ScrollTrigger']
          }
        }
      }
    }
  }
})