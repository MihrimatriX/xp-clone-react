import { beforeEach, expect, test } from "bun:test";
import { BIN, DESKTOP, DOCS, PICS, ROOT, childrenOf, findChild, pathOf, resolvePath, uniqueName, useFs } from "./fs";

const initial = useFs.getState().nodes;
const fs = () => useFs.getState();
const names = (parentId: string) =>
  childrenOf(fs().nodes, parentId)
    .map((n) => n.name)
    .sort();
beforeEach(() => useFs.setState({ nodes: initial }));

test("uniqueName numbers like XP and ignores case", () => {
  const n = fs().nodes;
  expect(uniqueName(n, DESKTOP, "New Folder")).toBe("New Folder");
  expect(uniqueName(n, DESKTOP, "read me.TXT")).toBe("read me (2).TXT");
  fs().create(DESKTOP, "New Folder", "folder");
  fs().create(DESKTOP, "New Folder", "folder");
  expect(names(DESKTOP)).toContain("New Folder (2)");
  expect(uniqueName(fs().nodes, DESKTOP, "New Folder")).toBe("New Folder (3)");
});

test("rename validates characters, duplicates and system folders", () => {
  const id = fs().create(DESKTOP, "a.txt", "file");
  expect(() => fs().rename(id, "b?.txt")).toThrow("cannot contain");
  expect(() => fs().rename(id, "  ")).toThrow("You must type a file name.");
  expect(() => fs().rename(id, "READ ME.txt")).toThrow("already exists");
  expect(() => fs().rename(DOCS, "x")).toThrow("Access is denied");
  fs().rename(id, " b.txt ");
  expect(fs().nodes[id]?.name).toBe("b.txt");
});

test("move rejects a folder's own subfolder and renames on collision", () => {
  const a = fs().create(DESKTOP, "A", "folder");
  const b = fs().create(a, "B", "folder");
  expect(() => fs().move([a], b)).toThrow("subfolder");
  const note = fs().create(DOCS, "Read Me.txt", "file");
  fs().move([note], DESKTOP);
  expect(fs().nodes[note]?.name).toBe("Read Me (2).txt");
});

test("copy is deep and names same-folder copies 'Copy of'", () => {
  const a = fs().create(DESKTOP, "A", "folder");
  fs().create(a, "x.txt", "file", "hi");
  const [copy] = fs().copy([a], DESKTOP);
  expect(fs().nodes[copy!]?.name).toBe("Copy of A");
  expect(findChild(fs().nodes, copy!, "x.txt")?.content).toBe("hi");
  expect(() => fs().copy([a], a)).toThrow("subfolder");
});

test("delete goes to the bin, restore returns it, deleting from the bin is permanent", () => {
  const a = fs().create(PICS, "A", "folder");
  const inner = fs().create(a, "x.txt", "file");
  fs().remove([a]);
  expect(fs().nodes[a]?.parentId).toBe(BIN);
  fs().restore([a]);
  expect(fs().nodes[a]?.parentId).toBe(PICS);
  fs().remove([a]);
  fs().remove([a]);
  expect(fs().nodes[a]).toBeUndefined();
  expect(fs().nodes[inner]).toBeUndefined();
});

test("restore falls back to the Desktop when the original folder is gone", () => {
  const dir = fs().create(DOCS, "Dir", "folder");
  const f = fs().create(dir, "f.txt", "file");
  fs().remove([f]);
  fs().remove([dir]);
  fs().emptyBin();
  expect(fs().nodes[f]).toBeUndefined();
  const g = fs().create(dir, "g.txt", "file"); // orphan whose parent no longer exists
  useFs.setState((s) => ({ nodes: { ...s.nodes, [g]: { ...s.nodes[g]!, parentId: BIN, origParentId: dir } } }));
  fs().restore([g]);
  expect(fs().nodes[g]?.parentId).toBe(DESKTOP);
});

test("paths resolve like DOS", () => {
  const n = fs().nodes;
  expect(pathOf(n, DESKTOP)).toBe("C:\\Documents and Settings\\User\\Desktop");
  expect(pathOf(n, ROOT)).toBe("C:\\");
  expect(resolvePath(n, "C:\\documents and settings\\USER\\desktop")).toBe(DESKTOP);
  expect(resolvePath(n, "..\\My Documents\\My Pictures", DESKTOP)).toBe(PICS);
  expect(resolvePath(n, "\\", DESKTOP)).toBe(ROOT);
  expect(resolvePath(n, "..", ROOT)).toBe(ROOT);
  expect(resolvePath(n, "Read Me.txt\\x", DESKTOP)).toBeUndefined();
  expect(resolvePath(n, "nope", DESKTOP)).toBeUndefined();
});
