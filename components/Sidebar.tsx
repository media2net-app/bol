'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Globe, LogOut, Barcode, Zap, Store, Trophy, X } from 'lucide-react'
import styles from './Sidebar.module.css'

interface MenuItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  highlighted?: boolean
  subItems?: Array<{
    href: string
    label: string
    icon: React.ComponentType<{ size?: number | string; className?: string }>
  }>
}

const SCRAPER_ONLY_ROLE = 'scraper-only'
const SCRAPER_ONLY_EMAIL = 'davy@bol.com'

interface SidebarProps {
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({
  isMobile = false,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null
  )
  const [userRole, setUserRole] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('userRole') : null
  )

  useEffect(() => {
    const syncUser = () => {
      setUserEmail(localStorage.getItem('userEmail'))
      setUserRole(localStorage.getItem('userRole'))
    }

    syncUser()
    window.addEventListener('storage', syncUser)

    return () => {
      window.removeEventListener('storage', syncUser)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    router.push('/')
  }

  const scraperMenu: MenuItem[] = [
    {
      href: '/scraper',
      label: 'Scraper',
      icon: Globe,
      highlighted: true,
      subItems: [
        {
          href: '/scraped-products',
          label: 'Scraped products (Eigen EAN)',
          icon: Barcode,
        },
        {
          href: '/mega-scraper',
          label: 'MEGA Scraper',
          icon: Zap,
        },
        {
          href: '/merchant-scraper',
          label: 'Merchant Scraper',
          icon: Store,
        },
        {
          href: '/ean-codes',
          label: 'EAN codes',
          icon: Barcode,
        },
      ],
    },
  ]

  const isScraperOnlyUser = useMemo(
    () => userRole === SCRAPER_ONLY_ROLE || userEmail === SCRAPER_ONLY_EMAIL,
    [userRole, userEmail]
  )

  const menuItems: MenuItem[] = isScraperOnlyUser ? scraperMenu : [
    ...scraperMenu,
    {
      href: '/search-bol-winners',
      label: 'Search bol.com product winners',
      icon: Trophy,
    },
    {
      href: '/search-amazon-winners',
      label: 'Search amazon.nl product winners',
      icon: Trophy,
    },
    {
      href: '/ean-codes',
      label: 'EAN codes',
      icon: Barcode,
    },
  ]
  const sidebarClasses = [
    styles.sidebar,
    isMobile ? styles.sidebarMobile : '',
    isMobile && isOpen ? styles.sidebarOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={sidebarClasses}>
      {isMobile && (
        <button
          className={styles.mobileClose}
          onClick={onClose}
          aria-label="Sidebar sluiten"
        >
          <X size={20} />
        </button>
      )}
      <div className={styles.logoSection}>
        <Link href="/scraper" className={styles.logoLink}>
          <Image
            src="/images/logo.svg"
            alt="bol.com logo"
            width={220}
            height={73}
            priority
            className={styles.logo}
          />
        </Link>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.menuList}>
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            const isHighlighted = item.highlighted || false
            const hasSubItems = item.subItems && item.subItems.length > 0
            const subItems = item.subItems ?? []
            const isParentActive = hasSubItems && item.subItems?.some(subItem => pathname === subItem.href || pathname?.startsWith(subItem.href))
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.menuItem} ${isActive || isParentActive ? styles.active : ''} ${isHighlighted ? styles.highlighted : ''}`}
                >
                  <item.icon className={styles.icon} size={20} />
                  <span className={styles.label}>{item.label}</span>
                </Link>
                {hasSubItems && (
                  <ul className={styles.subMenuList}>
                    {subItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href || pathname?.startsWith(subItem.href)
                      return (
                        <li key={subItem.href}>
                          <Link
                            href={subItem.href}
                            className={`${styles.subMenuItem} ${isSubActive ? styles.active : ''}`}
                          >
                            <subItem.icon className={styles.subIcon} size={16} />
                            <span className={styles.subLabel}>{subItem.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <Link href="/prijsopgave" className={styles.quoteButton}>
          Prijsopgave
        </Link>
        <button onClick={handleLogout} className={styles.logoutButton}>
          <LogOut size={16} />
          <span>Uitloggen</span>
        </button>
      </div>
    </aside>
  )
}

