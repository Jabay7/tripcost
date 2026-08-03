/**
 * Generates the app icon set with no image dependencies.
 *
 * Expo needs real PNGs on disk before it can build for a device or a store,
 * and pulling in a rasterizer for four flat images is not worth it. This writes
 * PNGs directly: raw RGBA scanlines, deflated with Node's zlib, wrapped in the
 * three chunks a PNG needs.
 *
 * The mark is a road in perspective — two rails converging to a vanishing
 * point with a dashed centerline — on the app's own dark surface. It reads at
 * 48px on a home screen, which is the only size that actually matters.
 *
 * Run with `npm run icons`. Regenerate any time the palette changes.
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
const ROAD = [0x1a, 0x23, 0x2d]; // colors.surfaceAlt
const AMBER = [0xf5, 0xa5, 0x24]; // colors.accent

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * @param size       square edge in px
 * @param transparent leave the background clear (Android adaptive foreground)
 * @param inset      fraction of the canvas the mark occupies
 */
function drawIcon(size, { transparent = false, inset = 0 } = {}) {
  const px = Buffer.alloc(size * size * 4);

  const pad = size * inset;
  const x0 = pad;
  const x1 = size - pad;
  const y0 = pad;
  const y1 = size - pad;
  const w = x1 - x0;
  const h = y1 - y0;

  // Vanishing point, centred and high enough that the road fills the tile.
  // Launchers mask icons into circles and squircles, so dead space at the top
  // reads as a mistake once the corners are gone.
  const vpX = x0 + w * 0.5;
  const vpY = y0 + h * 0.18;

  // Road edges at the bottom of the mark — full width, so the road dominates.
  const baseLeft = x0;
  const baseRight = x1;
  const baseY = y1;

  // A faint horizon band behind the vanishing point, so the upper area reads
  // as sky rather than as nothing.
  const horizonY = vpY;

  const set = (x, y, rgb, a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Background: a soft vertical gradient so the tile has some depth, with
      // a faint amber wash just above the horizon — headlights at dusk.
      if (transparent) {
        set(x, y, BG, 0);
      } else {
        const t = y / size;
        let rgb = mix(BG, [0x13, 0x1a, 0x22], t * 0.9);
        const distToHorizon = Math.abs(y - horizonY) / (size * 0.22);
        if (distToHorizon < 1) {
          rgb = mix(rgb, AMBER, (1 - distToHorizon) * 0.1);
        }
        set(x, y, rgb, 255);
      }

      if (y < vpY || y > baseY || y < y0) continue;

      // How far down the road we are, 0 at the vanishing point, 1 at the base.
      const depth = (y - vpY) / (baseY - vpY);
      if (depth < 0 || depth > 1) continue;

      const left = vpX + (baseLeft - vpX) * depth;
      const right = vpX + (baseRight - vpX) * depth;

      if (x < left || x > right) continue;

      // Road surface, lightening slightly toward the viewer.
      set(x, y, mix(ROAD, [0x26, 0x32, 0x3f], depth), 255);

      // Amber shoulders, thickness scaling with perspective.
      const edge = Math.max(size * 0.012, (right - left) * 0.055);
      if (x < left + edge || x > right - edge) {
        set(x, y, AMBER, 255);
        continue;
      }

      // Dashed centreline. Dash length grows with depth so the stripes look
      // evenly spaced in perspective rather than on the page.
      const centre = (left + right) / 2;
      const halfDash = Math.max(size * 0.008, (right - left) * 0.035);
      if (Math.abs(x - centre) < halfDash) {
        // Cycle in a space that stretches toward the viewer.
        const cycle = Math.pow(depth, 0.55) * 7;
        if (cycle % 1 < 0.5) set(x, y, AMBER, 255);
      }
    }
  }

  return encodePng(size, size, px);
}

// --- Output ----------------------------------------------------------------

const dir = join(process.cwd(), 'assets');
mkdirSync(dir, { recursive: true });

const outputs = [
  // Store and home-screen icon. Full bleed.
  ['icon.png', drawIcon(1024)],
  // Android adaptive foreground: transparent, inset so the launcher can mask
  // it into a circle or squircle without clipping the mark.
  ['adaptive-icon.png', drawIcon(1024, { transparent: true, inset: 0.22 })],
  // Splash: the mark small and centred on the app's own background.
  ['splash-icon.png', drawIcon(1024, { inset: 0.3 })],
  ['favicon.png', drawIcon(64)],
];

for (const [name, buf] of outputs) {
  const path = join(dir, name);
  writeFileSync(path, buf);
  console.log(`  ${name.padEnd(20)} ${(buf.length / 1024).toFixed(1)} KB`);
}

console.log('\nWrote app icons to assets/.');
