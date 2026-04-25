"use client"

import { X, Phone, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import type { Facility } from "@/lib/types"

interface BottomSheetProps {
  facility: Facility | null
  onClose: () => void
}

export function BottomSheet({ facility, onClose }: BottomSheetProps) {
  if (!facility) return null

  const getTrustColor = (score: number) => {
    if (score > 0.7) return "bg-[#639922]"
    if (score >= 0.4) return "bg-orange-500"
    return "bg-red-500"
  }

  const trustPercent = Math.round(facility.trust_score * 100)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-[480px] bg-white rounded-t-2xl shadow-2xl">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-2">
              <h2 className="font-semibold text-gray-900 text-lg leading-tight">{facility.name}</h2>
              <p className="text-sm text-gray-500">
                {facility.city}, {facility.state}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {facility.has_emergency_ob ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#639922]/10 text-[#639922] text-xs font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Emergency OB
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                <XCircle className="w-3.5 h-3.5" />
                No Emergency OB
              </span>
            )}
            {facility.phone && (
              <a
                href={`tel:${facility.phone}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-600 text-xs font-medium hover:bg-blue-200 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">Trust Score</span>
              <span className="text-sm font-semibold text-gray-900">{trustPercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getTrustColor(facility.trust_score)} transition-all duration-500`}
                style={{ width: `${trustPercent}%` }}
              />
            </div>
          </div>

          {facility.evidence.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Evidence</p>
              <div className="flex flex-wrap gap-1.5">
                {facility.evidence.map((item, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {facility.red_flags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                Red Flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {facility.red_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 italic">{facility.reasoning}</p>
        </div>
      </div>
    </div>
  )
}
