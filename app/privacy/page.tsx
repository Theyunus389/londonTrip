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
        Places without an uploaded or built-in photograph may be looked up using
        Wikipedia and Wikimedia Commons. The lookup sends the place name to
        Wikimedia; saved coordinates are compared on this website’s server. Your
        notes and editing PIN are not sent. Loading a photograph connects your
        browser to Wikimedia’s image service. Public photo metadata may be
        cached on the server for one day and in browser memory for thirty
        minutes. These automatic results are not written into your saved list or
        exports.
      </p>
      <p>
        Wikimedia’s handling of this information is described in the{" "}
        <a
          href="https://foundation.wikimedia.org/wiki/Policy:Privacy_policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Wikimedia Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}
