"use client"

import { ChevronDown } from "lucide-react"
import type { Facility } from "@/lib/types"

interface HeaderProps {
  facilities: Facility[]
  selectedState: string
  onStateChange: (state: string) => void
}

export function Header({ facilities, selectedState, onStateChange }: HeaderProps) {
  const states = Array.from(new Set(facilities.map((f) => f.state))).sort()

  const verified = facilities.filter((f) => f.trust_score > 0.7).length
  const uncertain = facilities.filter((f) => f.trust_score >= 0.4 && f.trust_score <= 0.7).length
  const gaps = facilities.filter((f) => f.trust_score < 0.4).length

  return (
    <header className="bg-[#1a2e1a] text-white px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Maternal Emergency Desert Map</h1>
          <p className="text-xs text-white/70">India · {facilities.length} facilities audited</p>
        </div>
        <div className="relative">
          <select
            value={selectedState}
            onChange={(e) => onStateChange(e.target.value)}
            className="appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#639922]"
          >
            <option value="">All States</option>
            {states.map((state) => (
              <option key={state} value={state} className="text-black">
                {state}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
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
