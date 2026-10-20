import { useState } from "react";
import { create } from "zustand";
import { play, type Sound } from "../../lib/sound";
import { Icon } from "../../lib/ui";

type Kind = "info" | "warning" | "error" | "question";
interface Box {
  id: number;
  text: string;
  title: string;
  kind?: Kind;
  buttons: string[];
  fields?: [label: string, value: string][];
  resolve: (button: string, values: string[]) => void;
}

const SOUNDS: Record<Kind, Sound> = { info: "ding", question: "ding", warning: "exclamation", error: "error" };
const useBoxes = create<{ boxes: Box[] }>(() => ({ boxes: [] }));
let nextId = 0;
const push = (box: Omit<Box, "id">) => useBoxes.setState((s) => ({ boxes: [...s.boxes, { ...box, id: nextId++ }] }));

/** XP-style modal message box; resolves with the label of the button pressed. */
export function msgBox(
  text: string,
  opts: { title?: string; kind?: Kind | null; buttons?: string[] } = {},
): Promise<string> {
  const kind = opts.kind === undefined ? "info" : (opts.kind ?? undefined); // null: a plain box, no icon or sound
  if (kind) play(SOUNDS[kind]);
  return new Promise((resolve) =>
    push({ text, title: opts.title ?? "Windows", kind, buttons: opts.buttons ?? ["OK"], resolve }),
  );
}

/** Small input dialog; resolves with the typed values, or null on Cancel. */
export function formBox(text: string, title: string, fields: [string, string][]): Promise<string[] | null> {
  return new Promise((resolve) =>
    push({ text, title, fields, buttons: ["OK", "Cancel"], resolve: (b, v) => resolve(b === "OK" ? v : null) }),
  );
}

export function MessageBoxHost() {
  const box = useBoxes((s) => s.boxes.at(-1));
  return box ? <BoxView key={box.id} box={box} /> : null;
}

function BoxView({ box }: { box: Box }) {
  const [values, setValues] = useState(() => box.fields?.map((f) => f[1]) ?? []);
  const done = (button: string) => {
    useBoxes.setState((s) => ({ boxes: s.boxes.filter((b) => b !== box) }));
    box.resolve(button, values);
  };
  // Like XP, the close button and Esc only work when there is a safe answer (a Yes/No box has none).
  const cancel = box.buttons.includes("Cancel") ? "Cancel" : box.buttons.length === 1 ? box.buttons[0] : undefined;
  return (
    <div
      className="modal"
      onKeyDown={(e) => {
        if (e.key === "Escape" && cancel) done(cancel);
      }}
    >
      <form
        className="window msgbox"
        role="alertdialog"
        aria-label={box.title}
        onSubmit={(e) => {
          e.preventDefault();
          done(box.buttons[0]!);
        }}
      >
        <div className="title-bar">
          <div className="title-bar-text">{box.title}</div>
          <div className="title-bar-controls">
            <button type="button" aria-label="Close" disabled={!cancel} onClick={() => cancel && done(cancel)} />
          </div>
        </div>
        <div className="msgbox-body">
          {box.kind && <Icon name={box.kind} size={32} />}
          <div>
            <p>{box.text}</p>
            {box.fields?.map(([label], i) => (
              <label key={label} className="field-row">
                {label}
                <input
                  type="text"
                  autoFocus={i === 0}
                  value={values[i]}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="dialog-buttons">
          {box.buttons.map((b, i) => (
            <button
              key={b}
              type={i === 0 ? "submit" : "button"}
              autoFocus={i === 0 && !box.fields}
              onClick={i === 0 ? undefined : () => done(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

/** Yes/No question box: true on Yes. */
export const confirmBox = async (text: string, title: string, kind: Kind = "question") =>
  (await msgBox(text, { title, kind, buttons: ["Yes", "No"] })) === "Yes";

/** XP's Yes/No/Cancel save prompt: true when the caller may go on (saved, or the changes were dropped). */
export async function askSave(text: string, title: string, save: () => Promise<boolean>) {
  const answer = await msgBox(text, { title, kind: "warning", buttons: ["Yes", "No", "Cancel"] });
  return answer === "No" || (answer === "Yes" && (await save()));
}
