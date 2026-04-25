"use client"

import { useState } from "react"
import { X, Phone, AlertTriangle, CheckCircle, XCircle, ThumbsUp, ThumbsDown } from "lucide-react"
import type { Facility } from "@/lib/types"

interface BottomSheetProps {
  facility: Facility | null
  onClose: () => void
  userRatings?: Record<string, { recommend: boolean; tags: string[] }>
  onRatingChange?: (facilityId: string, recommend: boolean, tags: string[]) => void
}

const RECOMMEND_TAGS = [
  "24/7 confirmed",
  "C-section available",
  "Blood bank on site",
  "Anesthesiologist present",
  "NICU available",
  "Ambulance service",
]

const NOT_RECOMMEND_TAGS = [
  "Closed / no longer operating",
  "No emergency service despite claim",
  "Referred me elsewhere",
  "No OB doctor available",
  "Equipment listed but not functional",
]

const DATA_QUALITY_TAGS = [
  "Phone number is wrong",
  "Address is incorrect",
  "Facility has moved",
  "Other",
]

export function BottomSheet({ facility, onClose, userRatings = {}, onRatingChange }: BottomSheetProps) {
  if (!facility) return null

  const [showTags, setShowTags] = useState(false)
  const [otherFeedback, setOtherFeedback] = useState("")
  const facilityId = `${facility.name}-${facility.city}`
  const currentRating = userRatings[facilityId]
  const recommend = currentRating?.recommend ?? null
  const selectedTags = currentRating?.tags ?? []

  const getTrustColor = (score: number) => {
    if (score > 0.7) return "bg-[#639922]"
    if (score >= 0.4) return "bg-orange-500"
    return "bg-red-500"
  }

  // Calculate adjusted trust score based on user feedback
  const getAdjustedTrustScore = () => {
    let adjusted = facility.trust_score
    if (recommend === true) {
      // Positive feedback increases score by up to 10%
      adjusted = Math.min(1, adjusted + 0.1)
    } else if (recommend === false) {
      // Negative feedback decreases score by up to 15%
      adjusted = Math.max(0, adjusted - 0.15)
    }
    return adjusted
  }

  const displayScore = recommend !== null ? getAdjustedTrustScore() : facility.trust_score
  const trustPercent = Math.round(displayScore * 100)

  const handleRecommendation = (isRecommend: boolean) => {
    if (onRatingChange) {
      if (recommend === isRecommend) {
        // Toggle off if clicking same option
        onRatingChange(facilityId, null as any, [])
        setShowTags(false)
      } else {
        onRatingChange(facilityId, isRecommend, selectedTags)
        setShowTags(true)
      }
    }
  }

  const handleTagToggle = (tag: string) => {
    if (onRatingChange) {
      const newTags = selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
      onRatingChange(facilityId, recommend as boolean, newTags)
    }
  }

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

          <p className="text-xs text-gray-500 italic mb-4">{facility.reasoning}</p>

          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2.5">Would you recommend this facility?</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleRecommendation(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  recommend === true
                    ? "bg-[#639922] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm font-medium">Yes</span>
              </button>
              <button
                onClick={() => handleRecommendation(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                  recommend === false
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span className="text-sm font-medium">No</span>
              </button>
            </div>

            {recommend !== null && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {recommend ? "Confirming capability" : "Flagging overclaims"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(recommend ? RECOMMEND_TAGS : NOT_RECOMMEND_TAGS).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedTags.includes(tag)
                            ? recommend
                              ? "bg-[#639922] text-white"
                              : "bg-red-500 text-white"
                            : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Additional feedback (helps us improve data)</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {DATA_QUALITY_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (tag === "Other") {
                            // Toggle other feedback input
                            if (selectedTags.includes(tag)) {
                              handleTagToggle(tag)
                              setOtherFeedback("")
                            } else {
                              handleTagToggle(tag)
                            }
                          } else {
                            handleTagToggle(tag)
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedTags.includes(tag)
                            ? "bg-blue-500 text-white"
                            : "bg-white border border-blue-200 text-gray-700 hover:border-blue-300"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {selectedTags.includes("Other") && (
                    <input
                      type="text"
                      placeholder="Tell us more..."
                      value={otherFeedback}
                      onChange={(e) => setOtherFeedback(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
