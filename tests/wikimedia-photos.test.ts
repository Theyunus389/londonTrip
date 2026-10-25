import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { newPlace, type Place } from "../lib/model";
import { licensedPhoto, matchesArticle } from "../lib/server/wikimedia-photos";
const mock = vi.hoisted(() => ({ place: null as Place | null }));
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
    // No Google quota table, RPC or extra migration is needed.
  }),
}));
import { POST } from "../app/api/place-photo/route";
const upstream = vi.fn();
beforeEach(() => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "old-key-must-never-be-used");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-database-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  mock.place = {
    ...newPlace(),
    name: "Test Cafe",
    address: "12 Test Street, London W1D 5AH",
    lat: 51.51,
    lng: -0.13,
  };
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
const article = () => ({
  title: "Test Cafe",
  pageimage: "Test Cafe.jpg",
  coordinates: [{ lat: 51.51, lon: -0.13 }],
});
const file = () => ({
  mediatype: "BITMAP",
  thumburl: "https://upload.wikimedia.org/wikipedia/commons/0/00/Test_Cafe.jpg",
  descriptionurl: "https://commons.wikimedia.org/wiki/File:Test_Cafe.jpg",
  extmetadata: {
    Artist: {
      value:
        '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane &amp; Co</a>',
    },
    LicenseShortName: { value: "CC BY-SA 4.0" },
    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
});
const result = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const searchResult = (a = article()) => ({ query: { pages: { "1": a } } });
const fileResult = () => ({
  query: { pages: { "2": { imageinfo: [file()] } } },
});

it("uses the free Wikimedia APIs with no Google key, billing RPC or extra migration, and caches upstream metadata", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
  upstream
    .mockResolvedValueOnce(result(searchResult()))
    .mockResolvedValueOnce(result(fileResult()));
  const response = await POST(request());
  const data = await response.json();
  expect(data.photo.author).toBe("Jane & Co");
  expect(data.photo.licenseUrl).toBe(
    "https://creativecommons.org/licenses/by-sa/4.0/",
  );
  expect(data.photo.sourceUrl).toContain("commons.wikimedia.org/wiki/File:");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(upstream).toHaveBeenCalledTimes(2);
  for (const [url, options] of upstream.mock.calls) {
    expect(["en.wikipedia.org", "commons.wikimedia.org"]).toContain(
      new URL(url).hostname,
    );
    expect(options.cache).toBe("force-cache");
    expect(options.next.revalidate).toBe(86400);
    expect(JSON.stringify(options)).not.toContain("private-database-test-key");
  }
});
it("ignores even a previously configured Google key", async () => {
  upstream
    .mockResolvedValueOnce(result(searchResult()))
    .mockResolvedValueOnce(result(fileResult()));
  const data = await (await POST(request())).json();
  expect(data.photo).not.toBeNull();
  expect(JSON.stringify(data)).not.toContain("old-key");
  expect(
    upstream.mock.calls.every(([url]) => !String(url).includes("google")),
  ).toBe(true);
});
it("rejects external origins, malformed requests and IDs outside the saved public list", async () => {
  expect((await POST(request({}, "https://other.test"))).status).toBe(403);
  expect((await POST(request({ id: "arbitrary search" }))).status).toBe(400);
  const r = request();
  mock.place = null;
  expect((await POST(r)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
});
it("preserves uploaded and bundled photographs without doing a lookup", async () => {
  mock.place!.images = ["/photos/tower-bridge.webp"];
  expect((await (await POST(request())).json()).reason).toBe("existing_photo");
  mock.place!.images = [];
  mock.place!.name = "Tower Bridge";
  expect((await (await POST(request())).json()).reason).toBe("existing_photo");
  expect(upstream).not.toHaveBeenCalled();
});
it("rejects another branch, an overseas chain image, weak names and logos before requesting file metadata", async () => {
  const a = article();
  a.coordinates[0].lat = 50;
  upstream.mockResolvedValueOnce(result(searchResult(a)));
  expect((await (await POST(request())).json()).photo).toBeNull();
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(
    matchesArticle(mock.place!, { ...article(), title: "Another Cafe" }),
  ).toBe(false);
  expect(matchesArticle({ ...mock.place!, lat: null, lng: null }, a)).toBe(
    false,
  );
  expect(matchesArticle(mock.place!, { ...article(), coordinates: [] })).toBe(
    false,
  );
  upstream.mockResolvedValueOnce(
    result(searchResult({ ...article(), pageimage: "Test Cafe logo.png" })),
  );
  expect((await (await POST(request())).json()).photo).toBeNull();
  expect(upstream).toHaveBeenCalledTimes(2);
});
it("requires supported free licences, safe Wikimedia URLs, a bitmap and complete credits", () => {
  expect(licensedPhoto(file())).not.toBeNull();
  for (const bad of [
    { ...file(), thumburl: "javascript:alert(1)" },
    { ...file(), thumburl: "https://attacker.test/photo" },
    { ...file(), descriptionurl: "https://attacker.test/source" },
    { ...file(), mediatype: "DRAWING" },
    { ...file(), extmetadata: {} },
    {
      ...file(),
      extmetadata: {
        ...file().extmetadata,
        LicenseUrl: { value: "https://example.com/all-rights-reserved" },
      },
    },
  ])
    expect(licensedPhoto(bad)).toBeNull();
});
it("does not return upstream errors and retains the illustration on source failure", async () => {
  upstream.mockRejectedValueOnce(Error("internal account details"));
  expect(await (await POST(request())).json()).toEqual({
    photo: null,
    reason: "unavailable",
  });
});
