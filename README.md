# London places

A simple London place list with optional private syncing across devices. Search, filter by Food/Activities and subcategory, view map markers, get walking directions, manage photos/notes, and import or export your list. Favourites and visited flags remain available. There are no budget or companion screens. A small Sync devices dialog provides email sign-in.

## Run and deploy

Use Node.js 24 LTS (`.nvmrc`).

```bash
npm ci
npm run dev
```

For production, run `npm run build` and `npm start`. Connect this GitHub repository to Vercel using the Next.js preset, Node 24, `npm ci` and `npm run build`. Pushes to `main` trigger automatic deployments. Vercel Hobby is suitable for a small personal, non-commercial site, subject to provider limits.

## Sync PC and phone

Use the existing Supabase project and migration. **No additional database migration is required for this update.** Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and redeploy after changing them. They must be public project identifiers, never a service-role/secret key. A new project must first apply `supabase/migrations/202610240001_london_together.sql` once. Email auth and the site's exact HTTPS URL must be configured in Supabase's authentication redirects. The email provider/SMTP must permit sending to your address.

1. On the **PC with your full list**, open **Sync devices**, enter your email and open the sign-in link on that PC.
2. Wait for **Synced**. The browser list is merged into the existing private cloud list, or a private list is created if you have none. Local photos are uploaded into private storage. Your original browser list stays as a backup.
3. On your **phone**, open the same deployed site, choose **Sync devices** and sign in with the **same email**. The same cloud list loads automatically. If your account has multiple lists, choose the same one in the sync dialog.
4. Changes refresh via Supabase Realtime, every ten seconds while the tab is visible, and on window focus. **Refresh sync** is available in the small sync dialog.

The first browser-to-account migration merges names conservatively, keeps remote record identities and uses the newer `updatedAt` for same-name edits. Cloud-only places stay intact. A completion marker prevents old browser backups from resurrecting places deleted later on another device. The local backup is associated with the first account that migrates it, so switching accounts does not upload it to another account. Export first if you want an additional portable backup. When first creating a synced list, finish the PC step before signing in on the phone.

**Synced means server-confirmed storage.** A failed cloud write shows an error and does not silently fall back to browser-only saving. An offline cache may be displayed with an error status, but failed edits stay in the editor. After connectivity returns, refresh sync. Simultaneous edits to the same place remain last-write-wins; coordinate edits across devices.

Private photos are shared through authorised storage and signed URLs. No tables or image buckets are made public and no RLS checks are bypassed. Different email accounts do not automatically share private data. Sign in with the same email for your own PC/phone.

## Browser-only mode and backups

Without Supabase configuration or while signed out, edits are saved only in that browser and are explicitly labelled as such. Import/export remains available. Clearing browser data removes that local copy, so export regularly. The previous `london-together-demo-v1` browser list is still recognised; it is copied without deleting the original. Fresh browsers start empty, not with fabricated sample places.

After a browser list has been migrated successfully, subsequent signed-in edits use the cloud. Signing out returns to the separate original browser list, which is a backup and may be older. Changes to that signed-out backup do not automatically replace an already-migrated cloud list: use Export/Import deliberately if restoring data.

## Import and export

Open **Import**, select a CSV/JSON file or paste its contents, then **Preview import**. Review invalid/duplicate rows before saving. Names are deduplicated within your list. Existing entries are never overwritten by import.

Only `name` and `category` are required. Categories are `Food` and `Activities`. Supported fields include `subcategory`, `description`, `address`, `area`, `lat`, `lng`, `imageUrl` (or JSON `images` array), `attribution`, `notes`, `favorite` and `visited`. Coordinates must be supplied together. Custom subcategories are supported. Legacy price/budget fields still roundtrip in old exports for compatibility, but are not shown as budgeting controls.

```csv
name,category,subcategory,area,notes
My cafe,Food,Coffee & Drinks,Soho,Try the pastry
My activity,Activities,Experiences,,Check opening times
```

