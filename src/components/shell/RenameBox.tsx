import type { FsNode } from "../../store/fs";
import { renameNode } from "../../lib/files";

/** Inline label editor (F2): Enter or blur commits, Esc cancels. */
export function RenameBox({ node, done }: { node: FsNode; done: () => void }) {
  return (
    <textarea
      className="rename"
      autoFocus
      defaultValue={node.name}
      rows={1}
      spellCheck={false}
      onFocus={(e) => e.currentTarget.select()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") e.currentTarget.value = node.name; // blur then renames to the same name: a no-op
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        renameNode(node.id, e.currentTarget.value);
        done();
      }}
    />
  );
}
