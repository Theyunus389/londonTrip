import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("keeps shared tables/service RPCs inaccessible to anonymous clients, with durable limits and atomic duplicate-safe import", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant usage on schema public to anon,authenticated,service_role;`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610250002_shared_pin_list.sql",
        "utf8",
      ),
    );
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.shared_places"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.consume_shared_pin_attempt('ip')"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role service_role");
    for (let i = 0; i < 5; i++)
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.consume_shared_pin_attempt('ip') as ok",
          )
        ).rows[0].ok,
      ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.consume_shared_pin_attempt('ip') as ok",
        )
      ).rows[0].ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.consume_shared_pin_attempt('different-ip') as ok",
        )
      ).rows[0].ok,
    ).toBe(true);
    for (let i = 0; i < 43; i++)
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.consume_shared_pin_attempt($1) as ok",
            ["ip-" + i],
          )
        ).rows[0].ok,
      ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.consume_shared_pin_attempt('over-global-limit') as ok",
        )
      ).rows[0].ok,
    ).toBe(false);
    await db.exec(
      "reset role;update public.shared_pin_attempts set started=now()-interval '16 minutes';set role service_role",
    );
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.consume_shared_pin_attempt('ip') as ok",
        )
      ).rows[0].ok,
    ).toBe(true);
    const before = (
      await db.query<{ n: number }>("select public.shared_list_revision() as n")
    ).rows[0].n;
    const items = [
      { id: "00000000-0000-4000-8000-000000000001", name: "Cafe" },
      { id: "00000000-0000-4000-8000-000000000002", name: "Cafe!" },
    ];
    const r = await db.query<{ n: number }>(
      "select public.import_shared_places($1::jsonb) as n",
      [JSON.stringify(items)],
    );
    expect(r.rows[0].n).toBe(1);
    const after = (
      await db.query<{ n: number }>("select public.shared_list_revision() as n")
    ).rows[0].n;
    expect(after).toBeGreaterThan(before);
    await db.exec("reset role;set role authenticated");
    await expect(db.query("delete from public.shared_places")).rejects.toThrow(
      "permission denied",
    );
  } finally {
    await db.close();
  }
});
