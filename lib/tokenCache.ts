/**
 * Token cache voor OAuth 2.0 access tokens
 * Voorkomt onnodige token requests en expired tokens
 */

interface CachedToken {
  accessToken: string
  expiresAt: number
  expiresIn: number
}

let tokenCache: CachedToken | null = null

/**
 * Get cached token if still valid, otherwise return null
 */
export function getCachedToken(): string | null {
  if (!tokenCache) {
    return null
  }

  // Check if token is still valid (with 10 minute buffer to prevent expiration during requests)
  const now = Date.now()
  const buffer = 10 * 60 * 1000 // 10 minutes buffer - ruim voor expiration

  // If token is expired or about to expire, clear it
  if (now >= tokenCache.expiresAt - buffer) {
    console.log('[TokenCache] Token expired or about to expire, clearing cache')
    tokenCache = null
    return null
  }

  // Additional safety check: if token is more than 1 hour old, don't use it
  // Calculate when token was issued
  const tokenIssuedAt = tokenCache.expiresAt - (tokenCache.expiresIn * 1000)
  const tokenAge = now - tokenIssuedAt
  const maxTokenAge = 3600 * 1000 // 1 hour in milliseconds
  
  if (tokenAge > maxTokenAge) {
    console.log('[TokenCache] Token is too old, clearing cache')
    tokenCache = null
    return null
  }

  // Final check: ensure expiresAt is in the future
  if (tokenCache.expiresAt <= now) {
    console.log('[TokenCache] Token expiresAt is in the past, clearing cache')
    tokenCache = null
    return null
  }

  return tokenCache.accessToken
}

/**
 * Cache a new token
 */
export function setCachedToken(accessToken: string, expiresIn: number) {
  const now = Date.now()
  const expiresAt = now + (expiresIn * 1000) // Convert to milliseconds

  tokenCache = {
    accessToken,
    expiresAt,
    expiresIn,
  }
}

/**
 * Clear cached token (for logout or errors)
 */
export function clearCachedToken() {
  console.log('[TokenCache] Clearing token cache')
  tokenCache = null
}

/**
 * Validate and clean token cache - removes expired tokens
 */
export function validateTokenCache(): boolean {
  if (!tokenCache) {
    return false
  }

  const now = Date.now()
  
  // Check if token is expired
  if (now >= tokenCache.expiresAt) {
    console.log('[TokenCache] Token expired, clearing cache')
    tokenCache = null
    return false
  }

  // Check if token is about to expire (within 10 minutes)
  const buffer = 10 * 60 * 1000 // 10 minutes
  if (now >= tokenCache.expiresAt - buffer) {
    console.log('[TokenCache] Token about to expire, clearing cache')
    tokenCache = null
    return false
  }

  return true
}

