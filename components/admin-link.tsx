'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

export function AdminLink() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAdmin() {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.user.role === 'admin')
        }
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  if (loading || !isAdmin) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push('/admin/users')}
    >
      <Settings className="h-4 w-4" />
      Admin Panel
    </Button>
  )
}
