import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://princerehman.com',
  output: 'static',
  build: {
    format: 'directory'
  },
  trailingSlash: 'ignore'
});
