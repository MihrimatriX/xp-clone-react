import { useRef, useState } from "react";
import { BIN, DESKTOP, DOCS, ROOT, childrenOf, pathOf, resolvePath, useFs, type FsNode } from "../../store/fs";
import { useWindows } from "../../store/windows";
import { openMenuUnder, type MenuItem } from "../shell/ContextMenu";
import { MenuBar } from "../shell/MenuBar";
import { msgBox } from "../shell/MessageBox";
import {
  MY_COMPUTER,
  SORT_LABELS,
  dateOf,
  deleteNodes,
  emptyBin,
  iconFor,
  newItems,
  openNode,
  paste,
  sizeOf,
  sortNodes,
  typeOf,
  useClipboard,
  type SortKey,
} from "../../lib/files";
import { Icon } from "../../lib/ui";
import { useTitle } from "../shell/Window";
import type { AppProps } from "../../lib/registry";
import { FileView, VIEWS, type Sort, type View } from "./ExplorerFileView";
import { TaskPane, type Section } from "./ExplorerTaskPane";

// Folders XP shows by name rather than by path: id → [name, icon].
const SPECIAL: Record<string, [string, string]> = {
  [MY_COMPUTER]: ["My Computer", "computer"],
  [BIN]: ["Recycle Bin", "recycle-empty"],
  [DOCS]: ["My Documents", "documents"],
  [DESKTOP]: ["Desktop", "folder"],
};

