'use client'

import { useState } from 'react'
import { Trophy, Search } from 'lucide-react'
import styles from './page.module.css'

interface ProductSalesData {
  asin: string
  url: string
  title: string | null
  price: number | null
  currency: string
  rating: number | null
  reviewCount: number | null
  ean: string | null
  salesIndicators: {
    isBestseller: boolean
    salesText: string | null
    salesRank: number | null
    categoryRank: number | null
  }
  scrapedAt: string
}

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export default function SearchAmazonWinnersPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productData, setProductData] = useState<ProductSalesData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)

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

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Voer een Amazon product URL in')
      return
    }

    setLoading(true)
    setError(null)
    setProductData(null)
    setLogs([])
    setShowLogs(true)

    addLog('=== Analyse Gestart ===', 'info')
    addLog(`URL: ${url.trim()}`, 'info')
    addLog('Playwright wordt geladen...', 'info')

    try {
      addLog('Verzoek wordt verstuurd naar server...', 'info')
      
      const response = await fetch('/api/scraper/amazon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      addLog(`Server response ontvangen (status: ${response.status})`, response.ok ? 'success' : 'error')

      const result = await response.json()

      console.log('API Response:', result)
      console.log('Response status:', response.status)

      if (response.ok && result.success) {
        addLog('Product data succesvol ontvangen', 'success')
        addLog('Data wordt geparsed...', 'info')
        
        console.log('Product data received:', result.data)
        setProductData(result.data)
        
        addLog('=== Analyse Voltooid ===', 'success')
        if (result.data.title) {
          addLog(`Product: ${result.data.title}`, 'success')
        }
        if (result.data.salesIndicators.salesRank) {
          addLog(`Sales Rank: #${result.data.salesIndicators.salesRank}`, 'success')
        }
        if (result.data.salesIndicators.isBestseller) {
          addLog('✓ Bestseller gedetecteerd!', 'success')
        }
      } else {
        let errorMessage = result.error || result.message || 'Kon product data niet ophalen'
        addLog(`Fout: ${errorMessage}`, 'error')
        
        if (result.suggestion) {
          addLog(`Suggestie: ${result.suggestion}`, 'warning')
          errorMessage += `\n\n${result.suggestion}`
        }
        if (result.debug) {
          console.error('Debug info:', result.debug)
          addLog(`Debug: ${result.debug.errorMessage || 'Onbekende fout'}`, 'error')
          errorMessage += `\n\nDebug: ${JSON.stringify(result.debug, null, 2)}`
        }
        console.error('Error:', errorMessage)
        setError(errorMessage)
        addLog('=== Analyse Mislukt ===', 'error')
      }
    } catch (err: any) {
      addLog(`Fout: ${err.message || 'Er is een fout opgetreden'}`, 'error')
      setError(err.message || 'Er is een fout opgetreden')
      addLog('=== Analyse Mislukt ===', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Trophy size={32} className={styles.titleIcon} />
            Search amazon.nl Product Winners
          </h1>
          <p className={styles.subtitle}>
            Analyseer verkoopdata van Amazon producten om bestsellers en winnaars te vinden
          </p>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label htmlFor="amazon-url" className={styles.label}>
              Amazon.nl Product URL
            </label>
            <input
              id="amazon-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.nl/dp/B08N5WRWNW of https://www.amazon.nl/product/..."
              className={styles.input}
              disabled={loading}
            />
            <p className={styles.helpText}>
              Voer een Amazon.nl product URL in om verkoopdata te analyseren (bestseller status, sales rank, rankings)
            </p>
          </div>

          <div className={styles.buttonGroup}>
            <button
              onClick={handleScrape}
              className={styles.scrapeButton}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Analyseren...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Analyseren
                </>
              )}
            </button>
            {logs.length > 0 && (
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={styles.logToggleButton}
              >
                {showLogs ? 'Verberg' : 'Toon'} Logs ({logs.length})
              </button>
            )}
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        {productData && (
          <div className={styles.resultsContainer}>
            <h2>Product Verkoopdata</h2>
            
            <div className={styles.productInfo}>
              <div className={styles.productHeader}>
                <h3>{productData.title || 'Geen titel'}</h3>
                {productData.salesIndicators.isBestseller && (
                  <span className={styles.bestsellerBadge}>
                    <Trophy size={16} />
                    Bestseller
                  </span>
                )}
              </div>

              <div className={styles.productDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>ASIN:</span>
                  <span className={styles.detailValue}>{productData.asin}</span>
                </div>
                {productData.ean && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>EAN:</span>
                    <span className={styles.detailValue}>{productData.ean}</span>
                  </div>
                )}
                {productData.price !== null && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Prijs:</span>
                    <span className={styles.detailValue}>
                      {productData.currency} {productData.price.toFixed(2)}
                    </span>
                  </div>
                )}
                {productData.rating !== null && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Beoordeling:</span>
                    <span className={styles.detailValue}>
                      ⭐ {productData.rating} / 5
                      {productData.reviewCount !== null && (
                        <span className={styles.reviewCount}>
                          {' '}({productData.reviewCount.toLocaleString()} reviews)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.salesData}>
                <h4>Verkoopindicatoren</h4>
                <div className={styles.salesIndicators}>
                  {productData.salesIndicators.salesRank !== null && (
                    <div className={styles.salesIndicator}>
                      <span className={styles.indicatorLabel}>Sales Rank:</span>
                      <span className={styles.indicatorValue}>
                        #{productData.salesIndicators.salesRank.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {productData.salesIndicators.categoryRank !== null && (
                    <div className={styles.salesIndicator}>
                      <span className={styles.indicatorLabel}>Categorie Rank:</span>
                      <span className={styles.indicatorValue}>
                        #{productData.salesIndicators.categoryRank.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {productData.salesIndicators.salesText && (
                    <div className={styles.salesIndicator}>
                      <span className={styles.indicatorLabel}>Sales Text:</span>
                      <span className={styles.indicatorValue}>
                        {productData.salesIndicators.salesText}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.productActions}>
                <a
                  href={productData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.viewButton}
                >
                  Bekijk op Amazon.nl
                </a>
              </div>
            </div>
          </div>
        )}

        {showLogs && logs.length > 0 && (
          <div className={styles.logsContainer} id="logs-container">
            <div className={styles.logsHeader}>
              <h3>Analyse Logs</h3>
              <button onClick={() => setShowLogs(false)} className={styles.logsClose}>×</button>
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
