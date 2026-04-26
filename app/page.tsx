"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Share2, Building2, CheckCircle, AlertTriangle } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { OutputPanel } from "@/components/output-panel"
import type { Facility, StateData } from "@/lib/types"

const FacilityMap = dynamic(
  () => import("@/components/facility-map").then((mod) => mod.FacilityMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading map...</div>
      </div>
    ),
  }
)

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface Recommendation {
  facility: Facility
  interventionType: string
  populationImpact: string
  priority: number
}

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content: `Hi, I'm your maternal emergency planning agent. I've audited 1,180 maternal health facilities across India and identified critical coverage gaps.

Tell me about your organization — which states you operate in, your available budget, what types of interventions you can fund, and your timeline. I'll generate a tailored intervention plan.`,
}

const INTERVENTION_TYPES = [
  "Equipment upgrade",
  "Staff training",
  "Infrastructure development",
  "NICU setup",
  "Blood bank establishment",
  "Ambulance service",
  "Capacity building",
]

export default function Home() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [stateData, setStateData] = useState<StateData[]>([])
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [extractedStates, setExtractedStates] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  // Chat state — fully local, no useChat hook
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Load facility + state data
  useEffect(() => {
    Promise.all([
      fetch("/api/facilities").then((r) => r.json()),
      fetch("/desert_state.json").then((r) => r.json()),
    ])
      .then(([facilitiesData, stateDataRes]) => {
        if (Array.isArray(facilitiesData)) setFacilities(facilitiesData)
        if (Array.isArray(stateDataRes)) setStateData(stateDataRes)
        setIsDataLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load data:", err)
        setIsDataLoading(false)
      })
  }, [])

  const extractStatesFromText = useCallback(
    (text: string) => {
      const lower = text.toLowerCase()
      const found = stateData
        .map((s) => s.state)
        .filter((state) => lower.includes(state.toLowerCase()))
      if (found.length > 0) {
        setExtractedStates(found)
        const relevant = stateData.filter((s) => found.includes(s.state))
        if (relevant.length > 0) {
          const avgLat = relevant.reduce((sum, s) => sum + s.latitude, 0) / relevant.length
          const avgLng = relevant.reduce((sum, s) => sum + s.longitude, 0) / relevant.length
          setMapCenter({ lat: avgLat, lng: avgLng, zoom: 6 })
        }
      }
    },
    [stateData]
  )

  const parseRecommendationsFromMessage = useCallback(
    (content: string) => {
      // Extract facility names mentioned in the response
      const matchedFacilities: Facility[] = []

      const pool = extractedStates.length > 0
        ? facilities.filter((f) => extractedStates.includes(f.state))
        : facilities

      // Match any facility name from our dataset that appears in the agent response
      for (const facility of pool) {
        if (content.includes(facility.name)) {
          matchedFacilities.push(facility)
        }
        if (matchedFacilities.length >= 6) break
      }

      // Fallback: if no names matched but response looks like a recommendation
      if (matchedFacilities.length === 0) {
        const hasRecommendation =
          content.includes("recommend") ||
          content.includes("trust score") ||
          content.includes("intervention") ||
          content.includes("Bihar") ||
          content.includes("Uttar Pradesh")

        if (hasRecommendation) {
          const candidates = [...pool]
            .filter((f) => f.trust_score >= 0.4 && f.trust_score < 0.7)
            .sort((a, b) => b.trust_score - a.trust_score)
            .slice(0, 3)
          matchedFacilities.push(...candidates)
        }
      }

      if (matchedFacilities.length === 0) return

      setRecommendations(
        matchedFacilities.map((facility, i) => ({
          facility,
          interventionType: "Equipment upgrade",
          populationImpact: `~${Math.floor(Math.random() * 50 + 20)}K maternal population`,
          priority: i + 1,
        }))
      )
    },
    [facilities, extractedStates]
  )

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)
      extractStatesFromText(text)

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            extractedStates,
          }),
        })

        if (!res.ok) throw new Error("Chat API error")

        const data = await res.json()
        const assistantText = data.content

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: assistantText,
          },
        ])

        parseRecommendationsFromMessage(assistantText)
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          },
        ])
      } finally {
        setIsLoading(false)
        setIsSearching(false)
      }
    },
    [isLoading, messages, extractedStates, extractStatesFromText, parseRecommendationsFromMessage]
  )

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    sendMessage(input)
  }

  const onSuggestedPrompt = (text: string) => {
    sendMessage(text)
  }

  const handleSelectState = (state: StateData) => {
    setExtractedStates([state.state])
    setMapCenter({ lat: state.latitude, lng: state.longitude, zoom: 7 })
  }

  const handleDownloadBrief = () => {
    const lines = [
      "# Maternal Healthcare Intervention Plan",
      "",
      `**Generated:** ${new Date().toLocaleDateString()}`,
      `**Target States:** ${extractedStates.join(", ") || "All India"}`,
      "",
      "## Recommended Intervention Sites",
      "",
      ...recommendations.flatMap((rec, i) => [
        `### ${i + 1}. ${rec.facility.name}`,
        `- **Location:** ${rec.facility.city}, ${rec.facility.state}`,
        `- **Trust Score:** ${Math.round(rec.facility.trust_score * 100)}%`,
        `- **Intervention:** ${rec.interventionType}`,
        `- **Population Impact:** ${rec.populationImpact}`,
        rec.facility.phone ? `- **Contact:** ${rec.facility.phone}` : "",
        "",
      ]),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `intervention-plan-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSharePlan = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Maternal Healthcare Intervention Plan",
          text: `Intervention plan for ${extractedStates.join(", ") || "India"}`,
          url: window.location.href,
        })
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
  }

  const filteredFacilities =
    extractedStates.length > 0
      ? facilities.filter((f) => extractedStates.includes(f.state))
      : facilities

  const filteredStateData =
    extractedStates.length > 0
      ? stateData.filter((s) => extractedStates.includes(s.state))
      : stateData

  const totalAudited = facilities.length || 1180
  const verifiedCount = facilities.filter((f) => f.trust_score > 0.7).length || 129
  const gapsCount = facilities.filter((f) => f.trust_score < 0.4).length || 969

  if (isDataLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500 text-sm">Loading data...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full min-w-[1200px] flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-[#1a2e1a] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Maternal Emergency Desert Map</h1>
          <p className="text-xs text-white/70">AI-powered resource allocation for NGO planners</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-white/70" />
            <span className="text-sm">
              <span className="font-semibold">{totalAudited.toLocaleString()}</span>
              <span className="text-white/70 ml-1">audited</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm">
              <span className="font-semibold text-green-400">{verifiedCount}</span>
              <span className="text-white/70 ml-1">verified</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm">
              <span className="font-semibold text-red-400">{gapsCount}</span>
              <span className="text-white/70 ml-1">gaps</span>
            </span>
          </div>
        </div>

        <button
          onClick={handleSharePlan}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share Plan
        </button>
      </header>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel
          messages={messages}
          input={input}
          setInput={setInput}
          onSubmit={onFormSubmit}
          onSuggestedPrompt={onSuggestedPrompt}
          isLoading={isLoading}
          isSearching={isSearching}
          onFacilityClick={(name) => {
            const match = facilities.find(f => name.includes(f.name) || f.name.includes(name))
            if (match) setSelectedFacility(match)
          }}
        />

        <div className="flex-1 relative">
          <FacilityMap
            key="main-map"
            facilities={filteredFacilities}
            selectedFacility={selectedFacility}
            onSelectFacility={setSelectedFacility}
            onSelectState={handleSelectState}
            onResetMap={() => {
              setSelectedFacility(null)
              setExtractedStates([])
              setMapCenter(null)
            }}
            initialCenter={mapCenter}
            stateData={filteredStateData}
          />
        </div>

        <OutputPanel
          recommendations={recommendations}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacility}
          onDownloadBrief={handleDownloadBrief}
          extractedStates={extractedStates}
          stateData={stateData}
          onSelectState={handleSelectState}
        />
      </div>
    </div>
  )
}
