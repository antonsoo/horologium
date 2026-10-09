import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './vite.csp.ts';

export default defineConfig({
  base: '/horologium/',
  plugins: [
    contentSecurityPolicy(),
    {
      name: 'third-party-notices',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'THIRD_PARTY_NOTICES.txt',
          source: readFileSync(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'),
        });
      },
    },
  ],
  build: {
    outDir: 'dist/app',
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
