"use client";
import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { supabase } from "@/lib/supabase";
export function SyncDialog({
  email,
  status,
  trips,
  tripId,
  onSelect,
  onRetry,
  onClose,
}: {
  email: string | null;
  status: string;
  trips: { id: string; settings: { name: string } }[];
  tripId: string | null;
  onSelect: (id: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title="Sync across devices"
      description="Use the same email and list on your PC and phone."
    >
      {!supabase ? (
        <p>
          Sync needs the existing Supabase URL and public key in Vercel. Browser
          saving and import/export still work without them.
        </p>
      ) : email ? (
        <>
          <p>
            Signed in as <strong>{email}</strong>
          </p>
          <p className="sync-help">
            {status === "synced"
              ? "Your changes are saved to your private account."
              : status === "syncing"
                ? "Syncing changes…"
                : "Sync needs attention. Your browser backup has been kept."}
          </p>
          {trips.length > 1 && (
            <label>
              Synced list
              <select
                value={tripId || ""}
                onChange={async (e) => {
                  setBusy(true);
                  try {
                    await onSelect(e.target.value);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.settings.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="detail-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRetry();
                  setMessage("Sync checked.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh sync
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await supabase!.auth.signOut();
                setBusy(false);
                if (r.error) setError(r.error.message);
                else onClose();
              }}
            >
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="sync-help">
            On your PC, sign in first to copy your full browser list to your
            account. Then sign in with the same email on your phone. Existing
            browser backups are kept; matching names are merged using the newer
            saved edit.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const r = await supabase!.auth.signInWithOtp({
                email: address,
                options: { emailRedirectTo: window.location.origin },
              });
              if (r.error) setError(r.error.message);
              else
                setMessage(
                  "Check your email and open the sign-in link on this device. Use the same email on your other devices.",
                );
              setBusy(false);
            }}
          >
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <button className="button mt" disabled={busy}>
              {busy ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
