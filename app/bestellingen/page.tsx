'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X } from 'lucide-react'
import styles from './page.module.css'

interface OrderItem {
  orderItemId: string
  ean: string
  quantity: number
  quantityShipped?: number
  quantityCancelled?: number
  offerReference?: string
  fulfilment: {
    method: string
  }
  fulfilmentStatus?: string
  unitPrice?: number
  commission?: number
  latestChangedDateTime?: string
  cancellationRequest?: {
    dateTime?: string
    reasonCode?: string
  }
  fulfilmentMethod?: string
}

interface Order {
  orderId: string
  orderPlacedDateTime: string
  orderItems: OrderItem[]
  shipmentDetails?: {
    shipmentId?: string
    shipmentDateTime?: string
    transporterCode?: string
    trackAndTrace?: string
  }
  customerDetails?: {
    salutationCode?: string
    firstName?: string
    surname?: string
    streetName?: string
    houseNumber?: string
    houseNumberExtension?: string
    zipCode?: string
    city?: string
    countryCode?: string
    email?: string
    deliveryPhoneNumber?: string
  }
  billingDetails?: {
    salutationCode?: string
    firstName?: string
    surname?: string
    streetName?: string
    houseNumber?: string
    zipCode?: string
    city?: string
    countryCode?: string
  }
  expiryDate?: string
}

