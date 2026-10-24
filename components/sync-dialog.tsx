"use client";
import { useState } from "react";
import { Dialog } from "./ui/dialog";
import type { Place } from "@/lib/model";
export function SyncDialog({
  canEdit,
  backup,
  onUnlock,
  onLock,
  onPublish,
  onRetry,
  onClose,
}: {
  canEdit: boolean;
  backup: Place[];
  onUnlock: (pin: string) => Promise<void>;
  onLock: () => Promise<void>;
  onPublish: () => Promise<number>;
  onRetry: () => Promise<void>;
  onClose: () => void;
}) {
  const [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function downloadBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "previous-browser-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={canEdit ? "Editing unlocked" : "Unlock editing"}
      description="Everyone sees the same list. Only people with the shared PIN can change it."
    >
      {canEdit ? (
        <>
          <p>Editing is unlocked on this browser for up to eight hours.</p>
          <button
            className="button secondary mt"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await onLock();
                onClose();
              })
            }
          >
            Lock editing
          </button>
          {backup.length > 0 && (
            <div className="migration-box">
              <h3>Bring your previous list across</h3>
              <p>
                Your browser has {backup.length} saved places. Publishing copies
                missing places into the list everyone can see. Existing shared
                places will not be overwritten.
              </p>
              <button
                className="button mt"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const n = await onPublish();
                    setMessage(
                      `Published ${n} places. The original backup is kept.`,
                    );
                  })
                }
              >
                Publish saved places
              </button>
            </div>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await onUnlock(pin);
              setPin("");
              setMessage("Editing unlocked.");
            });
          }}
        >
          <label>
            Shared editing PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={128}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          <button className="button mt" disabled={busy}>
            {busy ? "Checking…" : "Unlock editing"}
          </button>
        </form>
      )}
      {backup.length > 0 && (
        <button className="text-button mt" onClick={downloadBackup}>
          Download previous browser backup
        </button>
      )}
      <button
        className="text-button mt"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await onRetry();
            setMessage("Shared list refreshed.");
          })
        }
      >
        Refresh list
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </Dialog>
  );
}
