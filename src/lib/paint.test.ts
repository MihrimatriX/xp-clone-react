import { expect, test } from "bun:test";
import { floodFill, toHex } from "./paint";

// Pictures as ASCII: "#" black, "." white, "o" red. Bun has no ImageData; floodFill only reads these three fields.
const HEX: Record<string, string> = { "#": "#000000", ".": "#ffffff", o: "#ff0000" };
const CHAR = Object.fromEntries(Object.entries(HEX).map(([c, h]) => [h, c]));
const draw = (rows: string[]) => {
  const [w, h] = [rows[0]!.length, rows.length],
    data = new Uint8ClampedArray(w * h * 4);
  [...rows.join("")].forEach((c, i) => data.set([...Buffer.from(HEX[c]!.slice(1), "hex"), 255], i * 4));
  return { width: w, height: h, data } as ImageData;
};
const read = (img: ImageData) =>
  Array.from({ length: img.height }, (_, y) =>
    Array.from({ length: img.width }, (_, x) => CHAR[toHex(img.data.subarray((y * img.width + x) * 4))]).join(""),
  );
const fill = (rows: string[], x: number, y: number) => {
  const img = draw(rows);
  floodFill(img, x, y, "#ff0000");
  return read(img);
};

test("fills the enclosed area and stops at the walls", () => {
  expect(fill(["#####", "#..##", "#.#.#", "#####"], 1, 1)).toEqual(["#####", "#oo##", "#o#.#", "#####"]);
});

// TODO(human)
