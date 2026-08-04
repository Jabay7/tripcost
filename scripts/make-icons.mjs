/**
 * Generates the app icon set with no image dependencies.
 *
 * Expo needs real PNGs on disk before it can build for a device or a store,
 * and pulling in a rasterizer for four flat images is not worth it. This writes
 * PNGs directly: raw RGBA scanlines, deflated with Node's zlib, wrapped in the
 * three chunks a PNG needs.
 *
 * The mark is the TripCost semi — the same geometry as src/ui/Logo.tsx, kept
 * in step by hand. It reads at 48px on a home screen and at 16px in a browser
 * tab, which are the only sizes that actually matter.
 *
 * Run with `npm run icons`. Regenerate any time the palette or mark changes.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** `pixels` is RGBA, 4 bytes per pixel, row-major. */
function encodePng(width, height, pixels) {
  const stride = width * 4;
  // Each scanline is prefixed with a filter byte. 0 = none; these images are
  // flat enough that filtering buys nothing.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing ---------------------------------------------------------------

const BG = [0x0b, 0x0f, 0x14]; // colors.bg
const SURFACE = [0x1a, 0x23, 0x2d]; // colors.surfaceAlt
const AMBER = [0xf5, 0xa5, 0x24]; // colors.accent

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// --- The mark, in the same 64×64 space as src/ui/Logo.tsx ------------------

/** Inclusive bounds of the drawn mark, used to centre and scale it. */
const MARK = { x0: 3, y0: 12.5, x1: 62, y1: 50.1 };

const rect = (x, y, w, h, r = 0) => ({ kind: 'rect', x, y, w, h, r });
const circle = (cx, cy, rad) => ({ kind: 'circle', cx, cy, r: rad });
const poly = (pts) => ({ kind: 'poly', pts });

/** Amber shapes, painted first. */
const SOLID = [
  rect(4, 17, 34, 20, 1.5), // trailer
  rect(38.6, 12.5, 1.8, 7, 0.6), // exhaust stack
  poly([
    [41, 19],
    [50, 19],
    [50, 26],
    [56, 26],
    [59, 30],
    [59, 37],
    [41, 37],
  ]), // cab and sloped hood
  circle(13, 41, 4.4),
  circle(22, 41, 4.4),
  circle(45, 41, 4.4),
  circle(54, 41, 4.4),
  rect(3, 47.5, 59, 2.6, 1.3), // road
];

/** Punched back out to the background, painted over the amber. */
const HOLES = [
  rect(44, 21, 4.5, 4, 0.6), // window
  circle(13, 41, 1.8),
  circle(22, 41, 1.8),
  circle(45, 41, 1.8),
  circle(54, 41, 1.8),
];

function inShape(s, x, y) {
  if (s.kind === 'circle') {
    const dx = x - s.cx;
    const dy = y - s.cy;
    return dx * dx + dy * dy <= s.r * s.r;
  }
  if (s.kind === 'rect') {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
    if (!s.r) return true;
    // Rounded corners: outside only if beyond the corner arc.
    const cx = Math.min(Math.max(x, s.x + s.r), s.x + s.w - s.r);
    const cy = Math.min(Math.max(y, s.y + s.r), s.y + s.h - s.r);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= s.r * s.r;
  }
  // Polygon: even-odd ray cast.
  let inside = false;
  for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++) {
    const [xi, yi] = s.pts[i];
    const [xj, yj] = s.pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * @param size       square edge in px
 * @param transparent leave the background clear (Android adaptive foreground)
 * @param inset      fraction of the canvas the mark occupies
 */
function drawIcon(size, { transparent = false, inset = 0.1 } = {}) {
  const px = Buffer.alloc(size * size * 4);

  // Scale the mark to the available width, then centre it both ways. The mark
  // is much wider than it is tall, so vertical centring leaves a margin that
  // survives a launcher masking the tile into a circle.
  const avail = size * (1 - 2 * inset);
  const markW = MARK.x1 - MARK.x0;
  const markH = MARK.y1 - MARK.y0;
  const scale = Math.min(avail / markW, avail / markH);
  const offX = (size - markW * scale) / 2 - MARK.x0 * scale;
  const offY = (size - markH * scale) / 2 - MARK.y0 * scale;

  // Supersample: without it the wheels and the sloped hood alias badly at the
  // sizes that matter, and a jagged icon is the one thing everyone notices.
  const SS = 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS - offX) / scale;
          const uy = (y + (sy + 0.5) / SS - offY) / scale;
          if (SOLID.some((s) => inShape(s, ux, uy)) && !HOLES.some((s) => inShape(s, ux, uy))) {
            hits++;
          }
        }
      }
      const cover = hits / (SS * SS);

      // Background: a soft vertical gradient so the tile has some depth.
      const base = transparent ? BG : mix(BG, SURFACE, (y / size) * 0.85);
      const baseAlpha = transparent ? 0 : 255;

      const i = (y * size + x) * 4;
      if (cover === 0) {
        px[i] = base[0];
        px[i + 1] = base[1];
        px[i + 2] = base[2];
        px[i + 3] = baseAlpha;
        continue;
      }

      if (transparent) {
        // Keep the mark's own colour and let coverage drive alpha, so the
        // launcher can composite it over any background it likes.
        px[i] = AMBER[0];
        px[i + 1] = AMBER[1];
        px[i + 2] = AMBER[2];
        px[i + 3] = Math.round(cover * 255);
      } else {
        const rgb = mix(base, AMBER, cover);
        px[i] = rgb[0];
        px[i + 1] = rgb[1];
        px[i + 2] = rgb[2];
        px[i + 3] = 255;
      }
    }
  }

  return encodePng(size, size, px);
}

// --- Output ----------------------------------------------------------------

const dir = join(process.cwd(), 'assets');
mkdirSync(dir, { recursive: true });

const outputs = [
  // Store and home-screen icon.
  ['icon.png', drawIcon(1024, { inset: 0.12 })],
  // Android adaptive foreground: transparent, inset further so the launcher
  // can mask it into a circle or squircle without clipping the mark.
  ['adaptive-icon.png', drawIcon(1024, { transparent: true, inset: 0.26 })],
  // Splash: the mark small and centred on the app's own background.
  ['splash-icon.png', drawIcon(1024, { inset: 0.3 })],
  // Browser tab. 32 is what actually gets shown; 64 downsamples cleanly.
  ['favicon.png', drawIcon(64, { inset: 0.06 })],
];

for (const [name, buf] of outputs) {
  const path = join(dir, name);
  writeFileSync(path, buf);
  console.log(`  ${name.padEnd(20)} ${(buf.length / 1024).toFixed(1)} KB`);
}

console.log('\nWrote app icons to assets/.');
