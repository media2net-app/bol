'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import styles from './page.module.css'

// Default login credentials
const DEFAULT_EMAIL = 'davy@bol.com'
const DEFAULT_PASSWORD = 'D@vyB0l!'

export default function LoginPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedLogin = localStorage.getItem('isLoggedIn')
    const storedEmail = localStorage.getItem('userEmail')

    if (storedLogin === 'true') {
      const destination = storedEmail === DEFAULT_EMAIL ? '/scraper' : '/dashboard'
      router.replace(destination)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Call authentication API
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Store login state
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userEmail', email)
        localStorage.setItem('userRole', data.user?.role || 'full-access')
        
        // Redirect to appropriate section
        router.push(data.user?.role === 'scraper-only' ? '/scraper' : '/dashboard')
      } else {
        setError(data.error || 'Ongeldig e-mailadres of wachtwoord')
        setIsLoading(false)
      }
    } catch (error) {
      setError('Er is een fout opgetreden. Probeer het opnieuw.')
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginWrapper}>
        <div className={styles.logoSection}>
          <div className={styles.logoContainer}>
            <Image
              src="/images/logo.svg"
              alt="bol.com logo"
              width={200}
              height={80}
              priority
              className={styles.logo}
            />
          </div>
          <p className={styles.tagline}>de winkel van ons allemaal</p>
        </div>

        <div className={styles.loginCard}>
          <h1 className={styles.title}>Inloggen</h1>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                E-mailadres
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Wachtwoord
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            <div className={styles.forgotPassword}>
              <a href="#" className={styles.link}>
                Wachtwoord vergeten?
              </a>
            </div>

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Inloggen...' : 'Inloggen'}
            </button>

            <div className={styles.demoInfo}>
              <p className={styles.demoText}>
                Demo: {DEFAULT_EMAIL} / {DEFAULT_PASSWORD}
              </p>
            </div>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>bol.com Retailer</p>
            <div className={styles.footerLinks}>
              <a href="#" className={styles.footerLink}>
                Privacy
              </a>
              <a href="#" className={styles.footerLink}>
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

