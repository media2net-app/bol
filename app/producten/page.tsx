'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Search, Info } from 'lucide-react'
import styles from './page.module.css'

export default function ProductenPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    
    // Laad initiële info
    loadInfo()
  }, [router])

  const loadInfo = async () => {
    try {
      const response = await fetch('/api/products')
      const result = await response.json()

      if (response.ok && result.success) {
        if (result.data?.products && result.data.products.length > 0) {
          setProducts(result.data.products)
        }
        if (result.data?.info) {
          setInfo(result.data.info)
        }
      }
    } catch (err: any) {
      console.error('Failed to load products info:', err)
    }
  }

  const searchProducts = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!searchTerm.trim()) {
      setError('Voer een zoekterm in (EAN, product ID, of titel)')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setInfo(null)

      // POST /retailer/products/list met search filters
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Probeer EAN eerst
          ean: searchTerm.trim(),
          // Of gebruik title search
          // title: searchTerm.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // De response structuur kan variëren
        const productsList = result.data?.products || result.data?.productIds || []
        setProducts(productsList)
        
        if (productsList.length === 0) {
          setInfo('Geen producten gevonden. Probeer een andere zoekterm of gebruik de Product Content pagina voor product content beheer.')
        }
      } else {
        setError(result.error || 'Kon producten niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Producten</h1>
        <p className={styles.subtitle}>Zoek en bekijk product informatie</p>
      </div>

      <div className={styles.content}>
        <div className={styles.searchSection}>
          <h2>Product Zoeken</h2>
          <p className={styles.description}>
            Zoek producten op EAN, Product ID of titel. De Products API vereist een POST request met filters.
          </p>
          <form onSubmit={searchProducts} className={styles.searchForm}>
            <div className={styles.searchInputGroup}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op EAN, Product ID of titel..."
                className={styles.searchInput}
                disabled={loading}
              />
              <button
                type="submit"
                className={styles.searchButton}
                disabled={loading || !searchTerm.trim()}
              >
                {loading ? (
                  <RefreshCw size={16} className={styles.spinning} />
                ) : (
                  <Search size={16} />
                )}
                Zoeken
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className={styles.error}>
            <strong>Fout:</strong> {error}
          </div>
        )}

        {info && (
          <div className={styles.infoBox}>
            <Info size={16} />
            <span>{info}</span>
          </div>
        )}

        <div className={styles.tableContainer}>
          <h2>Gevonden Producten ({products.length})</h2>
          {loading ? (
            <div className={styles.empty}>
              <p>Producten ophalen...</p>
            </div>
          ) : products.length === 0 ? (
            <div className={styles.empty}>
              <p>Geen producten gevonden.</p>
              <p className={styles.emptyNote}>
                Voer een EAN, Product ID of titel in de zoekbalk hierboven in om producten te zoeken.
                De Products API vereist specifieke filters om producten op te halen.
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Product ID / EAN</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, idx) => (
                    <tr key={idx}>
                      <td>{product.productId || product.ean || product.id || 'N/A'}</td>
                      <td>
                        <pre className={styles.jsonData}>
                          {JSON.stringify(product, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.infoCard}>
          <h2>Producten API</h2>
          <p>De Products API biedt toegang tot productinformatie. Gebruik de zoekfunctie hierboven om producten te vinden op basis van:</p>
          <ul className={styles.list}>
            <li><strong>EAN:</strong> European Article Number</li>
            <li><strong>Product ID:</strong> Bol.com product identifier</li>
            <li><strong>Titel:</strong> Product naam</li>
          </ul>
          <p><strong>Tip:</strong> Gebruik de <a href="/product-content" className={styles.link}>Product Content</a> pagina voor het beheren van product content en upload reports.</p>
        </div>
      </div>
    </div>
  )
}

