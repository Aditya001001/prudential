/*
 * One-off script: downloads the @imgly/background-removal runtime + isnet_fp16
 * model chunks from the public staticimgly.com CDN and writes them into
 * frontend/public/bgremoval/ so the app can self-host them (served by our own
 * Nginx/Cloudflare, no third-party runtime dependency).
 *
 * Run once with: node scripts/fetch-bgremoval-assets.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const VERSION = require('../node_modules/@imgly/background-removal/package.json').version;
const BASE = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/dist/`;
const OUT_DIR = path.join(__dirname, '..', 'public', 'bgremoval');

// Only keep the keys we actually use: the isnet_fp16 model + the WASM runtime
// (both the plain and JSEP/WebGPU variants, since ort picks one at runtime).
const KEEP_KEYS = [
  '/models/isnet_fp16',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function fetchFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`${url} -> ${res.statusCode}`));
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Fetching resources.json from ${BASE}`);
  const resourceMap = await fetchJson(`${BASE}resources.json`);

  const trimmedMap = {};
  for (const key of KEEP_KEYS) {
    if (!resourceMap[key]) {
      console.warn(`WARNING: key ${key} not found upstream, skipping`);
      continue;
    }
    trimmedMap[key] = resourceMap[key];
  }

  for (const [key, entry] of Object.entries(trimmedMap)) {
    for (const chunk of entry.chunks) {
      const destPath = path.join(OUT_DIR, chunk.name);
      if (fs.existsSync(destPath) && fs.statSync(destPath).size === chunk.offsets[1] - chunk.offsets[0]) {
        console.log(`skip (exists) ${chunk.name}`);
        continue;
      }
      const url = `${BASE}${chunk.name}`;
      console.log(`downloading ${key} chunk -> ${chunk.name} (${chunk.offsets[1] - chunk.offsets[0]} bytes)`);
      await fetchFile(url, destPath);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'resources.json'), JSON.stringify(trimmedMap, null, 2));
  console.log(`Done. Assets written to ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
