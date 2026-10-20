// Bun has no Web Storage; zustand's persist reads `window.localStorage` and warns on every set without it.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, v);
  removeItem = (k: string) => void this.m.delete(k);
}
Object.assign(globalThis, {
  window: globalThis,
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
});
