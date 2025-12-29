'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  status: string
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      // Skip auth check on login, signup, forgot-password, and reset-password pages
      if (
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname === '/forgot-password' ||
        pathname.startsWith('/reset-password')
      ) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/me')

        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        } else {
          // Not authenticated - redirect to login
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [pathname, router])

  if (
    loading &&
    pathname !== '/login' &&
    pathname !== '/signup' &&
    pathname !== '/forgot-password' &&
    !pathname.startsWith('/reset-password')
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
