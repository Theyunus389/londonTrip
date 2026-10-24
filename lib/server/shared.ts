import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { EDIT_COOKIE, validEditor } from "./shared-security";
export function sharedDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error("Shared list needs its server configuration in Vercel.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function isEditor(req: NextRequest) {
  return validEditor(req.cookies.get(EDIT_COOKIE)?.value);
}
export function sameOrigin(req: NextRequest) {
  return req.headers.get("origin") === req.nextUrl.origin;
}
export function requireEditor(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "This request must come from the website." },
      { status: 403 },
    );
  if (!isEditor(req))
    return NextResponse.json(
      { error: "Unlock editing with the shared PIN first." },
      { status: 401 },
    );
  return null;
}
export function failure(error: unknown, status = 503) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Shared list unavailable",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
