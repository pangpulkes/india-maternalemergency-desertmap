"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet"
import type { Facility } from "@/lib/types"
import "leaflet/dist/leaflet.css"

interface FacilityMapProps {
  facilities: Facility[]
  selectedFacility: Facility | null
  onSelectFacility: (facility: Facility) => void
}

function MapUpdater({ selectedFacility }: { selectedFacility: Facility | null }) {
  const map = useMap()
  const prevSelectedRef = useRef<Facility | null>(null)

  useEffect(() => {
    if (selectedFacility && selectedFacility !== prevSelectedRef.current) {
      map.flyTo([selectedFacility.latitude, selectedFacility.longitude], 10, {
        duration: 0.5,
      })
      prevSelectedRef.current = selectedFacility
    }
  }, [selectedFacility, map])

  return null
}

export function FacilityMap({ facilities, selectedFacility, onSelectFacility }: FacilityMapProps) {
  const getColor = (score: number) => {
    if (score > 0.7) return "#639922"
    if (score >= 0.4) return "#f97316"
    return "#ef4444"
  }

  // Center of India
  const center: [number, number] = [22.5, 82.5]

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="w-full h-full"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapUpdater selectedFacility={selectedFacility} />
      {facilities.map((facility) => {
        const isSelected = selectedFacility?.name === facility.name
        return (
          <CircleMarker
            key={`${facility.name}-${facility.latitude}-${facility.longitude}`}
            center={[facility.latitude, facility.longitude]}
            radius={isSelected ? 12 : 8}
            pathOptions={{
              fillColor: getColor(facility.trust_score),
              fillOpacity: 0.9,
              color: isSelected ? "#ffffff" : getColor(facility.trust_score),
              weight: isSelected ? 3 : 1,
            }}
            eventHandlers={{
              click: () => onSelectFacility(facility),
            }}
          />
        )
      })}
    </MapContainer>
  )
}
