'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, UserCheck, UserX, Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  status: 'active' | 'suspended' | 'disabled'
  createdAt: string
  updatedAt: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    fetchCurrentUser()
    fetchUsers()
  }, [])

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else if (response.status === 403) {
        alert('Access denied. Admin privileges required.')
        router.push('/')
      }
    } catch (error) {
      alert('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function updateUserStatus(userId: string, newStatus: 'active' | 'suspended' | 'disabled') {
    const statusLabels = {
      active: 'activate',
      suspended: 'suspend',
      disabled: 'disable',
    }

    if (!confirm(`Are you sure you want to ${statusLabels[newStatus]} this user?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update user')
      }
    } catch (error) {
      alert('Failed to update user')
    }
  }

  async function deleteUser(userId: string, userEmail: string) {
    if (!confirm(`Are you sure you want to permanently delete ${userEmail}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete user')
      }
    } catch (error) {
      alert('Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  const statusConfig = {
                    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
                    suspended: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Suspended' },
                    disabled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Disabled' },
                  }
                  const config = statusConfig[user.status]

                  return (
                    <tr key={user.id} className={user.status !== 'active' ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'No name'}
                          {currentUser?.id === user.id && (
                            <span className="ml-2 text-xs text-blue-600">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {currentUser?.id !== user.id && (
                            <>
                              {user.status !== 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateUserStatus(user.id, 'active')}
                                >
                                  <UserCheck className="h-4 w-4" />
                                  Activate
                                </Button>
                              )}
                              {user.status !== 'suspended' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateUserStatus(user.id, 'suspended')}
                                >
                                  <UserX className="h-4 w-4" />
                                  Suspend
                                </Button>
                              )}
                              {user.status !== 'disabled' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateUserStatus(user.id, 'disabled')}
                                >
                                  <UserX className="h-4 w-4" />
                                  Disable
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteUser(user.id, user.email)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </>
                          )}
                          {currentUser?.id === user.id && (
                            <span className="text-xs text-gray-500 py-2">
                              Cannot modify own account
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}
