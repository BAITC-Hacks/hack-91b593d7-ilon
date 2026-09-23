"use client";

import { useEffect, useMemo } from "react";
import {
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, Path, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatScore } from "@/lib/labels";
import {
  fillForDelta,
  fillForHealth,
  type DistrictMapProps,
} from "@/lib/mapStyles";
import rawGeojson from "@/data/astana-districts.json";

const geojson = rawGeojson as FeatureCollection;

const ASTANA_CENTER: [number, number] = [51.15, 71.43];
const DEFAULT_ZOOM = 11;

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

function DistrictMapInner(props: DistrictMapProps) {
  const {
    mode,
    districtScores,
    criticalByDistrict,
    weakestIds = [],
    selectedIds = [],
    districtResults = [],
    districtNames,
    indicatorNames,
    activeId = null,
    onSelectDistrict,
    compact = false,
  } = props;

  const weakest = useMemo(() => new Set(weakestIds), [weakestIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const deltaById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of districtResults) {
      map.set(row.id, row.score_after - row.score_before);
    }
    return map;
  }, [districtResults]);

  const data = geojson;

  function styleFor(id: string): PathOptions {
    const isActive = activeId === id;
    const isSelected = selected.has(id);
    if (mode === "delta") {
      return {
        color: isActive ? "#0f3a31" : "#315f52",
        weight: isActive || isSelected ? 3 : 1.5,
        fillColor: fillForDelta(deltaById.get(id) ?? 0, isActive),
        fillOpacity: isActive ? 0.85 : 0.62,
      };
    }
    return {
      color: isActive ? "#0f3a31" : "#315f52",
      weight: isActive || isSelected ? 3 : 1.5,
      fillColor: fillForHealth({
        id,
        hasCritical: (criticalByDistrict[id] ?? []).length > 0,
        isWeakest: weakest.has(id),
        isActive,
        isSelected: mode === "selection" ? isSelected : false,
      }),
      fillOpacity: isActive ? 0.85 : 0.62,
    };
  }

  function onEachFeature(feature: Feature, layer: Layer) {
    const id = String(feature.properties?.id ?? "");
    const name = districtNames[id] || String(feature.properties?.name ?? id);
    const score = districtScores[id];
    const critical = criticalByDistrict[id] ?? [];
    const path = layer as Path;

    path.setStyle(styleFor(id));

    const criticalLines =
      critical.length === 0
        ? "<li>Критических показателей нет</li>"
        : critical
            .map(
              (item) =>
                `<li>${indicatorNames[item.indicator] ?? item.indicator}: ${item.value}</li>`,
            )
            .join("");

    const delta = deltaById.get(id);
    const deltaLine =
      mode === "delta" && delta !== undefined
        ? `<p>Изменение оценки: ${delta >= 0 ? "+" : ""}${formatScore(delta, 2)}</p>`
        : "";

    path.bindPopup(
      `<strong>${name}</strong>
       <p>Оценка района: ${score === undefined ? "—" : formatScore(score, 2)}</p>
       ${deltaLine}
       <ul>${criticalLines}</ul>`,
    );

    path.on({
      click: () => onSelectDistrict?.(id),
      mouseover: () => {
        path.setStyle({ weight: 3, fillOpacity: 0.9 });
        path.bringToFront();
      },
      mouseout: () => {
        path.setStyle(styleFor(id));
      },
    });
  }

  return (
    <div
      data-testid="district-map"
      className={`overflow-hidden rounded-3xl border border-[#dce3dc] bg-white ${
        compact ? "h-64" : "h-80 sm:h-[28rem]"
      }`}
    >
      <MapContainer
        center={ASTANA_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <InvalidateSize />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={`${mode}-${activeId ?? ""}-${selectedIds.join(",")}-${districtResults.length}`}
          data={data}
          onEachFeature={(feature, layer) => onEachFeature(feature, layer)}
        />
      </MapContainer>
    </div>
  );
}

export function DistrictMap(props: DistrictMapProps) {
  const legend =
    props.mode === "delta" ? (
      <p className="mt-3 text-xs text-[#6c7b73]">
        Зелёный — рост оценки района, терракотовый — снижение. Клик открывает данные района.
      </p>
    ) : props.mode === "selection" ? (
      <p className="mt-3 text-xs text-[#6c7b73]">
        Ярче выделены районы из выбранных мер. Городские меры не привязаны к полигону.
      </p>
    ) : (
      <p className="mt-3 text-xs text-[#6c7b73]">
        Терракотовый — слабейший район или есть показатели ниже порога. Клик показывает детали.
      </p>
    );

  return (
    <div>
      <DistrictMapInner {...props} />
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Районы на карте">
        {Object.entries(props.districtNames).map(([id, name]) => (
          <button
            key={id}
            type="button"
            data-testid={`map-select-${id}`}
            onClick={() => props.onSelectDistrict?.(id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              props.activeId === id
                ? "bg-[#174f43] text-white"
                : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {legend}
      {props.activeId ? (
        <p className="mt-2 text-sm font-semibold text-[#174f43]" data-testid="map-active-district">
          Выбран на карте: {props.districtNames[props.activeId] ?? props.activeId}
        </p>
      ) : null}
    </div>
  );
}

export default DistrictMap;
