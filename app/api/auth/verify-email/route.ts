import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const code = searchParams.get('code')

    // Validate input - need either token or code
    if (!token && !code) {
      return NextResponse.json(
        { error: 'Le jeton ou le code de vérification est requis' },
        { status: 400 }
      )
    }

    // Find verification token
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: {
        OR: [
          token ? { token } : {},
          code ? { code } : {},
        ],
        used: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        user: true,
      },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Jeton de vérification invalide ou expiré' },
        { status: 400 }
      )
    }

    // Check if user is already verified
    if (verificationToken.user.emailVerified) {
      // Mark token as used and return success
      await prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      })

      return NextResponse.json({
        success: true,
        message: 'L\'email est déjà vérifié',
        alreadyVerified: true,
      })
    }

    // Verify the user's email
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    })

    // Mark token as used
    await prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    })

    // Delete all other verification tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: verificationToken.userId,
        id: { not: verificationToken.id },
      },
    })

    // Create session and log user in
    const sessionId = await createSession(verificationToken.userId)
    await setSessionCookie(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Email vérifié avec succès',
      user: {
        id: verificationToken.user.id,
        email: verificationToken.user.email,
        name: verificationToken.user.name,
        role: verificationToken.user.role,
      },
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Une erreur s\'est produite lors de la vérification de l\'email' },
      { status: 500 }
    )
  }
}

// POST endpoint for code-based verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, email } = body

    // Validate input
    if (!code) {
      return NextResponse.json(
        { error: 'Le code de vérification est requis' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'L\'email est requis' },
        { status: 400 }
      )
    }

    // Find verification token by code and email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        emailVerificationTokens: {
          where: {
            code,
            used: false,
            expiresAt: {
              gt: new Date(), // Not expired
            },
          },
        },
      },
    })

    if (!user || user.emailVerificationTokens.length === 0) {
      return NextResponse.json(
        { error: 'Code de vérification invalide ou expiré' },
        { status: 400 }
      )
    }

    const verificationToken = user.emailVerificationTokens[0]

    // Check if user is already verified
    if (user.emailVerified) {
      // Mark token as used
      await prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      })

      return NextResponse.json({
        success: true,
        message: 'L\'email est déjà vérifié',
        alreadyVerified: true,
      })
    }

    // Verify the user's email
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    })

    // Mark token as used
    await prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    })

    // Delete all other verification tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        id: { not: verificationToken.id },
      },
    })

    // Create session and log user in
    const sessionId = await createSession(user.id)
    await setSessionCookie(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Email vérifié avec succès',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Une erreur s\'est produite lors de la vérification de l\'email' },
      { status: 500 }
    )
  }
}

