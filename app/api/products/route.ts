import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal producten op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const offset = searchParams.get('offset') || '0'
    const limit = searchParams.get('limit') || '20'

    // GET /retailer/products
    const products = await makeBolApiRequest(
      `/retailer/products?q=${q}&offset=${offset}&limit=${limit}`
    )

    return NextResponse.json({
      success: true,
      data: products,
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

