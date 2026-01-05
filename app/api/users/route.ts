import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/users - List all users (admin only)
 */
export async function GET() {
  try {
    // Require admin authentication
    await requireAdmin()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Compute effective status: users should only be "active" if email is verified
    const usersWithEffectiveStatus = users.map(user => ({
      ...user,
      // Effective status: only "active" if email is verified, otherwise use database status
      // But if database status is "active" and email is not verified, show as "pending" conceptually
      // We'll handle this in the frontend by checking emailVerified
      effectiveStatus: user.emailVerified ? user.status : (user.status === 'active' ? 'pending' : user.status),
    }))

    return NextResponse.json({ users: usersWithEffectiveStatus })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Interdit' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Une erreur s\'est produite' },
      { status: 500 }
    )
  }
}
