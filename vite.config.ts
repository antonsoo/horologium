import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './vite.csp.ts';

export default defineConfig({
  base: '/horologium/',
  plugins: [contentSecurityPolicy()],
  build: {
    outDir: 'dist/app',
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
