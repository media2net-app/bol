'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Link as LinkIcon, Info } from 'lucide-react'
import Link from 'next/link'
import styles from './page.module.css'

export default function VoorraadPage() {
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/')
      return
    }
  }, [router])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Voorraad Beheer</h1>
        <p className={styles.subtitle}>Beheer je productvoorraad via bol.com</p>
      </div>

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <Package size={24} className={styles.cardIcon} />
            <h2>Voorraad Informatie</h2>
          </div>
          <p className={styles.intro}>
            Voorraad wordt beheerd via de Offers API. Hier vind je informatie over hoe je voorraad kunt beheren voor zowel FBR als FBB producten.
          </p>
          
          <div className={styles.section}>
            <h3>FBR Voorraad (Fulfillment by Retailer)</h3>
            <p>Bij FBR beheer je zelf de voorraad en verzending:</p>
            <ul className={styles.list}>
              <li>Voorraad wordt bijgehouden in je eigen systeem</li>
              <li>Je verzendt bestellingen zelf naar klanten</li>
              <li>Voorraad updates via de <Link href="/offers" className={styles.link}>Offers pagina</Link></li>
              <li>Je bent verantwoordelijk voor voorraadnauwkeurigheid</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>FBB Voorraad (Fulfillment by bol)</h3>
            <p>Bij FBB beheert bol.com de voorraad en verzending:</p>
            <ul className={styles.list}>
              <li>Voorraad staat in bol.com distributiecentrum</li>
              <li>bol.com verzendt bestellingen voor je</li>
              <li>Voorraad informatie via de <Link href="/logistiek" className={styles.link}>Logistiek pagina</Link></li>
              <li>Replenishments (vooraanmeldingen) voor nieuwe voorraad</li>
            </ul>
          </div>

          <div className={styles.infoBox}>
            <Info size={20} />
            <div>
              <strong>Tip:</strong> Gebruik de <Link href="/offers" className={styles.link}>Offers pagina</Link> om voorraad bij te werken voor FBR producten. 
              Voor FBB producten, bekijk de <Link href="/logistiek" className={styles.link}>Logistiek pagina</Link> voor voorraad status en replenishments.
            </div>
          </div>

          <div className={styles.actions}>
            <Link href="/offers" className={styles.actionButton}>
              <Package size={16} />
              <span>Naar Offers</span>
            </Link>
            <Link href="/logistiek" className={styles.actionButton}>
              <LinkIcon size={16} />
              <span>Naar Logistiek</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
