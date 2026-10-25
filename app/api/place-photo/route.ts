import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { placeSchema } from "@/lib/model";
import { knownPhoto } from "@/lib/place-photos";
import { sharedDb, sameOrigin } from "@/lib/server/shared";
import { findGooglePhoto } from "@/lib/server/google-photos";

const reply = (photo: unknown = null, reason?: string, status = 200) =>
  NextResponse.json(
    { photo, ...(reason ? { reason } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply(null, "origin", 403);
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return reply(null, "disabled");
  try {
    const raw = await req.text();
    if (raw.length > 100) return reply(null, "invalid", 400);
    const { id } = z.object({ id: z.string().uuid() }).parse(JSON.parse(raw));
    const db = sharedDb();
    // Only existing public list entries are eligible; this is not an open search proxy.
    const row = await db
      .from("shared_places")
      .select("data")
      .eq("id", id)
      .maybeSingle();
    if (row.error) return reply(null, "unavailable");
    if (!row.data) return reply(null, "not_found", 404);
    const place = placeSchema.parse(row.data.data);
    if (place.images.length || knownPhoto(place.name))
      return reply(null, "existing_photo");
    // Atomic database reservation shared across every visitor and server instance.
    // A reservation permits at most one Text Search and one Photo Media request.
    const configured = Number(process.env.GOOGLE_PLACES_MONTHLY_LIMIT || 800);
    const limit = Number.isFinite(configured)
      ? Math.max(0, Math.min(800, Math.floor(configured)))
      : 800;
    const budget = await db.rpc("reserve_google_photo_request", {
      request_limit: limit,
    });
    if (budget.error) return reply(null, "setup_required");
    if (!budget.data) return reply(null, "monthly_limit");
    return reply(await findGooglePhoto(place, key));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply(null, "invalid", 400);
    // Never expose upstream errors, headers or keys. Photo failures don't break the list.
    return reply(null, "unavailable");
  }
}
