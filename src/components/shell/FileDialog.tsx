import { useState } from "react";
import { create } from "zustand";
import { DESKTOP, DOCS, ROOT, childrenOf, extOf, findChild, pathOf, resolvePath, useFs } from "../../store/fs";
import { MY_COMPUTER, attempt, iconFor, sortNodes } from "../../lib/files";
import { confirmBox, msgBox } from "./MessageBox";
import { Icon, cls } from "../../lib/ui";

export type Filter = { label: string; exts: string[] }; // empty exts = all files
interface Request {
  mode: "open" | "save";
  filters: Filter[];
  name?: string;
  folder?: string;
  resolve: (fileId: string | null) => void;
}

const useRequest = create<{ req: Request | null }>(() => ({ req: null }));
/** XP Open / Save As dialog. Resolves with the chosen file's id (Save As creates or reuses it), or null. */
export const fileDialog = (o: Omit<Request, "resolve">) =>
  new Promise<string | null>((resolve) => useRequest.setState({ req: { ...o, resolve } }));

const PLACES: [string, string, string][] = [
  ["Desktop", "folder", DESKTOP],
  ["My Documents", "documents", DOCS],
  ["My Computer", "computer", MY_COMPUTER],
];

export function FileDialogHost() {
  const req = useRequest((s) => s.req);
  return req && <Dialog req={req} />;
}

function Dialog({ req }: { req: Request }) {
  const nodes = useFs((s) => s.nodes);
  const [folder, setFolder] = useState(req.folder ?? DOCS);
  const [name, setName] = useState(req.name ?? "");
  const [filter, setFilter] = useState(0);
  const exts = req.filters[filter]?.exts ?? [];
  const items =
    folder === MY_COMPUTER
      ? [nodes[DOCS]!, nodes[ROOT]!]
      : sortNodes(
          childrenOf(nodes, folder).filter((n) => n.type === "folder" || !exts.length || exts.includes(extOf(n.name))),
          "name",
        );
  const chain: string[] = [];
  for (let id: string | null | undefined = folder; id && nodes[id]; id = nodes[id]?.parentId) chain.unshift(id);
  const done = (id: string | null) => {
    useRequest.setState({ req: null });
    req.resolve(id);
  };
  const title = req.mode === "open" ? "Open" : "Save As";

  const submit = async (typedName = name) => {
    const typed = typedName.trim();
    if (!typed) return;
    const hit = resolvePath(nodes, typed, folder === MY_COMPUTER ? ROOT : folder);
    // Typing a folder name opens it, like XP.
    if (hit && nodes[hit]?.type === "folder") {
      setFolder(hit);
      setName("");
      return;
    }
    if (req.mode === "open") {
      if (hit) done(hit);
      else
        msgBox(`${typed}\nFile not found.\nPlease verify the correct file name was given.`, { title, kind: "warning" });
      return;
    }
    if (folder === MY_COMPUTER) return;
    const file = extOf(typed) || !exts[0] ? typed : `${typed}.${exts[0]}`;
    const existing = findChild(nodes, folder, file);
    if (!existing) attempt(title, () => done(useFs.getState().create(folder, file, "file")));
    else if (await confirmBox(`${file} already exists.\nDo you want to replace it?`, title, "warning"))
      done(existing.id);
  };

  return (
    <div
      className="modal"
      onKeyDown={(e) => {
        if (e.key === "Escape") done(null);
      }}
    >
      <form
        className="window file-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="title-bar">
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button type="button" aria-label="Close" onClick={() => done(null)} />
          </div>
        </div>
        <div className="fd-top">
          <label>{req.mode === "open" ? "Look in:" : "Save in:"}</label>
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            {[
              ...chain.map((id) => [id, pathOf(nodes, id)]),
              ...PLACES.filter((p) => !chain.includes(p[2])).map((p) => [p[2], p[0]]),
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="tb"
            title="Up One Level"
            disabled={folder === MY_COMPUTER}
            onClick={() => setFolder(nodes[folder]?.parentId ?? MY_COMPUTER)}
          >
            <Icon name="up" size={20} />
          </button>
          <button
            type="button"
            className="tb"
            title="Create New Folder"
            disabled={folder === MY_COMPUTER}
            onClick={() => useFs.getState().create(folder, "New Folder", "folder")}
          >
            <Icon name="folder" size={20} />
          </button>
        </div>
        <div className="fd-main">
          <nav className="fd-places">
            {PLACES.map(([label, icon, id]) => (
              <button
                type="button"
                key={id}
                className={cls("flat", folder === id && "on")}
                onClick={() => setFolder(id)}
              >
                <Icon name={icon} size={32} />
                {label}
              </button>
            ))}
          </nav>
          <div className="fd-list">
            {items.map((n) => (
              <div
                key={n.id}
                className={cls("file", n.name === name && "selected")}
                onClick={() => n.type === "file" && setName(n.name)}
                // The clicks of a double-click have already put the name in the box.
                onDoubleClick={() => (n.type === "folder" ? setFolder(n.id) : submit(n.name))}
              >
                <Icon name={iconFor(n)} />
                <span className="label">{n.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fd-bottom">
          <label htmlFor="fd-name">File name:</label>
          <input id="fd-name" type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">{req.mode === "open" ? "Open" : "Save"}</button>
          <label htmlFor="fd-type">{req.mode === "open" ? "Files of type:" : "Save as type:"}</label>
          <select id="fd-type" value={filter} onChange={(e) => setFilter(+e.target.value)}>
            {req.filters.map((f, i) => (
              <option key={f.label} value={i}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => done(null)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
