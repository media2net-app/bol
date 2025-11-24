import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal performance indicators op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name') || 'PERFORMANCE_NAME'
    const period = searchParams.get('period') || 'WEEK'
    const numberOfPeriods = searchParams.get('number-of-periods') || '4'

    // GET /retailer/performance/indicators
    const performance = await makeBolApiRequest(
      `/retailer/performance/indicators?name=${name}&period=${period}&number-of-periods=${numberOfPeriods}`
    )

    return NextResponse.json({
      success: true,
      data: performance,
    })
  } catch (error: any) {
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

    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

