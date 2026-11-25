// Generates the extension PNG icons with no external dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const mix = (a, b, t) => a + (b - a) * t;
const inRound = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.max(Math.abs(x - cx) - (hw - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (hh - r), 0);
  return dx * dx + dy * dy <= r * r;
};

function pixel(u, v) {
  // u,v in 0..1 -> [r,g,b,a]
  if (!inRound(u, v, 0.5, 0.5, 0.5, 0.5, 0.22)) return [0, 0, 0, 0];
  const t = (u + v) / 2;
  let col = [mix(0x5b, 0x8b, t), mix(0x5c, 0x5c, t), mix(0xe2, 0xf6, t)];
  const white = [255, 255, 255];
  // mic capsule
  const cap = inRound(u, v, 0.5, 0.4, 0.11, 0.2, 0.11);
  // arc around the mic (U shape)
  const dx = u - 0.5, dy = v - 0.44;
  const d = Math.sqrt(dx * dx + dy * dy);
  const arc = dy > 0 && d > 0.2 && d < 0.255 && v < 0.7;
  const stem = Math.abs(u - 0.5) < 0.027 && v > 0.69 && v < 0.8;
  const base = Math.abs(u - 0.5) < 0.11 && v > 0.79 && v < 0.835;
  if (cap || arc || stem || base) col = white;
  return [...col, 255];
}

function png(size) {
  const ss = 3;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const p = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = ss * ss;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round(a / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, png(s));
console.log('icons written');
