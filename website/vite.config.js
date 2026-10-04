import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than the site, so they get their own
        // long-lived files and download in parallel.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@phosphor-icons')) return 'icons'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('@supabase')) return 'supabase'
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          return undefined
        }
      }
    }
  }
})
