import { defineConfig } from 'vite';

export default defineConfig({
  base: '/horologium/',
  build: {
    outDir: 'dist/app',
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
