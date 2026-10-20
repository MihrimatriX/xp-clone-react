import { formBox, msgBox } from "../shell/MessageBox";
import { MY_COMPUTER, openFolder } from "../../lib/files";
import { Icon } from "../../lib/ui";
import { useSettings } from "../../store/settings";
import { useWindows } from "../../store/windows";
import { TaskPane } from "./ExplorerTaskPane";
import { apps } from "../../lib/registry";
import "../../styles/control-panel.css";

const APPLETS = [
  {
    name: "Add or Remove Programs",
    icon: "app",
    about: "Install or remove programs and Windows components.",
    run: () =>
      msgBox(
        `Currently installed programs:\n\n${Object.values(apps)
          .map((a) => `  ${a.title}`)
          .sort()
          .join("\n")}`,
        { title: "Add or Remove Programs", kind: null },
      ),
  },
  {
    name: "Display",
    icon: "display",
    about: "Change the appearance of your desktop, such as the background and screen saver.",
    run: () => useWindows.getState().open("display"),
  },
  {
    name: "System",
    icon: "computer",
    about: "See information about your computer system.",
    run: () =>
      msgBox(
        `System:\n    XP Desktop clone\n    Built with React and Bun\n\nComputer:\n    ${navigator.hardwareConcurrency} logical processors\n    ${innerWidth} x ${innerHeight} screen`,
        { title: "System Properties", kind: null },
      ),
  },
  {
    name: "User Accounts",
    icon: "user",
    about: "Change your account name, shown on the Start menu and the Welcome screen.",
    run: async () => {
      const v = await formBox("Type a new name for your account:", "User Accounts", [
        ["Name:", useSettings.getState().userName],
      ]);
      if (v?.[0]?.trim()) useSettings.getState().update({ userName: v[0].trim() });
    },
  },
];

export default function ControlPanel() {
  return (
    <div className="control-panel">
      <TaskPane
        sections={[
          { title: "Control Panel", body: <p>Pick a category to change your computer's settings.</p> },
          {
            title: "See Also",
            tasks: [{ label: "My Computer", icon: "computer", onClick: () => openFolder(MY_COMPUTER) }],
          },
        ]}
      />
      <div className="cp-items">
        {APPLETS.map((a) => (
          <button
            key={a.name}
            className="cp-item flat"
            onDoubleClick={a.run}
            onKeyDown={(e) => {
              if (e.key === "Enter") a.run();
            }}
            title={a.about}
          >
            <Icon name={a.icon} size={32} />
            <span>
              <b>{a.name}</b>
              <small>{a.about}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
