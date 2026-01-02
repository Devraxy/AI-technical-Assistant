import { NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json(
      { error: 'Une erreur s\'est produite' },
      { status: 500 }
    )
  }
}
