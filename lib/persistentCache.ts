/**
 * Persistent Cache
 * Slaat cache data op in bestandssysteem voor persistentie tussen server restarts
 */

import { promises as fs } from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'api-cache.json')

interface PersistentCacheEntry {
  data: any
  timestamp: number
  ttl: number
  endpoint: string
  params?: Record<string, string>
}

let memoryCache: Map<string, PersistentCacheEntry> = new Map()

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create cache directory:', error)
  }
}

/**
 * Load cache from disk
 */
export async function loadPersistentCache(): Promise<void> {
  try {
    await ensureCacheDir()
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache = JSON.parse(data)
    
    // Load into memory
    memoryCache = new Map(Object.entries(cache))
    
    // Clean expired entries
    const now = Date.now()
    const entries = Array.from(memoryCache.entries())
    for (const [key, entry] of entries) {
      if (now > entry.timestamp + entry.ttl) {
        memoryCache.delete(key)
      }
    }
    
    // Save cleaned cache
    await savePersistentCache()
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load persistent cache:', error)
    }
    // Cache file doesn't exist yet, that's okay
    memoryCache = new Map()
  }
}

/**
 * Save cache to disk
 */
async function savePersistentCache(): Promise<void> {
  try {
    await ensureCacheDir()
    const cacheObj = Object.fromEntries(memoryCache)
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheObj, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save persistent cache:', error)
  }
}

/**
 * Get cache key from endpoint and params
 */
function getCacheKey(endpoint: string, params?: Record<string, string>): string {
  const paramString = params ? `?${new URLSearchParams(params).toString()}` : ''
  return `${endpoint}${paramString}`
}

/**
 * Get cached data if still valid
 */
export async function getPersistentCache(
  endpoint: string,
  params?: Record<string, string>
): Promise<any | null> {
  // Load cache if not already loaded
  if (memoryCache.size === 0) {
    await loadPersistentCache()
  }

  const key = getCacheKey(endpoint, params)
  const cached = memoryCache.get(key)

  if (!cached) {
    return null
  }

  const now = Date.now()
  if (now > cached.timestamp + cached.ttl) {
    // Expired, remove it
    memoryCache.delete(key)
    await savePersistentCache()
    return null
  }

  return cached.data
}

/**
 * Set cached data
 */
export async function setPersistentCache(
  endpoint: string,
  data: any,
  params?: Record<string, string>,
  ttl?: number
): Promise<void> {
  // Load cache if not already loaded
  if (memoryCache.size === 0) {
    await loadPersistentCache()
  }

  const key = getCacheKey(endpoint, params)
  const defaultTtl = 5 * 60 * 1000 // 5 minutes default

  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttl || defaultTtl,
    endpoint,
    params,
  })

  await savePersistentCache()
}

/**
 * Clear cache for specific endpoint or all
 */
export async function clearPersistentCache(endpoint?: string): Promise<void> {
  if (endpoint) {
    // Clear matching entries
    const entries = Array.from(memoryCache.entries())
    for (const [key, entry] of entries) {
      if (entry.endpoint.includes(endpoint)) {
        memoryCache.delete(key)
      }
    }
  } else {
    // Clear all
    memoryCache.clear()
  }

  await savePersistentCache()
}

/**
 * Get cache statistics
 */
export async function getPersistentCacheStats(): Promise<{
  size: number
  keys: string[]
  entries: Array<{ key: string; age: number; ttl: number }>
}> {
  if (memoryCache.size === 0) {
    await loadPersistentCache()
  }

  const now = Date.now()
  const cacheEntries = Array.from(memoryCache.entries())
  const entries = cacheEntries.map(([key, entry]) => ({
    key,
    age: now - entry.timestamp,
    ttl: entry.ttl,
  }))

  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
    entries,
  }
}

// Load cache on module load
if (typeof window === 'undefined') {
  // Server-side only
  loadPersistentCache().catch(console.error)
}

