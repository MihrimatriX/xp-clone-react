import { beforeEach, expect, test } from "bun:test";
import { DESKTOP, DOCS, ROOT, findChild, useFs } from "../store/fs";
import { HOME_DIR, exec } from "./cmd";

const initial = useFs.getState().nodes;
beforeEach(() => useFs.setState({ nodes: initial }));

test("cd moves around and reports errors like XP", () => {
  expect(exec("cd Desktop", HOME_DIR).cwd).toBe(DESKTOP);
  expect(exec("cd..", DESKTOP).cwd).toBe(HOME_DIR);
  expect(exec("cd \\", DESKTOP).cwd).toBe(ROOT);
  expect(exec('cd "My Documents"', HOME_DIR).cwd).toBe(DOCS);
  expect(exec("cd nowhere", HOME_DIR).out).toEqual(["The system cannot find the path specified."]);
  expect(exec("cd", DESKTOP).out).toEqual(["C:\\Documents and Settings\\User\\Desktop"]);
});

test("dir lists folders and files with an XP summary", () => {
  const out = exec("dir", DOCS).out;
  expect(out).toContain(" Directory of C:\\Documents and Settings\\User\\My Documents");
  expect(out.some((l) => l.includes("<DIR>") && l.endsWith("My Pictures"))).toBe(true);
  expect(out.some((l) => l.endsWith(" notes.txt"))).toBe(true);
  expect(out.at(-2)).toMatch(/1 File\(s\)/);
  expect(out.filter((l) => / <DIR> +\.\.?$/.test(l))).toHaveLength(2); // "." and ".."
  expect(exec("dir nope", DOCS).out).toEqual(["File Not Found"]);
});

test("md, rd, del and type work on the virtual disk", () => {
  expect(exec("md Work", DESKTOP).out).toEqual([]);
  const work = findChild(useFs.getState().nodes, DESKTOP, "work")!;
  expect(exec("md work", DESKTOP).out[0]).toBe("A subdirectory or file work already exists.");
  useFs.getState().create(work.id, "a.txt", "file", "hello\nworld");
  expect(exec("type work\\a.txt", DESKTOP).out).toEqual(["hello", "world"]);
  expect(exec("rd work", DESKTOP).out).toEqual(["The directory is not empty."]);
  expect(exec("del work\\a.txt", DESKTOP).out).toEqual([]);
  expect(exec("rd work", DESKTOP).out).toEqual([]);
  expect(useFs.getState().nodes[work.id]).toBeUndefined(); // permanent, not in the Recycle Bin
  expect(exec("del ghost.txt", DESKTOP).out[0]).toBe(
    "Could Not Find C:\\Documents and Settings\\User\\Desktop\\ghost.txt",
  );
  expect(exec("rd \\WINDOWS", DESKTOP).out).toEqual(["The directory is not empty."]);
});

test("echo, unknown commands and start", () => {
  expect(exec("echo hi there", ROOT).out).toEqual(["hi there"]);
  expect(exec("echo", ROOT).out).toEqual(["ECHO is on."]);
  expect(exec("echo.", ROOT).out).toEqual([""]);
  const r = exec("frobnicate now", ROOT);
  expect(r.out[0]).toBe("'frobnicate' is not recognized as an internal or external command,");
  expect(r.tryRun).toBe("frobnicate now");
  expect(exec("start notepad", ROOT).start).toBe("notepad");
});
