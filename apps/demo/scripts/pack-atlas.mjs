// Packs the demo's individual PNGs into one texture atlas (PNG + PixiJS JSON).
//
// Why: one atlas means one network request and one GPU texture instead of
// dozens, so the renderer can batch tiles and sprites without switching
// textures. The individual PNGs stay as the source art; edit those, and this
// script rebuilds the atlas before every `dev` and `build`.
//
// Each frame is resampled to the tile size (box filter when shrinking,
// nearest neighbour when growing) and its edge pixels are extruded into the
// padding so pixel-perfect scaling never bleeds neighbouring frames.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'art/atlas.json'), 'utf8'));
const size = config.tileSize;
const pad = config.padding;
const cell = size + pad * 2;

// Several ids can share one source image (e.g. all wall pieces); pack it once.
const sources = [...new Set(Object.values(config.frames))];
const cols = Math.ceil(Math.sqrt(sources.length));
const rows = Math.ceil(sources.length / cols);
const atlas = new PNG({ width: cols * cell, height: rows * cell });

function resample(src) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * src.width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.width) / size));
      const y0 = Math.floor((y * src.height) / size);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.height) / size));
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4;
          const alpha = src.data[i + 3];
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += alpha;
        }
      }
      const n = (x1 - x0) * (y1 - y0);
      const o = (y * size + x) * 4;
      out[o] = a ? r / a : 0;
      out[o + 1] = a ? g / a : 0;
      out[o + 2] = a ? b / a : 0;
      out[o + 3] = a / n;
    }
  }
  return out;
}

const rects = new Map();
sources.forEach((file, index) => {
  const src = PNG.sync.read(readFileSync(resolve(root, file)));
  const pixels = resample(src);
  const cx = (index % cols) * cell;
  const cy = Math.floor(index / cols) * cell;
  // Write the frame plus extruded edges into the padding.
  for (let y = -pad; y < size + pad; y++) {
    for (let x = -pad; x < size + pad; x++) {
      const sx = Math.min(size - 1, Math.max(0, x));
      const sy = Math.min(size - 1, Math.max(0, y));
      const i = (sy * size + sx) * 4;
      const o = ((cy + pad + y) * atlas.width + (cx + pad + x)) * 4;
      atlas.data[o] = pixels[i];
      atlas.data[o + 1] = pixels[i + 1];
      atlas.data[o + 2] = pixels[i + 2];
      atlas.data[o + 3] = pixels[i + 3];
    }
  }
  rects.set(file, { x: cx + pad, y: cy + pad, w: size, h: size });
});

const frames = {};
for (const [id, file] of Object.entries(config.frames)) {
  frames[id] = {
    frame: rects.get(file),
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: size, h: size },
    sourceSize: { w: size, h: size },
  };
}

const out = resolve(root, config.output);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(`${out}.png`, PNG.sync.write(atlas));
writeFileSync(
  `${out}.json`,
  JSON.stringify(
    {
      frames,
      meta: { image: `${basename(out)}.png`, format: 'RGBA8888', size: { w: atlas.width, h: atlas.height }, scale: '1' },
    },
    null,
    2
  )
);
console.log(`Packed ${sources.length} images (${Object.keys(frames).length} frames) into ${config.output}.png (${atlas.width}x${atlas.height})`);
