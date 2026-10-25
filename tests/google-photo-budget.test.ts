import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("enforces an atomic, UTC-month, service-only request cap that cannot exceed 800", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250003_google_photos.sql",
        "utf8",
      ),
    );
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.google_photo_usage"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.reserve_google_photo_request(800)"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role authenticated");
    await expect(
      db.query("select public.reserve_google_photo_request(800)"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role service_role");
    const reserve = async (cap: number) =>
      (
        await db.query<{ ok: boolean }>(
          "select public.reserve_google_photo_request($1) as ok",
          [cap],
        )
      ).rows[0].ok;
    expect(await reserve(0)).toBe(false);
    expect(await reserve(2)).toBe(true);
    expect(await reserve(2)).toBe(true);
    expect(await reserve(2)).toBe(false);
    expect(await reserve(1)).toBe(false);
    await db.exec(
      "reset role;update public.google_photo_usage set requests=799;set role service_role",
    );
    expect(await reserve(10000)).toBe(true);
    expect(await reserve(10000)).toBe(false);
    await db.exec(
      "reset role;update public.google_photo_usage set month=(month-interval '1 month')::date;set role service_role",
    );
    expect(await reserve(2)).toBe(true);
    expect(await reserve(2)).toBe(true);
    expect(await reserve(2)).toBe(false);
    await db.exec("reset role");
    const rows = await db.query<{ requests: number }>(
      "select requests from public.google_photo_usage order by month",
    );
    expect(rows.rows.map((x) => x.requests)).toEqual([800, 2]);
  } finally {
    await db.close();
  }
});
