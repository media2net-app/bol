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
 * POST: MEGA Scraper - Scrape Amazon voor alle mogelijke producten
 * Streams results in real-time
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, limit = 1000 } = body

    if (!url || !url.includes('amazon')) {
      return NextResponse.json(
        { error: 'Ongeldige Amazon URL' },
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
          sendLog('MEGA Scraper gestart', 'info')
          sendLog(`Target: ${limit} producten`, 'info')

          const products: ScrapedProduct[] = []
          const categories = new Set<string>()
          const visitedUrls = new Set<string>()

          // Amazon categories to explore
          const amazonCategories = [
            'Electronica',
            'Computers & Accessoires',
            'Kantoorproducten',
            'Keuken & Huishouden',
            'Sport & Outdoor',
            'Speelgoed & Spellen',
            'Boeken',
            'Kleding, Schoenen & Sieraden',
            'Beauty & Personal Care',
            'Auto & Motor',
            'Tuin & Terras',
            'Baby',
            'Gezondheid & Verzorging',
            'Huisdierbenodigdheden',
            'Muziek, Films & Games',
            'Wonen & Slapen',
          ]

          sendLog(`${amazonCategories.length} categorieën gevonden`, 'info')

          // Strategy: Search for products in each category
          for (let catIndex = 0; catIndex < amazonCategories.length && products.length < limit; catIndex++) {
            const category = amazonCategories[catIndex]
            sendLog(`Categorie ${catIndex + 1}/${amazonCategories.length}: ${category}`, 'info')

            try {
              // Search Amazon for products in this category
              // We'll use Amazon's search API or scrape search results
              const searchUrl = `https://www.amazon.nl/s?k=${encodeURIComponent(category)}&page=1`
              
              sendLog(`Zoeken in categorie: ${category}...`, 'info')

              // Fetch search results page
              const response = await fetch(searchUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
                },
              })

              if (!response.ok) {
                sendLog(`Fout bij ophalen categorie ${category}: HTTP ${response.status}`, 'warning')
                continue
              }

              const html = await response.text()
              
              // Extract product ASINs from search results
              const asinMatches = html.matchAll(/data-asin="([A-Z0-9]{10})"/g)
              const asins = Array.from(asinMatches).map(m => m[1]).filter(asin => asin && asin.length === 10)
              
              sendLog(`${asins.length} producten gevonden in ${category}`, 'info')

              // Process products from this category (limit per category to distribute evenly)
              const productsPerCategory = Math.ceil(limit / amazonCategories.length)
              const asinsToProcess = asins.slice(0, Math.min(productsPerCategory, asins.length))

              for (let i = 0; i < asinsToProcess.length && products.length < limit; i++) {
                const asin = asinsToProcess[i]
                
                if (visitedUrls.has(asin)) {
                  continue
                }
                visitedUrls.add(asin)

                try {
                  const productUrl = `https://www.amazon.nl/dp/${asin}`
                  
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

                  // Parse product information (similar to regular scraper)
                  const product = parseAmazonProduct(productHtml, productUrl, asin, category)
                  
                  if (product) {
                    // Log parsed data for debugging
                    const debugInfo = {
                      title: product.title ? '✓' : '✗',
                      price: product.price !== null ? `✓ ${product.currency} ${product.price}` : '✗',
                      rating: product.rating !== null ? `✓ ${product.rating}` : '✗',
                      reviews: product.reviewCount !== null ? `✓ ${product.reviewCount}` : '✗',
                      images: product.images.length > 0 ? `✓ ${product.images.length}` : '✗',
                    }
                    sendLog(`Parsed: ${Object.entries(debugInfo).map(([k, v]) => `${k}=${v}`).join(', ')}`, 'info')
                    
                    products.push(product)
                    if (product.category) {
                      categories.add(product.category)
                    }
                    
                    sendProduct(product)
                    sendProgress(products.length, limit)
                    
                    sendLog(`Product ${products.length}/${limit}: ${product.title?.substring(0, 50) || asin}`, 'success')
                  } else {
                    sendLog(`Kon product ${asin} niet parsen`, 'warning')
                  }

                  // Rate limiting - small delay between requests
                  await new Promise(resolve => setTimeout(resolve, 500))

                } catch (error: any) {
                  sendLog(`Fout bij product ${asin}: ${error.message}`, 'warning')
                }
              }

              // If we have enough products, break
              if (products.length >= limit) {
                break
              }

            } catch (error: any) {
              sendLog(`Fout bij categorie ${category}: ${error.message}`, 'warning')
            }
          }

          sendLog('=== MEGA Scraping Voltooid ===', 'success')
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
 * Parse Amazon product HTML (simplified version)
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
      // Remove HTML tags if any
      title = title.replace(/<[^>]+>/g, '')
      // Decode HTML entities
      title = title.replace(/&nbsp;/g, ' ')
      title = title.replace(/&amp;/g, '&')
      title = title.replace(/&lt;/g, '<')
      title = title.replace(/&gt;/g, '>')
      title = title.replace(/&quot;/g, '"')
      product.title = title.substring(0, 200)
    }

    // Extract price - multiple methods
    // Method 1: a-price-whole (most common)
    let priceMatch = html.match(/<span[^>]*class="a-price-whole"[^>]*>([^<]+)<\/span>/)
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/[^\d.,]/g, '').replace(',', '.')
      product.price = parseFloat(priceStr)
    }

    // Method 2: a-offscreen (hidden price text)
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

    // Method 3: Price in JavaScript data
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

    // Extract currency - multiple methods
    // Method 1: a-price-symbol
    const currencyMatch = html.match(/<span[^>]*class="a-price-symbol"[^>]*>([^<]+)<\/span>/)
    if (currencyMatch) {
      product.currency = currencyMatch[1].trim()
    }

    // Method 2: From price string
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

    // Default to EUR if no currency found
    if (!product.currency) {
      product.currency = 'EUR'
    }

    // Extract rating - multiple methods
    // Method 1: a-icon-alt with "van 5" or "out of 5"
    let ratingMatch = html.match(/<span[^>]*class="a-icon-alt"[^>]*>([\d.]+)\s+(?:van|out of)\s+5/i)
    if (ratingMatch) {
      product.rating = parseFloat(ratingMatch[1])
    }

    // Method 2: a-icon-alt with "sterren" or "stars"
    if (!product.rating) {
      ratingMatch = html.match(/<span[^>]*class="a-icon-alt"[^>]*>([\d.]+)\s+(?:sterren|stars)/i)
      if (ratingMatch) {
        product.rating = parseFloat(ratingMatch[1])
      }
    }

    // Method 3: From JavaScript data
    if (!product.rating) {
      const jsRatingMatch = html.match(/["']rating["']\s*:\s*["']?([\d.]+)["']?/)
      if (jsRatingMatch) {
        const parsedRating = parseFloat(jsRatingMatch[1])
        if (!isNaN(parsedRating) && parsedRating >= 0 && parsedRating <= 5) {
          product.rating = parsedRating
        }
      }
    }

    // Extract review count - multiple methods
    // Method 1: acrCustomerReviewText
    let reviewCountMatch = html.match(/<span[^>]*id="acrCustomerReviewText"[^>]*>([\d.,]+)/)
    if (reviewCountMatch) {
      product.reviewCount = parseInt(reviewCountMatch[1].replace(/[^\d]/g, ''))
    }

    // Method 2: acrCustomerReviewLink
    if (!product.reviewCount) {
      reviewCountMatch = html.match(/<a[^>]*id=["']acrCustomerReviewLink["'][^>]*>[\s\S]*?([\d.,]+)/i)
      if (reviewCountMatch) {
        product.reviewCount = parseInt(reviewCountMatch[1].replace(/[^\d]/g, ''))
      }
    }

    // Method 3: From JavaScript data
    if (!product.reviewCount) {
      const jsReviewMatch = html.match(/["']reviewCount["']\s*:\s*["']?([\d.,]+)["']?/)
      if (jsReviewMatch) {
        product.reviewCount = parseInt(jsReviewMatch[1].replace(/[^\d]/g, ''))
      }
    }

    // Extract main image - multiple methods (same as regular scraper and merchant scraper)
    
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
      let imgUrl = landingImageMatch[1]
      imgUrl = imgUrl.split('?')[0]
      // Only add if it's a product image (not logo, banner, etc.)
      if (imgUrl.includes('amazon') && imgUrl.includes('images') && 
          !imgUrl.includes('logo') && !imgUrl.includes('banner') &&
          !imgUrl.includes('ad') && !imgUrl.includes('sponsor') &&
          !imgUrl.includes('icon') && !imgUrl.includes('badge')) {
        product.images.push(imgUrl)
      }
    }

    // Method 3: Extract data-a-dynamic-image from landingImage (contains all product image variants)
    // This is the BEST source for product images - it contains all sizes/variants of the main product image
    const dynamicImagesMatch = html.match(/<img[^>]*id=["']landingImage["'][^>]*data-a-dynamic-image=["']({[^"']+})["']/)
    if (dynamicImagesMatch) {
      try {
        const dynamicImages = JSON.parse(dynamicImagesMatch[1])
        const imageUrls = Object.keys(dynamicImages)
        // Filter and add unique product images only
        const productImages = imageUrls
          .filter(url => {
            const cleanUrl = url.split('?')[0]
            return cleanUrl.includes('amazon') && 
                   cleanUrl.includes('images') &&
                   !cleanUrl.includes('logo') && 
                   !cleanUrl.includes('banner') &&
                   !cleanUrl.includes('ad') && 
                   !cleanUrl.includes('sponsor') &&
                   !cleanUrl.includes('icon') &&
                   !cleanUrl.includes('badge')
          })
          .map(url => url.split('?')[0])
          .filter((url, index, self) => self.indexOf(url) === index)
        
        productImages.forEach((imgUrl) => {
          if (!product.images.includes(imgUrl)) {
            product.images.push(imgUrl)
          }
        })
      } catch (e) {
        // Try alternative format with escaped quotes
        try {
          const altMatch = html.match(/<img[^>]*id=["']landingImage["'][^>]*data-a-dynamic-image=["'](.*?)["']/)
          if (altMatch) {
            const unescaped = altMatch[1].replace(/\\/g, '').replace(/&quot;/g, '"')
            const dynamicImages = JSON.parse(unescaped)
            const imageUrls = Object.keys(dynamicImages)
            imageUrls.forEach((imgUrl) => {
              const cleanUrl = imgUrl.split('?')[0]
              if (cleanUrl.includes('amazon') && cleanUrl.includes('images') &&
                  !cleanUrl.includes('logo') && !cleanUrl.includes('banner') &&
                  !cleanUrl.includes('ad') && !cleanUrl.includes('sponsor') &&
                  !cleanUrl.includes('icon') && !cleanUrl.includes('badge') &&
                  !product.images.includes(cleanUrl)) {
                product.images.push(cleanUrl)
              }
            })
          }
        } catch (e2) {
          // Ignore
        }
      }
    }

    // Method 4: Extract thumbnails from imageBlock (thumbnails next to main image)
    // These are the small images you click to see different views
    if (imageBlockHtml) {
      // Find thumbnail container - look for ul or div with thumbnail class
      const thumbnailsMatch =
        imageBlockHtml.match(/<ul[^>]*class=["'][^"']*thumbnails?[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i) ||
        imageBlockHtml.match(/<div[^>]*class=["'][^"']*thumbnails?[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        imageBlockHtml.match(/<ul[^>]*id=["'][^"']*imageBlock_thumbnails[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)

      if (thumbnailsMatch) {
        const thumbnailsHtml = thumbnailsMatch[1]
        // Extract images from thumbnails - these are the small preview images
        const thumbRegex = /<img[^>]*(?:src|data-src|data-old-src)=["']([^"']+)["']/g
        let thumbMatch: RegExpExecArray | null
        while ((thumbMatch = thumbRegex.exec(thumbnailsHtml)) !== null) {
          if (thumbMatch[1]) {
            const cleanUrl = thumbMatch[1].split('?')[0]
            if (
              cleanUrl.includes('amazon') &&
              cleanUrl.includes('images') &&
              !cleanUrl.includes('logo') &&
              !cleanUrl.includes('banner') &&
              !cleanUrl.includes('ad') &&
              !cleanUrl.includes('sponsor') &&
              !cleanUrl.includes('icon') &&
              !cleanUrl.includes('badge') &&
              !product.images.includes(cleanUrl)
            ) {
              product.images.push(cleanUrl)
            }
          }
        }
      }
    }

    // Method 5: Extract from imageBlock using data-src (lazy loaded thumbnails)
    // Fallback if thumbnails container not found
    if (imageBlockHtml && product.images.length < 3) {
      const dataSrcRegex = /data-src=["']([^"']+)["']/g
      let dataSrcMatch: RegExpExecArray | null
      while ((dataSrcMatch = dataSrcRegex.exec(imageBlockHtml)) !== null) {
        if (dataSrcMatch[1] && dataSrcMatch[1].includes('amazon') && dataSrcMatch[1].includes('images')) {
          const cleanUrl = dataSrcMatch[1].split('?')[0]
          // Filter out non-product images
          if (
            !cleanUrl.includes('logo') &&
            !cleanUrl.includes('banner') &&
            !cleanUrl.includes('ad') &&
            !cleanUrl.includes('sponsor') &&
            !cleanUrl.includes('icon') &&
            !cleanUrl.includes('badge') &&
            !product.images.includes(cleanUrl)
          ) {
            product.images.push(cleanUrl)
          }
        }
      }
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

