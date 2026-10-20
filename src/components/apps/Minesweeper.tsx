import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { MenuItem } from "../shell/ContextMenu";
import { MenuBar } from "../shell/MenuBar";
import { formBox, msgBox } from "../shell/MessageBox";
import { Icon, cls } from "../../lib/ui";
import { useFitWindow } from "../shell/Window";
import { useSettings, type MineSettings } from "../../store/settings";
import { useWindows } from "../../store/windows";
import type { AppProps } from "../../lib/registry";
import {
  LEVELS,
  chord,
  flagsLeft,
  levelOf,
  neighbors,
  newBoard,
  reveal,
  toggleMark,
  type Board,
} from "../../lib/minesweeper";
import "../../styles/minesweeper.css";

// Seven-segment digits: which of segments a–g are lit ("-" lights only g), and where each segment sits in a 13×23 box.
const DIGITS = "1111110 0110000 1101101 1111001 0110011 1011011 1011111 1110000 1111111 1111011".split(" ");
const SEGMENTS = [
  "2,1 11,1 9,3 4,3",
  "12,2 12,11 10,10 10,4",
  "12,12 12,21 10,19 10,13",
  "2,22 11,22 9,20 4,20",
  "1,12 3,13 3,19 1,21",
  "1,2 3,4 3,10 1,11",
  "2,11.5 4,10.5 9,10.5 11,11.5 9,12.5 4,12.5",
];

function Counter({ value }: { value: number }) {
  const text =
    value < 0 ? "-" + String(Math.min(99, -value)).padStart(2, "0") : String(Math.min(999, value)).padStart(3, "0");
  return (
    <div className="ms-counter">
      {[...text].map((ch, i) => (
        <svg key={i} viewBox="0 0 13 23" width="13" height="23">
          {SEGMENTS.map((p, j) => (
            <polygon key={j} points={p} fill={(DIGITS[+ch] ?? "0000001")[j] === "1" ? "#ff0000" : "#3c0000"} />
          ))}
        </svg>
      ))}
    </div>
  );
}

const COLORS = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000", "#808080"];

