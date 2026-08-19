import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const implementation = path.resolve(here, "../implementation");

// The two files under implementation/ are the source of truth and are imported
// from there rather than copied, so the app cannot drift from what ships to Base44.
// Everything else resolves into app/src, exactly as it does inside the Base44 app.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/lib\/communicationEngine$/,
        replacement: path.join(implementation, "src/lib/communicationEngine.js"),
      },
      {
        find: /^@\/components\/shared\/StructuredRemark$/,
        replacement: path.join(implementation, "src/components/shared/StructuredRemark.jsx"),
      },
      { find: "@", replacement: path.join(here, "src") },

      // implementation/ has no node_modules of its own — the files imported from
      // there resolve their bare specifiers against this app's install.
      { find: /^react$/, replacement: path.join(here, "node_modules/react") },
      { find: /^react\/jsx-runtime$/, replacement: path.join(here, "node_modules/react/jsx-runtime") },
      { find: /^lucide-react$/, replacement: path.join(here, "node_modules/lucide-react") },
    ],
  },
  server: {
    fs: { allow: [here, implementation] },
  },
});
