import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { newPlace } from "../../lib/model";
import { sharedFixture } from "./shared-fixture";

test("free photos load lazily, reuse cached results in details and map, show licence credits and fail gracefully", async ({
  page,
}) => {
  const places = Array.from({ length: 18 }, (_, i) => ({
    ...newPlace(),
    name: `Photo Cafe ${i + 1}`,
    lat: 51.51 + i * 0.001,
    lng: -0.13,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const server = sharedFixture(places);
  await server.attach(page);
  const ids: string[] = [];
  const image = readFileSync("public/photos/tower-bridge.webp");
  await page.route("https://upload.wikimedia.org/**", (route) =>
    route.fulfill({ contentType: "image/webp", body: image }),
  );
  await page.route("**/api/place-photo", async (route) => {
    const { id } = route.request().postDataJSON();
    ids.push(id);
    await route.fulfill({
      json: {
        photo:
          id === places[1].id
            ? null
            : {
                src: `https://upload.wikimedia.org/wikipedia/commons/0/00/${id}.webp`,
                author: "Example Photographer",
                sourceUrl:
                  "https://commons.wikimedia.org/wiki/File:Example.webp",
                license: "CC BY-SA 4.0",
                licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
              },
      },
    });
  });
  await page.goto("/");
  const first = page.locator("article").first();
  await expect(first.locator(".photo > img")).toHaveAttribute(
    "src",
    /upload.wikimedia/,
  );
  await expect(
    first.getByRole("link", { name: "Wikimedia Commons" }),
  ).toBeVisible();
  expect(ids).toContain(places[0].id);
  expect(ids).not.toContain(places.at(-1)!.id);
  await expect(page.locator("button a")).toHaveCount(0);
  await page.locator("article").nth(1).scrollIntoViewIfNeeded();
  await expect(page.locator("article").nth(1)).toContainText(
    "Category illustration",
  );
  await page.locator("article").last().scrollIntoViewIfNeeded();
  await expect(
    page.locator("article").last().locator(".photo > img"),
  ).toHaveAttribute("src", /upload.wikimedia/);
  await first.scrollIntoViewIfNeeded();
  await first
    .getByRole("button", { name: "View Photo Cafe 1", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".photo > img"),
  ).toHaveAttribute("src", /upload.wikimedia/);
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "CC BY-SA 4.0" }),
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  expect(ids.filter((id) => id === places[0].id)).toHaveLength(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = Buffer.concat(chunks).toString();
  expect(exported).not.toContain("upload.wikimedia");
  expect(exported).not.toContain("Example Photographer");
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(18);
  const beforeMapDetails = ids.length;
  await page.locator(".leaflet-marker-icon").first().click();
  await page
    .locator(".map-popup")
    .getByRole("button", { name: "View place" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator(".photo > img"),
  ).toHaveAttribute("src", /upload.wikimedia/);
  await expect(page.getByRole("dialog")).toContainText("Example Photographer");
  await expect(page.getByRole("dialog")).toContainText("CC BY-SA 4.0");
  expect(ids).toHaveLength(beforeMapDetails);
});
