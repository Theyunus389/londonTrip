import { test, expect } from "@playwright/test";
import { sharedFixture } from "./shared-fixture";
import { newPlace } from "../../lib/model";
import { readFileSync } from "node:fs";

const places = [
  {
    ...newPlace(),
    name: "Museum stop",
    category: "Activities" as const,
    lat: 51.51,
    lng: -0.12,
  },
  { ...newPlace(), name: "Lunch stop", lat: 51.515, lng: -0.125 },
  { ...newPlace(), name: "Address to confirm" },
];
// A small, explicitly fake basemap exercises actual WebGL/worker rendering
// without depending on the external map service or downloading real tiles.
const style = {
  version: 8,
  sources: {
    roads: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [-0.14, 51.5],
                [-0.11, 51.525],
              ],
            },
          },
        ],
      },
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f5f6f7" },
    },
    {
      id: "roads",
      type: "line",
      source: "roads",
      paint: { "line-color": "#d4d8dc", "line-width": 3 },
    },
  ],
};

test("light map renders with its bundled worker, markers, filters and controls, and cleans up on navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await sharedFixture(places).attach(page);
  await page.route("**/api/place-photo", (route) =>
    route.fulfill({ json: { photo: null } }),
  );
  await page.route("https://tiles.openfreemap.org/styles/positron", (route) =>
    route.fulfill({
      json: style,
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.goto("/#map");
  const map = page.locator(".leaflet-map");
  await expect(map).toHaveAttribute("data-basemap", "light");
  await expect(map.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
  await expect(page.locator(".map-legend")).toContainText(
    "2 on map · 1 without coordinates",
  );
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "OpenFreeMap",
  );
  await expect(
    page.locator(".leaflet-bottom.leaflet-right .leaflet-control-zoom"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Food");
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page.locator(".leaflet-marker-icon").click();
  await expect(page.locator(".map-popup")).toContainText("Lunch stop");
  await expect(
    page
      .locator(".map-popup")
      .getByRole("link", { name: "Walking directions" }),
  ).toHaveAttribute("href", /destination=51.515%2C-0.125/);
  await page.getByRole("link", { name: "Places", exact: true }).click();
  await expect(page.locator(".leaflet-map")).toHaveCount(0);
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".leaflet-map")).toHaveAttribute(
    "data-basemap",
    "light",
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("unavailable vector style falls back to raster while keeping markers usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await sharedFixture(places).attach(page);
  await page.route("**/api/place-photo", (route) =>
    route.fulfill({ json: { photo: null } }),
  );
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  const image = readFileSync("public/photos/tower-bridge.webp");
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/webp", body: image }),
  );
  await page.goto("/#map");
  await expect(page.locator(".leaflet-map")).toHaveAttribute(
    "data-basemap",
    "standard",
  );
  await expect(
    page.locator(".map-raster-fallback .leaflet-tile-loaded").first(),
  ).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
  await expect(page.locator(".leaflet-control-attribution")).not.toContainText(
    "OpenFreeMap",
  );
  await page.locator(".leaflet-marker-icon").first().click();
  await expect(page.locator(".map-popup")).toBeVisible();
  await page.getByRole("link", { name: "Places", exact: true }).click();
  expect(errors).toEqual([]);
});
