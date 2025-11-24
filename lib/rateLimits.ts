/**
 * Bol.com API Rate Limits
 * Gebaseerd op: https://api.bol.com/retailer/public/ratelimits
 * 
 * Deze informatie wordt gebruikt om:
 * - Cache TTL te optimaliseren
 * - API call frequentie te bepalen
 * - Rate limit errors te voorkomen
 */

interface RateLimit {
  path: string
  methods: string
  maxCapacity: number
  timeToLive: number
  timeUnit: 'SECONDS' | 'MINUTES' | 'HOURS'
}

/**
 * Rate limits per endpoint (van https://api.bol.com/retailer/public/ratelimits)
 */
export const RATE_LIMITS: RateLimit[] = [
  // Orders
  {
    path: '/retailer/orders',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  {
    path: '/retailer/orders/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  
  // Shipments
  {
    path: '/retailer/shipments',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  {
    path: '/retailer/shipments',
    methods: 'POST',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/shipments/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 50,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  
  // Returns
  {
    path: '/retailer/returns',
    methods: 'GET, POST, OPTIONS, HEAD',
    maxCapacity: 20,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  {
    path: '/retailer/returns/*',
    methods: 'PUT, OPTIONS, GET, HEAD',
    maxCapacity: 20,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  
  // Offers
  {
    path: '/retailer/offers',
    methods: 'GET',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/offers',
    methods: 'POST, OPTIONS',
    maxCapacity: 50,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/offers/*',
    methods: 'GET, HEAD',
    maxCapacity: 25,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/offers/*',
    methods: 'PUT, OPTIONS, DELETE',
    maxCapacity: 50,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/offers/export',
    methods: 'POST, OPTIONS',
    maxCapacity: 9,
    timeToLive: 1,
    timeUnit: 'HOURS',
  },
  {
    path: '/retailer/offers/export/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 9,
    timeToLive: 1,
    timeUnit: 'HOURS',
  },
  
  // Invoices
  {
    path: '/retailer/invoices',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 24,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  {
    path: '/retailer/invoices/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 24,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  
  // Commissions
  {
    path: '/retailer/commissions',
    methods: 'POST, OPTIONS',
    maxCapacity: 28,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  {
    path: '/retailer/commission/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 28,
    timeToLive: 1,
    timeUnit: 'SECONDS',
  },
  
  // Inventory
  {
    path: '/retailer/inventory',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 20,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  
  // Performance
  {
    path: '/retailer/insights/performance/indicator',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 20,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  
  // Products
  {
    path: '/retailer/products/list',
    methods: 'POST, OPTIONS, HEAD',
    maxCapacity: 50,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
  {
    path: '/retailer/products/*',
    methods: 'GET, OPTIONS, HEAD',
    maxCapacity: 50,
    timeToLive: 1,
    timeUnit: 'MINUTES',
  },
]

/**
 * Get rate limit info for an endpoint
 */
export function getRateLimitForEndpoint(
  endpoint: string,
  method: string = 'GET'
): RateLimit | null {
  // Normalize endpoint
  const normalizedEndpoint = endpoint.split('?')[0] // Remove query params
  
  // Find matching rate limit
  for (const limit of RATE_LIMITS) {
    // Check if path matches
    const pathPattern = limit.path.replace(/\*/g, '[^/]+')
    const pathRegex = new RegExp(`^${pathPattern}$`)
    
    if (pathRegex.test(normalizedEndpoint)) {
      // Check if method matches
      const methods = limit.methods.split(',').map(m => m.trim())
      if (methods.includes(method) || methods.includes('*')) {
        return limit
      }
    }
  }
  
  return null
}

/**
 * Calculate optimal cache TTL based on rate limit
 * Returns TTL in milliseconds
 */
export function getOptimalCacheTTL(
  endpoint: string,
  method: string = 'GET'
): number {
  const rateLimit = getRateLimitForEndpoint(endpoint, method)
  
  if (!rateLimit) {
    // Default: 5 minutes
    return 5 * 60 * 1000
  }
  
  // Calculate TTL based on rate limit
  // We cache for 80% of the time window to be safe
  let ttlInMs = 0
  
  switch (rateLimit.timeUnit) {
    case 'SECONDS':
      ttlInMs = rateLimit.timeToLive * 1000
      break
    case 'MINUTES':
      ttlInMs = rateLimit.timeToLive * 60 * 1000
      break
    case 'HOURS':
      ttlInMs = rateLimit.timeToLive * 60 * 60 * 1000
      break
  }
  
  // Use 80% of the time window for safety margin
  return Math.floor(ttlInMs * 0.8)
}

/**
 * Calculate safe request interval based on rate limit
 * Returns interval in milliseconds
 */
export function getSafeRequestInterval(
  endpoint: string,
  method: string = 'GET'
): number {
  const rateLimit = getRateLimitForEndpoint(endpoint, method)
  
  if (!rateLimit) {
    // Default: 1 request per 5 seconds
    return 5000
  }
  
  // Calculate interval: time window / max capacity
  let timeWindowInMs = 0
  
  switch (rateLimit.timeUnit) {
    case 'SECONDS':
      timeWindowInMs = rateLimit.timeToLive * 1000
      break
    case 'MINUTES':
      timeWindowInMs = rateLimit.timeToLive * 60 * 1000
      break
    case 'HOURS':
      timeWindowInMs = rateLimit.timeToLive * 60 * 60 * 1000
      break
  }
  
  // Interval = time window / max capacity
  // Add 10% buffer for safety
  const interval = (timeWindowInMs / rateLimit.maxCapacity) * 1.1
  
  return Math.ceil(interval)
}

/**
 * Get rate limit info as human readable string
 */
export function getRateLimitInfo(
  endpoint: string,
  method: string = 'GET'
): string {
  const rateLimit = getRateLimitForEndpoint(endpoint, method)
  
  if (!rateLimit) {
    return 'Rate limit onbekend'
  }
  
  const timeUnitText = rateLimit.timeUnit === 'SECONDS' 
    ? 'seconde(n)' 
    : rateLimit.timeUnit === 'MINUTES'
    ? 'minuut/minuten'
    : 'uur/uren'
  
  return `${rateLimit.maxCapacity} requests per ${rateLimit.timeToLive} ${timeUnitText}`
}

