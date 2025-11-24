import { NextRequest, NextResponse } from 'next/server'

interface ScrapedProduct {
  asin: string
  url: string
  title: string | null
  price: number | null
  currency: string
  rating: number | null
  reviewCount: number | null
  images: string[]
  category: string | null
  scrapedAt: string
}

/**
 * POST: Merchant Scraper - Scrape alle producten van een specifieke Amazon merchant
 * Streams results in real-time
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || !url.includes('amazon')) {
      return NextResponse.json(
        { error: 'Ongeldige Amazon URL' },
        { status: 400 }
      )
    }

    let merchantId: string | null = null
    let parsedUrl: URL | null = null
    try {
      parsedUrl = new URL(url)
      const meParam = parsedUrl.searchParams.get('me')
      if (meParam) {
        merchantId = meParam.toUpperCase()
      }
    } catch (error) {
      // ignore URL parsing error, fallback to regex below
    }

    if (!merchantId) {
      const match = url.match(/[?&]me=([A-Z0-9]+)/i)
      merchantId = match ? match[1].toUpperCase() : null
    }

    if (!merchantId && url.includes('/stores/')) {
      const match = url.match(/\/stores\/[^/]+\/([A-Z0-9]+)/i)
      merchantId = match ? match[1].toUpperCase() : null
    }

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Kon geen merchant ID vinden in de URL. Gebruik een URL zoals: https://www.amazon.nl/s?me=A123456789' },
        { status: 400 }
      )
    }

    // Create a readable stream for real-time updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'log', message, logType: type }) + '\n')
          )
        }

        const sendProgress = (current: number, total: number) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'progress', current, total }) + '\n')
          )
        }

        const sendProduct = (product: ScrapedProduct) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'product', product }) + '\n')
          )
        }

        try {
          sendLog('Merchant Scraper gestart', 'info')
          sendLog(`Merchant ID: ${merchantId}`, 'info')

          const products: ScrapedProduct[] = []
          const categories = new Set<string>()
          const visitedAsins = new Set<string>()

          // Build merchant search URL
          const origin = parsedUrl?.origin || 'https://www.amazon.nl'
          const baseUrl = origin
          const searchParams = parsedUrl ? new URLSearchParams(parsedUrl.search) : new URLSearchParams()
          searchParams.set('me', merchantId)
          searchParams.delete('page')
          const merchantPath = parsedUrl?.pathname?.includes('/s') ? parsedUrl.pathname : '/s'
          const merchantSearchUrl = `${origin}${merchantPath}?${searchParams.toString()}`

          sendLog(`Merchant URL: ${merchantSearchUrl}`, 'info')

          let page = 1
          let hasMorePages = true
          const maxPages = 50 // Limit to prevent infinite loops

          while (hasMorePages && page <= maxPages) {
            try {
              const pagedParams = new URLSearchParams(searchParams.toString())
              pagedParams.set('page', page.toString())
              const pageUrl = `${origin}${merchantPath}?${pagedParams.toString()}`
              sendLog(`Pagina ${page} ophalen...`, 'info')

              // Fetch merchant products page
              const response = await fetch(pageUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
                },
              })

              if (!response.ok) {
                sendLog(`Fout bij ophalen pagina ${page}: HTTP ${response.status}`, 'warning')
                hasMorePages = false
                break
              }

              const html = await response.text()

              // Check if page has products
              if (!html.includes('data-asin=') && !html.includes('s-result-item')) {
                sendLog(`Geen producten gevonden op pagina ${page}`, 'info')
                hasMorePages = false
                break
              }

              // Extract product ASINs from search results
              const asinRegex = /data-asin="([A-Z0-9]{10})"/g
              const asins: string[] = []
              let asinMatch: RegExpExecArray | null
              while ((asinMatch = asinRegex.exec(html)) !== null) {
                if (asinMatch[1]) {
                  asins.push(asinMatch[1])
                }
              }

              const filteredAsins = asins.filter(asin => asin && asin.length === 10 && !visitedAsins.has(asin))

              if (filteredAsins.length === 0) {
                sendLog(`Geen nieuwe producten gevonden op pagina ${page}`, 'info')
                hasMorePages = false
                break
              }

              sendLog(`${filteredAsins.length} producten gevonden op pagina ${page}`, 'info')

              // Process each product
              for (let i = 0; i < filteredAsins.length; i++) {
                const asin = filteredAsins[i]
                
                if (visitedAsins.has(asin)) {
                  continue
                }
                visitedAsins.add(asin)

                try {
                  const productUrl = `${baseUrl}/dp/${asin}`
                  
                  // Fetch product page
                  const productResponse = await fetch(productUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
                    },
                  })

                  if (!productResponse.ok) {
                    continue
                  }

                  const productHtml = await productResponse.text()

                  // Try to extract category from breadcrumbs or use "Merchant Products"
                  let category = 'Merchant Products'
                  const breadcrumbMatch = productHtml.match(/<a[^>]*class="a-link-normal a-color-tertiary"[^>]*>([^<]+)<\/a>/g)
                  if (breadcrumbMatch && breadcrumbMatch.length > 0) {
                    const lastBreadcrumb = breadcrumbMatch[breadcrumbMatch.length - 1]
                    const categoryMatch = lastBreadcrumb.match(/>([^<]+)</)
                    if (categoryMatch) {
                      category = categoryMatch[1].trim()
                    }
                  }

                  // Parse product information
                  const product = parseAmazonProduct(productHtml, productUrl, asin, category)
                  
                  if (product) {
                    products.push(product)
                    if (product.category) {
                      categories.add(product.category)
                    }
                    
                    sendProduct(product)
                    sendProgress(products.length, products.length + filteredAsins.length - i - 1)
                    
                    sendLog(`Product ${products.length}: ${product.title?.substring(0, 50) || asin}`, 'success')
                  }

                  // Rate limiting - small delay between requests
                  await new Promise(resolve => setTimeout(resolve, 500))

                } catch (error: any) {
                  sendLog(`Fout bij product ${asin}: ${error.message}`, 'warning')
                }
              }

              // Check if there's a next page
              const nextPageMatch = html.match(/<a[^>]*aria-label="Volgende pagina"[^>]*>/i) || 
                                   html.match(/<a[^>]*class="[^"]*pagnNext[^"]*"[^>]*>/i)
              hasMorePages = !!nextPageMatch

              if (!hasMorePages) {
                sendLog(`Geen volgende pagina gevonden`, 'info')
              }

              page++

            } catch (error: any) {
              sendLog(`Fout bij pagina ${page}: ${error.message}`, 'warning')
              hasMorePages = false
            }
          }

          sendLog('=== Merchant Scraping Voltooid ===', 'success')
          sendLog(`Totaal ${products.length} producten gevonden`, 'success')
          
          controller.enqueue(
            encoder.encode(JSON.stringify({
              type: 'complete',
              totalProducts: products.length,
              categories: Array.from(categories),
            }) + '\n')
          )

          controller.close()
        } catch (error: any) {
          sendLog(`Fout: ${error.message}`, 'error')
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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

/**
 * Parse Amazon product HTML (same as MEGA scraper)
 */
