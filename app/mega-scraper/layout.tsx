import React from 'react'

export const metadata = {
  title: 'MEGA Scraper - bol.com',
  description: 'Scrape het complete Amazon aanbod en categoriseer automatisch',
}

export default function MegaScraperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

