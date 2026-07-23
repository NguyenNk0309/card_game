import { cpSync, mkdirSync, readdirSync } from 'node:fs';

mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/.openai', { recursive: true });
mkdirSync('dist/assets', { recursive: true });

for (const entry of readdirSync('dist')) {
  if (entry === 'assets' || entry === 'server' || entry === '.openai') continue;
  cpSync(`dist/${entry}`, `dist/assets/${entry}`, { recursive: true });
}

cpSync('backend/realtime-worker.js', 'dist/server/index.js');

cpSync('.openai/hosting.json', 'dist/.openai/hosting.json');
console.log('Prepared Sites artifact: Worker entrypoint and static assets');
