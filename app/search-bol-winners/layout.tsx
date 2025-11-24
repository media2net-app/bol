import React from 'react'

export const metadata = {
  title: 'Search bol.com Product Winners - bol.com',
  description: 'Scrape verkoopdata van bol.com producten om bestsellers en winnaars te vinden',
}

export default function SearchBolWinnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

