// Publica una versión nueva del Planner.
//   node scripts/release.mjs 2.5.0 "Novedad 1" "Novedad 2"
// 1. Sube el número de versión en package.json, Android y www/js/version.js.
// 2. Compila el APK firmado con la clave fija (android/keystore/planner.keystore).
// 3. Si hay PUBLISH_TOKEN en el entorno, lo publica en Supabase: la app avisará a todos los dispositivos.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [versionName, ...notesArr] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(versionName || '')) {
  console.error('Uso: node scripts/release.mjs <versión x.y.z> "nota 1" "nota 2"…');
  process.exit(1);
}
const notes = notesArr.join('\n');
const FN_URL = 'https://tqknwybunzucthlstgqb.supabase.co/functions/v1/publish-release';
const EXPECTED_CERT = 'af76ff88a9ac445b38cfcc0958a0e5ea6b27574b91c44877f6fedaffbfc2d41c';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

if (!existsSync('android/keystore/planner.keystore')) {
  console.error('Falta android/keystore/planner.keystore (la clave de firma). Recupérala de Supabase: tabla release_config, clave keystore_b64.');
  process.exit(1);
}

// 1. Versión
const gradlePath = 'android/app/build.gradle';
let gradle = readFileSync(gradlePath, 'utf8');
const prevCode = Number(gradle.match(/versionCode (\d+)/)[1]);
const versionCode = prevCode + 1;
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${versionName}"`);
writeFileSync(gradlePath, gradle);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = versionName;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
writeFileSync('www/js/version.js', `/* Generado por scripts/release.mjs */\n'use strict';\nconst APP_VERSION = { name: '${versionName}', code: ${versionCode} };\n`);
const sw = readFileSync('www/sw.js', 'utf8').replace(/planner-v[\w.]+/, `planner-v${versionName}`);
writeFileSync('www/sw.js', sw);
console.log(`Versión ${versionName} (código ${versionCode})`);

// 2. Compilar
run('npm', ['run', 'sync']);
run('./gradlew', ['assembleDebug', '--no-daemon', '-q'], { cwd: 'android' });
mkdirSync('dist', { recursive: true });
const apk = `dist/planner-recetas-${versionName}.apk`;
copyFileSync('android/app/build/outputs/apk/debug/app-debug.apk', apk);
try {
  const sdk = process.env.ANDROID_HOME || '/opt/android-sdk';
  const out = execFileSync(`${sdk}/build-tools/36.0.0/apksigner`, ['verify', '--print-certs', apk]).toString();
  if (!out.toLowerCase().includes(EXPECTED_CERT)) { console.error('La firma del APK no es la de siempre: no se publica (no se podría instalar encima).'); process.exit(1); }
  console.log('Firma verificada.');
} catch (e) { console.warn('No se pudo verificar la firma con apksigner:', e.message); }
console.log(`APK: ${apk} (${(statSync(apk).size / 1048576).toFixed(1)} MB)`);

// 3. Publicar
if (!process.env.PUBLISH_TOKEN) {
  console.log('Sin PUBLISH_TOKEN: compilado pero no publicado.');
  process.exit(0);
}
const res = execFileSync('curl', ['-sS', '--fail-with-body', '-X', 'POST', FN_URL,
  '-H', `x-publish-token: ${process.env.PUBLISH_TOKEN}`,
  '-F', `apk=@${apk};type=application/vnd.android.package-archive`,
  '--form-string', `versionName=${versionName}`,
  '--form-string', `versionCode=${versionCode}`,
  '--form-string', `notes=${notes}`]).toString();
console.log('Publicado:\n' + res);
