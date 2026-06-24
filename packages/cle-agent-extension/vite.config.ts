import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';

/**
 * Dual-target extension build.
 *
 * TARGET=chrome (default) → dist/          uses manifest.json       (MV3, Chrome/Edge/Arc)
 * TARGET=firefox          → dist-firefox/  uses manifest.firefox.json (MV2, Firefox 101+)
 *
 * Usage:
 *   npm run build            # Chrome/Edge
 *   npm run build:firefox    # Firefox
 *   npm run build:all        # Both
 */
const TARGET = (process.env.TARGET ?? 'chrome') as 'chrome' | 'firefox';
const IS_FIREFOX = TARGET === 'firefox';
const outDir = IS_FIREFOX ? 'dist-firefox' : 'dist';

export default defineConfig({
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        // Both targets use 'es' format so Vite can bundle multiple entry points
        format: 'es',
      },
    },
    target: 'esnext',
    minify: false, // Keep readable for extension store review
  },
  plugins: [
    {
      // After build: overwrite the Chrome manifest.json (copied from public/)
      // with our specific Firefox manifest if building for Firefox.
      name: 'copy-extension-assets',
      closeBundle() {
        if (IS_FIREFOX) {
          copyFileSync('manifest.firefox.json', `${outDir}/manifest.json`);
          console.log(`\n✅ FIREFOX extension built → ${outDir}/`);
          console.log(`   manifest: manifest.firefox.json → ${outDir}/manifest.json\n`);
        } else {
          console.log(`\n✅ CHROME extension built → ${outDir}/\n`);
        }
      },
    },
  ],
});
