import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { create } from "zustand";
import { Icon, cls } from "../../lib/ui";

export type MenuItem =
  | "-"
  | {
      label: string;
      onClick?: () => void;
      items?: MenuItem[];
      icon?: string;
      hint?: string; // shortcut text, e.g. "Ctrl+S"
      checked?: boolean | "radio";
      disabled?: boolean;
      bold?: boolean;
    };

/** Calls `close` on a mousedown outside `ref` or on Escape. Shared by menus, menu bars and the Start menu. */
export function useDismiss(ref: RefObject<HTMLElement | null>, close: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    addEventListener("mousedown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("mousedown", down);
      removeEventListener("keydown", key);
    };
  }, [ref, close, active]);
}

export function MenuList({
  items,
  onPick,
  nested,
  style,
}: {
  items: MenuItem[];
  onPick: () => void;
  nested?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(-1);
  const ref = useRef<HTMLUListElement>(null);
  // Keep menus on screen like XP: submenus flip to the left, top-level menus slide back in.
  useLayoutEffect(() => {
    const el = ref.current!,
      r = el.getBoundingClientRect();
    if (r.right > innerWidth)
      el.style.left = nested ? `${3 - r.width}px` : `${el.offsetLeft - (r.right - innerWidth)}px`;
    if (r.bottom > innerHeight) el.style.top = `${el.offsetTop - (r.bottom - innerHeight)}px`;
  }, [nested]);
  return (
    <ul ref={ref} className="menu" style={style}>
      {items.map((it, i) =>
        it === "-" ? (
          <li key={i} className="sep" />
        ) : (
          <li
            key={i}
            className={cls(
              it.disabled && "disabled",
              it.bold && "bold",
              it.items && "has-sub",
              it.items && open === i && "open",
            )}
            onMouseEnter={() => setOpen(i)}
            onClick={(e) => {
              e.stopPropagation();
              if (!it.disabled && !it.items) {
                onPick();
                it.onClick?.();
              }
            }}
          >
            <span className="mark">
              {it.checked === "radio" ? "●" : it.checked ? "✔" : it.icon && <Icon name={it.icon} />}
            </span>
            <span className="label">{it.label}</span>
            {it.hint && <span className="hint">{it.hint}</span>}
            {it.items && open === i && (
              <MenuList
                items={it.items.length ? it.items : [{ label: "(Empty)", disabled: true }]}
                onPick={onPick}
                nested
              />
            )}
          </li>
        ),
      )}
    </ul>
  );
}

const useMenu = create<{ menu: { x: number; y: number; items: MenuItem[] } | null }>(() => ({ menu: null }));
export const openMenu = (x: number, y: number, items: MenuItem[]) => useMenu.setState({ menu: { x, y, items } });
/** Drops a menu down from the clicked button (toolbar menus, the window icon). */
export function openMenuUnder(e: { currentTarget: Element }, items: MenuItem[], gap = 0) {
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.left, r.bottom + gap, items);
}
const closeMenu = () => useMenu.setState({ menu: null });

export function ContextMenuHost() {
  const menu = useMenu((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, closeMenu, !!menu);
  return (
    menu && (
      <div ref={ref}>
        <MenuList
          key={`${menu.x}:${menu.y}`}
          items={menu.items}
          onPick={closeMenu}
          style={{ position: "fixed", left: menu.x, top: menu.y }}
        />
      </div>
    )
  );
}
