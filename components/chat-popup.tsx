"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Search } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import type { Facility } from "@/lib/types"

const SUGGESTED_PROMPTS = [
  "Which states have worst coverage?",
  "Find verified facilities near Bihar",
]

const FACILITY_PROMPTS = [
  "Is this facility trustworthy?",
  "What are the concerns here?",
  "Are there better alternatives nearby?",
]

interface ChatPopupProps {
  selectedFacility?: Facility | null
}

export function ChatPopup({ selectedFacility }: ChatPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, input, setInput, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
    body: {
      selectedFacility: selectedFacility ? {
        name: selectedFacility.name,
        city: selectedFacility.city,
        state: selectedFacility.state,
        trust_score: selectedFacility.trust_score,
        evidence: selectedFacility.evidence,
        red_flags: selectedFacility.red_flags,
        phone: selectedFacility.phone,
        has_emergency_ob: selectedFacility.has_emergency_ob,
      } : null,
    },
    onResponse: () => {
      setIsSearching(false)
    },
    onFinish: () => {
      setIsSearching(false)
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "web_search") {
        setIsSearching(true)
      }
    },
  })

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input?.trim() || isLoading) return
    handleSubmit(e)
  }

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
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[1001] w-14 h-14 rounded-full bg-[#639922] text-white shadow-lg flex items-center justify-center hover:bg-[#537a1c] transition-colors"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[1001] w-[calc(100%-2rem)] max-w-[360px] h-[40vh] max-h-[400px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Chat Header */}
          <div className="bg-[#1a2e1a] text-white px-4 py-3 flex-shrink-0">
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            <p className="text-xs text-white/70">Ask about maternal facilities</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <p className="font-medium">Connection Error</p>
                <p className="text-xs mt-1">{error.message || "Failed to connect"}</p>
              </div>
            )}
            {messages.length === 0 && !error && (
              <div className="text-center py-4">
                {selectedFacility ? (
                  <>
                    <div className="bg-[#639922]/10 rounded-lg p-2 mb-3 text-left">
                      <p className="text-xs font-medium text-[#639922]">Currently viewing:</p>
                      <p className="text-sm font-semibold text-gray-800">{selectedFacility.name}</p>
                      <p className="text-xs text-gray-500">{selectedFacility.city}, {selectedFacility.state}</p>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Ask about this facility:</p>
                    <div className="flex flex-col gap-2">
                      {FACILITY_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="px-3 py-2 text-xs bg-[#639922]/10 hover:bg-[#639922]/20 rounded-full text-[#639922] transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-3">How can I help you?</p>
                    <div className="flex flex-col gap-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
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
                <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-600">Searching web...</span>
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {isLoading && !isSearching && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm">
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

          {/* Input */}
          <form onSubmit={onFormSubmit} className="p-3 border-t flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input ?? ""}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent bg-white"
              />
              <button
                type="submit"
                disabled={isLoading || !input?.trim()}
                className="w-10 h-10 rounded-full bg-[#639922] text-white flex items-center justify-center hover:bg-[#537a1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
