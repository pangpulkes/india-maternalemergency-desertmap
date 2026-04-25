"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Header } from "@/components/header"
import { BottomSheet } from "@/components/bottom-sheet"
import { ChatPopup } from "@/components/chat-popup"
import type { Facility } from "@/lib/types"

// Dynamically import the map to avoid SSR issues with Leaflet
const FacilityMap = dynamic(() => import("@/components/facility-map").then((mod) => mod.FacilityMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
})

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedState, setSelectedState] = useState("")
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userRatings, setUserRatings] = useState<Record<string, { recommend: boolean; tags: string[] }>>({})

  useEffect(() => {
    fetch("/api/facilities")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFacilities(data)
        } else if (data.error) {
          console.error("API error:", data.error)
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load facilities:", err)
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

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading facilities...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full max-w-[480px] mx-auto flex flex-col bg-white">
      <Header
        facilities={facilities}
        selectedState={selectedState}
        onStateChange={setSelectedState}
      />
      <div className="flex-1 relative">
        <FacilityMap
          facilities={filteredFacilities}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacility}
        />
      </div>
      <BottomSheet
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        userRatings={userRatings}
        onRatingChange={handleRatingChange}
      />
      <ChatPopup />
    </div>
  )
}
