import type { AutomaticPhoto } from "@/lib/automatic-photos";

// Reuse current-session results across cards, details and map popups. Two
// concurrent lookups keep scrolling from flooding the free Wikimedia service.
const results = new Map<
  string,
  { expires: number; value: Promise<AutomaticPhoto | null> }
>();
const queue: (() => void)[] = [];
let active = 0;
const next = () => {
  while (active < 2 && queue.length) queue.shift()!();
};
export function automaticPhoto(id: string, name: string) {
  const key = `${id}:${name}`;
  const cached = results.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = new Promise<AutomaticPhoto | null>((resolve) => {
    queue.push(() => {
      active++;
      void fetch("/api/place-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(16000),
      })
        .then(async (response) =>
          response.ok ? (await response.json()).photo || null : null,
        )
        .catch(() => null)
        .then(resolve)
        .finally(() => {
          active--;
          next();
        });
    });
    next();
  });
  results.set(key, { expires: Date.now() + 30 * 60_000, value });
  if (results.size > 200) results.delete(results.keys().next().value!);
  return value;
}
