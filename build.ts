// `bun build` on the CLI can't take plugins, so the static build goes through the API.
import { rmSync } from "fs";
import xpCssFix from "./xp-css-fix";

rmSync("./dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "linked",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [xpCssFix],
});
for (const log of result.logs) console.error(log);
if (!result.success) process.exit(1);

// Same %SITE_URL% fill-in the server does per request; without SITE_URL the links stay root-relative.
const html = await Bun.file("./dist/index.html").text();
await Bun.write("./dist/index.html", html.replaceAll("%SITE_URL%", process.env.SITE_URL?.replace(/\/$/, "") ?? ""));
for (const f of ["og.png", "robots.txt"]) await Bun.write(`./dist/${f}`, Bun.file(`./public/${f}`));
// Frozen copy of the server's /wallpapers/bliss route. Only a photo: an extensionless SVG wouldn't render on a static host.
for (const ext of ["jpg", "png", "bmp", "webp"]) {
  const photo = Bun.file(`./public/wallpapers/bliss.${ext}`);
  if (await photo.exists()) {
    await Bun.write("./dist/wallpapers/bliss", photo);
    break;
  }
}
console.log(result.outputs.map((o) => `${o.path.split(/[\\/]/).at(-1)}  ${(o.size / 1024).toFixed(1)} KB`).join("\n"));
