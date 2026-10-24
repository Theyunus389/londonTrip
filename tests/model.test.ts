import { describe, it, expect } from "vitest";
import {
  newPlace,
  budget,
  directions,
  filterPlaces,
  defaultFilters,
  placeSchema,
  settingsSchema,
} from "../lib/model";
import { parseImport, csvRows } from "../lib/import";
const p = (overrides: Partial<ReturnType<typeof newPlace>> = {}) => ({
  ...newPlace(),
  name: "Test café",
  ...overrides,
});
describe("trip budget", () => {
  it("counts only planned entries and multiplies per-person expenses", () => {
    expect(
      budget(
        [
          p({ planned: true, price: 18, priceType: "person" }),
          p({
            planned: true,
            category: "Activities",
            price: 30,
            priceType: "group",
          }),
          p({ price: 999, priceType: "person" }),
        ],
        3,
      ),
    ).toEqual({ total: 84, food: 54, activities: 30, unknown: 0, count: 2 });
  });
  it("distinguishes free from unknown and never counts stale prices", () => {
    expect(
      budget(
        [
          p({ planned: true, priceType: "free", price: 100 }),
          p({ planned: true, priceType: "unknown", price: 50 }),
        ],
        2,
      ),
    ).toMatchObject({ total: 0, unknown: 1 });
  });
  it("updates estimates when travellers change", () => {
    expect(
      budget([p({ planned: true, priceType: "person", price: 12.5 })], 4).total,
    ).toBe(50);
  });
});
describe("search and filtering", () => {
  it("combines category, subcategory, favourite, status, max price, and area search", () => {
    const match = p({
      name: "Café A",
      area: "Soho",
      subcategory: "Coffee & Drinks",
      price: 4,
      priceType: "person",
      favorite: true,
    });
    expect(
      filterPlaces([match, p({ name: "Other", category: "Activities" })], {
        ...defaultFilters,
        category: "Food",
        subcategory: "Coffee & Drinks",
        search: "SOHO",
        favorite: true,
        visited: "unvisited",
        maxPrice: "5",
      }),
    ).toEqual([match]);
  });
  it("sorts free as zero and unknown prices last", () => {
    expect(
      filterPlaces(
        [
          p({ name: "Unknown" }),
          p({ name: "Paid", priceType: "person", price: 5 }),
          p({ name: "Free", priceType: "free" }),
        ],
        { ...defaultFilters, sort: "low" },
      ).map((p) => p.name),
    ).toEqual(["Free", "Paid", "Unknown"]);
  });
  it("keeps favourites and visited independent", () => {
    expect(
      filterPlaces([p({ favorite: true, visited: false })], {
        ...defaultFilters,
        favorite: true,
        visited: "visited",
      }),
    ).toHaveLength(0);
  });
});
describe("validation and navigation", () => {
  it("rejects incomplete coordinates, non-GBP, unsafe images, negative and missing prices", () => {
    for (const bad of [
      { lat: 51.5 },
      { price: -1 },
      { currency: "USD" },
      { images: ["javascript:alert(1)"] },
      { priceType: "person" },
    ])
      expect(placeSchema.safeParse({ ...p(), ...bad }).success).toBe(false);
  });
  it("validates dates and traveller count", () => {
    expect(
      settingsSchema.safeParse({
        name: "Trip",
        travelers: 0,
        limit: null,
        start: "",
        end: "",
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        name: "Trip",
        travelers: 2,
        limit: null,
        start: "2027-01-02",
        end: "2027-01-01",
      }).success,
    ).toBe(false);
  });
  it("uses coordinates including zero for precise walking directions", () => {
    const u = new URL(directions(p({ lat: 0, lng: 0 })));
    expect(u.searchParams.get("destination")).toBe("0,0");
    expect(u.searchParams.get("travelmode")).toBe("walking");
  });
  it("encodes name and address fallback", () => {
    const u = new URL(directions(p({ name: "A & B", address: "A street" })));
    expect(u.searchParams.get("destination")).toBe("A & B, A street, London");
  });
});
describe("imports", () => {
  it("parses quoted commas, escaped quotes and multiline CSV", () => {
    expect(csvRows('name,notes\r\n"A, B","Say ""hi""\nthen go"')).toEqual([
      ["name", "notes"],
      ["A, B", 'Say "hi"\nthen go'],
    ]);
  });
  it("previews valid rows, flags duplicate names and validates required fields", () => {
    const result = parseImport(
      "name,category,price,priceType\nA,Food,12,person\nA,Food,12,person\nB,Invalid,,unknown",
      [],
    );
    expect(result.places).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.places[0].price).toBe(12);
  });
  it("detects duplicates against existing places regardless of punctuation or address", () => {
    expect(
      parseImport(JSON.stringify([{ name: "Test Cafe!", category: "Food" }]), [
        p({ name: "Test Cafe" }),
      ]).errors[0],
    ).toContain("duplicate");
  });
  it("imports false flags correctly and supports roundtrip export", () => {
    const original = p({
      favorite: true,
      planned: true,
      images: ["/photos/tower-bridge.webp"],
    });
    const result = parseImport(JSON.stringify([original]), []);
    expect(result.errors).toEqual([]);
    expect(result.places[0]).toMatchObject({
      name: original.name,
      favorite: true,
      visited: false,
      planned: true,
      images: original.images,
    });
    expect(result.places[0].id).not.toBe(original.id);
  });
  it("rejects broken CSV and oversized batches", () => {
    expect(() => parseImport('name\n"unclosed', [])).toThrow();
    expect(() =>
      parseImport(
        JSON.stringify(Array(201).fill({ name: "A", category: "Food" })),
        [],
      ),
    ).toThrow("200");
  });
});
