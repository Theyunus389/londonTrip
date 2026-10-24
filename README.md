# London places

A simple, browser-saved London place list. Search, filter by Food/Activities and subcategory, view map markers, get walking directions, manage photos/notes, and import or export your list. Favourites and visited flags remain available. There are no budget, account, connection or companion screens.

## Run and deploy

Use Node.js 24 LTS (`.nvmrc`).

```bash
npm ci
npm run dev
```

For production, run `npm run build` and `npm start`. Connect this GitHub repository to Vercel using the Next.js preset, Node 24, `npm ci` and `npm run build`. Pushes to `main` trigger automatic deployments. Vercel Hobby is suitable for a small personal, non-commercial site, subject to provider limits.

**Supabase is no longer required for normal use.** Keep any existing Supabase configuration and project intact if you have an older cloud trip to recover. Never supply a service-role key to this application.

## Where your places live

Places are saved in this browser on this website's origin. They are not automatically shared between phones, computers, browsers, preview URLs or custom domains. Clearing browser data removes the local copy. Use Export regularly and before changing domains/devices. This is stated directly in the interface.

- Existing browser lists from the previous version are copied into the new store. The old key is retained as a backup.
- If this browser still has a valid Supabase session and no new-format local list, the first available previous cloud trip is copied locally. Its private uploaded photos are downloaded using the existing authorised session. The original cloud records are not modified or deleted. No anonymous access or relaxed security policies are introduced.
- If you used several previous cloud trips, only the first available one is copied automatically. Restore other trips from prior exports. If a session has expired, existing cloud data remains in Supabase but cannot be recovered without authorised access; this version has no sign-in UI.
- Once a local list exists, edits stay local. They do not update an old cloud trip.
- A fresh browser starts with an empty list, without sample entries. Previously saved samples are preserved rather than silently removed; delete unwanted samples individually.
- Storage errors are shown and do not close the editor or claim a successful save. Large photo collections may exceed browser storage; use smaller uploads and keep backups.

## Import and export

Open **Import**, select a CSV/JSON file or paste its contents, then **Preview import**. Review invalid/duplicate rows before saving. Names are deduplicated within your list. Existing entries are never overwritten by import.

Only `name` and `category` are required. Categories are `Food` and `Activities`. Supported fields include `subcategory`, `description`, `address`, `area`, `lat`, `lng`, `imageUrl` (or JSON `images` array), `attribution`, `notes`, `favorite` and `visited`. Coordinates must be supplied together. Custom subcategories are supported. Legacy price/budget fields still roundtrip in old exports for compatibility, but are not shown as budgeting controls.

```csv
name,category,subcategory,area,notes
My cafe,Food,Coffee & Drinks,Soho,Try the pastry
My activity,Activities,Experiences,,Check opening times
```

Import up to 200 entries / 3 MB at a time. Export downloads a JSON file with the whole list, notes, flags, image references and browser-uploaded photo data. Browser uploads are embedded in exports; external URLs remain references. Any legacy private image references that were not recovered still require their original access. Export is also how you move a list to another device. Nothing in your personal list is committed to the public GitHub repository.

## Pictures

Nineteen named landmark photos plus the existing Hyde Park photo are bundled locally and matched conservatively by place name. Their sources and licences are in `PHOTO_CREDITS.md`. An existing image URL/upload takes priority; a failed external photo can fall back to the matching bundled landmark. The detail view displays attribution. Building-exterior images are not presented as photos of a rooftop view or an experience.

Every remaining card gets an original, clearly labelled **category illustration**. This is not a photograph of that venue. We do not use unrelated stock restaurant photos or scrape Google/Instagram imagery. Use **Edit → Upload a photo** or an authorised image URL to add an actual venue photo. JPEG/PNG/WebP files up to 8 MB are resized to 1400px and saved locally as WebP. Up to five images per place are supported.

## Map and optional search

Leaflet uses OpenStreetMap tiles and saved coordinates. No map key is required. Missing coordinates are counted instead of guessed. Network failures show a notice while preserving markers and directions. Google Maps opens separately. Both map and location search require an internet connection.

Optional public environment variables:

- `NEXT_PUBLIC_MAP_TILE_URL`: an authorised HTTPS tile URL template with `{z}`, `{x}`, `{y}`.
- `NEXT_PUBLIC_MAP_ATTRIBUTION`: the provider's required attribution HTML.

Explicit location searches use Nominatim in local development with caching and per-process throttling; there is no autocomplete. Respect [Nominatim's policy](https://operations.osmfoundation.org/policies/nominatim/) and [OSM's tile policy](https://operations.osmfoundation.org/policies/tiles/). Production searches on Vercel require an optional server-only `GEOAPIFY_API_KEY` because Nominatim's global quota cannot be enforced across serverless instances. Manual entry always works. The Geoapify endpoint is rate limited per process; configure provider account limits for a publicly accessible site. Public variables require a rebuild/redeploy when changed.

External image providers see requests from the user's browser; geocoding providers receive search queries. No local places are uploaded to a service as part of normal editing/import/export.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use a production server on port 3100 and cover the basic workflow on desktop and mobile: CRUD, photos, notes, flags, persistence, filters, maps, export/duplicate import, migration of old browser data, storage-save failures and horizontal overflow. Use `npx playwright install --with-deps chromium` if there is no system Chromium.

The existing logic and PostgreSQL security tests also remain. The old authenticated API and Supabase migration are retained for authorised recovery and compatibility; they are not a new public shared database. No cloud tables or storage policies are deleted or made public by this redesign. Live tile availability and any hosted legacy recovery still depend on the external services and an existing authorised session. Mobile tests use Chromium with an iPhone viewport; actual Safari testing remains separate.
