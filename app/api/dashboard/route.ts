import { NextRequest, NextResponse } from 'next/server'
import { makeBolApiRequest, getApiCredentials, RateLimitError } from '@/lib/api'
import { getCachedResponse } from '@/lib/apiCache'
import { getRateLimitForEndpoint, getSafeRequestInterval } from '@/lib/rateLimits'

/**
 * GET: Haal alle dashboard data op in één geoptimaliseerde call
 * Gebruikt caching en respecteert rate limits
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

    const result: any = {
      apiConnected: true,
      timestamp: new Date().toISOString(),
      credentials: {
        hasKey: !!clientId,
        hasSecret: !!clientSecret,
        keyPrefix: clientId?.substring(0, 8) + '...',
      },
    }

    // Strategie: ALLEEN 1 API call voor essentiële data
    // Gebruik change-interval-minute om alleen nieuwe/gewijzigde orders op te halen
    // Dit minimaliseert API calls en voorkomt rate limits
    
    // Check eerst cache - als we recente cached data hebben, gebruik die
    const cachedOrders = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'OPEN' })
    if (cachedOrders) {
      // Gebruik cached data - geen API call nodig!
      result.orders = {
        status: 'cached',
        data: cachedOrders,
        count: cachedOrders.orders?.length || 0,
        message: 'Gebruikt gecachte data om rate limits te voorkomen',
      }
    } else {
      // Alleen als er geen cache is, doe 1 API call
      try {
        // Gebruik change-interval-minute om alleen nieuwe/gewijzigde orders op te halen
        // Verhoogd interval om minder calls te doen
        const changeInterval = 60 // Minuten - alleen orders van laatste uur
        const ordersResponse = await makeBolApiRequest(
          `/retailer/orders?fulfilment-method=ALL&status=OPEN&change-interval-minute=${changeInterval}`,
          {},
          true // Use cache
        )

        result.orders = {
          status: 'success',
          data: ordersResponse,
          count: ordersResponse.orders?.length || 0,
        }
      } catch (error: any) {
        // Bij rate limit of andere errors, gebruik cached data als fallback
        if (error instanceof RateLimitError) {
          try {
            const cachedOrdersFallback = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'OPEN' })
            if (cachedOrdersFallback) {
              result.orders = {
                status: 'cached',
                data: cachedOrdersFallback,
                count: cachedOrdersFallback.orders?.length || 0,
                message: `Rate limit bereikt. Toont gecachte data. ${error.message}`,
              }
            } else {
              result.orders = {
                status: 'rate_limited',
                message: error.message,
                retryAfter: error.retryAfter,
              }
            }
          } catch {
            result.orders = {
              status: 'rate_limited',
              message: error.message,
              retryAfter: error.retryAfter,
            }
          }
        } else {
          // Andere error, probeer ook cached data
          try {
            const cachedOrdersFallback = await getCachedResponse('/retailer/orders', { 'fulfilment-method': 'ALL', 'status': 'OPEN' })
            if (cachedOrdersFallback) {
              result.orders = {
                status: 'cached',
                data: cachedOrdersFallback,
                count: cachedOrdersFallback.orders?.length || 0,
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
    }

    // 2. Revenue data - gebruik cached data (verandert niet zo vaak)
    // Skip API call voor revenue - gebruik alleen cached data
    // Revenue wordt apart opgehaald via /api/revenue endpoint (eigen caching)
    result.revenue = {
      status: 'cached',
      message: 'Revenue wordt apart opgehaald met eigen caching',
    }

    // 3. Offers export - ALTIJD SKIPPEN op dashboard
    // Offers export is zeer duur (9 requests per uur!) - alleen op Offers pagina
    result.offersExport = {
      status: 'skipped',
      message: 'Offers export overgeslagen op dashboard om rate limits te voorkomen. Gebruik de Offers pagina voor offers data.',
    }

    // 4. Set test results
    if (result.orders?.status === 'success' || result.orders?.status === 'cached') {
      result.testResults = {
        status: result.orders.status === 'cached' ? 'cached' : 'success',
        message: `${result.orders.status === 'cached' ? 'Gecachte data gebruikt' : 'Succesvol verbonden met bol.com API'}. ${result.orders.count || 0} openstaande orders gevonden.`,
      }
    } else if (result.orders?.status === 'rate_limited') {
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

    // 5. Rate limit info toevoegen
    const ordersRateLimit = getRateLimitForEndpoint('/retailer/orders', 'GET')
    if (ordersRateLimit) {
      result.rateLimitInfo = {
        orders: {
          maxCapacity: ordersRateLimit.maxCapacity,
          timeWindow: `${ordersRateLimit.timeToLive} ${ordersRateLimit.timeUnit}`,
          safeInterval: getSafeRequestInterval('/retailer/orders', 'GET'),
          info: `${ordersRateLimit.maxCapacity} requests per ${ordersRateLimit.timeToLive} ${ordersRateLimit.timeUnit === 'MINUTES' ? 'minuut' : ordersRateLimit.timeUnit === 'SECONDS' ? 'seconde' : 'uur'}`,
        },
      }
    }

    // 6. API call summary
    result.apiCallSummary = {
      totalCalls: cachedOrders ? 0 : 1, // 0 als cached, 1 als nieuwe call
      callsUsed: cachedOrders ? 0 : 1,
      callsRemaining: cachedOrders ? 25 : 24, // Geschat op basis van rate limit
      strategy: cachedOrders ? 'cached_only' : 'single_call',
      message: cachedOrders 
        ? 'Geen API calls gebruikt - alleen cached data'
        : '1 API call gebruikt voor orders data',
    }

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

