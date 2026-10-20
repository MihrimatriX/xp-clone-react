import { useState, useSyncExternalStore, type DragEvent, type MouseEvent } from "react";
import { apps } from "../../lib/registry";
import { BIN, DESKTOP, DOCS, childrenOf, useFs, type FsNode } from "../../store/fs";
import { useSettings } from "../../store/settings";
import { TASKBAR_H, useWindows } from "../../store/windows";
import { openMenu, type MenuItem } from "./ContextMenu";
import {
  MY_COMPUTER,
  SORT_LABELS,
  dropInto,
  emptyBin,
  endDrag,
  fileKeys,
  getDrag,
  iconFor,
  moveNodes,
  newItems,
  nodeMenu,
  openFolder,
  openNode,
  paste,
  sortNodes,
  startDrag,
  useClipboard,
  type SortKey,
} from "../../lib/files";
import { cellKey, layout, nearestFree, type Cell } from "../../lib/grid";
import { RenameBox } from "./RenameBox";
import { Icon, cls } from "../../lib/ui";

const CELL = 75; // square grid cells, px

const NONE: string[] = [];
const onResize = (cb: () => void) => {
  addEventListener("resize", cb);
  return () => removeEventListener("resize", cb);
};

interface Item {
  id: string;
  label: string;
  icon: string;
  node?: FsNode;
  folder?: string;
  app?: string;
}
// XP's own desktop icons; everything after them is the Desktop folder on disk.
const systemItems = (binFull: boolean): Item[] => [
  { id: "sys:docs", label: "My Documents", icon: "documents", folder: DOCS },
  { id: "sys:computer", label: "My Computer", icon: "computer", folder: MY_COMPUTER },
  { id: "sys:bin", label: "Recycle Bin", icon: binFull ? "recycle-full" : "recycle-empty", folder: BIN },
  { id: "sys:ie", label: "Internet Explorer", icon: "globe", app: "iexplore" },
];

