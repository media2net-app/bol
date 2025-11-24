import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, getApiCredentials, RateLimitError } from '@/lib/api'
import { getCachedResponse } from '@/lib/apiCache'

/**
 * GET: Haal orders op van bol.com Retailer API
 * Ondersteunt verschillende query parameters voor filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { clientId, clientSecret } = getApiCredentials()

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const fulfilmentMethod = searchParams.get('fulfilment-method') || 'ALL'
    const status = searchParams.get('status') || 'OPEN'
    const changeInterval = searchParams.get('change-interval-minute')

    // Build query string
    let queryString = `fulfilment-method=${fulfilmentMethod}&status=${status}`
    if (changeInterval) {
      queryString += `&change-interval-minute=${changeInterval}`
    }

    try {
      // Check cache first
      const cacheKey = { 'fulfilment-method': fulfilmentMethod, 'status': status }
      if (changeInterval) {
        cacheKey['change-interval-minute'] = changeInterval
      }
      
      const cachedOrders = await getCachedResponse('/retailer/orders', cacheKey)
      if (cachedOrders) {
        return NextResponse.json({
          success: true,
          data: cachedOrders,
          cached: true,
        })
      }

      // Fetch from API
      const ordersResponse = await makeBolApiRequest(
        `/retailer/orders?${queryString}`,
        {},
        true // Use cache
      )

      return NextResponse.json({
        success: true,
        data: ordersResponse,
        cached: false,
      })
    } catch (error: any) {
      // Try to use cached data as fallback
      if (error instanceof RateLimitError) {
        const cacheKey = { 'fulfilment-method': fulfilmentMethod, 'status': status }
        if (changeInterval) {
          cacheKey['change-interval-minute'] = changeInterval
        }
        
        const cachedOrders = await getCachedResponse('/retailer/orders', cacheKey)
        if (cachedOrders) {
          return NextResponse.json({
            success: true,
            data: cachedOrders,
            cached: true,
            warning: `Rate limit bereikt. Toont gecachte data. ${error.message}`,
          })
        }

        return NextResponse.json(
          {
            error: 'Rate limit bereikt',
            message: error.message,
            retryAfter: error.retryAfter,
          },
          { status: 429 }
        )
      }

      // Try cached data for other errors too
      const cacheKey = { 'fulfilment-method': fulfilmentMethod, 'status': status }
      if (changeInterval) {
        cacheKey['change-interval-minute'] = changeInterval
      }
      
      const cachedOrders = await getCachedResponse('/retailer/orders', cacheKey)
      if (cachedOrders) {
        return NextResponse.json({
          success: true,
          data: cachedOrders,
          cached: true,
          warning: `API error. Toont gecachte data: ${error.message}`,
        })
      }

      return NextResponse.json(
        {
          error: 'Server error',
          message: error.message,
        },
        { status: 500 }
      )
    }
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


