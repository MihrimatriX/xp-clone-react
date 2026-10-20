import { useState } from "react";
import type { AppProps } from "../../lib/registry";
import { useSettings } from "../../store/settings";
import { useWindows } from "../../store/windows";
import { runOrComplain } from "../../lib/files";
import { Icon } from "../../lib/ui";

export default function RunDialog({ win }: AppProps) {
  // XP pre-fills the last command that worked.
  const [cmd, setCmd] = useState(() => useSettings.getState().lastRun);
  const close = () => useWindows.getState().close(win.id);
  const submit = async () => {
    if (!(await runOrComplain(cmd))) return;
    useSettings.getState().update({ lastRun: cmd.trim() });
    close();
  };
  return (
    <form
      className="dialog run-dialog"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="run-intro">
        <Icon name="run" size={32} />
        <p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p>
      </div>
      <div className="field-row">
        <label htmlFor={`run-${win.id}`}>Open:</label>
        <input
          id={`run-${win.id}`}
          type="text"
          autoFocus
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>
      <div className="dialog-buttons">
        <button type="submit" disabled={!cmd.trim()}>
          OK
        </button>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
