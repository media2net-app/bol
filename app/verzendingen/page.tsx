'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Shipment {
  shipmentId: string
  shipmentDateTime?: string
  shipmentItems: Array<{
    orderItemId: string
    ean: string
    quantity: number
  }>
  transport: {
    transportId?: string
    transporterCode?: string
    trackAndTrace?: string
  }
  customerDetails?: {
    firstName?: string
    surname?: string
    email?: string
  }
}

export default function VerzendingenPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
    fetchShipments()
  }, [router])

  const fetchShipments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/shipments')
      const result = await response.json()

      if (response.ok && result.success) {
        setShipments(result.data.shipments || [])
      } else {
        setError(result.error || 'Kon verzendingen niet ophalen')
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
        <div className={styles.loading}>Verzendingen ophalen...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Verzendingen</h1>
        <button onClick={fetchShipments} className={styles.refreshButton}>
          <RefreshCw size={16} />
          Vernieuwen
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableContainer}>
        <h2>Alle Verzendingen ({shipments.length})</h2>
        {shipments.length === 0 ? (
          <p className={styles.empty}>Geen verzendingen gevonden</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Datum</th>
                  <th>Klant</th>
                  <th>Items</th>
                  <th>Vervoerder</th>
                  <th>Track & Trace</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.shipmentId}>
                    <td className={styles.monoFont}>{shipment.shipmentId}</td>
                    <td>
                      {shipment.shipmentDateTime
                        ? new Date(shipment.shipmentDateTime).toLocaleString('nl-NL')
                        : 'N/A'}
                    </td>
                    <td>
                      {shipment.customerDetails
                        ? `${shipment.customerDetails.firstName || ''} ${shipment.customerDetails.surname || ''}`.trim() || 'N/A'
                        : 'N/A'}
                    </td>
                    <td>{shipment.shipmentItems?.length || 0} items</td>
                    <td>{shipment.transport?.transporterCode || 'N/A'}</td>
                    <td>{shipment.transport?.trackAndTrace || 'N/A'}</td>
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

