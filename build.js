#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Чтение версии напрямую из manifest.json
const manifestPath = path.join(ROOT_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('[Build Error] manifest.json not found in project root!');
  process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifestObj = JSON.parse(manifestRaw);
const VERSION = manifestObj.version || '1.0.0';

const ZIP_NAME = `ai-studio-pro-suite-v${VERSION}.zip`;
const ZIP_PATH = path.join(ROOT_DIR, ZIP_NAME);

function minifyJS(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([\{\};:,])\s*/g, '$1')
    .replace(/\n+/g, '')
    .trim();
}

function minifyJSON(jsonStr) {
  return JSON.stringify(JSON.parse(jsonStr));
}

function writeZip(files, outputPath) {
  const fileEntries = [];
  let offset = 0;

  for (const { name, data } of files) {
    const compressedData = zlib.deflateRawSync(data);
    const modDate = new Date();
    const dosTime = (modDate.getHours() << 11) | (modDate.getMinutes() << 5) | (modDate.getSeconds() >> 1);
    const dosDate = ((modDate.getFullYear() - 1980) << 9) | ((modDate.getMonth() + 1) << 5) | modDate.getDate();

    let crc = ~0;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
    }
    crc = (~crc) >>> 0;

    const nameBuffer = Buffer.from(name);
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuffer.copy(localHeader, 30);

    fileEntries.push({
      nameBuffer,
      crc,
      compressedSize: compressedData.length,
      uncompressedSize: data.length,
      dosTime,
      dosDate,
      offset,
      localHeader,
      compressedData
    });

    offset += localHeader.length + compressedData.length;
  }

  const centralDirBuffers = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cdHeader = Buffer.alloc(46 + entry.nameBuffer.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(8, 10);
    cdHeader.writeUInt16LE(entry.dosTime, 12);
    cdHeader.writeUInt16LE(entry.dosDate, 14);
    cdHeader.writeUInt32LE(entry.crc, 16);
    cdHeader.writeUInt32LE(entry.compressedSize, 20);
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24);
    cdHeader.writeUInt16LE(entry.nameBuffer.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(entry.offset, 42);
    entry.nameBuffer.copy(cdHeader, 46);

    centralDirBuffers.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(fileEntries.length, 8);
  eocd.writeUInt16LE(fileEntries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const out = fs.createWriteStream(outputPath);
  for (const entry of fileEntries) {
    out.write(entry.localHeader);
    out.write(entry.compressedData);
  }
  for (const cd of centralDirBuffers) {
    out.write(cd);
  }
  out.write(eocd);
  out.end();
}

const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[i] = c;
}

function build() {
  console.log(`[Build] Starting build for v${VERSION}...`);

  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true, force: true });
  if (fs.existsSync(ZIP_PATH)) fs.rmSync(ZIP_PATH);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const manifest = minifyJSON(manifestRaw);
  const extension = minifyJS(fs.readFileSync(path.join(ROOT_DIR, 'extension.js'), 'utf8'));
  const styles = minifyCSS(fs.readFileSync(path.join(ROOT_DIR, 'styles.css'), 'utf8'));

  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(DIST_DIR, 'extension.js'), extension);
  fs.writeFileSync(path.join(DIST_DIR, 'styles.css'), styles);

  const docFiles = ['LICENSE', 'README.md'];
  for (const f of docFiles) {
    const src = path.join(ROOT_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, f));
    }
  }

  const zipPayload = [
    { name: 'manifest.json', data: Buffer.from(manifest) },
    { name: 'extension.js', data: Buffer.from(extension) },
    { name: 'styles.css', data: Buffer.from(styles) }
  ];

  for (const f of docFiles) {
    const src = path.join(ROOT_DIR, f);
    if (fs.existsSync(src)) {
      zipPayload.push({ name: f, data: fs.readFileSync(src) });
    }
  }

  writeZip(zipPayload, ZIP_PATH);
  console.log(`[Build] Successfully packaged v${VERSION}:`);
  console.log(`  -> Unpacked Folder: ${DIST_DIR}`);
  console.log(`  -> Release Zip:     ${ZIP_PATH}`);
}

build();