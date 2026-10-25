# London places

One shared London list for everyone. No accounts or email sign-in. Everyone can search, filter, view the map and export. A server-checked shared PIN unlocks adding, editing, importing, photo uploads, favourites/visited changes and deletion. The simple layout and existing map/categories stay intact.

## Required one-time production setup

The code cannot change your Supabase SQL or Vercel environment variables without authenticated access to those accounts. Do these once:

1. In **Supabase → SQL Editor**, run the complete contents of [`supabase/migrations/202610250002_shared_pin_list.sql`](supabase/migrations/202610250002_shared_pin_list.sql). Run it once. It creates a separate shared store, durable PIN-attempt counters, a revision counter and a private image bucket. It **does not delete or expose any old private trips**. No changes to the old Row Level Security policies are required.
2. In **Vercel → Project → Settings → Environment Variables**, configure for Production:

   | Variable                    | Value                                                                            |
   | --------------------------- | -------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`  | Your existing Supabase project URL                                               |
   | `SUPABASE_SERVICE_ROLE_KEY` | The project's **server-only legacy service_role key** from Supabase API settings |
   | `SHARED_EDIT_PIN`           | Your chosen PIN as text, preserving leading zeros                                |

   **Never prefix the service-role key or PIN with `NEXT_PUBLIC_`. Never put either in Git or chat.** The service-role key is privileged and stays on the server. The public anon key is not a replacement for this server-only key.

3. Redeploy in Vercel after setting the variables. The existing Git integration deploys subsequent pushes to `main` automatically.
4. On the **PC with your saved places**, open the site, choose **Unlock editing**, and enter your chosen PIN. Choose **Publish saved places** once to copy missing places into the shared list. The PIN dialog states that these places will be visible to everyone. Existing shared entries are never overwritten by that import.
5. Open the same website on your phone. It shows the same list without sign-in. Enter the PIN on that phone only if you want to edit.

If a public list cannot be loaded, the app shows a setup/network error. It does not pretend a separate browser-only list is shared. A PIN is not hardcoded into the browser bundle, SQL or source repository. `.env.local` is ignored and may contain local-only runtime settings; it is not deployed to Vercel.

## Your previous data

Old Supabase trips and photos remain private and unchanged. Old browser lists (`london-places-v2` and the earlier demo key) are retained. The PIN dialog can download the old browser backup even before unlocking. Publishing copies missing entries; duplicate names are skipped. On a browser with an existing authorised old-account session, publication can also retrieve the previously selected private trip and merge its newer records into the proposed source. This read uses that browser's existing authentication, never anonymous access. There is no new email sign-in screen.

Private photo paths from older trips are copied only when the browser has authorised access to them. If a private photo cannot be recovered, publication reports the error instead of making the old bucket public. You can reupload that photo or use your export. The original source list is not deleted after publication. Publishing in batches may make partial progress; retrying skips already-published names.

The shared list, its notes and shared photos are intentionally viewable by anyone who opens the website. Keep private information out of the shared list. Old private trips are not included in public reads.

## Editing and syncing

Unlocking issues an eight-hour HTTP-only, SameSite=Strict cookie (Secure in production). Lock editing removes it on this browser. Changing `SHARED_EDIT_PIN` invalidates existing editing cookies. Every write checks the signed cookie and same-origin request, even if someone bypasses the UI.

PIN attempts are limited in the database to five per client fingerprint and fifty total per fifteen-minute window. Limits persist across Vercel instances. Fingerprints use a server-keyed hash of the forwarded address; raw IPs are not stored. Changing proxy infrastructure may affect client identification. If rate-limited, wait fifteen minutes. The four-digit/shared nature of a PIN is a convenience for a personal list, not an individual-account audit system.

Devices refresh on window focus and every ten seconds while visible. Unchanged lists use an ETag and a tiny database revision check, avoiding repeated downloads of the full list. Edits are last-write-wins; avoid simultaneous edits to one place. Cloud failures stay visible and do not silently save to a different browser list. Deleting a place removes it from the shared list for everyone.

## Import/export and pictures

Import CSV or JSON, then preview before saving. Required: `name` and `category` (`Food` or `Activities`). Optional fields include subcategory, description, address, area, lat/lng, imageUrl (or JSON images), attribution, notes, favourite and visited flags. Coordinates must be paired. Custom subcategories are supported. Legacy budget fields still roundtrip for compatibility but no budget UI exists. Import up to 200 rows / 3 MB at a time.

Export works without the PIN and downloads all shared places/notes/flags and image references. Shared image references need the same deployed site and its photo store; an export is not a separate archive of all photo bytes. Use the PIN dialog's backup download for the original local list. A published list is never hardcoded into this repository.

Twenty-seven matched venue/landmark photos are bundled locally with credits in `PHOTO_CREDITS.md`, including seven additional verified Commons photographs and the existing Hyde Park image. Other cards use clearly labelled original category illustrations when no photo can be found. Upload your own licensed JPEG/PNG/WebP (8 MB input, resized to 1400px) or use an authorised image URL. Shared stored photos must be below 2 MB each. Actual file signatures are checked on upload. The photo bucket remains private; a public read-only server route serves only the shared bucket's UUID-named images, never arbitrary private trip paths. Removing a place does not automatically purge its stored photo, to avoid deleting an image referenced elsewhere. Clean up unused shared images manually after backing them up.

**Automatic free photos:** missing images are looked up through Wikipedia and Wikimedia Commons as cards become visible. No billing account, API key, new environment variable or new SQL migration is needed. Uploaded and bundled photos stay preferred. Results need a close article name, a compatible location, a bitmap photograph and a supported free licence with credits. Public upstream metadata is cached for a day; browser memory reuses results for thirty minutes across list/details/map, with at most two concurrent lookups. Source and licence links are shown beside automatic images. These results are not saved to your places/exports. Restaurant coverage is limited; ambiguous/unavailable results keep the illustration. See [FREE_PHOTOS.md](FREE_PHOTOS.md).

Google Places photo calls have been removed, even if old Google variables remain configured. `202610250003_google_photos.sql` is retained only as historical migration history; the current application does not use its counter or require that migration. If you already ran it, leave it in place. Do not rerun old migrations. You may remove old `GOOGLE_PLACES_API_KEY` / `GOOGLE_PLACES_MONTHLY_LIMIT` variables from Vercel and disable the old Google API/key in Google Cloud.

## Development

Node.js 24 LTS is pinned in `.nvmrc`.

```bash
npm ci
npm run dev
```

Copy `.env.example` to ignored `.env.local`, configure your own Supabase project and chosen PIN, and apply the shared migration. Without server configuration, the site will show a setup error rather than fabricate a working shared store. For production use `npm run build` and `npm start`. Vercel: Next.js preset, Node 24, `npm ci`, `npm run build`.

Optional settings:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: only for authorised recovery of older account-based data in an already signed-in browser; not needed for the new public shared flow.
- `GEOAPIFY_API_KEY`: optional server-only key for production location search. Manual entry needs no key. Limit provider quota for a public site.
- `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`: optional raster tile provider and its required attribution; otherwise the map uses OpenFreeMap's minimal Positron vector style, with OSM/OpenMapTiles/OpenFreeMap attribution. No account or API key is required. MapLibre runs only in the lazy-loaded map view and uses a same-origin bundled worker. Unsupported WebGL, a map-source error or a 15-second load timeout falls back to standard OSM raster tiles with softer colours. Existing markers, photos, filtering and walking directions are retained. The map has a Google-style light appearance; it does not use Google Maps APIs.

Leaflet map tiles and geocoding require connectivity. Unavailable tiles/search are reported. Google walking directions open separately. Respect [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) and [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/). Local explicit Nominatim searches are throttled/cached; serverless production uses optional Geoapify. External image providers see browser requests. The PIN/service key stay server-side.

## Tests and verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright uses a production server on port 3100 and system Chromium or `npx playwright install --with-deps chromium`. Browser tests intercept the shared API with an explicitly fake PIN, not your chosen production PIN, and simulate separate PC/phone browsers. They cover public reads, PIN-gated edits, uploads, notes, import/export, backup publication, propagation and failed writes.

Server-route tests exercise origin checks, invalid PINs, leading zeros, signed/expired cookies, PIN rotation, durable throttle responses, write validation, upload rejection and fail-closed missing configuration. PostgreSQL/PGlite tests run the shared migration and verify direct anonymous/authenticated access is forbidden, RPC permissions are server-only, rate counters persist and duplicate imports are atomic. Existing private-trip RLS tests remain to ensure old trips are not made public.

These tests do not apply production SQL or configure Vercel. After deployment, verify on your actual PC and phone that public reads match, wrong PINs cannot edit, an unlocked edit reaches the other device, and an old private trip/photo remains inaccessible through anonymous database access. Safari-specific validation remains separate from the mobile Chromium profile.
