import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, failure } from "@/lib/server/shared";
import { EDIT_COOKIE } from "@/lib/server/shared-security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return failure(Error("Request origin is not allowed"), 403);
  const r = NextResponse.json({ ok: true });
  r.cookies.set(EDIT_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return r;
}
