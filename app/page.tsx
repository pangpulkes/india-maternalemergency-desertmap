"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { FullScreenChat } from "@/components/full-screen-chat"
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

type ViewMode = "chat" | "map"

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [stateData, setStateData] = useState<StateData[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
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

  // Filter based on selected states from chat
  const filteredStateData = selectedStates.length > 0
    ? stateData.filter((s) => selectedStates.includes(s.state))
    : stateData

  const relevantFacilities = selectedStates.length > 0
    ? facilities.filter((f) => selectedStates.includes(f.state))
    : facilities

  const filteredFacilities = selectedState
    ? relevantFacilities.filter((f) => f.state === selectedState)
    : relevantFacilities

  useEffect(() => {
    if (selectedState && relevantFacilities.length > 0) {
      const facilitiesInState = relevantFacilities.filter((f) => f.state === selectedState)
      if (facilitiesInState.length === 1) {
        setSelectedFacility(facilitiesInState[0])
      }
    }
  }, [selectedState, relevantFacilities])

  const handleShowMap = (states: string[]) => {
    setSelectedStates(states)
    // Calculate center based on selected states
    const relevantStates = stateData.filter(s => states.includes(s.state))
    if (relevantStates.length > 0) {
      const avgLat = relevantStates.reduce((sum, s) => sum + s.latitude, 0) / relevantStates.length
      const avgLng = relevantStates.reduce((sum, s) => sum + s.longitude, 0) / relevantStates.length
      setMapCenter({ lat: avgLat, lng: avgLng, zoom: 6 })
    }
    setViewMode("map")
  }

  const handleRatingChange = (facilityId: string, recommend: boolean, tags: string[]) => {
    setUserRatings((prev) => ({
      ...prev,
      [facilityId]: { recommend, tags },
    }))
  }

  const handleBackToChat = () => {
    setViewMode("chat")
    setSelectedState("")
    setSelectedFacility(null)
  }

  // Show initial loading
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading data...</div>
      </div>
    )
  }

  // Full screen chat
  if (viewMode === "chat") {
    return (
      <div className="h-screen w-full max-w-[480px] mx-auto bg-white overflow-hidden">
        <FullScreenChat
          facilities={facilities}
          stateData={stateData}
          onShowMap={handleShowMap}
        />
      </div>
    )
  }

  // Map view (after plan is shown)
  return (
    <div className="h-screen w-full max-w-[480px] mx-auto flex flex-col bg-white">
      <Header
        facilities={relevantFacilities}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        onBackToDashboard={handleBackToChat}
      />
      <div className="flex-1 relative">
        <FacilityMap
          facilities={filteredFacilities}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacility}
          onResetMap={() => setSelectedFacility(null)}
          initialCenter={mapCenter}
          stateData={filteredStateData}
        />
      </div>
      <BottomSheet
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        userRatings={userRatings}
        onRatingChange={handleRatingChange}
      />
      <ChatPopup selectedFacility={selectedFacility} />
    </div>
  )
}
