import type { DragEvent, KeyboardEvent } from "react";
import { create } from "zustand";
import { appForExt, apps } from "./registry";
import { BIN, ROOT, childrenOf, extOf, resolvePath, useFs, type FsNode } from "../store/fs";
import { FOLDER_ICONS } from "../store/seed";
import { useWindows, type WinProps } from "../store/windows";
import type { MenuItem } from "../components/shell/ContextMenu";
import { confirmBox, msgBox } from "../components/shell/MessageBox";

export const MY_COMPUTER = "mycomputer"; // virtual folder: Explorer lists the drives here
const fs = () => useFs.getState();
const open = (appId: string, props?: WinProps) => useWindows.getState().open(appId, props);

const TYPES: Record<string, string> = {
  txt: "Text Document",
  log: "Text Document",
  ini: "Configuration Settings",
  bat: "MS-DOS Batch File",
  png: "PNG Image",
  jpg: "JPEG Image",
  jpeg: "JPEG Image",
  bmp: "Bitmap Image",
  gif: "GIF Image",
};
export function iconFor(n: FsNode) {
  const app = n.type === "file" && appForExt(extOf(n.name))?.id;
  return (
    FOLDER_ICONS[n.id] ??
    (n.type === "folder" ? "folder" : app === "notepad" ? "file-txt" : app === "mspaint" ? "file-img" : "file")
  );
}
export function typeOf(n: FsNode) {
  const ext = extOf(n.name);
  return n.id === ROOT
    ? "Local Disk"
    : n.parentId === null
      ? "System Folder"
      : n.type === "folder"
        ? "File Folder"
        : (TYPES[ext] ?? (ext ? `${ext.toUpperCase()} File` : "File"));
}
export const sizeOf = (n: FsNode) => (n.type === "file" ? `${Math.ceil(n.content.length / 1024)} KB` : "");
export const dateOf = (t: number) =>
  new Date(t).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }).replace(",", "");

export const newItems = (create: (name: string, type: FsNode["type"]) => void): MenuItem[] => [
  { label: "Folder", icon: "folder", onClick: () => create("New Folder", "folder") },
  "-",
  { label: "Text Document", icon: "file-txt", onClick: () => create("New Text Document.txt", "file") },
];

export type SortKey = "name" | "size" | "type" | "modified";
export const SORT_LABELS: Record<SortKey, string> = { name: "Name", size: "Size", type: "Type", modified: "Modified" };
const collator = new Intl.Collator(undefined, { numeric: true });
export function sortNodes(list: FsNode[], key: SortKey, desc = false) {
  // Sizes and times are whole numbers, which the numeric collator already orders by value.
  const by = (n: FsNode) =>
    String(key === "size" ? n.content.length : key === "modified" ? n.mtime : key === "type" ? typeOf(n) : n.name);
  // Folders always stay on top, whatever the order.
  return [...list].sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "folder" ? -1 : 1) || collator.compare(by(a), by(b)) * (desc ? -1 : 1),
  );
}

export const openFolder = (folderId: string) => open("explorer", { folderId });
export function openNode(n: FsNode) {
  if (n.type === "folder") return openFolder(n.id);
  const app = appForExt(extOf(n.name));
  if (app) open(app.id, { fileId: n.id });
  else
    msgBox(
      `Windows cannot open this file:\n\nFile: ${n.name}\n\nTo open this file, Windows needs to know what program created it.`,
      { kind: "warning" },
    );
}

/** Opens an app name, URL or path — what Start > Run and `start` in Command Prompt accept. */
export function run(command: string) {
  const c = command.trim(),
    id = c.toLowerCase();
  const node = fs().nodes[resolvePath(fs().nodes, c) ?? ""];
  if (apps[id]) open(id);
  else if (/^(https?:\/\/|www\.)/i.test(c) && apps.iexplore) open("iexplore", { url: c });
  else if (node) openNode(node);
  else return false;
  return true;
}
/** Run dialog flavor: shows XP's "cannot find" error on failure. */
export async function runOrComplain(command: string) {
  const c = command.trim();
  if (run(c)) return true;
  await msgBox(`Windows cannot find '${c}'. Make sure you typed the name correctly, and then try again.`, {
    title: c,
    kind: "error",
  });
  return false;
}

export const useClipboard = create<{ ids: string[]; cut: boolean }>(() => ({ ids: [], cut: false }));

