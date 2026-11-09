"use client";

import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVEL_COLOR, overallLevel, type ParcelOutput } from "feasim-challenge";
import {
  circleMarker,
  control,
  latLngBounds,
  layerGroup,
  map as leafletMap,
  CircleMarker as LeafletCircleMarker,
  polygon,
  tileLayer,
  tooltip,
  type LatLngBounds,
  type LatLngTuple,
  type Map as LeafletMap,
  type Polygon as LeafletPolygon,
  type PathOptions,
  type PointTuple,
} from "leaflet";
import { createPortal } from "react-dom";

import type { ParcelRow } from "@/lib/parcels";

interface ParcelMapItem {
  parcel: ParcelRow;
  result: ParcelOutput;
  /** housing is not permitted here at the chosen tier */
  notApplicable?: boolean;
}

interface Props {
  parcels: ParcelMapItem[];
  /** The active program's parcel rows; a new array means a new pathway. */
  rows: ParcelRow[];
  /** Parcels to frame when a pathway loads: its main region's. */
  focusRows: ParcelRow[];
  /** a parcel to zoom to, after `focusRows` (back from its full page) */
  centerParcel?: ParcelRow | null;
  /** [south-west, north-east] corners to frame when `focusRows` is empty */
  area?: [[number, number], [number, number]];
  selectedParcelId: string | null;
  onSelectParcel: (parcelId: string) => void;
}

// Dot colour comes from the shared classifier, so a dot can never disagree
// with the parcel card or the scenario chips.

export const NOT_APPLICABLE_COLOR = "#f97316";

function feasibilityColor(
  result: ParcelOutput,
  notApplicable?: boolean
): string {
  if (notApplicable) return NOT_APPLICABLE_COLOR;
  if (result.max_units <= 0) return "#94a3b8";
  return LEVEL_COLOR[overallLevel(result)];
}

function getRadius(units: number): number {
  if (units <= 0) return 3;
  return Math.min(12, 3 + Math.sqrt(units) * 0.6);
}

// ── Dots vs. lot outlines ─────────────────────────────────────────────────
// Below OUTLINE_ZOOM every parcel is a dot; from it up, the parcel's actual
// lot outline.
//
// Each set lives in its own pane, which Leaflet gives its own <canvas>.
// Crossing the threshold only hides one pane and shows the other: no layers
// are added or removed, so zooming in and out stays instant.
const OUTLINE_ZOOM = 15;
const DOT_PANE = "parcel-dots";

// phones (below the dashboard's sm breakpoint), where the map fills the
// screen and the cards sit over its top and bottom edges
const isNarrow = () => window.innerWidth < 640;
const OUTLINE_PANE = "parcel-outlines";

// Leaflet multi-polygon
type Outline = LatLngTuple[][][];

let outlinesPromise: Promise<Map<string, Outline>> | null = null;
function loadOutlines(): Promise<Map<string, Outline>> {
  // served from public/data/, which git ignores (see public/data/README.md)
  outlinesPromise ??= fetch("/data/parcel-shapes.json")
    .then((res) => {
      if (!res.ok) throw new Error(`parcel-shapes.json: HTTP ${res.status}`);
      return res.json() as Promise<[string, Outline][]>;
    })
    .then((rows) => new Map(rows))
    .catch((err) => {
      // let the next zoom-in retry rather than caching the failure
      outlinesPromise = null;
      throw err;
    });
  return outlinesPromise;
}

// same colours for dots and lots; dots get a slightly heavier edge
function parcelStyle(color: string, selected: boolean, weight: number): PathOptions {
  return {
    color: selected ? "#111827" : "#ffffff",
    fillColor: color,
    fillOpacity: selected ? 0.85 : 0.55,
    weight: selected ? 2 : weight,
    opacity: selected ? 1 : 0.8,
  };
}

type ParcelLayer = LeafletPolygon | LeafletCircleMarker;

// ── Component ─────────────────────────────────────────────────────────────
// Plain Leaflet: the map is made once for its container, and the pieces
// below add their layers to it and remove them when they unmount.

