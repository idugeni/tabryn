/**
 * Generate Tabryn extension icons (minimal valid PNGs)
 * Run: node scripts/generate-icons.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "../extension/icons");

fs.mkdirSync(iconsDir, { recursive: true });

// Minimal 1x1 PNG generator for placeholder icons
// Creates a simple colored square PNG
function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT chunk - create a simple colored image
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte (none)
    for (let x = 0; x < size; x++) {
      // Simple T-shaped icon in orange (#FF6B35) on dark background (#1a1a2e)
      const cx = x / size;
      const cy = y / size;

      // T shape: horizontal bar at top, vertical bar in center
      const isHorizontalBar = cy >= 0.15 && cy <= 0.35 && cx >= 0.15 && cx <= 0.85;
      const isVerticalBar = cy >= 0.15 && cy <= 0.85 && cx >= 0.38 && cx <= 0.62;

      if (isHorizontalBar || isVerticalBar) {
        // Orange (#FF6B35)
        rawData.push(0xff, 0x6b, 0x35);
      } else {
        // Dark (#1a1a2e)
        rawData.push(0x1a, 0x1a, 0x2e);
      }
    }
  }

  const compressed = deflateSync(Buffer.from(rawData));
  const idatChunk = createChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Minimal deflate implementation for raw data
function deflateSync(data) {
  // Store method (no compression) - simplest valid deflate
  const blocks = [];
  let offset = 0;

  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockLen = Math.min(remaining, 65535);
    const isLast = offset + blockLen >= data.length;

    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(blockLen, 1);
    header.writeUInt16LE(blockLen ^ 0xffff, 3);

    blocks.push(header);
    blocks.push(data.subarray(offset, offset + blockLen));
    offset += blockLen;
  }

  // Adler-32 checksum
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + (data[i] || 0)) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  const adlerVal = ((b << 16) | a) >>> 0;
  adler.writeUInt32BE(adlerVal, 0);

  return Buffer.concat([
    Buffer.from([0x78, 0x01]), // CMF, FLG
    ...blocks,
    adler,
  ]);
}

// Generate icons
const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: ${filePath} (${png.length} bytes)`);
}

console.log("Icons generated successfully!");
