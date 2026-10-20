declare module "*.svg" {
  const path: `${string}.svg`; // the bundled file's URL
  export = path;
}

declare module "*.css";
