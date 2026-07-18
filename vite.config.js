import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any GitHub Pages project path
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  build: {
    outDir: 'dist',
  },
});
