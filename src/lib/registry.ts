import type { ComponentType } from "react";
import RunDialog from "../components/shell/RunDialog";
import type { Win } from "../store/windows";
import Calculator from "../components/apps/Calculator";
import CommandPrompt from "../components/apps/CommandPrompt";
import ControlPanel from "../components/apps/ControlPanel";
import DisplayProperties from "../components/apps/DisplayProperties";
import Explorer from "../components/apps/Explorer";
import InternetExplorer from "../components/apps/InternetExplorer";
import Minesweeper from "../components/apps/Minesweeper";
import Notepad from "../components/apps/Notepad";
import Paint from "../components/apps/Paint";

export type AppProps = { win: Win };
interface AppDef {
  id: string; // also the command name for Start > Run
  title: string;
  icon: string; // CSS icon class suffix, see .ico-* in styles/global.css
  component: ComponentType<AppProps>;
  defaultSize: { w: number; h: number };
  resizable?: boolean; // defaults to true
  singleInstance?: boolean;
  opens?: string[]; // file extensions this app handles
}

const list: AppDef[] = [
  { id: "explorer", title: "Windows Explorer", icon: "folder", component: Explorer, defaultSize: { w: 680, h: 480 } },
  {
    id: "notepad",
    title: "Notepad",
    icon: "notepad",
    component: Notepad,
    defaultSize: { w: 560, h: 400 },
    opens: ["txt", "ini", "bat", "log"],
  },
  {
    id: "calc",
    title: "Calculator",
    icon: "calc",
    component: Calculator,
    defaultSize: { w: 270, h: 260 },
    resizable: false,
  },
  { id: "cmd", title: "Command Prompt", icon: "cmd", component: CommandPrompt, defaultSize: { w: 670, h: 420 } },
  {
    id: "winmine",
    title: "Minesweeper",
    icon: "mine",
    component: Minesweeper,
    defaultSize: { w: 170, h: 250 },
    resizable: false,
  },
  {
    id: "mspaint",
    title: "Paint",
    icon: "paint",
    component: Paint,
    defaultSize: { w: 760, h: 580 },
    opens: ["png", "jpg", "jpeg", "bmp", "gif"],
  },
  {
    id: "iexplore",
    title: "Internet Explorer",
    icon: "globe",
    component: InternetExplorer,
    defaultSize: { w: 820, h: 600 },
  },
  {
    id: "display",
    title: "Display Properties",
    icon: "display",
    component: DisplayProperties,
    defaultSize: { w: 404, h: 452 },
    resizable: false,
    singleInstance: true,
  },
  {
    id: "control",
    title: "Control Panel",
    icon: "control",
    component: ControlPanel,
    defaultSize: { w: 640, h: 420 },
    singleInstance: true,
  },
  {
    id: "run",
    title: "Run",
    icon: "run",
    component: RunDialog,
    defaultSize: { w: 360, h: 178 },
    resizable: false,
    singleInstance: true,
  },
];

export const apps: Record<string, AppDef> = Object.fromEntries(list.map((a) => [a.id, a]));
export const appForExt = (ext: string) => list.find((a) => a.opens?.includes(ext));
