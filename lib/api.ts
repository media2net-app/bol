/**
 * Bol.com Retailer API utility functions
 * Handles OAuth 2.0 authentication and API calls
 * Includes token caching and rate limit optimization
 */

import { getCachedToken, setCachedToken, clearCachedToken, validateTokenCache } from './tokenCache'
import { getCachedResponse, setCachedResponse } from './apiCache'
import { getRateLimitInfo } from './rateLimits'

// Bol.com Retailer API endpoints
// Production: https://api.bol.com
// Demo: https://api.bol.com (use demo credentials)
const BOL_API_BASE = 'https://api.bol.com'
const BOL_TOKEN_URL = 'https://login.bol.com/token'

// Server-side only - these functions should only be called from API routes
export function getApiCredentials() {
  // Check environment variables first (production/development)
  const envKey = process.env.API_KEY
  const envSecret = process.env.API_SECRET

  if (envKey && envSecret) {
    return {
      clientId: envKey,
      clientSecret: envSecret,
    }
  }

  // Fallback: check if credentials were set via settings API
  // (This is handled in the settings route by setting process.env)
  return {
    clientId: process.env.API_KEY,
    clientSecret: process.env.API_SECRET,
  }
}

/**
 * Get OAuth 2.0 access token from bol.com
 * Uses caching to minimize API calls
 */
