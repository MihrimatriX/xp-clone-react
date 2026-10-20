import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { ContextMenuHost } from "./components/shell/ContextMenu";
import { Desktop } from "./components/shell/Desktop";
import { FileDialogHost } from "./components/shell/FileDialog";
import { MessageBoxHost, msgBox } from "./components/shell/MessageBox";
import { ScreenSaver } from "./components/shell/ScreenSaver";
import { EndDialogHost, SessionScreen, useDimmed } from "./components/shell/Session";
import { Taskbar } from "./components/shell/Taskbar";
import { cls } from "./lib/ui";
import { Window } from "./components/shell/Window";
import { useSettings, wallpaperStyle } from "./store/settings";
import { activeId, useWindows } from "./store/windows";

// Its own component, so moving or focusing a window doesn't re-render the desktop and taskbar.
function WindowLayer() {
  const wins = useWindows((s) => s.wins),
    active = activeId(wins);
  return (
    <div className="window-layer">
      {wins.map((w) => (
        <Window key={w.id} win={w} active={w.id === active} />
      ))}
    </div>
  );
}

export function App() {
  const phase = useWindows((s) => s.phase);
  const wallpaper = useSettings(useShallow(wallpaperStyle));
  const dimmed = useDimmed();
  useEffect(() => {
    // Alt+F4 closes the active window, as far as the browser lets the key through.
    const key = (e: KeyboardEvent) => {
      const active = activeId(useWindows.getState().wins);
      if (e.altKey && e.key === "F4" && active) {
        e.preventDefault();
        useWindows.getState().requestClose(active);
      }
    };
    // Every later write fails too, so warn once (`once` drops the listener) instead of on each change.
    const full = () =>
      msgBox(
        "There is not enough space on Local Disk (C:).\n\nThe browser's storage is full, so recent changes will be lost on reload. Delete some files, especially pictures, to free up space.",
        { title: "Low Disk Space", kind: "warning" },
      );
    const ac = new AbortController();
    addEventListener("keydown", key, { signal: ac.signal });
    addEventListener("storage-full", full, { signal: ac.signal, once: true });
    return () => ac.abort();
  }, []);

  return (
    <>
      {phase !== "desktop" ? (
        <SessionScreen phase={phase} />
      ) : (
        <main
          className={cls("screen", dimmed && "dimmed")}
          style={wallpaper}
          onContextMenu={(e) => {
            if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault();
          }}
        >
          <Desktop />
          <WindowLayer />
          <Taskbar />
          <ContextMenuHost />
          <FileDialogHost />
          <MessageBoxHost />
          <ScreenSaver />
        </main>
      )}
      <EndDialogHost />
    </>
  );
}
