import { NextRequest, NextResponse } from 'next/server'
import { clearCachedToken } from '@/lib/tokenCache'
import { clearCache, getCacheStats } from '@/lib/apiCache'
import { getPersistentCacheStats } from '@/lib/persistentCache'

/**
 * Optimization endpoint
 * - Clear token cache (force refresh)
 * - Clear API response cache
 * - Get cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'clear-token') {
      clearCachedToken()
      return NextResponse.json({
        success: true,
        message: 'Token cache cleared',
      })
    }

    if (action === 'clear-cache') {
      const endpoint = searchParams.get('endpoint')
      await clearCache(endpoint || undefined)
      return NextResponse.json({
        success: true,
        message: endpoint ? `Cache cleared for ${endpoint}` : 'All cache cleared',
      })
    }

    if (action === 'stats') {
      const memoryStats = getCacheStats()
      const persistentStats = await getPersistentCacheStats()
      return NextResponse.json({
        success: true,
        data: {
          memory: memoryStats,
          persistent: persistentStats,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Use ?action=clear-token, clear-cache, or stats',
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

