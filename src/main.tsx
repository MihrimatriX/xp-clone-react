import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "xp.css/dist/XP.css";
import "./styles/global.css";
import { App } from "./App";

// Reusing the root across hot reloads keeps React state instead of remounting.
const root = (import.meta.hot.data.root ??= createRoot(document.getElementById("root")!));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
