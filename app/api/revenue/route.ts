import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, RateLimitError } from '@/lib/api'
import { getCachedResponse } from '@/lib/apiCache'

// GET: Bereken totale omzet van dit jaar
export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear()
    const startOfYear = `${currentYear}-01-01T00:00:00.000Z`
    
    let totalRevenue = 0
    let totalOrders = 0
    
    // Optimalisatie: Haal alleen orders op die we nodig hebben
    // Gebruik een grote change-interval om alle orders van dit jaar te krijgen
    // Dit minimaliseert API calls
    try {
      // Bereken aantal dagen sinds begin van het jaar
      const now = new Date()
      const startOfYear = new Date(currentYear, 0, 1)
      const daysSinceStartOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
      const minutesSinceStartOfYear = daysSinceStartOfYear * 24 * 60
      
      // Check eerst cache - revenue verandert niet zo vaak
      const cachedRevenueOrders = await getCachedResponse('/retailer/orders', { 
        'fulfilment-method': 'ALL', 
        'status': 'ALL' 
      })
      
      let ordersResponse
      if (cachedRevenueOrders) {
        // Gebruik cached data - geen API call!
        ordersResponse = cachedRevenueOrders
      } else {
        // Alleen als er geen cache is, doe 1 API call
        // Gebruik een grote change-interval om alle orders te krijgen
        ordersResponse = await makeBolApiRequest(
          `/retailer/orders?fulfilment-method=ALL&status=ALL&change-interval-minute=${Math.min(minutesSinceStartOfYear, 525600)}`, // Max 1 jaar
          {},
          true // Use cache - revenue verandert niet zo vaak
        )
      }

      if (ordersResponse.orders && ordersResponse.orders.length > 0) {
        // Filter orders van dit jaar en bereken omzet
        for (const order of ordersResponse.orders) {
          const orderDate = new Date(order.orderPlacedDateTime)
          
          if (orderDate.getFullYear() === currentYear) {
            totalOrders++
            
            // Bereken totaalbedrag per order
            if (order.orderItems && order.orderItems.length > 0) {
              const orderTotal = order.orderItems.reduce((sum: number, item: any) => {
                const itemTotal = (item.unitPrice || 0) * (item.quantity || 0)
                return sum + itemTotal
              }, 0)
              totalRevenue += orderTotal
            }
          }
        }
      }
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        throw error
      }
      // Bij andere errors, return 0 maar geen error
      console.error('Error calculating revenue:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        year: currentYear,
        totalRevenue: totalRevenue,
        totalOrders: totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        currency: 'EUR',
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

