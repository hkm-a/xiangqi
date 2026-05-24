import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
})
