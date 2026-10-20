import { expect, test } from "bun:test";
import { INITIAL, press } from "./calculator";

const run = (keys: string) => keys.split(" ").reduce(press, INITIAL);

test("computes immediately, left to right, like XP", () => {
  expect(run("2 + 3 *").display).toBe("5");
  expect(run("2 + 3 * 4 =").display).toBe("20");
  expect(run("1 0 - 4 /").display).toBe("6");
});

test("repeated = repeats the last operation, also on a new entry", () => {
  expect(run("2 + 3 = =").display).toBe("8");
  expect(run("2 + 3 = 1 0 =").display).toBe("13");
  expect(run("4 * =").display).toBe("16");
});

test("errors use XP's messages and clear on the next number", () => {
  expect(run("5 / 0 =").display).toBe("Cannot divide by zero.");
  expect(run("0 recip").display).toBe("Cannot divide by zero.");
  expect(run("9 neg sqrt").display).toBe("Invalid input for function.");
  expect(run("5 / 0 = +").display).toBe("Cannot divide by zero.");
  expect(run("5 / 0 = 7").display).toBe("7");
});

test("percent, sign, backspace, CE and C", () => {
  expect(run("5 0 + 1 0 % =").display).toBe("55");
  expect(run("1 2 3 back back").display).toBe("1");
  expect(run("7 back").display).toBe("0");
  expect(run("2 + 3 = back").display).toBe("5"); // results are not editable
  expect(run("2 + 9 CE 3 =").display).toBe("5");
  expect(run("2 + 9 C").display).toBe("0");
  expect(run("4 neg").display).toBe("-4");
  expect(run("0 . 1 + 0 . 2 =").display).toBe("0.3");
});

test("memory keys survive C", () => {
  const s = run("8 MS C 2 M+ C MR");
  expect(s.display).toBe("10");
  expect(press(s, "MC").memory).toBe(0);
});
