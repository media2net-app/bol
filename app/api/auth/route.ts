import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Demo accounts (in production, validate against your API)
    const demoAccounts: Record<string, { password: string; role: 'scraper-only' | 'full-access' }> = {
      'davy@bol.com': { password: 'D@vyB0l!', role: 'scraper-only' },
      'demo@bol.com': { password: 'demo123', role: 'full-access' },
    }

    const matchedAccount = demoAccounts[email]

    // Validate credentials
    if (matchedAccount && password === matchedAccount.password) {
      // In a real app, you would make an API call here using apiKey and apiSecret
      // For now, we'll just validate and return success
      
      return NextResponse.json({
        success: true,
        user: {
          email,
          role: matchedAccount.role,
        },
      })
    }

    return NextResponse.json(
      { error: 'Ongeldig e-mailadres of wachtwoord' },
      { status: 401 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

