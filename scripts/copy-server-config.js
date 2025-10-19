import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const sourcePath = resolve(projectRoot, 'public', '.htaccess');
const outputDir = resolve(projectRoot, 'dist');
const destinationPath = resolve(outputDir, '.htaccess');

if (!existsSync(sourcePath)) {
  console.warn(`No .htaccess file found at ${sourcePath}. Skipping copy.`);
  process.exit(0);
}

if (!existsSync(outputDir)) {
  console.warn(`Output directory ${outputDir} does not exist. Skipping copy.`);
  process.exit(0);
}

copyFileSync(sourcePath, destinationPath);
console.log(`Copied ${sourcePath} to ${destinationPath}`);
