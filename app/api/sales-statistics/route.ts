import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, getApiCredentials, RateLimitError } from '@/lib/api'
import { getCachedResponse } from '@/lib/apiCache'

interface SalesData {
  ean: string
  totalQuantity: number
  orderCount: number
  totalRevenue: number
}

interface SalesStatistics {
  period: 'day' | 'week' | 'month'
  date: string
  products: SalesData[]
  totalOrders: number
  totalRevenue: number
}

/**
 * GET: Haal verkoopstatistieken op per dag/week/maand
 * Query parameters:
 * - period: 'day' | 'week' | 'month'
 * - startDate: YYYY-MM-DD (optioneel, default: 30 dagen geleden)
 * - endDate: YYYY-MM-DD (optioneel, default: vandaag)
 */
export async function GET(request: NextRequest) {
  try {
    const { clientId, clientSecret } = getApiCredentials()

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date()
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000) // Default: 30 dagen geleden

    // Normalize dates to start of day
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    console.log(`Fetching sales statistics for period: ${period}, from ${start.toISOString()} to ${end.toISOString()}`)

    // Fetch all orders (SHIPPED status to get completed sales)
    // Note: We need to paginate through all orders
    const allOrders: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        // Rate limit: wait 3 seconds between requests (25 requests/min = ~2.4 sec per request)
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }

        const ordersResponse = await makeBolApiRequest(
          `/retailer/orders?fulfilment-method=ALL&status=SHIPPED&page=${page}`,
          {},
          false // Don't cache for statistics
        )

        if (!ordersResponse.orders || ordersResponse.orders.length === 0) {
          hasMore = false
          break
        }

        // Filter orders by date range
        const filteredOrders = ordersResponse.orders.filter((order: any) => {
          if (!order.orderPlacedDateTime) return false
          const orderDate = new Date(order.orderPlacedDateTime)
          return orderDate >= start && orderDate <= end
        })

        allOrders.push(...filteredOrders)

        // Check if we've reached the end
        if (ordersResponse.orders.length < 20) { // Assuming 20 orders per page
          hasMore = false
        } else {
          page++
        }

        // Safety limit: don't fetch more than 10 pages (200 orders) at once
        if (page > 10) {
          console.warn('Reached page limit (10 pages). Consider using a smaller date range.')
          hasMore = false
        }
      } catch (error: any) {
        if (error instanceof RateLimitError) {
          return NextResponse.json(
            {
              error: 'Rate limit bereikt',
              message: 'Te veel API requests. Probeer het later opnieuw of gebruik een kleinere datum range.',
              retryAfter: error.retryAfter,
            },
            { status: 429 }
          )
        }
        throw error
      }
    }

    console.log(`Fetched ${allOrders.length} orders`)

    // Aggregate sales data by EAN
    const salesByEan: Map<string, SalesData> = new Map()

    for (const order of allOrders) {
      if (!order.orderItems || !Array.isArray(order.orderItems)) continue

      const orderDate = new Date(order.orderPlacedDateTime)

      for (const item of order.orderItems) {
        if (!item.ean || !item.quantity) continue

        const key = item.ean
        const existing = salesByEan.get(key) || {
          ean: key,
          totalQuantity: 0,
          orderCount: 0,
          totalRevenue: 0,
        }

        existing.totalQuantity += item.quantity || 0
        existing.orderCount += 1
        existing.totalRevenue += (item.unitPrice || 0) * (item.quantity || 0)

        salesByEan.set(key, existing)
      }
    }

    // Convert to array and sort by quantity (descending)
    const products = Array.from(salesByEan.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)

    // Group by period if needed
    const statistics: SalesStatistics = {
      period,
      date: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
      products: products.slice(0, 100), // Top 100 products
      totalOrders: allOrders.length,
      totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
    }

    return NextResponse.json({
      success: true,
      data: statistics,
      meta: {
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        totalOrdersFetched: allOrders.length,
        totalProducts: products.length,
      },
    })
  } catch (error: any) {
    console.error('Error fetching sales statistics:', error)
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

