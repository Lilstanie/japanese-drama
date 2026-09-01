// Resolves the project's "@/..." TypeScript path alias for Node's test runner,
// which does not read tsconfig paths. Also appends the extension TypeScript
// lets you omit. Keeps the test suite dependency-free.
import { registerHooks } from "node:module"
import { existsSync } from "node:fs"
import { dirname, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context)

    // Tests append "?case=N" to force a fresh module instance when a module
    // reads process.env at load time; strip it before hitting the filesystem
    // and put it back so Node still treats each import as distinct.
    const [path, query] = specifier.slice(2).split("?")
    const base = resolvePath(root, path)

    for (const ext of CANDIDATES) {
      const candidate = base + ext
      if (existsSync(candidate)) {
        const url = pathToFileURL(candidate)
        if (query) url.search = query
        return { url: url.href, shortCircuit: true }
      }
    }
    throw new Error(`Cannot resolve "${specifier}" from the @/ alias`)
  },
})
