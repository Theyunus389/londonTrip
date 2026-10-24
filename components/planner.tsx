"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Upload,
  Download,
  Map,
  Grid2X2,
  Heart,
  Check,
  Navigation,
  Pencil,
  Trash2,
  X,
  StickyNote,
} from "lucide-react";
import { usePlaces } from "@/lib/use-places";
import {
  categories,
  defaultFilters,
  filterPlaces,
  newPlace,
  directions,
  duplicateKey,
  type Place,
  type Filters,
} from "@/lib/model";
import { Dialog } from "./ui/dialog";
import { Photo } from "./photo";
import { PlaceForm } from "./place-form";
import { ImportDialog } from "./import-dialog";
import { knownPhoto } from "@/lib/place-photos";
const TripMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <p className="map-loading">Loading map…</p>,
});
export default function Planner() {
  const t = usePlaces();
  const [view, setView] = useState("places"),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [editing, setEditing] = useState<Place | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [importing, setImporting] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const selected = t.places.find((p) => p.id === selectedId);
  const visible = filterPlaces(t.places, filters);
  useEffect(() => {
    const sync = () => setView(location.hash === "#map" ? "map" : "places");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  async function run(fn: () => Promise<void>, success: string) {
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      t.setError((e as Error).message);
    }
  }
  function toggle(p: Place, key: "favorite" | "visited") {
    void run(() => t.save({ ...p, [key]: !p[key] }), "Saved");
  }
  function exportList() {
    const data = t.places.map((p) => {
      const image = knownPhoto(p.name);
      return !p.images.length && image
        ? { ...p, images: [image.src], attribution: image.credit }
        : p;
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "london-places.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Exported all places, notes and photo references. Uploaded browser photos are included. Older private cloud photos still need their original access.",
    );
  }
  return (
    <div className="planner">
      <header className="app-header">
        <h1>London places</h1>
        <div className="header-actions">
          <button
            className="button secondary"
            onClick={() => setImporting(true)}
          >
            <Upload size={17} />
            Import
          </button>
          <button
            className="button secondary"
            onClick={exportList}
            disabled={t.loading}
          >
            <Download size={17} />
            Export
          </button>
          <button
            className="button"
            onClick={() => setEditing(newPlace())}
            disabled={t.loading}
          >
            <Plus size={17} />
            Add place
          </button>
        </div>
      </header>
      <p className="storage-note">
        Saved in this browser. Export a backup to keep your list or move it to
        another device.
      </p>
      {(t.error || t.notice) && (
        <div className={t.error ? "error" : "notice"} role="alert">
          {t.error || t.notice}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => {
              t.setError("");
              t.setNotice("");
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <main>
        <div className="search-row">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Search places"
              placeholder="Search name, area or description"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>
          <nav className="view-tabs" aria-label="View">
            <a
              href="#places"
              aria-current={view === "places" ? "page" : undefined}
            >
              <Grid2X2 size={16} />
              Places
            </a>
            <a href="#map" aria-current={view === "map" ? "page" : undefined}>
              <Map size={16} />
              Map
            </a>
          </nav>
        </div>
        <div className="filters">
          <label>
            Category
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  category: e.target.value,
                  subcategory: "All",
                })
              }
            >
              <option value="All">All places</option>
              <option>Food</option>
              <option>Activities</option>
            </select>
          </label>
          <label>
            Subcategory
            <select
              value={filters.subcategory}
              onChange={(e) =>
                setFilters({ ...filters, subcategory: e.target.value })
              }
            >
              <option value="All">All subcategories</option>
              {[
                ...new Set([
                  ...(filters.category === "All"
                    ? [...categories.Food, ...categories.Activities]
                    : categories[filters.category as "Food" | "Activities"]),
                  ...t.places
                    .filter(
                      (p) =>
                        filters.category === "All" ||
                        p.category === filters.category,
                    )
                    .map((p) => p.subcategory),
                ]),
              ]
                .filter(Boolean)
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.visited}
              onChange={(e) =>
                setFilters({ ...filters, visited: e.target.value })
              }
            >
              <option value="all">Any status</option>
              <option value="unvisited">To visit</option>
              <option value="visited">Visited</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="recent">Recently added</option>
              <option value="alpha">Name A–Z</option>
              <option value="favorites">Favourites first</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.favorite}
              onChange={(e) =>
                setFilters({ ...filters, favorite: e.target.checked })
              }
            />
            Favourites
          </label>
          <button
            className="text-button"
            onClick={() => setFilters(defaultFilters)}
          >
            Reset
          </button>
        </div>
        <div className="results">
          <span>
            {visible.length} of {t.places.length} places
          </span>
          <span>{t.places.filter((p) => p.visited).length} visited</span>
        </div>
        {t.loading ? (
          <p className="empty-state">Loading saved places…</p>
        ) : view === "map" ? (
          <TripMap places={visible} onSelect={(p) => setSelectedId(p.id)} />
        ) : visible.length ? (
          <div className="place-grid">
            {visible.map((p) => (
              <article className="place-card" key={p.id}>
                <button
                  className="card-photo"
                  onClick={() => setSelectedId(p.id)}
                  aria-label={`View ${p.name}`}
                >
                  <Photo
                    src={p.images[0]}
                    name={p.name}
                    category={p.subcategory || p.category}
                  />
                </button>
                <div className="card-body">
                  <div className="card-meta">
                    {p.category} · {p.subcategory || "Uncategorised"}
                    {p.demo ? " · Sample" : ""}
                  </div>
                  <button
                    className="card-title"
                    onClick={() => setSelectedId(p.id)}
                  >
                    {p.name}
                  </button>
                  <p className="card-area">
                    {p.area || p.address || "Location not added"}
                  </p>
                  <p className="card-description">{p.description}</p>
                  <div className="card-actions">
                    <button
                      className={`icon-button ${p.favorite ? "selected" : ""}`}
                      aria-label={`${p.favorite ? "Unfavourite" : "Favourite"} ${p.name}`}
                      aria-pressed={p.favorite}
                      onClick={() => toggle(p, "favorite")}
                    >
                      <Heart
                        size={18}
                        fill={p.favorite ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className={`status-button ${p.visited ? "selected" : ""}`}
                      aria-label={`Mark ${p.visited ? "not visited" : "visited"}: ${p.name}`}
                      aria-pressed={p.visited}
                      onClick={() => toggle(p, "visited")}
                    >
                      <Check size={16} />
                      {p.visited ? "Visited" : "To visit"}
                    </button>
                    {p.notes && <StickyNote size={15} aria-label="Has notes" />}
                    <a
                      href={directions(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="directions-link"
                      aria-label={`Walking directions to ${p.name}`}
                    >
                      <Navigation size={16} />
                      Directions
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>
              {t.places.length ? "No matching places" : "Add your places"}
            </h2>
            <p>
              {t.places.length
                ? "Change or reset the filters."
                : "Import your London list or add a place to get started."}
            </p>
            <button
              className="button"
              onClick={() =>
                t.places.length
                  ? setFilters(defaultFilters)
                  : setImporting(true)
              }
            >
              {t.places.length ? "Reset filters" : "Import a list"}
            </button>
          </div>
        )}
      </main>
      {editing && (
        <PlaceForm
          key={editing.id}
          initial={editing}
          demo
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            if (
              t.places.some(
                (x) => x.id !== p.id && duplicateKey(x) === duplicateKey(p),
              )
            )
              throw Error("A place with this name is already saved");
            await t.save(p);
            setMessage("Place saved");
          }}
        />
      )}
      {selected && !editing && (
        <Details
          key={selected.id}
          p={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeleting(selected.id)}
          onSave={async (p) => {
            await t.save(p);
            setMessage("Saved");
          }}
        />
      )}
      {importing && (
        <ImportDialog
          places={t.places}
          onClose={() => setImporting(false)}
          onImport={async (p) => {
            await t.importPlaces(p);
            setMessage(`Imported ${p.length} places`);
          }}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete place?"
        description="This removes the place and its notes from this browser. Export a backup first if you want to keep it."
      >
        <div className="modal-footer">
          <button
            className="button secondary"
            onClick={() => setDeleting(null)}
          >
            Cancel
          </button>
          <button
            className="button danger"
            onClick={() =>
              void run(async () => {
                await t.remove(deleting!);
                setDeleting(null);
                setSelectedId(null);
              }, "Place deleted")
            }
          >
            Delete place
          </button>
        </div>
      </Dialog>
      <div
        className={message ? "toast" : "sr-only"}
        role="status"
        aria-live="polite"
      >
        {message}
        {message && (
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
function Details({
  p,
  onClose,
  onEdit,
  onDelete,
  onSave,
}: {
  p: Place;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (p: Place) => Promise<void>;
}) {
  const [notes, setNotes] = useState(p.notes),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const auto = knownPhoto(p.name);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={p.name}
      description={`${p.category} · ${p.subcategory}`}
      wide
    >
      <div className="detail-gallery">
        {(p.images.length ? p.images : [undefined]).map((src, i) => (
          <Photo
            key={i}
            src={src}
            name={p.name}
            category={p.subcategory || p.category}
          />
        ))}
      </div>
      {(p.attribution || auto?.credit) && (
        <p className="photo-credit">
          {p.attribution || `Built-in fallback photo: ${auto?.credit}`}
        </p>
      )}
      <p className="detail-description">{p.description}</p>
      <p className="address">
        {p.address || "Address not added"}
        {p.lat !== null && p.lng !== null && (
          <small>
            {p.lat}, {p.lng}
          </small>
        )}
      </p>
      <div className="detail-actions">
        <a
          className="button"
          href={directions(p)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Navigation size={16} />
          Walking directions
        </a>
        <button className="button secondary" onClick={onEdit}>
          <Pencil size={16} />
          Edit
        </button>
        <button
          className="icon-button danger-text"
          onClick={onDelete}
          aria-label="Delete place"
        >
          <Trash2 size={17} />
        </button>
      </div>
      <form
        className="notes-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await onSave({ ...p, notes });
            setError("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          Notes
          <textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={5000}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button secondary"
          disabled={saving || notes === p.notes}
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
      </form>
    </Dialog>
  );
}