export async function attempt(title: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    await msgBox(e instanceof Error ? e.message : String(e), { title, kind: "error" });
  }
}
export const renameNode = (id: string, name: string) =>
  attempt("Error Renaming File or Folder", () => fs().rename(id, name));
export const moveNodes = (ids: string[], to: string) =>
  attempt("Error Moving File or Folder", () => (to === BIN ? fs().remove(ids) : fs().move(ids, to)));
export function paste(to: string) {
  const { ids, cut } = useClipboard.getState();
  if (!ids.length) return;
  attempt(cut ? "Error Moving File or Folder" : "Error Copying File or Folder", () => {
    if (!cut) return void fs().copy(ids, to);
    fs().move(ids, to);
    useClipboard.setState({ ids: [] });
  });
}
export async function deleteNodes(ids: string[]) {
  const first = fs().nodes[ids[0] ?? ""];
  if (!first) return;
  const many = ids.length > 1,
    folder = !many && first.type === "folder";
  const what = many ? `these ${ids.length} items` : `'${first.name}'`;
  const text =
    first.parentId === BIN
      ? `Are you sure you want to delete ${what}?`
      : folder
        ? `Are you sure you want to remove the folder '${first.name}' and move all its contents to the Recycle Bin?`
        : `Are you sure you want to send ${what} to the Recycle Bin?`;
  const title = many ? "Confirm Multiple File Delete" : folder ? "Confirm Folder Delete" : "Confirm File Delete";
  if (await confirmBox(text, title)) attempt("Error Deleting File or Folder", () => fs().remove(ids));
}
export async function emptyBin() {
  const n = childrenOf(fs().nodes, BIN).length;
  const what = n === 1 ? "this item" : `these ${n} items`;
  if (n && (await confirmBox(`Are you sure you want to delete ${what}?`, "Confirm Multiple File Delete")))
    fs().emptyBin();
}

/** Right-click menu for files and folders, shared by the desktop and Explorer. */
export function nodeMenu(n: FsNode, sel: string[], rename: () => void): MenuItem[] {
  if (n.parentId === BIN)
    return [
      { label: "Restore", bold: true, onClick: () => fs().restore(sel) },
      "-",
      { label: "Delete", onClick: () => deleteNodes(sel) },
    ];
  return [
    {
      label: "Open",
      bold: true,
      onClick: () => sel.map((id) => fs().nodes[id]).forEach((x) => x && openNode(x)),
    },
    "-",
    { label: "Cut", onClick: () => useClipboard.setState({ ids: sel, cut: true }) },
    { label: "Copy", onClick: () => useClipboard.setState({ ids: sel, cut: false }) },
    ...(n.type === "folder"
      ? [{ label: "Paste", disabled: !useClipboard.getState().ids.length, onClick: () => paste(n.id) }]
      : []),
    "-",
    { label: "Delete", onClick: () => deleteNodes(sel) },
    { label: "Rename", disabled: sel.length > 1, onClick: rename },
  ];
}

/** Keys shared by the desktop and Explorer views. `sel` holds file system ids only. */
export function fileKeys(
  e: KeyboardEvent,
  sel: string[],
  folder: string,
  h: { open(): void; rename(id: string): void; selectAll(): void },
) {
  const k = e.key.toLowerCase();
  if (k === "enter") h.open();
  else if (k === "delete") deleteNodes(sel);
  else if (k === "f2" && sel[0]) h.rename(sel[0]);
  else if (e.ctrlKey && k === "a") h.selectAll();
  else if (e.ctrlKey && (k === "c" || k === "x")) useClipboard.setState({ ids: sel, cut: k === "x" });
  else if (e.ctrlKey && k === "v") paste(folder);
  else return;
  e.preventDefault();
}

// Every window lives in one document, so the dragged ids can sit in a module variable.
let drag = { ids: [] as string[], grab: "" };
export const getDrag = () => drag;
export function startDrag(e: DragEvent, ids: string[], grab: string) {
  drag = { ids, grab };
  e.dataTransfer.setData("text/plain", grab); // Firefox only starts a drag that carries data
  e.dataTransfer.effectAllowed = "move";
}
export const endDrag = () => {
  drag = { ids: [], grab: "" };
};
/** Handlers that let an icon accept dropped items (folders, the Recycle Bin). */
export const dropInto = (folderId: string, selfId = folderId) => ({
  onDragOver(e: DragEvent) {
    if (drag.ids.length && !drag.ids.includes(selfId)) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = drag.ids.filter((id) => fs().nodes[id]);
    moveNodes(ids, folderId);
    endDrag();
  },
});
