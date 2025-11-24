import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal replenishments op (FBB voorraad)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'

    // GET /retailer/replenishments
    const replenishmentsResponse = await makeBolApiRequest(
      `/retailer/replenishments?page=${page}`,
      {},
      true // Use cache
    )

    // De API response kan replenishments bevatten of een andere structuur
    const replenishments = replenishmentsResponse.replenishments || replenishmentsResponse.data?.replenishments || []

    return NextResponse.json({
      success: true,
      data: {
        replenishments: Array.isArray(replenishments) ? replenishments : [],
        total: replenishmentsResponse.total || replenishments.length,
      },
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

