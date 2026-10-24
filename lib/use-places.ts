"use client";
import { useEffect, useRef, useState } from "react";
import { placeSchema, type Place } from "./model";
import { api, supabase } from "./supabase";
import { migrationChanges, snapshot, type Snapshot } from "./sync";
export const LOCAL_KEY = "london-places-v2";
const OWNER_KEY = "london-local-list-owner";
export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [email, setEmail] = useState<string | null>(null),
    [syncStatus, setSyncStatus] = useState<
      "local" | "syncing" | "synced" | "error"
    >("local"),
    [trips, setTrips] = useState<Snapshot["trips"]>([]),
    [tripId, setTripId] = useState<string | null>(null);
  const current = useRef<Place[]>([]),
    ready = useRef(false),
    identity = useRef<{ uid: string | null; tripId: string | null }>({
      uid: null,
      tripId: null,
    }),
    generation = useRef(0),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    reload = useRef<() => Promise<void>>(async () => {});
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => {});
    return next;
  }
  function show(items: Place[]) {
    current.current = items;
    setPlaces(items);
  }
  function localList() {
    const stored = localStorage.getItem(LOCAL_KEY);
    if (stored !== null) return placeSchema.array().parse(JSON.parse(stored));
    const old = localStorage.getItem("london-together-demo-v1");
    return old ? placeSchema.array().parse(JSON.parse(old).places) : [];
  }
  function cache(items: Place[]) {
    try {
      localStorage.setItem(
        `london-cloud-cache:${identity.current.uid}:${identity.current.tripId}`,
        JSON.stringify(items),
      );
    } catch {
      /* Cloud saves remain successful even if a nonessential offline cache is full. */
    }
  }
  async function uploadImages(p: Place, target: string): Promise<Place> {
    const images = [];
    for (const src of p.images) {
      if (!src.startsWith("data:")) {
        images.push(src);
        continue;
      }
      if (!supabase) throw Error("Sync is not configured");
      const response = await fetch(src);
      const blob = await response.blob();
      const ext =
        blob.type === "image/png"
          ? "png"
          : blob.type === "image/jpeg"
            ? "jpg"
            : "webp";
      const path = `${target}/${crypto.randomUUID()}.${ext}`;
      const r = await supabase.storage
        .from("place-images")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (r.error) throw Error(`Photo upload failed: ${r.error.message}`);
      images.push("storage:" + path);
    }
    return { ...p, images };
  }
  async function refresh() {
    const id = identity.current;
    if (!id.uid || !id.tripId) return;
    const gen = generation.current;
    const data = snapshot(await api("load", { tripId: id.tripId }));
    if (gen !== generation.current) return;
    if (data.trip?.id !== id.tripId)
      throw Error(
        "This list is no longer accessible. Choose another synced list.",
      );
    show(data.places);
    setTrips(data.trips);
    cache(data.places);
    setSyncStatus("synced");
  }
  useEffect(() => {
    let active = true;
    let scheduled: ReturnType<typeof setTimeout>;
    async function boot(
      uid: string | null,
      address: string | null,
      target?: string,
    ) {
      const gen = ++generation.current;
      ready.current = false;
      identity.current = { uid, tripId: null };
      setEmail(address);
      setTripId(null);
      setTrips([]);
      setLoading(true);
      show([]);
      try {
        if (!uid) {
          const items = localList();
          if (!active || gen !== generation.current) return;
          if (localStorage.getItem(LOCAL_KEY) === null) {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
            if (items.length)
              setNotice("Your previous browser list has been preserved.");
          }
          show(items);
          setSyncStatus("local");
          ready.current = true;
          return;
        }
        setSyncStatus("syncing");
        const savedTarget = localStorage.getItem(`london-active-trip:${uid}`);
        let data = snapshot(
          await api("load", { tripId: target || savedTarget }),
        );
        if (gen !== generation.current || !active) return;
        if (!data.trip) {
          const result = await api("create", { name: "London places" });
          data = snapshot(await api("load", { tripId: result.id }));
        }
        if (!data.trip) throw Error("Could not create your synced list");
        if (gen !== generation.current || !active) return;
        const id = data.trip.id;
        identity.current = { uid, tripId: id };
        setTripId(id);
        setTrips(data.trips);
        localStorage.setItem(`london-active-trip:${uid}`, id);
        const marker = `london-local-migrated:${uid}`;
        const owner = localStorage.getItem(OWNER_KEY);
        if (!localStorage.getItem(marker) && (!owner || owner === uid)) {
          const local = localList();
          if (local.length) {
            localStorage.setItem(OWNER_KEY, uid);
            const changes = migrationChanges(local, data.places);
            for (let offset = 0; offset < changes.length; offset += 200) {
              if (gen !== generation.current || !active) return;
              const items = [];
              for (const p of changes.slice(offset, offset + 200))
                items.push(await uploadImages(p, id));
              if (gen !== generation.current || !active) return;
              await api("save-many", { tripId: id, places: items });
            }
            if (changes.length) {
              data = snapshot(await api("load", { tripId: id }));
              setNotice(
                "Your browser places are now saved to your account. The original browser backup is kept.",
              );
            }
          }
          if (gen !== generation.current || !active) return;
          localStorage.setItem(marker, id);
        }
        if (gen !== generation.current || !active) return;
        show(data.places);
        cache(data.places);
        setSyncStatus("synced");
        ready.current = true;
      } catch (e) {
        if (active && gen === generation.current) {
          setError((e as Error).message);
          setSyncStatus(uid ? "error" : "local");
          try {
            const cached = uid
              ? localStorage.getItem(
                  `london-cloud-cache:${uid}:${identity.current.tripId}`,
                )
              : null;
            show(
              cached
                ? placeSchema.array().parse(JSON.parse(cached))
                : uid &&
                    localStorage.getItem(OWNER_KEY) &&
                    localStorage.getItem(OWNER_KEY) !== uid
                  ? []
                  : localList(),
            );
          } catch {
            /* Preserve unreadable data on disk. */
          }
        }
      } finally {
        if (active && gen === generation.current) setLoading(false);
      }
    }
    reload.current = async () =>
      boot(
        identity.current.uid,
        emailRef.current,
        identity.current.tripId || undefined,
      );
    if (!supabase) {
      void boot(null, null);
    } else {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user.id || null;
        const address = session?.user.email || null;
        emailRef.current = address;
        if (ready.current && identity.current.uid === uid) return;
        generation.current += 1;
        ready.current = false;
        identity.current = { uid, tripId: null };
        setEmail(address);
        setLoading(true);
        show([]);
        clearTimeout(scheduled);
        scheduled = setTimeout(() => {
          void serial(() => boot(uid, address));
        }, 0);
      });
      return () => {
        active = false;
        clearTimeout(scheduled);
        subscription.unsubscribe();
      };
    }
    return () => {
      active = false;
    };
    // Authentication initializes this lifecycle once; refs hold the latest identity and snapshot.
  }, []);
  const emailRef = useRef<string | null>(null);
  useEffect(() => {
    if (!email || !tripId || !supabase) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      if (!ready.current) return;
      void serial(refresh).catch((e) => {
        setSyncStatus("error");
        setError(`Sync could not refresh: ${e.message}`);
      });
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 10000);
    window.addEventListener("focus", update);
    const channel = supabase
      .channel(`places-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(update, 250);
        },
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      void supabase!.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, tripId]);
  function localCommit(items: Place[]) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    } catch {
      throw Error(
        "Browser storage is full or unavailable. Your changes were not saved. Export a backup and use smaller photos.",
      );
    }
    show(items);
  }
  async function mutate(
    action: "save" | "import" | "delete",
    items: Place[] = [],
    id?: string,
  ) {
    setBusy(true);
    try {
      await serial(async () => {
        if (!ready.current)
          throw Error(
            "Sync is not ready. Retry syncing before making changes.",
          );
        if (!identity.current.uid) {
          localCommit(
            action === "delete"
              ? current.current.filter((p) => p.id !== id)
              : action === "import"
                ? [...items, ...current.current]
                : current.current.some((p) => p.id === items[0].id)
                  ? current.current.map((p) =>
                      p.id === items[0].id ? items[0] : p,
                    )
                  : [...items, ...current.current],
          );
          return;
        }
        const target = identity.current.tripId;
        if (!target) throw Error("Choose a synced list first");
        setSyncStatus("syncing");
        if (action === "delete") await api("delete", { tripId: target, id });
        else {
          const prepared = [];
          for (const p of items) prepared.push(await uploadImages(p, target));
          await api(
            action === "save" ? "save" : "import",
            action === "save"
              ? { tripId: target, place: prepared[0] }
              : { tripId: target, places: prepared },
          );
        }
        await refresh();
      });
    } catch (e) {
      if (identity.current.uid) setSyncStatus("error");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return {
    places,
    loading,
    busy,
    error,
    notice,
    setError,
    setNotice,
    email,
    tripId,
    trips,
    syncStatus,
    configured: !!supabase,
    retry: () => serial(() => reload.current()),
    selectTrip: async (id: string) => {
      if (!identity.current.uid) return;
      localStorage.setItem(`london-active-trip:${identity.current.uid}`, id);
      identity.current.tripId = id;
      await serial(() => reload.current());
    },
    save: (p: Place) =>
      mutate("save", [
        placeSchema.parse({ ...p, updatedAt: new Date().toISOString() }),
      ]),
    remove: (id: string) => mutate("delete", [], id),
    importPlaces: (p: Place[]) =>
      mutate("import", placeSchema.array().parse(p)),
  };
}
