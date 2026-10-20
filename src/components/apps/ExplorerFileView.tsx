import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { BIN, pathOf, useFs, type FsNode } from "../../store/fs";
import { openMenu, type MenuItem } from "../shell/ContextMenu";
import {
  dateOf,
  dropInto,
  endDrag,
  fileKeys,
  iconFor,
  nodeMenu,
  sizeOf,
  startDrag,
  typeOf,
  useClipboard,
  type SortKey,
} from "../../lib/files";
import { RenameBox } from "../shell/RenameBox";
import { Icon, cls } from "../../lib/ui";

export type View = "icons" | "list" | "details";
export const VIEWS: Record<View, string> = { icons: "Icons", list: "List", details: "Details" };
export type Sort = { key: SortKey; desc: boolean };
const NONE: string[] = [];

interface Props {
  items: FsNode[];
  view: View;
  folder: string;
  sel: string[];
  setSel: (ids: string[]) => void;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  onOpen: (n: FsNode) => void;
  bgMenu: MenuItem[];
}

export function FileView(p: Props) {
  const nodes = useFs((s) => s.nodes);
  const cut = useClipboard((s) => (s.cut ? s.ids : NONE));
  const inBin = p.folder === BIN;
  const select = (e: MouseEvent, id: string) => {
    if (e.button !== 0 && p.sel.includes(id)) return;
    if (e.ctrlKey) p.setSel(p.sel.includes(id) ? p.sel.filter((x) => x !== id) : [...p.sel, id]);
    else if (e.shiftKey && p.sel[0]) {
      // Keep the anchor first so the next shift-click ranges from the same place.
      const ids = p.items.map((n) => n.id),
        a = ids.indexOf(p.sel[0]),
        b = ids.indexOf(id);
      p.setSel(a < 0 ? [id] : a <= b ? ids.slice(a, b + 1) : ids.slice(b, a + 1).reverse());
    } else if (!p.sel.includes(id) || e.button !== 0) p.setSel([id]);
  };
  const item = (n: FsNode) => ({
    className: cls("file", p.sel.includes(n.id) && "selected", cut.includes(n.id) && "cut"),
    draggable: p.renaming !== n.id,
    onMouseDown: (e: MouseEvent) => select(e, n.id),
    onClick: (e: MouseEvent) => {
      if (!e.ctrlKey && !e.shiftKey) p.setSel([n.id]);
    },
    onDoubleClick: () => p.onOpen(n),
    onContextMenu: (e: MouseEvent) => {
      e.stopPropagation();
      const s = p.sel.includes(n.id) ? p.sel : [n.id];
      p.setSel(s);
      const menu = nodeMenu(n, s, () => p.setRenaming(n.id));
      openMenu(e.clientX, e.clientY, menu);
    },
    onDragStart: (e: DragEvent) => startDrag(e, p.sel.includes(n.id) ? p.sel : [n.id], n.id),
    onDragEnd: endDrag,
    ...(n.type === "folder" && !inBin ? dropInto(n.id) : {}),
  });
  const label = (n: FsNode) =>
    p.renaming === n.id ? (
      <RenameBox node={n} done={() => p.setRenaming(null)} />
    ) : (
      <span className="label">{n.name}</span>
    );
  const live = p.sel.filter((id) => nodes[id]);
  const bg = {
    tabIndex: 0,
    onMouseDown: (e: MouseEvent) => {
      if (e.target === e.currentTarget) p.setSel([]);
    },
    onContextMenu: (e: MouseEvent) => {
      p.setSel([]);
      openMenu(e.clientX, e.clientY, p.bgMenu);
    },
    onKeyDown: (e: KeyboardEvent) =>
      fileKeys(e, live, p.folder, {
        open: () => p.items.filter((n) => p.sel.includes(n.id)).forEach(p.onOpen),
        rename: p.setRenaming,
        selectAll: () => p.setSel(p.items.map((n) => n.id)),
      }),
    ...(nodes[p.folder] ? dropInto(p.folder, "") : {}), // My Computer is virtual: nothing drops there
  };

  if (p.view !== "details")
    return (
      <div className={`files ${p.view}`} {...bg}>
        {p.items.map((n) => (
          <div key={n.id} {...item(n)}>
            <Icon name={iconFor(n)} size={p.view === "icons" ? 32 : 16} />
            {label(n)}
          </div>
        ))}
      </div>
    );
  const cols = (
    [
      ["Name", "name", (n) => n.name],
      ["Original Location", null, (n) => pathOf(nodes, n.origParentId ?? "")],
      ["Size", "size", sizeOf],
      ["Type", "type", typeOf],
      ["Date Modified", "modified", (n) => dateOf(n.mtime)],
    ] as [string, SortKey | null, (n: FsNode) => string][]
  ).filter(([title]) => title !== (inBin ? "Date Modified" : "Original Location"));
  return (
    <div className="files details" {...bg}>
      <table>
        <thead>
          <tr>
            {cols.map(([title, key]) => (
              <th key={title} onClick={() => key && p.setSort({ key, desc: p.sort.key === key && !p.sort.desc })}>
                {title}
                {p.sort.key === key && (p.sort.desc ? " ▾" : " ▴")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.items.map((n) => (
            <tr key={n.id} {...item(n)}>
              {cols.map(([title, , get], i) => (
                <td key={title}>
                  {i === 0 ? (
                    <>
                      <Icon name={iconFor(n)} />
                      {label(n)}
                    </>
                  ) : (
                    get(n)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
