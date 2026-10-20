import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BIN, DESKTOP, ROOT, SYSTEM, seed } from "./seed";
export { BIN, DESKTOP, DOCS, PICS, ROOT } from "./seed";

export interface FsNode {
  id: string;
  name: string;
  type: "folder" | "file";
  parentId: string | null;
  content: string;
  mtime: number;
  origParentId?: string; // only while the node sits in the Recycle Bin
}
export type Nodes = Record<string, FsNode>;

export const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};
export const childrenOf = (nodes: Nodes, parentId: string) =>
  Object.values(nodes).filter((n) => n.parentId === parentId);
// Windows file names are case-insensitive.
export const findChild = (nodes: Nodes, parentId: string, name: string) =>
  childrenOf(nodes, parentId).find((n) => n.name.toLowerCase() === name.toLowerCase());

/** True when `id` is `ancestorId` itself or lives somewhere below it. */
function isInside(nodes: Nodes, id: string, ancestorId: string): boolean {
  for (let n = nodes[id]; n; n = n.parentId ? nodes[n.parentId] : undefined) if (n.id === ancestorId) return true;
  return false;
}

export function pathOf(nodes: Nodes, id: string): string {
  const parts: string[] = [];
  for (let n = nodes[id]; n && n.id !== ROOT; n = n.parentId ? nodes[n.parentId] : undefined) parts.unshift(n.name);
  return "C:\\" + parts.join("\\");
}

/** Resolves DOS-style paths ("C:\a", "\a", "..\b", "a/b") against `cwd`. */
export function resolvePath(nodes: Nodes, path: string, cwd: string = ROOT): string | undefined {
  let id: string | undefined = /^(c:|[\\/])/i.test(path) ? ROOT : cwd;
  for (const part of path.replace(/^c:/i, "").split(/[\\/]+/)) {
    if (!part || part === ".") continue;
    // A file has no children, so a path that continues past one fails here naturally.
    id = part === ".." ? (nodes[id]?.parentId ?? id) : findChild(nodes, id, part)?.id;
    if (!id) return undefined;
  }
  return id;
}

/** XP-style free name in a folder: "New Folder" → "New Folder (2)", "a.txt" → "a (2).txt". */
export function uniqueName(nodes: Nodes, parentId: string, name: string): string {
  if (!findChild(nodes, parentId, name)) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 2; ; i++) if (!findChild(nodes, parentId, `${base} (${i})${ext}`)) return `${base} (${i})${ext}`;
}

function validate(name: string) {
  if (!name.trim()) throw new Error("You must type a file name.");
  if (/[\\/:*?"<>|]/.test(name))
    throw new Error('A file name cannot contain any of the following characters:\n\\ / : * ? " < > |');
}
function guard(nodes: Nodes, id: string, verb: string): FsNode {
  const n = nodes[id];
  if (!n) throw new Error(`Cannot ${verb}: The system cannot find the file specified.`);
  if (SYSTEM.has(id)) throw new Error(`Cannot ${verb} ${n.name}: Access is denied.`);
  return n;
}
function purge(nodes: Nodes, id: string) {
  // Collect first: deleting while walking would orphan children whose parent is already gone.
  Object.keys(nodes)
    .filter((k) => isInside(nodes, k, id))
    .forEach((k) => delete nodes[k]);
}

interface FsState {
  nodes: Nodes;
  create(parentId: string, name: string, type: FsNode["type"], content?: string): string;
  rename(id: string, name: string): void;
  move(ids: string[], parentId: string): void;
  copy(ids: string[], parentId: string): string[];
  remove(ids: string[], permanent?: boolean): void;
  restore(ids: string[]): void;
  emptyBin(): void;
  write(id: string, content: string): void;
}

export const useFs = create<FsState>()(
  persist(
    (set) => {
      // Every op works on a shallow copy, so a throw mid-loop leaves the store untouched.
      const update = (fn: (nodes: Nodes) => void) => {
        set((s) => {
          const nodes = { ...s.nodes };
          fn(nodes);
          return { nodes };
        });
      };
      return {
        nodes: seed(),
        create(parentId, name, type, content = "") {
          validate(name);
          const id = crypto.randomUUID();
          update((nodes) => {
            nodes[id] = {
              id,
              name: uniqueName(nodes, parentId, name.trim()),
              type,
              parentId,
              content,
              mtime: Date.now(),
            };
          });
          return id;
        },
        rename(id, name) {
          name = name.trim();
          update((nodes) => {
            const n = guard(nodes, id, "rename");
            if (name === n.name) return;
            validate(name);
            const dup = findChild(nodes, n.parentId ?? "", name);
            if (dup && dup.id !== id)
              throw new Error(
                `Cannot rename ${n.name}: A file with the name you specified already exists. Specify a different file name.`,
              );
            nodes[id] = { ...n, name, mtime: Date.now() };
          });
        },
        move: (ids, parentId) =>
          update((nodes) => {
            for (const id of ids) {
              const n = guard(nodes, id, "move");
              if (n.parentId === parentId) continue;
              if (isInside(nodes, parentId, id))
                throw new Error(`Cannot move ${n.name}: The destination folder is a subfolder of the source folder.`);
              nodes[id] = { ...n, parentId, name: uniqueName(nodes, parentId, n.name), origParentId: undefined };
            }
          }),
        copy(ids, parentId) {
          const out: string[] = [];
          update((nodes) => {
            const clone = (src: FsNode, to: string, name: string): string => {
              const id = crypto.randomUUID();
              nodes[id] = { ...src, id, parentId: to, name, mtime: Date.now(), origParentId: undefined };
              childrenOf(nodes, src.id).forEach((c) => clone(c, id, c.name));
              return id;
            };
            for (const id of ids) {
              const n = nodes[id];
              if (!n) continue;
              if (isInside(nodes, parentId, id))
                throw new Error(`Cannot copy ${n.name}: The destination folder is a subfolder of the source folder.`);
              const name = findChild(nodes, parentId, n.name) ? `Copy of ${n.name}` : n.name;
              out.push(clone(n, parentId, uniqueName(nodes, parentId, name)));
            }
          });
          return out;
        },
        remove: (ids, permanent = false) =>
          update((nodes) => {
            for (const id of ids) {
              const n = guard(nodes, id, "delete");
              // Deleting from the bin itself (or from Command Prompt) is permanent, like XP.
              if (permanent || n.parentId === BIN) purge(nodes, id);
              else nodes[id] = { ...n, parentId: BIN, origParentId: n.parentId ?? ROOT };
            }
          }),
        restore: (ids) =>
          update((nodes) => {
            for (const id of ids) {
              const n = nodes[id];
              if (n?.parentId !== BIN) continue;
              const o = n.origParentId ?? DESKTOP;
              const to = nodes[o] && !isInside(nodes, o, BIN) ? o : DESKTOP;
              nodes[id] = { ...n, parentId: to, name: uniqueName(nodes, to, n.name), origParentId: undefined };
            }
          }),
        emptyBin: () => update((nodes) => childrenOf(nodes, BIN).forEach((n) => purge(nodes, n.id))),
        write: (id, content) =>
          update((nodes) => {
            const n = nodes[id];
            if (n) nodes[id] = { ...n, content, mtime: Date.now() };
          }),
      };
    },
    {
      name: "xp-fs",
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => localStorage.getItem(k),
        // localStorage holds ~5 MB. A failed write keeps the change in memory and asks the shell to warn.
        setItem: (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            dispatchEvent(new Event("storage-full"));
          }
        },
        removeItem: (k) => localStorage.removeItem(k),
      })),
    },
  ),
);
