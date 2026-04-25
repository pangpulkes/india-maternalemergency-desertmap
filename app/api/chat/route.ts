import { streamText, tool } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { z } from "zod"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

interface Facility {
  name: string
  city: string
  state: string
  trust_score: number
  evidence: string[]
  red_flags: string[]
  phone?: string
  has_emergency_ob: boolean
  latitude: number
  longitude: number
}

async function fetchFacilities(): Promise<Facility[]> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/facilities`, { cache: "no-store" })
    if (!response.ok) {
      const fs = await import("fs/promises")
      const path = await import("path")
      const filePath = path.join(process.cwd(), "public", "results.json")
      const fileContents = await fs.readFile(filePath, "utf8")
      return JSON.parse(fileContents)
    }
    return response.json()
  } catch {
    const fs = await import("fs/promises")
    const path = await import("path")
    const filePath = path.join(process.cwd(), "public", "results.json")
    const fileContents = await fs.readFile(filePath, "utf8")
    return JSON.parse(fileContents)
  }
}

function computeStats(facilities: Facility[]) {
  const total = facilities.length
  const verified = facilities.filter((f) => f.trust_score > 0.7).length
  const uncertain = facilities.filter((f) => f.trust_score >= 0.4 && f.trust_score <= 0.7).length
  const gaps = facilities.filter((f) => f.trust_score < 0.4).length

  const stateStats: Record<string, { total: number; gaps: number }> = {}
  facilities.forEach((f) => {
    if (!stateStats[f.state]) {
      stateStats[f.state] = { total: 0, gaps: 0 }
    }
    stateStats[f.state].total++
    if (f.trust_score < 0.4) {
      stateStats[f.state].gaps++
    }
  })

  const topGapStates = Object.entries(stateStats)
    .map(([state, stats]) => ({
      state,
      gapRate: stats.total > 0 ? stats.gaps / stats.total : 0,
      gaps: stats.gaps,
      total: stats.total,
    }))
    .filter((s) => s.gaps > 0)
    .sort((a, b) => b.gapRate - a.gapRate)
    .slice(0, 5)

  const cityStats: Record<string, { total: number; verified: number }> = {}
  facilities.forEach((f) => {
    const cityKey = `${f.city}, ${f.state}`
    if (!cityStats[cityKey]) {
      cityStats[cityKey] = { total: 0, verified: 0 }
    }
    cityStats[cityKey].total++
    if (f.trust_score > 0.7) {
      cityStats[cityKey].verified++
    }
  })

  const citiesNoVerified = Object.entries(cityStats)
    .map(([city, stats]) => ({
      city,
      total: stats.total,
      verified: stats.verified,
    }))
    .filter((c) => c.verified === 0 && c.total > 1)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return { total, verified, uncertain, gaps, topGapStates, citiesNoVerified }
}

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return "Web search unavailable - Tavily API key not configured."
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    })

    if (!response.ok) {
      return "Web search failed - please try again later."
    }

    const data = await response.json()
    const results = data.results || []

    if (results.length === 0) {
      return "No web results found for this facility."
    }

    return results
      .map((r: { title: string; content: string; url: string }) => 
        `- ${r.title}: ${r.content.slice(0, 200)}... (${r.url})`
      )
      .join("\n")
  } catch {
    return "Web search encountered an error."
  }
}

export async function POST(req: Request) {
  try {
    const { messages, selectedFacility } = await req.json()

    const facilities = await fetchFacilities()
    const stats = computeStats(facilities)

    let facilityContext = ""
    if (selectedFacility) {
      facilityContext = `

CURRENTLY SELECTED FACILITY:
- Name: ${selectedFacility.name}
- Location: ${selectedFacility.city}, ${selectedFacility.state}
- Trust Score: ${Math.round(selectedFacility.trust_score * 100)}%
- Has Emergency OB: ${selectedFacility.has_emergency_ob ? "Yes" : "No"}
- Evidence: ${selectedFacility.evidence?.join(", ") || "None"}
- Red Flags: ${selectedFacility.red_flags?.join(", ") || "None"}
- Phone: ${selectedFacility.phone || "Not available"}

When the user asks generic questions like "Is this trustworthy?" or "What are the concerns?", answer about THIS facility specifically. Use the web_search tool to find more information about this facility if needed.`
    }

    const systemPrompt = `You are an AI agent helping users find genuine maternal emergency care in India. You have access to live data on ${stats.total} facilities.

LIVE DATA SUMMARY:
- Total Facilities: ${stats.total}
- Verified (trust >70%): ${stats.verified}
- Uncertain (trust 40-70%): ${stats.uncertain}
- Gaps (trust <40%): ${stats.gaps}

TOP 5 STATES BY GAP RATE:
${stats.topGapStates.map((s) => `- ${s.state}: ${Math.round(s.gapRate * 100)}% gap rate (${s.gaps}/${s.total} facilities)`).join("\n")}

CITIES WITH MOST FACILITIES BUT ZERO VERIFIED:
${stats.citiesNoVerified.map((c) => `- ${c.city}: ${c.total} facilities, 0 verified`).join("\n")}
${facilityContext}

GUIDELINES:
- Trust scores above 70% mean VERIFIED and capable for maternal emergencies
- Trust scores 40-70% mean UNCERTAIN - proceed with caution
- Trust scores below 40% mean SUSPICIOUS/GAP - likely overclaiming capabilities
- When discussing a gap facility (trust <40%), ALWAYS suggest the nearest verified alternative in the same state or nearby
- When you use the web_search tool, mention that you are supplementing dataset findings with live web search
- Be concise - users may be in an emergency
- Always show phone numbers clearly when mentioning specific facilities
- Format phone numbers so they can be tapped to call

FACILITY DATA:
${JSON.stringify(facilities.slice(0, 50), null, 2)}
${facilities.length > 50 ? `\n... and ${facilities.length - 50} more facilities` : ""}`

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
      tools: {
        web_search: tool({
          description: "Search the web for more information about a specific maternity hospital or facility. Use this when discussing a specific facility to supplement trust score data with live information.",
          parameters: z.object({
            facilityName: z.string().describe("The name of the facility to search for"),
            city: z.string().describe("The city where the facility is located"),
          }),
          execute: async ({ facilityName, city }) => {
            const query = `${facilityName} ${city} India maternity hospital emergency reviews`
            const results = await searchTavily(query)
            return results
          },
        }),
      },
      maxSteps: 3,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to generate response",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
