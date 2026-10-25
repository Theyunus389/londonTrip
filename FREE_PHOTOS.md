# Free place photographs

The website uses freely licensed photographs from Wikimedia Commons. **There is no photo API bill, account sign-up, API key or additional SQL migration.** Deploy the current code in Vercel; your existing Supabase shared-list configuration stays the same.

## How images are chosen

1. Your uploaded or explicitly supplied image stays first.
2. A known place name uses a bundled, verified photograph. There are 27 matched venues/landmarks, including Natural History Museum, V&A, Wallace Collection, Kyoto Garden, the Garden at 120 and Sexy Fish. `PHOTO_CREDITS.md` lists their licences and sources. The Post Building photo depicts its exterior rather than its rooftop.
3. Otherwise the server searches Wikipedia by the saved place name. It accepts only a close title match with compatible article coordinates, then checks the article's image on Wikimedia Commons. Saved food coordinates must be within 250 m of the article location; activities allow 1.2 km. Without saved coordinates, only a London article is accepted, and an explicit address outside London is not guessed.
4. The file must be a bitmap image, have contributor credits and use a supported Creative Commons BY/BY-SA/CC0/public-domain licence. Logos, maps, flags, unsafe URLs and missing licence/credit data are rejected. Contributor, source and licence are displayed beside automatic photographs.
5. If a suitable photo cannot be found, the labelled category illustration remains. Wikipedia/Commons have limited coverage of small restaurants. We do not substitute a chain's overseas branch or an unrelated generic food photo.

Automatic pictures appear in cards, details and map popups, without unlocking editing. They load as images approach the viewport. At most two browser lookups run at once. Public upstream metadata is cached on the server for 24 hours; the current browser session reuses results for thirty minutes across views, including unsuccessful results. There is no periodic background photo refresh.

The lookup sends only the saved place name to Wikimedia. Address/coordinates are checked on this server, and notes/PINs are not sent. Image requests connect the browser to Wikimedia. No Wikimedia photo or automatic metadata is written into your shared database. Your existing import/export data remains unchanged; automatically looked-up images are resolved again when the place is viewed. Bundled photo references and their credits still export as before.

## Deployment

Your Git integration normally deploys pushes to `main`. If needed, use **Vercel → london-trip → Deployments → ⋯ beside the latest production deployment → Redeploy**.

No Google setup is needed. The application ignores any previous `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACES_MONTHLY_LIMIT` values. You can remove those Vercel variables and disable the old Places API/key in Google Cloud. Keep your Supabase URL, service-role key and shared PIN. The old Google counter migration is inactive; leave it alone if already applied.

## Troubleshooting and adding a photo

Open a missing place and verify its name and coordinates. Renaming or correcting its location starts a fresh browser lookup. Unknown restaurants often have no appropriate Commons photo; unlock editing and upload your own photo or use an image URL you have permission to share. Failed image/source requests keep the list usable and show the illustration. For a temporary source failure, reload the page to clear current-session cached results.

Live implementation checks confirmed photo lookup and licensed credits for London Eye and St Paul's Cathedral, and rejection of an unrelated Dave's Hot Chicken branch. Automated tests mock external services so they do not depend on network availability.
