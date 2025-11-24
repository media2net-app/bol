import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

/**
 * POST: Create content for a product
 * GET: Get chunk recommendations (voor product classifications)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // POST /retailer/content/products
    // Body contains product content with chunks, attributes, assets, etc.
    const response = await makeBolApiRequest(
      '/retailer/content/products',
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

/**
 * POST: Get chunk recommendations
 * Helps identify the right product classification (chunk) for a product
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const uploadId = searchParams.get('uploadId')

    if (action === 'chunk-recommendations') {
      // POST /retailer/content/chunk-recommendations
      // This requires a body with product information
      // For now, return info about the endpoint
      return NextResponse.json({
        success: true,
        message: 'Use POST to /api/product-content/chunk-recommendations with product data',
        endpoint: '/retailer/content/chunk-recommendations',
      })
    }

    if (uploadId) {
      // GET /retailer/content/upload-report/{uploadId}
      const response = await makeBolApiRequest(
        `/retailer/content/upload-report/${uploadId}`,
        {},
        true // Cache upload reports
      )

      return NextResponse.json({
        success: true,
        data: response,
      })
    }

    return NextResponse.json({
      error: 'Missing parameter',
      message: 'Provide ?uploadId={id} or ?action=chunk-recommendations',
    }, { status: 400 })
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

