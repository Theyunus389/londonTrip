import type { Place } from "@/lib/model";
import type { AutomaticPhoto } from "@/lib/automatic-photos";

type Article = {
  title: string;
  index?: number;
  pageimage?: string;
  coordinates?: { lat: number; lon: number }[];
};
type FileInfo = {
  thumburl?: string;
  descriptionurl?: string;
  mediatype?: string;
  extmetadata?: Record<string, { value?: string }>;
};
const normalise = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const baseName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, "")
    .split(/[—–]/)[0]
    .trim();

// A photo of a chain's headquarters or a similarly named overseas venue is not
// a photo of the saved London branch. Require a close name AND a location.
export function matchesArticle(place: Place, article: Article) {
  const wanted = normalise(baseName(place.name));
  const found = normalise(
    article.title.replace(/\([^)]*\)/g, "").replace(/, London$/i, ""),
  );
  const words = (s: string) =>
    s.split(" ").filter((x) => x !== "the" && x !== "london");
  if (!wanted || words(wanted).join(" ") !== words(found).join(" "))
    return false;
  const location = article.coordinates?.[0];
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lon)
  )
    return false;
  if (place.lat !== null && place.lng !== null) {
    const north = (location.lat - place.lat) * 111_320;
    const east =
      (location.lon - place.lng) *
      111_320 *
      Math.cos((place.lat * Math.PI) / 180);
    return Math.hypot(north, east) <= (place.category === "Food" ? 250 : 1200);
  }
  // Without saved coordinates, only accept London articles. Don't infer an
  // out-of-London branch from an address we cannot geocode confidently.
  if (place.address && !/\blondon\b/i.test(place.address)) return false;
  return (
    location.lat >= 51.28 &&
    location.lat <= 51.7 &&
    location.lon >= -0.55 &&
    location.lon <= 0.32
  );
}

const plainText = (value: string) =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(
      /&(amp|quot|apos|nbsp|lt|gt);/g,
      (_, entity: string) =>
        ({ amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" })[
          entity
        ] || "",
    )
    .replace(/\s+/g, " ")
    .trim();

export function licensedPhoto(info: FileInfo): AutomaticPhoto | null {
  const metadata = info.extmetadata || {};
  const license = plainText(metadata.LicenseShortName?.value || "");
  const author = plainText(
    metadata.Attribution?.value || metadata.Artist?.value || "",
  );
  try {
    const src = new URL(info.thumburl || "");
    const source = new URL(info.descriptionurl || "");
    const licenseUrl = new URL(metadata.LicenseUrl?.value || "");
    // Commons also returns older http/deed links to the same CC licence.
    if (licenseUrl.hostname === "creativecommons.org") {
      licenseUrl.protocol = "https:";
      licenseUrl.pathname = licenseUrl.pathname.replace(
        /\/deed\.[a-z_-]+$/i,
        "/",
      );
    }
    const isCC =
      licenseUrl.hostname === "creativecommons.org" &&
      /^\/(licenses\/(by|by-sa)\/\d\.\d|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(
        licenseUrl.pathname,
      );
    if (
      info.mediatype !== "BITMAP" ||
      !author ||
      author.length > 1000 ||
      !license ||
      !isCC ||
      src.protocol !== "https:" ||
      !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(src.hostname) ||
      !src.pathname.startsWith("/wikipedia/commons/") ||
      source.protocol !== "https:" ||
      source.hostname !== "commons.wikimedia.org" ||
      !source.pathname.startsWith("/wiki/File:") ||
      licenseUrl.protocol !== "https:" ||
      src.username ||
      source.username ||
      licenseUrl.username
    )
      return null;
    return {
      src: src.href,
      author,
      sourceUrl: source.href,
      license,
      licenseUrl: licenseUrl.href,
    };
  } catch {
    return null;
  }
}

async function wiki(url: URL) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "LondonPlaces/1.0 (https://github.com/Theyunus389/londonTrip; public place photographs)",
    },
    cache: "force-cache",
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw Error("Photo source unavailable");
  return response.json();
}

export async function findWikimediaPhoto(
  place: Place,
): Promise<AutomaticPhoto | null> {
  const search = new URL("https://en.wikipedia.org/w/api.php");
  const params = {
    action: "query",
    generator: "search",
    gsrsearch: `intitle:"${baseName(place.name).replace(/["\\]/g, " ")}"`,
    gsrnamespace: "0",
    gsrlimit: "3",
    prop: "pageimages|coordinates",
    piprop: "name",
    pilicense: "free",
    format: "json",
  };
  for (const [key, value] of Object.entries(params))
    search.searchParams.set(key, value);
  const result = (await wiki(search)) as {
    query?: { pages?: Record<string, Article> };
  };
  const article = Object.values(result.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .find(
      (page) =>
        matchesArticle(place, page) &&
        page.pageimage &&
        /\.(jpe?g|png|webp)$/i.test(page.pageimage) &&
        !/logo|flag|map|coat.of.arms/i.test(page.pageimage),
    );
  if (!article?.pageimage) return null;
  const file = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries({
    action: "query",
    titles: "File:" + article.pageimage,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mediatype",
    iiurlwidth: "800",
    format: "json",
  }))
    file.searchParams.set(key, value);
  const commons = (await wiki(file)) as {
    query?: { pages?: Record<string, { imageinfo?: FileInfo[] }> };
  };
  for (const page of Object.values(commons.query?.pages || {})) {
    const photo = page.imageinfo?.[0] && licensedPhoto(page.imageinfo[0]);
    if (photo) return photo;
  }
  return null;
}
