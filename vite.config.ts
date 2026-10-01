import { realpathSync } from 'node:fs'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// node_modules may be a symlink to a shared install outside the project (several working copies share one);
// let the dev server read files from there too, or KaTeX's fonts come back 403.
function sharedModules() {
  try {
    return [realpathSync('node_modules')]
  } catch {
    return []
  }
}

// base './' keeps every asset path relative, so the build runs from any folder,
// a static host, or inside a Capacitor Android shell.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Separate caches let several dev servers share one node_modules.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...sharedModules()] } },
})
