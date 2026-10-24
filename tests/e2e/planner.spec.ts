import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByText("Our London trip", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Tower Bridge" }),
  ).toBeVisible();
}
async function places(page: Page) {
  await page.getByRole("button", { name: "Explore our places" }).click();
  await expect(
    page.getByRole("heading", { name: "Every little discovery" }),
  ).toBeVisible();
}
async function add(page: Page, name: string) {
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Place name *").fill(name);
  return d;
}
test("creates, uploads a photo, edits, saves notes, persists flags, and deletes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await places(page);
  const d = await add(page, "Our test café");
  await d.getByLabel("Neighbourhood").fill("Soho");
  await d
    .getByLabel("A few words about it")
    .fill("A café for our browser test");
  await d.getByLabel("Cost type").selectOption("person");
  await d.getByLabel("Estimated cost (GBP)").fill("12.5");
  await d.getByLabel("Personal notes").fill("Try a pastry");
  await d.getByLabel("Favourite", { exact: true }).check();
  await d.getByLabel("Include in budget").check();
  await d.getByLabel("Latitude", { exact: true }).fill("51.513");
  await d.getByLabel("Longitude", { exact: true }).fill("-0.135");
  await d
    .locator("input[type=file]")
    .setInputFiles("public/photos/tower-bridge.webp");
  await expect(d.getByRole("button", { name: "Remove photo 1" })).toBeVisible();
  await d.getByRole("button", { name: "Save place", exact: true }).click();
  await expect(d).toHaveCount(0);
  const card = page.locator("article").filter({ hasText: "Our test café" });
  await expect(card.locator("img")).toBeVisible();
  await card
    .getByRole("button", { name: "Mark visited: Our test café", exact: true })
    .click();
  await card
    .getByRole("button", { name: "View Our test café", exact: true })
    .click();
  const detail = page.getByRole("dialog");
  await expect(
    detail.getByRole("button", { name: "Visited", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("link", { name: "Walking directions in Google Maps" }),
  ).toHaveAttribute("href", /destination=51.513%2C-0.135/);
  await detail
    .getByRole("textbox", { name: "A note for our future selves" })
    .fill("Book a window table");
  await detail.getByRole("button", { name: "Save notes" }).click();
  await expect(page.locator(".toast")).toContainText("Notes saved");
  await detail.getByRole("button", { name: "Edit details" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Place name *")
    .fill("Our edited café");
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
    page.locator("article").filter({ hasText: "Our edited café" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Our edited café" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "A note for our future selves" }),
  ).toHaveValue("Book a window table");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove place" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove place" })
    .click();
  await expect(
    page.locator("article").filter({ hasText: "Our edited café" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("combines filters, switches categories and imports with a duplicate preview", async ({
  page,
}) => {
  await ready(page);
  await places(page);
  await page.getByRole("button", { name: "Food & drink", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Subcategory", exact: true })
    .selectOption("Breakfast & Brunch");
  await page.getByLabel("Favourites only").check();
  await page.getByRole("textbox", { name: "Search places" }).fill("brunch");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset all filters" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Or paste your list" })
    .fill(
      "name,category,area\nImported spot,Food,Soho\nTower Bridge,Activities,Southwark",
    );
  await dialog.getByRole("button", { name: "Preview import" }).click();
  await expect(dialog.getByText("1 valid places")).toBeVisible();
  await expect(dialog.getByText(/duplicate “Tower Bridge”/)).toBeVisible();
  await dialog.getByRole("button", { name: "Import 1 places" }).click();
  await expect(
    page.locator("article").filter({ hasText: "Imported spot" }),
  ).toBeVisible();
});
test("updates the planned group budget and excludes wishlist places", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  if (isMobile)
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByText("Budget", { exact: true })
      .click();
  else
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByText("Trip budget", { exact: true })
      .click();
  await expect(page.locator(".budget-total>strong")).toHaveText("£36.00");
  await page.getByLabel("Include Something sweet in budget").check();
  await expect(page.locator(".budget-total>strong")).toHaveText("£52.00");
  await page
    .getByRole("button", { name: "Edit budget & traveller count" })
    .click();
  await page.getByRole("dialog").getByLabel("Travellers").fill("3");
  await page.getByRole("dialog").getByLabel("Budget limit (GBP)").fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save trip details" })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Trip settings saved",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(page.locator(".budget-total>strong")).toHaveText("£78.00");
  await expect(
    page.getByRole("heading", { name: "£22.00 remaining" }),
  ).toBeVisible();
});
test("shows mapped coordinates, honest account setup, and a responsive navigation", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  if (isMobile)
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByText("Map", { exact: true })
      .click();
  else
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByText("Explore the map", { exact: true })
      .click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(3);
  await page.locator(".leaflet-marker-icon").first().click();
  await expect(page.locator(".map-popup")).toBeVisible();
  await expect(page.locator(".map-popup a")).toHaveAttribute(
    "href",
    /google.com\/maps\/dir/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Make it your own" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No account details are collected in demo mode",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  if (isMobile)
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
});
test("validates API authentication and geocoding input", async ({
  request,
}) => {
  expect([401, 503]).toContain(
    (
      await request.post("/api/trip", { data: { action: "load", payload: {} } })
    ).status(),
  );
  expect((await request.get("/api/search?q=a")).status()).toBe(400);
});

test("selects a provider result and keeps manual location fields editable", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: {
        provider: "Nominatim",
        results: [
          {
            id: "source-example",
            name: "Tower Bridge",
            address: "Tower Bridge, London",
            area: "Southwark",
            lat: 51.5056,
            lng: -0.0753,
          },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Find a London location optional" })
    .fill("Tower Bridge");
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Tower Bridge Tower Bridge, London" })
    .click();
  await expect(dialog.getByLabel("Place name *")).toHaveValue("Tower Bridge");
  await expect(dialog.getByLabel("Latitude", { exact: true })).toHaveValue(
    "51.5056",
  );
  await expect(dialog.getByLabel("Longitude", { exact: true })).toHaveValue(
    "-0.0753",
  );
  await dialog
    .getByLabel("Address", { exact: true })
    .fill("Manually corrected address");
  await expect(dialog.getByLabel("Address", { exact: true })).toHaveValue(
    "Manually corrected address",
  );
});
