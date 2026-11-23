import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@lius1314', 'visual-dashboard-scaffold', 'public');
const dest = join(root, 'public');

if (!existsSync(src)) {
  console.error('Scaffold public assets not found. Run npm install first.');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });

// Keep business assets under public/assets/plant; wipe only SDK-owned dirs.
for (const name of ['themes', 'images', 'fonts', 'css', 'webfonts']) {
  const from = join(src, name);
  const to = join(dest, name);
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`synced ${name}`);
}

console.log('Scaffold public assets synced.');
