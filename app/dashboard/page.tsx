'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, RefreshCw, Clock, AlertTriangle, Loader2, Euro } from 'lucide-react'
import styles from './page.module.css'

interface Order {
  orderId: string
  orderPlacedDateTime: string
  orderItems: Array<{
    orderItemId: string
    ean: string
    quantity: number
    offerReference: string
    fulfilment: {
      method: string
    }
  }>
}

interface RevenueData {
  year: number
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  currency: string
}

interface ApiData {
  apiConnected: boolean
  timestamp: string
  credentials: {
    hasKey: boolean
    hasSecret: boolean
    keyPrefix: string
  }
  testResults: {
    status: string
    message: string
  }
  orders?: {
    status: string
    data?: {
      orders?: Order[]
    }
    count?: number
    message?: string
  }
  allOrders?: {
    status: string
    count?: number
    message?: string
  }
  offersExport?: {
    status: string
    processStatusId?: string
    message?: string
    retryAfter?: number
    retryAfterMinutes?: number
  }
  revenue?: {
    status: string
    data?: RevenueData
    message?: string
  }
  apiCallSummary?: {
    totalCalls: number
    callsUsed: number
    callsRemaining: number
    maxCapacity?: number
    strategy: string
    message: string
  }
  rateLimitInfo?: {
    orders: {
      maxCapacity: number
      timeWindow: string
      safeInterval: number
      info: string
    }
  }
}

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState('')
  const [apiData, setApiData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processStatus, setProcessStatus] = useState<any>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const email = localStorage.getItem('userEmail')

    if (!isLoggedIn || !email) {
      router.push('/')
      return
    }

    setUserEmail(email)
    fetchApiData()
    fetchRevenue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchApiData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Gebruik de geoptimaliseerde dashboard endpoint die alle data in één call ophaalt
      const response = await fetch('/api/dashboard')
      const result = await response.json()

      if (response.ok && result.success) {
        setApiData(result.data)
        
        // Haal revenue apart op (gebruikt eigen caching)
        fetchRevenue()
      } else {
        setError(result.error || 'Kon data niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  const checkProcessStatus = async (processStatusId: string) => {
    try {
      setCheckingStatus(true)
      const response = await fetch(`/api/offers?processStatusId=${processStatusId}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setProcessStatus(result.data)
      } else {
        setError(result.error || 'Kon process status niet ophalen')
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
    } finally {
      setCheckingStatus(false)
    }
  }

  const fetchRevenue = async () => {
    try {
      setRevenueLoading(true)
      const response = await fetch('/api/revenue')
      const result = await response.json()

      if (response.ok && result.success) {
        setRevenue(result.data)
      }
    } catch (err: any) {
      console.error('Error fetching revenue:', err)
    } finally {
      setRevenueLoading(false)
    }
  }


  if (loading && !apiData) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Dashboard laden...</div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
      </header>

        <div className={styles.content}>
          <div className={styles.welcomeCard}>
            <h2>Welkom terug!</h2>
            <p className={styles.userEmail}>Ingelogd als: {userEmail}</p>
          </div>

          {/* API Data Section */}
          <div className={styles.apiCard}>
            <h2>API Connectie Status</h2>
            {loading && <p className={styles.loading}>Data ophalen...</p>}
            {error && (
              <div className={styles.errorBox}>
                <p className={styles.errorText}>Fout: {error}</p>
              </div>
            )}
            {apiData && (
              <div className={styles.apiInfo}>
                <div className={styles.apiStatus}>
                  <span className={apiData.apiConnected ? styles.statusConnected : styles.statusDisconnected}>
                    {apiData.apiConnected ? (
                      <>
                        <CheckCircle2 size={16} />
                        Verbonden
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        Niet verbonden
                      </>
                    )}
                  </span>
                </div>
                <div className={styles.apiDetails}>
                  <div className={styles.detailRow}>
                    <strong>API Key:</strong> {apiData.credentials.keyPrefix}
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Key aanwezig:</strong> {apiData.credentials.hasKey ? 'Ja' : 'Nee'}
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Secret aanwezig:</strong> {apiData.credentials.hasSecret ? 'Ja' : 'Nee'}
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Status:</strong> {apiData.testResults.status}
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Bericht:</strong> {apiData.testResults.message}
                  </div>
                  <div className={styles.detailRow}>
                    <strong>Laatste update:</strong> {new Date(apiData.timestamp).toLocaleString('nl-NL')}
                  </div>
                  {apiData.apiCallSummary && (
                    <>
                      <div className={styles.detailRow}>
                        <strong>API Calls:</strong> {apiData.apiCallSummary.callsUsed} / {apiData.apiCallSummary.maxCapacity || apiData.rateLimitInfo?.orders.maxCapacity || 25}
                      </div>
                      <div className={styles.detailRow}>
                        <strong>Strategie:</strong> {apiData.apiCallSummary.strategy === 'cached_only' ? 'Cached data (0 calls)' : '1 API call'}
                      </div>
                      {apiData.rateLimitInfo && (
                        <div className={styles.detailRow}>
                          <strong>Rate Limit:</strong> {apiData.rateLimitInfo.orders.info}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className={styles.buttonGroup}>
                  <button 
                    onClick={() => {
                      fetchApiData()
                      fetchRevenue()
                    }} 
                    className={styles.refreshButton}
                  >
                    <RefreshCw size={16} />
                    Vernieuwen
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/token', { method: 'POST' })
                        const result = await response.json()
                        if (result.success) {
                          // Refresh data after token refresh
                          fetchApiData()
                          fetchRevenue()
                        }
                      } catch (err) {
                        console.error('Token refresh failed:', err)
                      }
                    }} 
                    className={styles.tokenButton}
                    title="Refresh API token"
                  >
                    <RefreshCw size={14} />
                    Token
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Euro size={20} className={styles.cardIcon} />
                <h3>Totale Omzet {new Date().getFullYear()}</h3>
              </div>
              <p className={styles.cardNumber}>
                {revenueLoading ? (
                  <Loader2 size={24} className={styles.loadingIcon} />
                ) : revenue ? (
                  `€${revenue.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ) : (
                  '€0,00'
                )}
              </p>
              <p className={styles.cardLabel}>
                {revenue 
                  ? `${revenue.totalOrders} orders • Gemiddeld €${revenue.averageOrderValue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Omzet van dit jaar'}
              </p>
            </div>

            <div className={styles.card}>
              <h3>Openstaande Bestellingen</h3>
              <p className={styles.cardNumber}>
                {apiData?.orders?.count ?? (apiData?.orders?.status === 'loading' ? '...' : '0')}
              </p>
              <p className={styles.cardLabel}>
                {apiData?.orders?.status === 'error' 
                  ? 'Fout bij ophalen' 
                  : apiData?.orders?.status === 'cached'
                  ? 'Gecachte data (rate limit)'
                  : 'Orders die verzonden moeten worden'}
              </p>
              {apiData?.orders?.status === 'cached' && (
                <p className={styles.cachedBadge}>📦 Gecachte data</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>Alle Orders</h3>
              <p className={styles.cardNumber}>
                {apiData?.allOrders?.count ?? '0'}
              </p>
              <p className={styles.cardLabel}>
                {apiData?.allOrders?.status === 'error' 
                  ? 'Fout bij ophalen' 
                  : apiData?.allOrders?.status === 'cached'
                  ? 'Gecachte data (rate limit)'
                  : 'Orders (laatste 48 uur)'}
              </p>
              {apiData?.allOrders?.status === 'cached' && (
                <p className={styles.cachedBadge}>📦 Gecachte data</p>
              )}
            </div>

            <div className={styles.card}>
              <h3>Offers</h3>
              <p className={styles.cardNumber}>
                {apiData?.offersExport?.status === 'requested' ? (
                  <CheckCircle2 size={24} className={styles.successIcon} />
                ) : apiData?.offersExport?.status === 'rate_limited' ? (
                  <Clock size={24} className={styles.warningIcon} />
                ) : (
                  <Loader2 size={24} className={styles.loadingIcon} />
                )}
              </p>
              <p className={styles.cardLabel}>
                {apiData?.offersExport?.status === 'requested' 
                  ? 'Export aangevraagd' 
                  : apiData?.offersExport?.status === 'rate_limited'
                  ? `Rate limit (${apiData.offersExport.retryAfterMinutes}m)`
                  : apiData?.offersExport?.status === 'error'
                  ? 'Fout bij ophalen'
                  : 'Offers in assortiment'}
              </p>
            </div>
          </div>

          {/* Orders Lijst */}
          {apiData?.orders?.data?.orders && apiData.orders.data.orders.length > 0 && (
            <div className={styles.ordersList}>
              <h2>Recent Orders</h2>
              <div className={styles.ordersGrid}>
                {apiData.orders.data.orders.slice(0, 5).map((order: Order) => (
                  <div key={order.orderId} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <h4>Order #{order.orderId.substring(0, 8)}...</h4>
                      <span className={styles.orderDate}>
                        {new Date(order.orderPlacedDateTime).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    <div className={styles.orderItems}>
                      <p className={styles.orderItemCount}>
                        {order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'}
                      </p>
                      {order.orderItems.slice(0, 2).map((item, idx) => (
                        <div key={idx} className={styles.orderItem}>
                          <span>EAN: {item.ean}</span>
                          <span>Qty: {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rate Limit Warning */}
          {(apiData?.offersExport?.status === 'rate_limited' || 
            apiData?.orders?.status === 'rate_limited' ||
            apiData?.allOrders?.status === 'rate_limited') && (
            <div className={styles.rateLimitWarning}>
              <h3>
                <AlertTriangle size={20} />
                Rate Limit Bereikt
              </h3>
              <p>
                Je hebt te veel API requests gedaan. De bol.com API heeft een rate limit om de service stabiel te houden.
              </p>
              {apiData.offersExport?.retryAfter && (
                <p className={styles.retryInfo}>
                  <strong>Probeer opnieuw over:</strong> {apiData.offersExport.retryAfterMinutes} minuten 
                  ({Math.floor((apiData.offersExport.retryAfter % 3600) / 60)}m {apiData.offersExport.retryAfter % 60}s)
                </p>
              )}
              <p className={styles.rateLimitTip}>
                <strong>Tip:</strong> Wacht even voordat je opnieuw data ophaalt. Gebruik de "Vernieuwen" knop pas na de aangegeven tijd.
              </p>
            </div>
          )}

          {/* Offers Export Info */}
          {apiData?.offersExport && (
            <div className={styles.apiCard}>
              <h2>Offers Export Status</h2>
              <div className={styles.apiInfo}>
                <div className={styles.apiStatus}>
                  <span className={
                    apiData.offersExport.status === 'requested' 
                      ? styles.statusConnected 
                      : apiData.offersExport.status === 'rate_limited'
                      ? styles.statusRateLimited
                      : apiData.offersExport.status === 'error'
                      ? styles.statusDisconnected
                      : styles.statusDisconnected
                  }>
                    {apiData.offersExport.status === 'requested' ? (
                      <>
                        <CheckCircle2 size={16} />
                        Export Aangevraagd
                      </>
                    ) : apiData.offersExport.status === 'rate_limited' ? (
                      <>
                        <Clock size={16} />
                        Rate Limit
                      </>
                    ) : apiData.offersExport.status === 'error' ? (
                      <>
                        <XCircle size={16} />
                        Fout
                      </>
                    ) : (
                      <>
                        <Loader2 size={16} />
                        Verwerken...
                      </>
                    )}
                  </span>
                </div>
                {apiData.offersExport.processStatusId && (
                  <div className={styles.apiDetails}>
                    <div className={styles.detailRow}>
                      <strong>Process Status ID:</strong> {apiData.offersExport.processStatusId}
                    </div>
                    <div className={styles.detailRow}>
                      <strong>Status:</strong> {apiData.offersExport.status}
                    </div>
                    <div className={styles.detailRow}>
                      <strong>Info:</strong> {apiData.offersExport.message}
                    </div>
                    {apiData.offersExport.retryAfter && (
                      <div className={styles.detailRow}>
                        <strong>Retry over:</strong> {apiData.offersExport.retryAfterMinutes} minuten ({apiData.offersExport.retryAfter} seconden)
                      </div>
                    )}
                    <button 
                      onClick={() => checkProcessStatus(apiData.offersExport!.processStatusId!)}
                      className={styles.refreshButton}
                      disabled={checkingStatus}
                    >
                      {checkingStatus ? (
                        <>
                          <Loader2 size={16} className={styles.spinning} />
                          Controleren...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          Check Export Status
                        </>
                      )}
                    </button>
                    {processStatus && (
                      <div className={styles.processStatus}>
                        <div className={styles.detailRow}>
                          <strong>Process Status:</strong> {processStatus.status}
                        </div>
                        {processStatus.entityId && (
                          <div className={styles.detailRow}>
                            <strong>Export ID:</strong> {processStatus.entityId}
                          </div>
                        )}
                        {processStatus.status === 'SUCCESS' && processStatus.entityId && (
                          <div className={styles.detailRow}>
                            <small style={{ color: '#28a745', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={14} />
                              Export is klaar! Gebruik Export ID om de file op te halen.
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {apiData.offersExport.message && !apiData.offersExport.processStatusId && (
                  <div className={styles.apiDetails}>
                    <div className={styles.detailRow}>
                      <strong>Bericht:</strong> {apiData.offersExport.message}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  )
}

