import { NextRequest, NextResponse } from "next/server";
import { sharedDb, sameOrigin, failure } from "@/lib/server/shared";
import {
  EDIT_COOKIE,
  equal,
  editorToken,
  clientFingerprint,
} from "@/lib/server/shared-security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return failure(Error("Request origin is not allowed"), 403);
  try {
    const pin = process.env.SHARED_EDIT_PIN;
    if (!pin)
      return failure(Error("Set the server-only editing PIN in Vercel."), 503);
    const db = sharedDb();
    const ip =
      req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "unknown";
    const limit = await db.rpc("consume_shared_pin_attempt", {
      fingerprint: clientFingerprint(ip),
    });
    if (limit.error)
      return failure(
        Error("Apply the shared-list SQL migration before unlocking."),
      );
    if (!limit.data)
      return failure(Error("Too many attempts. Try again in 15 minutes."), 429);
    const raw = await req.text();
    if (raw.length > 1000) return failure(Error("Invalid PIN"), 400);
    let candidate: unknown;
    try {
      candidate = JSON.parse(raw).pin;
    } catch {
      return failure(Error("Invalid PIN"), 400);
    }
    if (
      typeof candidate !== "string" ||
      candidate.length > 128 ||
      !equal(candidate, pin)
    )
      return failure(Error("Incorrect PIN"), 401);
    const r = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    r.cookies.set(EDIT_COOKIE, editorToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return r;
  } catch (e) {
    return failure(e);
  }
}
