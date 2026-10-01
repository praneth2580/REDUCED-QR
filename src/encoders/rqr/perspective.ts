export type Point = { x: number; y: number };

export type Quad = {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
};

export type PixelBuffer = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

type RGB = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPixel(image: PixelBuffer, x: number, y: number): RGB {
  const px = clamp(Math.round(x), 0, image.width - 1);
  const py = clamp(Math.round(y), 0, image.height - 1);
  const index = (py * image.width + px) * 4;
  return { r: image.data[index], g: image.data[index + 1], b: image.data[index + 2] };
}

function sampleBilinear(image: PixelBuffer, x: number, y: number): RGB {
  if (x < 0 || y < 0 || x >= image.width - 1 || y >= image.height - 1) {
    return getPixel(image, x, y);
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;
  const a = getPixel(image, x0, y0);
  const b = getPixel(image, x1, y0);
  const c = getPixel(image, x0, y1);
  const d = getPixel(image, x1, y1);
  const mix = (p: number, q: number, t: number) => p * (1 - t) + q * t;
  return {
    r: mix(mix(a.r, b.r, fx), mix(c.r, d.r, fx), fy),
    g: mix(mix(a.g, b.g, fx), mix(c.g, d.g, fx), fy),
    b: mix(mix(a.b, b.b, fx), mix(c.b, d.b, fx), fy),
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function redness(p: RGB): number {
  return p.r - (p.g + p.b) / 2;
}

function greenness(p: RGB): number {
  return p.g - (p.r + p.b) / 2;
}

function blueness(p: RGB): number {
  return p.b - (p.r + p.g) / 2;
}

function luma(p: RGB): number {
  return (p.r + p.g + p.b) / 3;
}

function chroma(p: RGB): number {
  return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
}

function isRedFinder(p: RGB): boolean {
  return p.r > 90 && redness(p) > 22 && p.r > p.g + 18 && p.r > p.b + 18;
}

function isBlueFinder(p: RGB): boolean {
  return p.b > 90 && blueness(p) > 22 && p.b > p.r + 18 && p.b > p.g + 18;
}

function isGreenFinder(p: RGB): boolean {
  return p.g > 90 && greenness(p) > 22 && p.g > p.r + 18 && p.g > p.b + 18;
}

function isDarkFinder(p: RGB): boolean {
  return luma(p) < 70 && chroma(p) < 55;
}

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) return null;
    const swap = M[col];
    M[col] = M[pivot];
    M[pivot] = swap;
    const div = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

function homography(from: Point[], to: Point[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(A, b);
  if (!h) return null;
  return [...h, 1];
}

function applyH(H: number[], x: number, y: number): Point | null {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-8) return null;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / w,
    y: (H[3] * x + H[4] * y + H[5]) / w,
  };
}

export function warpQuad(image: PixelBuffer, quad: Quad, outSize = 504): PixelBuffer | null {
  const last = outSize - 1;
  const H = homography(
    [
      { x: 0, y: 0 },
      { x: last, y: 0 },
      { x: 0, y: last },
      { x: last, y: last },
    ],
    [quad.tl, quad.tr, quad.bl, quad.br]
  );
  if (!H) return null;

  const data = new Uint8ClampedArray(outSize * outSize * 4);
  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      const src = applyH(H, x, y);
      const index = (y * outSize + x) * 4;
      if (!src) {
        data[index + 3] = 255;
        continue;
      }
      const pixel = sampleBilinear(image, src.x, src.y);
      data[index] = pixel.r;
      data[index + 1] = pixel.g;
      data[index + 2] = pixel.b;
      data[index + 3] = 255;
    }
  }
  return { width: outSize, height: outSize, data };
}

function isSaturated(p: RGB): boolean {
  return chroma(p) > 40 || luma(p) < 55;
}

