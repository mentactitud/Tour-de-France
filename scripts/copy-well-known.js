import fs from 'fs';
import path from 'path';

function copyAssets(targetDir) {
  const wellKnownDir = path.join(targetDir, '.well-known');
  if (!fs.existsSync(wellKnownDir)) {
    fs.mkdirSync(wellKnownDir, { recursive: true });
  }

  const srcJson = path.resolve('public/.well-known/assetlinks.json');
  const destJson = path.join(wellKnownDir, 'assetlinks.json');
  if (fs.existsSync(srcJson)) {
    fs.copyFileSync(srcJson, destJson);
    console.log(`Copied ${srcJson} -> ${destJson}`);
  }

  const noJekyllFile = path.join(targetDir, '.nojekyll');
  fs.writeFileSync(noJekyllFile, '# Disable Jekyll\n');
  console.log(`Created ${noJekyllFile}`);
}

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  copyAssets(distDir);
}

const compartirDir = path.resolve('dist/compartir');
if (fs.existsSync(compartirDir)) {
  copyAssets(compartirDir);
}
