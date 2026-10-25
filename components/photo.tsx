"use client";
/* User supplied image URLs use native img: no image proxy forwards private or signed URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { knownPhoto } from "@/lib/place-photos";
import { supabase } from "@/lib/supabase";
import type { GooglePhoto } from "@/lib/google-photos";
export function Photo({
  src,
  name,
  category,
  placeId,
  className = "",
}: {
  src?: string;
  name: string;
  category: string;
  placeId?: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState("");
  const [failed, setFailed] = useState(false);
  const [google, setGoogle] = useState<GooglePhoto | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | undefined;
    const controller = new AbortController();
    // Only request missing photos as the card approaches the viewport. There is
    // no periodic Google refresh, persistent cache or Google data in exports.
    const automatic = () => {
      if (!placeId || !container.current) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          void fetch("/api/place-photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: placeId }),
            cache: "no-store",
            signal: controller.signal,
          })
            .then(async (r) => {
              if (!r.ok) return;
              const data = (await r.json()) as { photo?: GooglePhoto };
              if (active && data.photo) {
                setGoogle(data.photo);
                setResolved(data.photo.src);
                setFailed(false);
              }
            })
            .catch(() => {
              /* Keep the category illustration on network/API failure. */
            });
        },
        { rootMargin: "100px" },
      );
      observer.observe(container.current);
    };
    const load = async () => {
      const known = knownPhoto(name);
      let url = src || known?.src || "";
      // Use the local copy when an imported Wikimedia URL identifies the same file.
      if (
        src &&
        known &&
        /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(src)
      ) {
        try {
          const filename = decodeURIComponent(
            src.split("?")[0].split("/").pop() || "",
          ).replaceAll("_", " ");
          if (filename.endsWith(known.filename)) url = known.src;
        } catch {
          /* A malformed URL falls through to normal image failure handling. */
        }
      }
      if (src?.startsWith("shared:"))
        url = `/api/shared/photos?path=${encodeURIComponent(src.slice(7))}`;
      if (src?.startsWith("storage:")) {
        const r = await supabase?.storage
          .from("place-images")
          .createSignedUrl(src.slice(8), 3600);
        url = r?.data?.signedUrl || "";
      }
      if (active) {
        setFailed(false);
        setResolved(url);
        setGoogle(null);
        if (!url) automatic();
      }
    };
    void load();
    const timer = src?.startsWith("storage:")
      ? setInterval(() => void load(), 3000000)
      : undefined;
    return () => {
      active = false;
      controller.abort();
      observer?.disconnect();
      clearInterval(timer);
    };
  }, [src, name, placeId]);
  return (
    <div
      ref={container}
      className={`photo ${category === "Food" ? "photo-food" : "photo-activity"} ${className}`}
    >
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            const fallback = knownPhoto(name)?.src;
            if (fallback && resolved !== fallback) setResolved(fallback);
            else setFailed(true);
            setGoogle(null);
          }}
        />
      ) : (
        <div className="photo-placeholder">
          <img
            src={
              /coffee|drink/i.test(category)
                ? "/illustrations/coffee.svg"
                : /Food|Breakfast|Restaurant|Dessert|Snack/i.test(category)
                  ? "/illustrations/food.svg"
                  : "/illustrations/activity.svg"
            }
            alt="Category illustration; venue photograph not available"
            loading="lazy"
          />
          <span>
            {failed
              ? "Photo unavailable · category illustration"
              : "Category illustration"}
          </span>
        </div>
      )}
      {google && !failed && (
        <span className="google-photo-credit">
          <a
            href="https://maps.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Google Maps"
          >
            <img
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
              alt="Powered by Google"
              width={120}
              height={14}
              referrerPolicy="no-referrer"
            />
          </a>
          {google.authors.map((author, i) =>
            author.uri ? (
              <a
                key={i}
                href={author.uri}
                target="_blank"
                rel="noopener noreferrer"
              >
                {author.name}
              </a>
            ) : (
              <span key={i}>{author.name}</span>
            ),
          )}
        </span>
      )}
    </div>
  );
}
