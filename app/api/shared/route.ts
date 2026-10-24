import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { placeSchema } from "@/lib/model";
import {
  sharedDb,
  isEditor,
  requireEditor,
  failure,
} from "@/lib/server/shared";
const sharedPlace = placeSchema.refine(
  (p) =>
    p.images.every(
      (src) => !src.startsWith("data:") && !src.startsWith("storage:"),
    ),
  "Upload browser/private photos before sharing",
);
export async function GET(req: NextRequest) {
  try {
    const db = sharedDb();
    const revision = await db.rpc("shared_list_revision");
    if (revision.error)
      return failure(
        Error("Run the shared-list SQL migration before using this list."),
      );
    const canEdit = isEditor(req);
    const etag = `"shared-${revision.data}-${canEdit ? "edit" : "view"}"`;
    if (req.headers.get("if-none-match") === etag)
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "no-store" },
      });
    const r = await db
      .from("shared_places")
      .select("data")
      .order("created_at", { ascending: false });
    if (r.error)
      return failure(
        Error(
          "Shared list unavailable. Check the server settings and run the shared-list SQL migration.",
        ),
      );
    return NextResponse.json(
      { places: (r.data || []).map((x) => x.data), canEdit },
      { headers: { "Cache-Control": "no-store", ETag: etag } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const denied = requireEditor(req);
  if (denied) return denied;
  try {
    if (Number(req.headers.get("content-length") || 0) > 3_000_000)
      return failure(Error("Import is too large"), 413);
    const raw = await req.text();
    if (raw.length > 3_000_000)
      return failure(Error("Import is too large"), 413);
    const { action, payload } = z
      .object({
        action: z.enum(["save", "import", "delete"]),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    const db = sharedDb();
    if (action === "delete") {
      const id = z.string().uuid().parse(payload.id);
      const r = await db
        .from("shared_places")
        .delete()
        .eq("id", id)
        .select("id");
      if (r.error) throw Error("Delete failed");
      if (!r.data?.length)
        return failure(
          Error("This place was already removed. Refresh the list."),
          409,
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "import") {
      const items = sharedPlace
        .array()
        .min(1)
        .max(200)
        .parse(payload.places)
        .map((p) => ({ ...p, updatedAt: new Date().toISOString() }));
      const r = await db.rpc("import_shared_places", { items });
      if (r.error)
        throw Error("Import failed. Existing places were not overwritten.");
      return NextResponse.json({ ok: true, count: r.data });
    }
    const p = sharedPlace.parse(payload.place);
    const r = await db
      .from("shared_places")
      .upsert(
        { id: p.id, data: { ...p, updatedAt: new Date().toISOString() } },
        { onConflict: "id" },
      );
    if (r.error)
      throw Error(
        r.error.code === "23505"
          ? "A place with this name is already saved."
          : "Save failed. Please retry.",
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(
      e instanceof z.ZodError
        ? Error(e.issues.map((i) => i.message).join("; "))
        : e,
      400,
    );
  }
}
