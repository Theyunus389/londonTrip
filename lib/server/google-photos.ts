import type { Place } from "@/lib/model";
import type { GooglePhoto } from "@/lib/google-photos";

type Candidate = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  photos?: {
    name?: string;
    authorAttributions?: { displayName?: string; uri?: string }[];
  }[];
};
const words = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const postcode = (s: string) =>
  s
    .match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0]
    .replace(/\s/g, "")
    .toUpperCase();

// Reject weak name matches and conflicting branches instead of inventing a photo.
export function matchesPlace(place: Place, candidate: Candidate) {
  const wanted = words(place.name.replace(/\([^)]*\)/g, "").split(/[—–]/)[0]);
  const found = words(candidate.displayName?.text || "");
  if (!wanted || !found) return false;
  const tokens = wanted
    .split(" ")
    .filter((x) => !["the", "london", "restaurant", "kitchen"].includes(x));
  const actual = new Set(found.split(" "));
  if (
    wanted !== found &&
    (!tokens.length ||
      tokens.filter((x) => actual.has(x)).length / tokens.length < 0.75)
  )
    return false;
  const requestedPostcode = postcode(place.address);
  const actualPostcode = postcode(candidate.formattedAddress || "");
  if (
    requestedPostcode &&
    actualPostcode &&
    requestedPostcode !== actualPostcode
  )
    return false;
  if (place.lat !== null && place.lng !== null) {
    if (!candidate.location) return false;
    const toRad = Math.PI / 180;
    const north = (candidate.location.latitude - place.lat) * 111_320;
    const east =
      (candidate.location.longitude - place.lng) *
      111_320 *
      Math.cos(place.lat * toRad);
    if (Math.hypot(north, east) > 1_000) return false;
  }
  return true;
}
function googleImageUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (u.hostname.endsWith(".googleusercontent.com") ||
        u.hostname.endsWith(".ggpht.com")) &&
      !u.searchParams.has("key")
    );
  } catch {
    return false;
  }
}
function safeLink(value?: string) {
  try {
    const u = new URL(value || "");
    if (u.protocol === "https:" && !u.username && !u.password) return u.href;
  } catch {
    /* An absent or invalid attribution link is displayed as plain text. */
  }
}

export async function findGooglePhoto(
  place: Place,
  key: string,
): Promise<GooglePhoto | null> {
  const body = {
    textQuery: [
      place.name,
      place.address || [place.area, "London, UK"].filter(Boolean).join(", "),
    ].join(", "),
    pageSize: 1,
    languageCode: "en",
    regionCode: "GB",
    ...(place.lat !== null && place.lng !== null
      ? {
          locationBias: {
            circle: {
              center: { latitude: place.lat, longitude: place.lng },
              radius: 1000,
            },
          },
        }
      : {}),
  };
  const search = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    },
  );
  if (!search.ok) throw Error("Google photos unavailable");
  const result = (await search.json()) as { places?: Candidate[] };
  const candidate = result.places?.[0];
  if (!candidate || !matchesPlace(place, candidate)) return null;
  const photo = candidate.photos?.[0];
  // Resource names stay server-side and are never saved in our list or exports.
  if (
    !photo?.name ||
    !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)
  )
    return null;
  const url = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
  url.searchParams.set("maxWidthPx", "800");
  url.searchParams.set("skipHttpRedirect", "true");
  const media = await fetch(url, {
    headers: { "X-Goog-Api-Key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!media.ok) throw Error("Google photos unavailable");
  const data = (await media.json()) as { photoUri?: unknown };
  if (!googleImageUri(data.photoUri) || data.photoUri.includes(key))
    return null;
  return {
    src: data.photoUri,
    authors: (photo.authorAttributions || []).map((a) => ({
      name: a.displayName || "Photo contributor",
      uri: safeLink(a.uri),
    })),
  };
}
