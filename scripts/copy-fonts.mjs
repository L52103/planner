// Copia las tipografías (latin y latin-ext) a www/fonts para que la app funcione sin internet.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
const out = 'www/fonts';
mkdirSync(out, { recursive: true });
const faces = [['bricolage-grotesque', [600, 800]], ['atkinson-hyperlegible', [400, 700]]];
let css = '/* Generado por scripts/copy-fonts.mjs */\n';
for (const [pkg, weights] of faces) {
  const dir = join('node_modules/@fontsource', pkg);
  for (const w of weights) {
    const blocks = readFileSync(join(dir, `${w}.css`), 'utf8').split('}').map(b => b.trim()).filter(b => /latin(-ext)?-\d+-normal\.woff2/.test(b) && !/(cyrillic|greek|vietnamese)/.test(b));
    for (const b of blocks) {
      const files = [...b.matchAll(/url\(\.\/files\/([^)]+)\)/g)].map(m => m[1]).filter(f => f.endsWith('.woff2'));
      files.forEach(f => copyFileSync(join(dir, 'files', f), join(out, f)));
      css += b.replace(/,\s*url\(\.\/files\/[^)]+\.woff\)\s*format\('woff'\)/g, '').replace(/url\(\.\/files\//g, 'url(./fonts/') + '}\n';
    }
  }
}
writeFileSync('www/fonts.css', css);
console.log('Fuentes copiadas a', out);