export default function Minesweeper({ win }: AppProps) {
  const cfg = useSettings((s) => s.mines);
  const [board, setBoard] = useState(() => newBoard(cfg.w, cfg.h, cfg.mines));
  const [time, setTime] = useState(0);
  const [held, setHeld] = useState<{ i: number; chord: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useFitWindow(win, root, `${board.w}x${board.h}`);
  useEffect(() => {
    if (board.state !== "playing") return;
    const t = setInterval(() => setTime((s) => Math.min(999, s + 1)), 1000);
    return () => clearInterval(t);
  }, [board.state]);

  const save = (p: Partial<MineSettings>) =>
    useSettings.getState().update({ mines: { ...useSettings.getState().mines, ...p } });
  const restart = (w = board.w, h = board.h, mines = board.mines) => {
    setBoard(newBoard(w, h, mines));
    setTime(0);
    setHeld(null);
  };
  const setLevel = (w: number, h: number, mines: number) => {
    save({ w, h, mines });
    restart(w, h, mines);
  };
  const showBest = async (): Promise<void> => {
    const recs = useSettings.getState().mines.records;
    const text = Object.keys(LEVELS)
      .map((l) => `${l}:  ${recs[l]?.time ?? 999} seconds  ${recs[l]?.name ?? "Anonymous"}`)
      .join("\n");
    if (
      (await msgBox(text, { title: "Fastest Mine Sweepers", kind: null, buttons: ["OK", "Reset Scores"] })) ===
      "Reset Scores"
    ) {
      save({ records: {} });
      return showBest();
    }
  };
  const celebrate = async (b: Board, t: number) => {
    const level = levelOf(b),
      best = level && useSettings.getState().mines.records[level];
    if (!level || (best && best.time <= t)) return;
    const name = await formBox(
      `You have the fastest time for ${level.toLowerCase()} level. Please type your name:`,
      "Congratulations",
      [["Name:", best ? best.name : "Anonymous"]],
    );
    save({
      records: {
        ...useSettings.getState().mines.records,
        [level]: { time: t, name: name?.[0]?.trim() || "Anonymous" },
      },
    });
    void showBest();
  };
  const play = (next: Board) => {
    if (next === board) return;
    if (board.state === "ready") setTime(1); // XP's clock reads 1 the moment the first square opens
    setBoard(next);
    if (next.state === "won") void celebrate(next, Math.max(1, time));
  };
  const custom = async () => {
    const v = await formBox("", "Custom Field", [
      ["Height:", String(board.h)],
      ["Width:", String(board.w)],
      ["Mines:", String(board.mines)],
    ]);
    if (!v) return;
    const num = (s: string | undefined, lo: number, hi: number) => Math.max(lo, Math.min(hi, parseInt(s ?? "") || lo));
    const h = num(v[0], 9, 24),
      w = num(v[1], 9, 30);
    setLevel(w, h, num(v[2], 10, (w - 1) * (h - 1)));
  };

  const over = board.state === "won" || board.state === "lost";
  const cellOf = (e: MouseEvent) => Number((e.target as HTMLElement).dataset.i ?? NaN);
  const down = (e: MouseEvent) => {
    const i = cellOf(e);
    if (Number.isNaN(i) || over) return;
    const both = (e.buttons & 3) === 3 || e.button === 1; // left+right together, or the middle button
    if (e.button === 2 && !both) return play(toggleMark(board, i, cfg.marks));
    setHeld({ i, chord: both });
  };
  const up = () => {
    if (!held) return;
    setHeld(null);
    play(held.chord ? chord(board, held.i) : reveal(board, held.i));
  };
  const pressed = new Set(!held || over ? [] : held.chord ? [held.i, ...neighbors(board, held.i)] : [held.i]);
  const face = board.state === "lost" ? "dead" : board.state === "won" ? "cool" : held ? "oh" : "smile";
  const level = levelOf(board);
  const menus: Record<string, MenuItem[]> = {
    Game: [
      { label: "New", hint: "F2", onClick: () => restart() },
      "-",
      ...Object.entries(LEVELS).map(([name, [w, h, m]]): MenuItem => ({
        label: name,
        checked: level === name,
        onClick: () => setLevel(w, h, m),
      })),
      { label: "Custom...", checked: !level, onClick: custom },
      "-",
      { label: "Marks (?)", checked: cfg.marks, onClick: () => save({ marks: !cfg.marks }) },
      "-",
      { label: "Best Times...", onClick: showBest },
      "-",
      { label: "Exit", onClick: () => useWindows.getState().requestClose(win.id) },
    ],
    Help: [
      {
        label: "About Minesweeper",
        onClick: () => msgBox("Minesweeper\nPart of the XP Desktop clone.", { title: "About Minesweeper" }),
      },
    ],
  };

  return (
    <div
      className="ms"
      ref={root}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "F2") {
          e.preventDefault();
          restart();
        }
      }}
    >
      <MenuBar menus={menus} />
      <div className="ms-board">
        <div className="ms-head">
          <Counter value={flagsLeft(board)} />
          <button className="ms-face flat" onClick={() => restart()}>
            <Icon name={`face-${face}`} size={20} />
          </button>
          <Counter value={time} />
        </div>
        <div
          className="ms-grid"
          style={{ gridTemplateColumns: `repeat(${board.w}, 16px)` }}
          onMouseDown={down}
          onMouseUp={up}
          onMouseLeave={() => setHeld(null)}
          onMouseOver={(e) => {
            const i = cellOf(e);
            if (held && !Number.isNaN(i)) setHeld({ ...held, i });
          }}
        >
          {board.cells.map((c, i) => {
            const look = c.open
              ? cls(c.mine ? "mine" : "open", i === board.hit && "hit")
              : c.mark === 1
                ? board.state === "lost" && !c.mine
                  ? "wrong"
                  : "flag"
                : cls(c.mark === 2 && "q", pressed.has(i) && "down");
            return (
              <div key={i} data-i={i} className={`ms-cell ${look}`} style={c.open ? { color: COLORS[c.n] } : undefined}>
                {c.open && !c.mine && c.n ? c.n : ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