export function Desktop() {
  const nodes = useFs((s) => s.nodes);
  const iconPos = useSettings((s) => s.iconPos);
  const cut = useClipboard((s) => (s.cut ? s.ids : NONE));
  const rows = useSyncExternalStore(onResize, () => Math.max(1, Math.floor((innerHeight - TASKBAR_H) / CELL)));
  const [sel, setSel] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [band, setBand] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const binFull = childrenOf(nodes, BIN).length > 0;
  const items = [
    ...systemItems(binFull),
    ...childrenOf(nodes, DESKTOP).map((n): Item => ({
      id: n.id,
      label: n.name,
      icon: iconFor(n),
      node: n,
      folder: n.type === "folder" ? n.id : undefined,
    })),
  ];
  const ids = items.map((i) => i.id);
  const cells = layout(ids, iconPos, rows);
  const fsSel = sel.filter((id) => nodes[id]?.parentId === DESKTOP);
  const clampCell = (x: number, y: number): Cell => ({ x: Math.max(0, x), y: Math.min(rows - 1, Math.max(0, y)) });
  const cellAt = (x: number, y: number) => clampCell(Math.floor(x / CELL), Math.floor(y / CELL));
  const savePos = (pos: Record<string, Cell>) =>
    useSettings.getState().update({ iconPos: { ...useSettings.getState().iconPos, ...pos } });

  const open = (it: Item) => {
    if (it.node) openNode(it.node);
    else if (it.folder) openFolder(it.folder);
    else if (it.app && apps[it.app]) useWindows.getState().open(it.app);
  };
  const createAt = (at: Cell, name: string, type: FsNode["type"]) => {
    const id = useFs.getState().create(DESKTOP, name, type);
    savePos({ [id]: nearestFree(at, new Set(Object.values(cells).map(cellKey)), rows) });
    setSel([id]);
    setRenaming(id);
  };
  const arrange = (by: SortKey) => {
    const order = [
      ...items.filter((i) => !i.node).map((i) => i.id),
      ...sortNodes(childrenOf(nodes, DESKTOP), by).map((n) => n.id),
    ];
    savePos(Object.fromEntries(order.map((id, i) => [id, { x: Math.floor(i / rows), y: i % rows }])));
  };
  const deskMenu = (at: Cell): MenuItem[] => [
    {
      label: "Arrange Icons By",
      items: (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ label: SORT_LABELS[k], onClick: () => arrange(k) })),
    },
    // Refresh pins every icon where it is and forgets positions of deleted ones.
    { label: "Refresh", onClick: () => useSettings.getState().update({ iconPos: cells }) },
    "-",
    { label: "Paste", disabled: !useClipboard.getState().ids.length, onClick: () => paste(DESKTOP) },
    "-",
    { label: "New", items: newItems((name, type) => createAt(at, name, type)) },
    "-",
    { label: "Properties", disabled: !apps.display, onClick: () => useWindows.getState().open("display") },
  ];
  const itemMenu = (it: Item, s: string[]): MenuItem[] => {
    const fsIds = s.filter((id) => nodes[id]);
    if (it.node) return nodeMenu(it.node, fsIds, () => setRenaming(it.id));
    const empty: MenuItem[] = ["-", { label: "Empty Recycle Bin", disabled: !binFull, onClick: emptyBin }];
    return [{ label: "Open", bold: true, onClick: () => open(it) }, ...(it.folder === BIN ? empty : [])];
  };

  const startBand = (e: MouseEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    const x0 = e.clientX,
      y0 = e.clientY,
      base = e.ctrlKey ? sel : [];
    setSel(base);
    const move = (m: globalThis.MouseEvent) => {
      const l = Math.min(x0, m.clientX),
        t = Math.min(y0, m.clientY),
        r = Math.max(x0, m.clientX),
        b = Math.max(y0, m.clientY);
      setBand({ left: l, top: t, width: r - l, height: b - t });
      // Hit when the band touches the icon's picture or label, not the empty corners of its cell.
      const hit = items.filter((it) => {
        const c = cells[it.id]!,
          cl = c.x * CELL + 12,
          ct = c.y * CELL + 2;
        return cl < r && cl + CELL - 24 > l && ct < b && ct + CELL - 8 > t;
      });
      setSel([...base, ...hit.map((it) => it.id)]);
    };
    const up = () => {
      setBand(null);
      removeEventListener("mousemove", move);
      removeEventListener("mouseup", up);
    };
    addEventListener("mousemove", move);
    addEventListener("mouseup", up);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    const { ids: dragged, grab } = getDrag();
    endDrag();
    const incoming = dragged.filter((id) => nodes[id] && nodes[id].parentId !== DESKTOP);
    if (incoming.length) moveNodes(incoming, DESKTOP); // dragged in from Explorer
    const target = cellAt(e.clientX, e.clientY),
      origin = cells[grab] ?? target;
    const moving = dragged.filter((id) => cells[id] || incoming.includes(id));
    const taken = new Set(ids.filter((id) => !moving.includes(id)).map((id) => cellKey(cells[id]!)));
    const pos: Record<string, Cell> = {};
    for (const id of moving) {
      const from = cells[id] ?? origin;
      pos[id] = nearestFree(clampCell(from.x + target.x - origin.x, from.y + target.y - origin.y), taken, rows);
      taken.add(cellKey(pos[id]!));
    }
    savePos(pos);
  };

  return (
    <div
      className="desk"
      tabIndex={-1}
      onMouseDown={startBand}
      onDrop={drop}
      onDragOver={(e) => {
        if (getDrag().ids.length) e.preventDefault();
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          setSel([]);
          openMenu(e.clientX, e.clientY, deskMenu(cellAt(e.clientX, e.clientY)));
        }
      }}
      onKeyDown={(e) =>
        fileKeys(e, fsSel, DESKTOP, {
          open: () => items.filter((i) => sel.includes(i.id)).forEach(open),
          rename: setRenaming,
          selectAll: () => setSel(ids),
        })
      }
    >
      {items.map((it) => {
        const c = cells[it.id]!,
          selected = sel.includes(it.id);
        return (
          <div
            key={it.id}
            className={cls("desk-icon", selected && "selected", cut.includes(it.id) && "cut")}
            style={{ left: c.x * CELL, top: c.y * CELL }}
            draggable={renaming !== it.id}
            onMouseDown={(e) => {
              if (e.ctrlKey) setSel(selected ? sel.filter((x) => x !== it.id) : [...sel, it.id]);
              else if (!selected) setSel([it.id]);
            }}
            onClick={(e) => {
              if (!e.ctrlKey) setSel([it.id]);
            }}
            onDoubleClick={() => open(it)}
            onContextMenu={(e) => {
              const s = selected ? sel : [it.id];
              setSel(s);
              openMenu(e.clientX, e.clientY, itemMenu(it, s));
            }}
            onDragStart={(e) => startDrag(e, selected ? sel : [it.id], it.id)}
            onDragEnd={endDrag}
            {...(it.folder && it.folder !== MY_COMPUTER ? dropInto(it.folder, it.id) : {})}
          >
            <Icon name={it.icon} size={32} />
            {renaming === it.id && it.node ? (
              <RenameBox node={it.node} done={() => setRenaming(null)} />
            ) : (
              <span className="label">{it.label}</span>
            )}
          </div>
        );
      })}
      {band && <div className="select-band" style={band} />}
    </div>
  );
}
