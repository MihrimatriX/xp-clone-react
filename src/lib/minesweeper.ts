// Minesweeper rules as pure functions; every move returns a new board.
interface Cell {
  mine: boolean;
  open: boolean;
  mark: 0 | 1 | 2; // none, flag, question
  n: number;
}
export interface Board {
  w: number;
  h: number;
  mines: number;
  cells: Cell[];
  state: "ready" | "playing" | "won" | "lost";
  hit?: number;
}

export const LEVELS: Record<string, [w: number, h: number, mines: number]> = {
  Beginner: [9, 9, 10],
  Intermediate: [16, 16, 40],
  Expert: [30, 16, 99],
};
export const levelOf = (b: Pick<Board, "w" | "h" | "mines">) =>
  Object.keys(LEVELS).find((k) => LEVELS[k]!.join() === [b.w, b.h, b.mines].join());

export const newBoard = (w: number, h: number, mines: number): Board => ({
  w,
  h,
  mines,
  state: "ready",
  cells: Array.from({ length: w * h }, () => ({ mine: false, open: false, mark: 0, n: 0 })),
});

export function neighbors(b: Board, i: number): number[] {
  const x = i % b.w,
    y = Math.floor(i / b.w),
    out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && x + dx >= 0 && x + dx < b.w && y + dy >= 0 && y + dy < b.h) out.push(i + dy * b.w + dx);
  return out;
}

/** Mines go in after the first click, never under it, so the opening move is always safe. */
function plant(b: Board, safe: number, rand: () => number): Cell[] {
  const cells = b.cells.map((c) => ({ ...c }));
  const spots = cells.map((_, i) => i).filter((i) => i !== safe);
  for (let k = 0; k < b.mines && spots.length; k++) {
    const j = Math.floor(rand() * spots.length);
    cells[spots[j]!]!.mine = true;
    spots[j] = spots[spots.length - 1]!;
    spots.pop();
  }
  for (const [i, c] of cells.entries()) c.n = neighbors(b, i).filter((j) => cells[j]!.mine).length;
  return cells;
}

export function reveal(b: Board, i: number, rand: () => number = Math.random): Board {
  if (b.state === "won" || b.state === "lost" || b.cells[i]!.open || b.cells[i]!.mark === 1) return b;
  const cells = b.state === "ready" ? plant(b, i, rand) : b.cells.map((c) => ({ ...c }));
  if (cells[i]!.mine) {
    for (const c of cells) if (c.mine && c.mark !== 1) c.open = true;
    return { ...b, cells, state: "lost", hit: i };
  }
  // Flood fill: opening a 0 opens its neighbours, and so on outward; flags stop it.
  for (const stack = [i]; stack.length;) {
    const j = stack.pop()!,
      c = cells[j]!;
    if (c.open || c.mark === 1) continue;
    c.open = true;
    c.mark = 0;
    if (c.n === 0) stack.push(...neighbors(b, j));
  }
  const won = cells.every((c) => c.mine || c.open);
  if (won) for (const c of cells) if (c.mine) c.mark = 1;
  return { ...b, cells, state: won ? "won" : "playing" };
}

/** Flag → question mark (when marks are on) → nothing. */
export function toggleMark(b: Board, i: number, marks: boolean): Board {
  const c = b.cells[i]!;
  if (b.state === "won" || b.state === "lost" || c.open) return b;
  const cells = b.cells.slice();
  cells[i] = { ...c, mark: c.mark === 0 ? 1 : c.mark === 1 && marks ? 2 : 0 };
  return { ...b, cells };
}

/** Both buttons on an opened number: if its flags are all placed, open every other neighbour. */
export function chord(b: Board, i: number): Board {
  const c = b.cells[i]!,
    around = neighbors(b, i);
  if (b.state !== "playing" || !c.open || !c.n || around.filter((j) => b.cells[j]!.mark === 1).length !== c.n) return b;
  return around.reduce((acc, j) => reveal(acc, j), b);
}

export const flagsLeft = (b: Board) => b.mines - b.cells.filter((c) => c.mark === 1).length;
