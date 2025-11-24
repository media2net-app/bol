import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, getApiCredentials, RateLimitError } from '@/lib/api'
import { getCachedResponse } from '@/lib/apiCache'

export async function GET(request: NextRequest) {
  try {
    const { clientId, clientSecret } = getApiCredentials()

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'API credentials not configured' },
        { status: 500 }
      )
    }

    const result: any = {
      apiConnected: true,
      timestamp: new Date().toISOString(),
      credentials: {
        hasKey: !!clientId,
        hasSecret: !!clientSecret,
        keyPrefix: clientId?.substring(0, 8) + '...',
      },
    }

    // Haal orders op van bol.com Retailer API
    // Gebruik change-interval-minute om alleen nieuwe/gewijzigde orders op te halen
    // Dit minimaliseert API calls en voorkomt rate limiting
    try {
      // Get orders endpoint: GET /retailer/orders
      // Parameters: 
      // - fulfilment-method (FBR, FBB, ALL)
      // - status (OPEN, ALL, SHIPPED)
      // - change-interval-minute: alleen nieuwe/gewijzigde orders (bijv. laatste 15 minuten)
      const changeInterval = 15 // Minuten - pas aan op basis van polling frequentie
      const ordersResponse = await makeBolApiRequest(
        `/retailer/orders?fulfilment-method=ALL&status=OPEN&change-interval-minute=${changeInterval}`
      )

      result.orders = {
        status: 'success',
        data: ordersResponse,
        count: ordersResponse.orders?.length || 0,
      }
    } catch (error: any) {
      // Bij rate limit of andere errors, gebruik cached data als fallback
      if (error instanceof RateLimitError) {
        // Probeer cached data te gebruiken
        try {
          const cachedOrders = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'OPEN' })
          if (cachedOrders) {
            result.orders = {
              status: 'cached',
              data: cachedOrders,
              count: cachedOrders.orders?.length || 0,
              message: `Rate limit bereikt. Toont gecachte data. ${error.message}`,
            }
          } else {
            result.orders = {
              status: 'error',
              message: error.message,
              retryAfter: error.retryAfter,
            }
          }
        } catch {
          result.orders = {
            status: 'error',
            message: error.message,
            retryAfter: error.retryAfter,
          }
        }
      } else {
        // Andere error, probeer ook cached data
        try {
          const cachedOrders = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'OPEN' })
          if (cachedOrders) {
            result.orders = {
              status: 'cached',
              data: cachedOrders,
              count: cachedOrders.orders?.length || 0,
              message: `API error. Toont gecachte data: ${error.message}`,
            }
          } else {
            result.orders = {
              status: 'error',
              message: error.message,
            }
          }
        } catch {
          result.orders = {
            status: 'error',
            message: error.message,
          }
        }
      }
    }

    // Haal ook recente orders op (laatste 48 uur)
    // Gebruik caching - deze data verandert minder vaak
    try {
      const allOrdersResponse = await makeBolApiRequest(
        '/retailer/orders?fulfilment-method=ALL&status=ALL',
        {},
        true // Use cache
      )
      result.allOrders = {
        status: 'success',
        count: allOrdersResponse.orders?.length || 0,
      }
    } catch (err: any) {
      // Bij rate limit, gebruik cached data
      if (err instanceof RateLimitError) {
        try {
          const cachedAllOrders = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'ALL' })
          if (cachedAllOrders) {
            result.allOrders = {
              status: 'cached',
              count: cachedAllOrders.orders?.length || 0,
              message: `Rate limit. Gecachte data: ${err.message}`,
            }
          } else {
            result.allOrders = {
              status: 'error',
              message: err.message,
              retryAfter: err.retryAfter,
            }
          }
        } catch {
          result.allOrders = {
            status: 'error',
            message: err.message,
            retryAfter: err.retryAfter,
          }
        }
      } else {
        // Andere error, probeer cached data
        try {
          const cachedAllOrders = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'ALL' })
          if (cachedAllOrders) {
            result.allOrders = {
              status: 'cached',
              count: cachedAllOrders.orders?.length || 0,
              message: `API error. Gecachte data: ${err.message}`,
            }
          } else {
            result.allOrders = {
              status: 'error',
              message: err.message,
            }
          }
        } catch {
          result.allOrders = {
            status: 'error',
            message: err.message,
          }
        }
      }
    }

    // Set test results
    if (result.orders?.status === 'success' || result.orders?.status === 'cached') {
      result.testResults = {
        status: 'success',
        message: `Succesvol verbonden met bol.com API. ${result.orders.count || 0} openstaande orders gevonden.`,
      }
    } else if (result.orders?.status === 'error' && result.orders?.message?.includes('Rate limit')) {
      result.testResults = {
        status: 'rate_limited',
        message: result.orders.message,
      }
    } else {
      result.testResults = {
        status: 'error',
        message: result.orders?.message || 'Kon geen data ophalen van bol.com API',
      }
    }

    // Haal offers export op (asynchroon proces)
    // Skip als er al een rate limit error was bij orders
    // Offers export is duur - alleen doen als nodig
    // Gebruik cached status als we rate limited zijn
    const isRateLimited = result.orders?.status === 'error' && result.orders?.message?.includes('Rate limit')
    if (!isRateLimited) {
      try {
        // Request offer export file
        // POST requests worden niet gecached
        const exportResponse = await makeBolApiRequest(
          '/retailer/offers/export',
          { 
            method: 'POST',
            body: JSON.stringify({ format: 'CSV' }) // BOL API requires format field
          },
          false // Don't cache POST requests
        )

        result.offersExport = {
          status: 'requested',
          processStatusId: exportResponse.processStatusId,
          message: 'Offers export aangevraagd. Gebruik processStatusId om status op te halen.',
        }
      } catch (err: any) {
        if (err instanceof RateLimitError) {
          result.offersExport = {
            status: 'rate_limited',
            message: err.message,
            retryAfter: err.retryAfter,
            retryAfterMinutes: Math.ceil(err.retryAfter / 60),
          }
        } else {
          result.offersExport = {
            status: 'error',
            message: err.message || 'Kon offers export niet aanvragen',
          }
        }
      }
    } else {
      // Skip offers export als orders al rate limited zijn
      result.offersExport = {
        status: 'skipped',
        message: 'Overgeslagen vanwege rate limit op orders API',
      }
    }

    // Probeer ook een lijst van offers op te halen (als beschikbaar via andere endpoint)
    // Note: De Offers API werkt voornamelijk met individuele offer IDs
    // Voor een volledige lijst moet je de export file gebruiken

    return NextResponse.json({
      success: true,
      data: result,
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

