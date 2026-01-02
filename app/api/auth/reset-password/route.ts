import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Le jeton et le mot de passe sont requis' },
        { status: 400 }
      )
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: true,
      },
    })

    // Check if token exists
    if (!resetToken) {
      return NextResponse.json(
        { error: 'Jeton de réinitialisation invalide ou expiré' },
        { status: 400 }
      )
    }

    // Check if token has been used
    if (resetToken.used) {
      return NextResponse.json(
        { error: 'Ce jeton de réinitialisation a déjà été utilisé' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
      return NextResponse.json(
        { error: 'Le jeton de réinitialisation a expiré. Veuillez en demander un nouveau.' },
        { status: 400 }
      )
    }

    // Check if user is active
    if (resetToken.user.status !== 'active') {
      return NextResponse.json(
        { error: 'Le compte n\'est pas actif' },
        { status: 403 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password and mark token as used in a transaction
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
        },
      })

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
        },
      })

      // Delete all other unused reset tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          used: false,
          id: {
            not: resetToken.id,
          },
        },
      })
    })

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Le mot de passe a été réinitialisé avec succès.',
    })
  } catch (error) {
    console.error('Error in reset-password:', error)
    return NextResponse.json(
      { error: 'Une erreur s\'est produite. Veuillez réessayer plus tard.' },
      { status: 500 }
    )
  }
}


