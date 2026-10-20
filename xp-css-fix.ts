import type { BunPlugin } from "bun";

// xp.css 0.2.6 ships selectors like `progress:not([value]):before:not([value])`, which Bun's
// spec-strict CSS parser rejects. The trailing :not() is redundant, so it is dropped on load.
export default {
  name: "xp-css-fix",
  setup(build) {
    build.onLoad({ filter: /xp\.css[\\/]dist[\\/]XP\.css$/ }, async ({ path }) => ({
      contents: (await Bun.file(path).text()).replace(/(:before|:after|::[\w-]+):not\(\[value\]\)/g, "$1"),
      loader: "css",
    }));
  },
} satisfies BunPlugin;
