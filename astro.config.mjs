// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Absolute URLs for og:image — link previews reject relative paths.
  site: 'https://0xegg.com',
  adapter: cloudflare()
});