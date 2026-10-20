import type { Nodes } from "./fs";

// Initial disk content. The shell resolves these folders by id, so they stay fixed.
export const ROOT = "c",
  BIN = "bin",
  DESKTOP = "desktop",
  DOCS = "docs",
  PICS = "pics";
// XP refuses to delete/rename/move these with "Access is denied".
export const SYSTEM = new Set([ROOT, BIN, "dset", "user", DESKTOP, DOCS]);

// id, name, parentId, content — a row without content is a folder.
const SEED: [string, string, string | null, string?][] = [
  [ROOT, "Local Disk (C:)", null],
  [BIN, "Recycle Bin", null],
  ["dset", "Documents and Settings", ROOT],
  ["user", "User", "dset"],
  [DESKTOP, "Desktop", "user"],
  [DOCS, "My Documents", "user"],
  [PICS, "My Pictures", DOCS],
  ["music", "My Music", DOCS],
  ["prog", "Program Files", ROOT],
  ["ie", "Internet Explorer", "prog"],
  ["win", "WINDOWS", ROOT],
  [
    "readme",
    "Read Me.txt",
    DESKTOP,
    "Welcome to the XP desktop clone!\n\n- Double-click an icon to open it.\n- Right-click the desktop for more options.\n- Everything you create is saved in this browser.",
  ],
  [
    "notes",
    "notes.txt",
    DOCS,
    "Things to try:\n* Minesweeper on Expert\n* Paint a picture and save it to My Pictures\n* Type 'help' in Command Prompt",
  ],
  [
    "bootini",
    "boot.ini",
    ROOT,
    '[boot loader]\ntimeout=30\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\WINDOWS\n[operating systems]\nmulti(0)disk(0)rdisk(0)partition(1)\\WINDOWS="XP Desktop" /fastdetect',
  ],
  ["winini", "win.ini", "win", "; for 16-bit app support\n[fonts]\n[extensions]\n[mci extensions]\n[files]"],
];
export const seed = (): Nodes =>
  Object.fromEntries(
    SEED.map(([id, name, parentId, content]) => [
      id,
      {
        id,
        name,
        parentId,
        type: content === undefined ? "folder" : "file",
        content: content ?? "",
        mtime: Date.now(),
      },
    ]),
  );
// Special folders get their own icons in Explorer and on the desktop.
export const FOLDER_ICONS: Record<string, string> = {
  [ROOT]: "drive",
  [DOCS]: "documents",
  [PICS]: "folder-pics",
  music: "folder-music",
};
