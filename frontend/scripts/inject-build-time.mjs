import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const indexPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/index.html',
);

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const buildTime = new Date()
  .toISOString()
  .replace(/[-:T.Z]/g, '')
  .slice(0, 14);

const html = fs.readFileSync(indexPath, 'utf8');
const next = html.replace(/__BUILD_TIME__/g, buildTime);

if (next === html) {
  console.warn('__BUILD_TIME__ placeholder not found in dist/index.html');
}

fs.writeFileSync(indexPath, next);
console.log(`Injected build time: ${buildTime}`);
