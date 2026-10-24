import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { placeSchema, settingsSchema, defaultSettings } from "@/lib/model";
export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      return NextResponse.json(
        { error: "Shared storage is not configured" },
        { status: 503 },
      );
    const token = req.headers.get("Authorization");
    if (!token?.startsWith("Bearer "))
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const db = createClient(url, key, {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token.slice(7));
    if (authError || !user)
      return NextResponse.json(
        { error: "Your session has expired. Sign in again." },
        { status: 401 },
      );
    if (Number(req.headers.get("content-length") || 0) > 4_000_000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 4_000_000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const body = z
      .object({
        action: z.string(),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    const p = body.payload;
    function check(error: { message: string } | null) {
      if (error) throw Error(error.message);
    }
    if (body.action === "load") {
      const { data: trips, error } = await db
        .from("trips")
        .select("*")
        .order("created_at");
      check(error);
      const list = trips || [];
      const trip = list.find((t) => t.id === p.tripId) || list[0] || null;
      if (!trip)
        return NextResponse.json({
          trips: list,
          trip: null,
          places: [],
          members: [],
          invitations: [],
        });
      const [places, members, invitations] = await Promise.all([
        db
          .from("places")
          .select("data")
          .eq("trip_id", trip.id)
          .order("created_at", { ascending: false }),
        db.from("trip_members").select("user_id,role").eq("trip_id", trip.id),
        db.from("trip_invitations").select("id,email").eq("trip_id", trip.id),
      ]);
      check(places.error);
      check(members.error);
      check(invitations.error);
      return NextResponse.json({
        trips: list,
        trip,
        places: (places.data || []).map((x) => x.data),
        members: members.data || [],
        invitations: invitations.data || [],
      });
    }
    if (body.action === "create") {
      const name = z.string().trim().min(1).max(100).parse(p.name);
      const r = await db.rpc("create_trip", {
        trip_name: name,
        trip_settings: { ...defaultSettings, name },
      });
      check(r.error);
      return NextResponse.json({ id: r.data });
    }
    if (body.action === "accept") {
      const r = await db.rpc("accept_invitations");
      check(r.error);
      return NextResponse.json({ ok: true });
    }
    const tripId = z.string().uuid().parse(p.tripId);
    if (body.action === "save" || body.action === "import") {
      const items =
        body.action === "save"
          ? [placeSchema.parse(p.place)]
          : placeSchema.array().min(1).max(200).parse(p.places);
      if (items.some((x) => x.images.some((i) => i.startsWith("data:"))))
        throw Error("Upload photos to private storage before saving");
      // RPC atomically validates membership, preserves identity and imports all-or-nothing.
      const r = await db.rpc("save_places", {
        target_trip: tripId,
        items,
        allow_update: body.action === "save",
      });
      check(r.error);
    } else if (body.action === "delete") {
      const id = z.string().uuid().parse(p.id);
      const r = await db
        .from("places")
        .delete()
        .eq("id", id)
        .eq("trip_id", tripId)
        .select("id");
      check(r.error);
      if (!r.data?.length)
        throw Error("Place no longer exists or access was removed");
    } else if (body.action === "settings") {
      const settings = settingsSchema.parse(p.settings);
      const r = await db
        .from("trips")
        .update({ settings })
        .eq("id", tripId)
        .select("id");
      check(r.error);
      if (!r.data?.length)
        throw Error("Only the trip owner can change settings");
    } else if (body.action === "invite") {
      const email = z.string().trim().email().max(320).parse(p.email);
      const r = await db.rpc("invite_companion", {
        target_trip: tripId,
        invite_email: email,
      });
      check(r.error);
    } else if (body.action === "remove-member") {
      const id = z.string().uuid().parse(p.id);
      const r = await db.rpc("remove_companion", {
        target_trip: tripId,
        member_id: id,
      });
      check(r.error);
    } else if (body.action === "revoke") {
      const id = z.string().uuid().parse(p.id);
      const r = await db
        .from("trip_invitations")
        .delete()
        .eq("trip_id", tripId)
        .eq("id", id)
        .select("id");
      check(r.error);
      if (!r.data?.length)
        throw Error("Invitation not found or owner permission required");
    } else
      return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : e instanceof Error
          ? e.message
          : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
