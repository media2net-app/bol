import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const DUMMY_EAN_PATH = path.join(process.cwd(), 'public', 'dummy-eans.csv')

export async function GET() {
  try {
    const fileContent = await readFile(DUMMY_EAN_PATH, 'utf-8')
    const eans = fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return NextResponse.json({
      eans,
      total: eans.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Kon de EAN lijst niet laden',
        message: error?.message || 'Onbekende fout',
      },
      { status: 500 }
    )
  }
}


