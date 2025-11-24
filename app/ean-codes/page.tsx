'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RefreshCw, Upload, ClipboardList, CheckCircle } from 'lucide-react'
import styles from './page.module.css'

const STORAGE_KEY = 'customEans'

const normalizeEan = (value: string) => {
  if (!value) return null
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 8 || digits.length > 18) return null
  return digits
}

const parseEanText = (text: string) =>
  text
    .split(/[\n,;|\t]+/)
    .map((entry) => normalizeEan(entry.trim()))
    .filter((entry): entry is string => Boolean(entry))

export default function EanCodesPage() {
  const [eanList, setEanList] = useState<string[]>([])
  const [baseCount, setBaseCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pasteValue, setPasteValue] = useState('')
  const [importStats, setImportStats] = useState({ added: 0, duplicates: 0 })
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadEans()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eanList))
    }
  }, [eanList, loading])

  const loadEans = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/eans')
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Kon EAN lijst niet laden')
      }

      const data = await response.json()
      const serverEans: string[] = data.eans || []
      setBaseCount(serverEans.length)

      let stored: string[] = []
      if (typeof window !== 'undefined') {
        const storedJson = localStorage.getItem(STORAGE_KEY)
        if (storedJson) {
          stored = JSON.parse(storedJson)
        }
      }

      const unique = Array.from(new Set([...serverEans, ...stored])).sort()
      setEanList(unique)
    } catch (err: any) {
      setError(err.message || 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  const filteredEans = useMemo(() => {
    if (!search.trim()) return eanList
    return eanList.filter((ean) => ean.includes(search.trim()))
  }, [eanList, search])

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const text = await file.text()
    importFromText(text)
  }

  const importFromText = (text: string) => {
    const candidates = parseEanText(text)
    if (candidates.length === 0) {
      setImportStats({ added: 0, duplicates: 0 })
      return
    }

    setEanList((prev) => {
      const set = new Set(prev)
      let added = 0
      candidates.forEach((ean) => {
        if (!set.has(ean)) {
          set.add(ean)
          added++
        }
      })
      setImportStats({
        added,
        duplicates: candidates.length - added,
      })
      if (added > 0) {
        setLastImportedAt(new Date().toLocaleString('nl-NL'))
      }
      return Array.from(set).sort()
    })
  }

  const handlePasteImport = () => {
    if (!pasteValue.trim()) return
    importFromText(pasteValue)
    setPasteValue('')
  }

  const handleDownload = () => {
    const csv = eanList.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ean-export-${eanList.length}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    loadEans()
  }

  const previewEans = eanList.slice(0, 20)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>EAN Codes</h1>
          <p className={styles.subtitle}>
            Voorbeeld CSV ({baseCount} basis EAN&apos;s) en eigen import via CSV of kopieer/plak.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={handleReset} disabled={loading}>
            <RefreshCw size={16} />
            Herlaad Voorbeeld CSV
          </button>
          <button className={styles.primaryButton} onClick={handleDownload} disabled={eanList.length === 0}>
            <Download size={16} />
            Download als CSV
          </button>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Totale EAN&apos;s</span>
          <strong className={styles.statValue}>{eanList.length.toLocaleString()}</strong>
          <span className={styles.statMeta}>Basisbestand: {baseCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Laatste import</span>
          <strong className={styles.statValue}>
            {lastImportedAt || 'Nog niets geïmporteerd'}
          </strong>
          <span className={styles.statMeta}>
            +{importStats.added} nieuw / {importStats.duplicates} duplicaat
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Zoek binnen lijst</span>
          <input
            type="text"
            placeholder="Zoek op EAN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <span className={styles.statMeta}>
            {search ? `${filteredEans.length} resultaten` : 'Geen filter actief'}
          </span>
        </div>
      </section>

      <section className={styles.importSection}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Importeer CSV</h2>
            <p>Upload een CSV-bestand met één EAN per regel of gescheiden door komma&apos;s.</p>
          </div>
          <div className={styles.importActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className={styles.hiddenInput}
              onChange={handleFileImport}
            />
            <button className={styles.primaryButton} onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              Upload CSV
            </button>
            <div className={styles.importInfo}>
              <CheckCircle size={16} />
              {importStats.added > 0
                ? `${importStats.added} nieuwe EAN's toegevoegd`
                : 'Duplicaten worden automatisch overgeslagen'}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Kopieer &amp; plak</h2>
            <p>Plak ruwe EAN&apos;s uit Excel of tekst. We halen automatisch de cijfers eruit.</p>
          </div>
          <textarea
            rows={5}
            className={styles.textarea}
            placeholder="Plak hier EAN's, gescheiden door enter of komma"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
          <div className={styles.importActions}>
            <button className={styles.secondaryButton} onClick={() => setPasteValue('')} disabled={!pasteValue}>
              Clear
            </button>
            <button className={styles.primaryButton} onClick={handlePasteImport} disabled={!pasteValue.trim()}>
              <ClipboardList size={16} />
              Importeren
            </button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Voorbeeld CSV (eerste 20)</h2>
          <p>Deze waarden komen rechtstreeks uit het voorbeeldbestand `dummy-eans.csv`.</p>
        </div>
        {loading ? (
          <p>Aan het laden...</p>
        ) : error ? (
          <div className={styles.errorBox}>{error}</div>
        ) : (
          <div className={styles.previewGrid}>
            {previewEans.map((ean) => (
              <span key={ean} className={styles.previewChip}>
                {ean}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Alle EAN codes ({filteredEans.length})</h2>
          <p>Scrol of zoek om specifieke codes te vinden.</p>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>EAN code</th>
              </tr>
            </thead>
            <tbody>
              {filteredEans.map((ean, index) => (
                <tr key={ean}>
                  <td>{index + 1}</td>
                  <td className={styles.mono}>{ean}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}


