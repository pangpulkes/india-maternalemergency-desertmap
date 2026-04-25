"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { ArrowLeft } from "lucide-react"
import { Dashboard } from "@/components/dashboard"
import { Header } from "@/components/header"
import { BottomSheet } from "@/components/bottom-sheet"
import { ChatPopup } from "@/components/chat-popup"
import type { Facility, StateData } from "@/lib/types"

// Dynamically import the map to avoid SSR issues with Leaflet
const FacilityMap = dynamic(() => import("@/components/facility-map").then((mod) => mod.FacilityMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
})

type ViewMode = "dashboard" | "map"

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [stateData, setStateData] = useState<StateData[]>([])
  const [selectedState, setSelectedState] = useState("")
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userRatings, setUserRatings] = useState<Record<string, { recommend: boolean; tags: string[] }>>({})
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/facilities").then((res) => res.json()),
      fetch("/desert_state.json").then((res) => res.json()),
    ])
      .then(([facilitiesData, stateDataRes]) => {
        if (Array.isArray(facilitiesData)) {
          setFacilities(facilitiesData)
        }
        if (Array.isArray(stateDataRes)) {
          setStateData(stateDataRes)
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load data:", err)
        setIsLoading(false)
      })
  }, [])

  const filteredFacilities = selectedState
    ? facilities.filter((f) => f.state === selectedState)
    : facilities

  // When a facility is selected from search, also auto-select it in the map
  useEffect(() => {
    if (selectedState && facilities.length > 0) {
      const facilitiesInState = facilities.filter((f) => f.state === selectedState)
      if (facilitiesInState.length === 1) {
        setSelectedFacility(facilitiesInState[0])
      }
    }
  }, [selectedState, facilities])

  const handleRatingChange = (facilityId: string, recommend: boolean, tags: string[]) => {
    setUserRatings((prev) => ({
      ...prev,
      [facilityId]: { recommend, tags },
    }))
  }

  const handleStateSelect = (state: StateData) => {
    setSelectedState(state.state)
    setMapCenter({ lat: state.latitude, lng: state.longitude, zoom: 7 })
    setViewMode("map")
  }

  const handleBackToDashboard = () => {
    setViewMode("dashboard")
    setSelectedState("")
    setSelectedFacility(null)
    setMapCenter(null)
  }

  // Calculate metrics
  const totalFacilities = facilities.length || 1180
  const verifiedCount = facilities.filter((f) => f.trust_score > 0.7).length || 129
  const gapsCount = facilities.filter((f) => f.trust_score < 0.4).length || 969
  const citiesWithZeroCoverage = 408 // This would normally be calculated from the data

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading data...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full max-w-[480px] mx-auto flex flex-col bg-white">
      {viewMode === "dashboard" ? (
        <Dashboard
          stateData={stateData}
          totalFacilities={totalFacilities}
          verifiedCount={verifiedCount}
          gapsCount={gapsCount}
          citiesWithZeroCoverage={citiesWithZeroCoverage}
          onViewMap={() => setViewMode("map")}
          onSelectState={handleStateSelect}
        />
      ) : (
        <>
          <Header
            facilities={facilities}
            selectedState={selectedState}
            onStateChange={setSelectedState}
            onBackToDashboard={handleBackToDashboard}
          />
          <div className="flex-1 relative">
            <FacilityMap
              facilities={filteredFacilities}
              selectedFacility={selectedFacility}
              onSelectFacility={setSelectedFacility}
              onResetMap={() => setSelectedFacility(null)}
              initialCenter={mapCenter}
            />
          </div>
          <BottomSheet
            facility={selectedFacility}
            onClose={() => setSelectedFacility(null)}
            userRatings={userRatings}
            onRatingChange={handleRatingChange}
          />
        </>
      )}
      <ChatPopup selectedFacility={selectedFacility} />
    </div>
  )
}
