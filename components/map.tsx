"use client";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Place, directions } from "@/lib/model";
import { Photo } from "./photo";
import { MinimalBasemap } from "./map-basemap";
function markerSymbol(p: Place) {
  const path =
    p.category === "Food"
      ? '<path d="M5 3v7a2 2 0 0 0 4 0V3M7 3v18M16 3v8h3V3M19 3v18"/>'
      : '<path d="m3 9 9-6 9 6H3ZM5 9v10m7-10v10m7-10v10M3 21h18"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
function Fit({ places }: { places: Place[] }) {
  const map = useMap();
  // Only refit when coordinates change; notes/status edits must not move the map.
  const boundsKey = JSON.stringify(
    places
      .filter((p) => p.lat !== null && p.lng !== null)
      .map((p) => [p.lat, p.lng]),
  );
  useEffect(() => {
    const points = JSON.parse(boundsKey) as [number, number][];
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [45, 45],
        maxZoom: 14,
        animate: false,
      });
    else map.setView([51.5074, -0.1278], 12, { animate: false });
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 100);
    return () => clearTimeout(t);
  }, [boundsKey, map]);
  return null;
}
export default function TripMap({
  places,
  onSelect,
  compact = false,
}: {
  places: Place[];
  onSelect: (p: Place) => void;
  compact?: boolean;
}) {
  const [tileError, setTileError] = useState(false);
  const valid = places.filter((p) => p.lat !== null && p.lng !== null);
  return (
    <div className={`map-wrap ${compact ? "map-compact" : ""}`}>
      <MapContainer
        center={[51.5074, -0.1278]}
        zoom={12}
        minZoom={1}
        maxZoom={20}
        maxBounds={[
          [-85, -180],
          [85, 180],
        ]}
        maxBoundsViscosity={1}
        zoomControl={false}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        inertia={false}
        scrollWheelZoom={!compact}
        className="leaflet-map"
      >
        <ZoomControl position="bottomright" />
        {process.env.NEXT_PUBLIC_MAP_TILE_URL ? (
          <TileLayer
            attribution={
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
            url={process.env.NEXT_PUBLIC_MAP_TILE_URL}
            eventHandlers={{
              tileerror: () => setTileError(true),
              tileload: () => setTileError(false),
            }}
          />
        ) : (
          <MinimalBasemap onTileError={setTileError} />
        )}
        <Fit places={valid} />
        {valid.map((p) => (
          <Marker
            title={p.name}
            key={p.id}
            position={[p.lat!, p.lng!]}
            icon={L.divIcon({
              className: "custom-marker",
              html: `<span class="map-pin ${p.category === "Food" ? "pin-food" : "pin-activity"}">${markerSymbol(p)}</span>`,
              iconSize: [30, 35],
              iconAnchor: [15, 35],
              popupAnchor: [0, -31],
            })}
          >
            <Popup>
              <div className="map-popup">
                <Photo
                  src={p.images[0]}
                  name={p.name}
                  category={p.category}
                  placeId={p.id}
                  locationKey={[p.address, p.lat, p.lng].join("|")}
                />
                <strong>{p.name}</strong>
                <p>{p.area || p.category}</p>
                <button className="button small" onClick={() => onSelect(p)}>
                  View place
                </button>
                <a
                  href={directions(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Walking directions ↗
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tileError && (
        <div className="map-network-notice" role="status">
          Map tiles couldn’t load. Saved markers and Google Maps directions are
          still available.
        </div>
      )}
      {!compact && (
        <div className="map-legend">
          <span>
            <i className="dot food-dot" />
            Food
          </span>
          <span>
            <i className="dot activity-dot" />
            Activities
          </span>
          <span>
            {valid.length} on map · {places.length - valid.length} without
            coordinates
          </span>
        </div>
      )}
    </div>
  );
}
