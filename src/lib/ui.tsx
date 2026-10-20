/** Icons are CSS classes (.ico-*) mapped to SVG files in styles/global.css. */
export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <i className={`ico ico-${name}`} style={{ width: size, height: size }} />;
}

export const cls = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