export function ParcelMap({
  parcels,
  rows,
  focusRows,
  centerParcel = null,
  area,
  selectedParcelId,
  onSelectParcel,
}: Props) {
  const [map, setMap] = useState<LeafletMap | null>(null);

  // the Leaflet map, made when its container mounts and removed with it
  const attach = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const m = leafletMap(el, {
      center: [21.295, -157.835],
      zoom: 13,
      scrollWheelZoom: true,
      zoomControl: false,
      // draw the ~10k dots on one <canvas> rather than as 10k SVG paths
      preferCanvas: true,
    });
    // Esri light gray canvas (no API key)
    tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
        maxNativeZoom: 16,
        maxZoom: 19,
      }
    ).addTo(m);
    // top left is the one corner the dashboard's cards leave free: the
    // summary and parcel card take the right, the legend the bottom left,
    // and on phones the summary bar starts clear of this corner
    control.zoom({ position: "topleft" }).addTo(m);
    m.createPane(DOT_PANE);
    m.createPane(OUTLINE_PANE);
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
  }, []);

  // One hover tooltip for the whole map, on the parcel under the pointer,
  // instead of one bound to every marker. A click only selects the parcel;
  // its details are in the parcel card beside the map.
  const [hovered, setHovered] = useState<string | null>(null);

  // phones have no hover, and a tap would leave the tooltip stuck open
  const handleHover = useCallback((tmk: string | null) => {
    if (isNarrow()) return;
    setHovered(tmk);
  }, []);

  const hoveredItem = useMemo(
    () =>
      hovered == null
        ? null
        : (parcels.find((item) => item.parcel.tmk === hovered) ?? null),
    [parcels, hovered]
  );

  return (
    <>
      <div ref={attach} className="z-0 h-full w-full" />
      {map && (
        <>
          <FlyToArea map={map} rows={focusRows} area={area} />
          <ZoomToParcel map={map} parcel={centerParcel} />
          <FitContainer map={map} />
          <ParcelDots
            map={map}
            parcels={parcels}
            rows={rows}
            selectedParcelId={selectedParcelId}
            onSelect={onSelectParcel}
            onHover={handleHover}
          />
          <ParcelOutlines
            map={map}
            parcels={parcels}
            rows={rows}
            selectedParcelId={selectedParcelId}
            onSelect={onSelectParcel}
            onHover={handleHover}
          />
          {hoveredItem && (
            <ParcelTooltip
              key={hoveredItem.parcel.tmk}
              map={map}
              item={hoveredItem}
            />
          )}
        </>
      )}
    </>
  );
}

// ── Parcel layers ─────────────────────────────────────────────────────────
// Dots and lot outlines are both one Leaflet layer per parcel of the current
// pathway, grouped and added to the map together

interface LayerProps {
  map: LeafletMap;
  parcels: ParcelMapItem[];
  rows: ParcelRow[];
  selectedParcelId: string | null;
  onSelect: (tmk: string) => void;
  onHover: (tmk: string | null) => void;
}

// adds the layers to the map with click and hover handlers, and takes them
// off again when the layers change or the map goes
function useParcelLayers(
  map: LeafletMap,
  layers: Map<string, ParcelLayer> | null,
  onSelect: (tmk: string) => void,
  onHover: (tmk: string | null) => void
) {
  // Latest handlers for the layer events, which are bound once per layer
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  }, [onSelect, onHover]);

  useEffect(() => {
    if (!layers) return;
    for (const [tmk, layer] of layers) {
      layer.on("click", () => onSelectRef.current(tmk));
      layer.on("mouseover", () => onHoverRef.current(tmk));
      layer.on("mouseout", () => onHoverRef.current(null));
    }
    const group = layerGroup([...layers.values()]).addTo(map);
    return () => {
      group.remove();
      for (const layer of layers.values())
        layer.off("click mouseover mouseout");
    };
  }, [map, layers]);
}

// colours and sizes each layer from its parcel's result
function useParcelStyles(
  layers: Map<string, ParcelLayer> | null,
  parcels: ParcelMapItem[],
  selectedParcelId: string | null,
  weight: number
) {
  // Style key last applied to each layer, so an unchanged parcel is skipped
  const applied = useRef(new WeakMap<object, string>());
  useEffect(() => {
    if (!layers) return;
    for (const { parcel, result, notApplicable } of parcels) {
      const layer = layers.get(parcel.tmk);
      if (!layer) continue;
      const color = feasibilityColor(result, notApplicable);
      const selected = parcel.tmk === selectedParcelId;
      const radius = getRadius(result.max_units);
      const key = `${color}|${selected}|${radius}`;
      if (applied.current.get(layer) === key) continue;
      applied.current.set(layer, key);

      layer.setStyle(parcelStyle(color, selected, weight));
      if (layer instanceof LeafletCircleMarker) layer.setRadius(radius);
      // draw the selected parcel's dark edge over its neighbours'
      if (selected) layer.bringToFront();
    }
  }, [layers, parcels, selectedParcelId, weight]);
}

function ParcelDots({
  map,
  parcels,
  rows,
  selectedParcelId,
  onSelect,
  onHover,
}: LayerProps) {
  const layers = useMemo(() => {
    const out = new Map<string, ParcelLayer>();
    for (const row of rows)
      out.set(row.tmk, circleMarker([row.lat, row.lng], { pane: DOT_PANE }));
    return out;
  }, [rows]);
  useParcelLayers(map, layers, onSelect, onHover);
  useParcelStyles(layers, parcels, selectedParcelId, 0.6);
  return null;
}

