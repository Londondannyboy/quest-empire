import { NextRequest, NextResponse } from 'next/server'

async function generateHumeToken(user_id?: string) {
  const apiKey = process.env.HUME_API_KEY
  const secretKey = process.env.HUME_SECRET_KEY

  if (!apiKey || !secretKey) {
    console.error('Missing Hume credentials')
    throw new Error('Voice service not configured')
  }

  // Get Hume access token using Basic auth
  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')

  const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Hume token error:', response.status, errorText)
    throw new Error('Failed to get voice access token')
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID,
    userId: user_id,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id } = body

    const result = await generateHumeToken(user_id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Access token error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
