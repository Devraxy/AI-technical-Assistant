import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendEmailVerification } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Generate verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Create new user (email not verified yet)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        role: 'user', // Default role is 'user'
        status: 'active', // New users are active by default
        emailVerified: false, // Email not verified yet
        emailVerificationTokens: {
          create: {
            token: verificationToken,
            code: verificationCode,
            expiresAt,
          },
        },
      },
    })

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&code=${verificationCode}`

    try {
      await sendEmailVerification(
        user.email,
        verificationUrl,
        verificationCode
      )
    } catch (emailError) {
      // If email sending fails, we should still return success but log the error
      console.error('Failed to send verification email:', emailError)
      // Don't fail the signup - user can request a new verification email later
    }

    // Return success - user needs to verify email before logging in
    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      requiresVerification: true,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    )
  }
}


