export async function POST(req: Request) {
  const { messages } = await req.json()

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      stream: false,
      max_tokens: 1000
    })
  })

  const data = await response.json()
  const content = data.choices[0].message.content
  return Response.json({ content })
}