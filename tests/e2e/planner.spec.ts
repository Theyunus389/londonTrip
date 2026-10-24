import { test, expect, type Page } from "@playwright/test";
const sample = [
  {
    name: "Tower Bridge",
    images: [
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Tower_Bridge_at_Dawn.jpg/960px-Tower_Bridge_at_Dawn.jpg",
    ],
    category: "Activities",
    subcategory: "Sightseeing & Landmarks",
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
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Or paste your list").fill(JSON.stringify(sample));
  await d.getByRole("button", { name: "Preview import" }).click();
  await d.getByRole("button", { name: "Import 2 places" }).click();
  await expect(page.locator("article")).toHaveCount(2);
}
test("simple layout: categories, filters, map, real photos and illustrations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await expect(page.getByRole("button", { name: "Trip budget" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Connect your trip")).toHaveCount(0);
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
  expect(errors).toEqual([]);
});
test("CRUD, uploads, notes, flags and reload persistence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Place name *").fill("Test cafe");
  await d
    .locator("input[type=file]")
    .setInputFiles("public/photos/tower-bridge.webp");
  await expect(d.getByRole("button", { name: "Remove photo 1" })).toBeVisible();
  await expect(d.getByText("Include in budget")).toHaveCount(0);
  await d.getByRole("button", { name: "Save place", exact: true }).click();
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
  await expect(
    page.getByRole("button", { name: "Mark not visited: Updated cafe" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Updated cafe" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Remember the table");
  await expect(
    page.getByRole("dialog").locator(".detail-gallery img"),
  ).toHaveAttribute("src", /^data:image\/webp/);
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
test("export and reimport preserve notes, photos and flags; duplicate preview", async ({
  page,
}) => {
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
  ).toMatchObject({
    notes: "Walk by the river",
    favorite: true,
    images: sample[0].images,
  });
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
  await expect(page.getByRole("dialog")).toContainText(
    "2 rows will be skipped",
  );
});
test("preserves the old browser list without requiring an account", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const time = new Date().toISOString();
    localStorage.setItem(
      "london-together-demo-v1",
      JSON.stringify({
        settings: { name: "Old trip" },
        places: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Previous place",
            category: "Food",
            subcategory: "Coffee & Drinks",
            area: "Soho",
            address: "",
            description: "",
            lat: null,
            lng: null,
            images: [],
            attribution: "",
            price: 12,
            priceType: "person",
            currency: "GBP",
            notes: "Keep these notes",
            favorite: true,
            visited: true,
            planned: true,
            createdAt: time,
            updatedAt: time,
          },
        ],
      }),
    );
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "View Previous place" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your previous browser list has been preserved."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("london-places-v2")!)[0].notes,
    ),
  ).toBe("Keep these notes");
  expect(
    await page.evaluate(() => localStorage.getItem("london-together-demo-v1")),
  ).not.toBeNull();
});
test("storage save failure is visible and never claims success", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Add your places" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Place name *")
    .fill("Unsaved place");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save place", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Your changes were not saved",
  );
  await expect(page.locator("article")).toHaveCount(0);
});
