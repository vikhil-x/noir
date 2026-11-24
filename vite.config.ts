import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', '@ghostery/adblocker-electron']
            }
          }
        }
      }
    ]),
    {
      name: 'copy-preload-cjs',
      closeBundle() {
        if (!fs.existsSync('dist-electron')) {
          fs.mkdirSync('dist-electron', { recursive: true })
        }
        fs.copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs')
      }
    },
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
})
