import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { placeSchema } from "@/lib/model";
import { knownPhoto } from "@/lib/place-photos";
import { sharedDb, sameOrigin } from "@/lib/server/shared";
import { findWikimediaPhoto } from "@/lib/server/wikimedia-photos";

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
    return reply(await findWikimediaPhoto(place));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return reply(null, "invalid", 400);
    // Never expose upstream errors, headers or keys. Photo failures don't break the list.
    return reply(null, "unavailable");
  }
}
