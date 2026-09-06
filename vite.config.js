import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('1.1.0'),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
