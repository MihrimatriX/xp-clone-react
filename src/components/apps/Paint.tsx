import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { MenuItem } from "../shell/ContextMenu";
import { fileDialog, type Filter } from "../shell/FileDialog";
import { MenuBar } from "../shell/MenuBar";
import { askSave, formBox, msgBox } from "../shell/MessageBox";
import { Icon, cls } from "../../lib/ui";
import { useCloseGuard, useTitle } from "../shell/Window";
import { PICS, useFs } from "../../store/fs";
import { useWindows } from "../../store/windows";
import type { AppProps } from "../../lib/registry";
import { floodFill, line, shape, spray, toHex, type Tool } from "../../lib/paint";
import "../../styles/paint.css";

// XP Paint's default 28-colour palette: top row, then bottom row.
const PALETTE = (
  "#000000 #808080 #800000 #808000 #008000 #008080 #000080 #800080 #808040 #004040 #0080ff #004080 #8000ff #804000 " +
  "#ffffff #c0c0c0 #ff0000 #ffff00 #00ff00 #00ffff #0000ff #ff00ff #ffff80 #00ff80 #80ffff #8080ff #ff0080 #ff8040"
).split(" ");
const TOOLS: [Tool, string][] = [
  ["eraser", "Eraser/Color Eraser"],
  ["fill", "Fill With Color"],
  ["pick", "Pick Color"],
  ["pencil", "Pencil"],
  ["brush", "Brush"],
  ["airbrush", "Airbrush"],
  ["text", "Text"],
  ["line", "Line"],
  ["rect", "Rectangle"],
  ["ellipse", "Ellipse"],
];
const SIZES: Partial<Record<Tool, number[]>> = {
  brush: [2, 4, 7],
  airbrush: [6, 10, 16],
  eraser: [4, 6, 8, 10],
  line: [1, 2, 3, 4, 5],
};
const SHAPES: Tool[] = ["line", "rect", "ellipse"];
const FILTERS: Filter[] = [
  { label: "PNG (*.PNG)", exts: ["png"] },
  { label: "All Picture Files", exts: ["png", "jpg", "jpeg", "bmp", "gif"] },
];
const fs = () => useFs.getState();

