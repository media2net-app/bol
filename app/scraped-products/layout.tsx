import React from 'react'

export const metadata = {
  title: 'Scraped Products (Eigen EAN) - bol.com',
  description: 'Beheer gescrapede producten met eigen EAN codes',
}

export default function ScrapedProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

