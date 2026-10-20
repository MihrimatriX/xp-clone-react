import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { MenuItem } from "../shell/ContextMenu";
import { MenuBar } from "../shell/MenuBar";
import { msgBox } from "../shell/MessageBox";
import { cls } from "../../lib/ui";
import { useFitWindow } from "../shell/Window";
import type { AppProps } from "../../lib/registry";
import { INITIAL, press } from "../../lib/calculator";
import "../../styles/calculator.css";

const ROWS = "MC 7 8 9 / sqrt MR 4 5 6 * % MS 1 2 3 - 1/x M+ 0 +/- . + =".split(" ");
const KEY_OF: Record<string, string> = { "+/-": "neg", "1/x": "recip", Backspace: "back" };
const RED = new Set(["MC", "MR", "MS", "M+", "/", "*", "-", "+", "=", "Backspace", "CE", "C"]);
// XP's keyboard map: @ is square root, R is 1/x, F9 is +/-; Ctrl+L/R/M/P drive memory.
const KEYS: Record<string, string> = {
  Enter: "=",
  "=": "=",
  Escape: "C",
  Delete: "CE",
  Backspace: "back",
  "@": "sqrt",
  r: "recip",
  F9: "neg",
  ",": ".",
};
const CTRL_KEYS: Record<string, string> = { l: "MC", r: "MR", m: "MS", p: "M+" };

export default function Calculator({ win }: AppProps) {
  const [s, setS] = useState(INITIAL);
  const [grouping, setGrouping] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useFitWindow(win, root, "calc");
  useEffect(() => {
    root.current?.focus();
  }, []);

  const act = (key: string) => setS((prev) => press(prev, key));
  const copy = () => navigator.clipboard.writeText(s.display).catch(() => {});
  const paste = async () => {
    for (const ch of await navigator.clipboard.readText().catch(() => "")) act(KEYS[ch] ?? ch);
  };
  const keys = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrlKey && k === "c") return void copy();
    if (e.ctrlKey && k === "v") return void paste();
    const key = e.ctrlKey ? CTRL_KEYS[k] : (KEYS[k] ?? (/^[0-9.+\-*/%]$/.test(k) ? k : undefined));
    if (key) {
      e.preventDefault();
      act(key);
    }
  };

  // XP always shows the decimal point ("0.") and can group digits in threes.
  const [int = "0", frac] = s.display.split(".");
  const shown = s.error ? s.display : `${grouping ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : int}.${frac ?? ""}`;
  const button = (label: string) => (
    <button
      key={label}
      tabIndex={-1}
      className={cls(RED.has(label) && "red")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => act(KEY_OF[label] ?? label)}
    >
      {label}
    </button>
  );
  const menus: Record<string, MenuItem[]> = {
    Edit: [
      { label: "Copy", hint: "Ctrl+C", onClick: copy },
      { label: "Paste", hint: "Ctrl+V", onClick: paste },
    ],
    View: [
      { label: "Standard", checked: "radio" },
      { label: "Scientific", disabled: true },
      "-",
      { label: "Digit grouping", checked: grouping, onClick: () => setGrouping(!grouping) },
    ],
    Help: [
      {
        label: "About Calculator",
        onClick: () => msgBox("Calculator\nPart of the XP Desktop clone.", { title: "About Calculator" }),
      },
    ],
  };
  return (
    <div className="calc" ref={root} tabIndex={-1} onKeyDown={keys}>
      <MenuBar menus={menus} />
      <div className="calc-body">
        <input className="calc-display" readOnly tabIndex={-1} value={shown} />
        <div className="calc-top">
          <span className="calc-mem">{s.memory ? "M" : ""}</span>
          {["Backspace", "CE", "C"].map(button)}
        </div>
        <div className="calc-grid">{ROWS.map(button)}</div>
      </div>
    </div>
  );
}
