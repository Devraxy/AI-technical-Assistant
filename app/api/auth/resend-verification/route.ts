import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmailVerification } from '@/lib/email'
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
        message: 'Si un compte avec cet email existe et n\'est pas vérifié, nous vous avons envoyé un lien de vérification.',
      })
    }

    // Check if user is already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Votre email est déjà vérifié. Vous pouvez vous connecter maintenant.',
        alreadyVerified: true,
      })
    }

    // Check if user is active (only active users can request verification)
    if (user.status !== 'active') {
      // Still return success to prevent account enumeration
      return NextResponse.json({
        success: true,
        message: 'Si un compte avec cet email existe et n\'est pas vérifié, nous vous avons envoyé un lien de vérification.',
      })
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Generate verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Delete any existing unused verification tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    })

    // Create new verification token
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        code: verificationCode,
        expiresAt,
      },
    })

    // Generate verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&code=${verificationCode}`

    // Send verification email
    try {
      await sendEmailVerification(
        user.email,
        verificationUrl,
        verificationCode
      )
    } catch (emailError) {
      // If email fails, delete the token and return error
      await prisma.emailVerificationToken.deleteMany({
        where: {
          userId: user.id,
          token: verificationToken,
        },
      })
      
      console.error('Failed to send verification email:', emailError)
      return NextResponse.json(
        { error: 'Échec de l\'envoi de l\'email de vérification. Veuillez réessayer plus tard.' },
        { status: 500 }
      )
    }

    // Return success (don't reveal if user exists)
    return NextResponse.json({
      success: true,
      message: 'Si un compte avec cet email existe et n\'est pas vérifié, nous vous avons envoyé un lien de vérification.',
    })
  } catch (error) {
    console.error('Error in resend-verification:', error)
    return NextResponse.json(
      { error: 'Une erreur s\'est produite. Veuillez réessayer plus tard.' },
      { status: 500 }
    )
  }
}

