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
        Wikimedia photographs retain the contributor and licence information
        shown beside the image or in the place details. Follow the linked
        licence and source page for reuse conditions. The source services are
        subject to the{" "}
        <a
          href="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use"
          target="_blank"
          rel="noopener noreferrer"
        >
          Wikimedia Terms of Use
        </a>
        .
      </p>
      <p>
        See the <a href="/privacy">privacy page</a> for information about
        external services and stored data.
      </p>
    </main>
  );
}
