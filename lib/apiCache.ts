/**
 * API Response Cache
 * Caches API responses to minimize API calls and prevent rate limiting
 * Uses both in-memory and persistent cache
 */

import { getPersistentCache, setPersistentCache } from './persistentCache'
import { getOptimalCacheTTL } from './rateLimits'

interface CachedResponse {
  data: any
  timestamp: number
  ttl: number // Time to live in milliseconds
}

const cache = new Map<string, CachedResponse>()

// Default TTL per endpoint type (in milliseconds)
// Deze worden gebruikt als fallback als rate limit info niet beschikbaar is
const DEFAULT_TTL: Record<string, number> = {
  orders: 5 * 60 * 1000,        // 5 minutes for orders
  shipments: 10 * 60 * 1000,   // 10 minutes for shipments
  returns: 10 * 60 * 1000,     // 10 minutes for returns
  invoices: 60 * 60 * 1000,    // 1 hour for invoices
  offers: 15 * 60 * 1000,      // 15 minutes for offers
  products: 30 * 60 * 1000,    // 30 minutes for products
  performance: 60 * 60 * 1000, // 1 hour for performance
  revenue: 30 * 60 * 1000,     // 30 minutes for revenue (omzet verandert niet zo vaak)
  default: 5 * 60 * 1000,      // 5 minutes default
}

/**
 * Get cache key from endpoint
 */
function getCacheKey(endpoint: string, params?: Record<string, string>): string {
  const paramString = params ? `?${new URLSearchParams(params).toString()}` : ''
  return `${endpoint}${paramString}`
}

/**
 * Get cached response if still valid
 * Checks both in-memory and persistent cache
 */
export async function getCachedResponse(
  endpoint: string,
  params?: Record<string, string>
): Promise<any | null> {
  const key = getCacheKey(endpoint, params)
  
  // Check in-memory cache first (fastest)
  const cached = cache.get(key)
  if (cached) {
    const now = Date.now()
    if (now <= cached.timestamp + cached.ttl) {
      return cached.data
    } else {
      // Expired, remove from memory
      cache.delete(key)
    }
  }

  // Check persistent cache (fallback)
  try {
    const persistentData = await getPersistentCache(endpoint, params)
    if (persistentData) {
      // Also store in memory for faster access
      const ttl = getTtlForEndpoint(endpoint)
      cache.set(key, {
        data: persistentData,
        timestamp: Date.now(),
        ttl,
      })
      return persistentData
    }
  } catch (error) {
    // If persistent cache fails, continue without it
    console.error('Persistent cache read error:', error)
  }

  return null
}

/**
 * Get TTL for endpoint
 * Uses rate limit info if available, otherwise falls back to defaults
 */
function getTtlForEndpoint(endpoint: string, method: string = 'GET'): number {
  // Try to get optimal TTL from rate limits
  const optimalTtl = getOptimalCacheTTL(endpoint, method)
  if (optimalTtl > 0) {
    return optimalTtl
  }
  
  // Fallback to pattern matching
  for (const [pattern, defaultTtl] of Object.entries(DEFAULT_TTL)) {
    if (endpoint.includes(pattern)) {
      return defaultTtl
    }
  }
  return DEFAULT_TTL.default
}

/**
 * Cache a response
 * Stores in both in-memory and persistent cache
 */
export async function setCachedResponse(
  endpoint: string,
  data: any,
  params?: Record<string, string>,
  customTtl?: number,
  method: string = 'GET'
): Promise<void> {
  const key = getCacheKey(endpoint, params)
  
  // Determine TTL based on endpoint and rate limits
  let ttl = customTtl
  if (!ttl) {
    ttl = getTtlForEndpoint(endpoint, method)
  }

  // Store in memory cache
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  })

  // Also store in persistent cache
  try {
    await setPersistentCache(endpoint, data, params, ttl)
  } catch (error) {
    // If persistent cache fails, continue with memory cache only
    console.error('Persistent cache write error:', error)
  }
}

/**
 * Clear cache for specific endpoint or all cache
 */
export async function clearCache(endpoint?: string): Promise<void> {
  if (endpoint) {
    // Clear all entries matching endpoint pattern
    const keys = Array.from(cache.keys())
    for (const key of keys) {
      if (key.startsWith(endpoint)) {
        cache.delete(key)
      }
    }
    // Also clear persistent cache
    const { clearPersistentCache } = await import('./persistentCache')
    await clearPersistentCache(endpoint)
  } else {
    // Clear all cache
    cache.clear()
    const { clearPersistentCache } = await import('./persistentCache')
    await clearPersistentCache()
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  }
}