export default function BestellingenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }

    fetchOrders()
  }, [router])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use dedicated orders API endpoint
      const response = await fetch('/api/orders?fulfilment-method=ALL&status=OPEN')
      const result = await response.json()

      if (response.ok && result.success && result.data?.orders) {
        setOrders(result.data.orders)
      } else if (response.ok && result.success && result.data) {
        // Handle case where data is directly the orders array
        setOrders(Array.isArray(result.data) ? result.data : [])
      } else {
        setError(result.error || result.message || 'Kon orders niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setSelectedOrder(result.data)
      } else {
        setError(result.error || 'Kon order details niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    }
  }

  const handleOrderClick = (order: Order) => {
    if (selectedOrder?.orderId === order.orderId) {
      setSelectedOrder(null)
    } else {
      fetchOrderDetails(order.orderId)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Orders ophalen...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Bestellingen</h1>
        <button onClick={fetchOrders} className={styles.refreshButton}>
          <RefreshCw size={16} />
          Vernieuwen
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.ordersTableContainer}>
          <h2>Alle Bestellingen ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className={styles.empty}>Geen orders gevonden</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Datum</th>
                    <th>Klant</th>
                    <th>Email</th>
                    <th>Adres</th>
                    <th>Items</th>
                    <th>Fulfilment</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const customerName = order.customerDetails 
                      ? `${order.customerDetails.firstName || ''} ${order.customerDetails.surname || ''}`.trim()
                      : 'N/A'
                    const address = order.customerDetails
                      ? `${order.customerDetails.streetName || ''} ${order.customerDetails.houseNumber || ''}${order.customerDetails.houseNumberExtension || ''}, ${order.customerDetails.zipCode || ''} ${order.customerDetails.city || ''}`
                      : 'N/A'
                    const totalItems = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
                    const fulfilmentMethod = order.orderItems[0]?.fulfilment?.method || 'N/A'
                    
                    return (
                      <tr 
                        key={order.orderId}
                        className={selectedOrder?.orderId === order.orderId ? styles.selectedRow : ''}
                      >
                        <td className={styles.orderIdCell}>
                          <strong>{order.orderId}</strong>
                        </td>
                        <td>
                          {new Date(order.orderPlacedDateTime).toLocaleString('nl-NL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>{customerName || 'N/A'}</td>
                        <td>{order.customerDetails?.email || 'N/A'}</td>
                        <td className={styles.addressCell}>{address}</td>
                        <td>
                          <span className={styles.itemsBadge}>
                            {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                            <span className={styles.totalQty}>({totalItems} stuks)</span>
                          </span>
                        </td>
                        <td>
                          <span className={styles.fulfilmentBadge}>
                            {fulfilmentMethod}
                          </span>
                        </td>
                        <td>
                          <span className={styles.statusBadge}>
                            Open
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleOrderClick(order)}
                            className={styles.detailsButton}
                          >
                            {selectedOrder?.orderId === order.orderId ? 'Verberg' : 'Details'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className={styles.orderDetails}>
            <div className={styles.detailsHeader}>
              <h2>Order Details: #{selectedOrder.orderId}</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.detailsContent}>
              {/* Order Summary */}
              <section className={styles.section}>
                <h3>Order Samenvatting</h3>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Order ID</div>
                    <div className={styles.summaryValue}>{selectedOrder.orderId}</div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Datum</div>
                    <div className={styles.summaryValue}>
                      {new Date(selectedOrder.orderPlacedDateTime).toLocaleDateString('nl-NL')}
                    </div>
                    <div className={styles.summarySubValue}>
                      {new Date(selectedOrder.orderPlacedDateTime).toLocaleTimeString('nl-NL')}
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Totaal Items</div>
                    <div className={styles.summaryValue}>
                      {selectedOrder.orderItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                    </div>
                    <div className={styles.summarySubValue}>
                      {selectedOrder.orderItems?.length || 0} {(selectedOrder.orderItems?.length || 0) === 1 ? 'product' : 'producten'}
                    </div>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Totaal Bedrag</div>
                    <div className={styles.summaryValue}>
                      €{(selectedOrder.orderItems?.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0), 0) || 0).toFixed(2)}
                    </div>
                    <div className={styles.summarySubValue}>
                      Commissie: €{(selectedOrder.orderItems?.reduce((sum, item) => sum + (item.commission || 0) * (item.quantity || 0), 0) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Order Info */}
              <section className={styles.section}>
                <h3>Order Informatie</h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <strong>Order ID:</strong>
                    <span className={styles.monoFont}>{selectedOrder.orderId}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Geplaatst op:</strong>
                    <span>
                      {new Date(selectedOrder.orderPlacedDateTime).toLocaleString('nl-NL', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Aantal order items:</strong>
                    <span>{selectedOrder.orderItems?.length || 0}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Fulfilment Methode:</strong>
                    <span>
                      <span className={styles.fulfilmentBadge}>
                        {selectedOrder.orderItems?.[0]?.fulfilment?.method || 'N/A'}
                      </span>
                    </span>
                  </div>
                  {selectedOrder.expiryDate && (
                    <div className={styles.infoItem}>
                      <strong>Vervaldatum:</strong>
                      <span>
                        {new Date(selectedOrder.expiryDate).toLocaleString('nl-NL')}
                        {new Date(selectedOrder.expiryDate) < new Date() && (
                          <span className={styles.expiredBadge}> (Verlopen)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Customer Details */}
              {selectedOrder.customerDetails && (
                <section className={styles.section}>
                  <h3>Klantgegevens</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Naam:</strong>
                      <span>
                        {selectedOrder.customerDetails.salutationCode} {selectedOrder.customerDetails.firstName} {selectedOrder.customerDetails.surname}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Adres:</strong>
                      <span>
                        {selectedOrder.customerDetails.streetName} {selectedOrder.customerDetails.houseNumber}
                        {selectedOrder.customerDetails.houseNumberExtension && ` ${selectedOrder.customerDetails.houseNumberExtension}`}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Postcode & Plaats:</strong>
                      <span>
                        {selectedOrder.customerDetails.zipCode} {selectedOrder.customerDetails.city}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Land:</strong>
                      <span>{selectedOrder.customerDetails.countryCode}</span>
                    </div>
                    {selectedOrder.customerDetails.email && (
                      <div className={styles.infoItem}>
                        <strong>Email:</strong>
                        <span>{selectedOrder.customerDetails.email}</span>
                      </div>
                    )}
                    {selectedOrder.customerDetails.deliveryPhoneNumber && (
                      <div className={styles.infoItem}>
                        <strong>Telefoon:</strong>
                        <span>{selectedOrder.customerDetails.deliveryPhoneNumber}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Billing Details */}
              {selectedOrder.billingDetails && (
                <section className={styles.section}>
                  <h3>Factuuradres</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Naam:</strong>
                      <span>
                        {selectedOrder.billingDetails.salutationCode} {selectedOrder.billingDetails.firstName} {selectedOrder.billingDetails.surname}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Adres:</strong>
                      <span>
                        {selectedOrder.billingDetails.streetName} {selectedOrder.billingDetails.houseNumber}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Postcode & Plaats:</strong>
                      <span>
                        {selectedOrder.billingDetails.zipCode} {selectedOrder.billingDetails.city}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Land:</strong>
                      <span>{selectedOrder.billingDetails.countryCode}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Order Items */}
              <section className={styles.section}>
                <h3>Bestelde Items ({selectedOrder.orderItems?.length || 0})</h3>
                <div className={styles.itemsTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>EAN</th>
                        <th>Referentie</th>
                        <th>Aantal</th>
                        <th>Verzonden</th>
                        <th>Geannuleerd</th>
                        <th>Prijs</th>
                        <th>Totaal</th>
                        <th>Commissie</th>
                        <th>Status</th>
                        <th>Fulfilment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.orderItems || []).map((item) => {
                        const totalPrice = (item.unitPrice || 0) * item.quantity
                        const totalCommission = (item.commission || 0) * item.quantity
                        const quantityShipped = item.quantityShipped || 0
                        const quantityCancelled = item.quantityCancelled || 0
                        const quantityPending = item.quantity - quantityShipped - quantityCancelled
                        
                        return (
                          <tr key={item.orderItemId}>
                            <td className={styles.monoFont} title={item.orderItemId}>
                              {item.orderItemId.substring(0, 10)}...
                            </td>
                            <td className={styles.monoFont}>{item.ean}</td>
                            <td>{item.offerReference || '-'}</td>
                            <td><strong>{item.quantity}</strong></td>
                            <td>
                              {quantityShipped > 0 ? (
                                <span className={styles.shippedBadge}>{quantityShipped}</span>
                              ) : (
                                <span className={styles.noData}>-</span>
                              )}
                            </td>
                            <td>
                              {quantityCancelled > 0 ? (
                                <span className={styles.cancelledBadge}>{quantityCancelled}</span>
                              ) : (
                                <span className={styles.noData}>-</span>
                              )}
                            </td>
                            <td>€{item.unitPrice?.toFixed(2) || '0.00'}</td>
                            <td><strong>€{totalPrice.toFixed(2)}</strong></td>
                            <td>€{totalCommission.toFixed(2)}</td>
                            <td>
                              {item.fulfilmentStatus && (
                                <span className={styles.statusBadge}>
                                  {item.fulfilmentStatus}
                                </span>
                              )}
                              {item.cancellationRequest && (
                                <div className={styles.cancellationWarning}>
                                  ⚠ Annulering
                                </div>
                              )}
                              {quantityPending > 0 && quantityPending < item.quantity && (
                                <div className={styles.pendingInfo}>
                                  {quantityPending} open
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={styles.fulfilmentBadge}>
                                {item.fulfilment?.method || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}><strong>Totaal:</strong></td>
                        <td><strong>{(selectedOrder.orderItems || []).reduce((sum, item) => sum + (item.quantity || 0), 0)}</strong></td>
                        <td>
                          <strong>
                            {(selectedOrder.orderItems || []).reduce((sum, item) => sum + (item.quantityShipped || 0), 0)}
                          </strong>
                        </td>
                        <td>
                          <strong>
                            {(selectedOrder.orderItems || []).reduce((sum, item) => sum + (item.quantityCancelled || 0), 0)}
                          </strong>
                        </td>
                        <td></td>
                        <td>
                          <strong>
                            €{((selectedOrder.orderItems || []).reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0), 0)).toFixed(2)}
                          </strong>
                        </td>
                        <td>
                          <strong>
                            €{((selectedOrder.orderItems || []).reduce((sum, item) => sum + (item.commission || 0) * (item.quantity || 0), 0)).toFixed(2)}
                          </strong>
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {/* Cancellation Requests */}
                {(selectedOrder.orderItems || []).some(item => item.cancellationRequest) && (
                  <div className={styles.cancellationSection}>
                    <h4>⚠ Annuleringsverzoeken</h4>
                    {(selectedOrder.orderItems || [])
                      .filter(item => item.cancellationRequest)
                      .map((item) => (
                        <div key={item.orderItemId} className={styles.cancellationItem}>
                          <strong>Item {item.orderItemId.substring(0, 10)}...</strong>
                          {item.cancellationRequest?.dateTime && (
                            <span> - {new Date(item.cancellationRequest.dateTime).toLocaleString('nl-NL')}</span>
                          )}
                          {item.cancellationRequest?.reasonCode && (
                            <span> - Reden: {item.cancellationRequest.reasonCode}</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </section>

              {/* Shipment Details */}
              {selectedOrder.shipmentDetails && (
                <section className={styles.section}>
                  <h3>Verzendinformatie</h3>
                  <div className={styles.infoGrid}>
                    {selectedOrder.shipmentDetails.shipmentId && (
                      <div className={styles.infoItem}>
                        <strong>Shipment ID:</strong>
                        <span>{selectedOrder.shipmentDetails.shipmentId}</span>
                      </div>
                    )}
                    {selectedOrder.shipmentDetails.shipmentDateTime && (
                      <div className={styles.infoItem}>
                        <strong>Verzenddatum:</strong>
                        <span>
                          {new Date(selectedOrder.shipmentDetails.shipmentDateTime).toLocaleString('nl-NL')}
                        </span>
                      </div>
                    )}
                    {selectedOrder.shipmentDetails.transporterCode && (
                      <div className={styles.infoItem}>
                        <strong>Vervoerder:</strong>
                        <span>{selectedOrder.shipmentDetails.transporterCode}</span>
                      </div>
                    )}
                    {selectedOrder.shipmentDetails.trackAndTrace && (
                      <div className={styles.infoItem}>
                        <strong>Track & Trace:</strong>
                        <span>{selectedOrder.shipmentDetails.trackAndTrace}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Expiry Date */}
              {selectedOrder.expiryDate && (
                <section className={styles.section}>
                  <h3>Order Vervaldatum</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Vervaldatum:</strong>
                      <span>
                        {new Date(selectedOrder.expiryDate).toLocaleString('nl-NL')}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Status:</strong>
                      <span>
                        {new Date(selectedOrder.expiryDate) > new Date() ? 'Actief' : 'Verlopen'}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

