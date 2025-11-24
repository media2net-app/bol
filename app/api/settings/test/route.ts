import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

/**
 * POST: Test de opgeslagen API credentials
 */
export async function POST(request: NextRequest) {
  try {
    // Test door een simpele API call te doen
    // We gebruiken een endpoint dat weinig data teruggeeft
    const response = await makeBolApiRequest(
      '/retailer/orders?fulfilment-method=ALL&status=OPEN&page=1',
      {},
      true // Use cache to minimize calls
    )

    return NextResponse.json({
      success: true,
      message: 'API credentials zijn geldig en werken correct',
      data: {
        testResult: 'success',
        ordersCount: response.orders?.length || 0,
      },
    })
  } catch (error: any) {
    if (error instanceof RateLimitError) {
      // Rate limit betekent dat credentials werken, maar we zijn rate limited
      return NextResponse.json({
        success: true,
        message: 'API credentials zijn geldig (rate limit bereikt)',
        data: {
          testResult: 'rate_limited',
        },
      })
    }

    // Check if it's an auth error
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        {
          error: 'Invalid credentials',
          message: 'API credentials zijn ongeldig. Controleer je API Key en Secret.',
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        error: 'Test failed',
        message: error.message || 'Kon API credentials niet testen',
      },
      { status: 500 }
    )
  }
}