Import up to 200 entries / 3 MB at a time. Export downloads a JSON file with the whole list, notes, flags, image references and browser-uploaded photo data. Browser uploads are embedded in exports; synced private photos and external URLs remain references. Any legacy private image references that were not recovered still require their original access. Use the same account to sync to another device, or Export/Import to transfer a separate copy. Nothing in your personal list is committed to the public GitHub repository.

## Pictures

Nineteen named landmark photos plus the existing Hyde Park photo are bundled locally and matched conservatively by place name. Their sources and licences are in `PHOTO_CREDITS.md`. An existing image URL/upload takes priority; a failed external photo can fall back to the matching bundled landmark. The detail view displays attribution. Building-exterior images are not presented as photos of a rooftop view or an experience.

Every remaining card gets an original, clearly labelled **category illustration**. This is not a photograph of that venue. We do not use unrelated stock restaurant photos or scrape Google/Instagram imagery. Use **Edit → Upload a photo** or an authorised image URL to add an actual venue photo. JPEG/PNG/WebP files up to 8 MB are resized to 1400px and saved as WebP locally when signed out, or in private cloud storage when signed in. Up to five images per place are supported.

## Map and optional search

Leaflet uses OpenStreetMap tiles and saved coordinates. No map key is required. Missing coordinates are counted instead of guessed. Network failures show a notice while preserving markers and directions. Google Maps opens separately. Both map and location search require an internet connection.

Optional public environment variables:

- `NEXT_PUBLIC_MAP_TILE_URL`: an authorised HTTPS tile URL template with `{z}`, `{x}`, `{y}`.
- `NEXT_PUBLIC_MAP_ATTRIBUTION`: the provider's required attribution HTML.

Explicit location searches use Nominatim in local development with caching and per-process throttling; there is no autocomplete. Respect [Nominatim's policy](https://operations.osmfoundation.org/policies/nominatim/) and [OSM's tile policy](https://operations.osmfoundation.org/policies/tiles/). Production searches on Vercel require an optional server-only `GEOAPIFY_API_KEY` because Nominatim's global quota cannot be enforced across serverless instances. Manual entry always works. The Geoapify endpoint is rate limited per process; configure provider account limits for a publicly accessible site. Public variables require a rebuild/redeploy when changed.

External image providers see requests from the user's browser; geocoding providers receive search queries. In signed-in mode, places and uploads are saved to your private Supabase trip. In signed-out mode they remain in the browser.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use a production server on port 3100 and cover the basic workflow on desktop and mobile: CRUD, photos, notes, flags, persistence, filters, maps, export/duplicate import, migration of old browser data, storage-save failures and horizontal overflow. Use `npx playwright install --with-deps chromium` if there is no system Chromium.

The existing logic and PostgreSQL security tests also remain. The existing authenticated API and Supabase migration enforce private per-trip storage. No cloud tables or storage policies are deleted or made public by this redesign. Live tile availability and hosted sync still depend on the external services and an existing authorised session. Mobile tests use Chromium with an iPhone viewport; actual Safari testing remains separate.

### Sync regression checks

Logic tests cover merging local and remote lists without overwriting remote identities or newer edits. The two-context browser test simulates a PC and phone using the actual browser Supabase SDK with intercepted API transport; it checks one-time migration, remote favourite/note/delete refreshes, no deleted-place resurrection, preservation of local backups, and failed-write reporting. This is not a claim of live hosted email, Realtime or storage verification.

To exercise those tests locally, build and run browser tests with public **dummy** identifiers (never a real secret):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://sync-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-public-key npm run build
NEXT_PUBLIC_SUPABASE_URL=https://sync-test.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-public-key npm run test:e2e
```

GitHub Actions uses those dummy identifiers only for tests; your Vercel production deployment uses its own real project variables. Restore a normal `npm run build` before locally starting the real app after mocked tests. For actual deployment validation, sign in on the PC and phone, wait for Synced, change a note or favourite on one device, and check it on the other.
