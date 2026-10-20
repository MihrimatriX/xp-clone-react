import { useCallback, useEffect, useRef, useState } from "react";
import { apps } from "../../lib/registry";
import { useSettings } from "../../store/settings";
import { activeId, useWindows } from "../../store/windows";
import { openMenu, useDismiss } from "./ContextMenu";
import { StartMenu } from "./StartMenu";
import { Icon, cls } from "../../lib/ui";
import { winMenu } from "./Window";

export function Taskbar() {
  const wins = useWindows((s) => s.wins);
  const active = activeId(wins);
  const [start, setStart] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const closeStart = useCallback(() => setStart(false), []);
  useDismiss(startRef, closeStart, start);
  useEffect(() => {
    // Ctrl+Esc opens Start (the OS may grab the real Windows key first).
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Escape") setStart((v) => !v);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const s = useWindows.getState();
  return (
    <footer className="taskbar">
      <div ref={startRef}>
        <button className={cls("start-button", start && "pressed")} onMouseDown={() => setStart((v) => !v)}>
          <Icon name="start" size={18} />
          <span>start</span>
        </button>
        {start && <StartMenu close={closeStart} />}
      </div>
      <div className="tasks">
        {wins.map((w) => (
          <button
            key={w.id}
            id={`task-${w.id}`}
            title={w.title}
            className={cls("task", w.id === active && "current")}
            onClick={() => (w.id === active ? s.minimize(w.id) : s.focus(w.id))}
            onContextMenu={(e) => openMenu(e.clientX, e.clientY, winMenu(w))}
          >
            <Icon name={w.icon ?? apps[w.appId]?.icon ?? "app"} />
            <span>{w.title}</span>
          </button>
        ))}
      </div>
      <Tray />
    </footer>
  );
}

function Tray() {
  const sound = useSettings((s) => s.sound);
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // Tick on the minute boundary so the clock flips together with the real one.
    let t = setTimeout(
      function tick() {
        setNow(new Date());
        t = setTimeout(tick, 60_000 - (Date.now() % 60_000));
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="tray">
      {/* XP hides inactive icons behind the chevron; "<" reveals them, ">" folds them away again. */}
      <button
        className={cls("tray-chevron", expanded && "open")}
        title={expanded ? "Hide" : "Show hidden icons"}
        onClick={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <span className="tray-icon" title="Windows Messenger - Not signed in">
          <Icon name="user" />
        </span>
      )}
      <span className="tray-icon" title="Safely Remove Hardware">
        <Icon name="hardware" />
      </span>
      <span className="tray-icon" title={"Windows Security Alerts\nYour computer might be at risk"}>
        <Icon name="shield" />
      </span>
      <span className="tray-icon" title={"Local Area Connection\nSpeed: 100.0 Mbps\nStatus: Connected"}>
        <Icon name="network" />
      </span>
      <button
        className="tray-icon"
        title={sound ? "Volume" : "Volume (muted)"}
        onClick={() => useSettings.getState().update({ sound: !sound })}
      >
        <Icon name={sound ? "volume" : "volume-mute"} />
      </button>
      <span
        className="clock"
        title={now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "2-digit", year: "numeric" })}
      >
        {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
