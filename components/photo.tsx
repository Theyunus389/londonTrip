"use client";
/* User supplied image URLs use native img: no image proxy forwards private or signed URLs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { Coffee, Landmark } from "lucide-react";
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
      let url = src || "";
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
  }, [src]);
  return (
    <div
      className={`photo ${category === "Food" ? "photo-food" : "photo-activity"} ${className}`}
    >
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="photo-placeholder">
          {category === "Food" ? (
            <Coffee size={38} strokeWidth={1} />
          ) : (
            <Landmark size={42} strokeWidth={1} />
          )}
          <span>
            {failed ? "Photo unavailable" : "A little discovery awaits"}
          </span>
        </div>
      )}
    </div>
  );
}
