import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/api'
import { clearCachedToken } from '@/lib/tokenCache'

/**
 * Token management endpoint
 * GET: Check token status
 * POST: Force refresh token
 */
export async function GET(request: NextRequest) {
  try {
    // Check if credentials are configured first
    const { getApiCredentials } = await import('@/lib/api')
    const { clientId, clientSecret } = getApiCredentials()
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'Credentials not configured',
          message: 'API credentials zijn niet geconfigureerd. Ga naar Instellingen om je API credentials in te voeren.',
          hasCredentials: false,
        },
        { status: 400 }
      )
    }
    
    // Try to get a token (will use cache if valid)
    const token = await getAccessToken()
    
    return NextResponse.json({
      success: true,
      message: 'Token is valid',
      hasToken: !!token,
      hasCredentials: true,
    })
  } catch (error: any) {
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error'
    let errorDetails: any = {
      error: 'Token error',
      message: errorMessage,
    }
    
    // Check if it's a network error
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      errorDetails = {
        ...errorDetails,
        error: 'Network error',
        message: 'Kan geen verbinding maken met bol.com API. Controleer je internetverbinding.',
        details: errorMessage,
        suggestion: 'Controleer of je internetverbinding werkt en of bol.com bereikbaar is.',
      }
    } else if (errorMessage.includes('credentials')) {
      errorDetails = {
        ...errorDetails,
        suggestion: 'Ga naar Instellingen om je API credentials in te voeren.',
      }
    }
    
    return NextResponse.json(
      errorDetails,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Force clear cache and get new token
    clearCachedToken()
    const token = await getAccessToken()
    
    return NextResponse.json({
      success: true,
      message: 'Token refreshed',
      hasToken: !!token,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Token refresh failed',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

