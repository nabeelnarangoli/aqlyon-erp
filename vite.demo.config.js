// Builds a self-contained single-file demo (sample data in the browser, no backend).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'

const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(`public/${f}`).toString('base64')
const inlineLogos = () => ({
  name: 'inline-logos',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.(jsx?|css)$/.test(id) || id.includes('node_modules')) return
    if (!code.includes('/logo-')) return
    return code.replaceAll('/logo-full.png', uri('logo-full.png')).replaceAll('/logo-mark.png', uri('logo-mark.png'))
  }
})

export default defineConfig({
  plugins: [inlineLogos(), react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  publicDir: false,
  build: { outDir: 'dist-demo', chunkSizeWarningLimit: 5000 }
})
