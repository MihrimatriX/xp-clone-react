import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Rnd } from "react-rnd";
import { apps } from "../../lib/registry";
import { setCloseGuard, useWindows, type Win } from "../../store/windows";
import { openMenuUnder, type MenuItem } from "./ContextMenu";
import { Icon, cls } from "../../lib/ui";

/** System menu (title bar icon) and taskbar button menu. */
export function winMenu(w: Win): MenuItem[] {
  const s = useWindows.getState();
  const resizable = apps[w.appId]?.resizable !== false;
  return [
    {
      label: "Restore",
      disabled: w.state === "normal",
      onClick: () => (w.state === "min" ? s.focus(w.id) : s.show(w.id, "normal")),
    },
    { label: "Minimize", disabled: w.state === "min", onClick: () => s.minimize(w.id) },
    { label: "Maximize", disabled: w.state === "max" || !resizable, onClick: () => s.show(w.id, "max") },
    "-",
    { label: "Close", hint: "Alt+F4", bold: true, onClick: () => s.requestClose(w.id) },
  ];
}

/** Lets an app veto closing (e.g. "Do you want to save the changes?"). */
export function useCloseGuard(winId: string, guard: () => Promise<boolean>) {
  // No deps: re-registering every render keeps the guard's closure fresh, and a Map set is free.
  useEffect(() => {
    setCloseGuard(winId, guard);
    return () => setCloseGuard(winId);
  });
}

/** Shows the app's document name in the title bar and on the taskbar button. */
export function useTitle(winId: string, title: string, icon?: string) {
  useEffect(() => {
    useWindows.getState().setTitle(winId, title, icon);
  }, [winId, title, icon]);
}

/** Sizes the window around its content, for XP's fixed-layout apps (Calculator, Minesweeper). */
export function useFitWindow(win: Win, ref: RefObject<HTMLElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const el = ref.current,
      frame = el?.closest<HTMLElement>(".window"),
      area = el?.parentElement;
    if (!el || !frame || !area) return;
    const w = el.scrollWidth + frame.offsetWidth - area.clientWidth,
      h = el.scrollHeight + frame.offsetHeight - area.clientHeight;
    const now = useWindows.getState().wins.find((x) => x.id === win.id);
    if (now && (now.w !== w || now.h !== h)) useWindows.getState().resize(win.id, w, h, now.x, now.y);
  }, [win.id, ref, key]);
}

// memo: patching one window keeps the other Win objects identical, so they skip rendering.
export const Window = memo(function Window({ win, active }: { win: Win; active: boolean }) {
  const [resizing, setResizing] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  // Keys go to the active window, as in XP, even after a click on its title bar or border.
  const claimFocus = () => {
    const content = frame.current?.querySelector<HTMLElement>(".window-content");
    if (!content || content.contains(document.activeElement)) return;
    for (const sel of ["textarea", "[tabindex]", "input"]) {
      const el = content.querySelector<HTMLElement>(sel);
      if (el) return el.focus();
    }
  };
  useEffect(() => {
    if (active) claimFocus();
  }, [active]);
  const app = apps[win.appId];
  if (!app) return null;
  const s = useWindows.getState();
  const max = win.state === "max",
    min = win.state === "min";
  const resizable = app.resizable !== false;
  const Body = app.component;
  // Minimizing scales the window into its taskbar button, so the button is the transform origin.
  const btn = min ? document.getElementById(`task-${win.id}`)?.getBoundingClientRect() : undefined;
  const origin = btn && `${btn.left + btn.width / 2 - (max ? 0 : win.x)}px ${btn.top - (max ? 0 : win.y)}px`;
  return (
    <Rnd
      className={cls("win-frame", min && "min", resizing && "resizing")}
      style={{ zIndex: win.z }}
      position={max ? { x: 0, y: 0 } : { x: win.x, y: win.y }}
      size={max ? { width: "100%", height: "100%" } : { width: win.w, height: win.h }}
      minWidth={resizable ? 220 : undefined}
      minHeight={resizable ? 110 : undefined}
      dragHandleClassName="title-bar"
      cancel=".title-bar-controls,.title-bar-icon"
      disableDragging={max}
      enableResizing={resizable && !max}
      onMouseDown={() => s.focus(win.id)}
      onDragStop={(_e, d) => s.move(win.id, d.x, d.y)}
      onResizeStart={() => setResizing(true)}
      onResizeStop={(_e, _dir, el, _delta, pos) => {
        setResizing(false);
        s.resize(win.id, el.offsetWidth, el.offsetHeight, pos.x, pos.y);
      }}
    >
      <div
        ref={frame}
        className={cls("window", !active && "inactive", max && "max")}
        style={{ transformOrigin: origin }}
        onMouseUp={claimFocus}
      >
        <div className="title-bar" onDoubleClick={() => resizable && s.toggleMax(win.id)}>
          <div className="title-bar-text">
            <span
              className="title-bar-icon"
              onClick={(e) => openMenuUnder(e, winMenu(win), 4)}
              onDoubleClick={() => s.requestClose(win.id)}
            >
              <Icon name={win.icon ?? app.icon} />
            </span>
            {win.title}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" onClick={() => s.minimize(win.id)} />
            <button
              aria-label={max ? "Restore" : "Maximize"}
              disabled={!resizable}
              onClick={() => s.toggleMax(win.id)}
            />
            <button aria-label="Close" onClick={() => s.requestClose(win.id)} />
          </div>
        </div>
        <div className="window-content">
          <Body win={win} />
        </div>
      </div>
    </Rnd>
  );
});
