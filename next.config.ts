import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin Turbopack's workspace root to this project. There is a stray
// package-lock.json in the home directory, so Next's lockfile-based root
// detection would otherwise pick `~/` — resolving and watching files from far
// outside the app, which left the dynamic /scene/[id] route intermittently
// resolving to 404. See node_modules/next/dist/docs/.../turbopack.md (`root`).
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
