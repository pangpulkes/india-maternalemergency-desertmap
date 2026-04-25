"use client"

import { useRef, useEffect } from "react"
import { Send, Search } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatPanelProps {
  messages: Message[]
  input: string
  setInput: (value: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  isSearching: boolean
}

const INITIAL_MESSAGE = `Hi, I'm your maternal emergency planning agent. I've audited 1,180 maternal health facilities across India and identified critical coverage gaps.

Tell me about your organization — which states you operate in, your available budget, what types of interventions you can fund, and your timeline. I'll generate a tailored intervention plan.`

const SUGGESTED_PROMPTS = [
  "We work in Bihar and UP with a ₹2 crore budget",
  "Operating in rural Assam, looking to build capacity",
  "Need to establish referral networks in Maharashtra",
  "Can fund equipment and staff training",
]

export function ChatPanel({
  messages,
  input,
  setInput,
  onSubmit,
  isLoading,
  isSearching,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-[#1a2e1a] flex-shrink-0">
        <h2 className="font-semibold text-white text-sm">Resource Planning Agent</h2>
        <p className="text-xs text-white/70">AI-powered allocation guidance</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
            <p className="text-sm text-gray-600 font-medium px-4">
              Tell me about your organization
            </p>
            <div className="flex flex-col gap-2 w-full px-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="px-3 py-2 text-xs text-left bg-gray-50 hover:bg-[#639922]/10 border border-gray-200 hover:border-[#639922] rounded-lg transition-colors text-gray-700 hover:text-gray-900"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] px-3 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-[#639922] text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {message.role === "user" ? message.content : renderMessageContent(message.content)}
            </div>
          </div>
        ))
        )}

        {/* Web Search Indicator */}
        {isSearching && (
          <div className="flex justify-start">
            <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span className="text-xs text-blue-600">Researching...</span>
            </div>
          </div>
        )}

        {/* Typing Indicator */}
        {isLoading && !isSearching && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2.5 rounded-xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input ?? ""}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your organization..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent bg-white"
          />
          <button
            type="submit"
            disabled={isLoading || !input?.trim()}
            className="w-9 h-9 rounded-lg bg-[#639922] text-white flex items-center justify-center hover:bg-[#537a1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
