"use client";

import { useEffect, useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { Layer, Path, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatScore } from "@/lib/labels";
import { fillForDelta, fillForHealth, type DistrictMapProps } from "@/lib/mapStyles";
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
        score: districtScores[id] ?? 0,
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
          data={geojson}
          onEachFeature={(feature, layer) => onEachFeature(feature, layer)}
        />
      </MapContainer>
    </div>
  );
}

export function DistrictMap(props: DistrictMapProps) {
  const showLabels = props.showLabels ?? true;
  const layout = props.layout ?? "stack";
  const split = layout === "split";

  const chips = (
    <div
      className={split ? "flex flex-col gap-2" : "mt-3 flex flex-wrap gap-2"}
      aria-label="Районы на карте"
    >
      {Object.entries(props.districtNames).map(([id, name]) => {
        const score = props.districtScores[id];
        const criticalCount = (props.criticalByDistrict[id] ?? []).length;
        const delta =
          props.mode === "delta"
            ? props.districtResults?.find((row) => row.id === id)
            : undefined;
        const deltaValue = delta ? delta.score_after - delta.score_before : undefined;
        return (
          <button
            key={id}
            type="button"
            data-testid={`map-select-${id}`}
            onClick={() => props.onSelectDistrict?.(id)}
            className={`rounded-2xl px-3 py-2 text-left text-xs font-semibold ${
              split ? "w-full" : ""
            } ${
              props.activeId === id
                ? "bg-[#174f43] text-white"
                : "bg-white text-[#5c6e64] ring-1 ring-[#d5dcd5]"
            }`}
          >
            <span className="block">{name}</span>
            {showLabels && score !== undefined ? (
              <span className="mt-0.5 block font-medium opacity-90">
                {props.mode === "delta" && deltaValue !== undefined
                  ? `${deltaValue >= 0 ? "+" : ""}${formatScore(deltaValue, 2)}`
                  : formatScore(score, 2)}
                {props.mode !== "delta" && criticalCount > 0
                  ? ` · ${criticalCount} крит.`
                  : ""}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const legend = (
    <div className={`${split ? "mt-3" : "mt-3"} space-y-1 text-xs text-[#6c7b73]`}>
      {props.mode === "delta" ? (
        <>
          <p>Цвет полигона — изменение оценки района: рост / без существенных изменений / снижение.</p>
          <p>Метка на кнопке показывает дельту Score района, не абсолютный уровень.</p>
        </>
      ) : (
        <>
          <p>Цвет полигона — уровень районного Score (высокий / средний / слабый).</p>
          <p>Отдельно: подпись «N крит.» означает показатели строго ниже 40 внутри района.</p>
        </>
      )}
      {props.activeId ? (
        <p className="mt-2 text-sm font-semibold text-[#174f43]" data-testid="map-active-district">
          Выбран на карте: {props.districtNames[props.activeId] ?? props.activeId}
        </p>
      ) : null}
    </div>
  );

  if (split) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(11rem,0.35fr)_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-[#dce3dc] bg-[#f7faf7] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6c7b73]">
            Выбор района
          </p>
          {chips}
          {legend}
        </aside>
        <DistrictMapInner {...props} compact={false} />
      </div>
    );
  }

  return (
    <div>
      <DistrictMapInner {...props} />
      {chips}
      {legend}
    </div>
  );
}

export default DistrictMap;
