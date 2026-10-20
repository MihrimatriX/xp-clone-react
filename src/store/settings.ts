import type { CSSProperties } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Display name → CSS background-image. Any other name shows `wallpaperImage` (an upload or a picture).
export const WALLPAPERS: Record<string, string> = {
  "(None)": "none",
  Bliss: "url(wallpapers/bliss)", // served by index.ts: your own copy if present, else a drawn look-alike
  Azul: "radial-gradient(ellipse at 50% 120%, #8fc3ff, #2d6fd6 45%, #0a2f86)",
  "Red Moon Desert": "linear-gradient(#26245e, #8b3a7a 45%, #f08a4b 75%, #ffd27a)",
  Follow: "radial-gradient(circle at 30% 30%, #8fb36a, #3f6b2a 60%, #1f3a14)",
  "Purple Flower": "radial-gradient(circle at 70% 40%, #f3c6ff, #a65bd1 30%, #4b1a6e 75%)",
};
export const SAVERS = ["(None)", "Blank", "Marquee", "Starfield"];

export interface MineSettings {
  w: number;
  h: number;
  mines: number;
  marks: boolean;
  records: Record<string, { time: number; name: string }>;
}

export interface SettingsData {
  userName: string;
  wallpaper: string;
  wallpaperImage: string; // data URL used when `wallpaper` is not a preset
  wallpaperPos: "center" | "tile" | "stretch";
  bgColor: string;
  saver: string;
  saverWait: number; // minutes
  sound: boolean;
  iconPos: Record<string, { x: number; y: number }>; // grid cells, keyed by icon id
  recent: string[]; // app ids, most recent first
  lastRun: string; // pre-filled in the Run dialog
  mines: MineSettings;
}

export const useSettings = create<SettingsData & { update(p: Partial<SettingsData>): void }>()(
  persist(
    (set) => ({
      userName: "User",
      wallpaper: "Bliss",
      wallpaperImage: "",
      wallpaperPos: "stretch",
      bgColor: "#3a6ea5",
      saver: "Starfield",
      saverWait: 10,
      sound: true,
      iconPos: {},
      recent: [],
      lastRun: "",
      mines: { w: 9, h: 9, mines: 10, marks: true, records: {} },
      // Braces: persist's set returns a promise.
      update: (p) => {
        set(p);
      },
    }),
    // persist's default shallow merge lets fields added later fall back to these defaults.
    { name: "xp-settings", version: 1 },
  ),
);

type Wallpaper = Pick<SettingsData, "wallpaper" | "wallpaperImage" | "wallpaperPos" | "bgColor">;
export function wallpaperStyle(s: Wallpaper): CSSProperties {
  return {
    backgroundColor: s.bgColor,
    backgroundImage: WALLPAPERS[s.wallpaper] ?? (s.wallpaperImage ? `url(${s.wallpaperImage})` : "none"),
    backgroundPosition: "center",
    backgroundRepeat: s.wallpaperPos === "tile" ? "repeat" : "no-repeat",
    backgroundSize: s.wallpaperPos === "stretch" ? "cover" : "auto", // cover: a 4:3 or 3:2 photo keeps its proportions on a wide screen
  };
}
