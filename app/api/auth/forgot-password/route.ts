import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'L\'email est requis' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // For security, don't reveal if user exists or not
    // Always return success message
    if (!user) {
      // Return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'Si un compte avec cet email existe, nous vous avons envoyé un lien de réinitialisation de mot de passe.',
      })
    }

    // Check if user is active (only active users can reset password)
    if (user.status !== 'active') {
      // Still return success to prevent account enumeration
      return NextResponse.json({
        success: true,
        message: 'Si un compte avec cet email existe, nous vous avons envoyé un lien de réinitialisation de mot de passe.',
      })
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    })

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    })

    // Generate reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken, resetUrl)
    } catch (emailError) {
      // If email fails, delete the token and return error
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          token: resetToken,
        },
      })
      
      console.error('Failed to send password reset email:', emailError)
      return NextResponse.json(
        { error: 'Échec de l\'envoi de l\'email de réinitialisation de mot de passe. Veuillez réessayer plus tard.' },
        { status: 500 }
      )
    }

    // Return success (don't reveal if user exists)
    return NextResponse.json({
      success: true,
      message: 'Si un compte avec cet email existe, nous vous avons envoyé un lien de réinitialisation de mot de passe.',
    })
  } catch (error) {
    console.error('Error in forgot-password:', error)
    return NextResponse.json(
      { error: 'Une erreur s\'est produite. Veuillez réessayer plus tard.' },
      { status: 500 }
    )
  }
}


