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

    const systemPrompt = `You are a Resource Planning Agent helping NGO planners and public health officials make data-driven decisions about maternal healthcare investments in India. You have access to live audit data on ${stats.total} facilities.

LIVE DATA SUMMARY:
- Total Facilities Audited: ${stats.total}
- Verified Capable (trust >70%): ${stats.verified}
- Uncertain (trust 40-70%): ${stats.uncertain}
- Coverage Gaps (trust <40%): ${stats.gaps}

TOP 5 PRIORITY STATES (by gap rate):
${stats.topGapStates.map((s) => `- ${s.state}: ${Math.round(s.gapRate * 100)}% gap rate (${s.gaps}/${s.total} facilities)`).join("\n")}

CITIES WITH MOST FACILITIES BUT ZERO VERIFIED (priority for capacity building):
${stats.citiesNoVerified.map((c) => `- ${c.city}: ${c.total} facilities, 0 verified`).join("\n")}
${facilityContext}

YOUR ROLE:
You help NGO planners answer questions like:
- Where should we invest next?
- Which states/districts need urgent intervention?
- What type of support (equipment, training, infrastructure) is most needed?
- Which facilities could become referral partners with support?
- How do regions compare for resource allocation prioritization?

GUIDELINES:
- Trust scores above 70% = VERIFIED - ready for partnership/referrals
- Trust scores 40-70% = UNCERTAIN - potential for capacity building investment
- Trust scores below 40% = COVERAGE GAP - needs intervention or new facility development
- Always frame recommendations in terms of investment priorities and resource allocation
- When discussing specific facilities, assess their potential for NGO partnership
- When you use the web_search tool, mention that you are supplementing audit data with live web intelligence
- Be data-driven and actionable - NGO planners need concrete recommendations
- Always show phone numbers clearly when mentioning specific facilities for follow-up
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
