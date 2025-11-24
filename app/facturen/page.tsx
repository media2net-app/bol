'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Invoice {
  invoiceId: string
  invoiceDate: string
  invoiceNumber: string
  invoiceType: string
  totalAmount: number
  currency: string
}

export default function FacturenPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    fetchInvoices()
  }, [router])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/invoices')
      const result = await response.json()

      if (response.ok && result.success) {
        setInvoices(result.data.invoices || [])
      } else {
        setError(result.error || 'Kon facturen niet ophalen')
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
        <h1>Facturen</h1>
        <button 
          onClick={fetchInvoices} 
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
        <div className={styles.loading}>Facturen ophalen...</div>
      )}

      <div className={styles.tableContainer}>
        <h2>Alle Facturen ({invoices.length})</h2>
        {loading ? (
          <div className={styles.empty}>
            <p>Data ophalen...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className={styles.empty}>
            <p>Geen facturen gevonden.</p>
            <p className={styles.emptyNote}>
              Facturen worden automatisch gegenereerd door bol.com voor commissies, verzendkosten en andere transacties.
              Facturen worden meestal aan het einde van de maand gegenereerd.
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Factuurnummer</th>
                  <th>Datum</th>
                  <th>Type</th>
                  <th>Bedrag</th>
                  <th>Valuta</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoiceId}>
                    <td className={styles.monoFont}>{invoice.invoiceNumber || invoice.invoiceId}</td>
                    <td>
                      {invoice.invoiceDate
                        ? new Date(invoice.invoiceDate).toLocaleDateString('nl-NL')
                        : 'N/A'}
                    </td>
                    <td>{invoice.invoiceType || 'N/A'}</td>
                    <td><strong>€{invoice.totalAmount?.toFixed(2) || '0.00'}</strong></td>
                    <td>{invoice.currency || 'EUR'}</td>
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

