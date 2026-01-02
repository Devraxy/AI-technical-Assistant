'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Une erreur s\'est produite')
      } else {
        setSuccess(true)
      }
    } catch (error) {
      setError('Une erreur s\'est produite. Veuillez réessayer plus tard.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Mot de passe oublié ?
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-sm text-green-800 dark:text-green-200">
                Si un compte avec cet email existe, nous vous avons envoyé un lien de réinitialisation de mot de passe. Veuillez vérifier votre email.
              </p>
            </div>
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Retour à la connexion
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                placeholder="your.email@example.com"
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
            </Button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


