import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

// Mark this route as server-side only (no edge runtime)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST: Scrape bol.com product informatie inclusief verkoopdata
 */
export async function POST(request: NextRequest) {
  console.log('[BOL Scraper] Request received')
  
  try {
    const body = await request.json()
    const { url } = body

    console.log('[BOL Scraper] URL:', url)

    if (!url) {
      console.log('[BOL Scraper] Error: No URL provided')
      return NextResponse.json(
        { error: 'bol.com URL is verplicht' },
        { status: 400 }
      )
    }

    // Valideer dat het een bol.com URL is
    if (!url.includes('bol.com') || !url.includes('/p/')) {
      console.log('[BOL Scraper] Error: Invalid URL format')
      return NextResponse.json(
        { error: 'Ongeldige bol.com URL. Gebruik een product pagina URL (bijv. https://www.bol.com/nl/nl/p/...)' },
        { status: 400 }
      )
    }

    // Extract product ID from URL
    const productIdMatch = url.match(/\/p\/([^\/]+)/)
    const productId = productIdMatch ? productIdMatch[1] : null

    console.log('[BOL Scraper] Product ID:', productId)

    if (!productId) {
      console.log('[BOL Scraper] Error: Could not extract product ID')
      return NextResponse.json(
        { error: 'Kon geen product ID vinden in de URL' },
        { status: 400 }
      )
    }

    // Use Playwright with better stealth capabilities (like Boloo does)
    console.log('[BOL Scraper] Launching Playwright browser...')
    
    let browser: any = null
    let context: any = null
    
    try {
      // Clean URL - remove tracking parameters
      const cleanUrl = url.split('?')[0]
      console.log('[BOL Scraper] Clean URL:', cleanUrl)
      
      // Launch browser with stealth mode
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
        ],
      })

      console.log('[BOL Scraper] Browser launched successfully')

      // Create context with realistic settings
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'nl-NL',
        timezoneId: 'Europe/Amsterdam',
        permissions: ['geolocation'],
        geolocation: { latitude: 52.3676, longitude: 4.9041 }, // Amsterdam
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      })

      const page = await context.newPage()
      console.log('[BOL Scraper] New page created')
      
      // Add stealth scripts
      await page.addInitScript(() => {
        // Override webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        })
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        })
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['nl-NL', 'nl', 'en-US', 'en'],
        })
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission } as PermissionStatus) :
            originalQuery(parameters)
        )
      })
      
      console.log('[BOL Scraper] Stealth scripts injected')
      
      // Set cookies first (visit homepage to get cookies)
      console.log('[BOL Scraper] Getting cookies from homepage...')
      try {
        await page.goto('https://www.bol.com', {
          waitUntil: 'networkidle',
          timeout: 15000,
        })
        await page.waitForTimeout(2000)
        console.log('[BOL Scraper] Homepage visited, cookies set')
      } catch (e) {
        console.log('[BOL Scraper] Could not visit homepage, continuing anyway')
      }

      // Navigate to the page with realistic timing
      console.log('[BOL Scraper] Navigating to:', cleanUrl)
      
      // Simulate human-like behavior: scroll and move mouse
      await page.goto(cleanUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      console.log('[BOL Scraper] Page loaded (networkidle)')
      
      // Wait a bit
      await page.waitForTimeout(2000)
      
      // Simulate human scrolling behavior
      console.log('[BOL Scraper] Simulating human behavior...')
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 500)
      })
      await page.waitForTimeout(500)
      
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 1000)
      })
      await page.waitForTimeout(500)
      
      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(1000)
      
      console.log('[BOL Scraper] Human behavior simulation complete')

      // Check if we got blocked
      const pageContent = await page.content()
      console.log('[BOL Scraper] Page content length:', pageContent.length)
      console.log('[BOL Scraper] Page title:', await page.title())
      
      if (pageContent.includes('IP address') && pageContent.includes('blocked')) {
        console.log('[BOL Scraper] ERROR: IP blocked by bol.com')
        await browser.close()
        return NextResponse.json(
          {
            error: 'bol.com heeft het IP-adres geblokkeerd',
            message: 'bol.com detecteert automatische scraping en blokkeert het verzoek.',
            suggestion: 'Dit kan worden veroorzaakt door bot detection. Probeer het later opnieuw.',
          },
          { status: 403 }
        )
      }

      // Wait for product content to load
      console.log('[BOL Scraper] Waiting for product selectors...')
      try {
        await page.waitForSelector('h1, [data-test="product-title"], .product-title', { timeout: 5000 })
        console.log('[BOL Scraper] Product selector found')
      } catch (e) {
        console.log('[BOL Scraper] Product selector not found, continuing anyway')
        // Continue even if selector not found
      }

      // Get the final HTML after JavaScript execution
      console.log('[BOL Scraper] Getting final HTML...')
      const html = await page.content()
      console.log('[BOL Scraper] HTML length:', html.length)

      // Check if we got a valid product page
      if (!html.includes('product') && !html.toLowerCase().includes('bol.com')) {
        console.log('[BOL Scraper] ERROR: Not a valid product page')
        await browser.close()
        return NextResponse.json(
          {
            error: 'Geen product pagina gevonden',
            message: 'De opgehaalde pagina lijkt geen product pagina te zijn.',
            suggestion: 'Controleer of de URL correct is.',
          },
          { status: 404 }
        )
      }

      // Try to extract data from page context (JavaScript variables)
      console.log('[BOL Scraper] Extracting page data...')
      let pageData: any = null
      try {
        pageData = await page.evaluate(() => {
          // Try to find product data in window objects
          const win: any = window
          return {
            productData: win.__INITIAL_STATE__ || win.__NEXT_DATA__ || win.productData || null,
            jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
              (script: any) => {
                try {
                  return JSON.parse(script.textContent)
                } catch {
                  return null
                }
              }
            ).filter(Boolean),
          }
        })
        console.log('[BOL Scraper] Page data extracted:', pageData ? 'Found' : 'Not found')
      } catch (e) {
        console.log('[BOL Scraper] Error extracting page data:', e)
        // Ignore errors in page evaluation
      }

      console.log('[BOL Scraper] Closing browser...')
      await context.close()
      await browser.close()
      browser = null
      console.log('[BOL Scraper] Browser closed')

      // Parse HTML om product informatie en verkoopdata te extraheren
      console.log('[BOL Scraper] Parsing product data...')
      const productInfo = parseBolProduct(html, cleanUrl, productId, pageData)
      console.log('[BOL Scraper] Product info parsed:', {
        title: productInfo.title ? 'Found' : 'Not found',
        price: productInfo.price ? 'Found' : 'Not found',
        salesCount: productInfo.salesIndicators.salesCount,
      })

      console.log('[BOL Scraper] Returning success response')
      return NextResponse.json({
        success: true,
        data: productInfo,
      })
    } catch (error: any) {
      console.error('[BOL Scraper] ERROR:', error)
      console.error('[BOL Scraper] Error stack:', error.stack)
      
      if (context) {
        try {
          await context.close()
        } catch (e) {
          // Ignore
        }
      }
      if (browser) {
        console.log('[BOL Scraper] Closing browser due to error...')
        try {
          await browser.close()
        } catch (closeError) {
          console.error('[BOL Scraper] Error closing browser:', closeError)
        }
      }
      
      return NextResponse.json(
        {
          error: 'Kon bol.com pagina niet ophalen',
          message: error.message,
          suggestion: 'Er is een fout opgetreden bij het ophalen van de pagina. Probeer het opnieuw.',
          debug: process.env.NODE_ENV === 'development' ? {
            errorType: error.constructor.name,
            errorMessage: error.message,
            errorStack: error.stack,
          } : undefined,
        },
        { status: 500 }
      )
    }
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

