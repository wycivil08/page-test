// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // Ensures correct paths for GitHub Pages
  build: {
    outDir: 'dist',  // Output to 'dist/' folder
    rollupOptions: {
      input: 'src/index.html'  // Ensures correct entry point
    }
  },
  server: {
    open: true,
    host: '0.0.0.0'
  },
  root: 'src',  // Set 'src/' as the root for local development
  publicDir: '../public'  // Serve public assets correctly
});