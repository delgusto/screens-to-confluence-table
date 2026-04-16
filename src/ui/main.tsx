// Styles are compiled separately by the Tailwind CLI in build.mjs and
// inlined into ui.html — don't import the CSS file here.
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
