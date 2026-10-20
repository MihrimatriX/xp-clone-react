import { childrenOf, findChild, pathOf, resolvePath, useFs, type FsNode } from "../store/fs";

export const HOME_DIR = "user"; // C:\Documents and Settings\User, where XP's prompt starts
export const BANNER = ["Microsoft Windows XP [Version 5.1.2600]", "(C) Copyright 1985-2001 Microsoft Corp.", ""];
interface Result {
  out: string[];
  cwd?: string;
  clear?: boolean;
  exit?: boolean;
  start?: string; // `start x`: the UI opens it through the shell
  tryRun?: string; // unknown command: the UI tries it as a program or file name before giving up
}

const HELP: [string, string][] = [
  ["CD", "Displays the name of or changes the current directory."],
  ["CLS", "Clears the screen."],
  ["DATE", "Displays the date."],
  ["DEL", "Deletes one or more files."],
  ["DIR", "Displays a list of files and subdirectories in a directory."],
  ["ECHO", "Displays messages."],
  ["EXIT", "Quits the CMD.EXE program (command interpreter)."],
  ["HELP", "Provides Help information for Windows commands."],
  ["MD", "Creates a directory."],
  ["RD", "Removes a directory."],
  ["START", "Starts a separate window to run a specified program or command."],
  ["TIME", "Displays the system time."],
  ["TYPE", "Displays the contents of a text file."],
  ["VER", "Displays the Windows XP version."],
];
const NO_PATH = "The system cannot find the path specified.",
  NO_FILE = "The system cannot find the file specified.";
const fs = () => useFs.getState();
const two = (n: number) => String(n).padStart(2, "0");
const stamp = (t: number) => {
  const d = new Date(t),
    h = d.getHours();
  return `${two(d.getMonth() + 1)}/${two(d.getDate())}/${d.getFullYear()}  ${two(h % 12 || 12)}:${two(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
};
const num = (n: number) => n.toLocaleString("en-US");

/** XP's DIR listing of `folder`, or of just `only` when a file was named. */
function dir(folder: FsNode, only?: FsNode): string[] {
  const nodes = fs().nodes;
  const kids = only ? [only] : childrenOf(nodes, folder.id).sort((a, b) => a.name.localeCompare(b.name));
  const files = kids.filter((n) => n.type === "file"),
    bytes = files.reduce((s, n) => s + n.content.length, 0);
  const dots = !only && folder.parentId ? [".", ".."].map((name) => ({ ...folder, name })) : [];
  return [
    " Volume in drive C has no label.",
    " Volume Serial Number is 4C2F-1A07",
    "",
    ` Directory of ${pathOf(nodes, folder.id)}`,
    "",
    ...[...dots, ...kids].map((n) =>
      n.type === "folder"
        ? `${stamp(n.mtime)}    <DIR>          ${n.name}`
        : `${stamp(n.mtime)} ${num(n.content.length).padStart(17)} ${n.name}`,
    ),
    `${String(files.length).padStart(16)} File(s) ${num(bytes).padStart(14)} bytes`,
    `${String(dots.length + kids.length - files.length).padStart(16)} Dir(s)  ${num(4_000_000_000 - bytes).padStart(14)} bytes free`,
  ];
}

/** Runs one command line against the virtual disk. Pure apart from the file system store. */
export function exec(line: string, cwd: string): Result {
  const m = line.trim().match(/^([^\s\\/.]+)(.*)$/); // "cd.." and "cd\" work without a space, like DOS
  if (!m) return { out: [] };
  const cmd = m[1]!.toLowerCase(),
    raw = m[2]!.trim(),
    arg = raw.replace(/^"(.*)"$/, "$1");
  const nodes = fs().nodes,
    at = (p: string) => nodes[resolvePath(nodes, p, cwd) ?? ""];
  const attempt = (fn: () => void, error = "Access is denied."): string[] => {
    try {
      fn();
      return [];
    } catch {
      return [error];
    }
  };
  switch (cmd) {
    case "help":
      return { out: HELP.map(([c, d]) => c.padEnd(9) + d) };
    case "cls":
      return { out: [], clear: true };
    case "exit":
      return { out: [], exit: true };
    case "ver":
      return { out: ["", BANNER[0]!] };
    case "echo":
      return { out: [raw === "" ? "ECHO is on." : raw.replace(/^\./, "")] };
    case "date":
      return {
        out: [
          `The current date is: ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit", year: "numeric" }).replace(",", "")}`,
        ],
      };
    case "time":
      return {
        out: [
          `The current time is: ${new Date().toLocaleTimeString("en-GB")}.${two((new Date().getMilliseconds() / 10) | 0)}`,
        ],
      };
    case "start":
      return { out: [], start: arg };
    case "cd":
    case "chdir": {
      if (!arg) return { out: [pathOf(nodes, cwd)] };
      const n = at(arg);
      return n?.type === "folder" ? { out: [], cwd: n.id } : { out: [n ? "The directory name is invalid." : NO_PATH] };
    }
    case "dir": {
      const n = arg ? at(arg) : nodes[cwd];
      return { out: n?.type === "folder" ? dir(n) : n ? dir(nodes[n.parentId ?? ""]!, n) : ["File Not Found"] };
    }
    case "md":
    case "mkdir": {
      if (!arg) return { out: ["The syntax of the command is incorrect."] };
      const cut = arg.search(/[\\/][^\\/]*$/),
        parent = cut < 0 ? nodes[cwd] : at(arg.slice(0, cut) || "\\"),
        name = arg.slice(cut + 1);
      if (!parent || parent.type !== "folder") return { out: [NO_PATH] };
      if (findChild(nodes, parent.id, name)) return { out: [`A subdirectory or file ${arg} already exists.`] };
      const bad = "The filename, directory name, or volume label syntax is incorrect.";
      return { out: attempt(() => fs().create(parent.id, name, "folder"), bad) };
    }
    case "rd":
    case "rmdir": {
      const n = at(arg);
      if (!n) return { out: [NO_FILE] };
      if (n.type !== "folder") return { out: ["The directory name is invalid."] };
      if (childrenOf(nodes, n.id).length) return { out: ["The directory is not empty."] };
      return { out: attempt(() => fs().remove([n.id], true)) };
    }
    case "del":
    case "erase": {
      const n = at(arg);
      if (!n) return { out: [`Could Not Find ${pathOf(nodes, cwd).replace(/\\$/, "")}\\${arg}`] };
      return { out: n.type === "folder" ? ["Access is denied."] : attempt(() => fs().remove([n.id], true)) };
    }
    case "type": {
      const n = at(arg);
      return { out: !n ? [NO_FILE] : n.type === "folder" ? ["Access is denied."] : n.content.split("\n") };
    }
  }
  return {
    out: [
      `'${line.trim().split(/\s+/)[0]}' is not recognized as an internal or external command,`,
      "operable program or batch file.",
    ],
    tryRun: line.trim(),
  };
}
