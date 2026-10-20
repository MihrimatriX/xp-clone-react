// Pixel tools for Paint. Everything is drawn with fillRect stamps so edges stay hard,
// like XP's Paint, and flood fill doesn't leak through anti-aliased seams.
export type Tool = "pencil" | "brush" | "airbrush" | "eraser" | "fill" | "pick" | "text" | "line" | "rect" | "ellipse";
type Ctx = CanvasRenderingContext2D;

export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, size: number, color: string) {
  g.fillStyle = color;
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  // Bresenham: one stamp per pixel step along the line.
  for (let err = dx + dy; ;) {
    g.fillRect(x0 - (size >> 1), y0 - (size >> 1), size, size);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function spray(g: Ctx, x: number, y: number, radius: number, color: string) {
  g.fillStyle = color;
  for (let i = 0; i < radius * 2; i++) {
    const a = Math.random() * Math.PI * 2,
      r = Math.random() * radius;
    g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
  }
}

/** fill: 0 outline only, 1 outline in `fg` filled with `bg`, 2 filled with `fg`. */
export function shape(
  g: Ctx,
  tool: Tool,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fg: string,
  bg: string,
  fill: number,
  size: number,
) {
  if (tool === "line") return line(g, x0, y0, x1, y1, size, fg);
  const l = Math.min(x0, x1),
    t = Math.min(y0, y1),
    w = Math.abs(x1 - x0) + 1,
    h = Math.abs(y1 - y0) + 1,
    r = l + w - 1,
    b = t + h - 1;
  g.fillStyle = fill === 2 ? fg : bg;
  if (tool === "rect") {
    if (fill) g.fillRect(l, t, w, h);
    // outline: walk the four corners
    const pts = [l, t, r, t, r, b, l, b, l, t];
    if (fill !== 2) for (let i = 0; i < 8; i += 2) line(g, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, size, fg);
    return;
  }
  g.beginPath();
  g.ellipse(l + w / 2, t + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (fill) g.fill();
  if (fill !== 2) {
    g.strokeStyle = fg;
    g.lineWidth = size;
    g.stroke();
  }
}

const toPixel = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((255 << 24) | ((n & 0xff) << 16) | (((n >> 8) & 0xff) << 8) | (n >> 16)) >>> 0; // RGBA bytes read as little-endian uint32
};
export const toHex = (d: Uint8ClampedArray) =>
  "#" + [d[0], d[1], d[2]].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("");

/** Scanline flood fill on exact colour matches. */
export function floodFill(img: ImageData, x: number, y: number, hex: string) {
  const { width: w, height: h } = img,
    px = new Uint32Array(img.data.buffer);
  const target = px[y * w + x],
    color = toPixel(hex);
  if (target === undefined || target === color) return;
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop()!;
    let cx = stack.pop()!;
    while (cx > 0 && px[cy * w + cx - 1] === target) cx--;
    let up = false,
      down = false;
    for (; cx < w && px[cy * w + cx] === target; cx++) {
      px[cy * w + cx] = color;
      const above = cy > 0 && px[(cy - 1) * w + cx] === target,
        below = cy < h - 1 && px[(cy + 1) * w + cx] === target;
      if (above && !up) stack.push(cx, cy - 1);
      if (below && !down) stack.push(cx, cy + 1);
      up = above;
      down = below;
    }
  }
}
