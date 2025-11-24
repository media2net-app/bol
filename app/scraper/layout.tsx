import React from 'react'

export const metadata = {
  title: 'Scraper - bol.com',
  description: 'Web scraping en data extractie tool',
}

export default function ScraperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

