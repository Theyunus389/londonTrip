import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { newPlace, type Place } from "../lib/model";
import { matchesPlace } from "../lib/server/google-photos";
const mock = vi.hoisted(() => ({
  place: null as Place | null,
  allowed: true,
  migrationError: false,
  reservations: 0,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mock.place ? { data: mock.place } : null,
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => {
      mock.reservations++;
      return {
        data: mock.allowed,
        error: mock.migrationError ? { message: "missing" } : null,
      };
    },
  }),
}));
import { POST } from "../app/api/place-photo/route";
const upstream = vi.fn();
beforeEach(() => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "private-google-test-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-database-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  mock.place = {
    ...newPlace(),
    name: "Test Cafe",
    address: "12 Test Street, London W1D 5AH",
    lat: 51.51,
    lng: -0.13,
  };
  mock.allowed = true;
  mock.migrationError = false;
  mock.reservations = 0;
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (
  body: unknown = { id: mock.place!.id },
  origin = "https://planner.test",
) =>
  new NextRequest("https://planner.test/api/place-photo", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const candidate = () => ({
  displayName: { text: "Test Cafe" },
  formattedAddress: "12 Test Street, London W1D 5AH",
  location: { latitude: 51.51, longitude: -0.13 },
  photos: [
    {
      name: "places/venue-id/photos/photo-token",
      authorAttributions: [
        { displayName: "Jane", uri: "https://maps.google.com/contributor/123" },
      ],
    },
  ],
});
const result = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

it("makes no database reservation or Google call without a configured key", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
  expect(await (await POST(request())).json()).toEqual({
    photo: null,
    reason: "disabled",
  });
  expect(mock.reservations).toBe(0);
  expect(upstream).not.toHaveBeenCalled();
});
it("rejects external origins, malformed requests and IDs outside the saved list", async () => {
  expect((await POST(request({}, "https://other.test"))).status).toBe(403);
  expect((await POST(request({ id: "arbitrary search" }))).status).toBe(400);
  const r = request();
  mock.place = null;
  expect((await POST(r)).status).toBe(404);
  expect(mock.reservations).toBe(0);
  expect(upstream).not.toHaveBeenCalled();
});
it("keeps uploaded and bundled photographs without spending Google requests", async () => {
  mock.place!.images = ["/photos/tower-bridge.webp"];
  expect((await (await POST(request())).json()).reason).toBe("existing_photo");
  mock.place!.images = [];
  mock.place!.name = "Tower Bridge";
  expect((await (await POST(request())).json()).reason).toBe("existing_photo");
  expect(mock.reservations).toBe(0);
  expect(upstream).not.toHaveBeenCalled();
});
it("fails closed on missing SQL or an exhausted shared monthly allowance", async () => {
  mock.allowed = false;
  expect((await (await POST(request())).json()).reason).toBe("monthly_limit");
  mock.migrationError = true;
  expect((await (await POST(request())).json()).reason).toBe("setup_required");
  expect(upstream).not.toHaveBeenCalled();
});
it("reserves before one search and one media call; returns attribution and keeps keys/resource names server-side", async () => {
  upstream
    .mockResolvedValueOnce(result({ places: [candidate()] }))
    .mockResolvedValueOnce(
      result({ photoUri: "https://lh3.googleusercontent.com/places/example" }),
    );
  const response = await POST(request());
  const data = await response.json();
  expect(mock.reservations).toBe(1);
  expect(upstream).toHaveBeenCalledTimes(2);
  expect(data.photo).toEqual({
    src: "https://lh3.googleusercontent.com/places/example",
    authors: [{ name: "Jane", uri: "https://maps.google.com/contributor/123" }],
  });
  expect(JSON.stringify(data)).not.toContain("private-google-test-key");
  expect(JSON.stringify(data)).not.toContain("photo-token");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const [url, options] = upstream.mock.calls[0];
  expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
  expect(JSON.parse(options.body).textQuery).toContain("12 Test Street");
  expect(options.cache).toBe("no-store");
  expect(options.headers["X-Goog-FieldMask"]).not.toContain("*");
  expect(upstream.mock.calls[1][1].cache).toBe("no-store");
});
it("does not fetch media for a weak match or a different branch", async () => {
  const wrong = candidate();
  wrong.location.latitude = 52;
  upstream.mockResolvedValueOnce(result({ places: [wrong] }));
  expect((await (await POST(request())).json()).photo).toBeNull();
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(
    matchesPlace(mock.place!, {
      ...candidate(),
      displayName: { text: "Another Cafe" },
    }),
  ).toBe(false);
  expect(
    matchesPlace(mock.place!, {
      ...candidate(),
      formattedAddress: "London SW1A 1AA",
    }),
  ).toBe(false);
});
it("rejects unsafe attribution links/image hosts and hides upstream errors", async () => {
  const c = candidate();
  c.photos[0].authorAttributions[0].uri = "javascript:alert(1)";
  upstream
    .mockResolvedValueOnce(result({ places: [c] }))
    .mockResolvedValueOnce(
      result({ photoUri: "https://attacker.test/picture" }),
    );
  expect((await (await POST(request())).json()).photo).toBeNull();
  upstream.mockRejectedValueOnce(Error("private-google-test-key"));
  expect(await (await POST(request())).json()).toEqual({
    photo: null,
    reason: "unavailable",
  });
});
