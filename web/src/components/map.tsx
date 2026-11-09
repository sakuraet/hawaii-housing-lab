"use client";

import "leaflet/dist/leaflet.css";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVEL_COLOR, overallLevel, type ParcelOutput } from "feasim-challenge";
import {
  circleMarker,
  latLngBounds,
  layerGroup,
  CircleMarker as LeafletCircleMarker,
  polygon,
  tooltip,
  type LatLngBounds,
  type LatLngTuple,
  type Polygon as LeafletPolygon,
  type PathOptions,
  type PointTuple,
} from "leaflet";
import { createPortal } from "react-dom";
import {
  CircleMarker,
  MapContainer,
  Pane,
  TileLayer,
  useMap,
  useMapEvent,
  ZoomControl,
} from "react-leaflet";

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

// same colours as the dots
function outlineStyle(color: string, selected: boolean): PathOptions {
  return {
    color: selected ? "#111827" : "#ffffff",
    fillColor: color,
    fillOpacity: selected ? 0.85 : 0.55,
    weight: selected ? 2 : 0.5,
    opacity: selected ? 1 : 0.8,
  };
}

// ── Dot ───────────────────────────────────────────────────────────────────
// ~10k of these, so each takes only primitives and memoizes what it hands to
// react-leaflet (which compares center / pathOptions / eventHandlers by
// reference). A slider move that leaves a dot's colour and size alone then
// costs that dot nothing — no re-render, no setStyle, no redraw.

interface DotProps {
  parcel: ParcelRow;
  color: string;
  radius: number;
  selected: boolean;
  onSelect: (tmk: string) => void;
  onHover: (tmk: string | null) => void;
}

const ParcelDot = memo(function ParcelDot({
  parcel,
  color,
  radius,
  selected,
  onSelect,
  onHover,
}: DotProps) {
  const center = useMemo<LatLngTuple>(
    () => [parcel.lat, parcel.lng],
    [parcel.lat, parcel.lng]
  );
  const pathOptions = useMemo(
    () => ({
      color: selected ? "#111827" : "#ffffff",
      fillColor: color,
      fillOpacity: selected ? 0.85 : 0.55,
      weight: selected ? 2 : 0.6,
      opacity: selected ? 1 : 0.8,
    }),
    [selected, color]
  );
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(parcel.tmk),
      mouseover: () => onHover(parcel.tmk),
      mouseout: () => onHover(null),
    }),
    [onSelect, onHover, parcel.tmk]
  );

  return (
    <CircleMarker
      center={center}
      radius={radius}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    />
  );
});

// ── Component ─────────────────────────────────────────────────────────────

export function ParcelMap({
  parcels,
  rows,
  focusRows,
  centerParcel = null,
  selectedParcelId,
  onSelectParcel,
}: Props) {
  // One hover tooltip for the whole map, on the parcel under the pointer,
  // instead of a Tooltip bound to every marker. A click only selects the
  // parcel; its details are in the parcel card beside the map.
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
    <MapContainer
      center={[21.295, -157.835]}
      zoom={13}
      scrollWheelZoom={true}
      zoomControl={false}
      // draw the ~10k dots on one <canvas> rather than as 10k SVG paths
      preferCanvas={true}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      {/* Esri light gray canvas (no API key) */}
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
        maxZoom={19}
      />

      {/* top left is the one corner the dashboard's cards leave free: the
          summary and parcel card take the right, the legend the bottom left,
          and on phones the summary bar starts clear of this corner */}
      <ZoomControl position="topleft" />

      <FlyToArea rows={focusRows} />
      <ZoomToParcel parcel={centerParcel} />
      <FitContainer />

      <Pane name={DOT_PANE}>
        {parcels.map(({ parcel, result, notApplicable }) => (
          <ParcelDot
            key={parcel.tmk}
            parcel={parcel}
            color={feasibilityColor(result, notApplicable)}
            radius={getRadius(result.max_units)}
            selected={parcel.tmk === selectedParcelId}
            onSelect={onSelectParcel}
            onHover={handleHover}
          />
        ))}
      </Pane>

      <ParcelOutlines
        parcels={parcels}
        rows={rows}
        selectedParcelId={selectedParcelId}
        onSelect={onSelectParcel}
        onHover={handleHover}
      />

      {hoveredItem && (
        <ParcelTooltip key={hoveredItem.parcel.tmk} item={hoveredItem} />
      )}
    </MapContainer>
  );
}

// ── Lot outlines ──────────────────────────────────────────────────────────
// Drawn with Leaflet directly: one layer group per pathway

function ParcelOutlines({
  parcels,
  rows,
  selectedParcelId,
  onSelect,
  onHover,
}: {
  parcels: ParcelMapItem[];
  rows: ParcelRow[];
  selectedParcelId: string | null;
  onSelect: (tmk: string) => void;
  onHover: (tmk: string | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvent("zoomend", () => setZoom(map.getZoom()));
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

  // One layer per parcel of the current pathway
  const layers = useMemo(() => {
    if (!outlines) return null;
    const out = new Map<string, LeafletPolygon | LeafletCircleMarker>();
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

  // Latest handlers for the layer events, which are bound once per layer
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  }, [onSelect, onHover]);

  useEffect(() => {
    if (!layers) return;
    if (!map.getPane(OUTLINE_PANE)) map.createPane(OUTLINE_PANE);
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

  // Style key last applied to each layer, so an unchanged lot is skipped
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

      layer.setStyle(outlineStyle(color, selected));
      if (layer instanceof LeafletCircleMarker) layer.setRadius(radius);
      // draw the selected lot's dark edge over its neighbours'
      if (selected) layer.bringToFront();
    }
  }, [layers, parcels, selectedParcelId]);

  // Show one pane, hide the other. The dot pane is created by <Pane> before
  // any zoom-in can happen, and the outline pane by the effect above before
  // `showOutlines` can turn true, so both exist whenever this matters
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
function FitContainer() {
  const map = useMap();
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
function ZoomToParcel({ parcel }: { parcel: ParcelRow | null }) {
  const map = useMap();
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
// loads. Fly and zoom if the pathway's main region differs from the currently
// selected pathway.
function FlyToArea({ rows }: { rows: ParcelRow[] }) {
  const map = useMap();
  const framed = useRef<LatLngBounds | null>(null);

  useEffect(() => {
    if (rows.length === 0) return;
    const bounds = latLngBounds(rows.map((p) => [p.lat, p.lng] as LatLngTuple));
    if (framed.current?.equals(bounds)) return;
    const padding = cardPadding();
    if (framed.current) map.flyToBounds(bounds, { ...padding, duration: 1 });
    else map.fitBounds(bounds, padding);
    framed.current = bounds;
  }, [map, rows]);

  return null;
}

// react-leaflet's <Tooltip> only opens bound to a layer, so open a Leaflet
// tooltip on the map directly and render the content into it
// the hover preview: parcel number and street address; the details are in
// the parcel card a click opens
function ParcelTooltip({ item: { parcel } }: { item: ParcelMapItem }) {
  const map = useMap();
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
