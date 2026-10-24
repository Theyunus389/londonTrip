# London, together

A mobile-first London trip companion built with Next.js App Router, strict TypeScript, React, Tailwind CSS, Radix UI, Lucide, Leaflet and Supabase. Save discoveries, leave notes, plan spending and share a private trip with your companions.

## Run it now

Requires Node.js 24 LTS and npm. From the repository root:

```bash
npm ci
npm run dev
```

Without Supabase configuration, the app runs in **clearly labeled local demo mode**. Changes, including compressed uploaded photos, stay in this browser's local storage. This is not shared storage. The real landmark coordinates are linked to their sources; fictional food examples and example prices are marked demo. Remove every demo entry using **Trip settings → Clear demo places & start fresh**. Export first to keep a backup. Browser storage has a finite quota; a failed save keeps the form open and reports the error.

The app has overview, all places, food, activities, favourites, map and budget views. It supports place CRUD, galleries (up to five photos), uploads and URL previews, notes, independent favourite/visited flags, combined filters, sorting, CSV/JSON preview and import, JSON export, walking directions, planned/wishlist separation, per-person/group/free/unknown costs, dates, traveller count and an optional GBP limit. Desktop side navigation becomes a five-item bottom bar on phones; food/activity categories are also available through the places filters. Add to Home Screen is supported through a manifest; this is **not an offline map or offline shared-data app**.

## The simplest hosting path: Vercel + Supabase

These are managed services; no server, VPS or Docker setup is needed. Current provider plan quotas and SMTP requirements apply. You can deploy a demo without a Supabase project, but that will not provide shared trips.

### 1. Put the code on GitHub

If this checkout has not yet been committed and pushed, save it to your repository's `main` branch using your Git client. For this initially empty repository:

```bash
git add .
git commit -m "Build London Together trip planner"
git branch -M main
git push -u origin main
```

Review `git status` and staged changes first; `.env.local`, build outputs and dependencies are ignored. These commands are provided for you; setup does not automatically publish code or modify your GitHub repository.

### 2. Create Supabase and apply the schema

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and choose **New project**. Choose a nearby region and keep the database password in a password manager.
2. Open the project's **SQL Editor**, create a new query, and paste the complete contents of [`supabase/migrations/202610240001_london_together.sql`](supabase/migrations/202610240001_london_together.sql). Click **Run** once, on a new project. This creates trips, membership, invitations, places, constraints, indexes, RLS, RPC functions, private image storage and Realtime publication membership. Do not run it over an unrelated existing application. The migration is versioned rather than rerunnable.
3. In **Project settings → API** (or **Connect → API keys**, depending on the dashboard version), copy the project URL and the **publishable/anon key**. The legacy anon key and current publishable key both work with the app. **Never use the service-role or secret key.**
4. In **Authentication → Sign In / Providers**, enable Email. This app uses email magic links and verifies invitation recipients' confirmed email addresses.
5. Configure a production SMTP provider in Supabase authentication settings before inviting arbitrary companions. Supabase's default test email service is restricted and rate-limited. Your SMTP secret belongs in Supabase, not this repository or chat.

For local shared-mode development, copy `.env.example` to `.env.local`, fill the two public Supabase values, and restart the dev server:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

Supabase public keys identify a project; RLS protects the actual data. The application never requires an administrative key. Sign-in tokens are sent to the same-origin API, verified with Supabase Auth, then used under the caller's RLS permissions.

### 3. Deploy on Vercel

