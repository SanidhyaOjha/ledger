import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: `base` must match your GitHub repo name for Pages to work.
// If your repo is github.com/<you>/ledger  →  base: "/ledger/"
// SETUP.md explains this. Change it there if you name the repo differently.
export default defineConfig({
  plugins: [react()],
  base: "/ledger/",
});
