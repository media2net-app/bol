'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Search, Info, RefreshCw } from 'lucide-react'
import styles from './page.module.css'

interface Commission {
  fixedAmount?: number
  percentage?: number
  totalCost?: number
  currency?: string
  ean?: string
  condition?: string
}

export default function CommissiesPage() {
  const [commission, setCommission] = useState<Commission | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ean, setEan] = useState('')
  const [condition, setCondition] = useState('NEW')
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
  }, [router])

  const fetchCommission = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!ean.trim()) {
      setError('Voer een EAN in')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setCommission(null)

      const response = await fetch(`/api/commissions?ean=${ean.trim()}&condition=${condition}`)
      const result = await response.json()

      if (response.ok && result.success) {
        setCommission(result.data)
      } else {
        setError(result.error || 'Kon commissie niet ophalen')
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
        <h1>Commissies</h1>
        <p className={styles.subtitle}>Bekijk commissies voor specifieke producten</p>
      </div>

      <div className={styles.content}>
        <div className={styles.searchSection}>
          <h2>
            <DollarSign size={20} />
            Commissie Opzoeken
          </h2>
          <p className={styles.description}>
            Voer een EAN in om de commissie informatie voor dat product op te halen.
          </p>

          <form onSubmit={fetchCommission} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="ean" className={styles.label}>
                EAN (European Article Number)
              </label>
              <input
                id="ean"
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="Bijv. 8712345678901"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="condition" className={styles.label}>
                Conditie
              </label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={styles.select}
                disabled={loading}
              >
                <option value="NEW">Nieuw (NEW)</option>
                <option value="AS_NEW">Zo goed als nieuw (AS_NEW)</option>
                <option value="GOOD">Goed (GOOD)</option>
                <option value="REASONABLE">Redelijk (REASONABLE)</option>
                <option value="MODERATE">Matig (MODERATE)</option>
              </select>
            </div>

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className={styles.searchButton}
              disabled={loading || !ean.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className={styles.spinning} />
                  Zoeken...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Commissie Opzoeken
                </>
              )}
            </button>
          </form>
        </div>

        {commission && (
          <div className={styles.commissionCard}>
            <h2>Commissie Informatie</h2>
            <div className={styles.commissionDetails}>
              {commission.fixedAmount !== undefined && (
                <div className={styles.detailItem}>
                  <strong>Vast Bedrag:</strong>
                  <span className={styles.amount}>
                    {commission.currency || 'EUR'} {commission.fixedAmount.toFixed(2)}
                  </span>
                </div>
              )}
              {commission.percentage !== undefined && (
                <div className={styles.detailItem}>
                  <strong>Percentage:</strong>
                  <span className={styles.amount}>{commission.percentage}%</span>
                </div>
              )}
              {commission.totalCost !== undefined && (
                <div className={styles.detailItem}>
                  <strong>Totale Kosten:</strong>
                  <span className={styles.amount}>
                    {commission.currency || 'EUR'} {commission.totalCost.toFixed(2)}
                  </span>
                </div>
              )}
              {commission.ean && (
                <div className={styles.detailItem}>
                  <strong>EAN:</strong>
                  <span>{commission.ean}</span>
                </div>
              )}
              {commission.condition && (
                <div className={styles.detailItem}>
                  <strong>Conditie:</strong>
                  <span>{commission.condition}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.infoCard}>
          <h2>
            <Info size={20} />
            Over Commissies
          </h2>
          <p>Commissies worden berekend per product en zijn afhankelijk van:</p>
          <ul className={styles.list}>
            <li><strong>Productcategorie:</strong> Verschillende categorieën hebben verschillende commissie percentages</li>
            <li><strong>Verkoopprijs:</strong> Commissie kan een percentage of vast bedrag zijn</li>
            <li><strong>Fulfilment methode:</strong> FBR en FBB hebben verschillende commissie structuren</li>
            <li><strong>Product conditie:</strong> Nieuwe producten hebben andere commissies dan tweedehands producten</li>
          </ul>
          <p className={styles.note}>
            <strong>Tip:</strong> Gebruik de zoekfunctie hierboven om de exacte commissie voor een product op te halen.
          </p>
        </div>
      </div>
    </div>
  )
}
