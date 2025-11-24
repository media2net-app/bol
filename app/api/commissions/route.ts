import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal commissies op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ean = searchParams.get('ean')
    const condition = searchParams.get('condition') || 'NEW'

    if (!ean) {
      return NextResponse.json(
        { error: 'EAN parameter is required' },
        { status: 400 }
      )
    }

    // GET /retailer/commissions
    const commissions = await makeBolApiRequest(
      `/retailer/commissions?ean=${ean}&condition=${condition}`
    )

    return NextResponse.json({
      success: true,
      data: commissions,
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

