import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal verzendingen op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const fulfilmentMethod = searchParams.get('fulfilment-method') || 'ALL'

    // GET /retailer/shipments
    const shipmentsResponse = await makeBolApiRequest(
      `/retailer/shipments?page=${page}&fulfilment-method=${fulfilmentMethod}`,
      {},
      true // Use cache
    )

    // De API response kan shipments bevatten of een andere structuur
    const shipments = shipmentsResponse.shipments || shipmentsResponse.data?.shipments || []

    return NextResponse.json({
      success: true,
      data: {
        shipments: Array.isArray(shipments) ? shipments : [],
        total: shipmentsResponse.total || shipments.length,
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

// POST: Maak nieuwe verzending aan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const shipment = await makeBolApiRequest(
      '/retailer/shipments',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )

    return NextResponse.json({
      success: true,
      data: shipment,
    })
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

