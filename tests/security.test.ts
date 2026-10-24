import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { newPlace, defaultSettings } from "../lib/model";
let db: PGlite;
let trip: string, otherTrip: string;
const owner = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003";
async function as(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function create(name: string) {
  const r = await db.query<{ id: string }>(
    "select public.create_trip($1,$2::jsonb) as id",
    [name, JSON.stringify(defaultSettings)],
  );
  return r.rows[0].id;
}
const place = {
  ...newPlace(),
  name: "Private place",
  notes: "Private notes",
  lat: 51.5,
  lng: -0.1,
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create publication supabase_realtime;`,
  );
  await db.query(
    "insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now())",
    [
      owner,
      "owner@example.com",
      member,
      "member@example.com",
      outsider,
      "outsider@example.com",
    ],
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202610240001_london_together.sql",
      "utf8",
    ),
  );
  await as(owner);
  trip = await create("Private trip");
  await as(outsider);
  otherTrip = await create("Other trip");
  await as(owner);
  await db.query("select public.save_places($1,$2::jsonb,true)", [
    trip,
    JSON.stringify([place]),
  ]);
});
afterAll(async () => {
  await db.close();
});
describe("database migrations and authorization", () => {
  it("hides private trips, notes and markers from outsiders", async () => {
    await as(outsider);
    expect(
      (await db.query("select * from public.places where trip_id=$1", [trip]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.trips where id=$1", [trip])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.save_places($1,$2::jsonb,true)", [
        trip,
        JSON.stringify([place]),
      ]),
    ).rejects.toThrow("membership");
  });
  it("prevents non-owners inviting themselves", async () => {
    await as(outsider);
    await expect(
      db.query("select public.invite_companion($1,$2)", [
        trip,
        "outsider@example.com",
      ]),
    ).rejects.toThrow("Owner");
  });
  it("accepts only invitations matching the verified signed-in email", async () => {
    await as(owner);
    await db.query("select public.invite_companion($1,$2)", [
      trip,
      "MEMBER@example.com",
    ]);
    await as(outsider);
    await db.exec("select public.accept_invitations()");
    expect(
      (await db.query("select * from public.trips where id=$1", [trip])).rows,
    ).toHaveLength(0);
    await as(member);
    await db.exec("select public.accept_invitations()");
    expect(
      (await db.query("select * from public.places where trip_id=$1", [trip]))
        .rows,
    ).toHaveLength(1);
  });
  it("lets companions edit notes and statuses while preserving the place identity", async () => {
    await as(member);
    await db.query("select public.save_places($1,$2::jsonb,true)", [
      trip,
      JSON.stringify([
        { ...place, notes: "Shared note", favorite: true, visited: true },
      ]),
    ]);
    const r = await db.query<{ data: typeof place }>(
      "select data from public.places where id=$1",
      [place.id],
    );
    expect(r.rows[0].data.notes).toBe("Shared note");
    expect(r.rows[0].data.favorite).toBe(true);
    await expect(
      db.query("update public.places set trip_id=$1 where id=$2", [
        otherTrip,
        place.id,
      ]),
    ).rejects.toThrow();
  });
  it("rejects unauthorized trip settings and membership escalation", async () => {
    await as(member);
    expect(
      (
        await db.query(
          "update public.trips set settings=$1 where id=$2 returning id",
          [JSON.stringify({ ...defaultSettings, name: "Hacked" }), trip],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update public.trip_members set role='owner' where user_id=$1", [
        member,
      ]),
    ).rejects.toThrow();
  });
  it("enforces schema validation even on direct database writes", async () => {
    await as(member);
    await expect(
      db.query("update public.places set data=$1 where id=$2", [
        JSON.stringify({ ...place, currency: "USD" }),
        place.id,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("update public.places set data=$1 where id=$2", [
        JSON.stringify({ ...place, images: ["javascript:alert(1)"] }),
        place.id,
      ]),
    ).rejects.toThrow();
  });
  it("imports atomically and prevents obvious duplicates", async () => {
    await as(member);
    const copy = { ...newPlace(), name: "Fresh place" };
    await expect(
      db.query("select public.save_places($1,$2::jsonb,false)", [
        trip,
        JSON.stringify([copy, { ...newPlace(), name: "Private place" }]),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.places where id=$1", [copy.id]))
        .rows,
    ).toHaveLength(0);
  });
  it("restricts private storage reads and writes to trip members", async () => {
    await as(member);
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('place-images',$1)",
      [`${trip}/photo.webp`],
    );
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await as(outsider);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values ('place-images',$1)",
        [`${trip}/intruder.webp`],
      ),
    ).rejects.toThrow();
  });
  it("allows members to delete places", async () => {
    await as(member);
    const p = { ...newPlace(), name: "Delete me" };
    await db.query("select public.save_places($1,$2::jsonb,true)", [
      trip,
      JSON.stringify([p]),
    ]);
    expect(
      (
        await db.query("delete from public.places where id=$1 returning id", [
          p.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("revokes access when the owner removes a companion", async () => {
    await as(owner);
    await db.query("select public.remove_companion($1,$2)", [trip, member]);
    await as(member);
    expect(
      (await db.query("select * from public.places where trip_id=$1", [trip]))
        .rows,
    ).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("blocks anonymous RPC use", async () => {
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select public.create_trip($1,$2::jsonb)", [
        "Intruder",
        JSON.stringify(defaultSettings),
      ]),
    ).rejects.toThrow("permission denied");
  });
});
