import { useEffect, useEffectEvent, useRef, useState } from "react";
import { openMenuUnder, type MenuItem } from "../shell/ContextMenu";
import { msgBox } from "../shell/MessageBox";
import { Icon, cls } from "../../lib/ui";
import { useTitle } from "../shell/Window";
import { useWindows } from "../../store/windows";
import type { AppProps } from "../../lib/registry";
import { ErrorPage, HomePage, LINKS, NewTabPage } from "./InternetExplorerPages";
import "../../styles/internet-explorer.css";

const HOME = "about:home",
  NEW_TAB = "about:tabs";
const SEARCH = "https://www.google.com/search?igu=1&q="; // igu=1 is Google's own embeddable mode
// Sites that refuse to be framed (X-Frame-Options / CSP). IE's error page beats the browser's blank refusal.
const NO_FRAME =
  /(^|\.)(google|youtube|facebook|twitter|x|instagram|github|bing|microsoft|live|amazon|reddit|linkedin|netflix|apple|yahoo|duckduckgo|stackoverflow|openai|chatgpt|whatsapp|tiktok|discord|twitch|spotify)\.[a-z.]+$/;

interface Tab {
  id: number;
  history: string[];
  at: number;
  state: "loading" | "done" | "error";
  reload: number;
}
const current = (t: Tab) => t.history[t.at]!;
let nextTab = 0;

