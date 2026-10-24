"use client";
import { useEffect, useRef, useState } from "react";
import { placeSchema, duplicateKey, type Place } from "./model";
import { api, supabase } from "./supabase";
export const LOCAL_KEY = "london-places-v2";
export async function sharedRequest(path = "/api/shared", body?: unknown) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "The shared list could not be reached");
  return data;
}
export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [canEdit, setCanEdit] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [backup, setBackup] = useState<Place[]>([]),
    [synced, setSynced] = useState(false);
  const etag = useRef<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = useRef<Place[]>([]);
  const alive = useRef(true);
  const writable = useRef(false);
  function serial<T>(fn: () => Promise<T>) {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => {});
    return next;
  }
  async function refresh() {
    const response = await fetch("/api/shared", {
      credentials: "same-origin",
      cache: "no-store",
      headers: etag.current ? { "If-None-Match": etag.current } : {},
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 304) {
      if (alive.current) setSynced(true);
      return;
    }
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Shared list unavailable");
    etag.current = response.headers.get("etag");
    const p = placeSchema.array().parse(data.places);
    if (!alive.current) return;
    current.current = p;
    setPlaces(p);
    writable.current = !!data.canEdit;
    setCanEdit(!!data.canEdit);
    setSynced(true);
  }
  function backupFromBrowser() {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) return placeSchema.array().parse(JSON.parse(saved));
      const old = localStorage.getItem("london-together-demo-v1");
      return old ? placeSchema.array().parse(JSON.parse(old).places) : [];
    } catch {
      setNotice(
        "The old browser backup could not be read. It has not been removed.",
      );
      return [];
    }
  }
  useEffect(() => {
    alive.current = true;
    let active = true;
    const init = async () => {
      if (active) setBackup(backupFromBrowser());
      try {
        await refresh();
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setSynced(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    const update = () => {
      void serial(refresh).catch((e) => {
        if (active) {
          setSynced(false);
          setError((e as Error).message);
        }
      });
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 10000);
    window.addEventListener("focus", update);
    return () => {
      active = false;
      alive.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", update);
    };
    // Refs serialize polling and writes, and prevent UI updates after unmount.
  }, []);
  async function prepare(p: Place) {
    const images = [];
    for (const src of p.images) {
      if (!src.startsWith("data:") && !src.startsWith("storage:")) {
        images.push(src);
        continue;
      }
      let image = src;
      if (src.startsWith("storage:")) {
        if (!supabase)
          throw Error(
            "This old private photo needs the original account access. Upload a copy instead.",
          );
        const signed = await supabase.storage
          .from("place-images")
          .createSignedUrl(src.slice(8), 120);
        if (signed.error || !signed.data)
          throw Error(
            "An old private photo could not be recovered. Your backup is unchanged.",
          );
        image = signed.data.signedUrl;
      }
      const response = await fetch(image, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw Error("Photo could not be read");
      const blob = await response.blob();
      const r = await fetch("/api/shared/photos", {
        method: "POST",
        credentials: "same-origin",
        body: blob,
        signal: AbortSignal.timeout(15000),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "Photo upload failed");
      images.push(result.src);
    }
    return { ...p, images };
  }
  async function mutate(
    action: "save" | "import" | "delete",
    items: Place[] = [],
    id?: string,
  ) {
    setBusy(true);
    try {
      return await serial(async () => {
        if (!writable.current)
          throw Error("Unlock editing with the shared PIN first.");
        const prepared = [];
        for (const p of items) prepared.push(await prepare(p));
        const result = await sharedRequest("/api/shared", {
          action,
          payload:
            action === "save"
              ? { place: prepared[0] }
              : action === "delete"
                ? { id }
                : { places: prepared },
        });
        await refresh();
        return result.count as number | undefined;
      });
    } finally {
      setBusy(false);
    }
  }
  async function publishBackup() {
    if (!writable.current) throw Error("Unlock editing first");
    let source = backup;
    try {
      const session = await supabase?.auth.getSession();
      if (session?.data.session) {
        const uid = session.data.session.user.id;
        const active = localStorage.getItem(`london-active-trip:${uid}`);
        const data = await api("load", { tripId: active });
        const cloud = placeSchema.array().parse(data.places);
        if (cloud.length) {
          const byName = new Map(source.map((p) => [duplicateKey(p), p]));
          for (const p of cloud) {
            const old = byName.get(duplicateKey(p));
            if (!old || p.updatedAt >= old.updatedAt)
              byName.set(duplicateKey(p), p);
          }
          source = [...byName.values()];
        }
      }
    } catch {
      /* The preserved browser list remains a valid explicit migration source. */
    }
    const existing = new Set(current.current.map(duplicateKey));
    const additions = source.filter((p) => !existing.has(duplicateKey(p)));
    let count = 0;
    for (let i = 0; i < additions.length; i += 200)
      count += (await mutate("import", additions.slice(i, i + 200))) || 0;
    setNotice(
      `Published ${count} places to the shared list. Existing shared entries and your original browser backup were kept.`,
    );
    return count;
  }
  return {
    places,
    loading,
    busy,
    canEdit,
    synced,
    error,
    notice,
    backup,
    setError,
    setNotice,
    retry: () => serial(refresh),
    unlock: async (pin: string) => {
      await sharedRequest("/api/shared/unlock", { pin });
      await serial(refresh);
    },
    lock: async () => {
      await sharedRequest("/api/shared/lock", {});
      writable.current = false;
      setCanEdit(false);
    },
    publishBackup,
    save: (p: Place) => mutate("save", [placeSchema.parse(p)]).then(() => {}),
    remove: (id: string) => mutate("delete", [], id).then(() => {}),
    importPlaces: (p: Place[]) =>
      mutate("import", placeSchema.array().parse(p)),
  };
}
