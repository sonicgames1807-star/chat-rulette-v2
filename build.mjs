import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: 'browser',
  target: ['es2020'],
  format: 'iife',
  outfile: 'dist/app.js',
  loader: { '.css': 'css' },
});
await copyFile('index.html', 'dist/index.html');
console.log('Built dist/app.js and dist/index.html');
