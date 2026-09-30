import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps every asset path relative, so the build runs from any folder,
// a static host, or inside a Capacitor Android shell.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Separate caches let several dev servers share one node_modules.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
})
