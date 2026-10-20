// Desktop icon grid: pure helpers so they can be tested without a DOM.
export type Cell = { x: number; y: number };
export const cellKey = (c: Cell) => `${c.x},${c.y}`;

/** Closest free cell to `want`; used when an icon is dropped or created on an occupied cell. */
export function nearestFree(want: Cell, taken: Set<string>, rows: number): Cell {
  // Search outward ring by ring; columns are unbounded, so a free cell always turns up.
  for (let r = 0; ; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const c = { x: want.x + dx, y: want.y + dy };
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && c.x >= 0 && c.y >= 0 && c.y < rows && !taken.has(cellKey(c)))
          return c;
      }
}

/** Saved cells win; icons without one (or whose cell is taken) fill free cells column by column. */
export function layout(ids: string[], saved: Record<string, Cell>, rows: number) {
  const out: Record<string, Cell> = {},
    taken = new Set<string>();
  const place = (id: string, c: Cell) => {
    out[id] = c;
    taken.add(cellKey(c));
  };
  for (const id of ids) {
    const c = saved[id];
    if (c && c.y < rows && !taken.has(cellKey(c))) place(id, c);
  }
  for (let i = 0, j = 0; i < ids.length; i++) {
    if (out[ids[i]!]) continue;
    let c: Cell;
    do c = { x: Math.floor(j / rows), y: j++ % rows };
    while (taken.has(cellKey(c)));
    place(ids[i]!, c);
  }
  return out;
}
