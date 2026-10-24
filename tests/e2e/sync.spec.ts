import { readFileSync } from "node:fs";
import {
  test,
  expect,
  type BrowserContext,
  type Route,
} from "@playwright/test";
const enabled =
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://sync-test.supabase.co";
const uid = "00000000-0000-4000-8000-000000000099",
  tripId = "00000000-0000-4000-8000-000000000100";
const now = "2026-10-25T12:00:00.000Z";
function place(name: string, id: string) {
  return {
    id,
    name,
    category: "Food",
    subcategory: "Coffee & Drinks",
    description: "",
    address: "",
    area: "Soho",
    lat: null,
    lng: null,
    images: [] as string[],
    attribution: "",
    price: null,
    priceType: "unknown",
    currency: "GBP",
    notes: "",
    favorite: false,
    visited: false,
    planned: false,
    createdAt: now,
    updatedAt: now,
  };
}
async function session(ctx: BrowserContext, local: unknown[] = []) {
  await ctx.addInitScript(
    ({ uid, local }) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("london-places-v2", JSON.stringify(local));
        sessionStorage.setItem("seeded", "yes");
      }
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const part = (o: unknown) =>
        btoa(JSON.stringify(o))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const token =
        part({ alg: "HS256", typ: "JWT" }) +
        "." +
        part({ sub: uid, role: "authenticated", exp }) +
        ".test-signature";
      localStorage.setItem(
        "sb-sync-test-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-refresh",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: uid,
            email: "traveller@example.com",
            aud: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    },
    { uid, local },
  );
}
test("PC list migrates once, phone receives edits/deletes, and failed cloud saves do not fall back locally", async ({
  browser,
}) => {
  test.skip(
    !enabled,
    "Requires the documented dummy Supabase build for mocked sync transport.",
  );
  let records = [place("Cloud place", "00000000-0000-4000-8000-000000000101")];
  let failed = false;
  let migrationWrites = 0;
  let photoUploads = 0;
  const image = readFileSync("public/photos/tower-bridge.webp");
  const storage = async (route: Route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "image/webp", body: image });
      return;
    }
    if (url.pathname.includes("/object/sign/")) {
      await route.fulfill({
        json: { signedURL: "/object/sign/place-images/test.webp?token=test" },
      });
      return;
    }
    photoUploads++;
    await route.fulfill({ json: { Key: "place-images/test.webp" } });
  };
  const handler = async (route: Route) => {
    const { action, payload } = route.request().postDataJSON();
    if (failed && action === "save") {
      await route.fulfill({
        status: 503,
        json: { error: "Cloud unavailable; changes not saved" },
      });
      return;
    }
    if (action === "load") {
      await route.fulfill({
        json: {
          trip: { id: tripId, settings: { name: "London places" } },
          trips: [{ id: tripId, settings: { name: "London places" } }],
          places: records,
          members: [],
          invitations: [],
        },
      });
      return;
    }
    if (action === "save" || action === "save-many" || action === "import") {
      const items = action === "save" ? [payload.place] : payload.places;
      if (action === "save-many") migrationWrites++;
      for (const p of items) {
        records = records.filter((x) => x.id !== p.id);
        records.push(p);
      }
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (action === "delete") {
      records = records.filter((p) => p.id !== payload.id);
      await route.fulfill({ json: { ok: true } });
      return;
    }
    throw Error("Unexpected action " + action);
  };
  const pc = await browser.newContext(),
    phone = await browser.newContext();
  try {
    await session(pc, [
      {
        ...place("PC place", "00000000-0000-4000-8000-000000000102"),
        images: ["data:image/webp;base64," + image.toString("base64")],
      },
    ]);
    await session(phone);
    await pc.route("**/api/trip", handler);
    await phone.route("**/api/trip", handler);
    await pc.route("https://sync-test.supabase.co/storage/v1/**", storage);
    await phone.route("https://sync-test.supabase.co/storage/v1/**", storage);
    const a = await pc.newPage(),
      b = await phone.newPage();
    await a.goto("/");
    await expect(
      a.getByRole("button", { name: "Synced", exact: true }),
    ).toBeVisible();
    await expect(a.locator("article")).toHaveCount(2);
    await b.goto("/");
    await expect(b.locator("article")).toHaveCount(2);
    expect(migrationWrites).toBe(1);
    expect(photoUploads).toBe(1);
    expect(records.find((p) => p.name === "PC place")?.images[0]).toMatch(
      /^storage:/,
    );
    await a
      .getByRole("button", { name: "Favourite PC place", exact: true })
      .click();
    await b.evaluate(() => dispatchEvent(new Event("focus")));
    await expect(
      b.getByRole("button", { name: "Unfavourite PC place" }),
    ).toBeVisible();
    await a.getByRole("button", { name: "View PC place" }).click();
    await a
      .getByRole("dialog")
      .getByRole("textbox", { name: "Notes", exact: true })
      .fill("Synced PC note");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Save notes" })
      .click();
    await b.evaluate(() => dispatchEvent(new Event("focus")));
    await b.getByRole("button", { name: "View PC place" }).click();
    await expect(
      b
        .getByRole("dialog")
        .getByRole("textbox", { name: "Notes", exact: true }),
    ).toHaveValue("Synced PC note");
    await expect(
      b.getByRole("dialog").locator(".detail-gallery img"),
    ).toHaveAttribute("src", /sync-test.supabase.co/);
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Delete place", exact: true })
      .click();
    await a
      .getByRole("dialog", { name: "Delete place?" })
      .getByRole("button", { name: "Delete place", exact: true })
      .click();
    await b.evaluate(() => dispatchEvent(new Event("focus")));
    await expect(b.locator("article")).toHaveCount(1);
    await a.reload();
    await expect(a.locator("article")).toHaveCount(1);
    expect(migrationWrites).toBe(1);
    failed = true;
    await a.getByRole("button", { name: "View Cloud place" }).click();
    await a
      .getByRole("dialog")
      .getByRole("textbox", { name: "Notes", exact: true })
      .fill("Must not silently save");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Save notes" })
      .click();
    await expect(a.getByRole("dialog").getByRole("alert")).toContainText(
      "changes not saved",
    );
    expect(records[0].notes).toBe("");
    expect(photoUploads).toBe(1);
    expect(
      await a.evaluate(
        () => JSON.parse(localStorage.getItem("london-places-v2")!)[0].name,
      ),
    ).toBe("PC place");
  } finally {
    await pc.close();
    await phone.close();
  }
});
