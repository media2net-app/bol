'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Upload, FileText, Search, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import styles from './page.module.css'

interface UploadReport {
  uploadId: string
  language: string
  status: string
  attributes?: Array<{
    id: string
    values: Array<{ value: string }>
    status: string
    subStatus: string
    subStatusDescription: string
  }>
}

export default function ProductContentPage() {
  const router = useRouter()
  const [uploadId, setUploadId] = useState('')
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentUploads, setRecentUploads] = useState<string[]>([])

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }

    // Load recent upload IDs from localStorage
    const saved = localStorage.getItem('productContentUploads')
    if (saved) {
      try {
        setRecentUploads(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load recent uploads:', e)
      }
    }
  }, [router])

  const fetchUploadReport = async (id: string) => {
    if (!id.trim()) {
      setError('Voer een Upload ID in')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/product-content?uploadId=${id}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setUploadReport(result.data)
        
        // Save to recent uploads
        if (!recentUploads.includes(id)) {
          const updated = [id, ...recentUploads].slice(0, 10) // Keep last 10
          setRecentUploads(updated)
          localStorage.setItem('productContentUploads', JSON.stringify(updated))
        }
      } else {
        setError(result.error || 'Kon upload report niet ophalen')
        setUploadReport(null)
      }
    } catch (err: any) {
      setError(err.message || 'Er is een fout opgetreden')
      setUploadReport(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUploadReport(uploadId)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
      case 'COMPLETED':
        return <CheckCircle2 size={16} className={styles.statusPublished} />
      case 'DECLINED':
      case 'FAILED':
        return <XCircle size={16} className={styles.statusDeclined} />
      case 'IN_PROGRESS':
      case 'PENDING':
        return <Loader2 size={16} className={styles.statusPending} />
      default:
        return <AlertCircle size={16} className={styles.statusUnknown} />
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
      case 'COMPLETED':
        return styles.statusPublished
      case 'DECLINED':
      case 'FAILED':
        return styles.statusDeclined
      case 'IN_PROGRESS':
      case 'PENDING':
        return styles.statusPending
      default:
        return styles.statusUnknown
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Product Content</h1>
        <p className={styles.subtitle}>
          Beheer product content en bekijk upload reports
        </p>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h2>
            <FileText size={20} />
            Upload Report Opvragen
          </h2>
          <p className={styles.description}>
            Voer een Upload ID in om de status van een product content upload te bekijken.
            Upload reports zijn 28 dagen beschikbaar na upload.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="uploadId" className={styles.label}>
                Upload ID
              </label>
              <div className={styles.inputGroup}>
                <input
                  id="uploadId"
                  type="text"
                  value={uploadId}
                  onChange={(e) => setUploadId(e.target.value)}
                  placeholder="Bijv. 06488b79-e6c9-4cd7-888b-79e6c9bcd7db"
                  className={styles.input}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className={styles.searchButton}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={16} className={styles.spinning} />
                  ) : (
                    <Search size={16} />
                  )}
                </button>
              </div>
            </div>

            {recentUploads.length > 0 && (
              <div className={styles.recentUploads}>
                <strong>Recente Uploads:</strong>
                <div className={styles.recentList}>
                  {recentUploads.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setUploadId(id)
                        fetchUploadReport(id)
                      }}
                      className={styles.recentItem}
                    >
                      {id.substring(0, 8)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {uploadReport && (
          <div className={styles.section}>
            <h2>
              <FileText size={20} />
              Upload Report Details
            </h2>

            <div className={styles.reportHeader}>
              <div className={styles.reportInfo}>
                <div>
                  <strong>Upload ID:</strong> {uploadReport.uploadId}
                </div>
                <div>
                  <strong>Taal:</strong> {uploadReport.language}
                </div>
                <div>
                  <strong>Status:</strong>
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(uploadReport.status)}`}>
                    {getStatusIcon(uploadReport.status)}
                    {uploadReport.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => fetchUploadReport(uploadReport.uploadId)}
                className={styles.refreshButton}
                disabled={loading}
              >
                <RefreshCw size={16} />
                Vernieuwen
              </button>
            </div>

            {uploadReport.attributes && uploadReport.attributes.length > 0 && (
              <div className={styles.attributesTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Attribute</th>
                      <th>Waarde</th>
                      <th>Status</th>
                      <th>Sub Status</th>
                      <th>Beschrijving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadReport.attributes.map((attr, idx) => (
                      <tr key={idx}>
                        <td>{attr.id}</td>
                        <td>
                          {attr.values.map((v, vIdx) => (
                            <span key={vIdx} className={styles.value}>
                              {v.value}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${getStatusBadgeClass(attr.status)}`}>
                            {getStatusIcon(attr.status)}
                            {attr.status}
                          </span>
                        </td>
                        <td>{attr.subStatus}</td>
                        <td className={styles.description}>{attr.subStatusDescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className={styles.section}>
          <h2>
            <Upload size={20} />
            Informatie
          </h2>
          <div className={styles.infoBox}>
            <h3>Product Content API</h3>
            <p>
              De Product Content API maakt het mogelijk om content te maken voor bestaande of nieuwe producten op bol.com.
            </p>
            <ul>
              <li><strong>Chunks:</strong> Product classifications (4000+ beschikbaar)</li>
              <li><strong>Attributes:</strong> Product characteristics</li>
              <li><strong>Assets:</strong> Images, videos, documents (met labels zoals FRONT, SIDE, MANUAL)</li>
              <li><strong>Enrichment Levels:</strong> Level 0-1 (verplicht), Level 2 (optioneel)</li>
            </ul>
            <p>
              <strong>Belangrijk:</strong> Upload reports zijn 28 dagen beschikbaar. 
              Wacht minimaal 1 uur na upload voordat je het report opvraagt.
            </p>
            <p>
              <a 
                href="https://api.bol.com/retailer/public/Retailer-API/v10/functional/retailer-api/product-content-api.html" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Bekijk de volledige documentatie →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

