import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cambia esto si renombras el repositorio de GitHub
const REPO_NAME = 'control-gastos'

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
})