1. Sign in at [vercel.com/new](https://vercel.com/new), connect GitHub, and import **Theyunus389/londonTrip**. If prompted, grant access to this repository.
2. Keep the detected **Next.js** framework preset and repository root directory. Use **Node.js 24.x**, install command `npm ci`, build command `npm run build`, and the default output directory.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Environment Variables** for Production. Use the same Supabase project as step 2. Only enable these for trusted preview branches; never give untrusted code a production session.
4. Click **Deploy**. Vercel supplies a public HTTPS `*.vercel.app` URL; no custom domain is necessary.
5. In Supabase **Authentication → URL Configuration**, set **Site URL** to your production Vercel URL, then add that exact URL to **Redirect URLs**. For local development add `http://localhost:3000`. Add trusted preview URLs individually when needed.
6. Open your production URL, request an email sign-in link, and open the link in the same browser. Create your private trip. New shared trips start **empty**, never prefilled with demo data.

You may use the official [Vercel–Supabase integration](https://vercel.com/marketplace/supabase) to create/connect the project. Check the injected variable names: the code reads the two names above; map a publishable key to `NEXT_PUBLIC_SUPABASE_ANON_KEY` if the integration uses another name. You still need to run the migration and set authentication redirects/SMTP.

**Automatic deployment:** Vercel deploys changes pushed to the connected production branch (`main`). Pull requests receive preview deployments. In Vercel Project Settings → Git, confirm that `main` is the production branch. Public Next.js variables are embedded at build time: redeploy after changing them.

### 4. Invite your companions

1. As trip owner, open **Trip & companions** and enter a friend's email address.
2. Send them your website URL yourself. Saving an invitation does **not** send an email; the UI says so explicitly.
3. They sign in using that exact email, then choose **Accept my invitations**. If they have no workspace yet, this action is on the welcome screen. Otherwise it is in trip settings.
4. They can add/edit/delete places, upload images, save notes and change trip-wide favourites, visited flags and budget inclusion. Only the owner can change trip settings, invite people or revoke membership. The owner can revoke a pending invitation or remove an accepted companion.

Trips are private by default. Anonymous visitors see the sign-in page, not your places. A separate, labeled demo remains available without exposing any private data. You can switch among trips in settings. A realtime subscription refreshes places and settings; a 15-second visible-tab refresh and window-focus refresh also reconcile deletes, invitations and lost connections. Edits are last-write-wins; coordinate simultaneous edits to the same place. Previously downloaded data cannot be recalled, and already-issued private photo URLs expire after up to an hour.

### 5. Verify production on two devices

Before sharing widely, sign in as owner and a companion in separate browser sessions. Create and edit a place, upload a photo, check that changes reach the second session, verify a signed-out session cannot read the trip, revoke the companion, and check access again. Test an email sign-in link on your phone and a Google Maps walking-directions link. This requires your actual Supabase project and email service; local demo tests cannot verify these hosted integrations.

## Add your existing list

Open **All places → Import**. Choose CSV/JSON or paste the contents. Preview shows valid places and errors/duplicates before anything is saved. Valid rows can be imported while invalid rows are explicitly skipped. One shared import is atomic at the database layer. Obvious duplicates are identified by normalised name within each trip. Import at most 200 places and 3 MB at a time.

Minimal CSV:

```csv
name,category,subcategory,address,area,lat,lng,imageUrl,price,priceType,currency,notes,favorite,visited,planned
Your own café,Food,Coffee & Drinks,,Soho,,,,,unknown,GBP,Add real details later,false,false,false
Your own activity,Activities,Experiences,,,,,,,unknown,GBP,,false,false,false
```

JSON accepts an array of the same fields (plus `images`, a list of up to five URLs). Only `name` and `category` are required. Categories are exactly `Food` and `Activities`; custom subcategories are supported. `priceType` is `person`, `group`, `free` or `unknown`. Use numeric GBP estimates, not formatted text or foreign currency. Both coordinates must be supplied together; without them the place still works and Google Maps searches its name/address. Check imported data yourself; import does not invent or geocode missing details.

Export produces a JSON backup of places including notes and flags. Exported IDs are regenerated on reimport to avoid cross-trip identity collisions. **Export is not a photo archive or full trip-settings backup.** Private photo paths refer to the original Supabase project/trip; download/backup storage objects separately before moving projects. Demo image data stays in local exports; reupload those photos before importing into a shared trip. Demo labels are preserved on import.

## Maps, location search and photos

- **Map:** React Leaflet with OpenStreetMap's standard tiles; no key is needed. Attribution stays visible. Markers use the saved coordinates only. Missing coordinates are counted rather than guessed. Do not prefetch bulk tiles or use this free service for high-volume traffic; configure an authorised commercial tile provider for that scale using `NEXT_PUBLIC_MAP_TILE_URL` (an HTTPS URL with `{z}`, `{x}`, `{y}`) and `NEXT_PUBLIC_MAP_ATTRIBUTION` (the provider’s required attribution HTML). Redeploy after changing these public variables. The map requires network access and is not available offline. Review [OSM tile usage](https://operations.osmfoundation.org/policies/tiles/).
- **Optional location search:** manual details always work. In local development, explicit searches call Nominatim with a London bounding box, identification header, per-process throttling and caching; there is no autocomplete. See [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). On Vercel, public Nominatim is disabled because a per-process limiter cannot guarantee a global rate cap across serverless instances. Production searches also require a valid signed-in session. To enable production search, add an optional **server-only** `GEOAPIFY_API_KEY` in Vercel and redeploy. [Geoapify](https://www.geoapify.com/) supplies an authorised geocoding API with an account quota; monitor your quota and configure provider limits. It does not supply automatic venue photographs.
- **Photographs:** upload your own licensed JPEG/PNG/WebP (up to 8 MB input), or enter an authorised image URL and credit. Photos are resized to 1400px and converted to WebP before upload; the private Supabase bucket accepts up to 2 MB per object. Shared uploads use signed URLs. Demo uploads use local storage and are not sent to a server. A storage upload failure is shown; no false success is reported. Removing a photo/place does not purge its storage object automatically, to avoid deleting files referenced elsewhere. Clean up unused files manually in Supabase Storage after backing them up.
- **Privacy:** external image URLs are loaded by the browser, so their host sees a request. Prefer private uploads for personal photos. Google Maps opens separately and receives the selected name/address or coordinates. Location search queries go to the configured geocoding provider.
- Bundled landmark photographs have verified Wikimedia sources and credits in [`PHOTO_CREDITS.md`](PHOTO_CREDITS.md). Images are local, optimised WebP files. Food demo entries are fictional and use honest illustrations, not unrelated stock venue photographs. No Google Maps images are scraped.

## Development and checks

```bash
npm run lint
npm run typecheck
npm test                 # Budget, directions, import, filtering, validation + real PostgreSQL RLS tests
npm run build
npm run test:e2e          # Production server; desktop and mobile Chromium flows
```

For browser tests on another machine, run `npx playwright install --with-deps chromium`. The test configuration uses system Chromium if present, otherwise Playwright's installed browser. You can override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests run in demo mode; unset Supabase variables when testing the demo. A GitHub Actions workflow runs the same checks on pushes and pull requests.

PGlite executes the real migration against PostgreSQL with a minimal mocked Supabase `auth` and `storage` schema and authenticated/anonymous roles. Tests verify private-trip isolation, membership, invitation acceptance for the correct verified email, owner-only administration, protected identities, direct-write validation, atomic imports, private storage policies and revocation. This validates SQL/RLS, **not** delivery of real auth emails, the hosted Storage service or Supabase Realtime transport. A production two-user smoke test is still required.

Safari-specific validation should be performed on an actual iPhone before relying on it while travelling; the mobile automated project is Chromium using an iPhone viewport/touch profile. Radix dialogs provide focus management and keyboard dismissal, controls have visible focus states, notifications use live regions, and CSS respects reduced motion.

### Structure

- `app/`: App Router shell and authenticated trip/geocoding API routes.
- `components/`: planner, accessible dialogs, editor, importer, photo resolver, client-only map.
- `lib/`: shared Zod validation, models, calculations, import parser, Supabase client and workspace synchronization.
- `supabase/migrations/`: constraints, policies, RPCs, storage and Realtime.
- `tests/`: logic, database authorization, and desktop/mobile browser tests.

Radix primitives are used directly with project styling rather than generated shadcn components; they provide the same accessible dialog foundation with fewer copied files. CSS transitions provide the subtle motion without an animation runtime. Place galleries are stored as a bounded JSON array within each validated place document to keep this small shared-trip app maintainable. Database foreign keys still enforce users, trips, membership and place ownership, and database constraints validate documents in addition to server-side Zod validation. There is no public data-sharing link or administrative credential in the browser.

## Configuration still needed for a live shared site

The repository includes the full application and migration. A hosted site needs your Supabase project, SQL migration, SMTP setup, authentication redirects, two public project variables, and a Vercel deployment connected to GitHub. No paid geocoding key is required for manual place entry or the map. Do not put secret values into chat or Git. The cloud onboarding environment's saved scripts/network draft are distinct from a Vercel deployment and must be reviewed and published in environment settings if you want to reuse that cloud snapshot.

## Validation in this cloud workspace

The frozen-lockfile installation, development startup, production build, lint and strict TypeScript checks passed. All **26 logic/PostgreSQL policy tests** and **12 desktop/mobile Chromium checks** passed. Browser checks cover photo uploads/display, create/edit/delete, notes and flags surviving reloads, combined filters, import previews, planned budgets, map markers, directions and provider-result selection. The search UI test uses a declared provider fixture; it does not claim a successful live geocoding lookup.

Live tile and geocoding requests encountered outbound proxy denials and browser certificate-trust errors in this workspace during validation. TLS verification was kept enabled. The application reports unavailable tiles/search and preserves manual entry and external directions. The needed map/geocoding destinations were saved to the cloud environment network draft; review/save and publish that environment configuration, then retry the requests. If using Supabase in this restricted workspace, also allow your actual project's `<project-ref>.supabase.co` hostname once you have created the project. Browser viewport checks do not establish a working external tile service.

No Supabase project variables, authenticated deployment CLI or Vercel account credentials were available. Consequently, hosted email authentication, hosted image storage, cross-device Realtime and a public deployment remain to be verified using the deployment steps above. No live URL, cloud migration application or GitHub push is claimed.
