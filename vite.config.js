import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' 
    ? (process.env.CF_PAGES ? '/' : '/page-test/')  // Cloudflare Pages ('/') vs GitHub Pages ('/page-test/')
    : './',  // Local deployment
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