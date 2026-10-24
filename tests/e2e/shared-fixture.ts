import { type Page, type BrowserContext, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Place } from "../../lib/model";
export function sharedFixture(initial: Place[] = []) {
  let places = initial;
  let failWrites = false;
  let uploads = 0;
  const image = readFileSync("public/photos/tower-bridge.webp");
  async function handler(route: Route) {
    const r = route.request(),
      url = new URL(r.url());
    const unlocked = (r.headers()["cookie"] || "").includes("test-editor=yes");
    if (url.pathname === "/api/shared/photos") {
      if (r.method() === "GET") {
        await route.fulfill({ contentType: "image/webp", body: image });
        return;
      }
      if (!unlocked) {
        await route.fulfill({
          status: 401,
          json: { error: "Unlock editing first" },
        });
        return;
      }
      uploads++;
      await route.fulfill({
        json: { src: "shared:00000000-0000-4000-8000-000000000123.webp" },
      });
      return;
    }
    if (url.pathname === "/api/shared/unlock") {
      if (r.postDataJSON().pin !== "0079") {
        await route.fulfill({ status: 401, json: { error: "Incorrect PIN" } });
        return;
      }
      await route.fulfill({
        json: { ok: true },
        headers: {
          "set-cookie": "test-editor=yes; Path=/; HttpOnly; SameSite=Strict",
        },
      });
      return;
    }
    if (url.pathname === "/api/shared/lock") {
      await route.fulfill({
        json: { ok: true },
        headers: { "set-cookie": "test-editor=; Path=/; Max-Age=0" },
      });
      return;
    }
    if (r.method() === "GET") {
      await route.fulfill({ json: { places, canEdit: unlocked } });
      return;
    }
    if (!unlocked) {
      await route.fulfill({
        status: 401,
        json: { error: "Unlock editing first" },
      });
      return;
    }
    if (failWrites) {
      await route.fulfill({
        status: 503,
        json: { error: "Save failed; changes were not saved" },
      });
      return;
    }
    const { action, payload } = r.postDataJSON();
    let count = 0;
    if (action === "save") {
      places = [
        payload.place,
        ...places.filter((p) => p.id !== payload.place.id),
      ];
    } else if (action === "delete")
      places = places.filter((p) => p.id !== payload.id);
    else if (action === "import") {
      for (const p of payload.places) {
        if (
          !places.some((x) => x.name.toLowerCase() === p.name.toLowerCase())
        ) {
          places.push(p);
          count++;
        }
      }
    }
    await route.fulfill({ json: { ok: true, count } });
  }
  return {
    attach: async (target: Page | BrowserContext) =>
      target.route("**/api/shared{,/**}", handler),
    get places() {
      return places;
    },
    get uploads() {
      return uploads;
    },
    set failWrites(value: boolean) {
      failWrites = value;
    },
  };
}
export async function unlock(page: Page) {
  await page
    .getByRole("button", { name: "Unlock editing", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Shared editing PIN").fill("0079");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Unlock editing", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
}
