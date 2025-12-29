import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession, deleteSessionCookie } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session_id')?.value

    if (sessionId) {
      // Delete session from database
      await deleteSession(sessionId)
    }

    // Delete session cookie
    await deleteSessionCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}
