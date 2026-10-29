import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { GATE_COOKIE, gateToken } from "@/lib/gate"

/**
 * Simple whole-site access gate.
 *
 * A visitor without the auth cookie is sent to /login, which asks a single
 * question ("你的名字是？"); the correct answer (the site password) is checked
 * server-side in /api/login, which then sets the httpOnly cookie. The password
 * never reaches the browser bundle, and because this runs before every route it
 * also shields the paid API routes from strangers. The cookie holds an opaque
 * token (GATE_TOKEN), not the password, so it can't be guessed from the client.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(GATE_COOKIE)?.value
  if (token && token === gateToken()) return NextResponse.next()

  // Remember where they were heading so we can send them back after login.
  const url = request.nextUrl.clone()
  const from = url.pathname + url.search
  url.pathname = "/login"
  url.search = from && from !== "/" ? `?from=${encodeURIComponent(from)}` : ""
  return NextResponse.redirect(url)
}

export const config = {
  // Gate everything except the login page/API, Next internals, and the icons
  // and logo the login page itself needs to render.
  matcher: [
    "/((?!login|api/login|api/logout|_next/static|_next/image|icon.png|apple-icon.png|favicon.ico|logo.png).*)",
  ],
}
