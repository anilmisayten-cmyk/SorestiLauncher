#!/usr/bin/env node

/**
 * Build online version of Soresti Launcher
 * - Removes heavy bundled vanilla-setup (~800MB) and fabric-setup/libraries (~150MB)
 * - Keeps overlay mod, mininmap, resource packs, launcher assets
 * - Creates .online-mode flag so launcher downloads MC from internet
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, 'assets');
const ONLINE_FLAG = path.join(ASSETS_DIR, '.online-mode');

console.log('🔨 Building Soresti Launcher (Online Version)...');
console.log('');

// 1. Create .online-mode flag
console.log('📝 Creating .online-mode flag...');
fs.writeFileSync(ONLINE_FLAG, Date.now().toString());

// 2. Remove heavy bundled files
const dirsToRemove = [
  path.join(ASSETS_DIR, 'vanilla-setup'),
];

const dirsToClean = [
  path.join(ASSETS_DIR, 'fabric-setup', 'libraries'),
];

for (const dir of dirsToRemove) {
  if (fs.existsSync(dir)) {
    const size = getDirSize(dir);
    console.log(`🗑️  Removing ${path.relative(__dirname, dir)} (${(size / 1024 / 1024).toFixed(0)} MB)...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const dir of dirsToClean) {
  if (fs.existsSync(dir)) {
    const size = getDirSize(dir);
    console.log(`🗑️  Cleaning ${path.relative(__dirname, dir)} (${(size / 1024 / 1024).toFixed(0)} MB)...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 3. List what's kept
console.log('');
console.log('📦 Included in online build:');
const kept = [];
walkDir(ASSETS_DIR, kept);
const keptSize = kept.reduce((sum, f) => sum + fs.statSync(f).size, 0);
console.log(`   ${kept.length} files (${(keptSize / 1024 / 1024).toFixed(0)} MB)`);

// 4. Build with electron-builder
console.log('');
console.log('🔨 Running electron-builder...');
try {
  execSync('npx electron-builder --win --config electron-builder-online.yml', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('');
  console.log('✅ Online installer built successfully!');
} catch (e) {
  console.error('❌ Build failed:', e.message);
  process.exit(1);
} finally {
  // 5. Remove .online-mode flag (restore to bundled mode)
  if (fs.existsSync(ONLINE_FLAG)) {
    fs.unlinkSync(ONLINE_FLAG);
    console.log('🧹 Cleaned up .online-mode flag');
  }
}

function getDirSize(dir) {
  let size = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) size += getDirSize(full);
    else size += fs.statSync(full).size;
  }
  return size;
}

function walkDir(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else {
      files.push(full);
    }
  }
}
