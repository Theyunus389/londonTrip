import { test, expect } from "@playwright/test";
import { sharedFixture, unlock } from "./shared-fixture";
test("PC publishes browser backup after PIN; phone sees the same public list without an account", async ({
  browser,
}) => {
  const server = sharedFixture();
  const pc = await browser.newContext(),
    phone = await browser.newContext();
  try {
    await server.attach(pc);
    await server.attach(phone);
    await pc.addInitScript(() => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "london-places-v2",
        JSON.stringify([
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "My PC cafe",
            category: "Food",
            subcategory: "Coffee & Drinks",
            description: "",
            address: "",
            area: "Soho",
            lat: null,
            lng: null,
            images: [],
            attribution: "",
            price: null,
            priceType: "unknown",
            currency: "GBP",
            notes: "Keep this note",
            favorite: false,
            visited: false,
            planned: false,
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
    });
    const a = await pc.newPage(),
      b = await phone.newPage();
    await a.goto("/");
    await unlock(a);
    await a.getByRole("button", { name: "Lock / editing" }).click();
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Publish saved places" })
      .click();
    await expect(a.getByRole("dialog").getByRole("status")).toContainText(
      "Published 1 places",
    );
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    await b.goto("/");
    await expect(
      b.getByRole("button", { name: "View My PC cafe" }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Favourite My PC cafe", exact: true })
      .click();
    await expect(
      b.getByRole("dialog", { name: "Unlock editing" }),
    ).toBeVisible();
    expect(server.places[0].favorite).toBe(false);
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    await a
      .getByRole("button", { name: "Favourite My PC cafe", exact: true })
      .click();
    await b.evaluate(() => dispatchEvent(new Event("focus")));
    await expect(
      b.getByRole("button", { name: "Unfavourite My PC cafe" }),
    ).toBeVisible();
    expect(
      await a.evaluate(
        () => JSON.parse(localStorage.getItem("london-places-v2")!)[0].notes,
      ),
    ).toBe("Keep this note");
    await a.getByRole("button", { name: "View My PC cafe" }).click();
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Delete place", exact: true })
      .click();
    await a
      .getByRole("dialog", { name: "Delete place?" })
      .getByRole("button", { name: "Delete place", exact: true })
      .click();
    await b.evaluate(() => dispatchEvent(new Event("focus")));
    await expect(b.locator("article")).toHaveCount(0);
  } finally {
    await pc.close();
    await phone.close();
  }
});
