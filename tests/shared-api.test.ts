import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  editorToken,
  validEditor,
  EDIT_COOKIE,
} from "../lib/server/shared-security";
import { newPlace } from "../lib/model";
const mock = vi.hoisted(() => ({ allowed: true, writes: 0 }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (name: string) => ({
      data: name === "consume_shared_pin_attempt" ? mock.allowed : 1,
      error: null,
    }),
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      upsert: async () => {
        mock.writes++;
        return { error: null };
      },
    }),
  }),
}));
import { GET, POST } from "../app/api/shared/route";
import { POST as unlock } from "../app/api/shared/unlock/route";
import { POST as upload } from "../app/api/shared/photos/route";
import { POST as lock } from "../app/api/shared/lock/route";
beforeEach(() => {
  vi.stubEnv("SHARED_EDIT_PIN", "0079");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-server-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  mock.allowed = true;
  mock.writes = 0;
});
afterEach(() => vi.unstubAllEnvs());
const request = (
  path: string,
  body: unknown,
  cookie?: string,
  origin = "https://planner.test",
) =>
  new NextRequest("https://planner.test" + path, {
    method: "POST",
    headers: {
      origin,
      "Content-Type": "application/json",
      ...(cookie ? { cookie: `${EDIT_COOKIE}=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
it("allows public reads but locks anonymous writes", async () => {
  const r = await GET(new NextRequest("https://planner.test/api/shared"));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ places: [], canEdit: false });
  const denied = await POST(
    request("/api/shared", {
      action: "save",
      payload: { place: { ...newPlace(), name: "Not allowed" } },
    }),
  );
  expect(denied.status).toBe(401);
  expect(mock.writes).toBe(0);
});
it("preserves a leading zero PIN and issues only an HTTP-only signed cookie", async () => {
  expect(
    (await unlock(request("/api/shared/unlock", { pin: "79" }))).status,
  ).toBe(401);
  const r = await unlock(request("/api/shared/unlock", { pin: "0079" }));
  expect(r.status).toBe(200);
  const cookie = r.cookies.get(EDIT_COOKIE);
  expect(validEditor(cookie?.value)).toBe(true);
  expect(r.headers.get("set-cookie")).toContain("HttpOnly");
  expect(r.headers.get("set-cookie")).toContain("SameSite=strict");
  expect(JSON.stringify(await r.json())).not.toContain("0079");
});
it("honours persistent throttling before accepting even a correct PIN", async () => {
  mock.allowed = false;
  expect(
    (await unlock(request("/api/shared/unlock", { pin: "0079" }))).status,
  ).toBe(429);
});
it("rejects forged/expired cookies and invalidates sessions after PIN rotation", () => {
  const good = editorToken();
  expect(validEditor(good)).toBe(true);
  expect(validEditor(good + "x")).toBe(false);
  expect(validEditor(editorToken(Date.now() - 9 * 60 * 60 * 1000))).toBe(false);
  vi.stubEnv("SHARED_EDIT_PIN", "different");
  expect(validEditor(good)).toBe(false);
});
it("checks PIN cookie, origin and full place validation before writing", async () => {
  const cookie = editorToken();
  expect(
    (
      await POST(
        request(
          "/api/shared",
          { action: "save", payload: {} },
          cookie,
          "https://attacker.test",
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        request(
          "/api/shared",
          { action: "save", payload: { place: { name: "Invalid" } } },
          cookie,
        ),
      )
    ).status,
  ).toBe(400);
  const r = await POST(
    request(
      "/api/shared",
      {
        action: "save",
        payload: { place: { ...newPlace(), name: "Allowed" } },
      },
      cookie,
    ),
  );
  expect(r.status).toBe(200);
  expect(mock.writes).toBe(1);
});
it("protects uploads and rejects non-image content even when unlocked", async () => {
  expect((await upload(request("/api/shared/photos", {}))).status).toBe(401);
  const r = await upload(
    new NextRequest("https://planner.test/api/shared/photos", {
      method: "POST",
      headers: {
        origin: "https://planner.test",
        cookie: `${EDIT_COOKIE}=${editorToken()}`,
        "Content-Type": "image/webp",
      },
      body: "not an image",
    }),
  );
  expect(r.status).toBe(400);
});
it("locks the browser by expiring the cookie", async () => {
  const r = await lock(request("/api/shared/lock", {}, editorToken()));
  expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("fails closed when server secrets are missing", async () => {
  vi.stubEnv("SHARED_EDIT_PIN", "");
  expect(
    (await unlock(request("/api/shared/unlock", { pin: "0079" }))).status,
  ).toBe(503);
  expect(validEditor("anything")).toBe(false);
});

it("returns a small revision response when the shared list has not changed", async () => {
  const r = await GET(new NextRequest("https://planner.test/api/shared"));
  const etag = r.headers.get("etag");
  expect(etag).toBeTruthy();
  const unchanged = await GET(
    new NextRequest("https://planner.test/api/shared", {
      headers: { "if-none-match": etag! },
    }),
  );
  expect(unchanged.status).toBe(304);
});
