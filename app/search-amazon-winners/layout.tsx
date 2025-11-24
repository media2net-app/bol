import React from 'react'

export const metadata = {
  title: 'Search amazon.nl Product Winners - bol.com',
  description: 'Analyseer verkoopdata van Amazon producten om bestsellers en winnaars te vinden',
}

export default function SearchAmazonWinnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

