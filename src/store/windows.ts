import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apps } from "../lib/registry";

type WinState = "normal" | "min" | "max";
export type Phase = "boot" | "login" | "desktop" | "logoff" | "shutdown" | "restart" | "standby" | "off";
export interface WinProps {
  fileId?: string;
  folderId?: string;
  url?: string;
}
export interface Win {
  id: string;
  appId: string;
  title: string;
  icon?: string; // icon overrides the app default (Explorer shows the folder's)
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  state: WinState;
  prev: WinState; // what restoring from the taskbar returns to
  props: WinProps;
}

export const TASKBAR_H = 30;
const CASCADE = 24,
  KEEP_VISIBLE = 40;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const topZ = (wins: Win[]) => Math.max(0, ...wins.map((w) => w.z)) + 1;

/** The focused window: highest z among the ones not minimized. */
export const activeId = (wins: Win[]) =>
  wins.reduce<Win | undefined>((top, w) => (w.state !== "min" && (!top || w.z > top.z) ? w : top), undefined)?.id;

// Apps with unsaved work register a guard; resolving false keeps the window open.
const guards = new Map<string, () => Promise<boolean>>();
export const setCloseGuard = (id: string, guard?: () => Promise<boolean>) => {
  if (guard) guards.set(id, guard);
  else guards.delete(id);
};

interface WinStore {
  wins: Win[];
  phase: Phase;
  setPhase(phase: Phase): void;
  open(appId: string, props?: WinProps): string;
  requestClose(id: string): Promise<void>;
  close(id: string): void;
  show(id: string, state: WinState): void;
  focus(id: string): void;
  minimize(id: string): void;
  toggleMax(id: string): void;
  move(id: string, x: number, y: number): void;
  resize(id: string, w: number, h: number, x: number, y: number): void;
  setTitle(id: string, title: string, icon?: string): void;
  closeAll(): void;
}

export const useWindows = create<WinStore>()(
  persist(
    (set, get) => {
      const find = (id: string) => get().wins.find((w) => w.id === id);
      // Braces matter: persist's set returns a promise, which would leak out of actions used inside effects.
      const patch = (id: string, p: Partial<Win>) => {
        set((s) => ({ wins: s.wins.map((w) => (w.id === id ? { ...w, ...p } : w)) }));
      };
      return {
        wins: [],
        phase: "boot",
        setPhase: (phase) => {
          set({ phase });
        },
        open(appId, props = {}) {
          const app = apps[appId];
          if (!app) throw new Error(`Unknown app: ${appId}`);
          const { wins } = get();
          const single = app.singleInstance && wins.find((w) => w.appId === appId);
          if (single) {
            get().focus(single.id);
            return single.id;
          }
          const [W, H] = [innerWidth, innerHeight - TASKBAR_H];
          const [w, h] = [Math.min(app.defaultSize.w, W), Math.min(app.defaultSize.h, H)];
          const last = wins.at(-1);
          let [x, y] = last ? [last.x + CASCADE, last.y + CASCADE] : [40, 30];
          if (x + w > W || y + h > H) x = y = CASCADE; // XP wraps the cascade back to the top-left
          const id = crypto.randomUUID();
          set({
            wins: [
              ...wins,
              { id, appId, title: app.title, x, y, w, h, z: topZ(wins), state: "normal", prev: "normal", props },
            ],
          });
          return id;
        },
        async requestClose(id) {
          const guard = guards.get(id);
          if (!guard || (await guard())) get().close(id);
        },
        close(id) {
          guards.delete(id);
          set((s) => ({ wins: s.wins.filter((w) => w.id !== id) }));
        },
        // Every state change funnels through here so `prev` and z-order stay consistent.
        show(id, state) {
          const w = find(id);
          if (!w) return;
          if (state === "min") patch(id, { state, prev: w.state === "min" ? w.prev : w.state });
          // Clicking a window that is already on top changes nothing; skipping the patch skips a re-render and a storage write.
          else if (w.state !== state || w.z < topZ(get().wins) - 1) patch(id, { state, z: topZ(get().wins) });
        },
        focus(id) {
          const w = find(id);
          if (w) get().show(id, w.state === "min" ? w.prev : w.state);
        },
        minimize: (id) => get().show(id, "min"),
        toggleMax(id) {
          const w = find(id);
          if (w) get().show(id, w.state === "max" ? "normal" : "max");
        },
        move(id, x, y) {
          const w = find(id);
          if (w)
            patch(id, {
              x: clamp(x, KEEP_VISIBLE - w.w, innerWidth - KEEP_VISIBLE),
              y: clamp(y, 0, innerHeight - TASKBAR_H - KEEP_VISIBLE / 2),
            });
        },
        resize: (id, w, h, x, y) => patch(id, { w, h, x, y }),
        setTitle: (id, title, icon) => patch(id, { title, icon }),
        closeAll() {
          guards.clear();
          set({ wins: [] });
        },
      };
    },
    {
      // Windows live for the login session only; Log Off / Restart clears them.
      name: "xp-windows",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
