import { NextRequest, NextResponse } from "next/server";
const cache = new Map<string, { time: number; data: unknown }>();
let last = 0;
let active = false;
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3 || q.length > 150)
    return NextResponse.json(
      { error: "Enter a place name between 3 and 150 characters" },
      { status: 400 },
    );
  const key = process.env.GEOAPIFY_API_KEY;
  if (process.env.VERCEL && !key)
    return NextResponse.json(
      {
        error:
          "Automatic location search needs an optional Geoapify key on this hosted site. You can enter the address and coordinates manually.",
      },
      { status: 503 },
    );
  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.time < 86400000)
    return NextResponse.json(hit.data);
  if (active || Date.now() - last < 1100)
    return NextResponse.json(
      { error: "Please wait a moment before searching again" },
      { status: 429 },
    );
  active = true;
  last = Date.now();
  try {
    let results: {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      area: string;
    }[];
    if (key) {
      const url = new URL("https://api.geoapify.com/v1/geocode/search");
      url.search = new URLSearchParams({
        text: q,
        filter: "rect:-0.55,51.28,0.35,51.72",
        format: "json",
        limit: "5",
        apiKey: key,
      }).toString();
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok)
        throw Error(
          "Location search is unavailable or its quota was reached. Please use manual entry.",
        );
      const data = await r.json();
      results = (data.results || []).map(
        (x: {
          place_id: string;
          name?: string;
          address_line1?: string;
          formatted: string;
          lat: number;
          lon: number;
          suburb?: string;
          district?: string;
        }) => ({
          id: x.place_id,
          name: x.name || x.address_line1 || x.formatted.split(",")[0],
          address: x.formatted,
          lat: x.lat,
          lng: x.lon,
          area: x.suburb || x.district || "",
        }),
      );
    } else {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.search = new URLSearchParams({
        q,
        format: "jsonv2",
        limit: "5",
        countrycodes: "gb",
        viewbox: "-0.55,51.72,0.35,51.28",
        bounded: "1",
        addressdetails: "1",
      }).toString();
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "LondonTogether/1.0 (https://github.com/Theyunus389/londonTrip)",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok)
        throw Error(
          "Location search is unavailable. Please enter the address and coordinates manually.",
        );
      const data = await r.json();
      results = data.map(
        (x: {
          place_id: number;
          display_name: string;
          lat: string;
          lon: string;
          address?: Record<string, string>;
        }) => ({
          id: String(x.place_id),
          name: x.display_name.split(",")[0],
          address: x.display_name,
          lat: Number(x.lat),
          lng: Number(x.lon),
          area:
            x.address?.suburb ||
            x.address?.neighbourhood ||
            x.address?.city_district ||
            "",
        }),
      );
    }
    const response = { results, provider: key ? "Geoapify" : "Nominatim" };
    if (cache.size > 500) cache.clear();
    cache.set(q.toLowerCase(), { time: Date.now(), data: response });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        error:
          "Location search could not be reached. Please enter the address and coordinates manually.",
      },
      { status: 503 },
    );
  } finally {
    active = false;
  }
}
