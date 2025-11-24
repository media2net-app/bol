'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

export default function StatistiekenPage() {
  const [performance, setPerformance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    fetchPerformance()
  }, [router])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/performance')
      const result = await response.json()

      if (response.ok && result.success) {
        setPerformance(result.data)
      } else {
        setError(result.error || 'Kon statistieken niet ophalen')
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
        <h1>Statistieken & Performance</h1>
        <button 
          onClick={fetchPerformance} 
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
        <div className={styles.loading}>Statistieken ophalen...</div>
      )}

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <h2>Performance Indicators</h2>
          <p>De Performance Indicators API biedt inzicht in:</p>
          <ul className={styles.list}>
            <li>Verkoop prestaties</li>
            <li>Order volumes</li>
            <li>Retour percentages</li>
            <li>Klanttevredenheid</li>
            <li>Fulfilment performance</li>
          </ul>
          
          {performance && (
            <div className={styles.performanceData}>
              <h3>Performance Data</h3>
              <pre className={styles.jsonData}>
                {JSON.stringify(performance, null, 2)}
              </pre>
            </div>
          )}

          {!loading && !performance && !error && (
            <div className={styles.empty}>
              <p>Klik op "Vernieuwen" om performance data op te halen.</p>
              <p className={styles.emptyNote}>
                Performance indicators worden opgehaald via de Performance API. 
                Deze data geeft inzicht in je verkoop prestaties en order volumes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