export async function getAccessToken(): Promise<string> {
  // Validate cache first (removes expired tokens)
  validateTokenCache()
  
  // Check if we have a valid cached token
  const cachedToken = getCachedToken()
  if (cachedToken) {
    console.log('[API] Using cached token')
    return cachedToken
  }
  
  console.log('[API] No valid cached token, fetching new token...')

  const { clientId, clientSecret } = getApiCredentials()

  if (!clientId || !clientSecret) {
    // Clear any stale cache if credentials are missing
    clearCachedToken()
    throw new Error('API credentials not configured. Ga naar Instellingen om je API credentials in te voeren.')
  }

  // OAuth 2.0 client credentials flow
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const response = await fetch(BOL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      // Clear cache on error
      clearCachedToken()
      const errorText = await response.text()
      let errorMessage = `Failed to get access token: ${response.status} ${errorText}`
      
      // Provide helpful error messages
      if (response.status === 401) {
        errorMessage = `Ongeldige API credentials. Controleer je Client ID en Client Secret in Instellingen.`
      } else if (response.status === 400) {
        errorMessage = `Ongeldige token request. Controleer je API credentials.`
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    if (!data.access_token || typeof data.access_token !== 'string') {
      clearCachedToken()
      throw new Error('No access token in response from bol.com API')
    }
    
    // Cache the token with expiration
    // Bol.com tokens zijn meestal 1 uur geldig, maar we gebruiken een conservatieve schatting
    const expiresIn = data.expires_in || 3600 // Default to 1 hour if not provided
    
    // Validate expires_in is reasonable (between 300 and 7200 seconds)
    const validExpiresIn = Math.max(300, Math.min(7200, expiresIn))
    
    // Zorg ervoor dat we de token cachen VOORDAT we hem returnen
    setCachedToken(data.access_token, validExpiresIn)

    return data.access_token
  } catch (error: any) {
    // Clear cache on any error
    clearCachedToken()
    
    // Provide more detailed error messages
    if (error.message && error.message.includes('API credentials')) {
      throw error
    }
    
    // Check for network errors
    if (error.message && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND'))) {
      throw new Error(`Network error: Kan geen verbinding maken met bol.com. Controleer je internetverbinding. (${error.message})`)
    }
    
    // Re-throw with more context
    throw new Error(`Token fetch error: ${error.message}`)
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  retryAfter: number
  status: number

  constructor(message: string, retryAfter: number, status: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
    this.status = status
  }
}

/**
 * Make an authenticated API call to bol.com Retailer API
 * Handles rate limiting (429 errors) gracefully
 * Uses caching to minimize API calls
 */
export async function makeBolApiRequest(
  endpoint: string,
  options: RequestInit = {},
  useCache: boolean = true
) {
  // Check cache first (only for GET requests)
  if (useCache && (!options.method || options.method === 'GET')) {
    const urlParams = new URLSearchParams(endpoint.split('?')[1] || '')
    const params: Record<string, string> = {}
    urlParams.forEach((value, key) => {
      params[key] = value
    })
    const endpointPath = endpoint.split('?')[0]
    
    const cached = await getCachedResponse(endpointPath, Object.keys(params).length > 0 ? params : undefined)
    if (cached !== null) {
      return cached
    }
  }

  // Always get a fresh token (cache will handle expiration)
  // This ensures we never use an expired token
  const accessToken = await getAccessToken()

  const url = `${BOL_API_BASE}${endpoint}`
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.retailer.v10+json',
    'Content-Type': 'application/vnd.retailer.v10+json',
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    // Handle expired token (401)
    if (response.status === 401) {
      console.log('[API] 401 error detected, clearing token cache and refreshing...')
      
      // Clear cached token immediately - force fresh token
      clearCachedToken()
      
      // Wait a moment to ensure token is cleared from memory
      await new Promise(resolve => setTimeout(resolve, 500))
      
      try {
        // Get fresh token (this will fetch a new one since cache is cleared)
        console.log('[API] Fetching new access token...')
        const newAccessToken = await getAccessToken()
        
        // Verify we got a valid token
        if (!newAccessToken || newAccessToken.length === 0) {
          throw new Error('Failed to get new access token after 401 error')
        }
        
        console.log('[API] New token obtained, retrying request...')
        
        // Retry the request with fresh token
        const retryHeaders = {
          'Authorization': `Bearer ${newAccessToken}`,
          'Accept': 'application/vnd.retailer.v10+json',
          'Content-Type': 'application/vnd.retailer.v10+json',
          ...options.headers,
        }

        const retryResponse = await fetch(url, {
          ...options,
          headers: retryHeaders,
        })

        if (!retryResponse.ok) {
          // If retry also fails, check if it's still a 401 (token issue)
          if (retryResponse.status === 401) {
            // Clear cache again and throw error - credentials might be invalid
            clearCachedToken()
            const errorText = await retryResponse.text()
            let errorMessage = `Token refresh failed: ${retryResponse.status} ${errorText}`
            
            // Parse error for better message
            try {
              const errorJson = JSON.parse(errorText)
              if (errorJson.detail) {
                errorMessage = `Token refresh failed: ${errorJson.detail}. Controleer of je API credentials correct zijn.`
              }
            } catch (e) {
              // Keep original message
            }
            
            throw new Error(errorMessage)
          }
          
          // Other error
          const errorText = await retryResponse.text()
          throw new Error(`API request failed after token refresh: ${retryResponse.status} ${errorText}`)
        }

        const retryData = await retryResponse.json()
        
        // Cache successful retry
        if (useCache && (!options.method || options.method === 'GET')) {
          const urlParams = new URLSearchParams(endpoint.split('?')[1] || '')
          const params: Record<string, string> = {}
          urlParams.forEach((value, key) => {
            params[key] = value
          })
          const endpointPath = endpoint.split('?')[0]
          const method = options.method || 'GET'
          await setCachedResponse(endpointPath, retryData, Object.keys(params).length > 0 ? params : undefined, undefined, method)
        }

        return retryData
      } catch (tokenError: any) {
        // If token fetch fails, clear cache and throw error
        clearCachedToken()
        throw new Error(`Failed to refresh token: ${tokenError.message}`)
      }
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      let retryAfter = 0
      const retryAfterHeader = response.headers.get('Retry-After')
      
      if (retryAfterHeader) {
        retryAfter = parseInt(retryAfterHeader, 10)
      } else {
        // Try to parse from response body
        try {
          const errorBody = await response.json()
          if (errorBody.detail) {
            // Extract seconds from message like "Too many requests, retry in 1470 seconds."
            const match = errorBody.detail.match(/retry in (\d+) seconds/i)
            if (match) {
              retryAfter = parseInt(match[1], 10)
            }
          }
        } catch {
          // If parsing fails, default to 60 seconds
          retryAfter = 60
        }
      }

      const errorMessage = `Rate limit bereikt. Probeer opnieuw over ${Math.ceil(retryAfter / 60)} minuten (${retryAfter} seconden).`
      throw new RateLimitError(errorMessage, retryAfter, 429)
    }

    // Handle other errors
    let errorText = ''
    try {
      const errorBody = await response.json()
      errorText = JSON.stringify(errorBody)
    } catch {
      errorText = await response.text()
    }
    
    throw new Error(`API request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // Cache successful GET responses
  if (useCache && (!options.method || options.method === 'GET')) {
    const urlParams = new URLSearchParams(endpoint.split('?')[1] || '')
    const params: Record<string, string> = {}
    urlParams.forEach((value, key) => {
      params[key] = value
    })
    const endpointPath = endpoint.split('?')[0]
    const method = options.method || 'GET'
    await setCachedResponse(endpointPath, data, Object.keys(params).length > 0 ? params : undefined, undefined, method)
  }

  return data
}

/**
 * Get process status for asynchronous operations
 */
export async function getProcessStatus(processStatusId: string) {
  return makeBolApiRequest(`/retailer/process-status/${processStatusId}`)
}

/**
 * Get offer by offer ID
 */
export async function getOffer(offerId: string) {
  return makeBolApiRequest(`/retailer/offers/${offerId}`)
}

/**
 * Get offer export file by export ID
 */
export async function getOfferExport(exportId: string) {
  return makeBolApiRequest(`/retailer/offers/export/${exportId}`)
}

