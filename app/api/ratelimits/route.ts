import { NextRequest, NextResponse } from 'next/server'
import { getRateLimitForEndpoint, getRateLimitInfo, getOptimalCacheTTL, getSafeRequestInterval } from '@/lib/rateLimits'

/**
 * GET: Get rate limit information for an endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const method = searchParams.get('method') || 'GET'

    if (!endpoint) {
      return NextResponse.json({
        error: 'Missing endpoint parameter',
        message: 'Provide ?endpoint=/retailer/orders',
      }, { status: 400 })
    }

    const rateLimit = getRateLimitForEndpoint(endpoint, method)
    
    if (!rateLimit) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit info not found for this endpoint',
        endpoint,
        method,
      })
    }

    const optimalTtl = getOptimalCacheTTL(endpoint, method)
    const safeInterval = getSafeRequestInterval(endpoint, method)
    const info = getRateLimitInfo(endpoint, method)

    return NextResponse.json({
      success: true,
      data: {
        rateLimit,
        optimalCacheTTL: optimalTtl,
        optimalCacheTTLMinutes: Math.round(optimalTtl / (60 * 1000) * 10) / 10,
        safeRequestInterval: safeInterval,
        safeRequestIntervalSeconds: Math.round(safeInterval / 1000 * 10) / 10,
        info,
      },
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

