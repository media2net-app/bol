'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import styles from './page.module.css'

export default function InstellingenPage() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' })
  const [currentKeyPrefix, setCurrentKeyPrefix] = useState<string>('')

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }

    // Laad huidige API key (alleen prefix voor veiligheid)
    loadCurrentSettings()
  }, [router])

  const loadCurrentSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const result = await response.json()
      
      if (result.success && result.data?.apiKey) {
        const key = result.data.apiKey
        setCurrentKeyPrefix(key.substring(0, 8) + '...' + key.substring(key.length - 4))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: null, text: '' })

    if (!apiKey.trim() || !apiSecret.trim()) {
      setMessage({ type: 'error', text: 'Vul zowel API Key als Secret in' })
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'API credentials succesvol opgeslagen!' })
        setApiKey('')
        setApiSecret('')
        await loadCurrentSettings()
        
        // Test de credentials
        setTimeout(() => {
          testCredentials()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: result.error || 'Kon credentials niet opslaan' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Er is een fout opgetreden' })
    } finally {
      setLoading(false)
    }
  }

  const testCredentials = async () => {
    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
      })
      const result = await response.json()

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: 'API credentials opgeslagen en getest! Verbinding succesvol.' 
        })
      } else {
        setMessage({ 
          type: 'error', 
          text: `Credentials opgeslagen, maar test mislukt: ${result.error}` 
        })
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: `Credentials opgeslagen, maar test mislukt: ${error.message}` 
      })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Instellingen</h1>
        <p className={styles.subtitle}>Beheer je bol.com API credentials</p>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h2>API Credentials</h2>
          <p className={styles.description}>
            Voer je bol.com Retailer API credentials in. Deze worden veilig opgeslagen en gebruikt voor alle API calls.
          </p>

          {currentKeyPrefix && (
            <div className={styles.currentKey}>
              <CheckCircle2 size={16} />
              <span>Huidige API Key: <strong>{currentKeyPrefix}</strong></span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="apiKey" className={styles.label}>
                API Key
              </label>
              <input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Voer je API Key in"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="apiSecret" className={styles.label}>
                API Secret
              </label>
              <div className={styles.secretInputWrapper}>
                <input
                  id="apiSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Voer je API Secret in"
                  className={styles.input}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className={styles.toggleSecret}
                  disabled={loading}
                >
                  {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message.type && (
              <div className={`${styles.message} ${styles[message.type]}`}>
                {message.type === 'success' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  Opslaan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Opslaan & Testen
                </>
              )}
            </button>
          </form>
        </div>

        <div className={styles.section}>
          <h2>Informatie</h2>
          <div className={styles.infoBox}>
            <h3>Waar vind ik mijn API credentials?</h3>
            <p>
              Je API credentials kun je vinden in je bol.com Partner Platform account:
            </p>
            <ul>
              <li>Log in op <a href="https://partnerplatform.bol.com" target="_blank" rel="noopener noreferrer">partnerplatform.bol.com</a></li>
              <li>Ga naar "Automatiseren via bol.com"</li>
              <li>Klik op "API toegang"</li>
              <li>Hier vind je je API Key en Secret</li>
            </ul>
          </div>

          <div className={styles.infoBox}>
            <h3>Veiligheid</h3>
            <p>
              Je API credentials worden veilig opgeslagen en alleen gebruikt voor API calls naar bol.com.
              De credentials worden nooit gedeeld of getoond in logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

