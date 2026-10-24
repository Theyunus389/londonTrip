import { test, expect, type Page } from "@playwright/test";
import { sharedFixture, unlock } from "./shared-fixture";
const sample = [
  {
    name: "Tower Bridge",
    category: "Activities",
    subcategory: "Sightseeing & Landmarks",
    images: [
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Tower_Bridge_at_Dawn.jpg/960px-Tower_Bridge_at_Dawn.jpg",
    ],
    area: "Southwark",
    lat: 51.5056,
    lng: -0.0753,
    notes: "Walk by the river",
    favorite: true,
  },
  {
    name: "Our cafe",
    category: "Food",
    subcategory: "Coffee & Drinks",
    area: "Soho",
  },
];
async function seed(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Add your places" }),
  ).toBeVisible();
  await unlock(page);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Or paste your list").fill(JSON.stringify(sample));
  await d.getByRole("button", { name: "Preview import" }).click();
  await d.getByRole("button", { name: "Import 2 places" }).click();
  await expect(page.locator("article")).toHaveCount(2);
}
test("simple filters, map, pictures and public viewing", async ({ page }) => {
  const server = sharedFixture();
  await server.attach(page);
  await seed(page);
  await expect(page.getByText("Trip budget")).toHaveCount(0);
  await expect(page.locator("input[type=email]")).toHaveCount(0);
  await expect(
    page.locator("article").filter({ hasText: "Tower Bridge" }).locator("img"),
  ).toHaveAttribute("src", "/photos/tower-bridge.webp");
  await expect(
    page.locator("article").filter({ hasText: "Our cafe" }),
  ).toContainText("Category illustration");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Food");
  await page
    .getByRole("combobox", { name: "Subcategory", exact: true })
    .selectOption("Coffee & Drinks");
  await page.getByRole("textbox", { name: "Search places" }).fill("soho");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Favourites", exact: true }).check();
  await expect(page.getByText("No matching places")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page.locator(".leaflet-marker-icon").click();
  await expect(page.locator(".map-popup a")).toHaveAttribute(
    "href",
    /destination=51.5056%2C-0.0753/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("PIN-gated CRUD, photo uploads, notes and persistence", async ({
  page,
}) => {
  const server = sharedFixture();
  await server.attach(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unlock editing" }),
  ).toBeVisible();
  await page.getByRole("dialog").getByLabel("Shared editing PIN").fill("wrong");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Unlock editing", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Incorrect PIN",
  );
  await page.getByRole("dialog").getByLabel("Shared editing PIN").fill("0079");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Unlock editing", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Place name *").fill("Test cafe");
  await d
    .locator("input[type=file]")
    .setInputFiles("public/photos/tower-bridge.webp");
  await expect(d.getByRole("button", { name: "Remove photo 1" })).toBeVisible();
  await d.getByRole("button", { name: "Save place", exact: true }).click();
  await expect.poll(() => server.uploads).toBe(1);
  await page
    .getByRole("button", { name: "Favourite Test cafe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark visited: Test cafe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View Test cafe", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Remember the table");
  await d.getByRole("button", { name: "Save notes" }).click();
  await d.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Place name *")
    .fill("Updated cafe");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save place", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfavourite Updated cafe" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Updated cafe" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Remember the table");
  await expect(
    page.getByRole("dialog").locator(".detail-gallery img"),
  ).toHaveAttribute("src", /api\/shared\/photos/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete place", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete place?" })
    .getByRole("button", { name: "Delete place", exact: true })
    .click();
  await expect(page.locator("article")).toHaveCount(0);
});
test("any viewer can export; repeated import reports duplicates", async ({
  page,
}) => {
  const server = sharedFixture();
  await server.attach(page);
  await seed(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup).toHaveLength(2);
  expect(
    backup.find((p: { name: string }) => p.name === "Tower Bridge"),
  ).toMatchObject({ notes: "Walk by the river", favorite: true });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Or paste your list")
    .fill(JSON.stringify(backup));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Preview import" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("0 valid places");
});
test("cloud failure keeps the editor open and does not claim a local save", async ({
  page,
}) => {
  const server = sharedFixture();
  await server.attach(page);
  await page.goto("/");
  await unlock(page);
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Place name *").fill("Unsaved");
  server.failWrites = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save place", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not saved",
  );
  expect(server.places).toHaveLength(0);
});
