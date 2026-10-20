import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { create } from "zustand";
import { useSettings } from "../../store/settings";
import { useWindows, type Phase } from "../../store/windows";
import { play, unlockAudio, type Sound } from "../../lib/sound";
import { Icon, cls } from "../../lib/ui";
import flag from "../../assets/icons/start.svg";

type EndDialog = "logoff" | "shutdown" | null;
const useEndDialog = create<{ dialog: EndDialog }>(() => ({ dialog: null }));
export const openEndDialog = (dialog: EndDialog) => useEndDialog.setState({ dialog });
export const useDimmed = () => useEndDialog((s) => s.dialog !== null);

const go = (phase: Phase) => useWindows.getState().setPhase(phase);
let freshBoot = false; // the first logon after a boot plays the startup sound, later ones the logon sound

/** The boot-screen wordmark, laid out in the pixel coordinates of a reference boot screenshot; textLength pins each word's width whatever font is installed. */
const Logo = ({ edition }: { edition?: string }) => {
  const [w, h] = [254, edition ? 180 : 154];
  return (
    <svg
      className="xp-logo"
      viewBox={`182 36 ${w} ${h}`}
      width={w * 1.1}
      height={h * 1.1}
      aria-label={`Microsoft Windows XP ${edition ?? ""}`}
    >
      <image href={flag} x={278} y={36} width={124} height={112} />
      <g fill="#e9e9e9" fontFamily="Arial, Helvetica, sans-serif">
        <text x={184.5} y={140.5} fontSize={14} textLength={71.5} lengthAdjust="spacingAndGlyphs">
          Microsoft
        </text>
        <text x={257} y={134} fontSize={8}>
          ®
        </text>
        <text x={379} y={137} fontSize={7}>
          ™
        </text>
        <text x={187.5} y={183.75} fontSize={49} fontWeight="bold" textLength={200} lengthAdjust="spacingAndGlyphs">
          Windows
        </text>
        <text x={388} y={159} fontSize={8}>
          ®
        </text>
        <text x={394} y={165} fontSize={36} fill="#e36527" textLength={38} lengthAdjust="spacingAndGlyphs">
          xp
        </text>
        {edition && (
          <text x={195.5} y={212} fontSize={31} textLength={163} lengthAdjust="spacingAndGlyphs">
            {edition}
          </text>
        )}
      </g>
    </svg>
  );
};

function useTimeout(fn: () => void, ms: number) {
  const onTimeout = useEffectEvent(fn);
  useEffect(() => {
    const t = setTimeout(() => onTimeout(), ms);
    return () => clearTimeout(t);
  }, [ms]);
}

function Boot() {
  useTimeout(toLogin, 3200);
  return (
    <div className="boot" onClick={toLogin}>
      <Logo edition="Professional" />
      <div className="boot-bar">
        <i />
      </div>
    </div>
  );
}
function toLogin() {
  freshBoot = true;
  go("login");
}

function Welcome({ left, right, footer }: { left?: ReactNode; right?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="welcome">
      <header />
      <main>
        <div className="welcome-left">{left}</div>
        <div className="welcome-right">{right}</div>
      </main>
      <footer>{footer}</footer>
    </div>
  );
}

function Login() {
  const userName = useSettings((s) => s.userName);
  const [loading, setLoading] = useState(false);
  const logon = () => {
    if (loading) return;
    unlockAudio(); // this click is the gesture that lets the startup sound play a moment later
    setLoading(true);
    setTimeout(() => {
      go("desktop");
      play(freshBoot ? "startup" : "logon");
      freshBoot = false;
    }, 1400);
  };
  return (
    <Welcome
      left={
        <>
          <Logo />
          <p>To begin, click your user name</p>
        </>
      }
      right={
        <button className={cls("user-tile flat", loading && "loading")} onClick={logon}>
          <Icon name="user" size={48} />
          <span>
            <b>{userName}</b>
            {loading && <small>Loading your personal settings...</small>}
          </span>
        </button>
      }
      footer={
        <>
          <button className="power-button flat" onClick={() => openEndDialog("shutdown")}>
            <Icon name="shutdown" size={26} />
            Turn off computer
          </button>
          <p>
            After you log on, you can add or change accounts.
            <br />
            Just go to Control Panel and click User Accounts.
          </p>
        </>
      }
    />
  );
}

const LEAVING: Partial<Record<Phase, [text: string, next: Phase, sound: Sound]>> = {
  logoff: ["logging off...", "login", "logoff"],
  shutdown: ["Windows is shutting down...", "off", "shutdown"],
  restart: ["Windows is shutting down...", "boot", "shutdown"],
};
function Leaving({ phase }: { phase: Phase }) {
  const [text, next, sound] = LEAVING[phase]!;
  useEffect(() => {
    play(sound);
  }, [sound]);
  useTimeout(() => go(next), 2600);
  return <Welcome left={<Logo />} right={<p className="leaving">{text}</p>} />;
}

/** Black screen for Turn Off and Stand By; any click or key brings the machine back. */
function Dark({ standby }: { standby: boolean }) {
  useEffect(() => {
    const wake = () => go(standby ? "desktop" : "boot");
    addEventListener("keydown", wake);
    return () => removeEventListener("keydown", wake);
  }, [standby]);
  return (
    <div className="dark" onClick={() => go(standby ? "desktop" : "boot")}>
      {!standby && <span>Click anywhere to turn on the computer.</span>}
    </div>
  );
}

export function SessionScreen({ phase }: { phase: Phase }) {
  if (phase === "boot") return <Boot />;
  if (phase === "login") return <Login />;
  if (phase === "standby" || phase === "off") return <Dark standby={phase === "standby"} />;
  return <Leaving phase={phase} />;
}

export function EndDialogHost() {
  const dialog = useEndDialog((s) => s.dialog);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") openEndDialog(null);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  if (!dialog) return null;
  const end = (phase: Phase, keepWindows = false) => {
    openEndDialog(null);
    if (!keepWindows) useWindows.getState().closeAll();
    go(phase);
  };
  const buttons: [string, string, () => void][] =
    dialog === "logoff"
      ? [
          ["Switch User", "switchuser", () => end("login", true)],
          ["Log Off", "logoff", () => end("logoff")],
        ]
      : [
          ["Stand By", "standby", () => end("standby", true)],
          ["Turn Off", "shutdown", () => end("shutdown")],
          ["Restart", "restart", () => end("restart")],
        ];
  return (
    <div className="end-overlay">
      <div className="end-dialog">
        <header>
          {dialog === "logoff" ? "Log Off Windows" : "Turn off computer"}
          <Icon name="start" size={30} />
        </header>
        <div className="end-buttons">
          {buttons.map(([label, icon, act]) => (
            <button key={label} className="flat" onClick={act}>
              <Icon name={icon} size={34} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <footer>
          <button onClick={() => openEndDialog(null)}>Cancel</button>
        </footer>
      </div>
    </div>
  );
}
