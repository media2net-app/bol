'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Replenishment {
  replenishmentId: string
  creationDateTime: string
  reference: string
  labelingByBol: boolean
  state: string
}

export default function LogistiekPage() {
  const [replenishments, setReplenishments] = useState<Replenishment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    // Start met loading false, dan fetch
    fetchReplenishments()
  }, [router])

  const fetchReplenishments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/replenishments')
      const result = await response.json()

      if (response.ok && result.success) {
        setReplenishments(result.data.replenishments || [])
      } else {
        setError(result.error || 'Kon replenishments niet ophalen')
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
        <h1>Logistiek (Fulfillment by bol)</h1>
        <button 
          onClick={fetchReplenishments} 
          className={styles.refreshButton}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          {loading ? 'Ophalen...' : 'Vernieuwen'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <strong>Fout:</strong> {error}
        </div>
      )}

      {loading && !error && (
        <div className={styles.loading}>Logistiek data ophalen...</div>
      )}

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <h2>FBB Logistiek</h2>
          <p>Bij Fulfillment by bol (FBB) beheert bol.com de logistiek voor je.</p>
          <p>Hier zie je:</p>
          <ul className={styles.list}>
            <li>Voorraad in bol distributiecentrum</li>
            <li>Replenishments (vooraanmeldingen)</li>
            <li>Bestellingen die bol voor je behandelt</li>
          </ul>
        </div>

        <div className={styles.tableContainer}>
          <h2>Replenishments ({replenishments.length})</h2>
          {loading ? (
            <div className={styles.empty}>
              <p>Data ophalen...</p>
            </div>
          ) : replenishments.length === 0 ? (
            <div className={styles.empty}>
              <p>Geen replenishments gevonden.</p>
              <p className={styles.emptyNote}>
                Replenishments worden getoond wanneer je producten naar het bol.com distributiecentrum stuurt voor Fulfillment by bol (FBB).
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Replenishment ID</th>
                    <th>Referentie</th>
                    <th>Aanmaakdatum</th>
                    <th>Labeling door bol</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {replenishments.map((replenishment) => (
                    <tr key={replenishment.replenishmentId}>
                      <td className={styles.monoFont}>{replenishment.replenishmentId}</td>
                      <td>{replenishment.reference || 'N/A'}</td>
                      <td>
                        {replenishment.creationDateTime
                          ? new Date(replenishment.creationDateTime).toLocaleString('nl-NL')
                          : 'N/A'}
                      </td>
                      <td>{replenishment.labelingByBol ? 'Ja' : 'Nee'}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          {replenishment.state || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

