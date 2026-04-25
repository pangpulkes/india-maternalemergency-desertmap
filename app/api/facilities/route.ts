export async function GET() {
  try {
    const host = process.env.DATABRICKS_HOST
    const token = process.env.DATABRICKS_TOKEN

    const res = await fetch(
      `https://${host}/api/2.0/fs/files/Volumes/workspace/default/globalaihackathon/map_data.json`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      throw new Error(`Databricks error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    return Response.json(data)

  } catch (error) {
    console.error('Failed to fetch facilities:', error)
    return Response.json({ error: 'Failed to load facility data' }, { status: 500 })
  }
}
