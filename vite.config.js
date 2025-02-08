// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' 
    ? (process.env.GITEE ? '/kitten-game-gitee/' : '/page-test/')  // GitHub vs Gitee
    : './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/index.html'
    }
  },
  server: {
    open: true,
    host: '0.0.0.0'
  },
  root: 'src',
  publicDir: '../public'
}));