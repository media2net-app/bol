import React from 'react'

export const metadata = {
  title: 'Product Content - bol.com',
  description: 'Beheer product content en bekijk upload reports',
}

export default function ProductContentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

