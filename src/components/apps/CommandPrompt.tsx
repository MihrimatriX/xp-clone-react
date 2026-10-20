import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { run, runOrComplain } from "../../lib/files";
import { pathOf, useFs } from "../../store/fs";
import { useWindows } from "../../store/windows";
import type { AppProps } from "../../lib/registry";
import { BANNER, HOME_DIR, exec } from "../../lib/cmd";
import "../../styles/command-prompt.css";

export default function CommandPrompt({ win }: AppProps) {
  const [lines, setLines] = useState(BANNER);
  const [cwd, setCwd] = useState(HOME_DIR);
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [history, setHistory] = useState<{ list: string[]; at: number }>({ list: [], at: 0 });
  const field = useRef<HTMLInputElement>(null),
    box = useRef<HTMLDivElement>(null);
  const prompt = `${useFs((s) => pathOf(s.nodes, cwd))}>`;
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  const type = (value: string) => {
    setInput(value);
    setCaret(value.length);
  };
  const submit = () => {
    const echo = prompt + input;
    if (!input.trim()) return setLines((l) => [...l, echo]);
    const r = exec(input, cwd);
    if (r.exit) return useWindows.getState().close(win.id);
    if (r.start !== undefined) void (r.start ? runOrComplain(r.start) : useWindows.getState().open("cmd"));
    // Like XP, program and file names (notepad, readme.txt) run straight from the prompt.
    const ran = r.tryRun !== undefined && run(r.tryRun.replace(/\.exe$/i, ""));
    setLines((l) => (r.clear ? [] : [...l, echo, ...(ran ? [] : r.out), ""]));
    if (r.cwd) setCwd(r.cwd);
    setHistory((h) => ({ list: [...h.list, input], at: h.list.length + 1 }));
    type("");
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") return submit();
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const at = Math.max(0, Math.min(history.list.length, history.at + (e.key === "ArrowUp" ? -1 : 1)));
    setHistory({ ...history, at });
    type(history.list[at] ?? "");
  };
  return (
    <div
      ref={box}
      className="cmd"
      onMouseUp={() => {
        if (!getSelection()?.toString()) field.current?.focus();
      }}
    >
      {lines.map((l, i) => (
        <div key={i}>{l || " "}</div>
      ))}
      <div>
        {prompt}
        {input.slice(0, caret)}
        <span className="cmd-cursor">{input[caret] ?? " "}</span>
        {input.slice(caret + 1)}
      </div>
      <input
        ref={field}
        className="cmd-input"
        autoFocus
        value={input}
        spellCheck={false}
        onChange={(e) => {
          setInput(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={keys}
      />
    </div>
  );
}
