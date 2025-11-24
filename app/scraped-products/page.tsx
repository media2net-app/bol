'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Trash2, Edit2, ExternalLink, Image as ImageIcon, Download, Zap } from 'lucide-react'
import JSZip from 'jszip'
import styles from './page.module.css'

interface ScrapedProduct {
  id: string
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
  savedAt: string
  customEan?: string
}

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export default function ScrapedProductsPage() {
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ScrapedProduct | null>(null)
  const [customEan, setCustomEan] = useState('')
  const [converting, setConverting] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showBulkConvertModal, setShowBulkConvertModal] = useState(false)
  const [bulkConverting, setBulkConverting] = useState(false)
  const [selectedProductsForBulk, setSelectedProductsForBulk] = useState<Set<string>>(new Set())
  const [availableEans, setAvailableEans] = useState<number>(0)
  const [totalEans, setTotalEans] = useState<number>(0)
  const [usedEans, setUsedEans] = useState<number>(0)
  const [imageModalProduct, setImageModalProduct] = useState<ScrapedProduct | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const openImageModal = (product: ScrapedProduct, index = 0) => {
    if (!product.images || product.images.length === 0) return
    setImageModalProduct(product)
    setActiveImageIndex(index)
  }

  const closeImageModal = () => {
    setImageModalProduct(null)
    setActiveImageIndex(0)
  }

  const changeModalImage = (index: number) => {
    if (!imageModalProduct || !imageModalProduct.images) return
    const clampedIndex = Math.max(0, Math.min(index, imageModalProduct.images.length - 1))
    setActiveImageIndex(clampedIndex)
  }

  const fetchProducts = () => {
    setLoading(true)
    setError(null)
    try {
      // Read from localStorage
      const productsJson = localStorage.getItem('scrapedProducts')
      if (productsJson) {
        const parsedProducts = JSON.parse(productsJson)
        // Ensure all products have required fields
        const validProducts = parsedProducts
          .filter((p: any) => p && p.asin && p.id)
          .map((p: any) => ({
            ...p,
            savedAt: p.savedAt || p.scrapedAt || new Date().toISOString(),
          }))
        setProducts(validProducts)
      } else {
        setProducts([])
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het ophalen van producten')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleDelete = (id: string) => {
    if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) {
      return
    }

    try {
      // Get products from localStorage
      const productsJson = localStorage.getItem('scrapedProducts')
      if (productsJson) {
        const products = JSON.parse(productsJson)
        // Filter out the product to delete
        const filteredProducts = products.filter((p: ScrapedProduct) => p.id !== id)
        // Save back to localStorage
        localStorage.setItem('scrapedProducts', JSON.stringify(filteredProducts))
        // Refresh the list
        fetchProducts()
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het verwijderen')
    }
  }

  const clearAllProducts = () => {
    if (products.length === 0) {
      return
    }
    if (!confirm(`Weet je zeker dat je alle ${products.length} producten wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return
    }

    try {
      localStorage.removeItem('scrapedProducts')
      setProducts([])
      setSelectedProductsForBulk(new Set())
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden bij het verwijderen')
    }
  }

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('nl-NL'),
      message,
      type,
    }
    setLogs(prev => {
      const newLogs = [...prev, logEntry]
      // Force re-render by returning new array
      return newLogs
    })
    // Small delay to ensure state update
    setTimeout(() => {
      const logsContainer = document.querySelector(`.${styles.modalLogsContent}`)
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight
      }
    }, 50)
  }

  const loadDummyEans = async () => {
    try {
      addLog('CSV bestand laden...', 'info')
      const response = await fetch('/dummy-eans.csv')
      const text = await response.text()
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('EAN'))
      const eans = lines.map(line => line.trim()).filter(ean => ean.length > 0)
      addLog(`${eans.length} EANs geladen uit CSV`, 'success')
      return eans
    } catch (err: any) {
      addLog(`Fout bij laden CSV: ${err.message}`, 'error')
      return []
    }
  }

  const downloadImage = async (url: string): Promise<Blob> => {
    try {
      // Use image proxy if available, otherwise direct fetch
      const proxyUrl = `/api/scraper/image-proxy?url=${encodeURIComponent(url)}`
      const response = await fetch(proxyUrl)
      
      if (!response.ok) {
        // Fallback to direct fetch if proxy fails
        const directResponse = await fetch(url, { mode: 'cors' })
        if (!directResponse.ok) {
          throw new Error(`Failed to fetch image: ${directResponse.status}`)
        }
        return await directResponse.blob()
      }
      
      return await response.blob()
    } catch (err) {
      // Try direct fetch as fallback
      try {
        const response = await fetch(url, { mode: 'cors' })
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }
        return await response.blob()
      } catch (fallbackErr) {
        throw new Error(`Could not download image: ${url}`)
      }
    }
  }

  const addImagesToZip = async (zip: JSZip, ean: string, images: string[], productTitle: string | null) => {
    const eanFolder = zip.folder(ean)
    if (!eanFolder) {
      throw new Error(`Could not create folder for EAN: ${ean}`)
    }

    addLog(`EAN ${ean}: ${images.length} afbeeldingen downloaden...`, 'info')

    for (let i = 0; i < images.length; i++) {
      const imageUrl = images[i]
      try {
        const blob = await downloadImage(imageUrl)
        // Get file extension from URL or default to jpg
        const urlParts = imageUrl.split('.')
        const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg'
        const filename = `image_${i + 1}.${extension}`
        eanFolder.file(filename, blob)
        addLog(`  ✓ ${filename}`, 'success')
      } catch (err: any) {
        addLog(`  ⚠ Fout bij downloaden afbeelding ${i + 1}: ${err.message}`, 'warning')
      }
    }

    addLog(`✓ EAN ${ean}: ${images.length} afbeeldingen toegevoegd aan ZIP`, 'success')
  }

  const handleConvertEan = async () => {
    if (!selectedProduct) {
      setError('Geen product geselecteerd')
      return
    }

    if (!customEan.trim()) {
      setError('Voer een eigen EAN in')
      return
    }

    // Clear previous state
    setError(null)
    setLogs([])
    setConverting(true)

    // Small delay to ensure state update and modal switch
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      addLog('=== EAN Conversie Proces Gestart ===', 'info')
      addLog(`Product: ${selectedProduct.title || selectedProduct.asin}`, 'info')
      addLog(`Eigen EAN: ${customEan.trim()}`, 'info')

      // Step 1: Load dummy EANs from CSV
      addLog('Stap 1: Dummy EANs laden uit CSV...', 'info')
      const dummyEans = await loadDummyEans()
      
      if (dummyEans.length === 0) {
        addLog('Geen dummy EANs gevonden, gebruik alleen ingevoerde EAN', 'warning')
      } else {
        addLog(`Stap 1 voltooid: ${dummyEans.length} dummy EANs geladen`, 'success')
      }

      // Step 2: Update product with custom EAN
      addLog('Stap 2: Product bijwerken met eigen EAN...', 'info')
      const productsJson = localStorage.getItem('scrapedProducts')
      if (productsJson) {
        const products = JSON.parse(productsJson)
        const productIndex = products.findIndex((p: ScrapedProduct) => p.id === selectedProduct.id)
        
        if (productIndex >= 0) {
          products[productIndex] = {
            ...products[productIndex],
            customEan: customEan.trim(),
          }
          localStorage.setItem('scrapedProducts', JSON.stringify(products))
          addLog('Stap 2 voltooid: Product bijgewerkt met eigen EAN', 'success')
        }
      }

      // Step 3: Create ZIP file with images
      if (selectedProduct.images && selectedProduct.images.length > 0) {
        addLog(`Stap 3: ${selectedProduct.images.length} afbeeldingen toevoegen aan ZIP...`, 'info')
        
        try {
          const zip = new JSZip()
          await addImagesToZip(zip, customEan.trim(), selectedProduct.images, selectedProduct.title)
          
          // Generate and download ZIP file
          addLog('ZIP-bestand genereren...', 'info')
          const zipBlob = await zip.generateAsync({ type: 'blob' })
          const url = URL.createObjectURL(zipBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'converted.zip'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          addLog(`Stap 3 voltooid: ZIP-bestand gedownload (converted.zip)`, 'success')
        } catch (err) {
          addLog(`Stap 3 mislukt: ${err instanceof Error ? err.message : 'Onbekende fout'}`, 'error')
        }
      } else {
        addLog('Stap 3: Geen afbeeldingen beschikbaar om toe te voegen', 'warning')
      }

      // Step 4: Finalize
      addLog('=== EAN Conversie Proces Voltooid ===', 'success')
      addLog(`Product heeft nu eigen EAN: ${customEan}`, 'success')
      addLog(`ZIP-bestand gedownload: converted.zip`, 'info')
      
      // Refresh products list
      fetchProducts()
      
      // Close modal and reset
      setTimeout(() => {
        setConverting(false)
        setShowConvertModal(false)
        setSelectedProduct(null)
        setCustomEan('')
      }, 2000)
    } catch (err: any) {
      addLog(`Fout: ${err.message}`, 'error')
      setError(err.message || 'Er is een fout opgetreden bij het converteren')
    } finally {
      setConverting(false)
    }
  }

  const handleBulkConvert = async () => {
    if (selectedProductsForBulk.size === 0) {
      setError('Selecteer minimaal één product om te converteren')
      return
    }

    setBulkConverting(true)
    setError(null)
    setLogs([])

    try {
      addLog('=== Bulk EAN Conversie Proces Gestart ===', 'info')
      addLog(`${selectedProductsForBulk.size} producten geselecteerd`, 'info')

      // Load dummy EANs from CSV
      addLog('Dummy EANs laden uit CSV...', 'info')
      const dummyEans = await loadDummyEans()
      
      if (dummyEans.length === 0) {
        addLog('Geen dummy EANs gevonden in CSV', 'error')
        setError('Geen dummy EANs beschikbaar. Voeg EANs toe aan dummy-eans.csv')
        return
      }

      addLog(`${dummyEans.length} dummy EANs geladen`, 'success')

      // Get products from localStorage
      const productsJson = localStorage.getItem('scrapedProducts')
      if (!productsJson) {
        throw new Error('Geen producten gevonden')
      }

      const allProducts: ScrapedProduct[] = JSON.parse(productsJson)
      const productsToConvert = allProducts.filter(p => selectedProductsForBulk.has(p.id))
      
      if (productsToConvert.length === 0) {
        throw new Error('Geen producten gevonden om te converteren')
      }

      // Count currently used EANs
      const usedEansCount = allProducts.filter(p => p.customEan && p.customEan.trim().length > 0).length
      const availableEansCount = dummyEans.length - usedEansCount

      // Check if enough EANs available
      if (productsToConvert.length > availableEansCount) {
        throw new Error(`Niet genoeg EANs beschikbaar. Je hebt ${availableEansCount} EANs beschikbaar, maar ${productsToConvert.length} producten geselecteerd.`)
      }

      addLog(`Start conversie van ${productsToConvert.length} producten...`, 'info')
      addLog(`Beschikbare EANs: ${availableEansCount}`, 'info')

      let eanIndex = 0
      let successCount = 0
      let errorCount = 0

      // Create ZIP file
      const zip = new JSZip()
      addLog('ZIP-bestand aanmaken...', 'info')

      for (let i = 0; i < productsToConvert.length; i++) {
        const product = productsToConvert[i]
        
      // Get next available EAN (skip already used EANs)
      // Find next EAN that's not already used
      let customEan: string | null = null
      while (eanIndex < dummyEans.length) {
        const potentialEan = dummyEans[eanIndex]
        // Check if this EAN is already used
        const isUsed = allProducts.some(p => p.customEan === potentialEan)
        if (!isUsed) {
          customEan = potentialEan
          eanIndex++
          break
        }
        eanIndex++
      }

      if (!customEan) {
        addLog(`⚠ Geen EANs meer beschikbaar. ${productsToConvert.length - i} producten overgeslagen.`, 'warning')
        break
      }

        try {
          addLog(`\n[${i + 1}/${productsToConvert.length}] Product: ${product.title || product.asin}`, 'info')
          addLog(`EAN toewijzen: ${customEan}`, 'info')

          // Update product with custom EAN
          const productIndex = allProducts.findIndex(p => p.id === product.id)
          if (productIndex >= 0) {
            allProducts[productIndex] = {
              ...allProducts[productIndex],
              customEan: customEan,
            }
            addLog(`✓ EAN toegewezen`, 'success')
          }

          // Add images to ZIP
          if (product.images && product.images.length > 0) {
            try {
              await addImagesToZip(zip, customEan, product.images, product.title)
            } catch (err: any) {
              addLog(`⚠ Fout bij toevoegen afbeeldingen aan ZIP: ${err.message}`, 'warning')
            }
          } else {
            addLog(`⚠ Geen afbeeldingen beschikbaar`, 'warning')
          }

          successCount++
        } catch (err: any) {
          addLog(`✗ Fout: ${err.message}`, 'error')
          errorCount++
        }
      }

      // Generate and download ZIP file
      addLog('\nZIP-bestand genereren...', 'info')
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(zipBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'converted.zip'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        addLog('✓ ZIP-bestand gedownload: converted.zip', 'success')
      } catch (err: any) {
        addLog(`✗ Fout bij genereren ZIP: ${err.message}`, 'error')
        throw err
      }

      // Save updated products
      localStorage.setItem('scrapedProducts', JSON.stringify(allProducts))

      addLog('\n=== Bulk Conversie Voltooid ===', 'success')
      addLog(`Succesvol: ${successCount} producten`, 'success')
      if (errorCount > 0) {
        addLog(`Fouten: ${errorCount} producten`, 'error')
      }

      // Refresh products list
      fetchProducts()
      
      // Update EAN stats
      await loadEanStats()
      
      // Clear selection
      setSelectedProductsForBulk(new Set())
      
      // Close modal after delay
      setTimeout(() => {
        setBulkConverting(false)
        setShowBulkConvertModal(false)
      }, 3000)
    } catch (err: any) {
      addLog(`Fout: ${err.message}`, 'error')
      setError(err.message || 'Er is een fout opgetreden bij bulk conversie')
    } finally {
      setBulkConverting(false)
    }
  }

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProductsForBulk)
    if (newSelection.has(productId)) {
      newSelection.delete(productId)
    } else {
      newSelection.add(productId)
    }
    setSelectedProductsForBulk(newSelection)
  }

  const selectAllProducts = () => {
    const allIds = products.map(p => p.id)
    setSelectedProductsForBulk(new Set(allIds))
  }

  const deselectAllProducts = () => {
    setSelectedProductsForBulk(new Set())
  }

  const loadEanStats = async () => {
    try {
      // Load dummy EANs from CSV
      const response = await fetch('/dummy-eans.csv')
      const text = await response.text()
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('EAN'))
      const allEans = lines.map(line => line.trim()).filter(ean => ean.length > 0)
      
      // Count used EANs (products with customEan)
      const usedEansCount = products.filter(p => p.customEan && p.customEan.trim().length > 0).length
      
      setTotalEans(allEans.length)
      setUsedEans(usedEansCount)
      setAvailableEans(allEans.length - usedEansCount)
    } catch (err) {
      console.error('Error loading EAN stats:', err)
    }
  }

  // Load EAN stats when modal opens
  useEffect(() => {
    if (showBulkConvertModal) {
      loadEanStats()
    }
  }, [showBulkConvertModal, products])

  const openConvertModal = (product: ScrapedProduct) => {
    setSelectedProduct(product)
    setCustomEan(product.customEan || '')
    setShowConvertModal(true)
    setLogs([])
    setConverting(false)
    setError(null)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scraped Products (Eigen EAN)</h1>
          <p className={styles.subtitle}>Beheer je gescrapede producten met eigen EAN codes</p>
        </div>
        <div className={styles.headerButtons}>
          <button 
            onClick={() => setShowBulkConvertModal(true)} 
            className={styles.bulkConvertButton} 
            disabled={loading || products.length === 0}
            title="Bulk convert meerdere producten tegelijk"
          >
            <Zap size={16} />
            Bulk Convert
          </button>
          <button onClick={fetchProducts} className={styles.refreshButton} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
            Vernieuwen
          </button>
          <button
            onClick={clearAllProducts}
            className={styles.clearAllButton}
            disabled={products.length === 0}
            title="Verwijder alle opgeslagen producten"
          >
            <Trash2 size={16} />
            Alles verwijderen ({products.length})
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.tableContainer}>
          <h2>Opgeslagen Producten ({products.length})</h2>
          {loading ? (
            <div className={styles.empty}>
              <p>Producten ophalen...</p>
            </div>
          ) : products.length === 0 ? (
            <div className={styles.empty}>
              <p>Geen scraped products gevonden.</p>
              <p className={styles.emptyNote}>
                Scrape een product op de Scraper pagina om het hier op te slaan.
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Afbeelding</th>
                    <th>Titel</th>
                    <th>ASIN</th>
                    <th>EAN (Origineel)</th>
                    <th>Eigen EAN</th>
                    <th>Merk</th>
                    <th>Prijs</th>
                    <th>Beoordeling</th>
                    <th>Gescraped op</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        {product.images && product.images.length > 0 ? (
                          <button
                            className={styles.imageButton}
                            onClick={() => openImageModal(product, 0)}
                            title="Bekijk alle afbeeldingen"
                          >
                            <img 
                              src={`/api/scraper/image-proxy?url=${encodeURIComponent(product.images[0])}`}
                              alt={product.title || 'Product'}
                              className={styles.productThumbnail}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          </button>
                        ) : (
                          <div className={styles.noImage}>
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.titleCell}>
                          <strong>{product.title || 'Geen titel'}</strong>
                          {product.description && (
                            <span className={styles.descriptionPreview}>
                              {product.description.substring(0, 100)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.monoFont}>{product.asin}</td>
                      <td className={styles.monoFont}>{product.ean || 'N/A'}</td>
                      <td className={styles.monoFont}>
                        {product.customEan || (
                          <span className={styles.noCustomEan}>Niet ingesteld</span>
                        )}
                      </td>
                      <td>{product.brand || 'N/A'}</td>
                      <td>
                        {product.price !== null ? (
                          <div>
                            <strong>{product.currency} {product.price.toFixed(2)}</strong>
                            {product.originalPrice && (
                              <div className={styles.originalPrice}>
                                was {product.currency} {product.originalPrice}
                              </div>
                            )}
                          </div>
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
                        {new Date(product.scrapedAt).toLocaleString('nl-NL')}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            onClick={() => openConvertModal(product)}
                            className={styles.actionButton}
                            title="Convert EAN"
                          >
                            <Edit2 size={16} />
                          </button>
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionButton}
                            title="Bekijk op Amazon"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className={styles.actionButton}
                            title="Verwijderen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Convert EAN Modal */}
      {showConvertModal && selectedProduct && (
        <div className={styles.modalOverlay} onClick={() => !converting && setShowConvertModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Convert EAN</h2>
              <button 
                onClick={() => setShowConvertModal(false)} 
                className={styles.modalClose}
                disabled={converting}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              {converting || logs.length > 0 ? (
                <div className={styles.modalLogsContainer}>
                  <div className={styles.modalLogsHeader}>
                    <h3>Conversie Logs</h3>
                    {converting && (
                      <div className={styles.convertingIndicator}>
                        <span className={styles.spinner}></span>
                        <span>Converteren...</span>
                      </div>
                    )}
                  </div>
                  {error && (
                    <div className={styles.error}>
                      {error}
                    </div>
                  )}
                  <div 
                    className={styles.modalLogsContent}
                    ref={(el) => {
                      // Auto-scroll to bottom when new logs are added
                      if (el && logs.length > 0) {
                        el.scrollTop = el.scrollHeight
                      }
                    }}
                  >
                    {logs.length === 0 && converting ? (
                      <div className={styles.noLogs}>
                        <span className={styles.spinner}></span>
                        <span>Proces starten...</span>
                      </div>
                    ) : logs.length === 0 ? (
                      <div className={styles.noLogs}>
                        <span>Geen logs beschikbaar</span>
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
                  {!converting && logs.length > 0 && (
                    <div className={styles.modalActions}>
                      <button
                        onClick={() => {
                          setShowConvertModal(false)
                          setLogs([])
                          setCustomEan('')
                          setSelectedProduct(null)
                          setError(null)
                        }}
                        className={styles.closeButton}
                      >
                        Sluiten
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.modalProductInfo}>
                    <h3>{selectedProduct.title || 'Product'}</h3>
                    <p><strong>ASIN:</strong> {selectedProduct.asin}</p>
                    <p><strong>Originele EAN:</strong> {selectedProduct.ean || 'N/A'}</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="custom-ean" className={styles.label}>
                      Eigen EAN *
                    </label>
                    <input
                      id="custom-ean"
                      type="text"
                      value={customEan}
                      onChange={(e) => setCustomEan(e.target.value)}
                      placeholder="Bijv. 8712345678901"
                      className={styles.input}
                      disabled={converting}
                    />
                    <p className={styles.helpText}>
                      Voer een eigen EAN in. Afbeeldingen worden opgeslagen in: <strong>Converted/{'{EAN}'}</strong>
                    </p>
                  </div>

                  {error && (
                    <div className={styles.error}>
                      {error}
                    </div>
                  )}

                  <div className={styles.modalActions}>
                    <button
                      onClick={handleConvertEan}
                      disabled={converting || !customEan.trim()}
                      className={styles.convertButton}
                    >
                      <Download size={18} />
                      Convert EAN & Opslaan Afbeeldingen
                    </button>
                    <button
                      onClick={() => setShowConvertModal(false)}
                      className={styles.cancelButton}
                      disabled={converting}
                    >
                      Annuleren
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Convert Modal */}
      {showBulkConvertModal && (
        <div className={styles.modalOverlay} onClick={() => !bulkConverting && setShowBulkConvertModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>Bulk Convert EAN</h2>
              <button 
                onClick={() => !bulkConverting && setShowBulkConvertModal(false)}
                className={styles.modalClose}
                disabled={bulkConverting}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              {bulkConverting || logs.length > 0 ? (
                <div className={styles.modalLogsContainer}>
                  <div className={styles.modalLogsHeader}>
                    <h3>Bulk Conversie Logs</h3>
                    {bulkConverting && (
                      <div className={styles.convertingIndicator}>
                        <span className={styles.spinner}></span>
                        <span>Converteren...</span>
                      </div>
                    )}
                  </div>
                  <div 
                    className={styles.modalLogsContent}
                    ref={(el) => {
                      if (el && logs.length > 0) {
                        el.scrollTop = el.scrollHeight
                      }
                    }}
                  >
                    {logs.map(log => (
                      <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                        <span className={styles.logTimestamp}>[{log.timestamp}]</span>
                        <span className={styles.logMessage}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                  {!bulkConverting && logs.length > 0 && (
                    <div className={styles.modalActions}>
                      <button
                        onClick={() => {
                          setShowBulkConvertModal(false)
                          setLogs([])
                          setSelectedProductsForBulk(new Set())
                        }}
                        className={styles.closeButton}
                      >
                        Sluiten
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.bulkConvertInfo}>
                    <p>Selecteer de producten die je wilt converteren. EANs worden automatisch toegewezen uit het CSV bestand.</p>
                    <div className={styles.eanStats}>
                      <div className={styles.eanStatItem}>
                        <span className={styles.eanStatLabel}>Totaal EANs:</span>
                        <span className={styles.eanStatValue}>{totalEans.toLocaleString()}</span>
                      </div>
                      <div className={styles.eanStatItem}>
                        <span className={styles.eanStatLabel}>Gebruikt:</span>
                        <span className={styles.eanStatValue}>{usedEans.toLocaleString()}</span>
                      </div>
                      <div className={styles.eanStatItem}>
                        <span className={styles.eanStatLabel}>Beschikbaar:</span>
                        <span className={`${styles.eanStatValue} ${availableEans < selectedProductsForBulk.size ? styles.warning : styles.success}`}>
                          {availableEans.toLocaleString()}
                        </span>
                      </div>
                      {availableEans < selectedProductsForBulk.size && (
                        <div className={styles.eanWarning}>
                          ⚠ Niet genoeg EANs beschikbaar! Selecteer maximaal {availableEans} producten.
                        </div>
                      )}
                    </div>
                    <div className={styles.bulkConvertActions}>
                      <button onClick={selectAllProducts} className={styles.selectAllButton}>
                        Selecteer Alles
                      </button>
                      <button onClick={deselectAllProducts} className={styles.deselectAllButton}>
                        Deselecteer Alles
                      </button>
                      <span className={styles.selectionCount}>
                        {selectedProductsForBulk.size} van {products.length} geselecteerd
                      </span>
                    </div>
                  </div>
                  <div className={styles.bulkProductList}>
                    {products.map(product => (
                      <div 
                        key={product.id} 
                        className={`${styles.bulkProductItem} ${selectedProductsForBulk.has(product.id) ? styles.selected : ''}`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductsForBulk.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className={styles.bulkProductInfo}>
                          <strong>{product.title || product.asin}</strong>
                          <span className={styles.bulkProductDetails}>
                            ASIN: {product.asin} | {product.customEan ? `EAN: ${product.customEan}` : 'Geen EAN'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.modalActions}>
                    <button
                      onClick={() => setShowBulkConvertModal(false)}
                      className={styles.cancelButton}
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={handleBulkConvert}
                      disabled={selectedProductsForBulk.size === 0 || availableEans < selectedProductsForBulk.size}
                      className={styles.convertButton}
                      title={availableEans < selectedProductsForBulk.size ? `Niet genoeg EANs beschikbaar. Selecteer maximaal ${availableEans} producten.` : ''}
                    >
                      Start Bulk Convert ({selectedProductsForBulk.size})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {imageModalProduct && imageModalProduct.images && imageModalProduct.images.length > 0 && (
        <div className={styles.imageModalOverlay} onClick={closeImageModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <div>
                <h3>{imageModalProduct.title || imageModalProduct.asin}</h3>
                <p>{imageModalProduct.images.length} afbeeldingen</p>
              </div>
              <button className={styles.modalClose} onClick={closeImageModal}>
                ×
              </button>
            </div>
            <div className={styles.imageModalContent}>
              <div className={styles.imagePreviewMain}>
                <img
                  src={`/api/scraper/image-proxy?url=${encodeURIComponent(
                    imageModalProduct.images[activeImageIndex]
                  )}`}
                  alt={`Preview ${activeImageIndex + 1}`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.opacity = '0.3'
                    target.alt = 'Afbeelding kan niet worden geladen'
                  }}
                />
              </div>
              <div className={styles.imagePreviewThumbs}>
                {imageModalProduct.images.map((imageUrl, index) => (
                  <button
                    key={`${imageModalProduct.id}_${index}`}
                    className={`${styles.imageThumb} ${index === activeImageIndex ? styles.imageThumbActive : ''}`}
                    onClick={() => changeModalImage(index)}
                    title={`Afbeelding ${index + 1}`}
                  >
                    <img
                      src={`/api/scraper/image-proxy?url=${encodeURIComponent(imageUrl)}`}
                      alt={`Thumb ${index + 1}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

