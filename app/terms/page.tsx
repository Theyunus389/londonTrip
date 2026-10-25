import Link from "next/link";

export default function Terms() {
  return (
    <main className="policy-page">
      <Link href="/">← Back to places</Link>
      <h1>Terms</h1>
      <p>
        Use this shared list for planning. Opening hours, prices, availability,
        dietary information and automatic photograph matches may be incomplete
        or inaccurate. Confirm details with the venue before visiting.
      </p>
      <p>
        Only upload images and information you have permission to share
        publicly. Anyone with the editing PIN can change or delete shared
        entries. Export a backup of information you want to keep.
      </p>
      <p>
        Google Maps Platform features are subject to the{" "}
        <a
          href="https://maps.google.com/help/terms_maps/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Maps/Google Earth Additional Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Terms of Service
        </a>
        . Google photographs belong to their respective contributors. Their
        display does not grant permission to download, redistribute or relicense
        them.
      </p>
      <p>
        See the <a href="/privacy">privacy page</a> for information about
        external services and stored data.
      </p>
    </main>
  );
}
