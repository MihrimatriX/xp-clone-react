import { expect, test } from "bun:test";
import { chord, flagsLeft, neighbors, newBoard, reveal, toggleMark, type Board } from "./minesweeper";

// Deterministic generator so boards are reproducible.
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mines = (b: Board) => b.cells.filter((c) => c.mine).length;
// A board in play with hand-placed mines.
const withMines = (b: Board, ...at: number[]): Board => {
  for (const i of at) b.cells[i]!.mine = true;
  for (const [i, c] of b.cells.entries()) c.n = neighbors(b, i).filter((j) => b.cells[j]!.mine).length;
  return { ...b, state: "playing" };
};

test("plants exactly the requested mines and never under the first click", () => {
  for (let s = 1; s < 200; s++) {
    const b = reveal(newBoard(9, 9, 10), s % 81, seeded(s));
    expect(mines(b)).toBe(10);
    expect(b.cells[s % 81]!.mine).toBe(false);
    expect(b.state).not.toBe("lost");
  }
  expect(mines(reveal(newBoard(30, 16, 99), 0, seeded(7)))).toBe(99);
});

test("neighbour counts and corner neighbours", () => {
  const b = reveal(newBoard(9, 9, 10), 40, seeded(3));
  b.cells.forEach((c, i) => expect(c.n).toBe(neighbors(b, i).filter((j) => b.cells[j]!.mine).length));
  expect(neighbors(b, 0).sort((x, y) => x - y)).toEqual([1, 9, 10]);
});

test("flood fill opens the whole empty region and stops at numbers", () => {
  const after = reveal(withMines(newBoard(5, 5, 1), 24), 0); // mine in the bottom-right corner
  expect(after.cells.filter((c) => c.open).length).toBe(24);
  expect(after.state).toBe("won");
  expect(after.cells[24]!.mark).toBe(1); // XP flags the remaining mines on a win
});

test("flags block reveals; marks cycle flag → ? → none", () => {
  let b = toggleMark(newBoard(9, 9, 10), 5, true);
  expect(b.cells[5]!.mark).toBe(1);
  expect(flagsLeft(b)).toBe(9);
  expect(reveal(b, 5)).toBe(b);
  b = toggleMark(toggleMark(b, 5, true), 5, true);
  expect(b.cells[5]!.mark).toBe(0);
  expect(toggleMark(toggleMark(b, 5, false), 5, false).cells[5]!.mark).toBe(0); // marks off: flag → none
});

test("chording opens the neighbours once the flags match, and can blow up on a wrong flag", () => {
  const b = withMines(newBoard(3, 3, 1), 0);
  b.cells[4]!.open = true; // centre shows 1
  expect(chord(b, 4)).toBe(b); // no flags yet
  const good = chord(toggleMark(b, 0, true), 4);
  expect(good.cells.filter((c) => c.open).length).toBe(8);
  expect(good.state).toBe("won");
  expect(chord(toggleMark(b, 8, true), 4).state).toBe("lost");
});
