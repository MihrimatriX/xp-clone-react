import { useCallback, useRef, useState } from "react";
import { MenuList, useDismiss, type MenuItem } from "./ContextMenu";
import { cls } from "../../lib/ui";

/** File/Edit/View… bar: click opens a menu, hovering switches between menus while one is open. */
export function MenuBar({ menus }: { menus: Record<string, MenuItem[]> }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(ref, close, open !== null);
  return (
    <div ref={ref} className="menubar">
      {Object.entries(menus).map(([title, items]) => (
        <div
          key={title}
          className={cls("menubar-item", open === title && "open")}
          onMouseDown={() => setOpen(open === title ? null : title)}
          onMouseEnter={() => open && setOpen(title)}
        >
          {title}
          {open === title && (
            <div onMouseDown={(e) => e.stopPropagation()}>
              <MenuList items={items} onPick={close} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
