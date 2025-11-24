import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

// Mark this route as server-side only (no edge runtime)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST: Scrape Amazon product informatie inclusief verkoopdata
 */
export async function POST(request: NextRequest) {
  console.log('[Amazon Scraper] Request received')
  
  try {
    const body = await request.json()
    const { url } = body

    console.log('[Amazon Scraper] URL:', url)

    if (!url) {
      console.log('[Amazon Scraper] Error: No URL provided')
      return NextResponse.json(
        { error: 'Amazon URL is verplicht' },
        { status: 400 }
      )
    }

    // Valideer dat het een Amazon URL is
    if (!url.includes('amazon.') || (!url.includes('/dp/') && !url.includes('/product/'))) {
      console.log('[Amazon Scraper] Error: Invalid URL format')
      return NextResponse.json(
        { error: 'Ongeldige Amazon URL. Gebruik een product pagina URL (bijv. https://www.amazon.nl/dp/...)' },
        { status: 400 }
      )
    }

    // Extract ASIN from URL
    const asinMatch = url.match(/(?:[/dp/]|[/product/])([A-Z0-9]{10})/)
    const asin = asinMatch ? asinMatch[1] : null

    console.log('[Amazon Scraper] ASIN:', asin)

    if (!asin) {
      console.log('[Amazon Scraper] Error: Could not extract ASIN')
      return NextResponse.json(
        { error: 'Kon geen ASIN vinden in de URL' },
        { status: 400 }
      )
    }

    // Use Playwright with better stealth capabilities
    console.log('[Amazon Scraper] Launching Playwright browser...')
    
    let browser: any = null
    let context: any = null
    
    try {
      // Clean URL - remove tracking parameters
      const cleanUrl = url.split('?')[0].split('#')[0]
      console.log('[Amazon Scraper] Clean URL:', cleanUrl)
      
      // Launch browser with stealth mode
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
        ],
      })

      console.log('[Amazon Scraper] Browser launched successfully')

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
      console.log('[Amazon Scraper] New page created')
      
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
      })
      
      console.log('[Amazon Scraper] Stealth scripts injected')
      
      // Set cookies first (visit homepage to get cookies)
      console.log('[Amazon Scraper] Getting cookies from homepage...')
      try {
        await page.goto('https://www.amazon.nl', {
          waitUntil: 'networkidle',
          timeout: 15000,
        })
        await page.waitForTimeout(2000)
        console.log('[Amazon Scraper] Homepage visited, cookies set')
      } catch (e) {
        console.log('[Amazon Scraper] Could not visit homepage, continuing anyway')
      }

      // Navigate to the page with realistic timing
      console.log('[Amazon Scraper] Navigating to:', cleanUrl)
      
      await page.goto(cleanUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      console.log('[Amazon Scraper] Page loaded (networkidle)')
      
      // Wait a bit
      await page.waitForTimeout(2000)
      
      // Simulate human scrolling behavior
      console.log('[Amazon Scraper] Simulating human behavior...')
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
      
      console.log('[Amazon Scraper] Human behavior simulation complete')

      // Check if we got blocked
      const pageContent = await page.content()
      console.log('[Amazon Scraper] Page content length:', pageContent.length)
      console.log('[Amazon Scraper] Page title:', await page.title())
      
      if (pageContent.includes('Sorry, we just need to make sure you') || 
          pageContent.includes('Enter the characters you see') ||
          pageContent.includes('robot')) {
        console.log('[Amazon Scraper] ERROR: Captcha or bot detection')
        await context.close()
        await browser.close()
        return NextResponse.json(
          {
            error: 'Amazon heeft bot detection gedetecteerd',
            message: 'Amazon vraagt om captcha verificatie.',
            suggestion: 'Dit kan worden veroorzaakt door bot detection. Probeer het later opnieuw.',
          },
          { status: 403 }
        )
      }

      // Wait for product content to load
      console.log('[Amazon Scraper] Waiting for product selectors...')
      try {
        await page.waitForSelector('#productTitle, h1.a-size-large, [data-feature-name="title"]', { timeout: 5000 })
        console.log('[Amazon Scraper] Product selector found')
      } catch (e) {
        console.log('[Amazon Scraper] Product selector not found, continuing anyway')
      }

      // Extract structured data directly from DOM before closing
      console.log('[Amazon Scraper] Extracting DOM data with selectors...')
      let domData: any = null
      try {
        domData = await page.evaluate(() => {
          const getText = (selector: string) =>
            document.querySelector(selector)?.textContent?.trim() || null

          const priceText =
            document.querySelector('#corePriceDisplay_desktop_feature_div .a-offscreen')?.textContent ||
            document.querySelector('#priceblock_ourprice')?.textContent ||
            document.querySelector('#priceblock_dealprice')?.textContent ||
            null

          const normalizePrice = (value: string | null) => {
            if (!value) return { price: null, currency: null }
            const currencyMatch = value.match(/[€$£]/)
            const numeric = value.replace(/[^\d,.]/g, '').replace(',', '.')
            const price = numeric ? parseFloat(numeric) : null
            return { price: isNaN(price as number) ? null : price, currency: currencyMatch ? currencyMatch[0] : null }
          }

          const { price, currency } = normalizePrice(priceText)

          const ratingText =
            document.querySelector('#acrPopover')?.getAttribute('title') ||
            getText('.reviewCountTextLinkedHistogram') ||
            null

          const rating = ratingText
            ? parseFloat(ratingText.replace(',', '.').replace(/[^\d.]/g, ''))
            : null

          const reviewCountText =
            getText('#acrCustomerReviewText') ||
            getText('#acrCustomerReviewLink span.a-size-base') ||
            null

          const reviewCount = reviewCountText
            ? parseInt(reviewCountText.replace(/[^\d]/g, ''), 10)
            : null

          const colorImageSources: string[] = []
          try {
            const imageBlock = (window as any).ImageBlockATF || (window as any).ue || {}
            const colorImages =
              imageBlock?.colorImages?.initial ||
              imageBlock?.colorImages?.initialSeen ||
              imageBlock?.colorImages ||
              []
            if (Array.isArray(colorImages)) {
              colorImages.forEach((img: any) => {
                const src =
                  img?.hiRes ||
                  img?.large ||
                  img?.mainUrl ||
                  img?.variant ||
                  img?.thumb ||
                  img?.medium ||
                  img?.small
                if (src) {
                  colorImageSources.push(src)
                }
              })
            }
          } catch (error) {
            console.warn('ImageBlockATF parsing failed', error)
          }

          const imageSources = [
            ...colorImageSources,
            ...Array.from(
              document.querySelectorAll('#altImages img, .imageThumb img, #imgTagWrapperId img, #landingImage')
            )
              .map((img) => {
                const element = img as HTMLImageElement
                return (
                  element.getAttribute('data-old-hires') ||
                  element.getAttribute('data-a-hires') ||
                  element.getAttribute('src') ||
                  ''
                )
              })
              .filter(Boolean),
          ].map((src) => src.split('?')[0])

          const uniqueImages = Array.from(new Set(imageSources))

          const detailRows = Array.from(
            document.querySelectorAll(
              '#detailBullets_feature_div li, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr'
            )
          )

          let ean: string | null = null
          let dimensions: string | null = null
          let weight: string | null = null

          detailRows.forEach((row) => {
            const label =
              row.querySelector('span.a-text-bold')?.textContent ||
              row.querySelector('th')?.textContent ||
              ''
            const value =
              row.querySelector('span:not(.a-text-bold)')?.textContent ||
              row.querySelector('td')?.textContent ||
              ''
            if (!label || !value) return
            const cleanedLabel = label.trim().toLowerCase()
            const cleanedValue = value.trim()

            if (cleanedLabel.includes('ean') && !ean) {
              ean = cleanedValue.replace(/[^\d]/g, '')
            }
            if ((cleanedLabel.includes('afmetingen') || cleanedLabel.includes('dimension')) && !dimensions) {
              dimensions = cleanedValue
            }
            if ((cleanedLabel.includes('gewicht') || cleanedLabel.includes('weight')) && !weight) {
              weight = cleanedValue
            }
          })

          const bullets = Array.from(document.querySelectorAll('#feature-bullets li span.a-list-item'))
            .map((el) => el.textContent?.trim())
            .filter((text): text is string => Boolean(text))

          const descriptionParagraphs = Array.from(
            document.querySelectorAll('#productDescription p, #productDescription span')
          )
            .map((el) => el.textContent?.trim())
            .filter((text): text is string => Boolean(text))

          const description =
            [...bullets, ...descriptionParagraphs].filter(Boolean).join('\n').trim() || null

          const brandText = getText('#bylineInfo')
          const brand = brandText
            ? brandText.replace(/^Bezoek de\s+/i, '').replace(/\s+Store$/i, '').trim()
            : null

          return {
            title: getText('#productTitle'),
            price,
            currencySymbol: currency,
            availability: getText('#availability .a-color-success') || getText('#availability span'),
            rating,
            reviewCount,
            brand,
            description,
            images: uniqueImages,
            ean,
            dimensions,
            weight,
          }
        })
        console.log('[Amazon Scraper] DOM data extracted')
      } catch (e) {
        console.log('[Amazon Scraper] DOM extraction failed', e)
      }

      // Get the final HTML after JavaScript execution
      console.log('[Amazon Scraper] Getting final HTML...')
      const html = await page.content()
      const pageTitle = await page.title()
      console.log('[Amazon Scraper] HTML length:', html.length)
      console.log('[Amazon Scraper] Final page title:', pageTitle)

      const blockedMarkers = [
        'Om automatische toegang tot Amazon-gegevens te bespreken',
        'api-services-support@amazon.com',
        'Pagina niet gevonden',
        'Access Denied',
        'Bot Check',
      ]

      if (blockedMarkers.some((marker) => html.includes(marker))) {
        console.log('[Amazon Scraper] Amazon blocked the request')
        await context.close()
        await browser.close()
        return NextResponse.json(
          {
            error: 'Amazon heeft het verzoek geblokkeerd',
            message:
              'Amazon retourneert een blokkadepagina. Dit gebeurt wanneer verzoeken vanaf dit IP-adres als automatische toegang worden herkend.',
            suggestion: 'Gebruik een ander IP-adres (proxy/VPN) of de officiële Amazon API voor betrouwbare toegang.',
          },
          { status: 403 }
        )
      }

      // Try to extract data from page context (JavaScript variables)
      console.log('[Amazon Scraper] Extracting page data...')
      let pageData: any = null
      try {
        pageData = await page.evaluate(() => {
          // Try to find product data in window objects
          const win: any = window
          return {
            productData: win.ue_sn_data || win.ue_backlog_data || win.ue_id || null,
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
        console.log('[Amazon Scraper] Page data extracted:', pageData ? 'Found' : 'Not found')
      } catch (e) {
        console.log('[Amazon Scraper] Error extracting page data:', e)
      }

      console.log('[Amazon Scraper] Closing browser...')
      await context.close()
      await browser.close()
      browser = null
      console.log('[Amazon Scraper] Browser closed')

      // Parse HTML om product informatie en verkoopdata te extraheren
      console.log('[Amazon Scraper] Parsing product data...')
      const productInfo = mergeDomData(parseAmazonProduct(html, cleanUrl, asin, pageData), domData)
      console.log('[Amazon Scraper] Product info parsed:', {
        title: productInfo.title ? 'Found' : 'Not found',
        price: productInfo.price ? 'Found' : 'Not found',
        salesRank: productInfo.salesIndicators.salesRank,
      })

      console.log('[Amazon Scraper] Returning success response')
      return NextResponse.json({
        success: true,
        data: productInfo,
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                pageTitle,
                snippet: html.slice(0, 500),
              }
            : undefined,
      })
    } catch (error: any) {
      console.error('[Amazon Scraper] ERROR:', error)
      console.error('[Amazon Scraper] Error stack:', error.stack)
      
      if (context) {
        try {
          await context.close()
        } catch (e) {
          // Ignore
        }
      }
      if (browser) {
        console.log('[Amazon Scraper] Closing browser due to error...')
        try {
          await browser.close()
        } catch (closeError) {
          console.error('[Amazon Scraper] Error closing browser:', closeError)
        }
      }
      
      return NextResponse.json(
        {
          error: 'Kon Amazon pagina niet ophalen',
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
 * Parse Amazon product HTML en extraheer product informatie + verkoopdata
 */
function mergeDomData(productInfo: any, domData?: any) {
  if (!domData) return productInfo

  if (domData.title && !productInfo.title) productInfo.title = domData.title
  if (typeof domData.price === 'number' && (productInfo.price === null || productInfo.price === undefined)) {
    productInfo.price = domData.price
  }
  if (domData.currencySymbol) productInfo.currency = domData.currencySymbol
  if (domData.availability && !productInfo.availability) productInfo.availability = domData.availability
  if (typeof domData.rating === 'number' && productInfo.rating === null) {
    productInfo.rating = domData.rating
  }
  if (typeof domData.reviewCount === 'number' && productInfo.reviewCount === null) {
    productInfo.reviewCount = domData.reviewCount
  }
  if (domData.brand && !productInfo.brand) productInfo.brand = domData.brand
  if (domData.description && !productInfo.description) productInfo.description = domData.description
  if (domData.ean && !productInfo.ean) productInfo.ean = domData.ean
  if (domData.dimensions && !productInfo.dimensions) productInfo.dimensions = domData.dimensions
  if (domData.weight && !productInfo.weight) productInfo.weight = domData.weight

  if (domData.images && domData.images.length > 0) {
    const mergedImages = Array.from(new Set([...(domData.images || []), ...(productInfo.images || [])]))
    productInfo.images = mergedImages.slice(0, 15)
  }

  return productInfo
}

function parseAmazonProduct(html: string, url: string, asin: string, pageData?: any) {
  const productInfo: any = {
    asin,
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
      salesRank: null,
      categoryRank: null,
      salesHistory: null,
    },
    scrapedAt: new Date().toISOString(),
  }

  try {
    // Extract title
    const titleMatch = html.match(/<span[^>]*id="productTitle"[^>]*>(.*?)<\/span>/i) ||
                      html.match(/<h1[^>]*class="[^"]*a-size-large[^"]*"[^>]*>(.*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*data-feature-name="title"[^>]*>(.*?)<\/h1>/i)
    if (titleMatch) {
      productInfo.title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
    }

    // Extract price
    const priceMatch = html.match(/€\s*([\d,]+\.?\d*)/) ||
                      html.match(/"price":\s*"([^"]+)"/) ||
                      html.match(/class="a-price-whole"[^>]*>([^<]+)/i)
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(',', '.').replace(/[^\d.]/g, '')
      productInfo.price = parseFloat(priceStr)
    }

    // Extract rating
    const ratingMatch = html.match(/"ratingValue":\s*([\d.]+)/) ||
                       html.match(/class="a-icon-alt"[^>]*>([\d.]+)\s*van/i) ||
                       html.match(/rating[^>]*>([\d.]+)/i)
    if (ratingMatch) {
      productInfo.rating = parseFloat(ratingMatch[1])
    }

    // Extract review count
    const reviewMatch = html.match(/"reviewCount":\s*(\d+)/) ||
                       html.match(/(\d+)\s*beoordelingen?/i) ||
                       html.match(/id="acrCustomerReviewText"[^>]*>(\d+)/i)
    if (reviewMatch) {
      productInfo.reviewCount = parseInt(reviewMatch[1])
    }

    // Extract EAN
    const eanMatch = html.match(/"ean":\s*"([^"]+)"/) ||
                    html.match(/EAN[^>]*>([\d]+)/i)
    if (eanMatch) {
      productInfo.ean = eanMatch[1]
    }

    // Extract images
    const imageRegexes = [
      /<img[^>]*data-a-dynamic-image="([^"]+)"/gi,
      /<img[^>]*id="landingImage"[^>]*src="([^"]+)"/gi,
    ]
    const images: string[] = []
    imageRegexes.forEach((regex) => {
      let match: RegExpExecArray | null
      while ((match = regex.exec(html)) !== null) {
        if (match[1] && !match[1].includes('placeholder')) {
          try {
            const imageData = JSON.parse(match[1].replace(/&quot;/g, '"'))
            if (typeof imageData === 'object') {
              Object.keys(imageData).forEach((key) => images.push(key))
            } else {
              images.push(match[1])
            }
          } catch {
            images.push(match[1])
          }
        }
      }
    })
    productInfo.images = images.slice(0, 10)

    // Extract verkoopindicatoren
    // Bestseller badge
    const bestsellerMatch = html.match(/bestseller/i) ||
                           html.match(/#1\s*Best\s*Seller/i) ||
                           html.match(/class="[^"]*bestseller[^"]*"/i)
    productInfo.salesIndicators.isBestseller = !!bestsellerMatch

    // Sales rank (Amazon Best Sellers Rank)
    const rankPatterns = [
      /#(\d+(?:,\d+)*)\s*(?:in|op)\s*(?:Amazon|de)/i,
      /Best\s*Sellers\s*Rank[^>]*>#(\d+(?:,\d+)*)/i,
      /"salesRank":\s*"(\d+(?:,\d+)*)"/,
      /rank[^>]*>#(\d+(?:,\d+)*)/i,
    ]
    
    for (const pattern of rankPatterns) {
      const match = html.match(pattern)
      if (match) {
        const rank = match[1].replace(/,/g, '')
        if (rank) {
          productInfo.salesIndicators.salesRank = parseInt(rank)
          break
        }
      }
    }

    // Category rank
    const categoryRankMatch = html.match(/#(\d+)\s*(?:in|op)\s*([^<]+)/i)
    if (categoryRankMatch && !productInfo.salesIndicators.salesRank) {
      productInfo.salesIndicators.categoryRank = parseInt(categoryRankMatch[1])
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

    // Try to extract from pageData
    if (pageData?.jsonLd && Array.isArray(pageData.jsonLd)) {
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

  } catch (error: any) {
    console.error('Error parsing Amazon product:', error)
  }

  return productInfo
}
