"use client";
import { useState } from "react";
import { Search, Upload, Plus, X, LoaderCircle, MapPin } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Photo } from "./photo";
import {
  categories,
  placeSchema,
  type Place,
  type Category,
} from "@/lib/model";
import { supabase } from "@/lib/supabase";
type Result = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  area: string;
};
export async function prepareImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPEG, PNG or WebP image");
  if (file.size > 8 * 1024 * 1024)
    throw Error("Image must be smaller than 8 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Unable to process image"))),
      "image/webp",
      0.82,
    ),
  );
}
export function PlaceForm({
  initial,
  onClose,
  onSave,
  demo,
  tripId,
}: {
  initial: Place;
  onClose: () => void;
  onSave: (p: Place) => Promise<void>;
  demo: boolean;
  tripId?: string;
}) {
  const [p, setP] = useState(initial),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [results, setResults] = useState<Result[]>([]),
    [searched, setSearched] = useState(false),
    [imageUrl, setImageUrl] = useState(""),
    [provider, setProvider] = useState("");
  function field<K extends keyof Place>(key: K, value: Place[K]) {
    setP((p) => ({ ...p, [key]: value }));
  }
  async function search() {
    setSearching(true);
    setError("");
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setResults(data.results);
      setProvider(data.provider);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      if (p.images.length >= 5) throw Error("Up to five photos per place");
      const blob = await prepareImage(file);
      let value: string;
      if (demo) {
        value = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(Error("Unable to read image"));
          r.readAsDataURL(blob);
        });
      } else {
        if (!supabase || !tripId) throw Error("Select a shared trip first");
        const path = `${tripId}/${crypto.randomUUID()}.webp`;
        const r = await supabase.storage
          .from("place-images")
          .upload(path, blob, { contentType: "image/webp", upsert: false });
        if (r.error) throw r.error;
        value = `storage:${path}`;
      }
      setP((p) => ({ ...p, images: [...p.images, value] }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !saving && !uploading) onClose();
      }}
      title={initial.name ? "Edit place" : "A new little discovery"}
      description="Save somewhere you’d love to go."
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const parsed = placeSchema.safeParse(p);
          if (!parsed.success) {
            setError(parsed.error.issues.map((x) => x.message).join(". "));
            return;
          }
          setSaving(true);
          try {
            await onSave(parsed.data);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="form-section search-section">
          <label htmlFor="location-query">
            Find a London location <span className="optional">optional</span>
          </label>
          <div className="input-action">
            <input
              id="location-query"
              placeholder="Try Tower Bridge…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
              }}
            />
            <button
              type="button"
              className="button secondary"
              disabled={searching || query.trim().length < 3}
              onClick={search}
            >
              {searching ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Search size={17} />
              )}{" "}
              Search
            </button>
          </div>
          <small>
            Search on demand. © OpenStreetMap contributors. Manual entry is
            always available.
          </small>
          {provider && (
            <small>
              Powered by{" "}
              <a
                href={
                  provider === "Geoapify"
                    ? "https://www.geoapify.com/"
                    : "https://nominatim.org/"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {provider}
              </a>{" "}
              ·{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                © OpenStreetMap contributors
              </a>
            </small>
          )}
          {searched && !results.length && (
            <p>No matches. Try another name or enter details below.</p>
          )}
          {results.map((r) => (
            <button
              type="button"
              className="search-result"
              key={r.id}
              onClick={() => {
                setP((p) => ({
                  ...p,
                  name: r.name,
                  address: r.address,
                  area: r.area,
                  lat: r.lat,
                  lng: r.lng,
                }));
                setResults([]);
                setSearched(false);
              }}
            >
              <MapPin size={16} />
              <span>
                <strong>{r.name}</strong>
                <small>{r.address}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="span-2">
            Place name *
            <input
              required
              maxLength={150}
              value={p.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Where are we going?"
            />
          </label>
          <label>
            Category *
            <select
              value={p.category}
              onChange={(e) => {
                const c = e.target.value as Category;
                setP((p) => ({
                  ...p,
                  category: c,
                  subcategory: categories[c][0],
                }));
              }}
            >
              <option>Food</option>
              <option>Activities</option>
            </select>
          </label>
          <label>
            Subcategory
            <select
              value={p.subcategory}
              onChange={(e) => field("subcategory", e.target.value)}
            >
              <option value="">Unspecified</option>
              {[...new Set([...categories[p.category], p.subcategory])]
                .filter(Boolean)
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          <label className="span-2">
            A few words about it
            <textarea
              maxLength={3000}
              value={p.description}
              onChange={(e) => field("description", e.target.value)}
              placeholder="What makes this place special?"
              rows={2}
            />
          </label>
          <label className="span-2">
            Address
            <input
              value={p.address}
              onChange={(e) => field("address", e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="span-2">
            Neighbourhood
            <input
              value={p.area}
              onChange={(e) => field("area", e.target.value)}
              maxLength={100}
              placeholder="e.g. Soho"
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={p.lat ?? ""}
              onChange={(e) =>
                field(
                  "lat",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={p.lng ?? ""}
              onChange={(e) =>
                field(
                  "lng",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
        </div>
        <div className="form-section">
          <label>
            Photographs <span className="optional">up to 5</span>
          </label>
          <div className="image-previews">
            {p.images.map((src, i) => (
              <div key={src}>
                <Photo
                  src={src}
                  name={`${p.name} photo ${i + 1}`}
                  category={p.category}
                />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  className="icon-button"
                  onClick={() =>
                    field(
                      "images",
                      p.images.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="input-action">
            <input
              aria-label="Image URL"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://… image URL"
            />
            <button
              type="button"
              className="button secondary"
              disabled={!imageUrl || p.images.length >= 5}
              onClick={() => {
                if (!/^https?:\/\//.test(imageUrl)) {
                  setError("Enter a valid image URL");
                  return;
                }
                field("images", [...p.images, imageUrl]);
                setImageUrl("");
              }}
            >
              <Plus size={16} />
              Add image
            </button>
          </div>
          <label className="upload-button">
            <Upload size={17} />
            {uploading ? "Processing photo…" : "Upload a photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || p.images.length >= 5}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <small>
            JPEG, PNG or WebP, up to 8 MB. Only use photos you own or have
            permission to share.
          </small>
          <label className="mt">
            Photo credit / source
            <input
              value={p.attribution}
              onChange={(e) => field("attribution", e.target.value)}
              maxLength={500}
              placeholder="Photographer and source, if required"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Cost type
            <select
              value={p.priceType}
              onChange={(e) =>
                field("priceType", e.target.value as Place["priceType"])
              }
            >
              <option value="unknown">Not estimated yet</option>
              <option value="person">Per person</option>
              <option value="group">Per group</option>
              <option value="free">Free</option>
            </select>
          </label>
          <label>
            Estimated cost (GBP)
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              disabled={p.priceType === "free" || p.priceType === "unknown"}
              required={p.priceType === "person" || p.priceType === "group"}
              value={p.price ?? ""}
              onChange={(e) =>
                field(
                  "price",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="span-2">
            Personal notes
            <textarea
              rows={3}
              value={p.notes}
              maxLength={5000}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Try the pistachio croissant. Book before we go…"
            />
          </label>
        </div>
        <div className="check-row">
          <label>
            <input
              type="checkbox"
              checked={p.favorite}
              onChange={(e) => field("favorite", e.target.checked)}
            />
            Favourite
          </label>
          <label>
            <input
              type="checkbox"
              checked={p.visited}
              onChange={(e) => field("visited", e.target.checked)}
            />
            Visited
          </label>
          <label>
            <input
              type="checkbox"
              checked={p.planned}
              onChange={(e) => field("planned", e.target.checked)}
            />
            Include in budget
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={saving || uploading}
          >
            Cancel
          </button>
          <button className="button" disabled={saving || uploading}>
            {saving ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}{" "}
            {saving ? "Saving…" : "Save place"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
