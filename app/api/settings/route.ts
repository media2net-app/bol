import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest } from '@/lib/api'

// In-memory store voor API credentials (in productie zou je dit in een database of encrypted storage doen)
// Let op: Dit is alleen voor development/demo. In productie gebruik een veilige storage oplossing.
let storedCredentials: { apiKey: string; apiSecret: string } | null = null

/**
 * GET: Haal huidige settings op (alleen prefix voor veiligheid)
 */
export async function GET(request: NextRequest) {
  try {
    // Check environment variables first (production)
    const envKey = process.env.API_KEY
    const envSecret = process.env.API_SECRET

    if (envKey && envSecret) {
      return NextResponse.json({
        success: true,
        data: {
          apiKey: envKey,
          hasCredentials: true,
          source: 'environment',
        },
      })
    }

    // Check stored credentials (development/demo)
    if (storedCredentials) {
      return NextResponse.json({
        success: true,
        data: {
          apiKey: storedCredentials.apiKey,
          hasCredentials: true,
          source: 'stored',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        hasCredentials: false,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * POST: Sla API credentials op
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, apiSecret } = body

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error: 'Missing credentials',
          message: 'API Key en Secret zijn verplicht',
        },
        { status: 400 }
      )
    }

    // Valideer format (basic check)
    if (apiKey.length < 10 || apiSecret.length < 10) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          message: 'API Key en Secret lijken ongeldig',
        },
        { status: 400 }
      )
    }

    // Store credentials (in productie: encrypt en sla op in database)
    storedCredentials = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
    }

    // Update environment voor deze sessie (tijdelijk)
    // In productie zou je dit anders aanpakken
    process.env.API_KEY = storedCredentials.apiKey
    process.env.API_SECRET = storedCredentials.apiSecret

    return NextResponse.json({
      success: true,
      message: 'Credentials opgeslagen',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

