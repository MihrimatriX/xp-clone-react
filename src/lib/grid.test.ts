import { expect, test } from "bun:test";
import { cellKey, layout, nearestFree } from "./grid";

test("nearestFree keeps a free cell and slides past taken ones", () => {
  expect(nearestFree({ x: 2, y: 3 }, new Set(), 8)).toEqual({ x: 2, y: 3 });
  const taken = new Set(["2,3"]);
  const c = nearestFree({ x: 2, y: 3 }, taken, 8);
  expect(Math.max(Math.abs(c.x - 2), Math.abs(c.y - 3))).toBe(1);
  expect(nearestFree({ x: 0, y: 0 }, new Set(["0,0", "0,1", "1,0", "1,1"]), 2)).toEqual({ x: 2, y: 0 });
});

test("layout honours saved cells and fills the rest column by column", () => {
  const cells = layout(["a", "b", "c", "d"], { c: { x: 0, y: 0 }, d: { x: 0, y: 0 } }, 2);
  expect(cells.c).toEqual({ x: 0, y: 0 });
  expect([cells.a, cells.b, cells.d].map((c) => cellKey(c!))).toEqual(["0,1", "1,0", "1,1"]);
  expect(layout(["a"], { a: { x: 0, y: 9 } }, 3).a).toEqual({ x: 0, y: 0 }); // saved row no longer fits
});
