import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // TODO: Load agent manifests from MCP server
    // For now, return mock data
    const agents = [
      {
        id: 'ATHENA',
        name: 'ATHENA',
        status: 'active',
        manifest: {},
      },
      // ... more agents
    ]

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('Agents API error:', error)
    return NextResponse.json(
      { error: 'Failed to load agents' },
      { status: 500 }
    )
  }
}
