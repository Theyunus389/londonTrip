# Automatic Google Places photographs

This is optional. Your saved places, uploads, built-in landmark photographs and map work without a Google key. Automatic photos fill places that have neither an uploaded image nor a bundled landmark photo. Google will not have a photograph for every place, and conservative matching may reject ambiguous names or branches. Add the correct address/coordinates to improve a match.

## 1. Prepare Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/). Create a separate project for this website so other applications do not consume its free allowances.
2. Link a billing account. Google requires billing for Places API access even when your usage falls within free allowances. This application cannot guarantee a zero bill. Check the [current pricing](https://developers.google.com/maps/billing-and-pricing/pricing) for **Text Search Pro** and **Place Details Photos** in your billing region before enabling access. The matching fields in this implementation trigger Text Search Pro pricing.
3. Go to **APIs & Services → Library**, search for **Places API (New)** and enable it. The legacy Places API alone is insufficient. Google Maps JavaScript API is not required for this photo feature.
4. Go to **APIs & Services → Credentials → Create credentials → API key**. Edit the key and set **API restrictions → Restrict key → Places API (New)**. It is a server-side key: HTTP referrer/website restrictions will block server requests. Vercel's default outbound IPs are dynamic, so an IP application restriction requires your own supported fixed-egress configuration. Keep this key private.
5. In the API's **Quotas & System Limits**, lower available request quotas to suit your usage. Available quota types vary; a per-minute limit is not a monthly spending cap. Create a billing budget alert as an additional notification, remembering that budget alerts do not stop billing. This feature separately enforces the monthly database cap described below.

## 2. Run the photo limit migration once

In your existing **Supabase project → SQL Editor → New query**, paste and run the entire file:

[`supabase/migrations/202610250003_google_photos.sql`](supabase/migrations/202610250003_google_photos.sql)

It creates only a private monthly usage counter and a server-only atomic reservation function. Your places and previous migrations are unchanged. Without this migration, Google requests fail closed and the illustrations remain.

## 3. Add the key in Vercel

Open **Vercel → london-trip → Settings → Environment Variables → Add**:

| Name                          | Value                                                       | Environment |
| ----------------------------- | ----------------------------------------------------------- | ----------- |
| `GOOGLE_PLACES_API_KEY`       | Your new Google API key                                     | Production  |
| `GOOGLE_PLACES_MONTHLY_LIMIT` | Optional lower integer from `0` to `800`; defaults to `800` | Production  |

Mark the key sensitive. Never prefix it with `NEXT_PUBLIC_`, put it in Git, or send it in chat. Keep your existing Supabase server variables and editing PIN.

Then open **Deployments → ⋯ next to the latest production deployment → Redeploy**. Supabase does not need redeploying.

Open the site's **Places** tab and scroll. Missing photographs are looked up as their cards approach the viewport. A returned image shows Google branding and contributor credits. Open its details for a larger image. No editing PIN is required to view photos.

## Request limits and data handling

- One reservation allows at most one Text Search (New) request and one Photo Media (New) request, with no automatic retries. A failed or unmatched request still consumes its reservation.
- The default is **800 reservations per UTC calendar month across all visitors and Vercel instances using this database**. The server and SQL function clamp configuration to 800. Lower it at any time or use `0` to disable calls after redeploying. Repeated page loads, filtering that remounts cards, opening details and changing tabs can consume additional reservations.
- This is intended to stay below the last known 1,000-photo and 5,000-Text-Search-Pro monthly free allowances. Google can change pricing, and your region, project, other API usage and billing arrangement can affect costs. Verify your actual current allowances. The application counter does not limit any other software using your key/project, other Google SKUs or Vercel/Supabase charges. It is a request cap, not a dollar-spend guarantee.
- Only saved public places can be looked up. The server builds the query from their stored name/address/coordinates and rejects cross-origin browser requests. The global cap also bounds requests made directly outside a browser.
- Photographs, Google metadata and photo resource names are not stored in Supabase, browser local storage or exports. The response and upstream API calls use `no-store`. The browser displays the current response during the visit and loads the actual image from Google's image service. No Google image is downloaded into your photo bucket.
- Uploaded/licensed images and local landmark photos remain preferred. Wrong-name or conflicting-postcode matches, and results over 1 km from saved coordinates, are rejected. This reduces mismatches but cannot guarantee that every automatically selected image is correct.
- Google images appear in the Places list and its details. They are not shown on or alongside the OpenStreetMap view. The map retains your own/bundled images and illustrations. The public `/privacy` and `/terms` pages describe these external services and link Google's policies.

To inspect the feature's count in Supabase SQL Editor, run `select * from public.google_photo_usage order by month desc;`. Do not reset or reduce the current month's count to bypass the cap. The next month starts a new row automatically; old counts remain available for review.

If photos do not appear, check the migration, Vercel variable and redeploy first, then Google Cloud API enablement, API key restrictions, billing status and quotas. Existing images/landmarks do not trigger Google calls. A venue without a confident match or available photo keeps its labelled illustration.

Official references: [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
