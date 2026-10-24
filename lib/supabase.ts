import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function api(action: string, payload: unknown) {
  if (!supabase) throw Error("Supabase is not configured");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error("Please sign in again");
  const r = await fetch("/api/trip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Unable to save changes");
  return data;
}
