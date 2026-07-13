// Generates the EasyPresent app icon: resources/icon.ico (multi-size, Windows)
// and resources/icon.png (512px, Linux/dev window icon). Purely procedural —
// no image tooling needed, so the icon is reproducible from source:
//   node scripts/generate-icon.js
//
// Design: modern rounded-square, deep indigo→violet vertical gradient, white
// play mark (projection/"go live") — 4× supersampled for smooth edges.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// ---------------------------------------------------------------------------
// Drawing (RGBA buffer, 4x supersampled)
// ---------------------------------------------------------------------------

const TOP = [79, 70, 229]; // indigo-600
const BOTTOM = [124, 58, 237]; // violet-600

function drawIcon(size) {
  const ss = 4;
  const C = size * ss;
  const img = Buffer.alloc(C * C * 4);

  const radius = C * 0.22;
  // Play-mark triangle, nudged right so it reads optically centered
  const tx1 = C * 0.38, ty1 = C * 0.30;
  const tx2 = C * 0.38, ty2 = C * 0.70;
  const tx3 = C * 0.74, ty3 = C * 0.50;

  const inRoundedRect = (x, y) => {
    const rx = Math.max(radius - x, x - (C - radius), 0);
    const ry = Math.max(radius - y, y - (C - radius), 0);
    return rx * rx + ry * ry <= radius * radius;
  };

  // Half-plane sign tests against the triangle's three edges
  const edge = (x, y, x1, y1, x2, y2) => (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  const inTriangle = (x, y) => {
    const a = edge(x, y, tx1, ty1, tx2, ty2);
    const b = edge(x, y, tx2, ty2, tx3, ty3);
    const c = edge(x, y, tx3, ty3, tx1, ty1);
    return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
  };

  for (let y = 0; y < C; y++) {
    const t = y / C;
    const r = Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t);
    const g = Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t);
    const b = Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t);
    for (let x = 0; x < C; x++) {
      const i = (y * C + x) * 4;
      if (!inRoundedRect(x + 0.5, y + 0.5)) continue; // transparent
      if (inTriangle(x + 0.5, y + 0.5)) {
        img[i] = 255; img[i + 1] = 255; img[i + 2] = 255; img[i + 3] = 255;
      } else {
        img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = 255;
      }
    }
  }

  // Box-downsample ss×ss → final size (averages alpha too = antialiasing)
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const i = ((y * ss + dy) * C + (x * ss + dx)) * 4;
          r += img[i]; g += img[i + 1]; b += img[i + 2]; a += img[i + 3];
        }
      }
      const n = ss * ss;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PNG encoding (IHDR + IDAT + IEND, RGBA8)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------------------
// ICO container (PNG-compressed entries, Vista+)
// ---------------------------------------------------------------------------

function encodeIco(pngsBySize) {
  const entries = Object.entries(pngsBySize).map(([size, png]) => ({ size: +size, png }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size; // 0 means 256
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0; // palette
    dir[o + 3] = 0; // reserved
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

// ---------------------------------------------------------------------------

const outDir = path.join(__dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });

const pngs = {};
for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  pngs[size] = encodePng(drawIcon(size), size);
}

fs.writeFileSync(path.join(outDir, 'icon.ico'), encodeIco(pngs));
fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(drawIcon(512), 512));

console.log('Wrote resources/icon.ico and resources/icon.png');
