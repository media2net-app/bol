'use client'

import { useState } from 'react'
import { Download, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

interface ProductInfo {
  asin: string
  url: string
  title: string | null
  price: number | null
  originalPrice: string | null
  currency: string
  availability: string | null
  rating: number | null
  reviewCount: number | null
  images: string[]
  description: string | null
  brand: string | null
  category: string | null
  dimensions: string | null
  weight: string | null
  ean: string | null
  scrapedAt: string
}

export default function ScraperPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Voer een Amazon URL in')
      return
    }

    setLoading(true)
    setError(null)
    setProductInfo(null)

    try {
      const response = await fetch('/api/scraper/amazon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Scraping mislukt')
      }

      setProductInfo(data.data)
      setSuccess(null)
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het scrapen')
      setSuccess(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!productInfo) {
      setError('Geen product om op te slaan')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Get existing products from localStorage
      const existingProductsJson = localStorage.getItem('scrapedProducts')
      const existingProducts: ProductInfo[] = existingProductsJson 
        ? JSON.parse(existingProductsJson) 
        : []

      // Check if product already exists (by ASIN)
      const existingIndex = existingProducts.findIndex(p => p.asin === productInfo.asin)

      // Create product with unique ID
      const productToSave: ProductInfo & { id: string; savedAt: string } = {
        ...productInfo,
        id: existingIndex >= 0 
          ? (existingProducts[existingIndex] as any).id 
          : `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: new Date().toISOString(),
      }

      if (existingIndex >= 0) {
        // Update existing product
        existingProducts[existingIndex] = productToSave
      } else {
        // Add new product
        existingProducts.push(productToSave)
      }

      // Save to localStorage
      localStorage.setItem('scrapedProducts', JSON.stringify(existingProducts))

      setSuccess(existingIndex >= 0 ? 'Product bijgewerkt!' : 'Product opgeslagen!')
      
      // Optionally redirect to scraped products page after a short delay
      setTimeout(() => {
        router.push('/scraped-products')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Amazon Product Scraper</h1>
        <p className={styles.subtitle}>Voer een Amazon product URL in om product informatie op te halen</p>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.formGroup}>
            <label htmlFor="amazon-url" className={styles.label}>
              Amazon Product URL
            </label>
            <div className={styles.inputGroup}>
              <input
                id="amazon-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.amazon.nl/dp/B08..."
                className={styles.input}
                disabled={loading}
              />
              <button
                onClick={handleScrape}
                disabled={loading || !url.trim()}
                className={styles.scrapeButton}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}></span>
                    <span>Scrapen...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Scrape</span>
                  </>
                )}
              </button>
            </div>
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
            {success && (
              <div className={styles.success}>
                {success}
              </div>
            )}
          </div>
        </div>

        {productInfo && (
          <div className={styles.card}>
            <div className={styles.saveSection}>
              <button
                onClick={handleSave}
                disabled={saving}
                className={styles.saveButton}
              >
                {saving ? (
                  <>
                    <span className={styles.spinner}></span>
                    <span>Opslaan...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Product Opslaan</span>
                  </>
                )}
              </button>
              <p className={styles.saveNote}>
                Sla dit product op om het te beheren in de Scraped Products pagina
              </p>
            </div>
          </div>
        )}

        {productInfo && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Product Informatie</h2>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <td className={styles.labelCell}>ASIN</td>
                    <td className={styles.valueCell}>{productInfo.asin}</td>
                  </tr>
                  {productInfo.title && (
                    <tr>
                      <td className={styles.labelCell}>Titel</td>
                      <td className={styles.valueCell}>{productInfo.title}</td>
                    </tr>
                  )}
                  {productInfo.brand && (
                    <tr>
                      <td className={styles.labelCell}>Merk</td>
                      <td className={styles.valueCell}>{productInfo.brand}</td>
                    </tr>
                  )}
                  {productInfo.price !== null && (
                    <tr>
                      <td className={styles.labelCell}>Prijs</td>
                      <td className={styles.valueCell}>
                        {productInfo.currency} {productInfo.price.toFixed(2)}
                        {productInfo.originalPrice && (
                          <span className={styles.originalPrice}>
                            {' '}(was {productInfo.currency} {productInfo.originalPrice})
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {productInfo.availability && (
                    <tr>
                      <td className={styles.labelCell}>Beschikbaarheid</td>
                      <td className={styles.valueCell}>{productInfo.availability}</td>
                    </tr>
                  )}
                  {productInfo.rating !== null && (
                    <tr>
                      <td className={styles.labelCell}>Beoordeling</td>
                      <td className={styles.valueCell}>
                        ⭐ {productInfo.rating} / 5
                        {productInfo.reviewCount !== null && (
                          <span className={styles.reviewCount}>
                            {' '}({productInfo.reviewCount.toLocaleString()} reviews)
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  {productInfo.ean && (
                    <tr>
                      <td className={styles.labelCell}>EAN</td>
                      <td className={styles.valueCell}>{productInfo.ean}</td>
                    </tr>
                  )}
                  {productInfo.dimensions && (
                    <tr>
                      <td className={styles.labelCell}>Afmetingen</td>
                      <td className={styles.valueCell}>{productInfo.dimensions}</td>
                    </tr>
                  )}
                  {productInfo.weight && (
                    <tr>
                      <td className={styles.labelCell}>Gewicht</td>
                      <td className={styles.valueCell}>{productInfo.weight}</td>
                    </tr>
                  )}
                  {productInfo.description && (
                    <tr>
                      <td className={styles.labelCell}>Beschrijving</td>
                      <td className={styles.valueCell}>
                        <div className={styles.description}>
                          {productInfo.description.split('\n').map((paragraph, index) => (
                            paragraph.trim() && (
                              <p key={index} className={styles.descriptionParagraph}>
                                {paragraph.trim()}
                              </p>
                            )
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {productInfo.images.length > 0 && (
                    <tr>
                      <td className={styles.labelCell}>Afbeeldingen</td>
                      <td className={styles.valueCell}>
                        <div className={styles.imageGallery}>
                          {productInfo.images.length > 0 ? (
                            productInfo.images.map((imageUrl, index) => (
                              <div 
                                key={index} 
                                className={styles.imageWrapper}
                                onClick={() => setSelectedImage(imageUrl)}
                              >
                                <img 
                                  src={`/api/scraper/image-proxy?url=${encodeURIComponent(imageUrl)}`}
                                  alt={`${productInfo.title || 'Product'} - Afbeelding ${index + 1}`}
                                  className={styles.productImage}
                                  loading="lazy"
                                  onError={(e) => {
                                    // Try direct URL as fallback
                                    const target = e.target as HTMLImageElement
                                    const proxyUrl = target.src
                                    const directUrl = new URL(proxyUrl).searchParams.get('url')
                                    if (directUrl && target.src !== directUrl) {
                                      target.src = directUrl
                                      target.crossOrigin = 'anonymous'
                                      target.referrerPolicy = 'no-referrer'
                                    } else {
                                      // Hide if both fail
                                      target.style.display = 'none'
                                    }
                                  }}
                                />
                              </div>
                            ))
                          ) : (
                            <p className={styles.noImages}>Geen afbeeldingen gevonden</p>
                          )}
                        </div>
                        <p className={styles.imageCount}>
                          {productInfo.images.length} afbeelding{productInfo.images.length !== 1 ? 'en' : ''} gevonden
                        </p>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className={styles.labelCell}>URL</td>
                    <td className={styles.valueCell}>
                      <a href={productInfo.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {productInfo.url}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.labelCell}>Gescraped op</td>
                    <td className={styles.valueCell}>
                      {new Date(productInfo.scrapedAt).toLocaleString('nl-NL')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedImage && (
        <div className={styles.lightbox} onClick={() => setSelectedImage(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.lightboxClose}
              onClick={() => setSelectedImage(null)}
              aria-label="Sluiten"
            >
              ×
            </button>
            <img 
              src={`/api/scraper/image-proxy?url=${encodeURIComponent(selectedImage)}`}
              alt={productInfo?.title || 'Product afbeelding'}
              className={styles.lightboxImage}
              onError={(e) => {
                // Fallback to direct URL
                const target = e.target as HTMLImageElement
                const proxyUrl = target.src
                const directUrl = new URL(proxyUrl).searchParams.get('url')
                if (directUrl) {
                  target.src = directUrl
                  target.crossOrigin = 'anonymous'
                  target.referrerPolicy = 'no-referrer'
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

