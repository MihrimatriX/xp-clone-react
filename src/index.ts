import index from "./index.html";

const PUBLIC = `${import.meta.dir}/../public`;
const NO_CACHE = { "Cache-Control": "no-cache" };

async function firstExisting(base: string, exts: string[]) {
  for (const ext of exts) {
    const file = Bun.file(`${base}.${ext}`);
    if (await file.exists()) return file;
  }
}

// Absolute origin for canonical/og:url/og:image; crawlers ignore relative URLs there.
function siteUrl(req: Request) {
  // TODO(human)
  return process.env.SITE_URL!;
}

const server = Bun.serve({
  routes: {
    // The bundled page sits at a hidden path so every page request can fetch it and fill in %SITE_URL%.
    // ponytail: one loopback fetch per page view; cache the text if traffic ever makes that measurable.
    "/_index": index,
    "/*": async (req): Promise<Response> => {
      const html = await (await fetch(new URL("/_index", server.url))).text();
      return new Response(html.replaceAll("%SITE_URL%", siteUrl(req)), {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    },
    "/og.png": Bun.file(`${PUBLIC}/og.png`),
    "/robots.txt": Bun.file(`${PUBLIC}/robots.txt`),
    // The original Bliss photo is copyrighted, so it isn't shipped. Your own copy at
    // public/wallpapers/bliss.(jpg|png|bmp|webp) replaces the drawn look-alike.
    "/wallpapers/bliss": async () =>
      new Response(
        (await firstExisting(`${PUBLIC}/wallpapers/bliss`, ["jpg", "png", "bmp", "webp"])) ??
          Bun.file(`${import.meta.dir}/assets/wallpapers/hill.svg`),
        { headers: NO_CACHE },
      ),
    // Optional sound files; 204 (not 404) when missing keeps the browser console clean.
    "/sounds/:name": async (req) => {
      const file = /^[a-z]+$/.test(req.params.name)
        ? await firstExisting(`${PUBLIC}/sounds/${req.params.name}`, ["wav", "mp3", "ogg"])
        : undefined;
      return file ? new Response(file, { headers: NO_CACHE }) : new Response(null, { status: 204 });
    },
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`XP clone running at ${server.url}`);
