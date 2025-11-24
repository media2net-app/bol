import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'

// GET: Haal facturen op
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'CURRENT_MONTH'

    // GET /retailer/invoices
    const invoicesResponse = await makeBolApiRequest(
      `/retailer/invoices?period=${period}`,
      {},
      true // Use cache
    )

    // De API response kan invoices bevatten of een andere structuur
    const invoices = invoicesResponse.invoices || invoicesResponse.data?.invoices || []

    return NextResponse.json({
      success: true,
      data: {
        invoices: Array.isArray(invoices) ? invoices : [],
        total: invoicesResponse.total || invoices.length,
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

