import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CONVERTED_DIR = path.join(process.cwd(), 'Converted')

/**
 * POST: Convert EAN en download afbeeldingen naar map structuur
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ean, images, productTitle } = body

    if (!ean || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'EAN en images zijn verplicht' },
        { status: 400 }
      )
    }

    // Create directory structure: Converted/{EAN}
    const eanDir = path.join(CONVERTED_DIR, ean)

    // Ensure directories exist
    if (!existsSync(CONVERTED_DIR)) {
      await mkdir(CONVERTED_DIR, { recursive: true })
    }
    if (!existsSync(eanDir)) {
      await mkdir(eanDir, { recursive: true })
    }

    const savedImages: string[] = []
    const errors: string[] = []

    // Download and save each image
    for (let i = 0; i < images.length; i++) {
      try {
        const imageUrl = images[i]
        
        // Fetch image via proxy or directly
        let imageResponse: Response
        try {
          // Try to fetch directly first
          imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.amazon.nl/',
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            },
          })
        } catch {
          // If direct fetch fails, try without headers
          imageResponse = await fetch(imageUrl)
        }

        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`)
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const buffer = Buffer.from(imageBuffer)

        // Determine file extension from content type or URL
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
        let extension = 'jpg'
        if (contentType.includes('png')) extension = 'png'
        else if (contentType.includes('gif')) extension = 'gif'
        else if (contentType.includes('webp')) extension = 'webp'

        // Save image with numbered filename directly in EAN directory
        const filename = `image_${i + 1}.${extension}`
        const filePath = path.join(eanDir, filename)
        
        await writeFile(filePath, buffer)

        savedImages.push(filename)
      } catch (error: any) {
        errors.push(`Afbeelding ${i + 1}: ${error.message}`)
      }
    }

    // Save product info as JSON
    const productInfoPath = path.join(eanDir, 'product-info.json')
    await writeFile(
      productInfoPath,
      JSON.stringify({
        ean,
        productTitle,
        imagesCount: images.length,
        savedImages,
        convertedAt: new Date().toISOString(),
      }, null, 2),
      'utf-8'
    )

    return NextResponse.json({
      success: true,
      message: `${savedImages.length} afbeeldingen opgeslagen`,
      data: {
        ean,
        directory: `Converted/${ean}`,
        savedImages,
        errors: errors.length > 0 ? errors : undefined,
      },
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

