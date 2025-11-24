'use client'

import { useState, useEffect } from 'react'
import { Store, RefreshCw, Trash2, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

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

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

const STORAGE_KEY = 'merchantScrapedProducts'

const parseMerchantUrls = (input: string) =>
  input
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const isValidMerchantUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    const isAmazon = parsed.hostname.includes('amazon.')
    const hasMerchantId = Boolean(parsed.searchParams.get('me'))
    const isStorePath = parsed.pathname.includes('/stores/')
    return isAmazon && (hasMerchantId || isStorePath)
  } catch {
    return false
  }
}

const formatMerchantLabel = (value: string) => {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\./i, '')
    const path = parsed.pathname.replace(/\/$/, '')
    return `${host}${path}` || value
  } catch {
    return value
  }
}

const truncateLabel = (value: string, max = 64) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value

export default function MerchantScraperPage() {
  const router = useRouter()
  const [urlInput, setUrlInput] = useState('')
  const [scraping, setScraping] = useState(false)
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    merchantIndex: 0,
    merchantTotal: 0,
    merchantUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const merchantUrls = parseMerchantUrls(urlInput)

  // Load saved products from localStorage on mount
  useEffect(() => {
    loadSavedProducts()
  }, [])

  const loadSavedProducts = () => {
    try {
      const savedProductsJson = localStorage.getItem(STORAGE_KEY)
      if (savedProductsJson) {
        const savedProducts = JSON.parse(savedProductsJson)
        setProducts(savedProducts)
        if (!scraping && savedProducts.length > 0) {
          addLog(`Vorige scrape geladen: ${savedProducts.length} producten`, 'info')
        }
      }
    } catch (err: any) {
      console.error('Error loading saved products:', err)
    }
  }

  const saveProducts = (newProducts: ScrapedProduct[]) => {
    try {
      const existingProductsJson = localStorage.getItem(STORAGE_KEY)
      const existingProducts: ScrapedProduct[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []

      const existingAsins = new Set(existingProducts.map(p => p.asin))
      const uniqueNewProducts = newProducts.filter(p => !existingAsins.has(p.asin))
      const allProducts = [...existingProducts, ...uniqueNewProducts]

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allProducts))
      
      return {
        total: allProducts.length,
        new: uniqueNewProducts.length,
        duplicates: newProducts.length - uniqueNewProducts.length,
      }
    } catch (err: any) {
      console.error('Error saving products:', err)
      return { total: 0, new: 0, duplicates: 0 }
    }
  }

  const clearSavedProducts = () => {
    if (confirm(`Weet je zeker dat je alle ${products.length} opgeslagen producten wilt verwijderen?`)) {
      localStorage.removeItem(STORAGE_KEY)
      setProducts([])
      setLogs([])
      addLog(`Alle ${products.length} opgeslagen producten verwijderd`, 'success')
    }
  }

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const logEntry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('nl-NL'),
      message,
      type,
    }
    setLogs(prev => [...prev, logEntry])
    
    // Auto-scroll logs
    setTimeout(() => {
      const logsContainer = document.getElementById('logs-container')
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight
      }
    }, 50)
  }

  const handleMerchantScrape = async () => {
    const parsedUrls = merchantUrls

    if (parsedUrls.length === 0) {
      setError('Voer minimaal één Merchant URL in')
      return
    }

    const invalidUrl = parsedUrls.find((merchantUrl) => !isValidMerchantUrl(merchantUrl))
    if (invalidUrl) {
      setError(`Ongeldige Merchant URL: ${invalidUrl}`)
      return
    }

    setScraping(true)
    setError(null)
    setLogs([])
    setShowLogs(true)
    setProgress({
      current: 0,
      total: 0,
      merchantIndex: 0,
      merchantTotal: parsedUrls.length,
      merchantUrl: '',
    })

    try {
      const existingProductsJson = localStorage.getItem(STORAGE_KEY)
      const existingProducts: ScrapedProduct[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []
      const existingAsins = new Set(existingProducts.map(p => p.asin))

      addLog(`=== Merchant Scraper gestart (${parsedUrls.length} URL's) ===`, 'info')
      addLog(`${existingProducts.length} producten al opgeslagen (duplicaten worden overgeslagen)`, 'info')

      let encounteredError: string | null = null

      for (let i = 0; i < parsedUrls.length; i++) {
        const merchantUrl = parsedUrls[i]
        try {
          await processMerchantUrl(merchantUrl, i, parsedUrls.length, existingAsins)
        } catch (innerError: any) {
          const message = innerError?.message || 'Er is een fout opgetreden tijdens het scrapen'
          encounteredError = message
          addLog(`Fout bij merchant ${i + 1}: ${message}`, 'error')
        }
      }

      if (encounteredError) {
        setError(encounteredError)
      } else {
        setError(null)
        addLog('=== Alle merchants succesvol verwerkt ===', 'success')
      }
    } finally {
      setScraping(false)
      setProgress(prev => ({
        ...prev,
        current: 0,
        total: 0,
        merchantUrl: '',
      }))
    }
  }

  const processMerchantUrl = async (
    merchantUrl: string,
    merchantIndex: number,
    merchantTotal: number,
    existingAsins: Set<string>
  ) => {
    const prefix = merchantTotal > 1 ? `[Merchant ${merchantIndex + 1}] ` : ''

    addLog(`${prefix}Scrape gestart`, 'info')
    addLog(`${prefix}URL: ${merchantUrl}`, 'info')

    setProgress({
      current: 0,
      total: 0,
      merchantIndex: merchantIndex + 1,
      merchantTotal,
      merchantUrl,
    })

    const response = await fetch('/api/merchant-scraper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: merchantUrl }),
    })

    if (!response.ok) {
      let data: any = null
      try {
        data = await response.json()
      } catch (err) {
        // ignore json parse errors
      }
      throw new Error(data?.error || data?.message || 'Scraping mislukt')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Geen response stream beschikbaar')
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const data = JSON.parse(line)

          if (data.type === 'log') {
            addLog(`${prefix}${data.message}`, data.logType || 'info')
          } else if (data.type === 'progress') {
            setProgress({
              current: data.current,
              total: data.total,
              merchantIndex: merchantIndex + 1,
              merchantTotal,
              merchantUrl,
            })
          } else if (data.type === 'product') {
            if (!existingAsins.has(data.product.asin)) {
              existingAsins.add(data.product.asin)

              setProducts(prev => {
                const exists = prev.some(p => p.asin === data.product.asin)
                if (!exists) {
                  const updated = [...prev, data.product]
                  saveProducts([data.product])
                  return updated
                }
                return prev
              })
            } else {
              addLog(`${prefix}Duplicaat overgeslagen: ${data.product.asin}`, 'warning')
            }
          } else if (data.type === 'complete') {
            addLog(`${prefix}=== Merchant Scraping Voltooid ===`, 'success')
            addLog(`${prefix}Totaal ${data.totalProducts} producten gevonden`, 'success')
            if (data.categories && data.categories.length > 0) {
              addLog(`${prefix}Categorieën: ${data.categories.join(', ')}`, 'info')
            }

            loadSavedProducts()

            const finalProductsJson = localStorage.getItem(STORAGE_KEY)
            const finalProducts: ScrapedProduct[] = finalProductsJson 
              ? JSON.parse(finalProductsJson) 
              : []
            addLog(`${prefix}Totaal opgeslagen: ${finalProducts.length} unieke producten`, 'success')
          }
        } catch (err) {
          console.error('Error parsing stream data:', err)
        }
      }
    }
  }

  const handleSaveToScrapedProducts = () => {
    if (products.length === 0) {
      setError('Geen producten om op te slaan')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Get existing products from scrapedProducts localStorage
      const existingProductsJson = localStorage.getItem('scrapedProducts')
      const existingProducts: any[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []

      // Convert merchant scraped products to scrapedProducts format
      const productsToSave = products.map(product => {
        // Check if product already exists (by ASIN)
        const existingIndex = existingProducts.findIndex(p => p.asin === product.asin)
        
        // Create product with required fields for scrapedProducts page
        const productToSave: any = {
          id: existingIndex >= 0 
            ? existingProducts[existingIndex].id 
            : `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          asin: product.asin,
          url: product.url,
          title: product.title,
          price: product.price,
          originalPrice: null,
          currency: product.currency,
          availability: null,
          rating: product.rating,
          reviewCount: product.reviewCount,
          images: product.images,
          description: null,
          brand: null,
          category: product.category,
          dimensions: null,
          weight: null,
          ean: null,
          scrapedAt: product.scrapedAt,
          savedAt: new Date().toISOString(),
        }

        if (existingIndex >= 0) {
          // Update existing product
          existingProducts[existingIndex] = productToSave
          return null // Don't add to new products
        } else {
          return productToSave
        }
      }).filter(p => p !== null) // Remove nulls (updated products)

      // Add new products
      const allProducts = [...existingProducts, ...productsToSave]

      // Save to localStorage
      localStorage.setItem('scrapedProducts', JSON.stringify(allProducts))

      addLog(`${productsToSave.length} nieuwe producten opgeslagen naar Scraped Products (${products.length - productsToSave.length} waren al opgeslagen)`, 'success')
      
      // Optionally redirect to scraped products page after a short delay
      setTimeout(() => {
        router.push('/scraped-products')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het opslaan')
      addLog(`Fout bij opslaan: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Group products by category
  const productsByCategory: { [key: string]: ScrapedProduct[] } = {}
  products.forEach(product => {
    const category = product.category || 'Onbekend'
    if (!productsByCategory[category]) {
      productsByCategory[category] = []
    }
    productsByCategory[category].push(product)
  })

  const categories = Object.keys(productsByCategory).sort()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Merchant Scraper</h1>
          <p className={styles.subtitle}>Scrape alle producten van een specifieke Amazon merchant</p>
        </div>
        <div className={styles.headerButtons}>
          {products.length > 0 && (
            <button 
              onClick={handleSaveToScrapedProducts}
              className={styles.saveButton}
              disabled={scraping || saving}
              title="Sla alle producten op naar Scraped Products (Eigen EAN)"
            >
              {saving ? (
                <>
                  <span className={styles.spinner}></span>
                  Opslaan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Opslaan naar Scraped Products ({products.length})
                </>
              )}
            </button>
          )}
          <button 
            onClick={clearSavedProducts}
            className={styles.clearButton}
            disabled={scraping || products.length === 0}
            title={products.length === 0 ? 'Geen producten om te wissen' : `Wis alle ${products.length} opgeslagen producten`}
          >
            <Trash2 size={16} />
            Wissen {products.length > 0 && `(${products.length})`}
          </button>
          <button 
            onClick={() => setShowLogs(!showLogs)} 
            className={styles.logButton}
            disabled={logs.length === 0}
          >
            {showLogs ? 'Verberg' : 'Toon'} Logs {logs.length > 0 && `(${logs.length})`}
          </button>
          <button 
            onClick={handleMerchantScrape} 
            className={styles.scrapeButton} 
            disabled={scraping || merchantUrls.length === 0}
          >
            {scraping ? (
              <>
                <span className={styles.spinner}></span>
                Scrapen...
              </>
            ) : (
              <>
                <Store size={18} />
                {merchantUrls.length > 1
                  ? `Start ${merchantUrls.length} Merchant Scrapes`
                  : 'Start Merchant Scrape'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label htmlFor="merchant-urls" className={styles.label}>
              Merchant URL(s)
            </label>
            <textarea
              id="merchant-urls"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={`Voer één of meerdere Amazon merchant URL's in.\nScheid meerdere URL's met een nieuwe regel, komma of puntkomma.`}
              className={`${styles.input} ${styles.textarea}`}
              disabled={scraping}
              rows={merchantUrls.length > 4 ? 6 : 4}
            />
            <p className={styles.helpText}>
              Bijvoorbeeld: https://www.amazon.nl/s?me=A123456789 — Voeg meerdere merchants toe (Enter of komma) om ze achter elkaar te scrapen.
            </p>
            {merchantUrls.length > 0 && (
              <div className={styles.merchantSummary}>
                <div className={styles.merchantSummaryHeader}>
                  {merchantUrls.length === 1
                    ? '1 merchant klaar om te scrapen'
                    : `${merchantUrls.length} merchants klaar om te scrapen`}
                </div>
                <div className={styles.merchantChips}>
                  {merchantUrls.map((merchantUrl, index) => {
                    const isActive = scraping && progress.merchantUrl === merchantUrl
                    return (
                      <span
                        key={`${merchantUrl}-${index}`}
                        className={`${styles.merchantChip} ${isActive ? styles.activeMerchantChip : ''}`}
                      >
                        {index + 1}. {truncateLabel(formatMerchantLabel(merchantUrl))}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {scraping && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                ></div>
              </div>
              <p className={styles.progressText}>
                {progress.current} / {progress.total} producten ({progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%)
              </p>
              <div className={styles.progressMeta}>
                <span>
                  Merchant {progress.merchantIndex || 0} / {progress.merchantTotal || merchantUrls.length || 0}
                </span>
                {progress.merchantUrl && (
                  <span className={styles.progressUrl}>
                    {truncateLabel(formatMerchantLabel(progress.merchantUrl), 48)}
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        {products.length > 0 && (
          <div className={styles.resultsContainer}>
            <h2>Gevonden Producten ({products.length})</h2>
            <div className={styles.categoriesSummary}>
              {categories.map(category => (
                <div key={category} className={styles.categoryBadge}>
                  {category}: {productsByCategory[category].length}
                </div>
              ))}
            </div>

            {categories.map(category => (
              <div key={category} className={styles.categorySection}>
                <h3 className={styles.categoryTitle}>
                  {category} ({productsByCategory[category].length})
                </h3>
                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Afbeelding</th>
                        <th>Titel</th>
                        <th>ASIN</th>
                        <th>Prijs</th>
                        <th>Beoordeling</th>
                        <th>URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsByCategory[category].map((product) => (
                        <tr key={product.asin}>
                          <td>
                            {product.images && product.images.length > 0 && product.images[0] ? (
                              <div className={styles.imageContainer}>
                                <img 
                                  src={`/api/scraper/image-proxy?url=${encodeURIComponent(product.images[0])}`}
                                  alt={product.title || 'Product'}
                                  className={styles.productThumbnail}
                                  loading="lazy"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    const proxyUrl = target.src
                                    const directUrl = new URL(proxyUrl).searchParams.get('url')
                                    
                                    // Try direct URL as fallback
                                    if (directUrl && target.src !== directUrl) {
                                      target.src = directUrl
                                      target.crossOrigin = 'anonymous'
                                      target.referrerPolicy = 'no-referrer'
                                    } else {
                                      // Try next image in array if available
                                      const currentIndex = product.images.indexOf(directUrl || product.images[0])
                                      if (currentIndex < product.images.length - 1 && product.images[currentIndex + 1]) {
                                        target.src = `/api/scraper/image-proxy?url=${encodeURIComponent(product.images[currentIndex + 1])}`
                                      } else {
                                        // Try direct Amazon URL without proxy
                                        if (directUrl && directUrl.includes('amazon')) {
                                          target.src = directUrl
                                          target.crossOrigin = 'anonymous'
                                          target.referrerPolicy = 'no-referrer'
                                        } else {
                                          // Hide if all methods fail
                                          target.style.display = 'none'
                                          const parent = target.parentElement
                                          if (parent && !parent.querySelector(`.${styles.noImage}`)) {
                                            const placeholder = document.createElement('div')
                                            placeholder.className = styles.noImage
                                            placeholder.textContent = '—'
                                            parent.appendChild(placeholder)
                                          }
                                        }
                                      }
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className={styles.noImage}>—</div>
                            )}
                          </td>
                          <td>
                            <div className={styles.titleCell}>
                              <strong>{product.title || 'Geen titel'}</strong>
                            </div>
                          </td>
                          <td className={styles.monoFont}>{product.asin}</td>
                          <td>
                            {product.price !== null ? (
                              <strong>{product.currency} {product.price.toFixed(2)}</strong>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td>
                            {product.rating !== null ? (
                              <div>
                                ⭐ {product.rating} / 5
                                {product.reviewCount !== null && (
                                  <div className={styles.reviewCount}>
                                    ({product.reviewCount.toLocaleString()} reviews)
                                  </div>
                                )}
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td>
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.link}
                            >
                              Bekijk
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {showLogs && logs.length > 0 && (
          <div className={styles.logsPanel} id="logs-container">
            <div className={styles.logsHeader}>
              <h3>Logs</h3>
              <button onClick={() => setShowLogs(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.logsContent}>
              {logs.map(log => (
                <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                  <span className={styles.logTimestamp}>[{log.timestamp}]</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

