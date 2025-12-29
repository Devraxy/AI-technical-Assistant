'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [verifying, setVerifying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'link' | 'code'>('link')

  useEffect(() => {
    // Check if token is in URL (link verification)
    const token = searchParams.get('token')
    const codeParam = searchParams.get('code')

    if (token) {
      // Auto-verify via link
      verifyByLink(token)
    } else if (codeParam) {
      // Pre-fill code from URL
      setCode(codeParam)
      setMode('code')
    }
  }, [searchParams])

  const verifyByLink = async (token: string) => {
    setVerifying(true)
    setError('')

    try {
      const response = await fetch(`/api/auth/verify-email?token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Verification failed')
        setMode('code') // Switch to code mode if link fails
      } else {
        setSuccess(true)
        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 2000)
      }
    } catch (error) {
      setError('An error occurred during verification')
      setMode('code') // Switch to code mode on error
    } finally {
      setVerifying(false)
    }
  }

  const verifyByCode = async (e: FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError('')

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code')
      setVerifying(false)
      return
    }

    if (!email) {
      setError('Please enter your email address')
      setVerifying(false)
      return
    }

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Verification failed')
      } else {
        setSuccess(true)
        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 2000)
      }
    } catch (error) {
      setError('An error occurred during verification')
    } finally {
      setVerifying(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Email Verified!
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Your email has been successfully verified. Redirecting...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Verify Your Email
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {mode === 'link'
              ? 'Verifying your email...'
              : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {mode === 'code' && (
          <form onSubmit={verifyByCode} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={verifying}
                  className="mt-1"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={verifying}
                  className="mt-1 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the 6-digit code from your email
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={verifying}
              className="w-full"
            >
              {verifying ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>
        )}

        {mode === 'link' && verifying && (
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Verifying your email address...
            </p>
          </div>
        )}

        {error && mode === 'link' && (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <Button
              onClick={() => setMode('code')}
              variant="outline"
              className="mt-4 w-full"
            >
              Verify with Code Instead
            </Button>
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Didn't receive the email?{' '}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up again
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

