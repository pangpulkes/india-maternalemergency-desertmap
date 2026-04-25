"use client"

import { Map, ChevronRight } from "lucide-react"
import type { StateData } from "@/lib/types"

interface DashboardProps {
  stateData: StateData[]
  totalFacilities: number
  verifiedCount: number
  gapsCount: number
  citiesWithZeroCoverage: number
  onViewMap: () => void
  onSelectState: (state: StateData) => void
}

export function Dashboard({
  stateData,
  totalFacilities,
  verifiedCount,
  gapsCount,
  citiesWithZeroCoverage,
  onViewMap,
  onSelectState,
}: DashboardProps) {
  const getSeverityBadge = (gapRate: number) => {
    if (gapRate >= 0.85) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
          CRITICAL
        </span>
      )
    } else if (gapRate >= 0.75) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500 text-white">
          SEVERE
        </span>
      )
    } else {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-white">
          UNDERSERVED
        </span>
      )
    }
  }

  const top10States = [...stateData]
    .sort((a, b) => b.gap_rate - a.gap_rate)
    .slice(0, 10)

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-[#1a2e1a] text-white px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold leading-tight">Maternal Emergency Desert Map</h1>
            <p className="text-xs text-white/70 mt-1">
              AI-powered resource allocation for NGO planners · India · {totalFacilities.toLocaleString()} facilities audited
            </p>
          </div>
          <button
            onClick={onViewMap}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Map className="w-4 h-4" />
            View Map
          </button>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Total Facilities Audited</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalFacilities.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Verified Capable</p>
            <p className="text-2xl font-bold text-[#639922] mt-1">{verifiedCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Coverage Gaps</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{gapsCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Cities With Zero Coverage</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{citiesWithZeroCoverage}</p>
          </div>
        </div>
      </div>

      {/* State Ranking */}
      <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Top 10 Priority States by Gap Rate
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {top10States.map((state, index) => (
            <button
              key={state.state}
              onClick={() => onSelectState(state)}
              className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-[#639922]/30 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-gray-900">{state.state}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(state.gap_rate)}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${state.gap_rate * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600 w-12 text-right">
                  {Math.round(state.gap_rate * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {state.total_facilities} facilities · {state.verified} verified · {state.gaps} gaps
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