/**
 * Parse bol.com product HTML en extraheer product informatie + verkoopdata
 */
function parseBolProduct(html: string, url: string, productId: string, pageData?: any) {
  const productInfo: any = {
    productId,
    url,
    title: null,
    price: null,
    originalPrice: null,
    currency: 'EUR',
    availability: null,
    rating: null,
    reviewCount: null,
    images: [],
    description: null,
    brand: null,
    ean: null,
    // Verkoopdata
    salesIndicators: {
      isBestseller: false,
      salesText: null,
      salesCount: null,
      salesRank: null,
      categoryRank: null,
      salesHistory: null,
    },
    scrapedAt: new Date().toISOString(),
  }

  try {
    // Extract title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>(.*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*data-test="product-title"[^>]*>(.*?)<\/h1>/i) ||
                      html.match(/<title>(.*?)<\/title>/i)
    if (titleMatch) {
      productInfo.title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
    }

    // Extract price
    const priceMatch = html.match(/€\s*([\d,]+\.?\d*)/) ||
                      html.match(/data-price="([^"]+)"/) ||
                      html.match(/"price":\s*"([^"]+)"/)
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(',', '.')
      productInfo.price = parseFloat(priceStr)
    }

    // Extract rating
    const ratingMatch = html.match(/"rating":\s*([\d.]+)/) ||
                       html.match(/rating[^>]*>([\d.]+)/i) ||
                       html.match(/data-rating="([^"]+)"/)
    if (ratingMatch) {
      productInfo.rating = parseFloat(ratingMatch[1])
    }

    // Extract review count
    const reviewMatch = html.match(/"reviewCount":\s*(\d+)/) ||
                       html.match(/(\d+)\s*reviews?/i) ||
                       html.match(/(\d+)\s*beoordelingen?/i)
    if (reviewMatch) {
      productInfo.reviewCount = parseInt(reviewMatch[1])
    }

    // Extract EAN
    const eanMatch = html.match(/"ean":\s*"([^"]+)"/) ||
                    html.match(/EAN[^>]*>([\d]+)/i) ||
                    html.match(/data-ean="([^"]+)"/)
    if (eanMatch) {
      productInfo.ean = eanMatch[1]
    }

    // Extract images
    const imageRegexes = [
      /<img[^>]*src="([^"]+)"[^>]*data-test="product-image"/gi,
      /<img[^>]*data-src="([^"]+)"[^>]*class="[^"]*product-image/gi,
      /"imageUrl":\s*"([^"]+)"/g,
    ]
    const images: string[] = []
    imageRegexes.forEach((regex) => {
      let match: RegExpExecArray | null
      while ((match = regex.exec(html)) !== null) {
        if (match[1] && !match[1].includes('placeholder') && !match[1].includes('logo')) {
          images.push(match[1])
        }
      }
    })
    productInfo.images = images.slice(0, 10) // Max 10 images

    // Extract verkoopindicatoren - meerdere methoden proberen
    
    // Method 1: Bestseller badge
    const bestsellerMatch = html.match(/bestseller/i) ||
                           html.match(/best[^>]*seller/i) ||
                           html.match(/data-test="bestseller"/i) ||
                           html.match(/class="[^"]*bestseller[^"]*"/i) ||
                           html.match(/"isBestseller":\s*true/i)
    productInfo.salesIndicators.isBestseller = !!bestsellerMatch

    // Method 2: Sales text (bijv. "X keer verkocht", "X verkopen deze week")
    const salesTextPatterns = [
      /(\d+)\s*(?:keer\s*)?verkocht/i,
      /(\d+)\s*verkopen/i,
      /verkocht[^>]*>(\d+)/i,
      /"salesCount":\s*(\d+)/,
      /"sales":\s*(\d+)/,
      /sales[^>]*>(\d+)/i,
      /(\d+)\s*(?:x|keer)\s*verkocht/i,
      /verkocht[^>]*(\d+)/i,
    ]
    
    for (const pattern of salesTextPatterns) {
      const match = html.match(pattern)
      if (match) {
        const count = parseInt(match[1] || match[0].match(/\d+/)?.[0] || '0')
        if (count > 0) {
          productInfo.salesIndicators.salesCount = count
          productInfo.salesIndicators.salesText = match[0]
          break
        }
      }
    }

    // Method 3: Sales rank
    const rankPatterns = [
      /"salesRank":\s*(\d+)/,
      /"rank":\s*(\d+)/,
      /rank[^>]*>#(\d+)/i,
      /rang[^>]*>(\d+)/i,
      /sales[^>]*rank[^>]*>(\d+)/i,
      /"position":\s*(\d+)/,
    ]
    
    for (const pattern of rankPatterns) {
      const match = html.match(pattern)
      if (match) {
        const rank = parseInt(match[1])
        if (rank > 0) {
          productInfo.salesIndicators.salesRank = rank
          break
        }
      }
    }

    // Method 4: Category rank
    const categoryRankPatterns = [
      /"categoryRank":\s*(\d+)/,
      /categorie[^>]*rang[^>]*>(\d+)/i,
      /"categoryPosition":\s*(\d+)/,
    ]
    
    for (const pattern of categoryRankPatterns) {
      const match = html.match(pattern)
      if (match) {
        const rank = parseInt(match[1])
        if (rank > 0) {
          productInfo.salesIndicators.categoryRank = rank
          break
        }
      }
    }

    // Try to extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is)
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1])
        if (Array.isArray(jsonLd)) {
          const productData = jsonLd.find((item: any) => item['@type'] === 'Product')
          if (productData) {
            if (!productInfo.title && productData.name) {
              productInfo.title = productData.name
            }
            if (!productInfo.rating && productData.aggregateRating?.ratingValue) {
              productInfo.rating = parseFloat(productData.aggregateRating.ratingValue)
            }
            if (!productInfo.reviewCount && productData.aggregateRating?.reviewCount) {
              productInfo.reviewCount = parseInt(productData.aggregateRating.reviewCount)
            }
            if (!productInfo.ean && productData.gtin13) {
              productInfo.ean = productData.gtin13
            }
            if (!productInfo.brand && productData.brand?.name) {
              productInfo.brand = productData.brand.name
            }
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Try to extract from pageData (from Puppeteer page.evaluate)
    if (pageData) {
      try {
        const productData = pageData.productData?.product || 
                           pageData.productData?.data?.product ||
                           pageData.productData?.productData ||
                           pageData.productData
        
        if (productData) {
          if (!productInfo.title && productData.title) {
            productInfo.title = productData.title
          }
          if (!productInfo.price && productData.price) {
            productInfo.price = parseFloat(productData.price)
          }
          if (!productInfo.rating && productData.rating) {
            productInfo.rating = parseFloat(productData.rating)
          }
          if (!productInfo.reviewCount && productData.reviewCount) {
            productInfo.reviewCount = parseInt(productData.reviewCount)
          }
          if (!productInfo.salesIndicators.salesCount && productData.salesCount) {
            productInfo.salesIndicators.salesCount = parseInt(productData.salesCount)
          }
          if (!productInfo.salesIndicators.salesRank && productData.salesRank) {
            productInfo.salesIndicators.salesRank = parseInt(productData.salesRank)
          }
          if (!productInfo.ean && productData.ean) {
            productInfo.ean = productData.ean
          }
        }

        // Also check JSON-LD from pageData
        if (pageData.jsonLd && Array.isArray(pageData.jsonLd)) {
          const productJsonLd = pageData.jsonLd.find((item: any) => item['@type'] === 'Product')
          if (productJsonLd) {
            if (!productInfo.title && productJsonLd.name) {
              productInfo.title = productJsonLd.name
            }
            if (!productInfo.rating && productJsonLd.aggregateRating?.ratingValue) {
              productInfo.rating = parseFloat(productJsonLd.aggregateRating.ratingValue)
            }
            if (!productInfo.reviewCount && productJsonLd.aggregateRating?.reviewCount) {
              productInfo.reviewCount = parseInt(productJsonLd.aggregateRating.reviewCount)
            }
            if (!productInfo.ean && productJsonLd.gtin13) {
              productInfo.ean = productJsonLd.gtin13
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Try to extract from window.__INITIAL_STATE__ or similar (fallback)
    const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s)
    if (initialStateMatch && !pageData) {
      try {
        const initialState = JSON.parse(initialStateMatch[1])
        // Navigate through the state to find product data
        // This structure can vary, so we try common paths
        const productData = initialState?.product || initialState?.productData || initialState?.data?.product
        if (productData) {
          if (!productInfo.title && productData.title) {
            productInfo.title = productData.title
          }
          if (!productInfo.price && productData.price) {
            productInfo.price = parseFloat(productData.price)
          }
          if (!productInfo.rating && productData.rating) {
            productInfo.rating = parseFloat(productData.rating)
          }
          if (!productInfo.reviewCount && productData.reviewCount) {
            productInfo.reviewCount = parseInt(productData.reviewCount)
          }
          if (!productInfo.salesIndicators.salesCount && productData.salesCount) {
            productInfo.salesIndicators.salesCount = parseInt(productData.salesCount)
          }
          if (!productInfo.salesIndicators.salesRank && productData.salesRank) {
            productInfo.salesIndicators.salesRank = parseInt(productData.salesRank)
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

  } catch (error: any) {
    console.error('Error parsing bol.com product:', error)
  }

  return productInfo
}