export default function Paint({ win }: AppProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [beforePick, setBeforePick] = useState<Tool>("pencil");
  const [colors, setColors] = useState<[string, string]>(["#000000", "#ffffff"]);
  const [opts, setOpts] = useState<Record<string, number>>({ brush: 4, airbrush: 10, eraser: 8, line: 1, fill: 0 });
  const [size, setSize] = useState({ w: 640, h: 480 });
  const [fileId, setFileId] = useState(win.props.fileId);
  const [dirty, setDirty] = useState(false);
  const posField = useRef<HTMLParagraphElement>(null);
  const setPos = (text: string) => {
    if (posField.current) posField.current.textContent = text;
  };
  const history = useRef({ undo: [] as ImageData[], redo: [] as ImageData[] });
  const pending = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; button: number; timer?: number } | null>(null);
  const name = useFs((s) => s.nodes[fileId ?? ""]?.name) ?? "untitled";
  useTitle(win.id, `${name} - Paint`);

  const g = () => canvas.current!.getContext("2d", { willReadFrequently: true })!;
  const grab = () => g().getImageData(0, 0, size.w, size.h);
  // Resizing a canvas clears it, so a freshly opened picture is drawn once the new size is in place.
  useLayoutEffect(() => {
    const ctx = g();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size.w, size.h);
    if (pending.current) ctx.drawImage(pending.current, 0, 0);
    pending.current = null;
  }, [size]);
  const reset = (id?: string, w = 640, h = 480) => {
    history.current = { undo: [], redo: [] };
    setFileId(id);
    setDirty(false);
    setSize({ w, h });
  };
  const loadFile = (id: string) => {
    const img = new Image();
    img.onload = () => {
      pending.current = img;
      reset(id, img.width, img.height);
    };
    img.onerror = () =>
      msgBox(
        "Paint cannot read this file.\nThis is not a valid bitmap file, or its format is not currently supported.",
        { title: "Paint", kind: "error" },
      );
    img.src = fs().nodes[id]?.content ?? "";
  };
  // Only the file the window was opened with; later opens call loadFile themselves.
  const loadInitial = useEffectEvent(() => {
    if (win.props.fileId) loadFile(win.props.fileId);
  });
  useEffect(() => {
    loadInitial();
  }, []);

  const snapshot = () => {
    const h = history.current;
    h.undo = [...h.undo.slice(-19), grab()]; // XP keeps 3 steps; 20 is kinder and still cheap
    h.redo = [];
    setDirty(true);
  };
  const step = (from: "undo" | "redo", to: "undo" | "redo") => {
    const img = history.current[from].pop();
    if (!img) return;
    history.current[to].push(grab());
    g().putImageData(img, 0, 0);
  };
  const undo = () => step("undo", "redo"),
    redo = () => step("redo", "undo");
  const edit = (fn: (ctx: CanvasRenderingContext2D, img: ImageData) => void) => {
    snapshot();
    fn(g(), grab());
  };

  // Pictures live in the virtual disk as PNG data URLs.
  const write = (id: string) => {
    fs().write(id, canvas.current!.toDataURL("image/png"));
    setFileId(id);
    setDirty(false);
    return true;
  };
  const saveAs = async () => {
    const id = await fileDialog({ mode: "save", filters: FILTERS, name: fileId ? name : "untitled.png", folder: PICS });
    return !!id && write(id);
  };
  const save = async () => (fileId && fs().nodes[fileId] ? write(fileId) : saveAs());
  const settle = async () => !dirty || askSave(`Save changes to ${name}?`, "Paint", save);
  useCloseGuard(win.id, settle);
  const newImage = async () => {
    if (await settle()) reset();
  };
  const open = async () => {
    if (await settle()) {
      const id = await fileDialog({ mode: "open", filters: FILTERS, folder: PICS });
      if (id) loadFile(id);
    }
  };
  const download = () =>
    Object.assign(document.createElement("a"), {
      href: canvas.current!.toDataURL("image/png"),
      download: name.replace(/\.\w+$/, "") + ".png",
    }).click();
  const clear = () =>
    edit((ctx) => {
      ctx.fillStyle = colors[1];
      ctx.fillRect(0, 0, size.w, size.h);
    }); // XP clears to the background colour
  const invert = () =>
    edit((ctx, img) => {
      for (let i = 0; i < img.data.length; i += 4) for (let c = i; c < i + 3; c++) img.data[c] = 255 - img.data[c]!;
      ctx.putImageData(img, 0, 0);
    });
  const flip = () =>
    edit((ctx) => {
      ctx.save();
      ctx.translate(size.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas.current!, 0, 0);
      ctx.restore();
    });

  const at = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.floor(e.clientX - r.left), Math.floor(e.clientY - r.top)] as const;
  };
  // right button swaps the colours
  const pens = (button: number): [string, string] => (button === 2 ? [colors[1], colors[0]] : colors);
  // pencil, brush, eraser or airbrush; the eraser always paints the background colour
  const freehand = (x0: number, y0: number, x: number, y: number, fg: string) =>
    tool === "airbrush"
      ? spray(g(), x, y, opts.airbrush!, fg)
      : line(g(), x0, y0, x, y, opts[tool] ?? 1, tool === "eraser" ? colors[1] : fg);
  const down = async (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    const [x, y] = at(e),
      [fg] = pens(e.button);
    if (tool === "pick") {
      const hex = toHex(g().getImageData(x, y, 1, 1).data);
      setColors((c) => (e.button === 2 ? [c[0], hex] : [hex, c[1]]));
      return setTool(beforePick); // XP hands control back to the previous tool
    }
    if (tool === "fill")
      return edit((ctx, img) => {
        floodFill(img, x, y, fg);
        ctx.putImageData(img, 0, 0);
      });
    if (tool === "text") {
      const v = await formBox("Type the text to place on the picture:", "Text", [["Text:", ""]]);
      if (v?.[0])
        edit((ctx) => {
          ctx.fillStyle = fg;
          ctx.font = "13px Tahoma, sans-serif";
          ctx.textBaseline = "top";
          ctx.fillText(v[0]!, x, y);
        });
      return;
    }
    snapshot();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: x, sy: y, x, y, button: e.button };
    if (!SHAPES.includes(tool)) freehand(x, y, x, y, fg);
    if (tool === "airbrush")
      drag.current.timer = window.setInterval(() => {
        const d = drag.current;
        if (d) spray(g(), d.x, d.y, opts.airbrush!, fg);
      }, 30);
  };
  const move = (e: PointerEvent) => {
    const [x, y] = at(e),
      d = drag.current;
    setPos(x >= 0 && y >= 0 && x < size.w && y < size.h ? `${x},${y}` : "");
    if (!d) return;
    const [fg, bg] = pens(d.button);
    if (SHAPES.includes(tool)) {
      const o = overlay.current!.getContext("2d")!;
      o.clearRect(0, 0, size.w, size.h);
      shape(o, tool, d.sx, d.sy, x, y, fg, bg, opts.fill!, opts.line!);
    } else freehand(d.x, d.y, x, y, fg);
    d.x = x;
    d.y = y;
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    clearInterval(d.timer);
    if (!SHAPES.includes(tool)) return;
    const [x, y] = at(e),
      [fg, bg] = pens(d.button);
    overlay.current!.getContext("2d")!.clearRect(0, 0, size.w, size.h);
    shape(g(), tool, d.sx, d.sy, x, y, fg, bg, opts.fill!, opts.line!);
  };
  const keys = (e: KeyboardEvent) => {
    const map: Record<string, () => unknown> = e.shiftKey
      ? { n: clear }
      : { z: undo, y: redo, s: save, o: open, n: newImage, i: invert };
    const act = e.ctrlKey && map[e.key.toLowerCase()];
    if (act) {
      e.preventDefault();
      void act();
    }
  };

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: "New", hint: "Ctrl+N", onClick: newImage },
      { label: "Open...", hint: "Ctrl+O", onClick: open },
      { label: "Save", hint: "Ctrl+S", onClick: save },
      { label: "Save As...", onClick: saveAs },
      "-",
      { label: "Save to My Computer (download)...", onClick: download },
      "-",
      { label: "Exit", onClick: () => useWindows.getState().requestClose(win.id) },
    ],
    Edit: [
      { label: "Undo", hint: "Ctrl+Z", onClick: undo },
      { label: "Repeat", hint: "Ctrl+Y", onClick: redo },
    ],
    Image: [
      { label: "Flip Horizontal", onClick: flip },
      { label: "Invert Colors", hint: "Ctrl+I", onClick: invert },
      "-",
      { label: "Clear Image", hint: "Ctrl+Shift+N", onClick: clear },
    ],
    Colors: [{ label: "Edit Colors...", onClick: () => picker.current?.click() }],
    Help: [
      { label: "About Paint", onClick: () => msgBox("Paint\nPart of the XP Desktop clone.", { title: "About Paint" }) },
    ],
  };
  const sizeKey = tool === "rect" || tool === "ellipse" ? "fill" : tool;
  const choices = sizeKey === "fill" ? [0, 1, 2] : (SIZES[tool] ?? []);
  return (
    <div className="paint" tabIndex={-1} onKeyDown={keys}>
      <MenuBar menus={menus} />
      <div className="paint-main">
        <div className="paint-tools">
          {TOOLS.map(([t, title]) => (
            <button
              key={t}
              title={title}
              className={cls("flat", tool === t && "on")}
              onClick={() => {
                if (t === "pick" && tool !== "pick") setBeforePick(tool);
                setTool(t);
              }}
            >
              <Icon name={`tool-${t}`} />
            </button>
          ))}
          <div className="paint-options">
            {choices.map((v) => (
              <button
                key={v}
                className={cls("flat", opts[sizeKey] === v && "on")}
                onClick={() => setOpts({ ...opts, [sizeKey]: v })}
              >
                {sizeKey === "fill" ? (
                  <i className={`fill-mode m${v}`} />
                ) : (
                  <i style={{ width: tool === "eraser" ? v : 26, height: Math.min(v, 12) }} />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="paint-area">
          <div className="paint-sheet" style={{ width: size.w, height: size.h }}>
            <canvas
              ref={canvas}
              width={size.w}
              height={size.h}
              style={{ cursor: tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair" }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={() => setPos("")}
            />
            <canvas ref={overlay} width={size.w} height={size.h} className="paint-overlay" />
          </div>
        </div>
      </div>
      <div className="paint-colors">
        <div className="paint-current">
          <i style={{ background: colors[1] }} />
          <i style={{ background: colors[0] }} />
        </div>
        <div className="paint-palette">
          {PALETTE.map((c) => (
            <i
              key={c}
              style={{ background: c }}
              onMouseDown={(e) => setColors((cur) => (e.button === 2 ? [cur[0], c] : [c, cur[1]]))}
              onDoubleClick={() => picker.current?.click()}
            />
          ))}
        </div>
        <input
          ref={picker}
          type="color"
          hidden
          value={colors[0]}
          onChange={(e) => setColors([e.target.value, colors[1]])}
        />
      </div>
      <div className="status-bar">
        <p className="status-bar-field">For Help, click Help Topics on the Help Menu.</p>
        <p ref={posField} className="status-bar-field" />
      </div>
    </div>
  );
}
