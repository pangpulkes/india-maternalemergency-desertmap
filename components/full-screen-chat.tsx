"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Search, MapPin, Building2, Users, AlertTriangle } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import type { Facility, StateData } from "@/lib/types"

interface FullScreenChatProps {
  facilities: Facility[]
  stateData: StateData[]
  onShowMap: (states: string[]) => void
}

const INITIAL_MESSAGE = `Hi, I'm your maternal emergency planning agent. I've audited 1,180 maternal health facilities across India and identified critical coverage gaps.

Tell me about your organization — which states you operate in, your available budget, what types of interventions you can fund, and your timeline. I'll generate a tailored intervention plan.`

export function FullScreenChat({ facilities, stateData, onShowMap }: FullScreenChatProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [extractedStates, setExtractedStates] = useState<string[]>([])
  const [showMetrics, setShowMetrics] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      // Check if the response contains an intervention plan (has specific markers)
      if (message.content.includes("Recommended Site") || 
          message.content.includes("Intervention Plan") ||
          message.content.includes("Top 3")) {
        setShowMetrics(true)
      }
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "web_search") {
        setIsSearching(true)
      }
    },
  })

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
    }
  }, [messages, stateData, extractedStates])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input?.trim() || isLoading) return
    handleSubmit(e)
  }

  // Calculate metrics based on extracted states or all data
  const relevantFacilities = extractedStates.length > 0
    ? facilities.filter(f => extractedStates.includes(f.state))
    : facilities
  const relevantStateData = extractedStates.length > 0
    ? stateData.filter(s => extractedStates.includes(s.state))
    : stateData

  const totalFacilities = relevantFacilities.length
  const verifiedCount = relevantFacilities.filter(f => f.trust_score > 0.7).length
  const gapsCount = relevantFacilities.filter(f => f.trust_score < 0.4).length
  const citiesWithZeroCoverage = new Set(
    relevantFacilities
      .filter(f => f.trust_score < 0.4)
      .map(f => f.city)
  ).size

  const renderMessageContent = (content: string) => {
    const phoneRegex = /(\+91[-\s]?[\d\s-]{10,})/g
    const testRegex = /^\+91[-\s]?[\d\s-]{10,}$/
    const parts = content.split(phoneRegex)

    return parts.map((part, index) => {
      if (testRegex.test(part)) {
        const cleanPhone = part.replace(/[\s-]/g, "")
        return (
          <a
            key={index}
            href={`tel:${cleanPhone}`}
            className="text-blue-600 underline font-medium"
          >
            {part}
          </a>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      {/* Header */}
      <header className="bg-[#1a2e1a] text-white px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold">Maternal Emergency Desert Map</h1>
          <p className="text-sm text-white/70">
            AI-powered resource allocation for NGO planners · India · 1,180 facilities audited
          </p>
        </div>
      </header>

      {/* Metrics Bar - Shows after plan is generated */}
      {showMetrics && (
        <div className="bg-gray-50 border-b px-4 py-3 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-lg p-2 text-center border">
                <Building2 className="w-4 h-4 mx-auto text-gray-500 mb-1" />
                <p className="text-lg font-bold text-gray-900">{totalFacilities}</p>
                <p className="text-[10px] text-gray-500 leading-tight">Facilities Audited</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border border-green-200">
                <div className="w-4 h-4 mx-auto bg-[#639922] rounded-full mb-1" />
                <p className="text-lg font-bold text-[#639922]">{verifiedCount}</p>
                <p className="text-[10px] text-gray-500 leading-tight">Verified Capable</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border border-red-200">
                <AlertTriangle className="w-4 h-4 mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-red-600">{gapsCount}</p>
                <p className="text-[10px] text-gray-500 leading-tight">Coverage Gaps</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border border-red-200">
                <Users className="w-4 h-4 mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-red-600">{citiesWithZeroCoverage}</p>
                <p className="text-[10px] text-gray-500 leading-tight">Zero Coverage</p>
              </div>
            </div>
            {extractedStates.length > 0 && (
              <button
                onClick={() => onShowMap(extractedStates)}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-[#639922] text-white py-2.5 rounded-lg font-medium hover:bg-[#537a1c] transition-colors"
              >
                <MapPin className="w-4 h-4" />
                View Map of {extractedStates.join(", ")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-[#639922] text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {message.role === "user" ? message.content : renderMessageContent(message.content)}
              </div>
            </div>
          ))}

          {/* Web Search Indicator */}
          {isSearching && (
            <div className="flex justify-start">
              <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500 animate-pulse" />
                <span className="text-sm text-blue-600">Researching district-level context...</span>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isLoading && !isSearching && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-4 flex-shrink-0">
        <form onSubmit={onFormSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input ?? ""}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your organization and goals..."
              className="flex-1 px-4 py-3 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent bg-white"
            />
            <button
              type="submit"
              disabled={isLoading || !input?.trim()}
              className="w-12 h-12 rounded-full bg-[#639922] text-white flex items-center justify-center hover:bg-[#537a1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
