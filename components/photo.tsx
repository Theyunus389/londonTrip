"use client";
/* User supplied image URLs use native img: no image proxy forwards private or signed URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { knownPhoto } from "@/lib/place-photos";
import { supabase } from "@/lib/supabase";
import type { AutomaticPhoto } from "@/lib/automatic-photos";
import { automaticPhoto } from "@/lib/client/automatic-photos";
export function Photo({
  src,
  name,
  category,
  placeId,
  locationKey = "",
  className = "",
}: {
  src?: string;
  name: string;
  category: string;
  placeId?: string;
  locationKey?: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState("");
  const [failed, setFailed] = useState(false);
  const [automaticResult, setAutomaticResult] = useState<AutomaticPhoto | null>(
    null,
  );
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | undefined;
    // Only request missing photos as the card approaches the viewport. There is
    // no periodic refresh. Current-session results are shared with map/details.
    const automatic = () => {
      if (!placeId || !container.current) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          void automaticPhoto(placeId, `${name}:${locationKey}`)
            .then((photo) => {
              if (active && photo) {
                setAutomaticResult(photo);
                setResolved(photo.src);
                setFailed(false);
              }
            })
            .catch(() => {
              /* Keep the category illustration on network failure. */
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
        setAutomaticResult(null);
        if (!url) automatic();
      }
    };
    void load();
    const timer = src?.startsWith("storage:")
      ? setInterval(() => void load(), 3000000)
      : undefined;
    return () => {
      active = false;
      observer?.disconnect();
      clearInterval(timer);
    };
  }, [src, name, placeId, locationKey]);
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
            setAutomaticResult(null);
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
      {automaticResult && !failed && (
        <span className="automatic-photo-credit">
          <a
            href={automaticResult.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikimedia Commons
          </a>
          <span>{automaticResult.author}</span>
          <a
            href={automaticResult.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {automaticResult.license}
          </a>
        </span>
      )}
    </div>
  );
}
