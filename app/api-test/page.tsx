'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface TestResult {
  endpoint: string
  method: string
  status: 'pending' | 'success' | 'error'
  response?: any
  error?: string
  timestamp?: string
}

export default function ApiTestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, { ...result, timestamp: new Date().toLocaleTimeString() }])
  }

  const testEndpoint = async (endpoint: string, method: string = 'GET', body?: any) => {
    addResult({
      endpoint,
      method,
      status: 'pending',
    })

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(endpoint, options)
      const data = await response.json()

      if (response.ok) {
        addResult({
          endpoint,
          method,
          status: 'success',
          response: data,
        })
      } else {
        addResult({
          endpoint,
          method,
          status: 'error',
          error: data.error || data.message || `HTTP ${response.status}`,
          response: data,
        })
      }
    } catch (error: any) {
      addResult({
        endpoint,
        method,
        status: 'error',
        error: error.message || 'Network error',
      })
    }
  }

  const testToken = () => {
    testEndpoint('/api/token', 'GET')
  }

  const testOrders = () => {
    testEndpoint('/api/orders?fulfilment-method=ALL&status=ALL')
  }

  const testOffersExport = () => {
    testEndpoint('/api/offers', 'POST', {})
  }

  const testProcessStatus = async () => {
    const processStatusId = prompt('Voer processStatusId in:')
    if (processStatusId) {
      testEndpoint(`/api/offers?processStatusId=${processStatusId}`)
    }
  }

  const testOfferById = async () => {
    const offerId = prompt('Voer offerId in:')
    if (offerId) {
      testEndpoint(`/api/offers?offerId=${offerId}`)
    }
  }

  const testDashboard = () => {
    testEndpoint('/api/dashboard')
  }

  const testCredentials = () => {
    testEndpoint('/api/settings')
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className={styles.container}>
      <h1>BOL API Test Pagina</h1>
      <p className={styles.description}>
        Test verschillende BOL API endpoints om te controleren of alles werkt.
      </p>

      <div className={styles.buttons}>
        <button onClick={testToken} className={styles.button}>
          Test Token
        </button>
        <button onClick={testOrders} className={styles.button}>
          Test Orders
        </button>
        <button onClick={testOffersExport} className={styles.button}>
          Test Offers Export
        </button>
        <button onClick={testProcessStatus} className={styles.button}>
          Test Process Status
        </button>
        <button onClick={testOfferById} className={styles.button}>
          Test Offer by ID
        </button>
        <button onClick={testDashboard} className={styles.button}>
          Test Dashboard
        </button>
        <button onClick={testCredentials} className={styles.button}>
          Check Credentials
        </button>
        <button onClick={clearResults} className={styles.buttonSecondary}>
          Clear Results
        </button>
      </div>

      <div className={styles.results}>
        <h2>Test Results</h2>
        {results.length === 0 ? (
          <p className={styles.empty}>Geen tests uitgevoerd. Klik op een knop om te beginnen.</p>
        ) : (
          results.map((result, index) => (
            <div key={index} className={`${styles.result} ${styles[result.status]}`}>
              <div className={styles.resultHeader}>
                <span className={styles.method}>{result.method}</span>
                <span className={styles.endpoint}>{result.endpoint}</span>
                <span className={styles.status}>{result.status}</span>
                {result.timestamp && (
                  <span className={styles.timestamp}>{result.timestamp}</span>
                )}
              </div>
              
              {result.error && (
                <div className={styles.error}>
                  <strong>Error:</strong> {result.error}
                  {result.response?.suggestion && (
                    <div className={styles.suggestion}>
                      <strong>Suggestie:</strong> {result.response.suggestion}
                    </div>
                  )}
                  {result.response?.details && (
                    <div className={styles.details}>
                      <strong>Details:</strong> {result.response.details}
                    </div>
                  )}
                </div>
              )}

              {result.response && (
                <details className={styles.response}>
                  <summary>Response</summary>
                  <pre>{JSON.stringify(result.response, null, 2)}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

