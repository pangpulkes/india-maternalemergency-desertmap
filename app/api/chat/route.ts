const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for current information about maternal health facilities, intervention costs, government schemes, or district health data in India",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to run on Tavily"
          },
          reason: {
            type: "string",
            description: "Why this search is needed to answer the user's question"
          }
        },
        required: ["query", "reason"]
      }
    }
  }
]

async function runTavilySearch(query: string): Promise<string> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 3
      })
    })
    if (!res.ok) return `Search failed: ${res.status}`
    const data = await res.json()
    return data.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || "No results found"
  } catch {
    return "Search unavailable"
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Tier 1: Databricks serving endpoint
  let databricksContext = ""
  try {
    const lastUserMessage = messages[messages.length - 1]?.content || ""
    const dbRes = await fetch(
      `https://${process.env.DATABRICKS_HOST}/serving-endpoints/maternal-health-agent/invocations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DATABRICKS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: lastUserMessage }]
        })
      }
    )
    if (dbRes.ok) {
      const dbData = await dbRes.json()
      databricksContext = dbData.choices?.[0]?.message?.content || ""
    } else {
      throw new Error(`Endpoint failed: ${dbRes.status}`)
    }
  } catch {
    // Tier 2: Volume file fallback
    try {
      const stateRes = await fetch(
        `https://${process.env.DATABRICKS_HOST}/api/2.0/fs/files/Volumes/workspace/default/globalaihackathon/state_planning.json`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.DATABRICKS_TOKEN}`
          }
        }
      )
      if (stateRes.ok) {
        const stateData = await stateRes.json()
        // Only send top 20 states by gap rate to stay within token limits
        const topStates = stateData
          .sort((a: any, b: any) => b.gap_rate - a.gap_rate)
          .slice(0, 20)
        databricksContext = `Real audited facility data from Databricks (${stateData.length} states total, showing top 20 by gap rate): ${JSON.stringify(topStates)}`
      }
    } catch (err) {
      console.error('All Databricks sources failed:', err)
    }
  }

  const systemPrompt = {
    role: "system",
    content: `You are a maternal emergency planning agent for NGO planners in India. You have audited 1,180 maternal health facilities across India using AI-powered trust scoring on the Databricks platform.

Live facility intelligence from Databricks:
${databricksContext}

You have access to a web search tool. Use it to supplement the Databricks data when you need:
- Current maternal mortality rates for specific districts or states
- Government co-funding schemes (NHM, PMSMA, etc.) available in mentioned states  
- Real intervention costs for equipment, training, or infrastructure in India
- Recent news about specific facilities — closures, upgrades, government investments

Rules:
1. Always cite specific facility names, cities, states, trust scores from Databricks data
2. Use web search to find real costs — never invent numbers
3. Always explain WHY each facility was chosen
4. When you search, tell the user what you are looking for and why
5. End with a total budget breakdown and one immediate next action`
  }

  // First Groq call with tools
  const augmentedMessages = [systemPrompt, ...messages]
  console.error('MESSAGES SENT TO GROQ:', JSON.stringify(augmentedMessages.slice(0, 2)))
  let firstResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    // First Groq call — use tool-use model
    body: JSON.stringify({
      model: 'llama3-groq-70b-8192-tool-use-preview',
      messages: augmentedMessages,
      tools: TOOLS,
      tool_choice: "auto",
      stream: false,
      max_tokens: 1500
    })
  })

  let firstData = await firstResponse.json()
  if (!firstData.choices?.[0]?.message) {
    console.error('Groq first call error:', JSON.stringify(firstData))
    return Response.json({ content: "I encountered an error. Please try again." })
  }
  let firstMessage = firstData.choices[0].message

  // If Groq wants to call tools, execute them
  if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
    const toolMessages: any[] = [firstMessage]

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      firstMessage.tool_calls.map(async (toolCall: any) => {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await runTavilySearch(args.query)
        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        }
      })
    )

    toolMessages.push(...toolResults)

    // Second Groq call with tool results
    const secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [...augmentedMessages, ...toolMessages],
        stream: false,
        max_tokens: 3000
      })
    })

    const secondData = await secondResponse.json()
    if (!secondData.choices?.[0]?.message?.content) {
      console.error('Groq second call error:', JSON.stringify(secondData))
      return Response.json({ content: "I encountered an error processing the search results. Please try again." })
    }
    const content = secondData.choices[0].message.content
    return Response.json({ content })
  }

  // No tool calls needed — return first response directly
  const content = firstMessage.content
  return Response.json({ content })
}