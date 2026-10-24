"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as Alert from "@radix-ui/react-alert-dialog";
import {
  LayoutDashboard,
  Map,
  MapPin,
  Heart,
  Wallet,
  Utensils,
  Compass,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  Check,
  SlidersHorizontal,
  Grid2X2,
  List,
  Settings as SettingsIcon,
  Users,
  Upload,
  Download,
  LogOut,
  Copy,
  Trash2,
  Pencil,
  StickyNote,
  CalendarDays,
  Leaf,
  Navigation,
  LoaderCircle,
  X,
  CheckCircle2,
  Coffee,
  Landmark,
  ChevronRight,
  Cloud,
  Mail,
} from "lucide-react";
import { useTrip } from "@/lib/use-trip";
import { supabase } from "@/lib/supabase";
import {
  categories,
  newPlace,
  money,
  budget,
  cost,
  directions,
  filterPlaces,
  defaultFilters,
  duplicateKey,
  type Place,
  type Settings,
  type Filters,
} from "@/lib/model";
import { Dialog } from "./ui/dialog";
import { Photo } from "./photo";
import { PlaceForm } from "./place-form";
import { ImportDialog } from "./import-dialog";
const TripMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <LoaderCircle className="spin" />
      Unfolding the map…
    </div>
  ),
});
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "places", label: "All places", icon: Grid2X2 },
  { id: "food", label: "Food", icon: Utensils },
  { id: "activities", label: "Activities", icon: Compass },
  { id: "map", label: "Explore the map", icon: Map },
  { id: "favorites", label: "Favourites", icon: Heart },
  { id: "budget", label: "Trip budget", icon: Wallet },
];
const viewTitles: Record<string, [string, string]> = {
  places: [
    "Every little discovery",
    "The places that are making their way onto our London list.",
  ],
  food: [
    "Good food. Great company.",
    "From the first coffee to that last little something sweet.",
  ],
  activities: [
    "A city full of possibilities",
    "The iconic sights, the quiet corners, and everything in between.",
  ],
  favorites: [
    "The ones we love",
    "Our can’t-miss places, all in one lovely little list.",
  ],
  map: [
    "Let’s find our way",
    "See what’s nearby. Make room for a little spontaneity.",
  ],
  budget: [
    "A little planning goes a long way",
    "A thoughtful estimate, so you can focus on making memories.",
  ],
};
function priceLabel(p: Place) {
  return p.priceType === "free"
    ? "Free"
    : p.priceType === "unknown"
      ? "Cost not added"
      : `${money(p.price ?? 0)} / ${p.priceType === "person" ? "person" : "group"}`;
}
export default function Planner() {
  const t = useTrip();
  const [view, setView] = useState("overview"),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [list, setList] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [editing, setEditing] = useState<Place | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [importing, setImporting] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [toast, setToast] = useState(""),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [reset, setReset] = useState(false);
  const selected = t.places.find((p) => p.id === selectedId);
  const totals = budget(t.places, t.settings.travelers);
  const favorites = t.places.filter((p) => p.favorite),
    visited = t.places.filter((p) => p.visited).length;
  useEffect(() => {
    function sync() {
      const v = location.hash.slice(1);
      if (navigation.some((n) => n.id === v)) setView(v);
    }
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(id: string) {
    setView(id);
    setFilters(defaultFilters);
    setFilterOpen(false);
    window.history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openSettings() {
    if (!t.demo && !t.user) setAuthOpen(true);
    else setSettingsOpen(true);
  }
  async function action(fn: () => Promise<unknown>, message: string) {
    try {
      await fn();
      setToast(message);
    } catch (e) {
      t.setError((e as Error).message);
    }
  }
  function toggle(p: Place, key: "favorite" | "visited" | "planned") {
    void action(
      () => t.save({ ...p, [key]: !p[key] }),
      key === "favorite"
        ? p.favorite
          ? "Removed from favourites"
          : "Saved to favourites"
        : key === "visited"
          ? p.visited
            ? "Marked as not visited"
            : "Another memory made!"
          : p.planned
            ? "Removed from budget plan"
            : "Included in budget plan",
    );
  }
  const scopedFilters = {
    ...filters,
    category:
      view === "food"
        ? "Food"
        : view === "activities"
          ? "Activities"
          : filters.category,
    favorite: view === "favorites" || filters.favorite,
  };
  const visible = filterPlaces(t.places, scopedFilters);
  function exportPlaces() {
    const blob = new Blob([JSON.stringify(t.places, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "london-places.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(
      "Places exported. Private uploaded photos require a separate storage backup.",
    );
  }
  function cards(places: Place[]) {
    return (
      <div className={`place-grid ${list ? "list-view" : ""}`}>
        {places.map((p) => (
          <article className="place-card" key={p.id}>
            <button
              className="card-image-button"
              aria-label={`View ${p.name}`}
              onClick={() => setSelectedId(p.id)}
            >
              <Photo src={p.images[0]} name={p.name} category={p.category} />
            </button>
            <div className="card-image-overlays">
              <span
                className={`category-pill ${p.category === "Food" ? "pill-food" : "pill-activity"}`}
              >
                {p.category === "Food" ? (
                  <Utensils size={12} />
                ) : (
                  <Compass size={12} />
                )}{" "}
                {p.category}
              </span>
              <button
                aria-label={`${p.favorite ? "Unfavourite" : "Favourite"} ${p.name}`}
                aria-pressed={p.favorite}
                disabled={t.busy}
                className={`favorite-button ${p.favorite ? "is-favorite" : ""}`}
                onClick={() => toggle(p, "favorite")}
              >
                <Heart size={17} fill={p.favorite ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="card-body">
              <div className="eyebrow card-area">
                <MapPin size={12} />
                {p.area || "Area to be added"}
                {p.demo && <span className="demo-tag">DEMO</span>}
              </div>
              <button
                className="card-title"
                onClick={() => setSelectedId(p.id)}
              >
                {p.name}
                <ArrowUpRight size={17} />
              </button>
              <p className="card-description">
                {p.description || "A new place on our London list."}
              </p>
              <span className="subcategory">{p.subcategory || p.category}</span>
              <div className="card-footer">
                <span>{priceLabel(p)}</span>
                <div>
                  {p.notes && <StickyNote size={14} aria-label="Has notes" />}
                  <button
                    disabled={t.busy}
                    className={`visited-button ${p.visited ? "is-visited" : ""}`}
                    aria-label={`${p.visited ? "Mark not visited" : "Mark visited"}: ${p.name}`}
                    aria-pressed={p.visited}
                    onClick={() => toggle(p, "visited")}
                  >
                    <Check size={13} />
                    {p.visited ? "Visited" : "To visit"}
                  </button>
                  <a
                    className="directions-icon"
                    href={directions(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Walking directions to ${p.name}`}
                  >
                    <Navigation size={15} />
                  </a>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }
  function empty() {
    return (
      <div className="empty-state">
        <MapPin size={38} strokeWidth={1} />
        <h3>
          {t.places.length
            ? "No places match just yet"
            : "Every adventure starts somewhere"}
        </h3>
        <p>
          {t.places.length
            ? "Try a different search or give those filters a little reset."
            : "Add your first discovery, or bring along your existing list."}
        </p>
        <button
          className="button"
          onClick={() =>
            t.places.length
              ? setFilters(defaultFilters)
              : setEditing(newPlace())
          }
        >
          {t.places.length ? "Reset filters" : "Add your first place"}
          <Plus size={16} />
        </button>
      </div>
    );
  }
  function toolbar() {
    return (
      <>
        <div className="discovery-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search places"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder="Find a place, a neighbourhood, a little inspiration…"
            />
            {filters.search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setFilters({ ...filters, search: "" })}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            className={`button secondary ${filterOpen ? "active-filter" : ""}`}
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          {view !== "map" && (
            <div className="view-toggle">
              <button
                className={!list ? "active" : ""}
                onClick={() => setList(false)}
                aria-label="Grid view"
                aria-pressed={!list}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                className={list ? "active" : ""}
                onClick={() => setList(true)}
                aria-label="List view"
                aria-pressed={list}
              >
                <List size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="category-row">
          {["All", "Food", "Activities"].map((c) => (
            <button
              key={c}
              className={`filter-chip ${scopedFilters.category === c ? "selected" : ""}`}
              onClick={() => {
                if (view === "food" || view === "activities") go("places");
                setFilters({ ...filters, category: c, subcategory: "All" });
              }}
            >
              {c === "All" ? (
                "All discoveries"
              ) : c === "Food" ? (
                <>
                  <Utensils size={14} />
                  Food & drink
                </>
              ) : (
                <>
                  <Compass size={14} />
                  Things to do
                </>
              )}
            </button>
          ))}
          <span className="result-count">
            {visible.length} {visible.length === 1 ? "place" : "places"}
          </span>
        </div>
        {filterOpen && (
          <div className="filter-panel">
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
                    ...(scopedFilters.category === "All"
                      ? [...categories.Food, ...categories.Activities]
                      : categories[
                          scopedFilters.category as "Food" | "Activities"
                        ]),
                    ...t.places
                      .filter(
                        (p) =>
                          scopedFilters.category === "All" ||
                          p.category === scopedFilters.category,
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
              Visit status
              <select
                value={filters.visited}
                onChange={(e) =>
                  setFilters({ ...filters, visited: e.target.value })
                }
              >
                <option value="all">Any status</option>
                <option value="visited">Visited</option>
                <option value="unvisited">Not visited yet</option>
              </select>
            </label>
            <label>
              Max estimate (GBP)
              <input
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: e.target.value })
                }
                placeholder="No limit"
              />
            </label>
            <label>
              Sort by
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value })
                }
              >
                <option value="recent">Recently added</option>
                <option value="alpha">Alphabetical</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="favorites">Favourites first</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={scopedFilters.favorite}
                disabled={view === "favorites"}
                onChange={(e) =>
                  setFilters({ ...filters, favorite: e.target.checked })
                }
              />
              Favourites only
            </label>
            <button
              className="text-button"
              onClick={() => setFilters(defaultFilters)}
            >
              Reset all filters
            </button>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#overview" className="brand" onClick={() => go("overview")}>
          <span className="brand-mark">
            L<span>•</span>
          </span>
          <span>
            london<span className="brand-together">together.</span>
          </span>
        </a>
        <div className="workspace-label">YOUR LITTLE ADVENTURE</div>
        <div className="trip-label">
          <span className="trip-icon">
            <Landmark size={20} />
          </span>
          <div>
            <strong>{t.settings.name}</strong>
            <span>
              {t.demo
                ? "A little taste of what’s possible"
                : "Our shared collection"}
            </span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={(e) => {
                e.preventDefault();
                go(n.id);
              }}
              className={view === n.id ? "nav-link current" : "nav-link"}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.7} />
              {n.label}
              {n.id === "favorites" && favorites.length > 0 && (
                <span className="nav-count">{favorites.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="travel-note">
            <Leaf size={21} />
            <p>
              Collect moments,
              <br />
              <em>not just places.</em>
            </p>
          </div>
          <button className="nav-link" onClick={() => openSettings()}>
            <Users size={19} />
            Trip & companions
          </button>
          <button className="nav-link" onClick={() => setAuthOpen(true)}>
            <Cloud size={19} />
            {t.demo ? "Connect your trip" : "Account & sign in"}
          </button>
          <div className="sidebar-caption">MADE FOR WANDERING, TOGETHER</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Our little escape</span>
            <ChevronRight size={13} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <a
            className="mobile-brand"
            href="#overview"
            onClick={() => go("overview")}
          >
            london<span>together.</span>
          </a>
          <div className="topbar-actions">
            <button
              className="companions-button"
              onClick={() => openSettings()}
              aria-label="Trip settings and companions"
            >
              <span className="avatar">
                {t.demo ? "Y" : (t.user?.email?.[0] || "Y").toUpperCase()}
              </span>
              <span className="avatar avatar-second">
                {t.demo ? "+" : t.members.length || 1}
              </span>
              <span className="together-label">Better together</span>
            </button>
            <button
              className="icon-button"
              onClick={() => openSettings()}
              aria-label="Open trip settings"
            >
              <SettingsIcon size={19} />
            </button>
            <button
              className="button add-top"
              onClick={() => setEditing(newPlace())}
              disabled={!t.demo && !t.trip}
            >
              <Plus size={17} />
              <span>Add place</span>
            </button>
          </div>
        </header>
        {t.demo && (
          <div className="demo-banner">
            <span>
              <i className="dot" /> <strong>Local demo</strong>
              <span className="demo-description">
                {" "}
                · Sample entries & example prices. Changes stay in this browser.
              </span>
            </span>
            <button onClick={() => setAuthOpen(true)}>
              Make it your own <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {t.error && (
          <div className="global-error" role="alert">
            <span>{t.error}</span>
            <button
              aria-label="Dismiss error"
              className="icon-button"
              onClick={() => t.setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <main id="main-content" className={view === "map" ? "map-page" : ""}>
          {t.loading ? (
            <div className="skeleton-page" aria-label="Loading trip">
              <div className="skeleton skeleton-hero" />
              <div className="stats-grid">
                {[1, 2, 3, 4].map((x) => (
                  <div key={x} className="skeleton skeleton-stat" />
                ))}
              </div>
              <div className="place-grid">
                {[1, 2, 3].map((x) => (
                  <div key={x} className="skeleton skeleton-card" />
                ))}
              </div>
            </div>
          ) : !t.demo && !t.user ? (
            <div className="welcome-screen">
              <span className="section-kicker">
                A CITY TO EXPLORE. A TRIP TO SHARE.
              </span>
              <h1>
                London is better
                <br />
                <em>together.</em>
              </h1>
              <p>
                Your favourite places, your people, your next great adventure. A
                private little home for all your London plans.
              </p>
              <button className="button" onClick={() => setAuthOpen(true)}>
                Start our adventure
                <ArrowRight size={18} />
              </button>
              <button className="text-button" onClick={t.enterDemo}>
                Take a look around the demo
              </button>
            </div>
          ) : !t.demo && !t.trip ? (
            <div className="welcome-screen">
              <span className="section-kicker">LET’S MAKE SOME MEMORIES</span>
              <h1>
                Your London
                <br />
                <em>starts here.</em>
              </h1>
              <p>Create your private trip or join a companion’s invitation.</p>
              <button
                className="button"
                disabled={t.busy}
                onClick={() =>
                  void action(
                    () => t.create("Our London trip"),
                    "Your private trip is ready",
                  )
                }
              >
                Create our trip
                <Plus size={18} />
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  void action(
                    t.accept,
                    "Checked invitations. Your trips are up to date.",
                  )
                }
              >
                Accept my invitations
              </button>
            </div>
          ) : (
            <>
              {view === "overview" ? (
                <>
                  <section className="hero">
                    <img
                      className="hero-image"
                      src="/photos/tower-bridge.webp"
                      alt="Tower Bridge at dawn over the River Thames"
                      fetchPriority="high"
                    />
                    <div className="hero-shade" />
                    <div className="hero-content">
                      <span className="hero-kicker">
                        <span /> THE CITY IS CALLING
                      </span>
                      <h1>
                        A little less planning.
                        <br />
                        <em>A little more London.</em>
                      </h1>
                      <p>
                        Good food, new discoveries, and our favourite people.
                        <br />
                        Let’s make this a trip to remember.
                      </p>
                      <button
                        className="button hero-button"
                        onClick={() => go("places")}
                      >
                        Explore our places
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="hero-location">
                      <MapPin size={14} />
                      LONDON, UNITED KINGDOM
                    </div>
                    <a
                      className="hero-credit"
                      href="https://commons.wikimedia.org/wiki/File:Tower_Bridge_at_Dawn.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Fuzzypiggy · CC BY-SA 3.0
                    </a>
                  </section>
                  <div className="overview-heading">
                    <div>
                      <h2>{t.settings.name}</h2>
                      <p>
                        Our plans so far. Plenty of room for the unexpected.
                      </p>
                    </div>
                    <button
                      className="date-button"
                      onClick={() => openSettings()}
                    >
                      <CalendarDays size={16} />
                      {t.settings.start
                        ? `${new Date(t.settings.start + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${t.settings.end ? " – " + new Date(t.settings.end + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}`
                        : "Add trip dates"}
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="stats-grid">
                    <button className="stat-card" onClick={() => go("places")}>
                      <span className="stat-icon terracotta">
                        <MapPin size={19} />
                      </span>
                      <div>
                        <span>Places to discover</span>
                        <strong>
                          {t.places.length}
                          <small>
                            {
                              t.places.filter((p) => p.category === "Food")
                                .length
                            }{" "}
                            food ·{" "}
                            {
                              t.places.filter(
                                (p) => p.category === "Activities",
                              ).length
                            }{" "}
                            activities
                          </small>
                        </strong>
                      </div>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => go("favorites")}
                    >
                      <span className="stat-icon rose">
                        <Heart size={19} />
                      </span>
                      <div>
                        <span>On our must-do list</span>
                        <strong>
                          {favorites.length}
                          <small>A few firm favourites</small>
                        </strong>
                      </div>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => {
                        go("places");
                        setFilters({ ...defaultFilters, visited: "visited" });
                      }}
                    >
                      <span className="stat-icon sage">
                        <CheckCircle2 size={19} />
                      </span>
                      <div>
                        <span>Memories made</span>
                        <strong>
                          {visited}
                          <small>
                            {t.places.length
                              ? Math.round((visited / t.places.length) * 100)
                              : 0}
                            % of our places visited
                          </small>
                        </strong>
                      </div>
                    </button>
                    <button className="stat-card" onClick={() => go("budget")}>
                      <span className="stat-icon sand">
                        <Wallet size={19} />
                      </span>
                      <div>
                        <span>Our planned budget</span>
                        <strong>
                          {money(totals.total)}
                          <small>
                            For {t.settings.travelers} travellers
                            {totals.unknown
                              ? ` · ${totals.unknown} unpriced`
                              : ""}
                          </small>
                        </strong>
                      </div>
                    </button>
                  </div>
                  <section className="section-block">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">
                          SAVED WITH A LITTLE LOVE
                        </span>
                        <h2>
                          A few of our favourites <Heart size={19} />
                        </h2>
                        <p>The places we’re already looking forward to.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("favorites")}
                      >
                        All favourites
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    {favorites.length ? (
                      cards(favorites.slice(0, 3))
                    ) : (
                      <div className="small-empty">
                        Tap a heart on any place to start your must-do list.{" "}
                        <button
                          className="text-button"
                          onClick={() => go("places")}
                        >
                          Browse places →
                        </button>
                      </div>
                    )}
                  </section>
                  <div className="overview-bottom">
                    <section className="section-block recent-section">
                      <div className="section-heading">
                        <div>
                          <span className="section-kicker">
                            THE LIST KEEPS GROWING
                          </span>
                          <h2>Fresh on the list</h2>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => go("places")}
                        >
                          View all
                          <ArrowRight size={16} />
                        </button>
                      </div>
                      {t.places.length ? (
                        [...t.places]
                          .sort((a, b) =>
                            b.createdAt.localeCompare(a.createdAt),
                          )
                          .slice(0, 3)
                          .map((p) => (
                            <button
                              className="recent-place"
                              key={p.id}
                              onClick={() => setSelectedId(p.id)}
                            >
                              <Photo
                                src={p.images[0]}
                                name={p.name}
                                category={p.category}
                              />
                              <span>
                                <strong>{p.name}</strong>
                                <small>
                                  {p.subcategory} · {p.area || "London"}
                                </small>
                              </span>
                              <ArrowUpRight size={18} />
                            </button>
                          ))
                      ) : (
                        <p className="muted">
                          Your next discovery belongs here.
                        </p>
                      )}
                    </section>
                    <section className="mini-map-section">
                      <div className="mini-map-heading">
                        <div>
                          <span className="section-kicker">
                            CONNECT THE LITTLE DOTS
                          </span>
                          <h2>Our corner of London</h2>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Open full map"
                          onClick={() => go("map")}
                        >
                          <ArrowUpRight size={20} />
                        </button>
                      </div>
                      <TripMap
                        places={t.places}
                        onSelect={(p) => setSelectedId(p.id)}
                        compact
                      />
                      <button
                        className="mini-map-link"
                        onClick={() => go("map")}
                      >
                        <Map size={16} />
                        Explore the full map
                        <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="closing-note">
                    <Leaf size={16} />
                    <span>
                      The best part of a trip? The people you share it with.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="section-kicker">
                        OUR LONDON, OUR WAY
                      </span>
                      <h1>{viewTitles[view]?.[0]}</h1>
                      <p>{viewTitles[view]?.[1]}</p>
                    </div>
                    {view !== "budget" && (
                      <div className="page-actions">
                        <button
                          className="button secondary"
                          onClick={() => setImporting(true)}
                        >
                          <Upload size={16} />
                          Import
                        </button>
                        <button
                          className="button secondary export-button"
                          onClick={exportPlaces}
                        >
                          <Download size={16} />
                          Export
                        </button>
                      </div>
                    )}
                  </div>
                  {view === "budget" ? (
                    <>
                      <div className="budget-summary">
                        <div className="budget-total">
                          <span className="section-kicker">
                            PROJECTED GROUP SPENDING
                          </span>
                          <strong>{money(totals.total)}</strong>
                          <p>
                            {totals.count} planned places ·{" "}
                            {t.settings.travelers} travellers
                          </p>
                          <small>
                            Estimates only. {totals.unknown} planned{" "}
                            {totals.unknown === 1
                              ? "place needs"
                              : "places need"}{" "}
                            a price.
                          </small>
                        </div>
                        <div className="budget-limit">
                          <span>
                            {t.settings.limit !== null
                              ? "Your budget, at a glance"
                              : "A little breathing room"}
                          </span>
                          <h3>
                            {t.settings.limit !== null
                              ? `${money(Math.abs(t.settings.limit - totals.total))} ${t.settings.limit < totals.total ? "over budget" : "remaining"}`
                              : "Set a comfortable trip budget"}
                          </h3>
                          {t.settings.limit !== null && (
                            <div className="progress-track">
                              <div
                                style={{
                                  width: `${t.settings.limit ? Math.min((totals.total / t.settings.limit) * 100, 100) : 100}%`,
                                }}
                              />
                            </div>
                          )}
                          <button
                            className="text-button"
                            onClick={() => openSettings()}
                          >
                            Edit budget & traveller count
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="budget-breakdown">
                        {(["Food", "Activities"] as const).map((c) => (
                          <div className="breakdown-card" key={c}>
                            <span
                              className={`stat-icon ${c === "Food" ? "terracotta" : "sage"}`}
                            >
                              {c === "Food" ? (
                                <Utensils size={21} />
                              ) : (
                                <Compass size={21} />
                              )}
                            </span>
                            <div>
                              <span>
                                {c === "Food" ? "Food & drink" : "Things to do"}
                              </span>
                              <strong>
                                {money(
                                  c === "Food"
                                    ? totals.food
                                    : totals.activities,
                                )}
                              </strong>
                            </div>
                            <div className="progress-track">
                              <div
                                style={{
                                  width: `${totals.total ? ((c === "Food" ? totals.food : totals.activities) / totals.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <section className="section-block">
                        <div className="section-heading">
                          <div>
                            <h2>What’s in the plan?</h2>
                            <p>
                              Your wishlist is full of possibilities. Only
                              checked places count toward the budget.
                            </p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => setEditing(newPlace())}
                          >
                            Add a place
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="budget-list">
                          {t.places.length
                            ? t.places.map((p) => (
                                <div
                                  className={`budget-row ${p.planned ? "included" : ""}`}
                                  key={p.id}
                                >
                                  <label className="budget-check">
                                    <input
                                      type="checkbox"
                                      checked={p.planned}
                                      disabled={t.busy}
                                      onChange={() => toggle(p, "planned")}
                                      aria-label={`Include ${p.name} in budget`}
                                    />
                                  </label>
                                  <span
                                    className={`budget-category-icon ${p.category === "Food" ? "terracotta" : "sage"}`}
                                  >
                                    {p.category === "Food" ? (
                                      <Coffee size={19} />
                                    ) : (
                                      <Landmark size={19} />
                                    )}
                                  </span>
                                  <button
                                    className="budget-name"
                                    onClick={() => setSelectedId(p.id)}
                                  >
                                    <strong>{p.name}</strong>
                                    <span>
                                      {p.subcategory} {p.demo ? "· Demo" : ""}
                                    </span>
                                  </button>
                                  <span className="budget-per-person">
                                    {priceLabel(p)}
                                  </span>
                                  <strong className="budget-price">
                                    {p.priceType === "unknown"
                                      ? "Not estimated"
                                      : money(cost(p, t.settings.travelers))}
                                  </strong>
                                  <button
                                    className="icon-button"
                                    aria-label={`Edit cost for ${p.name}`}
                                    onClick={() => setEditing(p)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                </div>
                              ))
                            : empty()}
                        </div>
                        <div className="category-costs">
                          <h3>Category breakdown</h3>
                          {[
                            ...new Set(
                              t.places
                                .filter((p) => p.planned)
                                .map((p) => p.subcategory || p.category),
                            ),
                          ].map((c) => (
                            <div key={c}>
                              <span>{c}</span>
                              <strong>
                                {money(
                                  t.places
                                    .filter(
                                      (p) =>
                                        p.planned &&
                                        (p.subcategory || p.category) === c,
                                    )
                                    .reduce(
                                      (n, p) =>
                                        n + cost(p, t.settings.travelers),
                                      0,
                                    ),
                                )}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      {toolbar()}
                      {view === "map" ? (
                        <TripMap
                          places={visible}
                          onSelect={(p) => setSelectedId(p.id)}
                        />
                      ) : visible.length ? (
                        cards(visible)
                      ) : (
                        empty()
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="site-footer">
          <span>london, together.</span>
          <span>
            A little collection of places. A whole lot of possibility.
          </span>
          <button onClick={() => openSettings()}>
            Our trip
            <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation
          .filter((n) =>
            ["overview", "places", "map", "favorites", "budget"].includes(n.id),
          )
          .map((n) => (
            <a
              href={`#${n.id}`}
              key={n.id}
              className={view === n.id ? "current" : ""}
              onClick={(e) => {
                e.preventDefault();
                go(n.id);
              }}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>
                {n.id === "overview"
                  ? "Home"
                  : n.id === "places"
                    ? "Places"
                    : n.id === "map"
                      ? "Map"
                      : n.id === "favorites"
                        ? "Saved"
                        : "Budget"}
              </span>
            </a>
          ))}
      </nav>
      {editing && (
        <PlaceForm
          key={editing.id}
          initial={editing}
          onClose={() => setEditing(null)}
          demo={t.demo}
          tripId={t.trip?.id}
          onSave={async (p) => {
            if (
              t.places.some(
                (x) => x.id !== p.id && duplicateKey(x) === duplicateKey(p),
              )
            )
              throw Error("A place with this name is already saved");
            await t.save(p);
            setToast("A lovely little plan, saved.");
          }}
        />
      )}
      {selected && !editing && (
        <Detail
          place={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeleteId(selected.id)}
          onToggle={(key) => toggle(selected, key)}
          onSaveNotes={async (notes) => {
            await t.save({ ...selected, notes });
            setToast("Notes saved");
          }}
          busy={t.busy}
        />
      )}
      {importing && (
        <ImportDialog
          places={t.places}
          onImport={async (p) => {
            await t.importPlaces(p);
            setToast(`${p.length} discoveries added to the list`);
          }}
          onClose={() => setImporting(false)}
        />
      )}
      {settingsOpen && (
        <TripSettings
          settings={t.settings}
          onSave={async (s) => {
            await t.saveSettings(s);
            setToast("Trip details saved");
          }}
          onClose={() => setSettingsOpen(false)}
          demo={t.demo}
          owner={t.demo || Boolean(t.trip && t.trip.owner_id === t.user?.id)}
          trips={t.trips}
          tripId={t.trip?.id}
          members={t.members}
          invitations={t.invitations}
          onInvite={t.invite}
          onRevoke={t.revoke}
          onRemoveMember={t.removeMember}
          userId={t.user?.id}
          onAccept={t.accept}
          onSelect={t.selectTrip}
          onCreate={t.create}
          onReset={() => setReset(true)}
          onExport={exportPlaces}
        />
      )}
      {authOpen && (
        <AuthDialog
          demo={t.demo}
          email={t.user?.email}
          onClose={() => setAuthOpen(false)}
          onDemo={() => {
            t.enterDemo();
            setAuthOpen(false);
          }}
          onConnect={() => {
            t.leaveDemo();
            setAuthOpen(false);
          }}
        />
      )}
      <Alert.Root
        open={!!deleteId || reset}
        onOpenChange={(v) => {
          if (!v && !t.busy) {
            setDeleteId(null);
            setReset(false);
          }
        }}
      >
        <Alert.Portal>
          <Alert.Overlay className="modal-overlay" />
          <Alert.Content className="modal confirm-modal">
            <div className="delete-icon">
              <Trash2 size={25} />
            </div>
            <Alert.Title>
              {reset
                ? "Make room for your own discoveries?"
                : "Remove this place?"}
            </Alert.Title>
            <Alert.Description>
              {reset
                ? "This clears all demo places and settings from this browser. Export a backup first if you want to keep them."
                : "This place and its notes will be removed from the trip. This cannot be undone."}
            </Alert.Description>
            <div className="modal-footer">
              <Alert.Cancel className="button secondary" disabled={t.busy}>
                Keep it
              </Alert.Cancel>
              <button
                className="button danger"
                disabled={t.busy}
                onClick={async () => {
                  try {
                    if (reset) await t.resetDemo();
                    else if (deleteId) {
                      await t.remove(deleteId);
                      setSelectedId(null);
                    }
                    setDeleteId(null);
                    setReset(false);
                    setToast(
                      reset ? "A fresh start. Make it yours." : "Place removed",
                    );
                  } catch (e) {
                    t.setError((e as Error).message);
                  }
                }}
              >
                {t.busy ? "Removing…" : reset ? "Clear demo" : "Remove place"}
              </button>
            </div>
          </Alert.Content>
        </Alert.Portal>
      </Alert.Root>
      <div
        className={toast ? "toast" : "sr-only"}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <>
            <CheckCircle2 size={19} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
function Detail({
  place: p,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onSaveNotes,
  busy,
}: {
  place: Place;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (key: "favorite" | "visited" | "planned") => void;
  onSaveNotes: (notes: string) => Promise<void>;
  busy: boolean;
}) {
  const [notes, setNotes] = useState(p.notes),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [activeImage, setActiveImage] = useState(0);
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
      <div className="detail-photo">
        <Photo
          src={p.images[activeImage]}
          name={p.name}
          category={p.category}
        />
        {p.demo && (
          <span className="category-pill detail-demo">DEMO ENTRY</span>
        )}
      </div>
      {p.images.length > 1 && (
        <div className="gallery-thumbnails">
          {p.images.map((src, i) => (
            <button
              key={src}
              aria-label={`View photo ${i + 1}`}
              aria-pressed={i === activeImage}
              onClick={() => setActiveImage(i)}
            >
              <Photo src={src} name={p.name} category={p.category} />
            </button>
          ))}
        </div>
      )}
      {p.attribution && (
        <p className="photo-credit">Photo credit: {p.attribution}</p>
      )}
      <div className="detail-tags">
        <span className="category-pill pill-activity">
          <MapPin size={13} />
          {p.area || "Area not added"}
        </span>
        <span>{priceLabel(p)}</span>
      </div>
      <p className="detail-description">
        {p.description ||
          "A place waiting to be explored. Add a description to make it your own."}
      </p>
      <div className="detail-status">
        <button
          className={`button secondary ${p.favorite ? "is-favorite" : ""}`}
          onClick={() => onToggle("favorite")}
          disabled={busy}
        >
          <Heart size={16} fill={p.favorite ? "currentColor" : "none"} />
          {p.favorite ? "Favourited" : "Favourite"}
        </button>
        <button
          className={`button secondary ${p.visited ? "is-visited" : ""}`}
          onClick={() => onToggle("visited")}
          disabled={busy}
        >
          <CheckCircle2 size={16} />
          {p.visited ? "Visited" : "Mark visited"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={p.planned}
            disabled={busy}
            onChange={() => onToggle("planned")}
          />
          In our budget plan
        </label>
      </div>
      <div className="address-panel">
        <MapPin size={20} />
        <div>
          <strong>{p.address || "Address not added yet"}</strong>
          <small>
            {p.lat !== null && p.lng !== null
              ? `${p.lat}, ${p.lng}`
              : "Coordinates not added. Directions will search by name."}
          </small>
        </div>
        <button
          className="icon-button"
          aria-label="Copy address"
          disabled={!p.address}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(p.address);
              setCopied(true);
            } catch {
              setError("Unable to copy address. You can select it above.");
            }
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
      </div>
      {p.lat !== null && p.lng !== null && (
        <TripMap places={[p]} onSelect={() => {}} compact />
      )}
      <a
        className="button directions-button"
        href={directions(p)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Navigation size={17} />
        Walking directions in Google Maps
        <ArrowUpRight size={16} />
      </a>
      <form
        className="notes-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSaveNotes(notes);
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          <StickyNote size={16} />A note for our future selves
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="What should we remember?"
          />
        </label>
        <button className="text-button" disabled={busy || notes === p.notes}>
          Save notes
          <Check size={15} />
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer detail-footer">
        <button className="text-button delete-text" onClick={onDelete}>
          <Trash2 size={15} />
          Remove place
        </button>
        <button className="button secondary" onClick={onEdit}>
          <Pencil size={15} />
          Edit details
        </button>
      </div>
    </Dialog>
  );
}
function AuthDialog({
  demo,
  email,
  onClose,
  onDemo,
  onConnect,
}: {
  demo: boolean;
  email?: string;
  onClose: () => void;
  onDemo: () => void;
  onConnect: () => void;
}) {
  const [address, setAddress] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={
        email
          ? "Your travel companion account"
          : "Good plans deserve good company"
      }
      description="Private trips. Shared discoveries. Sign in with a secure email link."
    >
      <div className="auth-art">
        <Mail size={33} strokeWidth={1} />
      </div>
      {!supabase ? (
        <div className="configuration-message">
          <h3>Your own trip is one connection away.</h3>
          <p>
            This is a local demo. To enable secure sign-in, private storage and
            live collaboration, configure a Supabase project using the
            deployment guide in the README.
          </p>
          <p>No account details are collected in demo mode.</p>
          <button className="button secondary" onClick={onDemo}>
            Keep exploring the demo
            <ArrowRight size={16} />
          </button>
        </div>
      ) : email ? (
        <>
          <p>
            Signed in as <strong>{email}</strong>
          </p>
          <button
            className="button secondary"
            onClick={async () => {
              const r = await supabase!.auth.signOut();
              if (r.error) setError(r.error.message);
              else onClose();
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </>
      ) : (
        <>
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
                  "Check your email for a secure sign-in link. Open it in this browser to continue.",
                );
              setBusy(false);
            }}
          >
            <label>
              Your email
              <input
                type="email"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="success">
                {message}
              </p>
            )}
            <button className="button full mt" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
              <ArrowRight size={16} />
            </button>
          </form>
          {demo ? (
            <button className="text-button mt" onClick={onConnect}>
              Go to my shared account →
            </button>
          ) : (
            <button className="text-button mt" onClick={onDemo}>
              Explore the local demo first →
            </button>
          )}
          <p className="privacy-note">
            Demo places stay separate from your shared account. Export and
            import them if you’d like to bring them along.
          </p>
        </>
      )}
    </Dialog>
  );
}
type TripSettingsProps = {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
  onClose: () => void;
  demo: boolean;
  owner: boolean;
  trips: { id: string; settings: Settings }[];
  tripId?: string;
  members: { user_id: string; role: string }[];
  invitations: { id: string; email: string }[];
  onInvite: (email: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
  userId?: string;
  onAccept: () => Promise<void>;
  onSelect: (id: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onReset: () => void;
  onExport: () => void;
};
function TripSettings(p: TripSettingsProps) {
  const [s, setS] = useState(p.settings),
    [email, setEmail] = useState(""),
    [newName, setNewName] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMessage(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) p.onClose();
      }}
      title="Our trip, our way"
      description="A few little details to make it yours."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => p.onSave(s), "Trip settings saved");
        }}
      >
        <fieldset disabled={!p.owner || busy}>
          <label>
            Trip name
            <input
              required
              value={s.name}
              maxLength={100}
              onChange={(e) => setS({ ...s, name: e.target.value })}
            />
          </label>
          <div className="form-grid mt">
            <label>
              From
              <input
                type="date"
                value={s.start}
                onChange={(e) => setS({ ...s, start: e.target.value })}
              />
            </label>
            <label>
              Until
              <input
                type="date"
                value={s.end}
                min={s.start}
                onChange={(e) => setS({ ...s, end: e.target.value })}
              />
            </label>
            <label>
              Travellers
              <input
                type="number"
                min="1"
                max="100"
                required
                value={s.travelers}
                onChange={(e) =>
                  setS({ ...s, travelers: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Budget limit (GBP)
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={s.limit ?? ""}
                onChange={(e) =>
                  setS({
                    ...s,
                    limit:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Optional"
              />
            </label>
          </div>
          <button className="button full mt" disabled={!p.owner || busy}>
            {busy ? "Saving…" : "Save trip details"}
          </button>
        </fieldset>
        {!p.owner && (
          <p className="muted">
            Only the trip owner can change these settings.
          </p>
        )}
      </form>
      {p.demo ? (
        <div className="settings-section">
          <h3>
            <Users size={18} />
            Better with your people
          </h3>
          <p>
            Demo changes are stored only in this browser. Connect Supabase and
            sign in to invite companions and sync across devices.
          </p>
          <button className="button secondary full" onClick={p.onExport}>
            <Download size={16} />
            Export places backup
          </button>
          <button className="text-button delete-text mt" onClick={p.onReset}>
            <Trash2 size={15} />
            Clear demo places & start fresh
          </button>
        </div>
      ) : (
        <>
          <div className="settings-section">
            <h3>
              <Users size={18} />
              Our companions
            </h3>
            <p>
              {p.members.length} {p.members.length === 1 ? "member" : "members"}{" "}
              in this private trip. Favourites, notes and visited status are
              shared.
            </p>
            <div className="member-list">
              {p.members.map((member) => (
                <div className="invitation-row" key={member.user_id}>
                  <span>
                    {member.user_id === p.userId
                      ? "You"
                      : `Companion · ${member.user_id.slice(0, 8)}`}
                    <small>
                      {member.role === "owner"
                        ? "Trip owner"
                        : "Can add and edit places"}
                    </small>
                  </span>
                  {p.owner && member.role !== "owner" && (
                    <button
                      className="icon-button"
                      aria-label="Remove companion"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Remove this companion’s access to the trip?",
                          )
                        )
                          void run(
                            () => p.onRemoveMember(member.user_id),
                            "Companion removed",
                          );
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {p.owner && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await p.onInvite(email);
                      setEmail("");
                    }, "Invitation saved. Send your companion the website URL; we do not send invitation emails.");
                  }}
                >
                  <label>
                    Invite by email
                    <div className="input-action">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="friend@example.com"
                      />
                      <button className="button secondary" disabled={busy}>
                        Invite
                        <Plus size={15} />
                      </button>
                    </div>
                  </label>
                </form>
                <small>
                  Your friend signs in with this email and selects “Accept
                  invitations”. Share the website link yourself.
                </small>
                {p.invitations.map((i) => (
                  <div className="invitation-row" key={i.id}>
                    <span>
                      {i.email}
                      <small>Pending invitation</small>
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Revoke invitation for ${i.email}`}
                      disabled={busy}
                      onClick={() =>
                        void run(() => p.onRevoke(i.id), "Invitation revoked")
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </>
            )}
            <button
              className="text-button mt"
              disabled={busy}
              onClick={() =>
                void run(
                  p.onAccept,
                  "Invitations checked; close settings to view the trip.",
                )
              }
            >
              Accept my invitations
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="settings-section">
            <h3>My trips</h3>
            {p.trips.length > 0 && (
              <label>
                Switch workspace
                <select
                  value={p.tripId || ""}
                  disabled={busy}
                  onChange={(e) =>
                    void run(async () => {
                      await p.onSelect(e.target.value);
                      p.onClose();
                    }, "Trip opened")
                  }
                >
                  {p.trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.settings.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <form
              className="mt"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await p.onCreate(newName);
                  p.onClose();
                }, "New trip created");
              }}
            >
              <label>
                Create another trip
                <div className="input-action">
                  <input
                    required
                    maxLength={100}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Another London adventure"
                  />
                  <button className="button secondary" disabled={busy}>
                    <Plus size={16} />
                    Create
                  </button>
                </div>
              </label>
            </form>
          </div>
        </>
      )}
      {message && (
        <p className="success" role="status">
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
