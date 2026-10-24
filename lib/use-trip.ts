"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, api } from "./supabase";
import { demoPlaces } from "./demo";
import {
  placeSchema,
  settingsSchema,
  defaultSettings,
  type Place,
  type Settings,
} from "./model";
const KEY = "london-together-demo-v1";
export type Workspace = { id: string; owner_id: string; settings: Settings };
export function useTrip() {
  const [places, setPlaces] = useState<Place[]>([]),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [user, setUser] = useState<User | null>(null),
    [trip, setTrip] = useState<Workspace | null>(null),
    [trips, setTrips] = useState<Workspace[]>([]),
    [members, setMembers] = useState<{ user_id: string; role: string }[]>([]),
    [invitations, setInvitations] = useState<{ id: string; email: string }[]>(
      [],
    ),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(!supabase),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const selected = useRef<string | null>(null);
  const operation = useRef(false);
  const load = useCallback(async (id?: string) => {
    const r = await api("load", { tripId: id || selected.current });
    setTrips(r.trips);
    const t = r.trip as Workspace | null;
    selected.current = t?.id || null;
    setTrip(t);
    setPlaces(r.places);
    setSettings(t?.settings || defaultSettings);
    setMembers(r.members);
    setInvitations(r.invitations);
  }, []);
  useEffect(() => {
    let alive = true;
    function local() {
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) {
          const value = JSON.parse(stored);
          setPlaces(placeSchema.array().parse(value.places));
          setSettings(settingsSchema.parse(value.settings));
        } else setPlaces(demoPlaces());
      } catch {
        setError(
          "Your saved demo could not be read. Export a backup before resetting.",
        );
      }
      setLoading(false);
    }
    if (demo) {
      queueMicrotask(local);
      return;
    }
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user || null);
      if (!session) {
        setTrip(null);
        setTrips([]);
        setPlaces([]);
        setLoading(false);
      } else {
        setLoading(true);
        setTimeout(() => {
          void load()
            .catch((e) => setError(e.message))
            .finally(() => {
              if (alive) setLoading(false);
            });
        }, 0);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [demo, load]);
  useEffect(() => {
    if (demo || !trip || !supabase) return;
    let timer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !operation.current)
        void load().catch((e) => setError(e.message));
    }, 15000);
    const focus = () => {
      void load().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", focus);
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${trip.id}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(
            () => void load().catch((e) => setError(e.message)),
            300,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${trip.id}`,
        },
        () => {
          void load().catch((e) => setError(e.message));
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      void supabase!.removeChannel(channel);
    };
  }, [trip, demo, load]);
  async function mutate(
    action: string,
    payload: unknown,
    nextPlaces = places,
    nextSettings = settings,
  ) {
    if (operation.current)
      throw Error("Please wait for the current save to finish");
    operation.current = true;
    setBusy(true);
    try {
      if (demo) {
        localStorage.setItem(
          KEY,
          JSON.stringify({ places: nextPlaces, settings: nextSettings }),
        );
        setPlaces(nextPlaces);
        setSettings(nextSettings);
      } else {
        await api(action, { ...(payload as object), tripId: trip?.id });
        await load();
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const save = async (p: Place) => {
    const parsed = placeSchema.parse({
      ...p,
      updatedAt: new Date().toISOString(),
    });
    await mutate(
      "save",
      { place: parsed },
      places.some((x) => x.id === p.id)
        ? places.map((x) => (x.id === p.id ? parsed : x))
        : [parsed, ...places],
    );
  };
  return {
    places,
    settings,
    user,
    trip,
    trips,
    members,
    invitations,
    loading,
    demo,
    error,
    busy,
    setError,
    save,
    remove: async (id: string) =>
      mutate(
        "delete",
        { id },
        places.filter((p) => p.id !== id),
      ),
    importPlaces: async (items: Place[]) =>
      mutate("import", { places: items }, [...items, ...places]),
    saveSettings: async (s: Settings) =>
      mutate("settings", { settings: settingsSchema.parse(s) }, places, s),
    invite: async (email: string) => mutate("invite", { email }),
    revoke: async (id: string) => mutate("revoke", { id }),
    removeMember: async (id: string) => mutate("remove-member", { id }),
    create: async (name: string) => {
      setBusy(true);
      try {
        const r = await api("create", { name });
        await load(r.id);
      } finally {
        setBusy(false);
      }
    },
    accept: async () => {
      await api("accept", {});
      await load();
    },
    selectTrip: async (id: string) => {
      setLoading(true);
      try {
        await load(id);
      } finally {
        setLoading(false);
      }
    },
    enterDemo: () => {
      setDemo(true);
      setUser(null);
      setTrip(null);
    },
    leaveDemo: () => {
      setLoading(true);
      setDemo(false);
    },
    resetDemo: async () => mutate("reset", {}, [], defaultSettings),
  };
}