function parseAmazonProduct(
  html: string,
  url: string,
  asin: string,
  category: string
): ScrapedProduct | null {
  try {
    // Check if HTML contains product data (basic validation)
    if (!html || html.length < 1000) {
      return null
    }

    // Check if it's a valid product page (has productTitle or similar)
    if (!html.includes('productTitle') && !html.includes('product-title') && !html.includes('asin')) {
      return null
    }

    const product: ScrapedProduct = {
      asin,
      url,
      title: null,
      price: null,
      currency: 'EUR',
      rating: null,
      reviewCount: null,
      images: [],
      category,
      scrapedAt: new Date().toISOString(),
    }

    // Extract title - multiple methods
    const titleMatch = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)
    if (titleMatch) {
      let title = titleMatch[1].trim().replace(/\s+/g, ' ')
      title = title.replace(/<[^>]+>/g, '')
      title = title.replace(/&nbsp;/g, ' ')
      title = title.replace(/&amp;/g, '&')
      title = title.replace(/&lt;/g, '<')
      title = title.replace(/&gt;/g, '>')
      title = title.replace(/&quot;/g, '"')
      product.title = title.substring(0, 200)
    }

    // Extract price - multiple methods
    let priceMatch = html.match(/<span[^>]*class="a-price-whole"[^>]*>([^<]+)<\/span>/)
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/[^\d.,]/g, '').replace(',', '.')
      product.price = parseFloat(priceStr)
    }

    if (!product.price) {
      const offscreenMatch = html.match(/<span[^>]*class="a-offscreen"[^>]*>([^<]+)<\/span>/)
      if (offscreenMatch) {
        const priceStr = offscreenMatch[1].replace(/[^\d.,]/g, '').replace(',', '.')
        const parsedPrice = parseFloat(priceStr)
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          product.price = parsedPrice
        }
      }
    }

    if (!product.price) {
      const jsPriceMatch = html.match(/["']price["']\s*:\s*["']?([\d.,]+)["']?/)
      if (jsPriceMatch) {
        const priceStr = jsPriceMatch[1].replace(/[^\d.,]/g, '').replace(',', '.')
        const parsedPrice = parseFloat(priceStr)
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          product.price = parsedPrice
        }
      }
    }

    // Extract currency
    const currencyMatch = html.match(/<span[^>]*class="a-price-symbol"[^>]*>([^<]+)<\/span>/)
    if (currencyMatch) {
      product.currency = currencyMatch[1].trim()
    }

    if (!product.currency) {
      const currencyInPrice = html.match(/€|EUR|USD|\$|£|GBP/)
      if (currencyInPrice) {
        if (currencyInPrice[0] === '€' || currencyInPrice[0] === 'EUR') {
          product.currency = '€'
        } else if (currencyInPrice[0] === '$' || currencyInPrice[0] === 'USD') {
          product.currency = '$'
        } else if (currencyInPrice[0] === '£' || currencyInPrice[0] === 'GBP') {
          product.currency = '£'
        }
      }
    }

    if (!product.currency) {
      product.currency = 'EUR'
    }

    // Extract rating
    let ratingMatch = html.match(/<span[^>]*class="a-icon-alt"[^>]*>([\d.]+)\s+(?:van|out of)\s+5/i)
    if (ratingMatch) {
      product.rating = parseFloat(ratingMatch[1])
    }

    if (!product.rating) {
      ratingMatch = html.match(/<span[^>]*class="a-icon-alt"[^>]*>([\d.]+)\s+(?:sterren|stars)/i)
      if (ratingMatch) {
        product.rating = parseFloat(ratingMatch[1])
      }
    }

    if (!product.rating) {
      const jsRatingMatch = html.match(/["']rating["']\s*:\s*["']?([\d.]+)["']?/)
      if (jsRatingMatch) {
        const parsedRating = parseFloat(jsRatingMatch[1])
        if (!isNaN(parsedRating) && parsedRating >= 0 && parsedRating <= 5) {
          product.rating = parsedRating
        }
      }
    }

    // Extract review count
    let reviewCountMatch = html.match(/<span[^>]*id="acrCustomerReviewText"[^>]*>([\d.,]+)/)
    if (reviewCountMatch) {
      product.reviewCount = parseInt(reviewCountMatch[1].replace(/[^\d]/g, ''))
    }

    if (!product.reviewCount) {
      reviewCountMatch = html.match(/<a[^>]*id=["']acrCustomerReviewLink["'][^>]*>[\s\S]*?([\d.,]+)/i)
      if (reviewCountMatch) {
        product.reviewCount = parseInt(reviewCountMatch[1].replace(/[^\d]/g, ''))
      }
    }

    if (!product.reviewCount) {
      const jsReviewMatch = html.match(/["']reviewCount["']\s*:\s*["']?([\d.,]+)["']?/)
      if (jsReviewMatch) {
        product.reviewCount = parseInt(jsReviewMatch[1].replace(/[^\d]/g, ''))
      }
    }

    const addImageUrl = (rawUrl?: string | null) => {
      if (!rawUrl) return
      let cleanUrl = rawUrl.split('?')[0]
      if (!cleanUrl) return
      if (!cleanUrl.includes('amazon') || !cleanUrl.includes('images')) return
      const lower = cleanUrl.toLowerCase()
      const blocked = ['logo', 'banner', 'ad', 'sponsor', 'icon', 'badge']
      if (blocked.some(keyword => lower.includes(keyword))) return
      if (!cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) && !cleanUrl.match(/\/[A-Z0-9]+\._/)) return
      if (!product.images.includes(cleanUrl)) {
        product.images.push(cleanUrl)
      }
    }

    // Extract main image - multiple methods (same as regular scraper)
    
    // Method 1: Find the main product image container
    const imageBlockMatch = html.match(/<div[^>]*id=["']imageBlock_feature_div["'][^>]*>([\s\S]*?)<\/div>/i) ||
                           html.match(/<div[^>]*id=["']leftCol["'][^>]*>([\s\S]*?)<\/div>/i)
    
    let imageBlockHtml = ''
    if (imageBlockMatch) {
      imageBlockHtml = imageBlockMatch[1]
    }

    // Method 2: Extract main landing image FIRST (highest priority - this is the main product image)
    const landingImageMatch = html.match(/<img[^>]*id=["']landingImage["'][^>]*(?:src|data-src|data-old-src)=["']([^"']+)["']/)
    if (landingImageMatch && landingImageMatch[1]) {
      addImageUrl(landingImageMatch[1])
    }

    // Method 3: Extract data-a-dynamic-image from landingImage (contains all product image variants)
    // This is the BEST source for product images - it contains all sizes/variants of the main product image
    const dynamicImagesMatch = html.match(/<img[^>]*id=["']landingImage["'][^>]*data-a-dynamic-image=["']({[^"']+})["']/)
    if (dynamicImagesMatch) {
      try {
        const dynamicImages = JSON.parse(dynamicImagesMatch[1])
        const imageUrls = Object.keys(dynamicImages)
        imageUrls.forEach((imgUrl) => addImageUrl(imgUrl))
      } catch (e) {
        try {
          const altMatch = html.match(/<img[^>]*id=["']landingImage["'][^>]*data-a-dynamic-image=["'](.*?)["']/)
          if (altMatch) {
            const unescaped = altMatch[1].replace(/\\/g, '').replace(/&quot;/g, '"')
            const dynamicImages = JSON.parse(unescaped)
            const imageUrls = Object.keys(dynamicImages)
            imageUrls.forEach((imgUrl) => addImageUrl(imgUrl))
          }
        } catch (e2) {
          // Ignore
        }
      }
    }

    // Method 4: Extract thumbnails from imageBlock (thumbnails next to main image)
    if (imageBlockHtml) {
      const thumbnailsMatch = imageBlockHtml.match(/<ul[^>]*class=["'][^"']*thumbnails?[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i) ||
                            imageBlockHtml.match(/<div[^>]*class=["'][^"']*thumbnails?[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                            imageBlockHtml.match(/<ul[^>]*id=["'][^"']*imageBlock_thumbnails[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)
      
      if (thumbnailsMatch) {
        const thumbnailsHtml = thumbnailsMatch[1]
        const thumbRegex = /<img[^>]*(?:src|data-src|data-old-src)=["']([^"']+)["']/g
        let thumbMatch: RegExpExecArray | null
        while ((thumbMatch = thumbRegex.exec(thumbnailsHtml)) !== null) {
          addImageUrl(thumbMatch[1])
        }
      }
    }

    // Method 5: Extract from imageBlock using data-src (lazy loaded thumbnails)
    if (imageBlockHtml && product.images.length < 3) {
      const dataSrcRegex = /data-src=["']([^"']+)["']/g
      let dataSrcMatch: RegExpExecArray | null
      while ((dataSrcMatch = dataSrcRegex.exec(imageBlockHtml)) !== null) {
        addImageUrl(dataSrcMatch[1])
      }
    }

    // Method 6: Extract images from enlarged modal / ivLargeImage container
    const ivLargeRegex = /<(?:div|section)[^>]*(?:id|class)=["'][^"']*ivLargeImage[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi
    let ivMatch: RegExpExecArray | null
    while ((ivMatch = ivLargeRegex.exec(html)) !== null) {
      const modalHtml = ivMatch[1]
      if (!modalHtml) {
        continue
      }

      const modalImageAttrRegex = /(?:data-old-hires|data-hires|data-iv-url|data-src|src)=["']([^"']+)["']/gi
      let modalAttrMatch: RegExpExecArray | null
      while ((modalAttrMatch = modalImageAttrRegex.exec(modalHtml)) !== null) {
        addImageUrl(modalAttrMatch[1])
      }

      const modalHiResRegex = /"hiRes"\s*:\s*"([^"]+)"/g
      let modalHiResMatch: RegExpExecArray | null
      while ((modalHiResMatch = modalHiResRegex.exec(modalHtml)) !== null) {
        addImageUrl(modalHiResMatch[1])
      }

      const modalMainUrlRegex = /"mainUrl"\s*:\s*"([^"]+)"/g
      let modalMainUrlMatch: RegExpExecArray | null
      while ((modalMainUrlMatch = modalMainUrlRegex.exec(modalHtml)) !== null) {
        addImageUrl(modalMainUrlMatch[1])
      }
    }

    const globalHiResRegex = /"hiRes"\s*:\s*"([^"]+)"/g
    let globalHiResMatch: RegExpExecArray | null
    while ((globalHiResMatch = globalHiResRegex.exec(html)) !== null) {
      addImageUrl(globalHiResMatch[1])
    }

    const globalMainUrlRegex = /"mainUrl"\s*:\s*"([^"]+)"/g
    let globalMainUrlMatch: RegExpExecArray | null
    while ((globalMainUrlMatch = globalMainUrlRegex.exec(html)) !== null) {
      addImageUrl(globalMainUrlMatch[1])
    }

    // Clean and filter images - remove duplicates and non-product images
    product.images = product.images.filter((url, index, self) => {
      if (!url) return false
      // Must be Amazon image
      if (!url.includes('amazon') || !url.includes('images')) return false
      // Must not be logo, banner, ad, sponsor, icon, badge
      if (url.includes('logo') || url.includes('banner') || 
          url.includes('ad') || url.includes('sponsor') || 
          url.includes('icon') || url.includes('badge')) return false
      // Must be unique
      if (self.indexOf(url) !== index) return false
      // Must look like a product image
      if (!url.match(/\.(jpg|jpeg|png|gif|webp)/i) && !url.match(/\/[A-Z0-9]+\._/)) return false
      return true
    })

    // Limit to first 10 product images (main + thumbnails)
    product.images = product.images.slice(0, 10)

    // If still no images, try to construct from ASIN (last resort)
    if (product.images.length === 0) {
      // Try multiple Amazon image URL formats
      const possibleUrls = [
        `https://images-na.ssl-images-amazon.com/images/I/${product.asin}._AC_SL1500_.jpg`,
        `https://images-na.ssl-images-amazon.com/images/I/${product.asin}.jpg`,
        `https://m.media-amazon.com/images/I/${product.asin}._AC_SL1500_.jpg`,
        `https://m.media-amazon.com/images/I/${product.asin}.jpg`,
      ]
      product.images.push(...possibleUrls.slice(0, 1))
    }

    // Determine category from breadcrumbs or use provided category
    const breadcrumbMatch = html.match(/<a[^>]*class="a-link-normal a-color-tertiary"[^>]*>([^<]+)<\/a>/g)
    if (breadcrumbMatch && breadcrumbMatch.length > 0) {
      const lastBreadcrumb = breadcrumbMatch[breadcrumbMatch.length - 1]
      const categoryMatch = lastBreadcrumb.match(/>([^<]+)</)
      if (categoryMatch) {
        product.category = categoryMatch[1].trim()
      }
    }

    return product
  } catch (error) {
    return null
  }
}

