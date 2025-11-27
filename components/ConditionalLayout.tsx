'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import styles from './ConditionalLayout.module.css'

const SCRAPER_ALLOWED_PATHS = [
  '/scraper',
  '/scraped-products',
  '/mega-scraper',
  '/merchant-scraper',
  '/ean-codes',
  '/prijsopgave',
]
const SCRAPER_ONLY_ROLE = 'scraper-only'
const MOBILE_BREAKPOINT = 1024

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/'
  const showSidebar = !isLoginPage
  const [isMobile, setIsMobile] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT
      setIsMobile(mobile)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(true)
    } else {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const role = localStorage.getItem('userRole')

    if (!isLoginPage && role === SCRAPER_ONLY_ROLE) {
      const isAllowed = SCRAPER_ALLOWED_PATHS.some((path) =>
        pathname === path || pathname?.startsWith(`${path}/`)
      )
      if (!isAllowed) {
        router.replace('/scraper')
      }
    }
  }, [pathname, isLoginPage, router])

  if (!showSidebar) {
    return (
      <>
        {children}
      </>
    )
  }

  const mainClasses = [
    styles.mainContent,
    isMobile ? styles.mainContentFull : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className={styles.appLayout}>
        <Sidebar
          isMobile={isMobile}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {isMobile && (
          <>
            <button
              className={styles.mobileToggle}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            {isSidebarOpen && (
              <div
                className={styles.mobileBackdrop}
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
          </>
        )}

        <main className={mainClasses}>
          {children}
        </main>
      </div>
    </>
  )
}

