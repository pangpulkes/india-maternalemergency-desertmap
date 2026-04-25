"use client"

import { useState } from "react"
import { Search, X, ArrowLeft } from "lucide-react"
import type { Facility } from "@/lib/types"

interface HeaderProps {
  facilities: Facility[]
  selectedState: string
  onStateChange: (state: string) => void
  onBackToDashboard?: () => void
}

export function Header({ facilities, selectedState, onStateChange, onBackToDashboard }: HeaderProps) {
  const [searchInput, setSearchInput] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  const getSearchResults = (query: string) => {
    if (!query.trim()) return []
    
    const lowerQuery = query.toLowerCase()
    
    // Search across facility names, cities, and states
    const matchedFacilities = facilities.filter((f) =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.city.toLowerCase().includes(lowerQuery) ||
      f.state.toLowerCase().includes(lowerQuery)
    )

    return matchedFacilities
  }

  const searchResults = getSearchResults(searchInput)

  const verified = facilities.filter((f) => f.trust_score > 0.7).length
  const uncertain = facilities.filter((f) => f.trust_score >= 0.4 && f.trust_score <= 0.7).length
  const gaps = facilities.filter((f) => f.trust_score < 0.4).length

  const handleFacilitySelect = (facility: Facility) => {
    // Filter by the selected facility's state
    onStateChange(facility.state)
    setSearchInput("")
    setShowDropdown(false)
  }

  const handleClearSearch = () => {
    setSearchInput("")
    onStateChange("")
    setShowDropdown(false)
  }

  return (
    <header className="bg-[#1a2e1a] text-white px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-0.5 p-1.5 -ml-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">Maternal Emergency Desert Map</h1>
            <p className="text-xs text-white/70">India · {facilities.length} facilities audited</p>
          </div>
        </div>
        <div className="relative w-40">
          <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <Search className="w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Search by location..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              className="bg-transparent flex-1 text-sm focus:outline-none placeholder-white/40"
            />
            {(searchInput || selectedState) && (
              <button
                onClick={handleClearSearch}
                className="p-0.5 hover:bg-white/20 rounded"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            )}
          </div>
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1f0f] border border-white/20 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
              {searchInput.trim() === "" ? (
                <button
                  onClick={() => handleFacilitySelect({ state: "" } as Facility)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition ${
                    !selectedState ? "bg-white/20 text-[#639922]" : "text-white"
                  }`}
                >
                  All Facilities
                </button>
              ) : searchResults.length > 0 ? (
                searchResults.slice(0, 8).map((facility) => (
                  <button
                    key={`${facility.name}-${facility.city}`}
                    onClick={() => handleFacilitySelect(facility)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/10 transition border-b border-white/5 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-white">{facility.name}</div>
                    <div className="text-xs text-white/60">{facility.city}, {facility.state}</div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-white/60 text-center">
                  No facilities found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#639922] text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-white" />
          {verified} Verified
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-white" />
          {uncertain} Uncertain
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-white" />
          {gaps} Gaps
        </span>
      </div>
    </header>
  )
}
