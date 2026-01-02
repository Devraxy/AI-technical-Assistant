import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'L\'email et le mot de passe sont requis' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Check if user exists
    if (!user) {
      return NextResponse.json(
        { error: 'Email ou mot de passe invalide' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Veuillez vérifier votre adresse email avant de vous connecter. Vérifiez votre email pour le lien de vérification.',
          requiresVerification: true 
        },
        { status: 403 }
      )
    }

    // Check user status - only active users can log in
    if (user.status === 'disabled') {
      return NextResponse.json(
        { error: 'Le compte a été désactivé' },
        { status: 403 }
      )
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'Le compte a été suspendu' },
        { status: 403 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Email ou mot de passe invalide' },
        { status: 401 }
      )
    }

    // Create server-side session
    const sessionId = await createSession(user.id)

    // Set session cookie
    await setSessionCookie(sessionId)

    // Return user data (no tokens!)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Une erreur s\'est produite lors de la connexion' },
      { status: 500 }
    )
  }
}
