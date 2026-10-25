import Link from "next/link";

export default function Privacy() {
  return (
    <main className="policy-page">
      <Link href="/">← Back to places</Link>
      <h1>Privacy</h1>
      <p>
        This is a public shared place list. Saved places, notes, photos and
        visited/favourite flags are visible to anyone who opens the site.
        Editing requires the shared PIN. Keep private information out of the
        list.
      </p>
      <p>
        The site uses Supabase to store the shared list and uploaded photos, and
        Vercel to serve the application. An HTTP-only cookie remembers editing
        access for up to eight hours. Older browser backups may remain in local
        storage on your device. PIN attempt limits use a server-keyed address
        fingerprint.
      </p>
      <h2>Maps and photographs</h2>
      <p>
        The map uses OpenStreetMap or the configured tile provider. Requests to
        external image and map providers can disclose your IP address to them.
      </p>
      <p>
        When Google photos are enabled, places without an uploaded or built-in
        photograph may be looked up using Google Maps Platform. The lookup sends
        the place name, address or area and saved coordinates to Google. It does
        not send your notes or editing PIN. Loading a Google photograph also
        connects your browser to Google’s image service. Google photos and
        attribution are displayed during your visit and are not saved into the
        shared list or included in exports.
      </p>
      <p>
        Google’s handling of this information is described in the{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}
