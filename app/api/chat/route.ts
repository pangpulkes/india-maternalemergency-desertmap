import { anthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"
import { promises as fs } from "fs"
import path from "path"

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Load facility data
  const filePath = path.join(process.cwd(), "public", "results.json")
  const fileContents = await fs.readFile(filePath, "utf8")
  const facilities = JSON.parse(fileContents)

  const systemPrompt = `You are an AI agent helping users find verified maternal emergency facilities in India. You have data on ${facilities.length} facilities with trust scores. Answer questions about coverage gaps, specific states, nearest facilities, and capability. Be concise — users may be in an emergency. Always end responses involving a specific facility by showing the phone number if available.

Here is the current facility data:
${JSON.stringify(facilities, null, 2)}

When mentioning phone numbers, always format them clearly so they can be tapped to call.`

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
  })

  return result.toDataStreamResponse()
}
