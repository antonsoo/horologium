import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './vite.csp.ts';

const thirdPartyNotices = readFileSync(
  new URL('./THIRD_PARTY_NOTICES.md', import.meta.url),
  'utf8',
);

export default defineConfig({
  base: '/horologium/',
  plugins: [
    contentSecurityPolicy(),
    {
      name: 'third-party-notices',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] !== `${server.config.base}THIRD_PARTY_NOTICES.txt`)
            return next();
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(thirdPartyNotices);
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'THIRD_PARTY_NOTICES.txt',
          source: thirdPartyNotices,
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
