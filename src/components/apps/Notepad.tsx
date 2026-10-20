import { useRef, useState, type KeyboardEvent } from "react";
import type { MenuItem } from "../shell/ContextMenu";
import { fileDialog, type Filter } from "../shell/FileDialog";
import { MenuBar } from "../shell/MenuBar";
import { askSave, msgBox } from "../shell/MessageBox";
import { useCloseGuard, useTitle } from "../shell/Window";
import { useFs } from "../../store/fs";
import { useWindows } from "../../store/windows";
import type { AppProps } from "../../lib/registry";
import "../../styles/notepad.css";

const FILTERS: Filter[] = [
  { label: "Text Documents (*.txt)", exts: ["txt"] },
  { label: "All Files", exts: [] },
];
const fs = () => useFs.getState();

export default function Notepad({ win }: AppProps) {
  const [fileId, setFileId] = useState(win.props.fileId);
  const [text, setText] = useState(() => fs().nodes[fileId ?? ""]?.content ?? "");
  const [saved, setSaved] = useState(text);
  const [wrap, setWrap] = useState(false);
  const [statusBar, setStatusBar] = useState(false);
  const [caret, setCaret] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const name = useFs((s) => s.nodes[fileId ?? ""]?.name) ?? "Untitled";
  useTitle(win.id, `${name} - Notepad`);

  const load = (id: string | undefined, content: string) => {
    setFileId(id);
    setText(content);
    setSaved(content);
  };
  const saveAs = async () => {
    const id = await fileDialog({ mode: "save", filters: FILTERS, name: fileId ? name : "*.txt" });
    if (!id) return false;
    fs().write(id, text);
    load(id, text);
    return true;
  };
  const save = async () => {
    if (!fileId || !fs().nodes[fileId]) return saveAs();
    fs().write(fileId, text);
    setSaved(text);
    return true;
  };
  /** XP's "Do you want to save the changes?" — true when it's fine to throw the text away. */
  const settle = async () =>
    text === saved ||
    askSave(`The text in the ${name} file has changed.\n\nDo you want to save the changes?`, "Notepad", save);
  useCloseGuard(win.id, settle);
  const newFile = async () => {
    if (await settle()) load(undefined, "");
  };
  const open = async () => {
    if (!(await settle())) return;
    const id = await fileDialog({ mode: "open", filters: FILTERS });
    const n = fs().nodes[id ?? ""];
    if (n) load(n.id, n.content);
  };

  // execCommand keeps the textarea's own undo history intact, which setting `value` would wipe.
  const edit = (command: string, value?: string) => {
    area.current?.focus();
    document.execCommand(command, false, value);
  };
  const paste = async () => {
    const t = await navigator.clipboard.readText().catch(() => "");
    if (t) edit("insertText", t);
  };
  const timeDate = () => {
    const d = new Date();
    edit(
      "insertText",
      `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${d.toLocaleDateString("en-US")}`,
    );
  };
  const keys = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const act = e.ctrlKey ? { s: save, o: open, n: newFile }[k] : k === "f5" ? timeDate : undefined;
    if (act) {
      e.preventDefault();
      void act();
    }
  };

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: "New", hint: "Ctrl+N", onClick: newFile },
      { label: "Open...", hint: "Ctrl+O", onClick: open },
      { label: "Save", hint: "Ctrl+S", onClick: save },
      { label: "Save As...", onClick: saveAs },
      "-",
      { label: "Exit", onClick: () => useWindows.getState().requestClose(win.id) },
    ],
    Edit: [
      { label: "Undo", hint: "Ctrl+Z", onClick: () => edit("undo") },
      "-",
      { label: "Cut", hint: "Ctrl+X", onClick: () => edit("cut") },
      { label: "Copy", hint: "Ctrl+C", onClick: () => edit("copy") },
      { label: "Paste", hint: "Ctrl+V", onClick: paste },
      { label: "Delete", hint: "Del", onClick: () => edit("delete") },
      "-",
      { label: "Select All", hint: "Ctrl+A", onClick: () => area.current?.select() },
      { label: "Time/Date", hint: "F5", onClick: timeDate },
    ],
    Format: [{ label: "Word Wrap", checked: wrap, onClick: () => setWrap(!wrap) }],
    // Like XP, the status bar is unavailable while Word Wrap is on.
    View: [
      { label: "Status Bar", checked: statusBar && !wrap, disabled: wrap, onClick: () => setStatusBar(!statusBar) },
    ],
    Help: [
      {
        label: "About Notepad",
        onClick: () => msgBox("Notepad\nPart of the XP Desktop clone.", { title: "About Notepad" }),
      },
    ],
  };
  const before = text.slice(0, caret);
  return (
    <div className="notepad">
      <MenuBar menus={menus} />
      <textarea
        ref={area}
        autoFocus
        spellCheck={false}
        value={text}
        wrap={wrap ? "soft" : "off"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keys}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
      />
      {statusBar && !wrap && (
        <div className="status-bar">
          <p className="status-bar-field" />
          <p className="status-bar-field">
            Ln {before.split("\n").length}, Col {before.length - before.lastIndexOf("\n")}
          </p>
        </div>
      )}
    </div>
  );
}
