'use client'

import { useState, useEffect } from 'react'
import { Zap, Download, RefreshCw, Trash2 } from 'lucide-react'
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

const STORAGE_KEY = 'megaScrapedProducts'

export default function MegaScraperPage() {
  const [url, setUrl] = useState('https://www.amazon.nl/')
  const [scraping, setScraping] = useState(false)
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 1000 })

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
        // Only log if we're not currently scraping (to avoid spam)
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
      // Get existing products
      const existingProductsJson = localStorage.getItem(STORAGE_KEY)
      const existingProducts: ScrapedProduct[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []

      // Create a map of existing ASINs for quick lookup
      const existingAsins = new Set(existingProducts.map(p => p.asin))

      // Filter out duplicates and add new products
      const uniqueNewProducts = newProducts.filter(p => !existingAsins.has(p.asin))
      
      // Combine existing and new products
      const allProducts = [...existingProducts, ...uniqueNewProducts]

      // Save to localStorage
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
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('nl-NL'),
      message,
      type,
    }
    setLogs(prev => [...prev, logEntry])
    // Auto-scroll logs
    setTimeout(() => {
      const logsContainer = document.querySelector(`.${styles.logsContent}`)
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight
      }
    }, 50)
  }

  const handleMegaScrape = async () => {
    if (!url.trim()) {
      setError('Voer een Amazon URL in')
      return
    }

    setScraping(true)
    setError(null)
    // Don't reset products - keep existing ones and add new ones
    setLogs([])
    setShowLogs(true)
    setProgress({ current: 0, total: 1000 })

    try {
      // Get existing products count
      const existingProductsJson = localStorage.getItem(STORAGE_KEY)
      const existingProducts: ScrapedProduct[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []
      const existingAsins = new Set(existingProducts.map(p => p.asin))

      addLog('=== MEGA Scraper Gestart ===', 'info')
      addLog(`Target URL: ${url}`, 'info')
      addLog('Doel: 1000 producten scrapen en categoriseren', 'info')
      addLog(`${existingProducts.length} producten al opgeslagen (duplicaten worden overgeslagen)`, 'info')

      const response = await fetch('/api/mega-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim(), limit: 1000 }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || data.message || 'Scraping mislukt')
      }

      // Handle streaming response for real-time updates
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
          if (line.trim()) {
            try {
              const data = JSON.parse(line)
              
              if (data.type === 'log') {
                addLog(data.message, data.logType || 'info')
              } else if (data.type === 'progress') {
                setProgress({ current: data.current, total: data.total })
              } else if (data.type === 'product') {
                // Check for duplicates using existingAsins Set (like Merchant Scraper)
                if (!existingAsins.has(data.product.asin)) {
                  existingAsins.add(data.product.asin)
                  
                  setProducts(prev => {
                    const exists = prev.some(p => p.asin === data.product.asin)
                    if (!exists) {
                      const updated = [...prev, data.product]
                      
                      // Save to localStorage immediately (like Merchant Scraper)
                      saveProducts([data.product])
                      
                      return updated
                    }
                    return prev
                  })
                } else {
                  addLog(`Duplicaat overgeslagen: ${data.product.asin}`, 'warning')
                }
              } else if (data.type === 'complete') {
                addLog('=== MEGA Scraping Voltooid ===', 'success')
                addLog(`Totaal ${data.totalProducts} producten gevonden`, 'success')
                if (data.categories && data.categories.length > 0) {
                  addLog(`Categorieën: ${data.categories.join(', ')}`, 'info')
                }
                
                // Reload all saved products from localStorage
                loadSavedProducts()
                
                // Get final stats
                const finalProductsJson = localStorage.getItem(STORAGE_KEY)
                const finalProducts: ScrapedProduct[] = finalProductsJson 
                  ? JSON.parse(finalProductsJson) 
                  : []
                addLog(`Totaal opgeslagen: ${finalProducts.length} unieke producten`, 'success')
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete lines
            }
          }
        }
      }

    } catch (err: any) {
      addLog(`Fout: ${err.message}`, 'error')
      setError(err.message || 'Er is een fout opgetreden bij het scrapen')
    } finally {
      setScraping(false)
    }
  }

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    const category = product.category || 'Onbekend'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(product)
    return acc
  }, {} as Record<string, ScrapedProduct[]>)

  const categories = Object.keys(productsByCategory).sort()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>MEGA Scraper</h1>
          <p className={styles.subtitle}>Scrape het complete Amazon aanbod en categoriseer automatisch</p>
        </div>
        <div className={styles.headerButtons}>
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
          <button onClick={handleMegaScrape} className={styles.scrapeButton} disabled={scraping}>
            {scraping ? (
              <>
                <span className={styles.spinner}></span>
                Scrapen...
              </>
            ) : (
              <>
                <Zap size={18} />
                Start MEGA Scrape
              </>
            )}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label htmlFor="amazon-url" className={styles.label}>
              Amazon URL
            </label>
            <input
              id="amazon-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.nl/"
              className={styles.input}
              disabled={scraping}
            />
            <p className={styles.helpText}>
              Start URL voor MEGA scraping. De scraper zoekt automatisch door alle categorieën en vindt producten.
            </p>
          </div>

          {scraping && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              <p className={styles.progressText}>
                {progress.current} / {progress.total} producten ({Math.round((progress.current / progress.total) * 100)}%)
              </p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        {(products.length > 0 || scraping) && (
          <div className={styles.resultsContainer}>
            <h2>Gevonden Producten ({products.length})</h2>
            {products.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className={styles.emptyState}>
                <p>Scraping gestart... Producten worden hier getoond zodra ze worden gevonden.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div className={styles.logsPanel}>
          <div className={styles.logsHeader}>
            <h3>MEGA Scraper Logs</h3>
            <button onClick={() => setShowLogs(false)} className={styles.logsClose}>
              ×
            </button>
          </div>
          <div className={styles.logsContent}>
            {logs.length === 0 ? (
              <div className={styles.noLogs}>
                <p>Geen logs beschikbaar. Start de scraper om logs te zien.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                  <span className={styles.logTime}>{log.timestamp}</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

