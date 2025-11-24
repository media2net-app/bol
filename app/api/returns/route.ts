import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal retouren op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const handled = searchParams.get('handled') || 'false'

    // GET /retailer/returns
    const returnsResponse = await makeBolApiRequest(
      `/retailer/returns?page=${page}&handled=${handled}`,
      {},
      true // Use cache
    )

    // De API response kan returns bevatten of een andere structuur
    const returns = returnsResponse.returns || returnsResponse.data?.returns || []

    return NextResponse.json({
      success: true,
      data: {
        returns: Array.isArray(returns) ? returns : [],
        total: returnsResponse.total || returns.length,
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

