"use client"

import { useState } from "react"
import { MessageCircle, X, Send } from "lucide-react"
import { useChat } from "@ai-sdk/react"

const SUGGESTED_PROMPTS = [
  "Which states have worst coverage?",
  "Find verified facilities near Bihar",
]

export function ChatPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: "/api/chat",
  })

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  const renderMessageContent = (content: string) => {
    // Convert phone numbers to clickable links
    const phoneRegex = /(\+91[-\s]?[\d\s-]{10,})/g
    const parts = content.split(phoneRegex)

    return parts.map((part, index) => {
      if (phoneRegex.test(part)) {
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
            {messages.length === 0 && (
              <div className="text-center py-4">
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
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    message.role === "user"
                      ? "bg-[#639922] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {message.role === "user" ? message.content : renderMessageContent(message.content)}
                </div>
              </div>
            ))}
            {isLoading && (
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
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
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
