"use client";
import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import type L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

const attribution =
  '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>';

export function MinimalBasemap({
  onTileError,
}: {
  onTileError: (error: boolean) => void;
}) {
  const map = useMap();
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let active = true;
    let layer: L.MaplibreGL | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const container = map.getContainer();
    container.dataset.basemap = "loading";
    const remove = () => {
      if (layer && map.hasLayer(layer)) {
        // A GPU constructor failure can leave the Leaflet adapter registered
        // before its MapLibre instance exists. Its usual onRemove assumes one.
        if (!layer.getMaplibreMap()) {
          const failed = layer;
          failed.onRemove = () => {
            failed.getContainer()?.remove();
            return failed;
          };
        }
        map.removeLayer(layer);
      }
      layer = undefined;
    };
    const showStandard = () => {
      if (!active) return;
      clearTimeout(timeout);
      remove();
      container.dataset.basemap = "standard";
      setFallback(true);
    };
    async function start() {
      try {
        // Avoid constructing a partially initialised adapter on older phones.
        const probe = document.createElement("canvas").getContext("webgl2");
        if (!probe) return showStandard();
        probe.getExtension("WEBGL_lose_context")?.loseContext();
        const [libre, adapter] = await Promise.all([
          import("maplibre-gl"),
          import("@maplibre/maplibre-gl-leaflet"),
        ]);
        if (!active) return;
        // Next bundles this exact installed worker as a same-origin static asset.
        libre.setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)
            .href,
        );
        libre.setWorkerCount(2);
        layer = adapter.maplibreGL({
          style: "https://tiles.openfreemap.org/styles/positron",
          attributionControl: { customAttribution: attribution },
          interactive: false,
        });
        layer.addTo(map);
        const vector = layer.getMaplibreMap();
        vector.on("load", () => {
          if (!active) return;
          clearTimeout(timeout);
          container.dataset.basemap = "light";
        });
        // An unavailable style, tile service or graphics context must not hide
        // the saved markers. Keep the existing raster map as a real fallback.
        vector.on("error", showStandard);
        timeout = setTimeout(showStandard, 15000);
      } catch {
        showStandard();
      }
    }
    void start();
    return () => {
      active = false;
      clearTimeout(timeout);
      remove();
      delete container.dataset.basemap;
    };
  }, [map]);
  if (!fallback) return null;
  return (
    <TileLayer
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      className="map-raster-fallback"
      eventHandlers={{
        tileerror: () => onTileError(true),
        tileload: () => onTileError(false),
      }}
    />
  );
}