export default function Explorer({ win }: AppProps) {
  const nodes = useFs((s) => s.nodes);
  const clipboard = useClipboard((s) => s.ids);
  const [nav, setNav] = useState({ back: [] as string[], loc: win.props.folderId ?? MY_COMPUTER, fwd: [] as string[] });
  const [view, setView] = useState<View>("icons");
  const [sort, setSort] = useState<Sort>({ key: "name", desc: false });
  const [sel, setSel] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const address = useRef<HTMLInputElement>(null);
  const { loc } = nav,
    here = nodes[loc];
  const binFull = childrenOf(nodes, BIN).length > 0;
  const nameOf = (id: string) => SPECIAL[id]?.[0] ?? nodes[id]?.name ?? "";
  const iconOf = (id: string) =>
    id === BIN && binFull ? "recycle-full" : (SPECIAL[id]?.[1] ?? (nodes[id] ? iconFor(nodes[id]) : "folder"));
  const title = nameOf(loc),
    titleIcon = iconOf(loc);
  useTitle(win.id, title, titleIcon);

  const items =
    loc === MY_COMPUTER ? [nodes[DOCS]!, nodes[ROOT]!] : sortNodes(childrenOf(nodes, loc), sort.key, sort.desc);
  const fsSel = sel.filter((id) => items.some((n) => n.id === id)); // a deleted item lingers in the bin, so check what is shown
  const one = fsSel.length === 1 ? nodes[fsSel[0]!] : undefined;
  const writable = loc !== BIN && !!here; // My Computer is virtual, so `here` is undefined there
  const parent = loc === MY_COMPUTER ? undefined : (here?.parentId ?? MY_COMPUTER);

  const go = (to: string) => {
    if (to !== loc) setNav((n) => ({ back: [...n.back, n.loc], loc: to, fwd: [] }));
    setSel([]);
  };
  const back = () =>
    setNav((n) => (n.back.length ? { back: n.back.slice(0, -1), loc: n.back.at(-1)!, fwd: [n.loc, ...n.fwd] } : n));
  const forward = () =>
    setNav((n) => (n.fwd.length ? { back: [...n.back, n.loc], loc: n.fwd[0]!, fwd: n.fwd.slice(1) } : n));
  const create = (name: string, type: FsNode["type"]) => {
    const id = useFs.getState().create(loc, name, type);
    setSel([id]);
    setRenaming(id);
  };
  const restore = () => useFs.getState().restore(fsSel.length ? fsSel : items.map((n) => n.id));
  const open = (n: FsNode) => {
    if (n.parentId === BIN)
      msgBox(
        `${n.name}\n\nType: ${typeOf(n)}\nOriginal location: ${pathOf(nodes, n.origParentId ?? "")}\nSize: ${sizeOf(n) || "—"}`,
        { title: `${n.name} Properties` },
      );
    else if (n.type === "folder") go(n.id);
    else openNode(n);
  };
  const navigate = (text: string) => {
    const t = text.trim(),
      special = Object.keys(SPECIAL).find((id) => nameOf(id).toLowerCase() === t.toLowerCase());
    const id = special ?? resolvePath(nodes, t),
      n = id ? nodes[id] : undefined;
    if (id && (special || n?.type === "folder")) go(id);
    else if (n) openNode(n);
    else msgBox(`Windows cannot find '${t}'. Check the spelling and try again.`, { title: t, kind: "error" });
  };

  const newMenu: MenuItem = { label: "New", disabled: !writable, items: newItems(create) };
  const viewItems: MenuItem[] = (Object.keys(VIEWS) as View[]).map((v) => ({
    label: VIEWS[v],
    checked: view === v && "radio",
    onClick: () => setView(v),
  }));
  const arrange: MenuItem = {
    label: "Arrange Icons by",
    items: (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
      label: SORT_LABELS[k],
      checked: sort.key === k && "radio",
      onClick: () => setSort({ key: k, desc: false }),
    })),
  };
  const menus: Record<string, MenuItem[]> = {
    File: [
      ...(loc === BIN
        ? [
            { label: "Empty Recycle Bin", disabled: !binFull, onClick: emptyBin },
            { label: "Restore", disabled: !fsSel.length, onClick: restore },
          ]
        : [newMenu, "-" as const, { label: "Rename", disabled: !one, onClick: () => setRenaming(one!.id) }]),
      { label: "Delete", disabled: !fsSel.length, onClick: () => deleteNodes(fsSel) },
      "-",
      { label: "Close", onClick: () => useWindows.getState().close(win.id) },
    ],
    Edit: [
      {
        label: "Cut",
        hint: "Ctrl+X",
        disabled: !fsSel.length || !writable,
        onClick: () => useClipboard.setState({ ids: fsSel, cut: true }),
      },
      {
        label: "Copy",
        hint: "Ctrl+C",
        disabled: !fsSel.length,
        onClick: () => useClipboard.setState({ ids: fsSel, cut: false }),
      },
      { label: "Paste", hint: "Ctrl+V", disabled: !clipboard.length || !writable, onClick: () => paste(loc) },
      "-",
      { label: "Select All", hint: "Ctrl+A", onClick: () => setSel(items.map((n) => n.id)) },
    ],
    View: [...viewItems, "-", arrange],
    Help: [
      {
        label: "About Windows",
        onClick: () => msgBox("XP Desktop clone\nBuilt with React, Bun and xp.css.", { title: "About Windows" }),
      },
    ],
  };

  const kind = one?.type === "folder" ? "folder" : "file";
  const tasks: Section =
    loc === BIN
      ? {
          title: "Recycle Bin Tasks",
          tasks: [
            { label: "Empty the Recycle Bin", icon: "recycle-empty", onClick: emptyBin },
            {
              label: fsSel.length
                ? fsSel.length > 1
                  ? "Restore the selected items"
                  : "Restore this item"
                : "Restore all items",
              icon: "recycle-full",
              onClick: restore,
            },
          ],
        }
      : {
          title: loc === MY_COMPUTER ? "System Tasks" : "File and Folder Tasks",
          tasks: !writable
            ? []
            : !fsSel.length
              ? [{ label: "Make a new folder", icon: "folder", onClick: () => create("New Folder", "folder") }]
              : [
                  ...(one
                    ? [{ label: `Rename this ${kind}`, icon: "file-txt", onClick: () => setRenaming(one.id) }]
                    : []),
                  {
                    label: one ? `Delete this ${kind}` : "Delete the selected items",
                    icon: "error",
                    onClick: () => deleteNodes(fsSel),
                  },
                ],
        };
  const places = [...new Set([parent, DESKTOP, DOCS, MY_COMPUTER])].filter((id): id is string => !!id && id !== loc);
  const shown = one ?? (fsSel.length ? undefined : here);
  const details =
    fsSel.length > 1 ? (
      <p>{fsSel.length} items selected.</p>
    ) : (
      shown && (
        <div className="task-details">
          <b>{nameOf(shown.id)}</b>
          <span>{typeOf(shown)}</span>
          {shown.type === "file" && <span>Size: {sizeOf(shown)}</span>}
          <span>Date Modified: {dateOf(shown.mtime)}</span>
        </div>
      )
    );

  return (
    <div
      className="explorer"
      onKeyDown={(e) => {
        if (e.key === "Backspace" && !(e.target instanceof HTMLInputElement) && parent) go(parent);
      }}
    >
      <MenuBar menus={menus} />
      <div className="toolbar">
        <button className="tb" disabled={!nav.back.length} onClick={back}>
          <Icon name="back" size={24} />
          Back
        </button>
        <button className="tb" disabled={!nav.fwd.length} onClick={forward}>
          <Icon name="forward" size={24} />
        </button>
        <button className="tb" disabled={!parent} onClick={() => parent && go(parent)} title="Up">
          <Icon name="up" size={24} />
        </button>
        <span className="tb-sep" />
        <button className="tb" title="Views" onClick={(e) => openMenuUnder(e, viewItems)}>
          <Icon name="views" size={24} />▾
        </button>
      </div>
      <form
        className="addressbar"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(address.current!.value);
        }}
      >
        <span>Address</span>
        <div className="address-field">
          <Icon name={titleIcon} />
          <input key={loc} ref={address} defaultValue={SPECIAL[loc]?.[0] ?? pathOf(nodes, loc)} spellCheck={false} />
        </div>
        <button type="submit">
          <Icon name="go" />
          Go
        </button>
      </form>
      <div className="explorer-main">
        <TaskPane
          sections={[
            tasks,
            {
              title: "Other Places",
              tasks: places.map((id) => ({ label: nameOf(id), icon: iconOf(id), onClick: () => go(id) })),
            },
            { title: "Details", body: details },
          ]}
        />
        <FileView
          items={items}
          view={view}
          folder={loc}
          sel={sel}
          setSel={setSel}
          renaming={renaming}
          setRenaming={setRenaming}
          sort={sort}
          setSort={setSort}
          onOpen={open}
          bgMenu={[
            { label: "View", items: viewItems },
            arrange,
            "-",
            { label: "Paste", disabled: !clipboard.length || !writable, onClick: () => paste(loc) },
            ...(writable ? ["-" as const, newMenu] : []),
          ]}
        />
      </div>
      <div className="status-bar">
        <p className="status-bar-field">
          {sel.length ? `${sel.length} object(s) selected` : `${items.length} object(s)`}
        </p>
      </div>
    </div>
  );
}
