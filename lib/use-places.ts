"use client";
import { useEffect, useRef, useState } from "react";
import { placeSchema, type Place } from "./model";
import { api, supabase } from "./supabase";
export const LOCAL_KEY = "london-places-v2";
const OLD_KEY = "london-together-demo-v1";
export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = useRef<Place[]>([]);
  const ready = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const stored = localStorage.getItem(LOCAL_KEY);
        const old = localStorage.getItem(OLD_KEY);
        let items: Place[] = [];
        let message = "";
        if (stored !== null)
          items = placeSchema.array().parse(JSON.parse(stored));
        else {
          if (supabase) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              const data = await api("load", {});
              items = placeSchema.array().parse(data.places);
              if (items.length)
                message =
                  "Copied your previous signed-in trip to this browser. The cloud copy is unchanged.";
            }
          }
          if (!items.length && old !== null) {
            items = placeSchema.array().parse(JSON.parse(old).places);
            message = "Your previous browser list has been preserved.";
          }
        }
        if (stored === null && supabase) {
          for (const p of items) {
            for (let i = 0; i < p.images.length; i++) {
              const src = p.images[i];
              if (!src.startsWith("storage:")) continue;
              const signed = await supabase.storage
                .from("place-images")
                .createSignedUrl(src.slice(8), 120);
              if (signed.error || !signed.data)
                throw Error("Could not recover a private photo");
              const response = await fetch(signed.data.signedUrl, {
                signal: AbortSignal.timeout(12000),
              });
              if (!response.ok)
                throw Error("Could not recover a private photo");
              const blob = await response.blob();
              p.images[i] = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(Error("Photo recovery failed"));
                reader.readAsDataURL(blob);
              });
            }
          }
        }
        if (!active) return;
        // Save before rendering so a quota/storage failure cannot look like a successful migration.
        localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
        current.current = items;
        setPlaces(items);
        setNotice(message);
        ready.current = true;
      } catch {
        if (active)
          setError(
            "Could not load or migrate saved places. Existing data has not been deleted. Free browser storage or restore a JSON export, then reload.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const sync = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY && e.newValue) {
        try {
          const p = placeSchema.array().parse(JSON.parse(e.newValue));
          current.current = p;
          setPlaces(p);
        } catch {
          setError(
            "Another tab saved an unreadable list. Reload before making changes.",
          );
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
    };
  }, []);
  function commit(items: Place[]) {
    if (!ready.current)
      throw Error(
        "Saved data could not be loaded. Reload before making changes.",
      );
    const parsed = placeSchema.array().parse(items);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(parsed));
    } catch {
      throw Error(
        "Browser storage is full or unavailable. Export a backup and use smaller photos. Your changes were not saved.",
      );
    }
    current.current = parsed;
    setPlaces(parsed);
  }
  return {
    places,
    loading,
    error,
    notice,
    setError,
    setNotice,
    save: async (p: Place) => {
      const next = { ...p, updatedAt: new Date().toISOString() };
      commit(
        current.current.some((x) => x.id === p.id)
          ? current.current.map((x) => (x.id === p.id ? next : x))
          : [next, ...current.current],
      );
    },
    remove: async (id: string) =>
      commit(current.current.filter((p) => p.id !== id)),
    importPlaces: async (p: Place[]) => commit([...p, ...current.current]),
  };
}