function normalize(raw: string): string {
  const t = raw.trim();
  if (!t) return HOME;
  if (/^(about:|https?:\/\/)/i.test(t))
    return t.replace(/^https?:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]+).*/i, "https://www.youtube.com/embed/$2");
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return normalize(`https://${t}`);
  return SEARCH + encodeURIComponent(t);
}
function initialState(url: string): Tab["state"] {
  if (url.startsWith("about:")) return "done";
  try {
    const u = new URL(url);
    return NO_FRAME.test(u.hostname) && !u.searchParams.has("igu") && !u.pathname.startsWith("/embed/")
      ? "error"
      : "loading";
  } catch {
    return "error";
  }
}
const makeTab = (url: string): Tab => ({ id: nextTab++, history: [url], at: 0, state: initialState(url), reload: 0 });
function titleOf(t: Tab) {
  const url = current(t);
  if (url === HOME) return "XP Desktop Home";
  if (url === NEW_TAB) return "New Tab";
  if (t.state === "error") return "Cannot find server";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function InternetExplorer({ win }: AppProps) {
  const [tabs, setTabs] = useState(() => [makeTab(normalize(win.props.url ?? HOME))]);
  const [activeId, setActiveId] = useState(tabs[0]!.id);
  const tab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  const address = useRef<HTMLInputElement>(null);
  const title = titleOf(tab);
  useTitle(win.id, `${title} - Windows Internet Explorer`);

  const patch = (id: number, fn: (t: Tab) => Partial<Tab>) =>
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)));
  const visit = (id: number, history: string[], at: number) =>
    patch(id, (t) => ({ history, at, state: initialState(history[at]!), reload: t.reload + 1 }));
  const go = (raw: string) => visit(tab.id, [...tab.history.slice(0, tab.at + 1), normalize(raw)], tab.at + 1);
  const travel = (step: number) => visit(tab.id, tab.history, tab.at + step);
  const reload = (t: Tab) => visit(t.id, t.history, t.at);
  const settle = (id: number, state: Tab["state"]) => patch(id, () => ({ state }));
  const newTab = () => {
    const t = makeTab(NEW_TAB);
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };
  const closeTab = (id: number) => {
    if (tabs.length === 1) return useWindows.getState().close(win.id);
    const i = tabs.findIndex((t) => t.id === id),
      rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (id === tab.id) setActiveId(rest[Math.max(0, i - 1)]!.id);
  };
  const favorites: MenuItem[] = LINKS.map(([label, href]) => ({ label, icon: "globe", onClick: () => go(href) }));
  const pageMenu: MenuItem[] = [
    { label: "New Tab", hint: "Ctrl+T", onClick: newTab },
    { label: "New Window", hint: "Ctrl+N", onClick: () => useWindows.getState().open("iexplore") },
    "-",
    {
      label: "Open in Real Browser Tab",
      disabled: current(tab).startsWith("about:"),
      onClick: () => window.open(current(tab), "_blank", "noopener"),
    },
  ];
  const toolsMenu: MenuItem[] = [
    {
      label: "Delete Browsing History...",
      onClick: () => setTabs((ts) => ts.map((t) => ({ ...t, history: [current(t)], at: 0 }))),
    },
    "-",
    {
      label: "About Internet Explorer",
      onClick: () =>
        msgBox("Windows Internet Explorer\nVersion 7.0\n\nPart of the XP Desktop clone.", {
          title: "About Internet Explorer",
        }),
    },
  ];

  return (
    <div className="ie">
      <div className="ie-bar">
        <button className="ie-back flat" title="Back" disabled={tab.at === 0} onClick={() => travel(-1)}>
          <Icon name="ie-back" size={30} />
        </button>
        <button className="ie-fwd flat" title="Forward" disabled={!tab.history[tab.at + 1]} onClick={() => travel(1)}>
          <Icon name="ie-forward" size={24} />
        </button>
        <form
          className="ie-field ie-address"
          onSubmit={(e) => {
            e.preventDefault();
            go(address.current!.value);
          }}
        >
          <Icon name="globe" />
          <input
            key={`${tab.id}:${tab.at}:${current(tab)}`}
            ref={address}
            defaultValue={current(tab)}
            spellCheck={false}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="flat" title="Refresh (F5)" onClick={() => reload(tab)}>
            <Icon name="refresh" />
          </button>
          <button type="button" className="flat" title="Stop (Esc)" onClick={() => settle(tab.id, "done")}>
            <Icon name="stop" />
          </button>
        </form>
        <form
          className="ie-field ie-search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            if (q) go(SEARCH + encodeURIComponent(String(q)));
          }}
        >
          <input name="q" placeholder="Google" spellCheck={false} />
          <button className="flat" title="Search">
            <Icon name="search" />
          </button>
        </form>
      </div>
      <div className="ie-tabbar">
        <button className="flat" title="Favorites Center" onClick={(e) => openMenuUnder(e, favorites)}>
          <Icon name="star" size={18} />
        </button>
        <div className="ie-tabs">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={cls("ie-tab", t.id === tab.id && "on")}
              onMouseDown={() => setActiveId(t.id)}
              title={titleOf(t)}
            >
              <Icon name={t.state === "loading" ? "refresh" : "globe"} />
              <span>{titleOf(t)}</span>
              {t.id === tab.id && (
                <button
                  className="flat"
                  title="Close Tab"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => closeTab(t.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button className="ie-tab ie-newtab flat" title="New Tab (Ctrl+T)" onClick={newTab} />
        </div>
        <div className="ie-commands">
          <button className="flat" title="Home (Alt+M)" onClick={() => go(HOME)}>
            <Icon name="home" />
          </button>
          <button className="flat" onClick={(e) => openMenuUnder(e, pageMenu)}>
            <Icon name="page" />
            Page ▾
          </button>
          <button className="flat" onClick={(e) => openMenuUnder(e, toolsMenu)}>
            <Icon name="gear" />
            Tools ▾
          </button>
        </div>
      </div>
      <div className="ie-view">
        {tabs.map((t) => (
          <div key={t.id} className="ie-page" hidden={t.id !== tab.id}>
            <Page tab={t} go={go} settle={(state) => settle(t.id, state)} retry={() => reload(t)} />
          </div>
        ))}
      </div>
      <div className="status-bar">
        <p className="status-bar-field">
          {{ loading: `Waiting for ${current(tab)}...`, error: "Cannot find server", done: "Done" }[tab.state]}
        </p>
        <p className="status-bar-field">
          <Icon name="globe" /> Internet
        </p>
        <p className="status-bar-field">100%</p>
      </div>
    </div>
  );
}

function Page(p: { tab: Tab; go: (url: string) => void; settle: (s: Tab["state"]) => void; retry: () => void }) {
  const { state, reload } = p.tab,
    url = current(p.tab);
  const timeout = useEffectEvent(() => p.settle("error"));
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => timeout(), 15_000); // unreachable hosts never fire load
    return () => clearTimeout(t);
  }, [state, reload]);
  if (url === HOME) return <HomePage go={p.go} />;
  if (url === NEW_TAB) return <NewTabPage />;
  if (state === "error") return <ErrorPage url={url} retry={p.retry} />;
  // No allow-top-navigation: framed pages can't navigate the desktop away.
  return (
    <iframe
      key={reload}
      src={url}
      title={url}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      onLoad={() => p.settle("done")}
    />
  );
}
