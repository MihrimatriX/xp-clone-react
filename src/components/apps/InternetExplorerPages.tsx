import { Icon } from "../../lib/ui";

// Pages known to allow being shown in a frame.
export const LINKS: [string, string][] = [
  ["Google", "https://www.google.com/webhp?igu=1"],
  ["Wikipedia - Windows XP", "https://en.wikipedia.org/wiki/Windows_XP"],
  ["Wikipedia - Internet Explorer 7", "https://en.wikipedia.org/wiki/Internet_Explorer_7"],
  ["Example Domain", "https://example.com/"],
];

export function HomePage({ go }: { go: (url: string) => void }) {
  return (
    <div className="ie-doc ie-home">
      <header>
        <Icon name="globe" size={48} />
        <div>
          <h1>XP Desktop Home</h1>
          <p>Your start page in Windows Internet Explorer 7</p>
        </div>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q"));
          if (q.trim()) go(q);
        }}
      >
        <input type="text" name="q" placeholder="Search the Web or type an address" />
        <button type="submit">Search</button>
      </form>
      <h2>Favorites</h2>
      <ul>
        {LINKS.map(([label, href]) => (
          <li key={href}>
            <Icon name="globe" />
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                go(href);
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="ie-note">
        Many big websites refuse to appear inside another page. When that happens Internet Explorer says so, and Page ▸
        Open in Real Browser Tab opens it for real.
      </p>
    </div>
  );
}

export function NewTabPage() {
  return (
    <div className="ie-doc">
      <h1>What do you want to do with tabs?</h1>
      <ul className="ie-tips">
        <li>To open a new tab, click the empty tab to the right of the last tab.</li>
        <li>To close a tab, click the Close button on the tab.</li>
        <li>To see the website you came from, use the Back button.</li>
      </ul>
    </div>
  );
}

export function ErrorPage({ url, retry }: { url: string; retry: () => void }) {
  return (
    <div className="ie-doc ie-error">
      <h1>
        <Icon name="info" size={32} />
        Internet Explorer cannot display the webpage
      </h1>
      <h2>Most likely causes:</h2>
      <ul>
        <li>You are not connected to the Internet.</li>
        <li>The website is encountering problems.</li>
        <li>The website does not allow itself to be displayed inside another page.</li>
        <li>There might be a typing error in the address.</li>
      </ul>
      <h2>What you can try:</h2>
      <ul className="ie-try">
        <li>
          <button className="flat" onClick={retry}>
            Diagnose Connection Problems
          </button>
        </li>
        <li>
          <button className="flat" onClick={() => window.open(url, "_blank", "noopener")}>
            Open the page in a real browser tab
          </button>
        </li>
      </ul>
    </div>
  );
}
