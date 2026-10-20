import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { apps } from "../../lib/registry";
import { DOCS, PICS } from "../../store/fs";
import { useSettings } from "../../store/settings";
import { useWindows, type WinProps } from "../../store/windows";
import { MenuList, type MenuItem } from "./ContextMenu";
import { MY_COMPUTER } from "../../lib/files";
import { openEndDialog } from "./Session";
import { Icon, cls } from "../../lib/ui";

type Entry = { label: string; icon: string; app: string; props?: WinProps; sub?: string; bold?: boolean };

const PINNED: Entry = { label: "Internet", sub: "Internet Explorer", icon: "globe", app: "iexplore", bold: true };
const DEFAULT_FREQUENT = ["notepad", "calc", "mspaint", "winmine", "cmd"];
const folder = (label: string, icon: string, folderId: string): Entry => ({
  label,
  icon,
  app: "explorer",
  props: { folderId },
  bold: true,
});
const PLACES: (Entry | "-")[] = [
  folder("My Documents", "documents", DOCS),
  folder("My Pictures", "folder-pics", PICS),
  folder("My Music", "folder-music", "music"),
  folder("My Computer", "computer", MY_COMPUTER),
  "-",
  { label: "Control Panel", icon: "control", app: "control" },
  "-",
  { label: "Run...", icon: "run", app: "run" },
];
const PROGRAMS: (string | { group: string; apps: string[] })[] = [
  { group: "Accessories", apps: ["calc", "cmd", "notepad", "mspaint"] },
  { group: "Games", apps: ["winmine"] },
  "iexplore",
];

export function StartMenu({ close }: { close: () => void }) {
  const { userName, recent, update } = useSettings(
    useShallow((s) => ({ userName: s.userName, recent: s.recent, update: s.update })),
  );
  const [allPrograms, setAllPrograms] = useState(false);
  const launch = (app: string, props?: WinProps, program = false) => {
    close();
    useWindows.getState().open(app, props);
    // The left column lists the programs used most recently, like XP's frequent list.
    if (program) update({ recent: [app, ...recent.filter((a) => a !== app)].slice(0, 6) });
  };
  const end = (dialog: "logoff" | "shutdown") => {
    close();
    openEndDialog(dialog);
  };
  const program = (id: string): MenuItem => ({
    label: apps[id]!.title,
    icon: apps[id]!.icon,
    onClick: () => launch(id, undefined, true),
  });
  const programs = PROGRAMS.map((p): MenuItem =>
    typeof p === "string" ? program(p) : { label: p.group, icon: "folder", items: p.apps.map(program) },
  );
  // Recently used programs first; the defaults fill any gaps so the column never looks empty.
  const frequent = [...new Set([...recent, ...DEFAULT_FREQUENT])]
    .filter((id) => apps[id] && id !== PINNED.app)
    .slice(0, 6);
  const row = (e: Entry, size: number, isProgram = false) => (
    <li key={e.label} className={cls("start-item", e.bold && "bold")} onClick={() => launch(e.app, e.props, isProgram)}>
      <Icon name={e.icon} size={size} />
      <span>
        {e.label}
        {e.sub && <small>{e.sub}</small>}
      </span>
    </li>
  );
  return (
    <div className="start-menu">
      <header>
        <Icon name="user" size={54} />
        <b>{userName}</b>
      </header>
      <div className="start-body">
        <ul className="start-left">
          {row(PINNED, 32, true)}
          <li className="sep" />
          {frequent.map((id) => row({ label: apps[id]!.title, icon: apps[id]!.icon, app: id }, 32, true))}
          <li className="grow" />
          <li
            className={cls("all-programs", allPrograms && "open")}
            onMouseEnter={() => setAllPrograms(true)}
            onMouseLeave={() => setAllPrograms(false)}
          >
            <b>All Programs</b>
            <span className="go-arrow" />
            {allPrograms && <MenuList items={programs} onPick={close} nested />}
          </li>
        </ul>
        <ul className="start-right">
          {PLACES.map((e, i) => (e === "-" ? <li key={i} className="sep" /> : row(e, 24)))}
        </ul>
      </div>
      <footer>
        <button onClick={() => end("logoff")}>
          <Icon name="logoff" size={24} />
          Log Off
        </button>
        <button onClick={() => end("shutdown")}>
          <Icon name="shutdown" size={24} />
          Turn Off Computer
        </button>
      </footer>
    </div>
  );
}
