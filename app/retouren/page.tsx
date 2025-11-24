'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Return {
  returnId: string
  orderId: string
  orderItemId: string
  ean: string
  quantity: number
  registrationDateTime: string
  returnReason?: {
    mainReason?: string
    detailedReason?: string
  }
  handlingResult?: string
  processingDateTime?: string
}

export default function RetourenPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    fetchReturns()
  }, [router])

  const fetchReturns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/returns')
      const result = await response.json()

      if (response.ok && result.success) {
        setReturns(result.data.returns || [])
      } else {
        setError(result.error || 'Kon retouren niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Retouren ophalen...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Retouren</h1>
        <button onClick={fetchReturns} className={styles.refreshButton}>
          <RefreshCw size={16} />
          Vernieuwen
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableContainer}>
        <h2>Alle Retouren ({returns.length})</h2>
        {returns.length === 0 ? (
          <p className={styles.empty}>Geen retouren gevonden</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Order ID</th>
                  <th>EAN</th>
                  <th>Aantal</th>
                  <th>Registratiedatum</th>
                  <th>Reden</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((returnItem) => (
                  <tr key={returnItem.returnId}>
                    <td className={styles.monoFont}>{returnItem.returnId}</td>
                    <td className={styles.monoFont}>{returnItem.orderId}</td>
                    <td>{returnItem.ean}</td>
                    <td>{returnItem.quantity}</td>
                    <td>
                      {new Date(returnItem.registrationDateTime).toLocaleString('nl-NL')}
                    </td>
                    <td>{returnItem.returnReason?.mainReason || 'N/A'}</td>
                    <td>
                      <span className={styles.statusBadge}>
                        {returnItem.handlingResult || 'In behandeling'}
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
  )
}

