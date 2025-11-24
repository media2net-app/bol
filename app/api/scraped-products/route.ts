import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const SCRAPED_PRODUCTS_FILE = path.join(DATA_DIR, 'scraped-products.json')

interface ScrapedProduct {
  id: string
  asin: string
  url: string
  title: string | null
  price: number | null
  originalPrice: string | null
  currency: string
  availability: string | null
  rating: number | null
  reviewCount: number | null
  images: string[]
  description: string | null
  brand: string | null
  category: string | null
  dimensions: string | null
  weight: string | null
  ean: string | null
  scrapedAt: string
  savedAt: string
  customEan?: string
}

// Ensure data directory exists
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// Read scraped products from file
async function readScrapedProducts(): Promise<ScrapedProduct[]> {
  try {
    await ensureDataDir()
    if (!existsSync(SCRAPED_PRODUCTS_FILE)) {
      return []
    }
    const data = await readFile(SCRAPED_PRODUCTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Write scraped products to file
async function writeScrapedProducts(products: ScrapedProduct[]) {
  await ensureDataDir()
  await writeFile(SCRAPED_PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8')
}

// GET: Haal alle scraped products op
export async function GET(request: NextRequest) {
  try {
    const products = await readScrapedProducts()
    return NextResponse.json({
      success: true,
      data: products,
      count: products.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// POST: Sla een nieuw scraped product op
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product, customEan } = body

    if (!product || !product.asin) {
      return NextResponse.json(
        { error: 'Product data is verplicht' },
        { status: 400 }
      )
    }

    const products = await readScrapedProducts()
    
    // Check if product already exists (by ASIN)
    const existingIndex = products.findIndex(p => p.asin === product.asin)
    
    const scrapedProduct: ScrapedProduct = {
      id: existingIndex >= 0 ? products[existingIndex].id : `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...product,
      savedAt: new Date().toISOString(),
      customEan: customEan || product.ean || null,
    }

    if (existingIndex >= 0) {
      // Update existing product
      products[existingIndex] = scrapedProduct
    } else {
      // Add new product
      products.push(scrapedProduct)
    }

    await writeScrapedProducts(products)

    return NextResponse.json({
      success: true,
      data: scrapedProduct,
      message: existingIndex >= 0 ? 'Product bijgewerkt' : 'Product opgeslagen',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// DELETE: Verwijder een scraped product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is verplicht' },
        { status: 400 }
      )
    }

    const products = await readScrapedProducts()
    const filteredProducts = products.filter(p => p.id !== id)
    
    await writeScrapedProducts(filteredProducts)

    return NextResponse.json({
      success: true,
      message: 'Product verwijderd',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// PUT: Update een scraped product (bijv. custom EAN)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is verplicht' },
        { status: 400 }
      )
    }

    const products = await readScrapedProducts()
    const productIndex = products.findIndex(p => p.id === id)

    if (productIndex === -1) {
      return NextResponse.json(
        { error: 'Product niet gevonden' },
        { status: 404 }
      )
    }

    products[productIndex] = {
      ...products[productIndex],
      ...updates,
    }

    await writeScrapedProducts(products)

    return NextResponse.json({
      success: true,
      data: products[productIndex],
      message: 'Product bijgewerkt',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

