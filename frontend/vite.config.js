import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // This line tells Vite where to find the .env file.
  // '..' means look in the parent directory (the root of your project).
  envDir: '..',
  build: {
    // This ensures modern JavaScript features like 'import.meta' are supported.
    target: 'esnext'
  },
  server: {
    // This sets the default development server port to 5173
    port: 5173
  }
})
