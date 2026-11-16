import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const base = process.env.SITE_URL?.trim();
if (!base || !/^https:\/\//.test(base)) {
  throw new Error('SITE_URL must be an https:// URL, e.g. https://owner.github.io/repo/');
}
const root = base.endsWith('/') ? base : `${base}/`;
const file = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(file, 'utf8'));
manifest.icon = new URL('icons/extension.svg', root).href;
manifest.background_url = new URL(`background.html?v=${manifest.version}`, root).href;
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(file, `dist/manifest-v${manifest.version}.json`);
console.log(`Manifest fertig: ${new URL('manifest.json', root)}`);
