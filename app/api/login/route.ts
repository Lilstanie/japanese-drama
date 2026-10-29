import { NextResponse } from "next/server"
import { GATE_COOKIE, gateToken, sitePassword } from "@/lib/gate"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  // Cap attempts per IP so the gate can't be brute-forced.
  const limited = await enforceRateLimit(request, { name: "login", limit: 10, windowSec: 60 })
  if (limited) return limited

  let answer = ""
  try {
    const body = (await request.json()) as { answer?: string }
    answer = (body.answer ?? "").trim()
  } catch {
    // ignore — empty answer fails below
  }

  const expected = sitePassword()
  // Fail closed: if no password is configured, accept nothing.
  if (!expected || answer !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(GATE_COOKIE, gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
