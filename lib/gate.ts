/**
 * Shared bits for the simple site access gate (see proxy.ts and
 * app/api/login/route.ts). Plain values only — no next/server import — so both
 * the proxy and a route handler can use them.
 */

export const GATE_COOKIE = "jd_gate"

/**
 * Secrets come from the environment only — nothing is hardcoded in source, so
 * the committed repo never contains the password. Set them in `.env.local`
 * locally and in the Vercel project env for production:
 *   SITE_PASSWORD  the access answer
 *   GATE_TOKEN     a random opaque value stored in the cookie (optional; falls
 *                  back to SITE_PASSWORD so a single variable is enough to run)
 *
 * If SITE_PASSWORD is unset the gate is fail-closed: no answer is accepted.
 */
export function sitePassword(): string {
  return process.env.SITE_PASSWORD ?? ""
}

/** Opaque token held in the cookie — never the password itself. */
export function gateToken(): string {
  return process.env.GATE_TOKEN || process.env.SITE_PASSWORD || ""
}
