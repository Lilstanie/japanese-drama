// Lets Node's test runner load the app's TypeScript modules unchanged.
//
// Two things TypeScript permits that Node does not: the "@/..." path alias, and
// omitting the file extension on relative imports. Both are resolved here so the
// suite needs no build step and no test framework.
import { registerHooks } from "node:module"
import { existsSync } from "node:fs"
import { dirname, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

/** First candidate that exists on disk, preserving any ?query the caller added. */
function resolveOnDisk(base, query) {
  for (const ext of CANDIDATES) {
    const candidate = base + ext
    if (existsSync(candidate)) {
      const url = pathToFileURL(candidate)
      if (query) url.search = query
      return { url: url.href, shortCircuit: true }
    }
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Tests append "?case=N" to force a fresh instance of a module that reads
    // process.env at load time; strip it before touching the filesystem.
    const [path, query] = specifier.split("?")

    if (path.startsWith("@/")) {
      const hit = resolveOnDisk(resolvePath(root, path.slice(2)), query)
      if (hit) return hit
      throw new Error(`Cannot resolve "${specifier}" from the @/ alias`)
    }

    // Relative imports inside lib/ omit the extension (./corpus).
    if (path.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const base = resolvePath(dirname(fileURLToPath(context.parentURL)), path)
      const hit = resolveOnDisk(base, query)
      if (hit) return hit
    }

    return nextResolve(specifier, context)
  },
})
