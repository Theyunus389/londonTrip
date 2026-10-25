# Google photo integration retired

The website now uses free Wikimedia photos. Follow [FREE_PHOTOS.md](FREE_PHOTOS.md).

You do not need a Google billing account, API key or photo-counter SQL migration. The current code makes no Google Places requests, even if an old key remains configured. Existing Google-related Vercel variables can be removed. If you created a Google key/API for this feature, you can disable it in Google Cloud.

The old `202610250003_google_photos.sql` migration remains in the repository for migration history only. If already applied, leave it in place. It is no longer called. Keep the original shared-list migration and Supabase/PIN configuration unchanged.
