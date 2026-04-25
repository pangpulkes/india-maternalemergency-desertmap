"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet"
import { ArrowLeft } from "lucide-react"
import type { Facility } from "@/lib/types"
import "leaflet/dist/leaflet.css"

// Default map center and zoom for India
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5
const SELECTED_ZOOM = 14

interface FacilityMapProps {
  facilities: Facility[]
  selectedFacility: Facility | null
  onSelectFacility: (facility: Facility) => void
  onResetMap?: () => void
  initialCenter?: { lat: number; lng: number; zoom: number } | null
}

function MapUpdater({ 
  selectedFacility, 
  shouldReset, 
  onResetComplete,
  initialCenter,
}: { 
  selectedFacility: Facility | null
  shouldReset: boolean
  onResetComplete: () => void
  initialCenter?: { lat: number; lng: number; zoom: number } | null
}) {
  const map = useMap()
  const prevSelectedRef = useRef<Facility | null>(null)
  const initialCenterApplied = useRef(false)

  useEffect(() => {
    // Apply initial center on first mount if provided
    if (initialCenter && !initialCenterApplied.current) {
      map.flyTo([initialCenter.lat, initialCenter.lng], initialCenter.zoom, {
        duration: 0.5,
      })
      initialCenterApplied.current = true
      return
    }

    if (shouldReset) {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
        duration: 0.5,
      })
      onResetComplete()
      return
    }

    if (selectedFacility && selectedFacility !== prevSelectedRef.current) {
      map.flyTo([selectedFacility.latitude, selectedFacility.longitude], SELECTED_ZOOM, {
        duration: 0.5,
      })
      prevSelectedRef.current = selectedFacility
    }
  }, [selectedFacility, shouldReset, map, onResetComplete, initialCenter])

  return null
}

export function FacilityMap({ facilities, selectedFacility, onSelectFacility, onResetMap, initialCenter }: FacilityMapProps) {
  const [shouldReset, setShouldReset] = useState(false)

  const getColor = (score: number) => {
    if (score > 0.7) return "#639922"
    if (score >= 0.4) return "#f97316"
    return "#ef4444"
  }

  const handleResetMap = () => {
    setShouldReset(true)
    onResetMap?.()
  }

  return (
    <div className="relative w-full h-full">
      {selectedFacility && (
        <button
          onClick={handleResetMap}
          className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to full map
        </button>
      )}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapUpdater 
          selectedFacility={selectedFacility} 
          shouldReset={shouldReset}
          onResetComplete={() => setShouldReset(false)}
          initialCenter={initialCenter}
        />
        {facilities.map((facility) => {
          const isSelected = selectedFacility?.name === facility.name && selectedFacility?.city === facility.city
          return (
            <CircleMarker
              key={`${facility.name}-${facility.latitude}-${facility.longitude}`}
              center={[facility.latitude, facility.longitude]}
              radius={isSelected ? 14 : 8}
              pathOptions={{
                fillColor: getColor(facility.trust_score),
                fillOpacity: 0.9,
                color: isSelected ? "#639922" : getColor(facility.trust_score),
                weight: isSelected ? 3 : 1,
              }}
              className={isSelected ? "selected-pin" : ""}
              eventHandlers={{
                click: () => onSelectFacility(facility),
              }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
