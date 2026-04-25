import { generateText } from "ai"
import { promises as fs } from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const { messages, selectedFacility } = await req.json()

    // Load facility data
    const filePath = path.join(process.cwd(), "public", "results.json")
    const fileContents = await fs.readFile(filePath, "utf8")
    const facilities = JSON.parse(fileContents)

    // Build context about the currently selected facility
    let facilityContext = ""
    if (selectedFacility) {
      facilityContext = `

IMPORTANT: The user is currently viewing a specific facility on the map. Answer questions in the context of this facility:
- Name: ${selectedFacility.name}
- Location: ${selectedFacility.city}, ${selectedFacility.state}
- Trust Score: ${Math.round(selectedFacility.trust_score * 100)}%
- Has Emergency OB: ${selectedFacility.has_emergency_ob ? "Yes" : "No"}
- Evidence: ${selectedFacility.evidence?.join(", ") || "None"}
- Red Flags: ${selectedFacility.red_flags?.join(", ") || "None"}
- Phone: ${selectedFacility.phone || "Not available"}

When the user asks generic questions like "Is this trustworthy?" or "What are the concerns?", answer about THIS facility specifically.`
    }

    const systemPrompt = `You are an AI agent helping users find verified maternal emergency facilities in India. You have data on ${facilities.length} facilities with trust scores. Answer questions about coverage gaps, specific states, nearest facilities, and capability. Be concise — users may be in an emergency. Always end responses involving a specific facility by showing the phone number if available.
${facilityContext}

Here is the current facility data:
${JSON.stringify(facilities, null, 2)}

When mentioning phone numbers, always format them clearly so they can be tapped to call.`

    const result = await generateText({
      model: "anthropic/claude-opus-4.6",
      system: systemPrompt,
      messages,
    })

    return new Response(result.text, {
      headers: { "Content-Type": "text/plain" },
    })
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
