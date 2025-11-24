'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Offer {
  offerId: string
  ean: string
  condition: {
    name: string
    category: string
  }
  pricing: {
    bundlePrices: Array<{
      quantity: number
      price: number
    }>
  }
  stock: {
    amount: number
    managedByRetailer: boolean
  }
  fulfilment: {
    method: string
  }
  onHoldByRetailer: boolean
  unknownProductTitle?: string
  reference?: string
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }

    requestOffersExport()
  }, [router])

  const requestOffersExport = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[Offers Page] Requesting offers export...')
      
      const response = await fetch('/api/offers', {
        method: 'POST',
      })
      
      console.log('[Offers Page] Response status:', response.status)
      const result = await response.json()
      console.log('[Offers Page] Response data:', result)

      if (response.ok && result.success) {
        setExportStatus({
          processStatusId: result.data.processStatusId,
          status: 'requested',
        })
        // Check status immediately
        checkExportStatus(result.data.processStatusId)
      } else {
        let errorMessage = result.error || result.message || 'Kon offers export niet aanvragen'
        if (result.details) {
          errorMessage += ` (${result.details})`
        }
        console.error('[Offers Page] Error:', errorMessage)
        setError(errorMessage)
      }
    } catch (err: any) {
      console.error('[Offers Page] Exception:', err)
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  const checkExportStatus = async (processStatusId: string) => {
    try {
      const response = await fetch(`/api/offers?processStatusId=${processStatusId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        if (result.data.status === 'SUCCESS' && result.data.entityId) {
          // Export is ready, fetch the export file
          fetchExportFile(result.data.entityId)
        } else {
          // Still processing, check again in a few seconds
          setTimeout(() => checkExportStatus(processStatusId), 3000)
        }
      }
    } catch (err: any) {
      console.error('Error checking export status:', err)
    }
  }

  const fetchExportFile = async (exportId: string) => {
    try {
      const response = await fetch(`/api/offers?exportId=${exportId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        // Parse CSV or JSON export data
        // For now, we'll assume it's structured data
        if (result.data.offers) {
          setOffers(result.data.offers)
        } else if (result.data) {
          // Handle CSV or other formats
          setOffers([])
        }
        setExportStatus({
          ...exportStatus,
          status: 'completed',
        })
      }
    } catch (err: any) {
      setError(err.message || 'Kon export file niet ophalen')
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Offers ophalen...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Offers (Producten)</h1>
        <button onClick={requestOffersExport} className={styles.refreshButton}>
          <RefreshCw size={16} />
          Vernieuwen
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {exportStatus && (
        <div className={styles.exportStatus}>
          <h3>Export Status</h3>
          <p>
            {exportStatus.status === 'requested' && 'Export wordt voorbereid...'}
            {exportStatus.status === 'completed' && 'Export voltooid'}
          </p>
          {exportStatus.processStatusId && (
            <button
              onClick={() => checkExportStatus(exportStatus.processStatusId)}
              className={styles.checkButton}
            >
              Check Status
            </button>
          )}
        </div>
      )}

      <div className={styles.offersList}>
        <h2>Alle Offers ({offers.length})</h2>
        {offers.length === 0 ? (
          <div className={styles.empty}>
            <p>Geen offers gevonden.</p>
            <p className={styles.emptyNote}>
              Offers worden opgehaald via export file. Dit kan even duren.
            </p>
          </div>
        ) : (
          <div className={styles.offersGrid}>
            {offers.map((offer) => (
              <div key={offer.offerId} className={styles.offerCard}>
                <div className={styles.offerHeader}>
                  <h3>{offer.unknownProductTitle || `Offer ${offer.offerId.substring(0, 8)}`}</h3>
                  {offer.onHoldByRetailer && (
                    <span className={styles.onHold}>On Hold</span>
                  )}
                </div>
                <div className={styles.offerDetails}>
                  <div className={styles.detailRow}>
                    <strong>Offer ID:</strong>
                    <span>{offer.offerId}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <strong>EAN:</strong>
                    <span>{offer.ean}</span>
                  </div>
                  {offer.reference && (
                    <div className={styles.detailRow}>
                      <strong>Referentie:</strong>
                      <span>{offer.reference}</span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <strong>Voorraad:</strong>
                    <span>{offer.stock.amount}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Fulfilment:</strong>
                    <span>{offer.fulfilment.method}</span>
                  </div>
                  {offer.pricing?.bundlePrices && offer.pricing.bundlePrices.length > 0 && (
                    <div className={styles.pricing}>
                      <strong>Prijzen:</strong>
                      <ul>
                        {offer.pricing.bundlePrices.map((bundle, idx) => (
                          <li key={idx}>
                            {bundle.quantity}x: €{bundle.price.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

