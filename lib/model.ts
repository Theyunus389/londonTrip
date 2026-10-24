import { z } from "zod";
export const categories = {
  Food: [
    "Breakfast & Brunch",
    "Restaurants & Main Meals",
    "Desserts & Sweets",
    "Snacks & Street Food",
    "Coffee & Drinks",
  ],
  Activities: [
    "Sightseeing & Landmarks",
    "Museums & Culture",
    "Entertainment",
    "Shopping",
    "Parks & Outdoors",
    "Experiences",
    "Other",
  ],
} as const;
export type Category = keyof typeof categories;
const image = z
  .string()
  .max(3_000_000)
  .refine(
    (v) =>
      /^https?:\/\//.test(v) ||
      /^\/photos\/[a-zA-Z0-9_-]+\.webp$/.test(v) ||
      /^shared:[0-9a-f-]{36}\.(webp|png|jpg)$/.test(v) ||
      /^storage:[\w/-]+\.[a-zA-Z0-9]+$/.test(v) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Use an HTTPS image URL or upload an image",
  );
export const placeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required").max(150),
    category: z.enum(["Food", "Activities"]),
    subcategory: z.string().max(100),
    description: z.string().max(3000),
    address: z.string().max(500),
    area: z.string().max(100),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    images: z.array(image).max(5),
    attribution: z.string().max(500),
    price: z.number().min(0).max(1000000).nullable(),
    priceType: z.enum(["person", "group", "free", "unknown"]),
    currency: z.literal("GBP"),
    notes: z.string().max(5000),
    favorite: z.boolean(),
    visited: z.boolean(),
    planned: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    demo: z.boolean().optional(),
  })
  .refine((p) => (p.lat === null) === (p.lng === null), {
    message: "Enter both latitude and longitude",
    path: ["lat"],
  })
  .refine(
    (p) =>
      (p.priceType !== "person" && p.priceType !== "group") || p.price !== null,
    { message: "Enter an estimated price or choose Unknown", path: ["price"] },
  );
export type Place = z.infer<typeof placeSchema>;
export const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    travelers: z.number().int().min(1).max(100),
    limit: z.number().min(0).max(10000000).nullable(),
    start: z
      .string()
      .max(10)
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)),
    end: z
      .string()
      .max(10)
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)),
  })
  .refine((s) => !s.start || !s.end || s.end >= s.start, {
    message: "End date must follow the start date",
    path: ["end"],
  });
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  name: "Our London trip",
  travelers: 2,
  limit: null,
  start: "",
  end: "",
};
export function newPlace(): Place {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "Food",
    subcategory: categories.Food[0],
    description: "",
    address: "",
    area: "",
    lat: null,
    lng: null,
    images: [],
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
export function directions(p: Pick<Place, "name" | "address" | "lat" | "lng">) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${encodeURIComponent(p.lat !== null && p.lng !== null ? `${p.lat},${p.lng}` : [p.name, p.address, "London"].filter(Boolean).join(", "))}`;
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);
export function cost(p: Place, travelers: number) {
  return p.priceType === "free" || p.priceType === "unknown"
    ? 0
    : (p.price ?? 0) * (p.priceType === "person" ? travelers : 1);
}
export function budget(places: Place[], travelers: number) {
  const planned = places.filter((p) => p.planned);
  const food = planned
    .filter((p) => p.category === "Food")
    .reduce((n, p) => n + cost(p, travelers), 0);
  const activities = planned
    .filter((p) => p.category === "Activities")
    .reduce((n, p) => n + cost(p, travelers), 0);
  return {
    total: food + activities,
    food,
    activities,
    unknown: planned.filter((p) => p.priceType === "unknown").length,
    count: planned.length,
  };
}
export type Filters = {
  search: string;
  category: string;
  subcategory: string;
  favorite: boolean;
  visited: string;
  maxPrice: string;
  sort: string;
};
export const defaultFilters: Filters = {
  search: "",
  category: "All",
  subcategory: "All",
  favorite: false,
  visited: "all",
  maxPrice: "",
  sort: "recent",
};
export function filterPlaces(places: Place[], f: Filters) {
  return places
    .filter(
      (p) =>
        (f.category === "All" || p.category === f.category) &&
        (f.subcategory === "All" || p.subcategory === f.subcategory) &&
        (!f.favorite || p.favorite) &&
        (f.visited === "all" || p.visited === (f.visited === "visited")) &&
        (!f.maxPrice ||
          (p.priceType !== "unknown" &&
            (p.priceType === "free" ? 0 : (p.price ?? 0)) <=
              Number(f.maxPrice))) &&
        [p.name, p.description, p.category, p.subcategory, p.area, p.address]
          .join(" ")
          .toLowerCase()
          .includes(f.search.toLowerCase()),
    )
    .sort((a, b) =>
      f.sort === "alpha"
        ? a.name.localeCompare(b.name)
        : f.sort === "low"
          ? (a.priceType === "free" ? 0 : (a.price ?? Infinity)) -
            (b.priceType === "free" ? 0 : (b.price ?? Infinity))
          : f.sort === "high"
            ? (b.priceType === "free" ? 0 : (b.price ?? -Infinity)) -
              (a.priceType === "free" ? 0 : (a.price ?? -Infinity))
            : f.sort === "favorites"
              ? Number(b.favorite) - Number(a.favorite)
              : b.createdAt.localeCompare(a.createdAt),
    );
}
export function duplicateKey(p: Pick<Place, "name" | "address">) {
  return `${p.name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")}`;
}
