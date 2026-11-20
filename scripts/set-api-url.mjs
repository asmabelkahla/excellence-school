// Writes the production API URL into src/environments/environment.prod.ts at build time.
// Used by the hosting build (render.yaml). Without API_URL / API_HOST the file is left untouched.
//   API_URL=https://my-api.onrender.com/api   (full URL), or
//   API_HOST=my-api.onrender.com              (host only, as Render provides it)
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/environments/environment.prod.ts', import.meta.url);
const host = process.env.API_HOST?.trim();
const url = process.env.API_URL?.trim() || (host ? `https://${host}/api` : '');

if (!url) {
  console.log('[set-api-url] API_URL / API_HOST not set: keeping environment.prod.ts as is.');
  process.exit(0);
}
if (!/^https:\/\/[^\s'"]+$/.test(url)) {
  console.error(`[set-api-url] Refusing "${url}": the API URL must start with https:// (no quotes or spaces).`);
  process.exit(1);
}

const source = readFileSync(file, 'utf8');
const updated = source.replace(/apiUrl:\s*'[^']*'/, `apiUrl: '${url.replace(/\/+$/, '')}'`);
if (updated === source && !source.includes(url)) {
  console.error('[set-api-url] apiUrl not found in environment.prod.ts');
  process.exit(1);
}
writeFileSync(file, updated);
console.log(`[set-api-url] apiUrl = ${url}`);
