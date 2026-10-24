"use client";
import { useState } from "react";
import { FileUp, Check, ArrowRight } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { parseImport } from "@/lib/import";
import type { Place } from "@/lib/model";
export function ImportDialog({
  places,
  onImport,
  onClose,
}: {
  places: Place[];
  onImport: (p: Place[]) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<ReturnType<typeof parseImport> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title="Bring your list along"
      description="Import up to 200 places from CSV or JSON. Review everything before saving."
      wide
    >
      <div className="import-help">
        <FileUp size={26} />
        <div>
          <strong>Your list, a little more organised.</strong>
          <p>
            Required: <code>name</code>, <code>category</code> (Food or
            Activities). Optional: subcategory, address, area, lat, lng,
            imageUrl, price, priceType, notes, favorite, visited, planned.
            Currency is GBP.
          </p>
        </div>
      </div>
      <label className="upload-button">
        Choose CSV or JSON
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 3000000) {
                setError("File must be smaller than 3 MB");
                return;
              }
              setText(await f.text());
              setPreview(null);
              setError("");
            }
          }}
        />
      </label>
      <label>
        Or paste your list
        <textarea
          className="import-text"
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          placeholder={
            "name,category,subcategory,area,price,priceType\nMy brunch spot,Food,Breakfast & Brunch,Soho,18,person"
          }
        />
      </label>
      <small>
        Example prices are for illustration. Duplicate names are skipped. Custom
        subcategories are supported. Import does not look up missing details.
      </small>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {preview && (
        <div className="import-preview">
          <h3>
            <Check size={18} /> {preview.places.length} valid places
          </h3>
          {preview.places.map((p) => (
            <div key={p.id} className="preview-row">
              <strong>{p.name}</strong>
              <span>
                {p.category} · {p.area || "No area"}
              </span>
            </div>
          ))}
          {preview.errors.length > 0 && (
            <div className="error">
              <strong>{preview.errors.length} rows will be skipped</strong>
              {preview.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {preview ? (
          <button
            className="button"
            disabled={!preview.places.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onImport(preview.places);
                onClose();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Importing…" : `Import ${preview.places.length} places`}
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="button"
            disabled={!text.trim()}
            onClick={() => {
              try {
                setPreview(parseImport(text, places));
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Preview import
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </Dialog>
  );
}
