import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sharedDb, requireEditor, failure } from "@/lib/server/shared";
const pattern = /^[0-9a-f-]{36}\.(webp|png|jpg)$/;
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!pattern.test(path)) return failure(Error("Photo not found"), 404);
  try {
    const r = await sharedDb()
      .storage.from("shared-place-images")
      .download(path);
    if (r.error || !r.data) return failure(Error("Photo not found"), 404);
    return new Response(r.data, {
      headers: {
        "Content-Type": r.data.type || "image/webp",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const denied = requireEditor(req);
  if (denied) return denied;
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > 2097152)
      return failure(Error("Photo must be smaller than 2 MB"), 413);
    let ext = "",
      type = "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      ext = "jpg";
      type = "image/jpeg";
    } else if (
      Buffer.from(bytes.slice(0, 8)).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      )
    ) {
      ext = "png";
      type = "image/png";
    } else if (
      Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
    ) {
      ext = "webp";
      type = "image/webp";
    } else return failure(Error("Use a JPEG, PNG or WebP photo"), 400);
    const path = randomUUID() + "." + ext;
    const r = await sharedDb()
      .storage.from("shared-place-images")
      .upload(path, bytes, { contentType: type, upsert: false });
    if (r.error) throw Error("Photo upload failed");
    return NextResponse.json({ src: "shared:" + path });
  } catch (e) {
    return failure(e);
  }
}