function connectedComponents(image: PixelBuffer): Point[][] {
  const stride = Math.max(1, Math.floor(Math.min(image.width, image.height) / 160));
  const cols = Math.ceil(image.width / stride);
  const rows = Math.ceil(image.height / stride);
  const mask = new Uint8Array(cols * rows);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = Math.min(image.width - 1, cx * stride);
      const y = Math.min(image.height - 1, cy * stride);
      if (isSaturated(getPixel(image, x, y))) mask[cy * cols + cx] = 1;
    }
  }

  const dilated = new Uint8Array(mask);
  const passes = Math.max(4, Math.ceil(Math.min(image.width, image.height) / 24 / stride));
  for (let pass = 0; pass < passes; pass++) {
    const prev = dilated.slice();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (prev[cy * cols + cx]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            if (prev[ny * cols + nx]) {
              near = true;
              break;
            }
          }
        }
        if (near) dilated[cy * cols + cx] = 1;
      }
    }
  }

  const seen = new Uint8Array(cols * rows);
  const components: Point[][] = [];

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx;
      if (seen[idx] || !dilated[idx]) continue;
      const stack = [[cx, cy]];
      const points: Point[] = [];
      seen[idx] = 1;
      while (stack.length) {
        const [sx, sy] = stack.pop() as [number, number];
        points.push({
          x: Math.min(image.width - 1, sx * stride),
          y: Math.min(image.height - 1, sy * stride),
        });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = sx + dx;
          const ny = sy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const nidx = ny * cols + nx;
          if (seen[nidx] || !dilated[nidx]) continue;
          seen[nidx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (points.length >= 40) components.push(points);
    }
  }
  return components;
}

function farthestMatching(points: Point[], image: PixelBuffer, match: (p: RGB) => boolean, origin: Point): Point | null {
  let best: Point | null = null;
  let bestDist = -1;
  for (const point of points) {
    if (!match(getPixel(image, point.x, point.y))) continue;
    const d = dist(point, origin);
    if (d > bestDist) {
      best = point;
      bestDist = d;
    }
  }
  return best;
}

function refineOuterCorner(
  image: PixelBuffer,
  seed: Point,
  match: (pixel: RGB) => boolean,
  awayFrom: Point
): Point {
  const radius = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.05));
  const step = Math.max(1, Math.floor(radius / 8));
  let best = seed;
  let bestDist = dist(seed, awayFrom);
  for (let y = seed.y - radius; y <= seed.y + radius; y += step) {
    for (let x = seed.x - radius; x <= seed.x + radius; x += step) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      if (!match(getPixel(image, x, y))) continue;
      const d = dist({ x, y }, awayFrom);
      if (d > bestDist) {
        best = { x, y };
        bestDist = d;
      }
    }
  }
  return best;
}

function quadGeometryScore(red: Point, blue: Point, green: Point): number {
  const rb = dist(red, blue);
  const rg = dist(red, green);
  if (rb < 48 || rg < 48) return -1;
  const ratio = Math.max(rb, rg) / Math.min(rb, rg);
  if (ratio > 2.4) return -1;
  const vx = blue.x - red.x;
  const vy = blue.y - red.y;
  const wx = green.x - red.x;
  const wy = green.y - red.y;
  const cross = vx * wy - vy * wx;
  if (cross <= 0) return -1;
  const cos = (vx * wx + vy * wy) / (rb * rg);
  if (Math.abs(cos) > 0.6) return -1;
  return ((1 - Math.abs(cos)) * Math.min(rb, rg)) / ratio;
}

export function locateFinderQuad(image: PixelBuffer): Quad | null {
  const components = connectedComponents(image);
  let best: { quad: Quad; score: number } | null = null;

  for (const points of components) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const origin = { x: cx, y: cy };
    const red = farthestMatching(points, image, isRedFinder, origin);
    const blue = farthestMatching(points, image, isBlueFinder, origin);
    const green = farthestMatching(points, image, isGreenFinder, origin);
    if (!red || !blue || !green) continue;
    const score = quadGeometryScore(red, blue, green);
    if (score < 0) continue;
    const brGuess = { x: blue.x + green.x - red.x, y: blue.y + green.y - red.y };
    const black = farthestMatching(points, image, isDarkFinder, origin) ?? brGuess;
    const br = dist(black, brGuess) <= dist(red, blue) * 0.6 ? black : brGuess;
    const centroid = {
      x: (red.x + blue.x + green.x + br.x) / 4,
      y: (red.y + blue.y + green.y + br.y) / 4,
    };
    const quad = {
      tl: refineOuterCorner(image, red, isRedFinder, centroid),
      tr: refineOuterCorner(image, blue, isBlueFinder, centroid),
      bl: refineOuterCorner(image, green, isGreenFinder, centroid),
      br: refineOuterCorner(image, br, isDarkFinder, centroid),
    };
    if (!best || score > best.score) best = { quad, score };
  }

  return best?.quad ?? null;
}

export function unwarpRqr(image: PixelBuffer, outSize = 504): PixelBuffer | null {
  const quad = locateFinderQuad(image);
  if (!quad) return null;
  const side = Math.min(dist(quad.tl, quad.tr), dist(quad.tl, quad.bl));
  if (side < 48) return null;
  return warpQuad(image, quad, outSize);
}
