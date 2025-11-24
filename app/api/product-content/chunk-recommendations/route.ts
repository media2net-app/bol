import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

/**
 * POST: Get chunk recommendations
 * Helps identify the right product classification (chunk) for a product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // POST /retailer/content/chunk-recommendations
    // Body should contain product information like EAN, title, description, etc.
    const response = await makeBolApiRequest(
      '/retailer/content/chunk-recommendations',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      false // Don't cache POST requests
    )

    return NextResponse.json({
      success: true,
      data: response,
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

