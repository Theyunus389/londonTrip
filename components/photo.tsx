"use client";
/* User supplied image URLs use native img: no image proxy forwards private or signed URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { knownPhoto } from "@/lib/place-photos";
import { supabase } from "@/lib/supabase";
export function Photo({
  src,
  name,
  category,
  className = "",
}: {
  src?: string;
  name: string;
  category: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
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
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3000000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [src, name]);
  return (
    <div
      className={`photo ${category === "Food" ? "photo-food" : "photo-activity"} ${className}`}
    >
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={name}
          loading="lazy"
          onError={() => {
            const fallback = knownPhoto(name)?.src;
            if (fallback && resolved !== fallback) setResolved(fallback);
            else setFailed(true);
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
    </div>
  );
}
