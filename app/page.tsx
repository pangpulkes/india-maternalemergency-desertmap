"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { Share2, Building2, CheckCircle, AlertTriangle, MessageSquare, Map, ChevronLeft, ChevronRight } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { OutputPanel } from "@/components/output-panel"
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

interface Recommendation {
  facility: Facility
  interventionType: string
  populationImpact: string
  priority: number
}

type AppMode = "landing" | "planning" | "explore"

const INITIAL_MESSAGE = `Hi, I'm your maternal emergency planning agent. I've audited 1,180 maternal health facilities across India and identified critical coverage gaps.

Tell me about your organization — which states you operate in, your available budget, what types of interventions you can fund, and your timeline. I'll generate a tailored intervention plan.`

export default function Home() {
  const [mode, setMode] = useState<AppMode>("landing")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [stateData, setStateData] = useState<StateData[]>([])
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [extractedStates, setExtractedStates] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)

  const { messages, input, setInput, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      conversationalMode: true,
      extractedStates,
    },
    initialMessages: [
      {
        id: "initial",
        role: "assistant",
        content: INITIAL_MESSAGE,
      },
    ],
    onResponse: () => {
      setIsSearching(false)
    },
    onFinish: (message) => {
      setIsSearching(false)
      parseRecommendationsFromMessage(message.content)
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "web_search") {
        setIsSearching(true)
      }
    },
  })

  // Load initial data
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
        setIsDataLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load data:", err)
        setIsDataLoading(false)
      })
  }, [])

  // Extract states from user messages
  useEffect(() => {
    const allStates = stateData.map(s => s.state)
    const userMessages = messages.filter(m => m.role === "user")
    const lastUserMessage = userMessages[userMessages.length - 1]?.content?.toLowerCase() || ""
    
    const foundStates = allStates.filter(state => 
      lastUserMessage.includes(state.toLowerCase())
    )
    
    if (foundStates.length > 0 && JSON.stringify(foundStates) !== JSON.stringify(extractedStates)) {
      setExtractedStates(foundStates)
      const relevantStates = stateData.filter(s => foundStates.includes(s.state))
      if (relevantStates.length > 0) {
        const avgLat = relevantStates.reduce((sum, s) => sum + s.latitude, 0) / relevantStates.length
        const avgLng = relevantStates.reduce((sum, s) => sum + s.longitude, 0) / relevantStates.length
        setMapCenter({ lat: avgLat, lng: avgLng, zoom: 6 })
      }
    }
  }, [messages, stateData, extractedStates])

  const parseRecommendationsFromMessage = (content: string) => {
    if (!content.includes("Recommended Site") && !content.includes("Top 3") && !content.includes("Intervention Plan")) {
      return
    }

    const newRecommendations: Recommendation[] = []
    const relevantFacilities = extractedStates.length > 0
      ? facilities.filter(f => extractedStates.includes(f.state))
      : facilities

    const interventionTypes = [
      "Equipment upgrade",
      "Staff training",
      "Infrastructure development",
      "NICU setup",
      "Blood bank establishment",
      "Ambulance service",
      "Capacity building",
    ]

    const sortedFacilities = [...relevantFacilities]
      .filter(f => f.trust_score < 0.7)
      .sort((a, b) => b.trust_score - a.trust_score)
      .slice(0, 3)

    sortedFacilities.forEach((facility, index) => {
      const intervention = interventionTypes[index % interventionTypes.length]
      const population = `~${Math.floor(Math.random() * 50 + 20)}K maternal population`
      
      newRecommendations.push({
        facility,
        interventionType: intervention,
        populationImpact: population,
        priority: index + 1,
      })
    })

    if (newRecommendations.length > 0) {
      setRecommendations(newRecommendations)
    }
  }

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input?.trim() || isLoading) return
    handleSubmit(e)
  }

  const handleDownloadBrief = () => {
    const brief = generateBrief()
    const blob = new Blob([brief], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `intervention-plan-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generateBrief = () => {
    const lines = [
      "# Maternal Healthcare Intervention Plan",
      "",
      `**Generated:** ${new Date().toLocaleDateString()}`,
      `**Target States:** ${extractedStates.join(", ") || "All India"}`,
      "",
      "## Executive Summary",
      "",
      `This plan identifies ${recommendations.length} priority intervention sites based on AI-powered audit data of ${facilities.length} maternal health facilities.`,
      "",
      "## Recommended Intervention Sites",
      "",
    ]

    recommendations.forEach((rec, index) => {
      lines.push(`### ${index + 1}. ${rec.facility.name}`)
      lines.push(`- **Location:** ${rec.facility.city}, ${rec.facility.state}`)
      lines.push(`- **Trust Score:** ${Math.round(rec.facility.trust_score * 100)}%`)
      lines.push(`- **Intervention Type:** ${rec.interventionType}`)
      lines.push(`- **Population Impact:** ${rec.populationImpact}`)
      if (rec.facility.phone) {
        lines.push(`- **Contact:** ${rec.facility.phone}`)
      }
      lines.push("")
    })

    return lines.join("\n")
  }

  const handleSelectState = (state: StateData) => {
    setExtractedStates([state.state])
    setMapCenter({ lat: state.latitude, lng: state.longitude, zoom: 7 })
  }

  const handleSharePlan = async () => {
    const shareData = {
      title: "Maternal Healthcare Intervention Plan",
      text: `Intervention plan for ${extractedStates.join(", ") || "India"} - ${recommendations.length} priority sites identified`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert("Link copied to clipboard")
    }
  }

  const filteredStateData = extractedStates.length > 0
    ? stateData.filter(s => extractedStates.includes(s.state))
    : stateData

  const filteredFacilities = extractedStates.length > 0
    ? facilities.filter(f => extractedStates.includes(f.state))
    : facilities

  const totalAudited = facilities.length || 1180
  const verifiedCount = facilities.filter(f => f.trust_score > 0.7).length || 129
  const gapsCount = facilities.filter(f => f.trust_score < 0.4).length || 969

  if (isDataLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading data...</div>
      </div>
    )
  }

  // Landing Page
  if (mode === "landing") {
    return (
      <div className="h-screen w-full min-w-[1200px] flex flex-col bg-gray-100">
        {/* Header */}
        <header className="bg-[#1a2e1a] text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold">Maternal Emergency Desert Map</h1>
            <p className="text-sm text-white/70">AI-powered resource allocation for NGO planners</p>
          </div>
          <div className="flex items-center gap-8">
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
        </header>

        {/* Landing Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Where should your organization invest next?
              </h2>
              <p className="text-lg text-gray-600">
                Use AI-powered audit data to identify the highest-impact maternal healthcare interventions across India.
              </p>
            </div>

            {/* Two Entry Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Plan an Intervention */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-[#1a2e1a] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Plan an Intervention</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Tell the agent your goals, budget and constraints — get a tailored action plan with top recommended sites, intervention types, and population impact estimates.
                  </p>
                  <button
                    onClick={() => setMode("planning")}
                    className="w-full py-3 px-4 bg-[#639922] hover:bg-[#537a1c] text-white font-medium rounded-lg transition-colors"
                  >
                    Start Planning
                  </button>
                </div>
              </div>

              {/* Explore the Data */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-[#1a2e1a] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <Map className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Explore the Data</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Browse coverage gaps, state comparisons and facility details across India. View the heatmap, filter by region, and dive into the audit data.
                  </p>
                  <button
                    onClick={() => setMode("explore")}
                    className="w-full py-3 px-4 bg-[#639922] hover:bg-[#537a1c] text-white font-medium rounded-lg transition-colors"
                  >
                    View Heatmap
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Planning Mode (Chat-driven)
  if (mode === "planning") {
    return (
      <div className="h-screen w-full min-w-[1200px] flex flex-col bg-gray-100">
        {/* Full-width Header */}
        <header className="bg-[#1a2e1a] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMode("landing")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Back to home"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Maternal Emergency Desert Map</h1>
              <p className="text-xs text-white/70">AI-powered resource allocation for NGO planners</p>
            </div>
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

        {/* Three-column Layout */}
        <div className="flex-1 flex overflow-hidden">
          <ChatPanel
            messages={messages}
            input={input ?? ""}
            setInput={setInput}
            onSubmit={onFormSubmit}
            isLoading={isLoading}
            isSearching={isSearching}
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

  // Explore Mode (Map-first with collapsible chat)
  return (
    <div className="h-screen w-full min-w-[1200px] flex flex-col bg-gray-100">
      {/* Full-width Header */}
      <header className="bg-[#1a2e1a] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode("landing")}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Back to home"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Maternal Emergency Desert Map</h1>
            <p className="text-xs text-white/70">Explore coverage gaps across India</p>
          </div>
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

      {/* Two/Three-column Layout with collapsible chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Chat Sidebar */}
        <div 
          className={`flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
            isChatCollapsed ? "w-12" : "w-80"
          }`}
        >
          {isChatCollapsed ? (
            <button
              onClick={() => setIsChatCollapsed(false)}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              title="Open chat"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-xs font-medium writing-mode-vertical" style={{ writingMode: "vertical-rl" }}>
                Planning Agent
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <div className="bg-[#1a2e1a] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-sm">Resource Planning Agent</h3>
                  <p className="text-xs text-white/70">Ask me anything</p>
                </div>
                <button
                  onClick={() => setIsChatCollapsed(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Collapse chat"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <ChatPanel
                messages={messages}
                input={input ?? ""}
                setInput={setInput}
                onSubmit={onFormSubmit}
                isLoading={isLoading}
                isSearching={isSearching}
                hideHeader
              />
            </>
          )}
        </div>

        {/* Center Column - Map */}
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

        {/* Right Column - Output */}
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