function ParcelOutlines({
  map,
  parcels,
  rows,
  selectedParcelId,
  onSelect,
  onHover,
}: LayerProps) {
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);
  const wantOutlines = zoom >= OUTLINE_ZOOM;

  const [outlines, setOutlines] = useState<Map<string, Outline> | null>(null);
  useEffect(() => {
    if (!wantOutlines || outlines) return;
    let live = true;
    loadOutlines()
      .then((loaded) => {
        if (live) setOutlines(loaded);
      })
      // dots stay up meanwhile; the next zoom-in retries
      .catch((err) => console.error("Failed to load parcel outlines", err));
    return () => {
      live = false;
    };
  }, [wantOutlines, outlines]);

  // Outlines only replace the dots once they have arrived
  const showOutlines = wantOutlines && outlines != null;

  // a lot without an outline is drawn as a dot in the outline pane
  const layers = useMemo(() => {
    if (!outlines) return null;
    const out = new Map<string, ParcelLayer>();
    for (const row of rows) {
      const outline = outlines.get(row.tmk);
      out.set(
        row.tmk,
        outline
          ? polygon(outline, { pane: OUTLINE_PANE })
          : circleMarker([row.lat, row.lng], { pane: OUTLINE_PANE })
      );
    }
    return out;
  }, [outlines, rows]);
  useParcelLayers(map, layers, onSelect, onHover);
  useParcelStyles(layers, parcels, selectedParcelId, 0.5);

  // Show one pane, hide the other; both are made with the map
  useEffect(() => {
    const dots = map.getPane(DOT_PANE);
    const lots = map.getPane(OUTLINE_PANE);
    if (dots) dots.style.display = showOutlines ? "none" : "";
    if (lots) lots.style.display = showOutlines ? "" : "none";
  }, [map, showOutlines, layers]);

  return null;
}

// Leaflet only re-measures on a window resize; the dashboard's side panels
// open and close without one, so watch the container itself
function FitContainer({ map }: { map: LeafletMap }) {
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// keep the parcels clear of the cards over the map
function cardPadding() {
  return isNarrow()
    ? {
        paddingTopLeft: [24, 130] as PointTuple,
        paddingBottomRight: [24, 110] as PointTuple,
      }
    : {
        paddingTopLeft: [40, 40] as PointTuple,
        paddingBottomRight: [380, 40] as PointTuple,
      };
}

// zoom to one parcel, rendered after FlyToArea
function ZoomToParcel({
  map,
  parcel,
}: {
  map: LeafletMap;
  parcel: ParcelRow | null;
}) {
  useEffect(() => {
    if (!parcel) return;
    const point: LatLngTuple = [parcel.lat, parcel.lng];
    map.fitBounds(latLngBounds([point, point]), {
      ...cardPadding(),
      maxZoom: OUTLINE_ZOOM + 1,
    });
  }, [map, parcel]);
  return null;
}

// Frame the region holding most of the pathway's parcels whenever a pathway
// loads, or the county's islands when it has no parcels. Fly there if the
// map was already framed somewhere else.
function FlyToArea({
  map,
  rows,
  area,
}: {
  map: LeafletMap;
  rows: ParcelRow[];
  area?: [[number, number], [number, number]];
}) {
  const framed = useRef<LatLngBounds | null>(null);

  useEffect(() => {
    if (rows.length === 0 && !area) return;
    const bounds =
      rows.length > 0
        ? latLngBounds(rows.map((p) => [p.lat, p.lng] as LatLngTuple))
        : latLngBounds(area!);
    if (framed.current?.equals(bounds)) return;
    const padding = cardPadding();
    if (framed.current) map.flyToBounds(bounds, { ...padding, duration: 1 });
    else map.fitBounds(bounds, padding);
    framed.current = bounds;
  }, [map, rows, area]);

  return null;
}

// the hover preview: parcel number and street address; the details are in
// the parcel card a click opens. Opened on the map directly, with its
// content rendered into it
function ParcelTooltip({
  map,
  item: { parcel },
}: {
  map: LeafletMap;
  item: ParcelMapItem;
}) {
  const [content] = useState(() => document.createElement("div"));
  useEffect(() => {
    const tip = tooltip({
      direction: "top",
      offset: [0, -8],
      // the old click popup's box: padding, rounded corners and soft shadow
      className:
        "!rounded-xl !border-0 !py-[13px] !pl-5 !pr-6 !shadow-[0_3px_14px_rgba(0,0,0,0.4)]",
    })
      .setLatLng([parcel.lat, parcel.lng])
      .setContent(content);
    map.openTooltip(tip);
    return () => {
      map.closeTooltip(tip);
    };
  }, [map, content, parcel.lat, parcel.lng]);

  return createPortal(
    <div className="text-sm">
      <div className="font-semibold">{parcel.tmk}</div>
      {parcel.address && <div>{parcel.address}</div>}
    </div>,
    content
  );
}
