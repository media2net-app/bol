'use client'

import styles from './page.module.css'

export default function PrijsopgavePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.badge}>Offerte</p>
          <h1 className={styles.title}>Prijsopgave Merchant Scraper (Davy)</h1>
          <p className={styles.subtitle}>
            Overzicht van de huidige functionaliteit en de kostenplanning voor het traject.
          </p>
        </div>
        <div className={styles.costCard}>
          <span className={styles.costLabel}>Projectkosten</span>
          <strong className={styles.costValue}>€ 2.250,-</strong>
          <span className={styles.costMeta}>excl. 21% BTW</span>
        </div>
      </header>

      <section className={styles.card}>
        <h2>Wat het account van Davy kan</h2>
        <ul className={styles.featureList}>
          <li>Toegang tot Scraper-suite (Merchant, Mega & Scraped Products)</li>
          <li>Eigen EAN beheer met import/export en dummy-CSV</li>
          <li>Opslaan & bekijken van alle gescrapete afbeeldingen</li>
          <li>Automatische logging en detailoverzicht per scraping-run</li>
          <li>Mobielvriendelijke interface + role-based toegangscontrole</li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2>Planning & betaalafspraken</h2>
        <div className={styles.timeline}>
          <div className={styles.timelineItem}>
            <span className={styles.timelineLabel}>Ontwikkeltijd</span>
            <strong>1 week</strong>
            <p>Direct na aanbetaling starten we met de werkzaamheden.</p>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineLabel}>Aanbetaling</span>
            <strong>50% (€ 1.125,- excl. BTW)</strong>
            <p>Bij akkoord op de offerte sturen we de voorschotfactuur.</p>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineLabel}>Restantbetaling</span>
            <strong>50% na oplevering</strong>
            <p>Na acceptatie van de live-omgeving volgt de slotfactuur.</p>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.highlight}`}>
        <h2>Volgende stap</h2>
        <p>
          Bij akkoord ontvangen we graag de aanbetaling van 50%. Na ontvangst gaan we direct van start
          met de ontwikkeltijd van één week. Neem gerust contact op als er aanvullende wensen of vragen
          zijn.
        </p>
      </section>
    </div>
  )
}


