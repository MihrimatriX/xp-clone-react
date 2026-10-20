import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { msgBox } from "../shell/MessageBox";
import { previewSaver } from "../shell/ScreenSaver";
import { Icon, cls } from "../../lib/ui";
import { PICS, childrenOf, extOf, useFs } from "../../store/fs";
import { SAVERS, WALLPAPERS, useSettings, wallpaperStyle, type SettingsData } from "../../store/settings";
import { useWindows } from "../../store/windows";
import { appForExt, type AppProps } from "../../lib/registry";
import "../../styles/display-properties.css";

const KEYS = ["wallpaper", "wallpaperImage", "wallpaperPos", "bgColor", "saver", "saverWait"] as const;
type Draft = Pick<SettingsData, (typeof KEYS)[number]>;

/** Big photos are shrunk before they go into localStorage, which only holds ~5 MB. */
async function shrink(file: File) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode(); // rejects when the file isn't a picture
  const k = Math.min(1, 1920 / Math.max(img.width, img.height)),
    c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function DisplayProperties({ win }: AppProps) {
  const saved = useSettings(useShallow((s) => Object.fromEntries(KEYS.map((k) => [k, s[k]])) as Draft));
  const [draft, setDraft] = useState(saved);
  const [tab, setTab] = useState<"Desktop" | "Screen Saver">("Desktop");
  const upload = useRef<HTMLInputElement>(null);
  const pictures = useFs(
    useShallow((s) => childrenOf(s.nodes, PICS).filter((n) => appForExt(extOf(n.name))?.id === "mspaint")),
  );
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = KEYS.some((k) => draft[k] !== saved[k]);
  const apply = () => useSettings.getState().update(draft);
  const close = () => useWindows.getState().close(win.id);

  const names = [...Object.keys(WALLPAPERS), ...pictures.map((n) => n.name)];
  if (!names.includes(draft.wallpaper)) names.push(draft.wallpaper); // an uploaded file keeps its own entry
  const choose = (name: string) => {
    const pic = pictures.find((n) => n.name === name);
    set(pic ? { wallpaper: name, wallpaperImage: pic.content } : { wallpaper: name });
  };
  const browse = async (file: File | undefined) => {
    if (!file) return;
    try {
      set({ wallpaper: file.name, wallpaperImage: await shrink(file) });
    } catch {
      msgBox(`${file.name}\nThis file is not a picture Windows can display.`, {
        title: "Display Properties",
        kind: "error",
      });
    }
  };
  const scale = `${154 / innerWidth}, ${116 / innerHeight}`; // the 4:3 preview CRT shows the whole desktop, squeezed like XP does

  return (
    <div className="display-props">
      <menu role="tablist">
        {(["Desktop", "Screen Saver"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </menu>
      <article role="tabpanel">
        <div className="monitor">
          <div className="monitor-screen">
            {tab === "Desktop" || draft.saver === "(None)" ? (
              <div
                style={{
                  ...wallpaperStyle(draft),
                  width: innerWidth,
                  height: innerHeight,
                  transform: `scale(${scale})`,
                  transformOrigin: "0 0",
                }}
              />
            ) : (
              <div className={cls("mini-saver", draft.saver.toLowerCase())}>
                {draft.saver === "Marquee" && <span>XP Desktop</span>}
              </div>
            )}
          </div>
        </div>
        {tab === "Desktop" ? (
          <div className="dp-desktop">
            <label>Background:</label>
            <div className="dp-row">
              <ul className="dp-list" role="listbox" tabIndex={0}>
                {names.map((n) => (
                  <li
                    key={n}
                    role="option"
                    aria-selected={draft.wallpaper === n}
                    className={cls(draft.wallpaper === n && "selected")}
                    onClick={() => choose(n)}
                  >
                    <Icon name={n === "(None)" ? "stop" : WALLPAPERS[n] ? "display" : "file-img"} />
                    {n}
                  </li>
                ))}
              </ul>
              <div className="dp-side">
                <button onClick={() => upload.current?.click()}>Browse...</button>
                <input
                  ref={upload}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void browse(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <label>Position:</label>
                <select
                  value={draft.wallpaperPos}
                  onChange={(e) => set({ wallpaperPos: e.target.value as Draft["wallpaperPos"] })}
                >
                  <option value="center">Center</option>
                  <option value="tile">Tile</option>
                  <option value="stretch">Stretch</option>
                </select>
                <label>Color:</label>
                <input type="color" value={draft.bgColor} onChange={(e) => set({ bgColor: e.target.value })} />
              </div>
            </div>
          </div>
        ) : (
          <fieldset className="dp-saver">
            <legend>Screen saver</legend>
            <div className="field-row">
              <select value={draft.saver} onChange={(e) => set({ saver: e.target.value })}>
                {SAVERS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button disabled>Settings</button>
              <button disabled={draft.saver === "(None)"} onClick={() => previewSaver(draft.saver)}>
                Preview
              </button>
            </div>
            <div className="field-row">
              <label htmlFor="dp-wait">Wait:</label>
              <input
                id="dp-wait"
                type="number"
                min={1}
                max={60}
                value={draft.saverWait}
                onChange={(e) => set({ saverWait: Math.max(1, Math.min(60, +e.target.value || 1)) })}
              />
              <span>minutes</span>
            </div>
          </fieldset>
        )}
      </article>
      <div className="dialog-buttons dp-buttons">
        <button
          onClick={() => {
            apply();
            close();
          }}
        >
          OK
        </button>
        <button onClick={close}>Cancel</button>
        <button disabled={!dirty} onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}
