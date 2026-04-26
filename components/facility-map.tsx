"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap, useMapEvents } from "react-leaflet"
import { ArrowLeft, Layers } from "lucide-react"
import type { Facility, StateData } from "@/lib/types"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Default map center and zoom for India
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5
const FACILITY_ZOOM_THRESHOLD = 7
const STATE_ZOOM = 7
const FACILITY_ZOOM = 10

const INDIA_GEOJSON_URL = "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson"

interface FacilityMapProps {
  facilities: Facility[]
  selectedFacility: Facility | null
  onSelectFacility: (facility: Facility) => void
  onSelectState?: (state: StateData) => void
  onResetMap?: () => void
  initialCenter?: { lat: number; lng: number; zoom: number } | null
  stateData?: StateData[]
}

// State name mapping for matching GeoJSON names to our data
const STATE_NAME_MAP: Record<string, string> = {
  "Andhra Pradesh": "Andhra Pradesh",
  "Arunachal Pradesh": "Arunachal Pradesh",
  "Assam": "Assam",
  "Bihar": "Bihar",
  "Chhattisgarh": "Chhattisgarh",
  "Goa": "Goa",
  "Gujarat": "Gujarat",
  "Haryana": "Haryana",
  "Himachal Pradesh": "Himachal Pradesh",
  "Jharkhand": "Jharkhand",
  "Karnataka": "Karnataka",
  "Kerala": "Kerala",
  "Madhya Pradesh": "Madhya Pradesh",
  "Maharashtra": "Maharashtra",
  "Manipur": "Manipur",
  "Meghalaya": "Meghalaya",
  "Mizoram": "Mizoram",
  "Nagaland": "Nagaland",
  "Odisha": "Odisha",
  "Orissa": "Odisha",
  "Punjab": "Punjab",
  "Rajasthan": "Rajasthan",
  "Sikkim": "Sikkim",
  "Tamil Nadu": "Tamil Nadu",
  "Telangana": "Telangana",
  "Tripura": "Tripura",
  "Uttar Pradesh": "Uttar Pradesh",
  "Uttarakhand": "Uttarakhand",
  "Uttaranchal": "Uttarakhand",
  "West Bengal": "West Bengal",
  "Andaman and Nicobar Islands": "Andaman and Nicobar Islands",
  "Chandigarh": "Chandigarh",
  "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
  "Daman and Diu": "Daman and Diu",
  "Delhi": "Delhi",
  "NCT of Delhi": "Delhi",
  "Jammu and Kashmir": "Jammu and Kashmir",
  "Jammu & Kashmir": "Jammu and Kashmir",
  "Ladakh": "Ladakh",
  "Lakshadweep": "Lakshadweep",
  "Puducherry": "Puducherry",
  "Pondicherry": "Puducherry",
}

// Get heatmap color based on gap rate
function getHeatmapColor(gapRate: number): string {
  if (gapRate > 0.85) return "#dc2626" // dark red
  if (gapRate > 0.75) return "#f97316" // orange
  if (gapRate > 0.5) return "#eab308" // yellow
  return "#22c55e" // green
}

// Get facility dot color based on trust score
function getFacilityColor(score: number): string {
  if (score > 0.7) return "#639922" // green - verified
  if (score >= 0.4) return "#f97316" // orange - uncertain
  return "#ef4444" // red - gap
}

// Zoom level tracker component
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom())
    },
  })

  useEffect(() => {
    onZoomChange(map.getZoom())
  }, [map, onZoomChange])

  return null
}

// Map controller component
function MapController({
  shouldReset,
  onResetComplete,
  flyToState,
  onFlyComplete,
  selectedFacility,
}: {
  shouldReset: boolean
  onResetComplete: () => void
  flyToState: { lat: number; lng: number; zoom: number } | null
  onFlyComplete: () => void
  selectedFacility: Facility | null
}) {
  const map = useMap()
  const prevSelectedRef = useRef<Facility | null>(null)

  useEffect(() => {
    if (shouldReset) {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.5 })
      onResetComplete()
      return
    }

    if (flyToState) {
      map.flyTo([flyToState.lat, flyToState.lng], flyToState.zoom, { duration: 0.5 })
      onFlyComplete()
      return
    }

    if (selectedFacility && selectedFacility !== prevSelectedRef.current) {
      map.flyTo([selectedFacility.latitude, selectedFacility.longitude], FACILITY_ZOOM, { duration: 0.5 })
      prevSelectedRef.current = selectedFacility
    }
  }, [shouldReset, flyToState, selectedFacility, map, onResetComplete, onFlyComplete])

  return null
}

