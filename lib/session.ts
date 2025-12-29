import { prisma } from './prisma'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'session_id'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
  status: string
}

/**
 * Create a new server-side session for a user
 * @param userId - The user ID to create a session for
 * @returns The session ID
 */
export async function createSession(userId: string): Promise<string> {
  // Generate a secure session ID
  const sessionId = crypto.randomBytes(32).toString('hex')

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  // Create session in database
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  })

  return sessionId
}

/**
 * Validate and retrieve session data
 * @param sessionId - The session ID to validate
 * @returns The user data if session is valid, null otherwise
 */
export async function validateSession(sessionId: string): Promise<SessionUser | null> {
  if (!sessionId) {
    return null
  }

  try {
    // Find session with user data
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        },
      },
    })

    // Check if session exists
    if (!session) {
      return null
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.session.delete({
        where: { id: sessionId },
      })
      return null
    }

    // Check if user is active (only active users can access the system)
    // Suspended and disabled users cannot access
    if (session.user.status !== 'active') {
      return null
    }

    return session.user
  } catch (error) {
    // Silently handle session validation errors
    return null
  }
}

/**
 * Get current session from cookies
 * @returns The user data if authenticated, null otherwise
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionId) {
    return null
  }

  return validateSession(sessionId)
}

/**
 * Require authentication - throws error if not authenticated
 * @returns The authenticated user data
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentSession()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

/**
 * Require admin role - throws error if not admin
 * @returns The authenticated admin user data
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()

  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }

  return user
}

/**
 * Delete a session (logout)
 * @param sessionId - The session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await prisma.session.delete({
      where: { id: sessionId },
    })
  } catch (error) {
    // Session might already be deleted, ignore error
    // Silently handle session deletion errors
  }
}

/**
 * Delete all sessions for a user
 * @param userId - The user ID
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  })
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

/**
 * Set session cookie
 * @param sessionId - The session ID to set
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
    path: '/',
  })
}

/**
 * Delete session cookie
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
