import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useSettings } from "../../store/settings";

const usePreview = create<{ name: string | null }>(() => ({ name: null }));
export const previewSaver = (name: string) => usePreview.setState({ name });

export function ScreenSaver() {
  const { saver, wait } = useSettings(useShallow((s) => ({ saver: s.saver, wait: s.saverWait })));
  const preview = usePreview((s) => s.name);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (saver === "(None)") return;
    let t = setTimeout(() => setIdle(true), wait * 60_000);
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), wait * 60_000);
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel"] as const;
    events.forEach((e) => addEventListener(e, reset));
    return () => {
      clearTimeout(t);
      events.forEach((e) => removeEventListener(e, reset));
    };
  }, [saver, wait]);
  const exit = useCallback(() => {
    setIdle(false);
    usePreview.setState({ name: null });
  }, []);
  const name = preview ?? (idle ? saver : null);
  return name && name !== "(None)" ? <Saver name={name} exit={exit} /> : null;
}

function Saver({ name, exit }: { name: string; exit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [top] = useState(() => `${20 + Math.random() * 60}%`);
  useEffect(() => {
    // Real input ends it, not the jitter of a resting mouse or the click that started a preview.
    let origin: [number, number] | undefined;
    const move = (e: MouseEvent) => {
      origin ??= [e.clientX, e.clientY];
      if (Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) > 10) exit();
    };
    // Once aborted, the delayed addEventListener calls are no-ops, so the timer needs no clearing.
    const ac = new AbortController();
    setTimeout(() => {
      addEventListener("mousemove", move, { signal: ac.signal });
      addEventListener("mousedown", exit, { signal: ac.signal });
      addEventListener("keydown", exit, { signal: ac.signal });
    }, 400);
    return () => ac.abort();
  }, [exit]);
  useEffect(() => {
    if (name === "Starfield" && canvas.current) return starfield(canvas.current);
  }, [name]);
  return (
    <div className="saver">
      {name === "Starfield" && <canvas ref={canvas} />}
      {name === "Marquee" && (
        <span className="marquee" style={{ top }}>
          XP Desktop
        </span>
      )}
    </div>
  );
}

function starfield(c: HTMLCanvasElement) {
  const g = c.getContext("2d")!;
  const spawn = () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() });
  const stars = Array.from({ length: 450 }, spawn);
  let raf = 0;
  const frame = () => {
    if (c.width !== innerWidth || c.height !== innerHeight) {
      c.width = innerWidth;
      c.height = innerHeight;
    }
    const cx = c.width / 2,
      cy = c.height / 2;
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    for (const s of stars) {
      s.z -= 0.006;
      if (s.z <= 0.02) Object.assign(s, spawn(), { z: 1 });
      const size = (1 - s.z) * 3;
      g.fillStyle = `rgb(255 255 255 / ${1 - s.z})`;
      g.fillRect(cx + (s.x / s.z) * cx, cy + (s.y / s.z) * cy, size, size);
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => cancelAnimationFrame(raf);
}
