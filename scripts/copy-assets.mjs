// Copia las tipografías y la librería de Supabase a www/ para que la app no dependa de CDN.
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
mkdirSync('www/vendor', { recursive: true });
copyFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'www/vendor/supabase.js');
console.log('Librería de Supabase copiada a www/vendor');