export function FacilityMap({
  facilities,
  selectedFacility,
  onSelectFacility,
  onSelectState,
  onResetMap,
  initialCenter,
  stateData = []
}: FacilityMapProps) {
  const [shouldReset, setShouldReset] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null)
  const [geoJsonKey, setGeoJsonKey] = useState(0)
  const [selectedStateName, setSelectedStateName] = useState<string | null>(null)
  const [flyToState, setFlyToState] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const geoJsonRef = useRef<L.GeoJSON | null>(null)

  // Determine view mode based on zoom level
  const showFacilities = currentZoom >= FACILITY_ZOOM_THRESHOLD
  const showHeatmap = currentZoom < FACILITY_ZOOM_THRESHOLD

  // Fetch GeoJSON data
  useEffect(() => {
    fetch(INDIA_GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => {
        setGeoJsonData(data)
      })
      .catch((err) => {
        console.error("Failed to fetch India GeoJSON:", err)
      })
  }, [])

  // Update GeoJSON key when stateData or selectedStateName changes
  useEffect(() => {
    setGeoJsonKey((prev) => prev + 1)
  }, [stateData, selectedStateName])

  // Apply initial center
  useEffect(() => {
    if (initialCenter) {
      setFlyToState(initialCenter)
    }
  }, [initialCenter])

  const handleResetMap = () => {
    setShouldReset(true)
    setSelectedStateName(null)
    onResetMap?.()
  }

  const handleZoomChange = useCallback((zoom: number) => {
    setCurrentZoom(zoom)
  }, [])

  // Create a lookup map for state data
  const stateDataMap = new Map<string, StateData>()
  stateData.forEach((s) => {
    stateDataMap.set(s.state.toLowerCase(), s)
  })

  // Style function for GeoJSON
  const getStateStyle = (feature: Feature<Geometry> | undefined) => {
    if (!feature || !feature.properties) {
      return {
        fillColor: "#cccccc",
        weight: 1,
        opacity: 0.8,
        color: "#666666",
        fillOpacity: 0.3,
      }
    }

    const stateName = feature.properties.NAME_1 || feature.properties.name || feature.properties.ST_NM || ""
    const normalizedName = STATE_NAME_MAP[stateName] || stateName
    const state = stateDataMap.get(normalizedName.toLowerCase())
    const isSelected = selectedStateName === normalizedName

    if (!state) {
      return {
        fillColor: "#cccccc",
        weight: 1,
        opacity: 0.5,
        color: "#999999",
        fillOpacity: 0.2,
      }
    }

    const color = getHeatmapColor(state.gap_rate)
    return {
      fillColor: color,
      weight: isSelected ? 4 : 2,
      opacity: 1,
      color: isSelected ? "#1a2e1a" : color,
      fillOpacity: isSelected ? 0.8 : 0.6,
    }
  }

  // Event handlers for GeoJSON features
  const onEachFeature = (feature: Feature<Geometry>, layer: L.Layer) => {
    if (!feature.properties) return

    const stateName = feature.properties.NAME_1 || feature.properties.name || feature.properties.ST_NM || ""
    const normalizedName = STATE_NAME_MAP[stateName] || stateName
    const state = stateDataMap.get(normalizedName.toLowerCase())

    // Set cursor to pointer
    const pathLayer = layer as L.Path
    pathLayer.getElement?.()?.style?.setProperty("cursor", "pointer")

    if (state) {
      // Rich tooltip with all key metrics
      layer.bindTooltip(
        `<div class="px-2 py-1.5">
          <p class="font-semibold text-sm mb-1">${state.state}</p>
          <div class="space-y-0.5 text-xs">
            <p><span class="text-gray-500">Gap Rate:</span> <span class="font-medium text-red-600">${Math.round(state.gap_rate * 100)}%</span></p>
            <p><span class="text-gray-500">Facilities:</span> <span class="font-medium">${state.total_facilities}</span></p>
            <p><span class="text-gray-500">Verified:</span> <span class="font-medium text-green-600">${state.verified}</span></p>
            <p><span class="text-gray-500">Avg. Distance:</span> <span class="font-medium">${state.avg_nearest_verified_km} km</span></p>
          </div>
        </div>`,
        {
          direction: "top",
          offset: [0, -10],
          opacity: 1,
          className: "state-tooltip"
        }
      )
    }

    // Hover and click handlers
    layer.on({
      mouseover: (e) => {
        const target = e.target
        target.setStyle({
          weight: 4,
          fillOpacity: 0.8,
        })
        target.bringToFront()
      },
      mouseout: (e) => {
        const target = e.target
        const isSelected = selectedStateName === normalizedName
        if (state) {
          const color = getHeatmapColor(state.gap_rate)
          target.setStyle({
            weight: isSelected ? 4 : 2,
            fillOpacity: isSelected ? 0.8 : 0.6,
            color: isSelected ? "#1a2e1a" : color,
          })
        }
      },
      click: () => {
        if (state) {
          setSelectedStateName(normalizedName)
          setFlyToState({ lat: state.latitude, lng: state.longitude, zoom: STATE_ZOOM })
          onSelectState?.(state)
        }
      },
    })
  }

  // Filter visible facilities when zoomed in
  const visibleFacilities = selectedStateName
    ? facilities.filter(f => f.state === selectedStateName)
    : facilities

  return (
    <div className="relative w-full h-full">
      {/* Reset button - always visible */}
      <button
        onClick={handleResetMap}
        className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to India
      </button>

      {/* Top right controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end">
        {/* View mode indicator */}
        <div className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">
            {showHeatmap ? "State Heatmap" : "Facility View"}
          </span>
        </div>

        {/* Legend */}
        {showHeatmap ? (
          <div className="bg-white rounded-lg shadow-lg p-2">
            <p className="text-[10px] font-medium text-gray-500 mb-1.5">Gap Rate</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#dc2626]" />
                <span className="text-[10px] text-gray-600">{">"}90%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#f97316]" />
                <span className="text-[10px] text-gray-600">70-90%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#eab308]" />
                <span className="text-[10px] text-gray-600">50-70%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#22c55e]" />
                <span className="text-[10px] text-gray-600">{"<"}50%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-2">
            <p className="text-[10px] font-medium text-gray-500 mb-1.5">Trust Score</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#639922]" />
                <span className="text-[10px] text-gray-600">Verified ({">"}70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f97316]" />
                <span className="text-[10px] text-gray-600">Uncertain (40-70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <span className="text-[10px] text-gray-600">Gap ({"<"}40%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        <div className="bg-white/90 rounded-lg shadow px-2 py-1">
          <p className="text-[10px] text-gray-500">
            {showHeatmap ? "Zoom in to see facilities" : "Zoom out to see heatmap"}
          </p>
        </div>
      </div>

      {/* Selected state indicator */}
      {selectedStateName && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-[#1a2e1a] text-white rounded-lg shadow-lg px-4 py-2">
          <p className="text-xs text-white/70">Viewing</p>
          <p className="font-semibold">{selectedStateName}</p>
        </div>
      )}

      <MapContainer
        key="facility-map"
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <ZoomTracker onZoomChange={handleZoomChange} />

        <MapController
          shouldReset={shouldReset}
          onResetComplete={() => setShouldReset(false)}
          flyToState={flyToState}
          onFlyComplete={() => setFlyToState(null)}
          selectedFacility={selectedFacility}
        />

        {/* Heatmap view - GeoJSON state polygons (show when zoomed out) */}
        {showHeatmap && geoJsonData && (
          <GeoJSON
            key={geoJsonKey}
            ref={geoJsonRef}
            data={geoJsonData}
            style={getStateStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Facilities view - individual dots (show when zoomed in) */}
        {showFacilities && visibleFacilities.map((facility) => {
          const isSelected = selectedFacility?.name === facility.name && selectedFacility?.city === facility.city
          return (
            <CircleMarker
              key={`${facility.name}-${facility.latitude}-${facility.longitude}`}
              center={[facility.latitude, facility.longitude]}
              radius={isSelected ? 12 : 7}
              pathOptions={{
                fillColor: getFacilityColor(facility.trust_score),
                fillOpacity: 0.9,
                color: isSelected ? "#1a2e1a" : getFacilityColor(facility.trust_score),
                weight: isSelected ? 3 : 1,
              }}
              eventHandlers={{
                click: () => onSelectFacility(facility),
              }}
            >
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
