/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine the base path for production
const isProd = process.env.NODE_ENV === 'production'
const defaultBase = isProd ? '/sketch2mermaid/' : '/'
const base = process.env.VITE_BASE_PATH || defaultBase

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base,
  test: {
    globals: true,
    environment: 'node',
  },
})
