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

  const stateStats: Record<string, { total: number; gaps: number; verified: number }> = {}
  facilities.forEach((f) => {
    if (!stateStats[f.state]) {
      stateStats[f.state] = { total: 0, gaps: 0, verified: 0 }
    }
    stateStats[f.state].total++
    if (f.trust_score < 0.4) {
      stateStats[f.state].gaps++
    }
    if (f.trust_score > 0.7) {
      stateStats[f.state].verified++
    }
  })

  const topGapStates = Object.entries(stateStats)
    .map(([state, stats]) => ({
      state,
      gapRate: stats.total > 0 ? stats.gaps / stats.total : 0,
      gaps: stats.gaps,
      verified: stats.verified,
      total: stats.total,
    }))
    .filter((s) => s.gaps > 0)
    .sort((a, b) => b.gapRate - a.gapRate)
    .slice(0, 10)

  const cityStats: Record<string, { total: number; verified: number; state: string }> = {}
  facilities.forEach((f) => {
    const cityKey = `${f.city}, ${f.state}`
    if (!cityStats[cityKey]) {
      cityStats[cityKey] = { total: 0, verified: 0, state: f.state }
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
      state: stats.state,
    }))
    .filter((c) => c.verified === 0 && c.total > 1)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Find facilities that could be upgraded (uncertain score with some evidence)
  const upgradeableFacilities = facilities
    .filter((f) => f.trust_score >= 0.3 && f.trust_score < 0.7 && f.evidence.length > 0)
    .sort((a, b) => b.trust_score - a.trust_score)
    .slice(0, 10)

  return { total, verified, uncertain, gaps, topGapStates, citiesNoVerified, upgradeableFacilities }
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
        search_depth: "advanced",
        max_results: 5,
      }),
    })

    if (!response.ok) {
      return "Web search failed - please try again later."
    }

    const data = await response.json()
    const results = data.results || []

    if (results.length === 0) {
      return "No web results found."
    }

    return results
      .map((r: { title: string; content: string; url: string }) => 
        `- ${r.title}: ${r.content.slice(0, 300)}... (${r.url})`
      )
      .join("\n")
  } catch {
    return "Web search encountered an error."
  }
}

export async function POST(req: Request) {
  try {
    const { messages, selectedFacility, conversationalMode, extractedStates } = await req.json()

    const facilities = await fetchFacilities()
    
    // Filter facilities to extracted states if provided
    const relevantFacilities = extractedStates?.length > 0
      ? facilities.filter((f: Facility) => extractedStates.includes(f.state))
      : facilities
    
    const stats = computeStats(relevantFacilities)
    const allStats = computeStats(facilities)

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

When discussing this facility, provide specific recommendations for NGO engagement.`
    }

    const systemPrompt = `You are a maternal emergency planning agent helping NGO planners allocate resources effectively across India's maternal healthcare landscape.

AUDIT DATA SUMMARY (${facilities.length} total facilities):
- Verified Capable (trust >70%): ${allStats.verified}
- Uncertain (trust 40-70%): ${allStats.uncertain}
- Coverage Gaps (trust <40%): ${allStats.gaps}

TOP 10 PRIORITY STATES (by gap rate):
${allStats.topGapStates.map((s) => `- ${s.state}: ${Math.round(s.gapRate * 100)}% gap rate, ${s.gaps} gaps, ${s.verified} verified`).join("\n")}

CITIES WITH HIGHEST UNMET NEED (facilities but 0 verified):
${allStats.citiesNoVerified.map((c) => `- ${c.city}: ${c.total} facilities, 0 verified`).join("\n")}

FACILITIES WITH UPGRADE POTENTIAL (uncertain but have evidence):
${allStats.upgradeableFacilities.map((f) => `- ${f.name}, ${f.city}, ${f.state}: ${Math.round(f.trust_score * 100)}% trust, Evidence: ${f.evidence.join(", ")}`).join("\n")}
${facilityContext}

YOUR CONVERSATION FLOW:
1. FIRST MESSAGE: Greet and ask about their organization (states, budget, interventions, timeline)
2. EXTRACT CONSTRAINTS: Parse their natural language response to identify:
   - Operating states (e.g., "we work in Bihar and UP")
   - Budget range (e.g., "around 2 crore", "50 lakhs")
   - Intervention types (e.g., "equipment", "training", "new facilities")
   - Timeline (e.g., "next 6 months", "this year")
   - Primary goal (e.g., "reduce mortality", "increase coverage")
3. USE WEB SEARCH: Call web_search tool to get district-level context for their states
4. GENERATE INTERVENTION PLAN: Provide a structured plan with:

**INTERVENTION PLAN FORMAT** (use exactly this structure when you have enough info):

## Your Tailored Intervention Plan

Based on your constraints, here are the highest-impact opportunities:

### Recommended Site #1: [Facility Name]
- **Location:** [City, State]
- **Current Status:** [Trust score, key issues]
- **Intervention Type:** [Equipment/Training/Infrastructure]
- **Estimated Population Impact:** [X lakhs people within 50km]
- **Contact:** [Phone number]
- **Why This Site:** [2-3 sentences on why this is strategic]

### Recommended Site #2: [Facility Name]
[Same format]

### Recommended Site #3: [Facility Name]
[Same format]

### Implementation Roadmap
- **Month 1-2:** [Action items]
- **Month 3-4:** [Action items]
- **Month 5-6:** [Action items]

### Expected Outcomes
- [Metric 1]
- [Metric 2]

GUIDELINES:
- Be conversational and helpful - this is a dialogue, not a form
- Extract constraints naturally from what they say
- Always ground recommendations in the audit data
- When mentioning facilities, ALWAYS include phone numbers
- Use web_search to supplement audit data with district context
- Prioritize facilities with upgrade potential (uncertain but have evidence)
- Consider geographic distribution for maximum population impact
- Format phone numbers clearly for easy calling

FACILITY DATA FOR RECOMMENDATIONS:
${JSON.stringify(relevantFacilities.slice(0, 100), null, 2)}
${relevantFacilities.length > 100 ? `\n... and ${relevantFacilities.length - 100} more facilities in selected states` : ""}`

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
      tools: {
        web_search: tool({
          description: "Search the web for district-level maternal health context, government programs, or specific facility information. Use this to supplement audit data with current information about regions the NGO is interested in.",
          parameters: z.object({
            query: z.string().describe("Search query - e.g., 'Bihar maternal mortality rate 2024' or 'Patna maternity hospitals government programs'"),
          }),
          execute: async ({ query }) => {
            const results = await searchTavily(query)
            return results
          },
        }),
      },
      maxSteps: 5,
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
