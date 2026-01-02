import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { deleteUserSessions } from '@/lib/session'

export const runtime = 'nodejs'

/**
 * PATCH /api/users/[userId] - Update user status (admin only)
 * Body: { status: 'active' | 'suspended' | 'disabled' }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Require admin authentication
    const admin = await requireAdmin()

    const { userId } = await context.params
    const body = await request.json()
    const { status } = body

    // Validate input
    if (!['active', 'suspended', 'disabled'].includes(status)) {
      return NextResponse.json(
        { error: 'Le statut doit être l\'un des suivants : active, suspended, disabled' },
        { status: 400 }
      )
    }

    // Prevent admin from modifying themselves
    if (userId === admin.id) {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut de votre propre compte' },
        { status: 400 }
      )
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    })

    // If suspending or disabling user, delete all their sessions
    if (status === 'suspended' || status === 'disabled') {
      await deleteUserSessions(userId)
    }

    const statusMessages = {
      active: 'Utilisateur activé avec succès',
      suspended: 'Utilisateur suspendu avec succès',
      disabled: 'Utilisateur désactivé avec succès',
    }

    return NextResponse.json({
      success: true,
      user,
      message: statusMessages[status as keyof typeof statusMessages],
    })
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

/**
 * DELETE /api/users/[userId] - Delete user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Require admin authentication
    const admin = await requireAdmin()

    const { userId } = await context.params

    // Prevent admin from deleting themselves
    if (userId === admin.id) {
      return NextResponse.json(
        { error: 'Impossible de supprimer votre propre compte' },
        { status: 400 }
      )
    }

    // Delete user (cascades to sessions)
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({
      success: true,
      message: 'Utilisateur supprimé avec succès',
    })
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
