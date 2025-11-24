import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, getProcessStatus, getOfferExport, getOffer, RateLimitError } from '@/lib/api'

// GET: Haal offers export status op of individuele offer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const processStatusId = searchParams.get('processStatusId')
    const exportId = searchParams.get('exportId')
    const offerId = searchParams.get('offerId')

    // Haal process status op
    if (processStatusId) {
      try {
        const status = await getProcessStatus(processStatusId)
        return NextResponse.json({
          success: true,
          data: status,
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }

    // Haal export file op
    if (exportId) {
      try {
        const exportData = await getOfferExport(exportId)
        return NextResponse.json({
          success: true,
          data: exportData,
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }

    // Haal individuele offer op
    if (offerId) {
      try {
        const offer = await getOffer(offerId)
        return NextResponse.json({
          success: true,
          data: offer,
        })
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Geen processStatusId, exportId of offerId opgegeven' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Server error', message: error.message },
      { status: 500 }
    )
  }
}

// POST: Vraag offers export aan
export async function POST(request: NextRequest) {
  console.log('[Offers API] POST request received - requesting offers export')
  
  try {
    const { getApiCredentials } = await import('@/lib/api')
    const { clientId, clientSecret } = getApiCredentials()

    if (!clientId || !clientSecret) {
      console.log('[Offers API] Error: API credentials not configured')
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      )
    }

    console.log('[Offers API] Making BOL API request to /retailer/offers/export')
    
    // Make sure we have a fresh token before making the request
    const { getAccessToken } = await import('@/lib/api')
    try {
      await getAccessToken() // This will validate and refresh if needed
    } catch (tokenError: any) {
      console.error('[Offers API] Token error:', tokenError)
      return NextResponse.json(
        {
          error: 'Token error',
          message: tokenError.message || 'Kon geen geldige token verkrijgen. Controleer je API credentials.',
        },
        { status: 401 }
      )
    }
    
    const exportResponse = await makeBolApiRequest(
      '/retailer/offers/export',
      { 
        method: 'POST',
        body: JSON.stringify({ format: 'CSV' }) // BOL API requires format field
      },
      false // Don't cache POST requests
    )

    console.log('[Offers API] Export request successful:', exportResponse)
    return NextResponse.json({
      success: true,
      data: exportResponse,
    })
  } catch (error: any) {
    console.error('[Offers API] Error:', error)
    console.error('[Offers API] Error message:', error.message)
    console.error('[Offers API] Error stack:', error.stack)
    
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: 'Rate limit bereikt',
          message: error.message,
          retryAfter: error.retryAfter,
        },
        { status: 429 }
      )
    }
    
    // Provide more detailed error message
    let errorMessage = error.message || 'Er is een fout opgetreden bij het aanvragen van offers export'
    if (error.message && error.message.includes('401')) {
      errorMessage = 'Token expired. Probeer de pagina te vernieuwen.'
    } else if (error.message && error.message.includes('credentials')) {
      errorMessage = 'API credentials niet geconfigureerd. Ga naar Instellingen om je credentials in te voeren.'
    }
    
    return NextResponse.json(
      { 
        error: 'Server error', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

